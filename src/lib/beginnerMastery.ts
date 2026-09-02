import type { BeginnerScript } from '../data/beginnerMnemonics'

/**
 * Mastery is per character and survives reloads, because a beginner working
 * through 46 characters will not do it in one sitting. Keyed by script so the
 * three decks never overwrite each other. Shared between the learner (which
 * writes it) and the kana charts (which only read it, to show row progress).
 */
export const MASTERY_STORAGE_PREFIX = 'kq-beginner-mastery-'

/** How many correct recalls in a row retire a character from the row. */
export const MASTERY_TARGET = 2

export function storageKey(prefix: string, script: BeginnerScript) {
  return `${prefix}${script}`
}

export function loadNumberMap(key: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    // Written by us, but a hand-edited or half-written value should degrade to
    // "not learned yet" rather than crashing the deck on open.
    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}
