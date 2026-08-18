import { useEffect, useRef } from 'react'

interface StrokeFillAnimationProps {
  char: string
}

/** Fixed logical resolution the glyph is rendered and animated at. */
const SIZE = 200
/** Slow on purpose — fast enough to not be boring, slow enough to actually watch. */
const DURATION_MS = 2200
const FILL_COLOR = '#e0447a'
/** Groups inked pixels into thin horizontal bands before sorting left-to-right
 *  within each band, so the fill reads as a sweep rather than a strict scan. */
const BAND_HEIGHT = 6

/**
 * No real stroke-order database backs this — it renders the glyph offscreen,
 * then reveals its ink pixels top-to-bottom, left-to-right within thin bands.
 * That ordering happens to match how most kana strokes are actually drawn
 * closely enough to read as the character "writing itself in", which is all
 * a beginner needs before they trace it themselves.
 */
export function StrokeFillAnimation({ char }: StrokeFillAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const glyph = document.createElement('canvas')
    glyph.width = SIZE
    glyph.height = SIZE
    const gctx = glyph.getContext('2d', { willReadFrequently: true })
    if (!gctx) return
    gctx.fillStyle = '#000'
    gctx.textAlign = 'center'
    gctx.textBaseline = 'middle'
    gctx.font = `${Math.round(SIZE * 0.74)}px 'Noto Sans JP', sans-serif`
    gctx.fillText(char, SIZE / 2, SIZE / 2 + SIZE * 0.04)
    const { data } = gctx.getImageData(0, 0, SIZE, SIZE)

    const points: [number, number][] = []
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (data[(y * SIZE + x) * 4 + 3]! > 80) points.push([x, y])
      }
    }
    points.sort((a, b) => {
      const bandA = Math.floor(a[1] / BAND_HEIGHT)
      const bandB = Math.floor(b[1] / BAND_HEIGHT)
      return bandA - bandB || a[0] - b[0]
    })

    let rafId = 0
    let start = 0
    const total = points.length

    function draw(timestamp: number) {
      if (!start) start = timestamp
      const progress = Math.min(1, (timestamp - start) / DURATION_MS)
      const count = Math.floor(total * progress)

      ctx!.clearRect(0, 0, SIZE, SIZE)
      // A faint full-glyph guide so the destination is visible from frame one.
      ctx!.globalAlpha = 0.14
      ctx!.drawImage(glyph, 0, 0)
      ctx!.globalAlpha = 1
      ctx!.fillStyle = FILL_COLOR
      for (let i = 0; i < count; i += 1) {
        const [x, y] = points[i]!
        ctx!.fillRect(x, y, 1.5, 1.5)
      }

      if (progress < 1) rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [char])

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className="beginner-stroke-fill"
      aria-hidden="true"
    />
  )
}
