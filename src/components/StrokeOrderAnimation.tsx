import { useEffect, useMemo, useRef, useState } from 'react'
import { HIRAGANA_STROKE_VIEWBOX, hiraganaStrokes } from '../data/hiraganaStrokes'

/** Forces every path's stroke-dasharray/offset math onto the same scale
 *  (via the SVG `pathLength` attribute) regardless of the stroke's actual
 *  geometric length, so the draw animation below needs no DOM measurement. */
const NORMALIZED_PATH_LENGTH = 1000

interface StrokeOrderAnimationProps {
  /** One or more hiragana characters. Unknown characters (no stroke data) are skipped. */
  word: string
  /** 'hero' takes over the spot the plain character used to sit in, so
   *  showing the word once (drawn) replaces showing it twice (drawn + as
   *  plain speakable text). Defaults to the small inline preview size. */
  size?: 'default' | 'hero'
  /** Scales stroke and gap timing without changing the teaching-speed default. */
  durationScale?: number
  /** Additional delay before this character begins, useful for staggered rows. */
  startDelayMs?: number
  /** Allows a parent control to own clicks and keyboard behavior. */
  interactive?: boolean
}

/** Beat before the first stroke starts, so the learner has a moment to look
 *  at the blank box before anything moves. */
const START_DELAY_MS = 50
/** How long each stroke takes to draw. Slow on purpose — the point is to watch it.
 *  Beginner zone runs at half speed (2x duration) to make strokes easier to follow. */
const STROKE_DURATION_MS = 4100
/** How much earlier the next stroke starts, before the current one finishes
 *  drawing — real handwriting doesn't stop dead between strokes, so the next
 *  one begins its own draw while the previous is still finishing. */
const STROKE_OVERLAP_MS = 700
/** Pause between characters, so each one in a word still reads as distinct. */
const CHAR_GAP_MS = 1000

/** Total visible playback time, used when several standalone animations must
 *  run one after another instead of beginning together. */
export function getStrokeOrderAnimationDuration(word: string, durationScale = 1) {
  const chars = [...word].filter((ch) => hiraganaStrokes[ch])
  const strokeDuration = STROKE_DURATION_MS * durationScale
  const strokeInterval = (STROKE_DURATION_MS - STROKE_OVERLAP_MS) * durationScale

  return chars.reduce((total, ch, index) => {
    const strokeCount = hiraganaStrokes[ch]?.length ?? 0
    const charDuration = strokeCount === 0 ? 0 : (strokeCount - 1) * strokeInterval + strokeDuration
    const gap = index < chars.length - 1 ? CHAR_GAP_MS * durationScale : 0
    return total + charDuration + gap
  }, START_DELAY_MS)
}

/**
 * Draws each character stroke-by-stroke, in the real stroke order and
 * direction, using KanjiVG path data (see `../data/hiraganaStrokes.ts`) — an
 * SVG line-draw animation via `stroke-dashoffset`.
 *
 * Every path is driven directly through refs rather than a CSS class tied to
 * React state. Toggling a class on and off lets the *same* transition run
 * backwards whenever state resets (e.g. a fully-drawn character snapping back
 * to hidden animates in reverse, right before the real forward draw starts —
 * which read as the animation "starting backwards"). Driving it imperatively
 * lets every replay force strokes to their hidden state with transitions
 * switched off first, guaranteeing the only motion anyone sees is forward.
 */
export function StrokeOrderAnimation({
  word,
  size = 'default',
  durationScale = 1,
  startDelayMs = 0,
  interactive = true,
}: StrokeOrderAnimationProps) {
  const chars = useMemo(() => [...word].filter((ch) => hiraganaStrokes[ch]), [word])
  const pathRefs = useRef(new Map<string, SVGPathElement>())
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [replayToken, setReplayToken] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const paths = [...pathRefs.current.values()]

    // Snap every stroke to hidden with no transition, then force a reflow so
    // the browser commits that state before the transition is switched back
    // on — otherwise the browser coalesces the "hide" and "reveal" into one
    // animated jump, which is the reverse-draw bug described above.
    paths.forEach((path) => {
      path.style.transition = 'none'
      // Mid-gap (see .stroke-order-path in App.css) rather than right at the
      // dash length, so there's room on both sides before the pattern wraps
      // back into the dash zone and exposes a stray dot.
      path.style.strokeDashoffset = String(NORMALIZED_PATH_LENGTH * 3)
    })
    void containerRef.current?.offsetHeight
    const strokeDuration = STROKE_DURATION_MS * durationScale
    const strokeInterval = (STROKE_DURATION_MS - STROKE_OVERLAP_MS) * durationScale

    paths.forEach((path) => {
      path.style.transition = `stroke-dashoffset ${strokeDuration}ms ease-in-out`
    })

    let cursor = START_DELAY_MS + startDelayMs
    chars.forEach((ch, charIndex) => {
      const strokes = hiraganaStrokes[ch] ?? []
      strokes.forEach((_, strokeIndex) => {
        const delay = cursor + strokeIndex * strokeInterval
        timers.push(setTimeout(() => {
          const path = pathRefs.current.get(`${charIndex}-${strokeIndex}`)
          if (path) path.style.strokeDashoffset = '0'
        }, delay))
      })
      const charDuration = strokes.length === 0 ? 0 : (strokes.length - 1) * strokeInterval + strokeDuration
      cursor += charDuration + CHAR_GAP_MS * durationScale
    })

    return () => timers.forEach(clearTimeout)
  }, [chars, durationScale, replayToken, startDelayMs])

  if (chars.length === 0) return null

  return (
    <div
      ref={containerRef}
      className={`stroke-order-animation${size === 'hero' ? ' is-hero' : ''}`}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? 'Replay how to write this' : undefined}
      title={interactive ? 'Tap to replay' : undefined}
      onClick={interactive ? () => setReplayToken((current) => current + 1) : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        setReplayToken((current) => current + 1)
      } : undefined}
    >
      {/* Sits above the characters and inside the box (positioned by CSS), so
          the hint reads as a caption on the example rather than a separate
          line of UI pushing the writing area down. */}
      {size === 'hero' && (
        <span className="stroke-order-replay-hint" aria-hidden="true">
          &#8635; Tap to replay
        </span>
      )}
      <div className="stroke-order-chars">
        {chars.map((ch, charIndex) => {
          const strokes = hiraganaStrokes[ch] ?? []
          return (
            <svg
              key={`${ch}-${charIndex}`}
              viewBox={`0 0 ${HIRAGANA_STROKE_VIEWBOX} ${HIRAGANA_STROKE_VIEWBOX}`}
              className="stroke-order-char"
              aria-hidden="true"
            >
              {strokes.map((d, strokeIndex) => (
                <path
                  key={strokeIndex}
                  ref={(el) => {
                    const refKey = `${charIndex}-${strokeIndex}`
                    if (el) pathRefs.current.set(refKey, el)
                    else pathRefs.current.delete(refKey)
                  }}
                  d={d}
                  pathLength={NORMALIZED_PATH_LENGTH}
                  className="stroke-order-path"
                />
              ))}
            </svg>
          )
        })}
      </div>
    </div>
  )
}
