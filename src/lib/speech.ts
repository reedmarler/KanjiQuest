/**
 * Japanese text-to-speech.
 *
 * Speech comes from the TTS service (backend/tts_service), which decides for
 * itself whether a local Style-BERT-VITS2 checkpoint or a hosted cloning
 * provider renders the audio. This module never handles a provider
 * credential — it only knows the service's public URL. If the service is
 * unreachable it falls back to the browser's built-in speechSynthesis so
 * audio still works offline and on deployments with no service configured.
 *
 * Configure the endpoint with VITE_TTS_API_URL (see .env.example). That value
 * IS embedded in the built bundle, which is fine for a URL and would not be
 * fine for a key — hence the key living only in the service's environment.
 */

import { getCachedSpeech, putCachedSpeech, speechCacheKey } from './speechCache'
import { findStaticAudio } from './staticAudio'
import { SPEECH_SPEEDS, type SpeechSpeed } from './speechSpeeds'

export { SPEECH_SPEEDS, type SpeechSpeed }

/** Public service URL. Dev falls back to the local uvicorn default. */
const TTS_SERVER_URL = (import.meta.env.VITE_TTS_API_URL as string | undefined)?.trim()
  || (import.meta.env.DEV ? 'http://127.0.0.1:8001' : '')

/** Where live synthesis goes, for callers that must reach the service
 *  directly rather than through speakJapanese — the voice test panel needs a
 *  named voice, which the pre-rendered library cannot provide. Empty means no
 *  service is configured. */
export function ttsServiceUrl() {
  return TTS_SERVER_URL
}

/**
 * Optional fixed voice id. Setting this (to a cloned voice's id, say) makes
 * the whole app speak in that voice without touching code. Left unset, the
 * girl/boy toggle below picks from the local service's voices.
 */
const CONFIGURED_VOICE_ID = (import.meta.env.VITE_TTS_VOICE_ID as string | undefined)?.trim() ?? ''

const VOICE_STORAGE_KEY = 'kanji-quest-hero-voice-v1'

export type SpeechVoiceGender = 'girl' | 'boy'
const VOICE_IDS: Record<SpeechVoiceGender, string> = {
  girl: 'not-anime-calm',
  boy: 'not-anime-lightfire',
}

/**
 * Statuses meaning "not this text, this time" rather than "the service is
 * gone": budget reached, cache-only miss, rate limited. Treating these as an
 * outage would stop the app asking for anything else all session — including
 * lines the service would happily serve.
 */
const PER_REQUEST_REFUSALS = new Set([402, 409, 429])

/** The service rejects anything outside this band, so clamp before sending. */
const MIN_SERVER_RATE = 0.5
const MAX_SERVER_RATE = 2

export type SpeechStatus = 'loading' | 'playing'

export interface SpeakOptions {
  /** The speed the listener should hear. */
  rate?: number
  /**
   * Speed to actually synthesize at, when it differs from `rate`. The gap is
   * made up with the audio element's playbackRate, so 🐢 replays the same
   * clip 🔊 already fetched instead of costing a second render. Pitch is
   * preserved, so it slows without dropping the voice.
   */
  synthesisRate?: number
  volume?: number
  voiceId?: string
  onEnd?: () => void
}

/** Thrown for a refusal that says nothing about the service's health. */
class RefusedOnce extends Error {
  status: number

  constructor(status: number) {
    super(`TTS declined this request: ${status}`)
    this.status = status
  }
}

let serverAvailable = false
let sharedAudio: HTMLAudioElement | null = null
let currentAudio: HTMLAudioElement | null = null
let currentObjectUrl: string | null = null
let audioPrime: Promise<void> | null = null
let speechGeneration = 0
let active: { token: number; status: SpeechStatus } | null = null

/** One silent sample. Playing it synchronously blesses this persistent audio
 * element on iOS; the service blob can then replace its source after fetch. */
const SILENT_WAV = 'data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA'

function getSharedAudio() {
  sharedAudio ??= new Audio()
  sharedAudio.preload = 'auto'
  sharedAudio.setAttribute('playsinline', '')
  return sharedAudio
}

