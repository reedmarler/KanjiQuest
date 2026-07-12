import type { CardProgress } from './types'

const MS_PER_DAY = 86_400_000
const MS_PER_MIN = 60_000
const KANJI_DRILL_COOLDOWN_MS = 10 * MS_PER_MIN

export function createProgress(id: string): CardProgress {
  return {
    id,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: Date.now(),
    lastReviewed: 0,
    correct: 0,
    incorrect: 0,
  }
}

/** quality: 0 = again, 1 = hard, 2 = good, 3 = easy */
export function reviewCard(progress: CardProgress, quality: number): CardProgress {
  const now = Date.now()
  const updated = { ...progress, lastReviewed: now }

  if (quality < 2) {
    updated.repetitions = 0
    updated.interval = quality === 1 ? 1 : 0
    updated.nextReview = now + (quality === 1 ? MS_PER_DAY : 10 * MS_PER_MIN)
    updated.incorrect += 1
    if (quality === 0) updated.easeFactor = Math.max(1.3, updated.easeFactor - 0.2)
  } else {
    updated.correct += 1
    updated.repetitions += 1

    if (updated.repetitions === 1) {
      updated.interval = 1
    } else if (updated.repetitions === 2) {
      updated.interval = 3
    } else {
      updated.interval = Math.round(updated.interval * updated.easeFactor)
    }

    if (quality === 3) {
      updated.easeFactor = Math.min(3.0, updated.easeFactor + 0.3)
      if (updated.repetitions <= 2) {
        updated.interval = Math.max(7, updated.interval * 3)
      } else {
        updated.interval = Math.round(updated.interval * updated.easeFactor * 1.8)
      }
      updated.interval = Math.max(updated.interval, 7)
    }

    updated.nextReview = now + updated.interval * MS_PER_DAY
  }

  return updated
}

export function isDue(progress: CardProgress): boolean {
  return progress.nextReview <= Date.now()
}

export function isLearned(progress: CardProgress): boolean {
  return progress.repetitions >= 2 && progress.interval >= 1
}

/** Correct in Kanji Lab but not marked confident — keep recycling soon. */
export function reviewKanjiDrill(progress: CardProgress, correct: boolean): CardProgress {
  if (!correct) return reviewCard(progress, 0)

  const now = Date.now()
  return {
    ...progress,
    lastReviewed: now,
    correct: progress.correct + 1,
    nextReview: now + KANJI_DRILL_COOLDOWN_MS,
  }
}

/** Marked confident — ease out of the active drill pool. */
export function reviewKanjiConfident(progress: CardProgress, correct: boolean): CardProgress {
  return reviewCard(progress, correct ? 3 : 0)
}
