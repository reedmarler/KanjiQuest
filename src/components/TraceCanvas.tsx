import { type ReactNode, useEffect, useRef } from 'react'

interface TraceCanvasProps {
  char: string
  /** false for dictation: a blank slate with no printed guide to trace over. */
  showGuide?: boolean
  overlay?: ReactNode
  /** Keeps a one-character vocabulary exercise from using the larger square
   *  intended for the main character-writing lesson. */
  compactSingleCharacter?: boolean
}

/** Logical resolution a single character's cell is computed in — a word of
 *  several characters gets that many cells laid out in a row, so each glyph
 *  keeps its natural proportions instead of being squeezed into one square. */
const SIZE = 300
const INK_WIDTH = 18
/** How much of a cell's height the printed guide glyph fills. */
const GLYPH_FONT_RATIO = 0.82

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
export function TraceCanvas({ char, showGuide = true, overlay, compactSingleCharacter = false }: TraceCanvasProps) {
  const guideCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const inkCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const chars = [...char]
  const charCount = Math.max(1, chars.length)
  const width = SIZE * charCount
  const height = SIZE
  // A single character keeps its original large square; a word gets one
  // square cell per character instead of squeezing every glyph into that
  // same square, which was illegible.
  const stackWidthRem = charCount <= 1
    ? (compactSingleCharacter ? 13 : 21)
    : charCount * 15

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
        ctx.font = `${Math.round(SIZE * GLYPH_FONT_RATIO)}px 'Noto Sans JP', sans-serif`
        chars.forEach((ch, index) => {
          ctx.fillText(ch, SIZE * (index + 0.5), height / 2 + SIZE * 0.04)
        })
      }
    }

    const ink = inkCanvasRef.current
    if (ink) ink.getContext('2d')!.clearRect(0, 0, width, height)
  }, [char, showGuide])

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
        className="trace-canvas-stack"
        style={{ touchAction: 'none', aspectRatio: `${width} / ${height}`, width: `min(100%, ${stackWidthRem}rem)` }}
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
