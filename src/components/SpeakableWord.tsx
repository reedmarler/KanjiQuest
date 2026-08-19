/**
 * Makes the word being studied the thing you press to hear it.
 *
 * The listen controls used to sit in a row under the card, which reads as a
 * page control rather than "this word, out loud" — and on narrow screens the
 * button labels are hidden, leaving bare emoji with nothing to say what they
 * do. Pressing the word itself needs no label at all.
 */
import { useEffect, useState } from 'react'
import {
  SPEECH_SPEEDS,
  canSpeakJapanese,
  speakJapanese,
  stopSpeaking,
  subscribeToSpeech,
  watchSpeechSupport,
  type SpeechStatus,
} from '../lib/speech'

interface SpeakableWordProps {
  /** Japanese to read aloud. Empty leaves the word as plain text — some cards
   *  have no pronounceable reading and must not offer a dead button. */
  text: string
  children: React.ReactNode
  /** Cards where the reading is the answer keep quiet until turned over. */
  disabled?: boolean
  className?: string
}

/**
 * The speaking behaviour without any markup of its own.
 *
 * The kanji deck's example cards cannot take a wrapper: their furigana is
 * positioned by direct-child selectors, their spans are targeted with
 * :first-child/:last-child, and the card is a three-row grid with no spare
 * row. Any element inserted anywhere in that subtree moves the readings. This
 * lets an existing element become the control instead, and hands back a cue
 * that is positioned out of flow.
 */
export function useSpeakable(text: string, disabled = false) {
  const [supported, setSupported] = useState(canSpeakJapanese)
  const [speaking, setSpeaking] = useState<{ token: number; status: SpeechStatus } | null>(null)

  useEffect(() => watchSpeechSupport(setSupported), [])

  useEffect(() => subscribeToSpeech((active) => {
    setSpeaking((current) => {
      if (!current) return null
      if (!active || active.token !== current.token) return null
      return current.status === active.status ? current : { ...current, status: active.status }
    })
  }), [])

  useEffect(() => () => stopSpeaking(), [text])

  const live = Boolean(text.trim()) && supported && !disabled
  const isSpeaking = Boolean(speaking)

  function toggle() {
    if (!live) return
    if (isSpeaking) {
      stopSpeaking()
      setSpeaking(null)
      return
    }
    const token = speakJapanese(text, {
      // Slower than the voice's own pace by default — easier to follow while
      // learning. Synthesizing at natural speed and slowing on playback
      // reuses the same pre-rendered clip instead of costing a second render.
      rate: SPEECH_SPEEDS.learning,
      synthesisRate: SPEECH_SPEEDS.natural,
      onEnd: () => setSpeaking(null),
    })
    setSpeaking({ token, status: 'loading' })
  }

  /** Spread onto an element that already exists in the markup. */
  const triggerProps = live
    ? {
      role: 'button' as const,
      tabIndex: 0,
      'aria-label': isSpeaking ? `Stop ${text}` : `Listen to ${text}`,
      title: 'Tap to listen',
      onClick: toggle,
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        toggle()
      },
    }
    : {}

  return { live, isSpeaking, loading: speaking?.status === 'loading', toggle, triggerProps }
}

/** The cue on its own, for callers using the hook. */
export function SpeakableCue({ className }: { className?: string }) {
  return (
    <svg className={`speakable-word-cue${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path className="speakable-word-cue-wave" d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path className="speakable-word-cue-wave speakable-word-cue-wave-far" d="M19 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  )
}

export function SpeakableWord({ text, children, disabled = false, className }: SpeakableWordProps) {
  const [supported, setSupported] = useState(canSpeakJapanese)
  const [speaking, setSpeaking] = useState<{ token: number; status: SpeechStatus } | null>(null)

  useEffect(() => watchSpeechSupport(setSupported), [])

  useEffect(() => subscribeToSpeech((active) => {
    setSpeaking((current) => {
      if (!current) return null
      // Someone else is speaking now, or nothing is — either way this word
      // no longer owns the channel.
      if (!active || active.token !== current.token) return null
      return current.status === active.status ? current : { ...current, status: active.status }
    })
  }), [])

  // A card can change while its audio is still playing; leaving the old clip
  // running would narrate the previous card.
  useEffect(() => () => stopSpeaking(), [text])

  const live = Boolean(text.trim()) && supported && !disabled
  if (!live) return <span className={className}>{children}</span>

  const isSpeaking = Boolean(speaking)

  return (
    <button
      type="button"
      className={`speakable-word${isSpeaking ? ' is-speaking' : ''}${speaking?.status === 'loading' ? ' is-loading' : ''}${className ? ` ${className}` : ''}`}
      aria-label={isSpeaking ? `Stop ${text}` : `Listen to ${text}`}
      title="Tap to listen"
      onClick={() => {
        if (isSpeaking) {
          stopSpeaking()
          setSpeaking(null)
          return
        }
        const token = speakJapanese(text, {
          rate: SPEECH_SPEEDS.learning,
          synthesisRate: SPEECH_SPEEDS.natural,
          onEnd: () => setSpeaking(null),
        })
        setSpeaking({ token, status: 'loading' })
      }}
    >
      {children}
      {/* An SVG rather than 🔊: an emoji renders at the word's own font size,
          so next to 7rem kanji it becomes a second piece of art competing
          with the character being studied. */}
      <svg className="speakable-word-cue" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        <path className="speakable-word-cue-wave" d="M16.5 8.5a5 5 0 0 1 0 7" />
        <path className="speakable-word-cue-wave speakable-word-cue-wave-far" d="M19 6a8.5 8.5 0 0 1 0 12" />
      </svg>
    </button>
  )
}