/** Must be called from the original tap handler, before async TTS work. */
function primeAudioPlayback() {
  const audio = getSharedAudio()
  audio.onended = null
  audio.onerror = null
  audio.pause()
  audio.currentTime = 0
  audio.volume = 0
  audio.playbackRate = 1
  audio.src = SILENT_WAV
  audioPrime = audio.play()
    .then(() => {
      audio.pause()
      audio.currentTime = 0
    })
    .catch(() => {
      // Desktop does not need the prime. On restrictive mobile browsers the
      // later play() still reports failure through the normal finish handler.
    })
}

const stateListeners = new Set<(active: { token: number; status: SpeechStatus } | null) => void>()

function setActive(next: { token: number; status: SpeechStatus } | null) {
  active = next
  for (const listener of stateListeners) listener(active)
}

/**
 * Notifies listeners whenever playback starts, changes phase, or stops.
 *
 * A speak call replaces whatever was playing, and the superseded caller's
 * `onEnd` deliberately never fires — so a button that tracked only its own
 * callback would stay lit forever once something else spoke. Subscribing lets
 * each button notice it is no longer the active one.
 */
export function subscribeToSpeech(listener: (active: { token: number; status: SpeechStatus } | null) => void) {
  stateListeners.add(listener)
  listener(active)
  return () => { stateListeners.delete(listener) }
}

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

