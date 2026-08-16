/**
 * Makes the word being studied the thing you press to hear it.
 *
 * The listen controls used to sit in a row under the card, which reads as a
 * page control rather than "this word, out loud" — and on narrow screens the
 * button labels are hidden, leaving two bare emoji with nothing to say what
 * they do. Pressing the word itself needs no label at all.
 *
 * The turtle stays as a visible second control rather than a hidden
 * long-press: slow playback is the feature a learner most needs and least
 * expects to find, so it has to be seen.
 */
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

interface SpeakableWordProps {
  /** Japanese to read aloud. Empty leaves the word as plain text — some cards
   *  have no pronounceable reading and must not offer a dead button. */
  text: string
  children: React.ReactNode
  /** Cards where the reading is the answer keep quiet until turned over. */
  disabled?: boolean
  className?: string
}

export function SpeakableWord({ text, children, disabled = false, className }: SpeakableWordProps) {
  const [supported, setSupported] = useState(canSpeakJapanese)
  const [speaking, setSpeaking] = useState<{ speed: SpeechSpeed; token: number; status: SpeechStatus } | null>(null)

  useEffect(() => watchSpeechSupport(setSupported), [])

  useEffect(() => subscribeToSpeech((active) => {
    setSpeaking((current) => {
      if (!current) return null
      if (!active || active.token !== current.token) return null
      return current.status === active.status ? current : { ...current, status: active.status }
    })
  }), [])

  // A card can change while its audio is still playing; leaving the old clip
  // running would narrate the previous card.
  useEffect(() => () => stopSpeaking(), [text])

  const live = Boolean(text.trim()) && supported && !disabled

  function play(speed: SpeechSpeed) {
    if (!live) return
    if (speaking?.speed === speed) {
      stopSpeaking()
      setSpeaking(null)
      return
    }
    const token = speakJapanese(text, {
      rate: SPEECH_SPEEDS[speed],
      // Both controls play the natural render; the turtle slows it on
      // playback, so one clip serves both.
      synthesisRate: SPEECH_SPEEDS.natural,
      onEnd: () => setSpeaking(null),
    })
    setSpeaking({ speed, token, status: 'loading' })
  }

  if (!live) return <span className={className}>{children}</span>

  const naturalActive = speaking?.speed === 'natural'
  const slowActive = speaking?.speed === 'learning'

  return (
    <span className={`speakable-word-wrap${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`speakable-word${naturalActive ? ' is-speaking' : ''}${naturalActive && speaking?.status === 'loading' ? ' is-loading' : ''}`}
        aria-label={naturalActive ? `Stop ${text}` : `Listen to ${text}`}
        title="Tap to listen"
        onClick={() => play('natural')}
      >
        {children}
        {/* An SVG rather than 🔊: an emoji renders at the word's own font
            size, so next to 7rem kanji it becomes a second piece of art
            competing with the character being studied. */}
        <svg className="speakable-word-cue" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 9v6h4l5 4V5L8 9H4z" />
          <path className="speakable-word-cue-wave" d="M16.5 8.5a5 5 0 0 1 0 7" />
          <path className="speakable-word-cue-wave speakable-word-cue-wave-far" d="M19 6a8.5 8.5 0 0 1 0 12" />
        </svg>
      </button>
      <button
        type="button"
        className={`speakable-word-slow${slowActive ? ' is-speaking' : ''}`}
        aria-label={slowActive ? 'Stop slow playback' : `Listen to ${text} slowly`}
        title="Play slowly"
        onClick={() => play('learning')}
      >
        <span aria-hidden="true">🐢</span>
        <span className="speakable-word-slow-label">Slow</span>
      </button>
    </span>
  )
}
