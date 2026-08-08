/**
 * Japanese text-to-speech for the dashboard's rotating sentence.
 *
 * Calls the local Style-BERT-VITS2 service (backend/tts_service) instead of
 * the browser's built-in speechSynthesis, for far more natural Japanese
 * speech. The service must be running at TTS_SERVER_URL — when it isn't
 * reachable, speech is skipped entirely rather than falling back to a
 * robotic voice.
 */

const TTS_SERVER_URL = 'http://127.0.0.1:8001'
const VOICE_STORAGE_KEY = 'kanji-quest-hero-voice-v1'

export type SpeechVoiceGender = 'girl' | 'boy'
const VOICE_IDS: Record<SpeechVoiceGender, string> = {
  girl: 'not-anime-calm',
  boy: 'not-anime-lightfire',
}

let serverAvailable = true
let currentAudio: HTMLAudioElement | null = null
// Bumped on every speakJapanese call so a slow, stale request that resolves
// after a newer one can tell it's obsolete and skip playing instead of
// stacking audio on top of whatever's already playing.
let speechGeneration = 0

export function canSpeakJapanese() {
  return serverAvailable
}

export function savedVoiceGender(): SpeechVoiceGender {
  const stored = window.localStorage.getItem(VOICE_STORAGE_KEY)
  return stored === 'boy' ? 'boy' : 'girl'
}

export function setVoiceGender(gender: SpeechVoiceGender) {
  window.localStorage.setItem(VOICE_STORAGE_KEY, gender)
}

/**
 * Reports whether the TTS server is reachable, now and whenever that
 * changes. Optimistic on the first call so the UI doesn't hide the speak
 * button while the check is in flight; corrected once the check resolves.
 */
export function watchSpeechSupport(listener: (supported: boolean) => void) {
  let cancelled = false
  listener(serverAvailable)

  fetch(`${TTS_SERVER_URL}/voices`, { method: 'GET' })
    .then((res) => {
      if (cancelled) return
      serverAvailable = res.ok
      listener(serverAvailable)
    })
    .catch(() => {
      if (cancelled) return
      serverAvailable = false
      listener(false)
    })

  return () => {
    cancelled = true
  }
}

export function stopSpeaking() {
  speechGeneration++
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
}

/**
 * Speaks one sentence, replacing anything already playing — the hero
 * sentence changes on a timer, so a backlog would quickly fall out of sync
 * with what is on screen.
 */
export function speakJapanese(text: string, rate = 0.9, volume = 1) {
  if (!text.trim()) return
  stopSpeaking()
  const generation = ++speechGeneration

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
      // A newer call already fired (or stopSpeaking was called) while this
      // request was in flight — don't stack audio on top of it.
      if (generation !== speechGeneration) return
      const audio = new Audio(URL.createObjectURL(blob))
      audio.volume = volume
      currentAudio = audio
      void audio.play()
    })
    .catch(() => {
      serverAvailable = false
    })
}
