/**
 * Pre-rendered audio shipped with the site.
 *
 * `npm run generate:audio` speaks the app's fixed vocabulary once and writes
 * the clips to public/audio/. They deploy as ordinary static files, so on
 * GitHub Pages the real voice works with no TTS service running, no API key
 * anywhere, and no per-play cost. Anything not in the manifest — every hero
 * sentence, since those are generated at runtime — falls through to the live
 * service and then to the browser voice.
 */

import { SPEECH_SPEEDS, type SpeechSpeed } from './speechSpeeds'

interface AudioManifest {
  voice: string
  ext: string
  speeds: Partial<Record<SpeechSpeed, number>>
  keys: string[]
}

const MANIFEST_URL = `${import.meta.env.BASE_URL}audio/manifest.json`

let manifestPromise: Promise<{ manifest: AudioManifest; keys: Set<string> } | null> | undefined

function loadManifest() {
  // Fetched once, lazily, on the first speak — never on app start, so a
  // deployment with no pre-rendered audio pays nothing for this module.
  manifestPromise ??= fetch(MANIFEST_URL)
    .then((response) => (response.ok ? response.json() as Promise<AudioManifest> : null))
    .then((manifest) => (manifest ? { manifest, keys: new Set(manifest.keys) } : null))
    .catch(() => null)
  return manifestPromise
}

/** SHA-256 prefix, matching keyFor() in scripts/generate-audio.ts. */
async function keyFor(text: string): Promise<string | undefined> {
  // Absent in insecure contexts; the live service still covers those.
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

/** The speed name whose rate matches, or undefined for anything in between. */
function speedNameFor(rate: number): SpeechSpeed | undefined {
  return (Object.keys(SPEECH_SPEEDS) as SpeechSpeed[])
    .find((name) => Math.abs(SPEECH_SPEEDS[name] - rate) < 0.001)
}

/**
 * URL of a pre-rendered clip for this text and rate, or undefined if none was
 * generated. Only the two button speeds are pre-rendered — the Dashboard's
 * slider rates fall through to the service by design.
 */
export async function findStaticAudio(text: string, rate: number): Promise<string | undefined> {
  const speedName = speedNameFor(rate)
  if (!speedName) return undefined

  const loaded = await loadManifest()
  if (!loaded) return undefined
  // A render may cover only some speeds, so trust the manifest over the
  // speed table rather than requesting a file that was never written.
  if (!(speedName in loaded.manifest.speeds)) return undefined

  const key = await keyFor(text.trim())
  if (!key || !loaded.keys.has(key)) return undefined

  return `${import.meta.env.BASE_URL}audio/${key}-${speedName}.${loaded.manifest.ext}`
}
