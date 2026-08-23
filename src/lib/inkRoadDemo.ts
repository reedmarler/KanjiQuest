import type { Waypoint } from './mapState'
import type { CardProgress } from './types'

/**
 * Stand-in study history for the map preview.
 *
 * Nothing in the app writes `CardProgress` yet — the practice screens only
 * record wrong answers, which cannot tell a mastered card from an unseen one —
 * so a map fed the real record would sit at 0% ink forever and prove nothing
 * about whether walking a road beats reading a list.
 *
 * This fakes exactly one thing: the scheduler's output. Everything downstream
 * is the real `deriveMapState`. When the write path lands, this file is deleted
 * and `loadProgress()` takes its place.
 */

const MS_PER_DAY = 86_400_000

function card(id: string, interval: number, dueInDays: number, now: number): CardProgress {
  return {
    id,
    easeFactor: 2.5,
    interval,
    repetitions: interval > 0 ? 3 : 1,
    nextReview: now + dueInDays * MS_PER_DAY,
    lastReviewed: now - MS_PER_DAY,
    correct: 3,
    incorrect: 0,
  }
}

/**
 * A believable history for a learner `walked` stops into the road: everything
 * behind them mature, a couple of threads at the first stop slipping so the map
 * has something thin to show, and the stop they are standing on half-met.
 */
export function demoProgress(waypoints: readonly Waypoint[], walked: number, now = Date.now()): Record<string, CardProgress> {
  const progress: Record<string, CardProgress> = {}

  waypoints.slice(0, walked).forEach((waypoint, index) => {
    waypoint.threads.forEach((id, position) => {
      const lapsed = index === 0 && position < 2
      progress[id] = card(id, lapsed ? 9 : 24, lapsed ? -1 : 12, now)
    })
  })

  const current = waypoints[walked]
  if (current) {
    current.threads.slice(0, Math.ceil(current.threads.length / 3)).forEach((id) => {
      progress[id] = card(id, 1, 0, now)
    })
  }

  return progress
}
