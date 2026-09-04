import { type ReactNode, useEffect, useRef, useState } from 'react'

interface TraceCanvasProps {
  char: string
  /** false for dictation: a blank slate with no printed guide to trace over. */
  showGuide?: boolean
  overlay?: ReactNode
  /** Keeps a one-character vocabulary exercise from using the larger square
   *  intended for the main character-writing lesson. */
  compactSingleCharacter?: boolean
  /** How much of a cell's height the printed guide glyph fills. Defaults to
   *  GLYPH_FONT_RATIO below; a caller can raise it for a bigger guide, e.g.
   *  the あ preview card. */
  guideFontRatio?: number
  /** Nudges the printed guide glyph away from its cell's exact geometric
   *  center, as a fraction of SIZE. textAlign/textBaseline center the glyph's
   *  advance box, not its visible ink — most characters read fine there, but
   *  a caller showing one glyph large enough for the mismatch to be obvious
   *  (the あ preview card) can dial it in per character. Defaults to the
   *  small downward nudge every other caller already relies on. Ignored
   *  when guideFit is on, which centers from measured ink instead of a
   *  guessed constant. */
  guideOffset?: { x?: number; y?: number }
  /** Centers the guide glyph on its own measured ink (via
   *  CanvasRenderingContext2D.measureText's actualBoundingBox* fields)
   *  instead of guideOffset's fixed guess, and shrinks the font if that ink
   *  would otherwise overflow the cell. A hand-tuned guideOffset is only
   *  ever correct for the font metrics of whichever engine it was tuned
   *  against — this reads real metrics from whatever engine is actually
   *  rendering it, so it holds up across browsers instead of just the one
   *  it was eyeballed on. Off by default to leave every other caller's
   *  existing look untouched. */
  guideFit?: boolean
}

/** Logical resolution a single character's cell is computed in — a word of
 *  several characters gets that many cells laid out in a row, so each glyph
 *  keeps its natural proportions instead of being squeezed into one square. */
const SIZE = 300
const INK_WIDTH = 18
/** How much of a cell's height the printed guide glyph fills. */
const GLYPH_FONT_RATIO = 0.82

/** The app's phone breakpoint, the same one App.css drops the zoom at. */
const NARROW = '(max-width: 720px)'

/**
 * A word's cells run left to right on a wide screen and top to bottom on a
 * phone. Laid out in a row on a phone, a two-character word had to share the
 * screen's width between both glyphs and came out half the size of the single
 * characters the learner had just been practising; down the page each cell is
 * as wide as the panel. The canvas is one bitmap, so this cannot be a media
 * query — its dimensions change, not just its layout.
 */
function useNarrowViewport() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches)
  useEffect(() => {
    const list = window.matchMedia(NARROW)
    const update = () => setNarrow(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [])
  return narrow
}

function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  }
}

/**
 * A place to practice writing a character, deliberately unscored.
 *
 * An earlier version graded each attempt out of 100 by comparing ink coverage
 * against a rendered glyph mask. It was harsh on genuinely legible handwriting
 * — a correctly formed character drawn slightly off-centre scored badly — and
 * a discouraging number next to a beginner's first ever あ works against the
 * point. Writing it and seeing it beside the real thing is the exercise.
 */
