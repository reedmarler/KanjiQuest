/**
 * The shape of the Ink Road.
 *
 * The road is generated from a formula rather than hand-drawn path data, which
 * buys two things: scenery can ask where the road runs at any height and stay
 * out of its way, and the whole geometry is computable without measuring a live
 * SVG element — so the map renders right on the first paint instead of after a
 * layout pass.
 */

export interface RoadPoint {
  x: number
  y: number
  /** Distance along the road from the southern end. */
  length: number
}

export interface Road {
  /** SVG path data, south to north. */
  d: string
  points: readonly RoadPoint[]
  total: number
  width: number
  height: number
}

const WIDTH = 360
const STEP = 5
const MARGIN = 70

/** A slow wander with a smaller wobble over it, so it reads as a footpath. */
export function roadX(y: number): number {
  return WIDTH / 2 + 58 * Math.sin(y / 235) + 16 * Math.sin(y / 88)
}

/**
 * `skyMargin` reserves room at the top of the scroll for the destination, which
 * has to sit above the road rather than on it — you should be able to see where
 * you are going from the first stop.
 */
export function buildRoad(height: number, skyMargin: number = MARGIN): Road {
  const points: RoadPoint[] = []
  let d = ''
  let total = 0

  for (let y = height - MARGIN; y >= skyMargin; y -= STEP) {
    const x = roadX(y)
    const previous = points[points.length - 1]
    if (previous) total += Math.hypot(x - previous.x, y - previous.y)
    points.push({ x, y, length: total })
    d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y} `
  }

  return { d: d.trim(), points, total, width: WIDTH, height }
}

/** Walks the sampled polyline; the step is small enough that lerping is exact enough. */
export function pointAtLength(road: Road, length: number): RoadPoint {
  const clamped = Math.max(0, Math.min(road.total, length))
  const index = road.points.findIndex((point) => point.length >= clamped)
  if (index <= 0) return road.points[0]!

  const before = road.points[index - 1]!
  const after = road.points[index]!
  const span = after.length - before.length
  const t = span > 0 ? (clamped - before.length) / span : 0

  return {
    x: before.x + (after.x - before.x) * t,
    y: before.y + (after.y - before.y) * t,
    length: clamped,
  }
}

/**
 * Where each stop sits. Spread across the middle of the road so the first and
 * last stops keep a little road behind and ahead of them.
 */
export function stopLengths(road: Road, count: number): number[] {
  if (count === 1) return [road.total * 0.5]
  return Array.from({ length: count }, (_, index) => road.total * (0.04 + (index / (count - 1)) * 0.92))
}

/** Seeded, so the world is identical on every load — a map you can learn. */
export function seededRandom(seed: number): () => number {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return value / 2147483647
  }
}
