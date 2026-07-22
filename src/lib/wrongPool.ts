const WRONG_POOL_KEY = 'kanji-quest-wrong-pool'

export interface WrongPoolEntry {
  count: number
  lastWrong: number
}

export type WrongPool = Record<string, WrongPoolEntry>

export function loadWrongPool(): WrongPool {
  try {
    const raw = localStorage.getItem(WRONG_POOL_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveWrongPool(pool: WrongPool): void {
  localStorage.setItem(WRONG_POOL_KEY, JSON.stringify(pool))
}

export function recordWrong(id: string, pool: WrongPool): WrongPool {
  const entry = pool[id] ?? { count: 0, lastWrong: 0 }
  return {
    ...pool,
    [id]: { count: entry.count + 1, lastWrong: Date.now() },
  }
}

export function recordCorrect(id: string, pool: WrongPool): WrongPool {
  const entry = pool[id]
  if (!entry) return pool
  const count = entry.count - 1
  if (count <= 0) {
    const next = { ...pool }
    delete next[id]
    return next
  }
  return { ...pool, [id]: { ...entry, count } }
}

export function getWrongPoolIds(pool: WrongPool, limit = 20): string[] {
  return Object.entries(pool)
    .sort((a, b) => b[1].count - a[1].count || b[1].lastWrong - a[1].lastWrong)
    .slice(0, limit)
    .map(([id]) => id)
}