function defaultVoiceId() {
  return CONFIGURED_VOICE_ID || VOICE_IDS[savedVoiceGender()]
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

function speakWithBrowserVoice(text: string, rate: number, volume: number, generation: number, onEnd?: () => void) {
  if (!canUseBrowserSpeech() || generation !== speechGeneration) {
    onEnd?.()
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const japaneseVoice = findJapaneseBrowserVoice()
  utterance.lang = 'ja-JP'
  utterance.rate = rate
  utterance.volume = volume
  if (japaneseVoice) utterance.voice = japaneseVoice
  const finish = () => {
    if (generation !== speechGeneration) return
    setActive(null)
    onEnd?.()
  }
  utterance.onend = finish
  utterance.onerror = finish
  setActive({ token: generation, status: 'playing' })
  window.speechSynthesis.speak(utterance)
}

/**
 * Reports whether any speech route is available. Browser voices can arrive
 * asynchronously, so listen for both service and browser changes.
 */
export function watchSpeechSupport(listener: (supported: boolean) => void) {
  let cancelled = false
  const report = () => {
    if (!cancelled) listener(canSpeakJapanese())
  }

  report()

  if (TTS_SERVER_URL) {
    fetch(`${TTS_SERVER_URL}/health`, { method: 'GET' })
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
  }

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

function releaseObjectUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
}

export function stopSpeaking() {
  speechGeneration++
  if (canUseBrowserSpeech()) window.speechSynthesis.cancel()
  if (currentAudio) {
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  audioPrime = null
  releaseObjectUrl()
  setActive(null)
}

function playBlob(blob: Blob, volume: number, generation: number, playbackRate = 1, onEnd?: () => void) {
  const play = () => {
    if (generation !== speechGeneration) return

    const url = URL.createObjectURL(blob)
    const audio = getSharedAudio()
    audio.pause()
    audio.currentTime = 0
    audio.volume = volume
    audio.preservesPitch = true
    audio.playbackRate = playbackRate
    audio.src = url
    currentAudio = audio
    currentObjectUrl = url

    const finish = () => {
      if (generation !== speechGeneration) return
      audio.onended = null
      audio.onerror = null
      currentAudio = null
      releaseObjectUrl()
      setActive(null)
      onEnd?.()
    }
    audio.onended = finish
    audio.onerror = finish
    setActive({ token: generation, status: 'playing' })
    audio.play().catch(finish)
  }

  void (audioPrime ?? Promise.resolve()).then(play)
}

/**
 * Speaks one sentence, replacing anything already playing. Returns a token
 * identifying this utterance, for matching against `subscribeToSpeech`.
 *
 * `onEnd`, when given, fires exactly once — on natural completion, on
 * playback error, or immediately if no speech route is available at all — so
 * a caller waiting on it (Story mode's read-then-advance pacing) never hangs.
 * It does NOT fire when a newer speakJapanese call supersedes this one first;
 * whatever superseded it already has its own completion to wait on, and
 * firing both would double up on whatever action `onEnd` triggers.
 */
export function speakJapanese(text: string, options: SpeakOptions = {}): number {
  const {
    rate = 0.9,
    synthesisRate = rate,
    volume = 1,
    voiceId,
    onEnd,
  } = options
  // Ratio between what we render and what we play back.
  const playbackRate = synthesisRate === rate ? 1 : rate / synthesisRate

  if (!text.trim()) {
    onEnd?.()
    return speechGeneration
  }
  stopSpeaking()
  const generation = ++speechGeneration

  setActive({ token: generation, status: 'loading' })
  primeAudioPlayback()

  // Pre-rendered clip first: it needs no service, costs nothing to replay, and
  // is the only route that works on a static deployment. Only the fixed
  // vocabulary is pre-rendered, so hero sentences always miss this and fall
  // through to the live service below.
  findStaticAudio(text, synthesisRate)
    .then((staticUrl) => {
      if (generation !== speechGeneration) return
      if (staticUrl) {
        return fetch(staticUrl)
          .then((res) => {
            // A static host answers a missing file with the SPA shell and a
            // 200, so an ok status alone doesn't mean we got audio — playing
            // HTML would just fail silently instead of falling back.
            const isAudio = res.ok && (res.headers.get('content-type') ?? '').startsWith('audio/')
            if (!isAudio) throw new Error('no pre-rendered clip')
            return res.blob()
          })
          .then((blob) => { playBlob(blob, volume, generation, playbackRate, onEnd) })
      }
      return speakFromService(text, synthesisRate, volume, generation, voiceId, playbackRate, rate, onEnd)
    })
    .catch(() => {
      if (generation !== speechGeneration) return
      speakFromService(text, synthesisRate, volume, generation, voiceId, playbackRate, rate, onEnd)
    })

  return generation
}

function speakFromService(
  text: string,
  rate: number,
  volume: number,
  generation: number,
  voiceId?: string,
  playbackRate = 1,
  /** What the listener asked for — the browser voice can hit it directly. */
  heardRate = rate,
  onEnd?: () => void,
) {
  if (!serverAvailable || !TTS_SERVER_URL) {
    speakWithBrowserVoice(text, heardRate, volume, generation, onEnd)
    return
  }

  // The service clamps too, but a rejected request would cost a round trip
  // and drop us to the browser voice — the Dashboard's fastest and slowest
  // slider steps both land outside the accepted band.
  const serverRate = Math.min(MAX_SERVER_RATE, Math.max(MIN_SERVER_RATE, rate))
  const voice = voiceId ?? defaultVoiceId()
  const cacheKey = speechCacheKey(text, voice, serverRate)

  getCachedSpeech(cacheKey)
    .then((cached) => {
      if (generation !== speechGeneration) return
      if (cached) {
        playBlob(cached, volume, generation, playbackRate, onEnd)
        return
      }

      return fetch(`${TTS_SERVER_URL}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speed: serverRate, voice_id: voice }),
      })
        .then((res) => {
          if (!res.ok) {
            if (PER_REQUEST_REFUSALS.has(res.status)) throw new RefusedOnce(res.status)
            throw new Error(`TTS request failed: ${res.status}`)
          }
          serverAvailable = true
          return res.blob()
        })
        .then((blob) => {
          void putCachedSpeech(cacheKey, blob)
          playBlob(blob, volume, generation, playbackRate, onEnd)
        })
    })
    .catch((error: unknown) => {
      if (generation !== speechGeneration) return
      // Keep the service marked available when it merely declined this line.
      if (!(error instanceof RefusedOnce)) serverAvailable = false
      speakWithBrowserVoice(text, heardRate, volume, generation, onEnd)
    })
}
