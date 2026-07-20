import { allCards } from '../data'
import {
  getSentenceExerciseById,
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
  getGeneratedBuilderExerciseById,
} from './generatedSentenceExercises'
import type { CardProgress, JlptLevel, StudyCard } from './types'
import { isDue } from './srs'

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
  builderLevels: readonly JlptLevel[] = ['N5'],
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

export function buildMistakeSession(
  wrongPool: WrongPool,
): Array<{ kind: 'card'; card: StudyCard } | SentenceSessionItem> {
  const ids = getWrongPoolIds(wrongPool, 15)
  const items: Array<{ kind: 'card'; card: StudyCard } | SentenceSessionItem> = []

  for (const id of ids) {
    if (id.startsWith('sent-')) {
      const exercise = getSentenceExerciseById(id) ?? getGeneratedBuilderExerciseById(id)
      if (exercise) {
        items.push({ kind: exercise.type, exercise })
      }
    } else {
      const card = allCards.find((c) => c.id === id)
      if (card) items.push({ kind: 'card', card })
    }
  }

  return shuffle(items)
}

export function prioritizeStrugglingCards(
  pool: StudyCard[],
  progress: Record<string, CardProgress>,
  wrongPool: WrongPool,
  limit: number,
): StudyCard[] {
  const wrongIds = new Set(getWrongPoolIds(wrongPool))

  const scored = pool.map((card) => {
    const p = progress[card.id]
    let score = 0
    if (wrongIds.has(card.id)) score += 100
    if (p && p.incorrect > p.correct) score += 50
    if (!p || isDue(p)) score += 20
    if (p && p.interval >= 7) score -= 30
    if (p && p.easeFactor >= 2.8) score -= 20
    return { card, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.card)
    .slice(0, limit)
}
