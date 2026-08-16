import { useEffect, useState } from 'react'
import {
  SPEECH_SPEEDS,
  canSpeakJapanese,
  speakJapanese,
  stopSpeaking,
  subscribeToSpeech,
  watchSpeechSupport,
  type SpeechSpeed,
  type SpeechStatus,
} from '../lib/speech'

interface SpeakButtonsProps {
  /** Japanese text to read aloud. Nothing renders when this is empty. */
  text: string
  className?: string
  /** Hides the slower button where only a quick check is wanted. */
  showLearning?: boolean
}

const LABELS: Record<SpeechSpeed, { icon: string; label: string; title: string }> = {
  natural: { icon: '🔊', label: 'Natural', title: 'Play at natural speed' },
  learning: { icon: '🐢', label: 'Learning', title: 'Play slowly for listening practice' },
}

/**
 * Plays one piece of Japanese at either of two speeds.
 *
 * Tapping the lit button stops playback; tapping the other switches to it.
 * Playback state comes from the speech module rather than local state alone,
 * so a button unlights when something elsewhere in the app takes over the
 * single audio channel.
 */
export function SpeakButtons({ text, className, showLearning = true }: SpeakButtonsProps) {
  const [supported, setSupported] = useState(canSpeakJapanese)
  const [speaking, setSpeaking] = useState<{ speed: SpeechSpeed; token: number; status: SpeechStatus } | null>(null)

  useEffect(() => watchSpeechSupport(setSupported), [])

  useEffect(() => subscribeToSpeech((active) => {
    setSpeaking((current) => {
      if (!current) return null
      // Someone else is speaking now, or nothing is — either way this
      // component no longer owns the channel.
      if (!active || active.token !== current.token) return null
      return current.status === active.status ? current : { ...current, status: active.status }
    })
  }), [])

  // A card can change while its audio is still playing; leaving the old clip
  // running would narrate the previous card.
  useEffect(() => () => stopSpeaking(), [text])

  if (!text.trim() || !supported) return null

  const speeds: SpeechSpeed[] = showLearning ? ['natural', 'learning'] : ['natural']

  return (
    <div className={`speak-buttons${className ? ` ${className}` : ''}`} role="group" aria-label="Listen">
      {speeds.map((speed) => {
        const { icon, label, title } = LABELS[speed]
        const isActive = speaking?.speed === speed
        const isLoading = isActive && speaking?.status === 'loading'

        return (
          <button
            key={speed}
            type="button"
            className={`btn speak-button speak-button-${speed}${isActive ? ' is-active' : ''}${isLoading ? ' is-loading' : ''}`}
            aria-pressed={isActive}
            title={title}
            onClick={() => {
              if (isActive) {
                stopSpeaking()
                setSpeaking(null)
                return
              }
              const token = speakJapanese(text, {
                rate: SPEECH_SPEEDS[speed],
                // Both buttons render at natural speed; 🐢 slows the same
                // clip on playback, so one render serves both.
                synthesisRate: SPEECH_SPEEDS.natural,
                onEnd: () => setSpeaking(null),
              })
              setSpeaking({ speed, token, status: 'loading' })
            }}
          >
            <span className="speak-button-icon" aria-hidden="true">{icon}</span>
            <span className="speak-button-label">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
