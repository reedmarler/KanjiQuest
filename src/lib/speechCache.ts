/**
 * Client-side cache for synthesized speech.
 *
 * The service caches on disk too, but that still costs a network round trip
 * per replay — and on a hosted provider the first synthesis of a sentence is
 * billed. Tapping 🔊 twice on the same card should cost nothing at all, so
 * audio is held in memory for the session and in Cache Storage across
 * reloads.
 *
 * Blobs are stored rather than object URLs: a URL created here would have to
 * outlive every play, and revoking one mid-playback silently breaks audio.
 * Callers create a URL at play time and revoke it when playback ends.
 */

const CACHE_NAME = 'kanji-quest-tts-v1'
/** Roughly a few MB of short sentences — plenty for one study session. */
const MEMORY_LIMIT = 40
/** Cache Storage keys must be URLs; this origin is synthetic and never fetched. */
const SYNTHETIC_ORIGIN = 'https://tts.kanji-quest.invalid/'

/** Insertion-ordered, so the oldest key is always the first one Map yields. */
const memory = new Map<string, Blob>()

export function speechCacheKey(text: string, voiceId: string, rate: number) {
  return `${voiceId}|${rate.toFixed(3)}|${text}`
}

function persistentCache(): Promise<Cache> | undefined {
  // Absent in insecure contexts and older browsers; the memory layer still
  // works there, so this is a degradation rather than a failure.
  if (typeof caches === 'undefined') return undefined
  try {
    return caches.open(CACHE_NAME)
  } catch {
    return undefined
  }
}

function requestUrl(key: string) {
  return SYNTHETIC_ORIGIN + encodeURIComponent(key)
}

function rememberInMemory(key: string, blob: Blob) {
  // Refresh recency: delete then re-set moves the key to the end.
  memory.delete(key)
  memory.set(key, blob)
  while (memory.size > MEMORY_LIMIT) {
    const oldest = memory.keys().next().value
    if (oldest === undefined) break
    memory.delete(oldest)
  }
}

export async function getCachedSpeech(key: string): Promise<Blob | undefined> {
  const inMemory = memory.get(key)
  if (inMemory) {
    rememberInMemory(key, inMemory)
    return inMemory
  }

  const cache = await persistentCache()?.catch(() => undefined)
  if (!cache) return undefined

  try {
    const response = await cache.match(requestUrl(key))
    if (!response) return undefined
    const blob = await response.blob()
    rememberInMemory(key, blob)
    return blob
  } catch {
    return undefined
  }
}

export async function putCachedSpeech(key: string, blob: Blob): Promise<void> {
  rememberInMemory(key, blob)

  const cache = await persistentCache()?.catch(() => undefined)
  if (!cache) return

  try {
    await cache.put(requestUrl(key), new Response(blob, { headers: { 'Content-Type': blob.type } }))
  } catch {
    // Storage quota or a private-mode restriction — the memory layer still
    // covers the common "replay the sentence I'm looking at" case.
  }
}

/** Drops every cached clip. Exposed for a settings-screen "clear audio" action. */
export async function clearCachedSpeech(): Promise<void> {
  memory.clear()
  if (typeof caches === 'undefined') return
  try {
    await caches.delete(CACHE_NAME)
  } catch {
    // Nothing to do — the memory layer is already clear.
  }
}
