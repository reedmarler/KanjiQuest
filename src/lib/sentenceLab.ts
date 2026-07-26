import type { SentenceExercise } from '../data/sentenceExercises'
import { getWrongPoolIds, type WrongPool } from './wrongPool'
import { shuffle } from './quiz'
import { buildGeneratedBuilderExercises } from './generatedSentenceExercises'
import type { GenerationComplexity } from './generationComplexity'

const SESSION_SIZE = 15

export type SentenceSessionItem = { kind: 'sentence-builder'; exercise: SentenceExercise }

function pickSessionExercises<T extends { id: string }>(pool: T[], wrongIds: Set<string>): T[] {
  const wrongFirst = shuffle(pool.filter((e) => wrongIds.has(e.id)))
  const rest = pool.filter((e) => !wrongIds.has(e.id))
  const size = Math.min(SESSION_SIZE, pool.length)
  return [...wrongFirst, ...rest].slice(0, size)
}

export function buildSentenceSession(
  wrongPool: WrongPool,
  builderLevels: readonly GenerationComplexity[] = [1],
): SentenceSessionItem[] {
  const pool = buildGeneratedBuilderExercises(builderLevels)
  const wrongIds = new Set(getWrongPoolIds(wrongPool).filter((id) => id.startsWith('sent-')))

  const picked = pickSessionExercises(pool, wrongIds)

  return picked.map((exercise) => ({
    kind: 'sentence-builder' as const,
    exercise,
  }))
}
