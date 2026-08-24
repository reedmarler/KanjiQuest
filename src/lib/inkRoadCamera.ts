/**
 * A camera on the Ink Road.
 *
 * The flat scroll could not express distance: the destination sat one screen
 * above the first stop, so "far away" looked exactly like "just up there".
 * This puts the view on the ground behind the traveller and lets perspective
 * do the work — the road narrows toward a horizon, stops shrink as they recede,
 * and the lantern hangs small and far off until you have actually walked to it.
 *
 * World space is two numbers: `u`, distance along the road from its southern
 * end, and `v`, lateral offset from the centre line. Screen space comes from a
 * single projection below. Nothing else in the map needs to know the maths.
 */

export const VIEW_WIDTH = 360
export const VIEW_HEIGHT = 620

/** Where infinitely distant ground lands. Everything converges here. */
export const HORIZON = 172

/** Bigger focal length = a longer lens = less violent foreshortening. */
const FOCAL = 260

/** How far the camera floats above the road surface, in world units. */
const CAMERA_HEIGHT = 88

/** Keeps the point directly under the camera from projecting to infinity. */
const NEAR = 40

export const ROAD_HALF_WIDTH = 7

export interface Projected {
  x: number
  y: number
  /** Screen units per world unit at this depth — size everything by it. */
  scale: number
}

/**
 * `depth` is how far ahead of the camera the point sits; `lift` is its height
 * above the ground. Depth at or behind the camera has no projection, so callers
 * cull those rather than drawing garbage.
 */
export function project(depth: number, lateral: number, lift = 0): Projected {
  const scale = FOCAL / (depth + NEAR)
  return {
    x: VIEW_WIDTH / 2 + lateral * scale,
    y: HORIZON + CAMERA_HEIGHT * scale - lift * scale,
    scale,
  }
}

/** The road wanders, so it reads as a footpath rather than a runway. */
export function laneOffset(u: number): number {
  return 30 * Math.sin(u / 170) + 11 * Math.sin(u / 64)
}

/** Distance between one stop and the next, in world units. */
const STOP_SPACING = 150

/** Extra road at a region boundary, so crossing one is a walk and not a step. */
const REGION_GAP = 130

const ROAD_START = 80

/**
 * Where every stop sits on one continuous road.
 *
 * The regions are not separate maps: they are stretches of the same road, so a
 * boundary is simply a longer gap between two stops. That keeps the camera, the
 * fog and the destination working across the whole journey without any of them
 * knowing regions exist.
 */
export function stopPositions(regionIds: readonly string[]): number[] {
  let u = ROAD_START
  return regionIds.map((regionId, index) => {
    if (index > 0) u += STOP_SPACING + (regionId === regionIds[index - 1] ? 0 : REGION_GAP)
    return u
  })
}

/** How far the drawn world extends past the last stop. */
export function roadLength(stops: readonly number[]): number {
  return (stops[stops.length - 1] ?? 0) + 260
}

/**
 * The destination sits far beyond the end of this region's road, which is the
 * whole point: it stays small and distant while you walk, and only grows as the
 * regions behind it are finished.
 */
export const LANTERN_DISTANCE = 2600
export const LANTERN_LIFT = 520
export const LANTERN_SIZE = 540

/** The camera trails the traveller so they sit in frame rather than under it. */
export const CAMERA_TRAIL = 130

/**
 * The nearest ground the view draws, chosen so the road runs off the bottom of
 * the frame rather than stopping in mid-air. Capping the scale instead would
 * flatten the near field and leave bare ground under the road.
 */
export const NEAR_CULL = 12

/** Seeded, so the world is identical on every load — a place you can learn. */
export function seededRandom(seed: number): () => number {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return value / 2147483647
  }
}
