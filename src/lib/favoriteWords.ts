import { useCallback, useEffect, useState } from 'react'

/**
 * Words the learner has starred. Separate from favoriteSentences: that store
 * keeps whole sentences to re-read, while this one is a vocabulary watch list
 * the dashboard's sentence rotator can bias toward, so starred words show up in
 * practice far more often than the full deck would allow.
 */
const FAVORITE_WORDS_STORAGE_KEY = 'kanji-quest-favorite-words-v1'
const PRIORITIZE_STORAGE_KEY = 'kanji-quest-favorite-words-prioritize-v1'
/** Lets every mounted view react to a change made in any other one. */
const FAVORITE_WORDS_EVENT = 'kanji-quest-favorite-words-change'

export interface FavoriteWord {
  /** The written form, and the key the generator matches sentences against. */
  japanese: string
  reading?: string
  english?: string
  savedAt: number
}

function isFavoriteWord(value: unknown): value is FavoriteWord {
  if (!value || typeof value !== 'object') return false
  const word = value as Partial<FavoriteWord>
  return typeof word.japanese === 'string' && word.japanese.length > 0 && typeof word.savedAt === 'number'
}

export function loadFavoriteWords(): FavoriteWord[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FAVORITE_WORDS_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isFavoriteWord).sort((left, right) => right.savedAt - left.savedAt)
  } catch {
    return []
  }
}

function saveFavoriteWords(words: FavoriteWord[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FAVORITE_WORDS_STORAGE_KEY, JSON.stringify(words))
  } catch {
    // A full or unavailable store should not break starring; the in-memory
    // list still updates for this session.
  }
  window.dispatchEvent(new CustomEvent(FAVORITE_WORDS_EVENT))
}

export function toggleFavoriteWord(word: Omit<FavoriteWord, 'savedAt'>): FavoriteWord[] {
  const current = loadFavoriteWords()
  const without = current.filter((item) => item.japanese !== word.japanese)
  const next = without.length === current.length
    ? [{ ...word, savedAt: Date.now() }, ...current]
    : without
  saveFavoriteWords(next)
  return next
}

export function removeFavoriteWord(japanese: string): FavoriteWord[] {
  const next = loadFavoriteWords().filter((item) => item.japanese !== japanese)
  saveFavoriteWords(next)
  return next
}

export function loadPrioritizeFavorites(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(PRIORITIZE_STORAGE_KEY) === 'true'
}

export function savePrioritizeFavorites(enabled: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PRIORITIZE_STORAGE_KEY, String(enabled))
  window.dispatchEvent(new CustomEvent(FAVORITE_WORDS_EVENT))
}

/**
 * Subscribes to favourite changes from anywhere in the app — starring a word in
 * the vocab list updates the dashboard panel without a reload. `storage` covers
 * the same app open in a second tab, which does not receive the custom event.
 */
export function onFavoriteWordsChange(listener: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(FAVORITE_WORDS_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(FAVORITE_WORDS_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

/** React binding for the store, kept here so every screen stays in sync. */
export function useFavoriteWords() {
  const [words, setWords] = useState<FavoriteWord[]>(loadFavoriteWords)
  const [prioritize, setPrioritizeState] = useState(loadPrioritizeFavorites)

  useEffect(() => onFavoriteWordsChange(() => {
    setWords(loadFavoriteWords())
    setPrioritizeState(loadPrioritizeFavorites())
  }), [])

  const toggle = useCallback((word: Omit<FavoriteWord, 'savedAt'>) => {
    setWords(toggleFavoriteWord(word))
  }, [])

  const remove = useCallback((japanese: string) => {
    setWords(removeFavoriteWord(japanese))
  }, [])

  const setPrioritize = useCallback((enabled: boolean) => {
    savePrioritizeFavorites(enabled)
    setPrioritizeState(enabled)
  }, [])

  const isFavorite = useCallback((japanese: string) => words.some((item) => item.japanese === japanese), [words])

  return { words, isFavorite, toggle, remove, prioritize, setPrioritize }
}
