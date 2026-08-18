import { useEffect, useMemo, useState } from 'react'
import { HIRAGANA_STROKE_VIEWBOX, hiraganaStrokes } from '../data/hiraganaStrokes'

/** Forces every path's stroke-dasharray/offset math onto the same scale
 *  (via the SVG `pathLength` attribute) regardless of the stroke's actual
 *  geometric length, so the CSS transition below needs no DOM measurement. */
const NORMALIZED_PATH_LENGTH = 1000

interface StrokeOrderAnimationProps {
  /** One or more hiragana characters. Unknown characters (no stroke data) are skipped. */
  word: string
}

/** How long each stroke takes to draw. Slow on purpose — the point is to watch it. */
const STROKE_DURATION_MS = 550
/** How much earlier the next stroke starts, before the current one finishes
 *  drawing — real handwriting doesn't stop dead between strokes, so the next
 *  one begins its own draw while the previous is still finishing. */
const STROKE_OVERLAP_MS = 260
/** Pause between characters, so each one in a word still reads as distinct. */
const CHAR_GAP_MS = 400

/**
 * Draws each character stroke-by-stroke, in the real stroke order and
 * direction, using KanjiVG path data (see `../data/hiraganaStrokes.ts`) — an
 * SVG line-draw animation via `stroke-dashoffset`, not a simulation.
 */
export function StrokeOrderAnimation({ word }: StrokeOrderAnimationProps) {
  const chars = useMemo(() => [...word].filter((ch) => hiraganaStrokes[ch]), [word])
  const [activeChar, setActiveChar] = useState(0)
  const [activeStroke, setActiveStroke] = useState(-1)

  useEffect(() => {
    setActiveChar(0)
    setActiveStroke(-1)
  }, [word])

  useEffect(() => {
    if (activeChar >= chars.length) return
    const strokes = hiraganaStrokes[chars[activeChar]!] ?? []
    const timers: ReturnType<typeof setTimeout>[] = []

    const strokeInterval = STROKE_DURATION_MS - STROKE_OVERLAP_MS
    strokes.forEach((_, strokeIndex) => {
      const delay = strokeIndex * strokeInterval
      timers.push(setTimeout(() => setActiveStroke(strokeIndex), delay))
    })

    const totalDuration = (strokes.length - 1) * strokeInterval + STROKE_DURATION_MS + CHAR_GAP_MS
    timers.push(setTimeout(() => {
      setActiveStroke(-1)
      setActiveChar((current) => current + 1)
    }, totalDuration))

    return () => timers.forEach(clearTimeout)
  }, [activeChar, chars])

  if (chars.length === 0) return null

  return (
    <div className="stroke-order-animation">
      {chars.map((ch, charIndex) => {
        const strokes = hiraganaStrokes[ch] ?? []
        const isDone = charIndex < activeChar
        const isActive = charIndex === activeChar
        return (
          <svg
            key={`${ch}-${charIndex}`}
            viewBox={`0 0 ${HIRAGANA_STROKE_VIEWBOX} ${HIRAGANA_STROKE_VIEWBOX}`}
            className="stroke-order-char"
            aria-hidden="true"
          >
            {strokes.map((d, strokeIndex) => {
              const drawn = isDone || (isActive && strokeIndex <= activeStroke)
              return (
                <path
                  key={strokeIndex}
                  d={d}
                  pathLength={NORMALIZED_PATH_LENGTH}
                  className={`stroke-order-path${drawn ? ' is-drawn' : ''}`}
                  style={{ transitionDuration: `${STROKE_DURATION_MS}ms` }}
                />
              )
            })}
          </svg>
        )
      })}
    </div>
  )
}
