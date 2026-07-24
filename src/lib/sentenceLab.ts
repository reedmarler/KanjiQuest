import {
  sentenceExercises,
  type SentenceExercise,
  type SentenceExerciseType,
} from '../data/sentenceExercises'
import { getWrongPoolIds, type WrongPool } from './wrongPool'
import { filterFillGapExercises, type FillGapLevelFilter } from './fillGapLevels'
import { getRecentFillGapIds, sortExercisesByFreshness } from './sentenceRecent'
import { shuffle } from './quiz'
import {
  buildGeneratedBuilderExercises,
} from './generatedSentenceExercises'
import type { GenerationComplexity } from './generationComplexity'

const SESSION_SIZE = 15

export type SentenceSessionItem =
  | { kind: 'fill-gap'; exercise: SentenceExercise }
  | { kind: 'sentence-builder'; exercise: SentenceExercise }

function pickSessionExercises<T extends { id: string }>(
  pool: T[],
  wrongIds: Set<string>,
  recentIds: string[],
): T[] {
  const wrongFirst = shuffle(pool.filter((e) => wrongIds.has(e.id)))
  const rest = sortExercisesByFreshness(
    pool.filter((e) => !wrongIds.has(e.id)),
    recentIds,
  )
  const size = Math.min(SESSION_SIZE, pool.length)
  return [...wrongFirst, ...rest].slice(0, size)
}

export function buildSentenceSession(
  type: SentenceExerciseType,
  wrongPool: WrongPool,
  fillGapFilter?: FillGapLevelFilter,
  builderLevels: readonly GenerationComplexity[] = [1],
): SentenceSessionItem[] {
  const pool =
    type === 'fill-gap' && fillGapFilter
      ? filterFillGapExercises(fillGapFilter)
      : type === 'sentence-builder'
        ? buildGeneratedBuilderExercises(builderLevels)
        : sentenceExercises.filter((e) => e.type === type)
  const wrongIds = new Set(getWrongPoolIds(wrongPool).filter((id) => id.startsWith('sent-')))
  const recentIds = type === 'fill-gap' ? getRecentFillGapIds() : []

  const picked = pickSessionExercises(pool, wrongIds, recentIds)

  return picked.map((exercise) => ({
    kind: type,
    exercise,
  }))
}

