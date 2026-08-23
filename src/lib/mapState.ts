import type { CardProgress } from './types'

/**
 * The world map's entire state, derived from the scheduler.
 *
 * The quest panel stores five booleans per quest and calls a quest "complete"
 * when they are all set. Nothing ever unsets them, so the panel keeps claiming
 * mastery of material the player has since forgotten — the map and the player's
 * head drift apart, and the map is the one that lies.
 *
 * Nothing here is stored. Ink is a reading of `Record<string, CardProgress>`
 * taken fresh on every render, so a lapsed card thins its waypoint the moment
 * it falls due, without a migration, a write path, or a second source of truth.
 */

/** A thread counts as ink once the scheduler trusts it for a few days. */
export const INKED_INTERVAL_DAYS = 3

/** Mature: shown as `set`, but weighted the same as `inked` toward clearing. */
export const SET_INTERVAL_DAYS = 21

/**
 * Share of a waypoint's threads that must be inked before the road continues.
 *
 * Deliberately not 1: the last two stubborn threads in any set are exactly the
 * ones the scheduler should keep re-surfacing, and holding the road hostage to
 * them turns a journey into a wall.
 */
export const CLEAR_THRESHOLD = 0.8

export type ThreadState = 'unwritten' | 'faint' | 'inked' | 'set'

export type NodeState = 'sealed' | 'fogged' | 'open' | 'inked' | 'thin'

export interface Waypoint {
  id: string
  regionId: string
  kind: 'stop' | 'shrine'
  /** Card ids, matching the keys of the stored progress record. */
  threads: readonly string[]
}

export interface Region {
  id: string
  /** Order on the road comes from the array, not from a field to keep in sync. */
  title: string
}

export type ThreadCounts = Record<ThreadState, number>

export interface WaypointState {
  id: string
  regionId: string
  kind: 'stop' | 'shrine'
  node: NodeState
  /** 0–1. Share of threads at `inked` or better. */
  ink: number
  cleared: boolean
  /** Whether the player may open it now — see the one-step-ahead rule below. */
  available: boolean
  counts: ThreadCounts
  /** Threads whose next review has come due. Drives the `thin` state. */
  due: number
  total: number
}

export interface RegionState {
  id: string
  title: string
  /** Mean ink across the region's waypoints. */
  ink: number
  open: boolean
  cleared: boolean
  waypointsCleared: number
  waypointCount: number
  /** Cleared waypoints carrying due threads. */
  thinning: number
}

export interface MapState {
  regions: readonly RegionState[]
  waypoints: readonly WaypointState[]
  /** Where the traveller stands: the first uncleared waypoint that is reachable. */
  frontierId: string | null
  /** Distinct cards due across the whole map, counted once each. */
  due: number
}

/**
 * `lastReviewed` rather than `interval` decides whether a thread has been seen:
 * a card the player has failed sits at interval 0, which is not the same thing
 * as a card they have never met.
 */
export function threadState(progress: CardProgress | undefined): ThreadState {
  if (!progress || progress.lastReviewed === 0) return 'unwritten'
  if (progress.interval >= SET_INTERVAL_DAYS) return 'set'
  if (progress.interval >= INKED_INTERVAL_DAYS) return 'inked'
  return 'faint'
}

function emptyCounts(): ThreadCounts {
  return { unwritten: 0, faint: 0, inked: 0, set: 0 }
}

function isDueAt(progress: CardProgress | undefined, now: number): boolean {
  return Boolean(progress && progress.lastReviewed > 0 && progress.nextReview <= now)
}

/**
 * A waypoint with no threads can never be cleared, so an unmapped stop stalls
 * the road loudly instead of quietly counting as done at 0/0.
 */
function isCleared(ink: number, counts: ThreadCounts, total: number): boolean {
  return total > 0 && ink >= CLEAR_THRESHOLD && counts.unwritten === 0
}

