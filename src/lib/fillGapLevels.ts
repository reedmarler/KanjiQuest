import type { JlptLevel } from './types'
import { sentenceExercises, type SentenceExercise } from '../data/sentenceExercises'

export type FillGapLevelFilter =
  | 'N5'
  | 'N4'
  | 'N3'
  | 'N2'
  | 'N1'
  | 'N1+N2'
  | 'N2+N3'
  | 'N2+N3+N4'
  | 'N3+N4+N5'
  | 'N1+N3+N5'
  | 'All'

export interface FillGapLevelOption {
  id: FillGapLevelFilter
  label: string
  description: string
  levels: JlptLevel[]
  group: 'single' | 'mixed' | 'all'
}

export const FILL_GAP_LEVEL_OPTIONS: FillGapLevelOption[] = [
  { id: 'N5', label: 'N5', description: 'Foundations & casual basics', levels: ['N5'], group: 'single' },
  { id: 'N4', label: 'N4', description: 'Everyday conversation', levels: ['N4'], group: 'single' },
  { id: 'N3', label: 'N3', description: 'Intermediate patterns', levels: ['N3'], group: 'single' },
  { id: 'N2', label: 'N2', description: 'Upper-intermediate', levels: ['N2'], group: 'single' },
  { id: 'N1', label: 'N1', description: 'Advanced & formal', levels: ['N1'], group: 'single' },
  { id: 'N3+N4+N5', label: 'N3 · N4 · N5', description: 'Your main study zone + foundations', levels: ['N3', 'N4', 'N5'], group: 'mixed' },
  { id: 'N2+N3+N4', label: 'N2 · N3 · N4', description: 'Bridge toward advanced Japanese', levels: ['N2', 'N3', 'N4'], group: 'mixed' },
  { id: 'N2+N3', label: 'N2 · N3', description: 'Mid to upper-intermediate mix', levels: ['N2', 'N3'], group: 'mixed' },
  { id: 'N1+N2', label: 'N1 · N2', description: 'Advanced challenge mix', levels: ['N1', 'N2'], group: 'mixed' },
  { id: 'N1+N3+N5', label: 'N1 · N3 · N5', description: 'Wide spread — hard + mid + easy', levels: ['N1', 'N3', 'N5'], group: 'mixed' },
  { id: 'All', label: 'All levels', description: 'Everything from N5 to N1', levels: ['N5', 'N4', 'N3', 'N2', 'N1'], group: 'all' },
]

const fillGapPool = sentenceExercises.filter((e) => e.type === 'fill-gap')

export function filterFillGapExercises(filter: FillGapLevelFilter): SentenceExercise[] {
  const option = FILL_GAP_LEVEL_OPTIONS.find((o) => o.id === filter)
  if (!option) return fillGapPool

  const allowed = new Set(option.levels)
  return fillGapPool.filter((e) => e.jlpt && allowed.has(e.jlpt))
}

export function countFillGapByFilter(filter: FillGapLevelFilter): number {
  return filterFillGapExercises(filter).length
}

export function fillGapCountsByLevel(): Record<JlptLevel, number> {
  const counts: Record<JlptLevel, number> = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 }
  for (const exercise of fillGapPool) {
    if (exercise.jlpt) counts[exercise.jlpt] += 1
  }
  return counts
}
