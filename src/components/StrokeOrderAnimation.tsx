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
}

/** Beat before the first stroke starts, so the learner has a moment to look
 *  at the blank box before anything moves. */
const START_DELAY_MS = 1000
/** How long each stroke takes to draw. Slow on purpose — the point is to watch it. */
const STROKE_DURATION_MS = 1100
/** How much earlier the next stroke starts, before the current one finishes
 *  drawing — real handwriting doesn't stop dead between strokes, so the next
 *  one begins its own draw while the previous is still finishing. */
const STROKE_OVERLAP_MS = 350
const STROKE_INTERVAL_MS = STROKE_DURATION_MS - STROKE_OVERLAP_MS
/** Pause between characters, so each one in a word still reads as distinct. */
const CHAR_GAP_MS = 500

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
export function StrokeOrderAnimation({ word, size = 'default' }: StrokeOrderAnimationProps) {
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
      path.style.strokeDashoffset = String(NORMALIZED_PATH_LENGTH)
    })
    void containerRef.current?.offsetHeight
    paths.forEach((path) => {
      path.style.transition = `stroke-dashoffset ${STROKE_DURATION_MS}ms ease-in-out`
    })

    let cursor = START_DELAY_MS
    chars.forEach((ch, charIndex) => {
      const strokes = hiraganaStrokes[ch] ?? []
      strokes.forEach((_, strokeIndex) => {
        const delay = cursor + strokeIndex * STROKE_INTERVAL_MS
        timers.push(setTimeout(() => {
          const path = pathRefs.current.get(`${charIndex}-${strokeIndex}`)
          if (path) path.style.strokeDashoffset = '0'
        }, delay))
      })
      const charDuration = strokes.length === 0 ? 0 : (strokes.length - 1) * STROKE_INTERVAL_MS + STROKE_DURATION_MS
      cursor += charDuration + CHAR_GAP_MS
    })

    return () => timers.forEach(clearTimeout)
  }, [chars, replayToken])

  if (chars.length === 0) return null

  return (
    <div
      ref={containerRef}
      className={`stroke-order-animation${size === 'hero' ? ' is-hero' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Replay how to write this"
      title="Tap to replay"
      onClick={() => setReplayToken((current) => current + 1)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        setReplayToken((current) => current + 1)
      }}
    >
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
  )
}
