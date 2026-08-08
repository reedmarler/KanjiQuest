/**
 * Japanese text-to-speech for the dashboard's rotating sentence.
 *
 * Uses the browser's built-in speechSynthesis rather than an audio service, so
 * it works offline and costs nothing. Voice availability differs by platform —
 * a Japanese voice is picked when the OS has one, and speech is skipped
 * entirely when it does not, since an English voice reading kana is worse than
 * silence.
 */

let cachedVoice: SpeechSynthesisVoice | null | undefined

function speechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Voices load asynchronously in most browsers, so the first lookup can come
 * back empty. The result is only cached once a real voice list has arrived.
 */
function japaneseVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice
  if (!speechAvailable()) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const match = voices.find((voice) => voice.lang === 'ja-JP')
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('ja'))
    ?? null
  cachedVoice = match
  return match
}

export function canSpeakJapanese() {
  return speechAvailable() && japaneseVoice() !== null
}

/** True once the browser has reported its voice list, however small. */
export function speechVoicesReady() {
  return speechAvailable() && window.speechSynthesis.getVoices().length > 0
}

/**
 * Reports whether a Japanese voice is usable, now and whenever that changes.
 *
 * Voice loading is genuinely awkward: `getVoices()` is empty on first paint,
 * but `voiceschanged` only fires if the list was *not* already populated — so
 * subscribing alone leaves the caller stuck on the initial empty answer, and
 * checking once alone races the load. Doing both, plus a few short retries,
 * is what actually covers every browser.
 */
export function watchSpeechSupport(listener: (supported: boolean) => void) {
  if (!speechAvailable()) {
    listener(false)
    return () => {}
  }

  const report = () => {
    cachedVoice = undefined
    listener(canSpeakJapanese())
  }

  report()
  window.speechSynthesis.addEventListener('voiceschanged', report)

  // Covers the case where voices arrive without the event ever firing.
  const retries = [100, 400, 1200].map((delay) => window.setTimeout(() => {
    if (speechVoicesReady()) report()
  }, delay))

  return () => {
    window.speechSynthesis.removeEventListener('voiceschanged', report)
    for (const timer of retries) window.clearTimeout(timer)
  }
}

export function stopSpeaking() {
  if (speechAvailable()) window.speechSynthesis.cancel()
}

/**
 * Speaks one sentence, replacing anything already queued — the hero sentence
 * changes on a timer, so a backlog would quickly fall out of sync with what is
 * on screen.
 */
export function speakJapanese(text: string, rate = 0.9, volume = 1) {
  if (!text.trim()) return
  const voice = japaneseVoice()
  if (!voice) return

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = rate
  utterance.volume = volume
  window.speechSynthesis.speak(utterance)
}
