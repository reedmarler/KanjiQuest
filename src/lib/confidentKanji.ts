const CONFIDENT_KEY = 'kanji-quest-confident-kanji'

export function loadConfidentKanji(): Set<string> {
  try {
    const raw = localStorage.getItem(CONFIDENT_KEY)
    if (!raw) return new Set()
    const ids: string[] = JSON.parse(raw)
    return new Set(ids)
  } catch {
    return new Set()
  }
}

export function saveConfidentKanji(ids: Set<string>): void {
  localStorage.setItem(CONFIDENT_KEY, JSON.stringify([...ids]))
}

export function isKanjiConfident(id: string, confident: Set<string>): boolean {
  return confident.has(id)
}

export function addConfidentKanji(id: string, confident: Set<string>): Set<string> {
  const next = new Set(confident)
  next.add(id)
  saveConfidentKanji(next)
  return next
}

export function removeConfidentKanji(id: string, confident: Set<string>): Set<string> {
  const next = new Set(confident)
  next.delete(id)
  saveConfidentKanji(next)
  return next
}

export function countConfidentKanji(confident: Set<string>, cardIds: string[]): number {
  return cardIds.filter((id) => confident.has(id)).length
}
