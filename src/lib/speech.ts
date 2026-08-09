/**
 * Japanese text-to-speech for the dashboard's rotating sentence.
 *
 * Uses the local Style-BERT-VITS2 service when it is running, then falls back
 * to the browser's built-in speechSynthesis so dashboard audio still works on
 * other devices and deployments.
 */

const TTS_SERVER_URL = 'http://127.0.0.1:8001'
const VOICE_STORAGE_KEY = 'kanji-quest-hero-voice-v1'

export type SpeechVoiceGender = 'girl' | 'boy'
const VOICE_IDS: Record<SpeechVoiceGender, string> = {
  girl: 'not-anime-calm',
  boy: 'not-anime-lightfire',
}

let serverAvailable = false
let currentAudio: HTMLAudioElement | null = null
let speechGeneration = 0

export function canSpeakJapanese() {
  return serverAvailable || canUseBrowserSpeech()
}

export function savedVoiceGender(): SpeechVoiceGender {
  const stored = window.localStorage.getItem(VOICE_STORAGE_KEY)
  return stored === 'boy' ? 'boy' : 'girl'
}

export function setVoiceGender(gender: SpeechVoiceGender) {
  window.localStorage.setItem(VOICE_STORAGE_KEY, gender)
}

function canUseBrowserSpeech() {
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

function findJapaneseBrowserVoice() {
  if (!canUseBrowserSpeech()) return undefined

  const voices = window.speechSynthesis.getVoices()
  return voices.find((voice) => voice.lang.toLowerCase().startsWith('ja'))
    ?? voices.find((voice) => voice.name.toLowerCase().includes('japanese'))
}

function speakWithBrowserVoice(text: string, rate: number, volume: number, generation: number) {
  if (!canUseBrowserSpeech() || generation !== speechGeneration) return

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const japaneseVoice = findJapaneseBrowserVoice()
  utterance.lang = 'ja-JP'
  utterance.rate = rate
  utterance.volume = volume
  if (japaneseVoice) utterance.voice = japaneseVoice
  window.speechSynthesis.speak(utterance)
}

/**
 * Reports whether any dashboard speech route is available. Browser voices can
 * arrive asynchronously, so listen for both local-server and browser changes.
 */
export function watchSpeechSupport(listener: (supported: boolean) => void) {
  let cancelled = false
  const report = () => {
    if (!cancelled) listener(canSpeakJapanese())
  }

  report()

  fetch(`${TTS_SERVER_URL}/voices`, { method: 'GET' })
    .then((res) => {
      if (cancelled) return
      serverAvailable = res.ok
      report()
    })
    .catch(() => {
      if (cancelled) return
      serverAvailable = false
      report()
    })

  if (canUseBrowserSpeech()) {
    window.speechSynthesis.addEventListener('voiceschanged', report)
  }

  return () => {
    cancelled = true
    if (canUseBrowserSpeech()) {
      window.speechSynthesis.removeEventListener('voiceschanged', report)
    }
  }
}

export function stopSpeaking() {
  speechGeneration++
  if (canUseBrowserSpeech()) window.speechSynthesis.cancel()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
}

/**
 * Speaks one sentence, replacing anything already playing. The hero sentence
 * changes on a timer, so a backlog would quickly fall out of sync.
 */
export function speakJapanese(text: string, rate = 0.9, volume = 1) {
  if (!text.trim()) return
  stopSpeaking()
  const generation = ++speechGeneration

  if (!serverAvailable) {
    speakWithBrowserVoice(text, rate, volume, generation)
    return
  }

  fetch(`${TTS_SERVER_URL}/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speed: rate, voice_id: VOICE_IDS[savedVoiceGender()] }),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`TTS request failed: ${res.status}`)
      serverAvailable = true
      return res.blob()
    })
    .then((blob) => {
      if (generation !== speechGeneration) return
      const audio = new Audio(URL.createObjectURL(blob))
      audio.volume = volume
      currentAudio = audio
      void audio.play()
    })
    .catch(() => {
      serverAvailable = false
      speakWithBrowserVoice(text, rate, volume, generation)
    })
}
