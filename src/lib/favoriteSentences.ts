import type { SentenceExercise } from '../data/sentenceExercises'
import type { DrillExercise } from './drillExercises'

const FAVORITE_SENTENCES_STORAGE_KEY = 'kanji-quest-favorite-sentences-v1'

export interface FavoriteSentence {
  id: string
  japanese: string
  english: string
  segments: string[]
  readings?: string[]
  meanings?: string[]
  jlpt?: SentenceExercise['jlpt']
  savedAt: number
}

function isFavoriteSentence(value: unknown): value is FavoriteSentence {
  if (!value || typeof value !== 'object') return false

  const favorite = value as Partial<FavoriteSentence>
  return (
    typeof favorite.id === 'string' &&
    typeof favorite.japanese === 'string' &&
    typeof favorite.english === 'string' &&
    Array.isArray(favorite.segments) &&
    typeof favorite.savedAt === 'number'
  )
}

export function loadFavoriteSentences(): FavoriteSentence[] {
  if (typeof window === 'undefined') return []

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FAVORITE_SENTENCES_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isFavoriteSentence).sort((left, right) => right.savedAt - left.savedAt)
  } catch {
    return []
  }
}

export function saveFavoriteSentences(favorites: FavoriteSentence[]) {
  try {
    window.localStorage.setItem(FAVORITE_SENTENCES_STORAGE_KEY, JSON.stringify(favorites))
  } catch {
    // Favorites remain available until the next refresh if browser storage is unavailable.
  }
}

export function favoriteFromExercise(exercise: SentenceExercise): FavoriteSentence {
  const segments = exercise.segments ? [...exercise.segments] : []

  return {
    id: exercise.id,
    japanese: segments.join(''),
    english: exercise.english,
    segments,
    readings: exercise.segmentReadings ? [...exercise.segmentReadings] : undefined,
    meanings: exercise.segmentMeanings ? [...exercise.segmentMeanings] : undefined,
    jlpt: exercise.jlpt,
    savedAt: Date.now(),
  }
}

export function favoriteFromDrillExercise(exercise: DrillExercise): FavoriteSentence {
  const [before = '', after = ''] = exercise.prompt.split('___')
  const [beforeReading = '', afterReading = ''] = (exercise.promptReading ?? '').split('___')
  const beforeParts = exercise.promptFurigana?.before ?? [{ text: before, reading: beforeReading }]
  const afterParts = exercise.promptFurigana?.after ?? [{ text: after, reading: afterReading }]
  const segments = [
    ...beforeParts.map((part) => part.text),
    exercise.answer,
    ...afterParts.map((part) => part.text),
  ]
  const readings = [
    ...beforeParts.map((part) => part.reading),
    exercise.answerReading,
    ...afterParts.map((part) => part.reading),
  ]

  return {
    id: exercise.id,
    japanese: segments.join(''),
    english: exercise.english,
    segments,
    readings: readings.some(Boolean) ? readings.map((reading) => reading ?? '') : undefined,
    jlpt: exercise.jlpt,
    savedAt: Date.now(),
  }
}

export function isExerciseFavorite(favorites: FavoriteSentence[], exercise: SentenceExercise): boolean {
  const japanese = favoriteFromExercise(exercise).japanese
  return favorites.some((favorite) => favorite.japanese === japanese)
}

export function isDrillExerciseFavorite(favorites: FavoriteSentence[], exercise: DrillExercise): boolean {
  const japanese = favoriteFromDrillExercise(exercise).japanese
  return favorites.some((favorite) => favorite.japanese === japanese)
}