export function deriveMapState(
  cards: Record<string, CardProgress>,
  waypoints: readonly Waypoint[],
  regions: readonly Region[],
  now: number = Date.now(),
): MapState {
  const dueCards = new Set<string>()

  const measured = waypoints.map((waypoint) => {
    const counts = emptyCounts()
    let due = 0

    for (const threadId of waypoint.threads) {
      const progress = cards[threadId]
      counts[threadState(progress)] += 1
      if (isDueAt(progress, now)) {
        due += 1
        dueCards.add(threadId)
      }
    }

    const total = waypoint.threads.length
    const ink = total > 0 ? (counts.inked + counts.set) / total : 0

    return { waypoint, counts, due, total, ink, cleared: isCleared(ink, counts, total) }
  })

  // A region opens when the one before it is finished — its shrine included.
  const clearedByRegion = new Map<string, { cleared: number; count: number; thinning: number; ink: number }>()
  for (const region of regions) clearedByRegion.set(region.id, { cleared: 0, count: 0, thinning: 0, ink: 0 })

  for (const entry of measured) {
    const tally = clearedByRegion.get(entry.waypoint.regionId)
    if (!tally) continue
    tally.count += 1
    tally.ink += entry.ink
    if (entry.cleared) tally.cleared += 1
    if (entry.cleared && entry.due > 0) tally.thinning += 1
  }

  const regionOpen = new Map<string, boolean>()
  let previousCleared = true
  for (const region of regions) {
    const tally = clearedByRegion.get(region.id)!
    regionOpen.set(region.id, previousCleared)
    previousCleared = tally.count > 0 && tally.cleared === tally.count
  }

  // The frontier is the first uncleared waypoint the player can actually reach.
  const frontier = measured.find((entry) => regionOpen.get(entry.waypoint.regionId) && !entry.cleared)
  const frontierId = frontier?.waypoint.id ?? measured[measured.length - 1]?.waypoint.id ?? null

  const waypointStates: WaypointState[] = measured.map((entry) => {
    const open = regionOpen.get(entry.waypoint.regionId) ?? false
    const started = entry.counts.unwritten < entry.total

    let node: NodeState
    if (!open) node = 'sealed'
    else if (entry.cleared) node = entry.due > 0 ? 'thin' : 'inked'
    else if (started) node = 'open'
    else node = 'fogged'

    /*
     * One step ahead only. Everything already walked stays open forever — going
     * back to re-study should never be taxed — but exactly one untouched stop is
     * reachable at a time, which is what keeps the road a road instead of the
     * flat to-do list the quest panel became.
     */
    const available = open && (entry.cleared || started || entry.waypoint.id === frontierId)

    return {
      id: entry.waypoint.id,
      regionId: entry.waypoint.regionId,
      kind: entry.waypoint.kind,
      node,
      ink: entry.ink,
      cleared: entry.cleared,
      available,
      counts: entry.counts,
      due: entry.due,
      total: entry.total,
    }
  })

  const regionStates: RegionState[] = regions.map((region) => {
    const tally = clearedByRegion.get(region.id)!
    return {
      id: region.id,
      title: region.title,
      ink: tally.count > 0 ? tally.ink / tally.count : 0,
      open: regionOpen.get(region.id) ?? false,
      cleared: tally.count > 0 && tally.cleared === tally.count,
      waypointsCleared: tally.cleared,
      waypointCount: tally.count,
      thinning: tally.thinning,
    }
  })

  return { regions: regionStates, waypoints: waypointStates, frontierId, due: dueCards.size }
}

/** Convenience for the map chrome: the region the traveller is standing in. */
export function frontierRegion(state: MapState): RegionState | undefined {
  const frontier = state.waypoints.find((waypoint) => waypoint.id === state.frontierId)
  return state.regions.find((region) => region.id === frontier?.regionId)
}

/**
 * Splits a topic's card ids into waypoint-sized thread-sets.
 *
 * Regions are authored as one themed pool of cards; the road needs it served in
 * stops of a walkable size. A short tail is folded back into the stop before it
 * rather than standing as its own: 40 at 15 gives 15/15/10, but 31 gives 15/16
 * instead of leaving a one-card stop on the map.
 */
export function chunkThreads<T>(threads: readonly T[], perWaypoint: number): T[][] {
  if (perWaypoint < 1) throw new Error('perWaypoint must be at least 1')

  const chunks: T[][] = []
  for (let index = 0; index < threads.length; index += perWaypoint) {
    chunks.push(threads.slice(index, index + perWaypoint))
  }

  const last = chunks[chunks.length - 1]
  if (chunks.length > 1 && last && last.length < perWaypoint / 2) {
    chunks[chunks.length - 2] = chunks[chunks.length - 2]!.concat(chunks.pop()!)
  }

  return chunks
}
