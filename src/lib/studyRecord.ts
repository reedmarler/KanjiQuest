import { createProgress, reviewCard } from './srs'
import { loadProgress, saveProgress } from './storage'
import type { CardProgress } from './types'

/**
 * The one place study results become scheduler state.
 *
 * `srs.ts` and `storage.ts` have always been here, and nothing has ever called
 * them: the app records only wrong answers, in a pool that deletes an entry
 * once you get it right. So a mastered card and a card you have never seen are
 * both simply absent, which is why the world map cannot read real progress and
 * why "cards resurface based on how well you know them" was not true of the
 * app.
 *
 * Screens call `recordAnswer` when they know whether the learner had the card,
 * and nothing else has to think about localStorage, the SM-2 maths, or keeping
 * a React tree in step with either.
 */

export type Grade = 'again' | 'hard' | 'good' | 'easy'

/** srs.reviewCard takes 0–3; this is the only place that mapping lives. */
const QUALITY: Record<Grade, number> = { again: 0, hard: 1, good: 2, easy: 3 }

/**
 * Read once, then kept in step by hand. Every screen that records shares this
 * object, so two screens open on the same card cannot write over each other
 * with a stale copy.
 */
let cache: Record<string, CardProgress> | null = null

const listeners = new Set<() => void>()

function store(): Record<string, CardProgress> {
  if (!cache) cache = loadProgress()
  return cache
}

function commit(next: Record<string, CardProgress>) {
  cache = next
  saveProgress(next)
  for (const listener of listeners) listener()
}

/** Current scheduler state for every card the learner has met. */
export function studyProgress(): Record<string, CardProgress> {
  return store()
}

/** Fires after any write, so a view showing progress can re-read it. */
export function subscribeToProgress(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Grade one card. `again` shortens its interval and brings it back today;
 * `good` and `easy` push it out. The card is created on first sight.
 */
export function recordAnswer(cardId: string, grade: Grade): void {
  if (!cardId) return
  const current = store()
  const existing = current[cardId] ?? createProgress(cardId)
  commit({ ...current, [cardId]: reviewCard(existing, QUALITY[grade]) })
}

/** Convenience for screens whose only signal is right or wrong. */
export function recordResult(cardId: string, correct: boolean): void {
  recordAnswer(cardId, correct ? 'good' : 'again')
}

/**
 * Marks a card as met without claiming the learner knew it.
 *
 * A screen that shows a card and moves on has evidence of exposure and nothing
 * more. Recording that as a correct answer would inflate the map; recording
 * nothing would leave the card indistinguishable from one never opened. This
 * writes a first sighting and then stays out of the way — a card already in the
 * scheduler is left exactly as it is.
 */
export function recordSeen(cardId: string): void {
  if (!cardId) return
  const current = store()
  if (current[cardId]) return
  commit({ ...current, [cardId]: { ...createProgress(cardId), lastReviewed: Date.now() } })
}

/** Test seam: drops the in-memory copy so the next read comes off storage. */
export function resetProgressCache(): void {
  cache = null
}
