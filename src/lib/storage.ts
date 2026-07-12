import type { AppStats, CardProgress } from './types'
import { createProgress } from './srs'

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
