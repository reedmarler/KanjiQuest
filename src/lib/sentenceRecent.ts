const RECENT_KEY = 'kanji-quest-recent-fill-gap'
const RECENT_LIMIT = 50

export function getRecentFillGapIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function recordFillGapSeen(id: string): void {
  const recent = getRecentFillGapIds().filter((entry) => entry !== id)
  recent.unshift(id)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, RECENT_LIMIT)))
}

export function sortExercisesByFreshness<T extends { id: string }>(
  exercises: T[],
  recentIds: string[],
): T[] {
  const recentSet = new Set(recentIds)
  const fresh = exercises.filter((e) => !recentSet.has(e.id))
  const seen = exercises.filter((e) => recentSet.has(e.id))
  return [...shuffleArray(fresh), ...shuffleArray(seen)]
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
