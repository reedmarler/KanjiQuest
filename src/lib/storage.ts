import type { AppStats, CardProgress } from './types'
import { createProgress, isLearned } from './srs'

const PROGRESS_KEY = 'kanji-quest-progress'
const STATS_KEY = 'kanji-quest-stats'

const defaultStats: AppStats = {
  streak: 0,
  lastStudyDate: null,
  totalReviews: 0,
  cardsLearned: 0,
}

export function loadProgress(): Record<string, CardProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveProgress(progress: Record<string, CardProgress>): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

export function getOrCreateProgress(
  id: string,
  all: Record<string, CardProgress>,
): CardProgress {
  return all[id] ?? createProgress(id)
}

export function loadStats(): AppStats {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    return raw ? { ...defaultStats, ...JSON.parse(raw) } : { ...defaultStats }
  } catch {
    return { ...defaultStats }
  }
}

export function saveStats(stats: AppStats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats))
}

export function updateStreak(stats: AppStats): AppStats {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  let streak = stats.streak
  if (stats.lastStudyDate === today) {
    return stats
  } else if (stats.lastStudyDate === yesterday) {
    streak += 1
  } else {
    streak = 1
  }

  return { ...stats, streak, lastStudyDate: today }
}

/**
 * The write side of AppStats. Nothing updated these for a long time, so the
 * streak and review count the profile and daily-quests pages show were stuck
 * at zero. Study screens call one of these whenever the learner does something.
 */

/** One graded review: advance the day streak (once per day) and count it. */
export function recordReview(): void {
  const stats = updateStreak(loadStats())
  const cardsLearned = Object.values(loadProgress()).filter(isLearned).length
  saveStats({ ...stats, totalReviews: stats.totalReviews + 1, cardsLearned })
}

/** The learner did something today (met a card, ticked a quest) — streak only. */
export function markStudiedToday(): void {
  const stats = loadStats()
  const next = updateStreak(stats)
  if (next !== stats) saveStats(next)
}
