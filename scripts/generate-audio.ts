/**
 * Pre-renders the app's fixed vocabulary audio into public/audio/.
 *
 * The hero sentence generator builds novel text at runtime, so its output can
 * never be pre-rendered. Everything else — vocab words, kanji example words —
 * is a known, finite list, and that list is what this script speaks once and
 * commits. The result ships as static files with the site: no TTS service has
 * to be running in production, and a metered provider is charged exactly once
 * per clip no matter how many people listen.
 *
 * Talks to the TTS service rather than a provider API directly, so the
 * provider credential stays server-side and whichever engine is configured
 * (local checkpoint or hosted clone) is what gets rendered.
 *
 * Usage:
 *   # with the TTS service running (see backend/tts_service/README.md)
 *   npm run generate:audio -- --scope=focus     # 342 focus-set words
 *   npm run generate:audio -- --scope=all       # every study card (default)
 *   npm run generate:audio -- --dry-run         # count and price it, render nothing
 *
 * Re-running skips clips already on disk, so it is resumable and safe to run
 * again after adding content — only the new words are billed.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { allCards } from '../src/data'
import { vocabFocusSets } from '../src/data/vocabFocusSets'
import { kanjiLabEntries } from '../src/lib/kanjiLabCatalog'
import { spokenTextForCard, spokenTextForWord } from '../src/lib/spokenText'

const AUDIO_DIR = path.resolve(import.meta.dirname, '../public/audio')
const MANIFEST_PATH = path.join(AUDIO_DIR, 'manifest.json')

/** Must stay in sync with SPEECH_SPEEDS in src/lib/speechSpeeds.ts. */
const ALL_SPEEDS = { natural: 1, learning: 0.65 } as const
type SpeedName = keyof typeof ALL_SPEEDS

const args = process.argv.slice(2)
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const has = (name: string) => args.includes(`--${name}`)

const scope = (flag('scope') ?? 'all') as 'focus' | 'kanji' | 'all'
const serviceUrl = flag('service') ?? process.env.TTS_API_URL ?? 'http://127.0.0.1:8001'
const voiceId = flag('voice') ?? process.env.TTS_VOICE_ID ?? ''
const dryRun = has('dry-run')
const prune = has('prune')

// The 🐢 button slows the natural clip with the audio element's playbackRate,
// so one render covers both buttons — half the clips, half the credits, half
// the repo. --both-speeds renders a natively slowed take too, which
// re-articulates rather than stretching and is a little crisper for
// listening practice.
const SPEEDS: Partial<Record<SpeedName, number>> = has('both-speeds')
  ? ALL_SPEEDS
  : { natural: ALL_SPEEDS.natural }

/** Same digest the browser computes in src/lib/staticAudio.ts. */
function keyFor(text: string) {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)
}

function collectTexts(): string[] {
  const texts: string[] = []

  // spokenTextForCard is the same resolution the app's listen buttons use.
  // It has to be: clips are keyed by a hash of the spoken text, so rendering
  // anything else produces files the app will never ask for. It also keeps
  // romaji readings out — roughly half the vocabulary stores "jikan" rather
  // than じかん, and a hosted engine reads that as an English word.
  if (scope === 'focus' || scope === 'all') {
    for (const set of vocabFocusSets) {
      for (const card of set.cards) texts.push(spokenTextForCard(card))
    }
  }
  if (scope === 'kanji' || scope === 'all') {
    for (const entry of kanjiLabEntries) texts.push(spokenTextForWord(entry.example.word, entry.example.reading))
  }
  if (scope === 'all') {
    for (const card of allCards) texts.push(spokenTextForCard(card))
  }

  return [...new Set(texts.map((t) => t.trim()).filter(Boolean))]
}

async function synthesize(text: string, speed: number): Promise<{ audio: Buffer; ext: string }> {
  const response = await fetch(`${serviceUrl}/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speed, voice_id: voiceId }),
  })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${JSON.stringify(text)}`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  const ext = contentType.includes('mpeg') ? 'mp3' : contentType.includes('ogg') ? 'ogg' : 'wav'
  return { audio: Buffer.from(await response.arrayBuffer()), ext }
}

const texts = collectTexts()
const characters = texts.reduce((sum, text) => sum + [...text].length, 0)
const clips = texts.length * Object.keys(SPEEDS).length

console.log(`scope           ${scope}`)
console.log(`unique texts    ${texts.length.toLocaleString()}`)
console.log(`characters      ${characters.toLocaleString()}`)
console.log(`clips to render ${clips.toLocaleString()} (${Object.keys(SPEEDS).join(' + ')})`)
console.log(`credits         ${(characters * Object.keys(SPEEDS).length).toLocaleString()} at 1/char, ` +
  `${(characters * Object.keys(SPEEDS).length / 2).toLocaleString()} at 0.5/char (turbo/flash)`)

if (dryRun) {
  console.log('\n--dry-run: nothing rendered.')
  process.exit(0)
}

mkdirSync(AUDIO_DIR, { recursive: true })

let rendered = 0
let skipped = 0
let failed = 0
let extension = 'mp3'
const done: string[] = []

for (const [index, text] of texts.entries()) {
  const key = keyFor(text)
  let complete = true

  for (const [speedName, speed] of Object.entries(SPEEDS) as [SpeedName, number][]) {
    // Any existing extension counts as a hit, so switching providers doesn't
    // silently re-bill everything.
    const existing = ['mp3', 'wav', 'ogg'].find((ext) => existsSync(path.join(AUDIO_DIR, `${key}-${speedName}.${ext}`)))
    if (existing) {
      extension = existing
      skipped += 1
      continue
    }

    try {
      const { audio, ext } = await synthesize(text, speed)
      extension = ext
      writeFileSync(path.join(AUDIO_DIR, `${key}-${speedName}.${ext}`), audio)
      rendered += 1
    } catch (error) {
      console.error(`  ✗ ${text} (${speedName}): ${(error as Error).message}`)
      failed += 1
      complete = false
    }
  }

  if (complete) done.push(key)
  if ((index + 1) % 100 === 0) {
    console.log(`  ${index + 1}/${texts.length} — ${rendered} rendered, ${skipped} cached, ${failed} failed`)
  }
}

// Only keys with every speed present go in the manifest: a partial entry would
// have the client confidently request a file that isn't there.
const manifest = {
  voice: voiceId || '(service default)',
  ext: extension,
  speeds: SPEEDS,
  keys: done.sort(),
}
writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest)}\n`)

if (prune) {
  const wanted = new Set(done.flatMap((key) => Object.keys(SPEEDS).map((s) => `${key}-${s}.${extension}`)))
  for (const file of readdirSync(AUDIO_DIR)) {
    if (file === 'manifest.json' || wanted.has(file)) continue
    unlinkSync(path.join(AUDIO_DIR, file))
    console.log(`  pruned ${file}`)
  }
}

console.log(`\nrendered ${rendered}, cached ${skipped}, failed ${failed}`)
console.log(`manifest: ${done.length} playable texts -> ${path.relative(process.cwd(), MANIFEST_PATH)}`)
if (failed) process.exitCode = 1
