import { useEffect, useRef, useState } from 'react'

interface TraceCanvasProps {
  char: string
  /** Reported after every "Check" tap so the parent can persist a best score. */
  onScored?: (score: number) => void
  /** false for dictation: a blank slate with no printed guide to trace over. */
  showGuide?: boolean
}

/** Logical resolution a single character's cell is computed in — a word of
 *  several characters gets that many cells laid out in a row, so each glyph
 *  keeps its natural proportions instead of being squeezed into one square. */
const SIZE = 300
const INK_WIDTH = 18
/** How far (in px) a stroke may wander from the printed glyph and still count as "on the line". */
const TOLERANCE_RADIUS = 8
/** How far ink is allowed to spread when checking glyph coverage, forgiving normal stroke width. */
const COVERAGE_RADIUS = 6
/** How much of a cell's height the printed/mask glyph fills. */
const GLYPH_FONT_RATIO = 0.82

const SCORE_RANKS = [
  { min: 92, label: 'Excellent', tier: 'is-great' },
  { min: 84, label: 'Great', tier: 'is-great' },
  { min: 70, label: 'Good', tier: 'is-good' },
  { min: 50, label: 'Okay', tier: 'is-good' },
  { min: 0, label: 'Keep practicing', tier: 'is-retry' },
] as const

function rankForScore(score: number) {
  return SCORE_RANKS.find((rank) => score >= rank.min)!
}

interface GlyphMasks {
  /** True where the printed character itself has ink — used to score coverage. */
  raw: Uint8Array
  /** `raw` dilated outward — used to score whether the learner's strokes stayed on target. */
  tolerance: Uint8Array
  rawCount: number
}

function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  let current = mask
  for (let pass = 0; pass < radius; pass += 1) {
    const next = new Uint8Array(current.length)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x
        if (current[i]) {
          next[i] = 1
          continue
        }
        const up = y > 0 && current[i - width]
        const down = y < height - 1 && current[i + width]
        const left = x > 0 && current[i - 1]
        const right = x < width - 1 && current[i + 1]
        next[i] = up || down || left || right ? 1 : 0
      }
    }
    current = next
  }
  return current
}

function buildGlyphMasks(chars: string[], width: number, height: number): GlyphMasks {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#000'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.round(SIZE * GLYPH_FONT_RATIO)}px 'Noto Sans JP', sans-serif`
  chars.forEach((ch, index) => {
    const cellCenterX = SIZE * (index + 0.5)
    ctx.fillText(ch, cellCenterX, height / 2 + SIZE * 0.04)
  })
  const { data } = ctx.getImageData(0, 0, width, height)
  const raw = new Uint8Array(width * height)
  let rawCount = 0
  for (let i = 0; i < raw.length; i += 1) {
    if (data[i * 4 + 3] > 40) {
      raw[i] = 1
      rawCount += 1
    }
  }
  return { raw, tolerance: dilate(raw, width, height, TOLERANCE_RADIUS), rawCount }
}

function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  }
}

export function TraceCanvas({ char, onScored, showGuide = true }: TraceCanvasProps) {
  const guideCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const inkCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const masksRef = useRef<GlyphMasks | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const hasInkRef = useRef(false)
  const [result, setResult] = useState<{ score: number } | null>(null)

  const chars = [...char]
  const charCount = Math.max(1, chars.length)
  const width = SIZE * charCount
  const height = SIZE
  // A single character keeps its original large square; a word gets one
  // square cell per character instead of squeezing every glyph into that
  // same square, which was both illegible and threw off trace scoring.
  const stackWidthRem = charCount <= 1 ? 21 : charCount * 11

  // A new character means a fresh guide, a fresh mask, and a blank page —
  // stale ink from the previous character must not leak into this score.
  useEffect(() => {
    masksRef.current = buildGlyphMasks(chars, width, height)
    hasInkRef.current = false
    setResult(null)

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
    hasInkRef.current = false
    setResult(null)
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
    hasInkRef.current = true
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

  function checkTracing() {
    const ink = inkCanvasRef.current
    const masks = masksRef.current
    if (!ink || !masks || !hasInkRef.current) {
      setResult({ score: 0 })
      return
    }

    const ctx = ink.getContext('2d', { willReadFrequently: true })!
    const { data } = ctx.getImageData(0, 0, width, height)
    const inkMask = new Uint8Array(width * height)
    let inkTotal = 0
    let inkOnTarget = 0
    for (let i = 0; i < inkMask.length; i += 1) {
      if (data[i * 4 + 3] > 40) {
        inkMask[i] = 1
        inkTotal += 1
        if (masks.tolerance[i]) inkOnTarget += 1
      }
    }

    if (inkTotal === 0) {
      setResult({ score: 0 })
      return
    }

    const precision = inkOnTarget / inkTotal
    const inkSpread = dilate(inkMask, width, height, COVERAGE_RADIUS)
    let covered = 0
    for (let i = 0; i < masks.raw.length; i += 1) {
      if (masks.raw[i] && inkSpread[i]) covered += 1
    }
    const coverage = masks.rawCount > 0 ? covered / masks.rawCount : 0
    const score = Math.round(Math.min(1, precision) * 55 + Math.min(1, coverage) * 45)

    setResult({ score })
    onScored?.(score)
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
        {result && (
          <span className={`trace-canvas-score ${rankForScore(result.score).tier}`}>
            <b>{result.score}</b>
            <em>{rankForScore(result.score).label}</em>
          </span>
        )}
      </div>

      <div className="trace-canvas-actions">
        <button type="button" className="btn btn-ghost" onClick={clearInk}>Clear</button>
        <button type="button" className="btn btn-primary" onClick={checkTracing}>Check</button>
      </div>
    </div>
  )
}