export function TraceCanvas({ char, showGuide = true, overlay, compactSingleCharacter = false, guideFontRatio = GLYPH_FONT_RATIO, guideOffset, guideFit = false }: TraceCanvasProps) {
  const offsetX = guideOffset?.x ?? 0
  const offsetY = guideOffset?.y ?? 0.04
  const guideCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const inkCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const chars = [...char]
  const charCount = Math.max(1, chars.length)
  const vertical = useNarrowViewport() && charCount > 1
  const width = vertical ? SIZE : SIZE * charCount
  const height = vertical ? SIZE * charCount : SIZE
  // A single character keeps its original large square; a word gets one
  // square cell per character instead of squeezing every glyph into that
  // same square, which was illegible. Stacked, the width is one cell's worth
  // and CSS caps it against the viewport's height instead.
  const stackWidthRem = charCount <= 1
    ? (compactSingleCharacter ? 13 : 21)
    : vertical ? 21 : charCount * 15

  // A new character means a fresh guide and a blank page — stale ink from the
  // previous character must not linger under the next one.
  useEffect(() => {
    const guide = guideCanvasRef.current
    if (guide) {
      const ctx = guide.getContext('2d')!
      ctx.clearRect(0, 0, width, height)
      if (showGuide) {
        ctx.fillStyle = 'rgba(148, 148, 168, 0.38)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (!guideFit) ctx.font = `${Math.round(SIZE * guideFontRatio)}px 'Noto Sans JP', sans-serif`
        chars.forEach((ch, index) => {
          const cellX = vertical ? width / 2 : SIZE * (index + 0.5)
          const cellY = vertical ? SIZE * (index + 0.5) : height / 2
          if (!guideFit) {
            ctx.fillText(ch, cellX + SIZE * offsetX, cellY + SIZE * offsetY)
            return
          }
          // Real, engine-reported ink bounds — not the guessed offset above
          // — so this lands centered and unclipped on whatever browser
          // actually renders it, not just the one this was tuned against.
          let fontSize = Math.round(SIZE * guideFontRatio)
          ctx.font = `${fontSize}px 'Noto Sans JP', sans-serif`
          let metrics = ctx.measureText(ch)
          let inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
          let inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight
          // 8% margin on every side so the ink never touches the cell edge,
          // whichever dimension (height or width) is the tighter fit.
          const maxSpan = SIZE * 0.92
          const overflow = Math.max(inkHeight, inkWidth) / maxSpan
          if (overflow > 1) {
            fontSize = Math.round(fontSize / overflow)
            ctx.font = `${fontSize}px 'Noto Sans JP', sans-serif`
            metrics = ctx.measureText(ch)
          }
          const drawX = cellX + (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2
          const drawY = cellY + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2
          ctx.fillText(ch, drawX, drawY)
        })
      }
    }

    const ink = inkCanvasRef.current
    if (ink) ink.getContext('2d')!.clearRect(0, 0, width, height)
  }, [char, showGuide, vertical, guideFontRatio, offsetX, offsetY, guideFit])

  function clearInk() {
    const ink = inkCanvasRef.current
    if (!ink) return
    ink.getContext('2d')!.clearRect(0, 0, width, height)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = inkCanvasRef.current
    if (!canvas) return
    // Capture keeps the stroke going if a finger slides off the canvas edge.
    // It can fail for pointer types that never registered as "active" (some
    // stylus/touch edge cases) — that shouldn't block the stroke itself.
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // Drawing still works without capture; it just won't follow the
      // pointer past the canvas bounds.
    }
    drawingRef.current = true
    const point = pointFromEvent(event, canvas)
    lastPointRef.current = point
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#e0447a'
    ctx.beginPath()
    ctx.arc(point.x, point.y, INK_WIDTH / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const canvas = inkCanvasRef.current
    if (!canvas) return
    const point = pointFromEvent(event, canvas)
    const last = lastPointRef.current
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#e0447a'
    ctx.lineWidth = INK_WIDTH
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last?.x ?? point.x, last?.y ?? point.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPointRef.current = point
  }

  function handlePointerUp() {
    drawingRef.current = false
    lastPointRef.current = null
  }

  return (
    <div className="trace-canvas">
      <div
        className={`trace-canvas-stack${vertical ? ' is-vertical' : ''}`}
        style={{
          touchAction: 'none',
          aspectRatio: `${width} / ${height}`,
          // A custom property rather than a width, so a media query can cap a
          // stacked word against the viewport's height without !important.
          ['--trace-stack-max' as string]: `${stackWidthRem}rem`,
          ['--trace-cells' as string]: vertical ? charCount : 1,
        }}
      >
        <canvas ref={guideCanvasRef} width={width} height={height} className="trace-canvas-layer trace-canvas-guide" aria-hidden="true" />
        <canvas
          ref={inkCanvasRef}
          width={width}
          height={height}
          className="trace-canvas-layer trace-canvas-ink"
          role="img"
          aria-label={showGuide ? `Trace ${char} here` : 'Write the word you just heard here'}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        <button type="button" className="trace-canvas-clear" onClick={clearInk} aria-label="Clear">
          &#8635; Clear
        </button>
        {overlay && <div className="trace-canvas-overlay">{overlay}</div>}
      </div>
    </div>
  )
}
