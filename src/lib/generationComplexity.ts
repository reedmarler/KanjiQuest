import { sentencePatternCatalog, type SentencePatternRecord } from '../data/sentencePatternCatalog'
import type { JlptLevel } from './types'

/** Difficulty is determined by how much grammatical structure the generator must coordinate. */
export type GenerationComplexity = 1 | 2 | 3 | 4 | 5

export const GENERATION_COMPLEXITIES: readonly GenerationComplexity[] = [1, 2, 3, 4, 5]

export const complexityDetails: Record<GenerationComplexity, {
  label: string
  shortLabel: string
  description: string
}> = {
  1: { label: 'Level 1 · Single verb', shortLabel: 'L1', description: 'One governed verb: ～たい, ～しか～ない, ～ことができる.' },
  2: { label: 'Level 2 · Two verbs', shortLabel: 'L2', description: 'Two interacting verbs: ～てから, ～前に, ～ながら, ～たり～たりする.' },
  3: { label: 'Level 3 · Verb chaining', shortLabel: 'L3', description: 'Chained verb forms: ～ようになる, ～ようにする, ～始める, ～終わる, ～続ける.' },
  4: { label: 'Level 4 · Logical relationships', shortLabel: 'L4', description: 'Clause relationships: ～のに, ～にもかかわらず, ～ために, ～ように, ～ば～ほど.' },
  5: { label: 'Level 5 · Advanced discourse', shortLabel: 'L5', description: 'Abstract discourse: ～ざるを得ない, ～ないわけにはいかない, ～にほかならない, ～というわけではない.' },
}

// Every generator-ready pattern is assigned to exactly one level. Levels follow
// how much grammatical structure the generator must coordinate, not JLPT rank —
// so N4 modals sit at Level 1 while an N3 conditional sits at Level 4.
const patternsByComplexity: Record<GenerationComplexity, readonly string[]> = {
  // Single governed clause: one verb, a modal on one verb, or a basic particle frame.
  1: [
    'n5-01', 'n5-02', 'n5-03', 'n5-04', 'n5-05', 'n5-06', 'n5-07', 'n5-08', 'n5-09', 'n5-10',
    'n5-11', 'n5-12', 'n5-13', 'n5-14', 'n5-15', 'n5-16', 'n5-17', 'n5-18', 'n5-19', 'n5-20',
    'n5-21', 'n5-22', 'n5-23', 'n5-24', 'n5-25', 'n5-26', 'n5-27', 'n5-28', 'n5-29', 'n5-30', 'n5-31', 'n5-32', 'n5-33',
    'n4-01', 'n4-02', 'n4-03', 'n4-04', 'n4-05', 'n4-06', 'n4-07', 'n4-08',
    'n4-11', 'n4-12', 'n4-15', 'n4-16', 'n4-17', 'n4-20', 'n4-24', 'n4-25', 'n4-26', 'n4-27', 'n4-28', 'n4-29',
    'n3-13', 'n2-10', 'n2-11', 'n1-04', 'n2-13', 'n2-14', 'n2-04',
    'n2-06', 'n2-16', 'n2-18', 'n2-03', 'n2-08',
    'n3-20', 'n3-21', 'n3-22', 'n3-23', 'n3-26', 'n3-29', 'n3-30',
    'n3-33', 'n3-34', 'n3-35', 'n3-37', 'n3-38', 'n3-39', 'n3-40', 'n3-41',
    'n2-35', 'n2-36', 'n2-37',
  ],
  // Two interacting verbs in one sentence.
  2: ['n4-09', 'n4-13', 'n4-14', 'n4-21', 'n4-22', 'n4-23', 'n3-11', 'n3-12', 'n3-18', 'n3-19', 'n3-24', 'n3-25', 'n3-32'],
  // Chained / aspectual verb forms.
  3: ['n4-10', 'n3-01', 'n3-02', 'n3-03', 'n3-04', 'n3-05', 'n3-14', 'n3-15', 'n3-31'],
  // Logical relationships between clauses (reason, condition, contrast, purpose).
  4: [
    'n4-18', 'n4-19', 'n3-06', 'n3-07', 'n3-08', 'n3-09', 'n3-10', 'n2-09', 'n3-16', 'n3-17', 'n1-03',
    'n2-12', 'n2-15', 'n1-11', 'n1-12', 'n1-05', 'n1-08', 'n1-09', 'n1-10',
    'n3-27', 'n3-28', 'n2-19', 'n2-20', 'n2-21', 'n3-36',
    'n2-22', 'n2-23', 'n2-24', 'n2-25', 'n2-26', 'n2-27', 'n2-28', 'n2-29',
    'n2-30', 'n2-31', 'n2-32', 'n2-33', 'n2-34',
  ],
  // Advanced discourse grammar over a whole proposition.
  5: ['n2-01', 'n2-02', 'n1-01', 'n1-02', 'n1-13', 'n1-06', 'n1-07', 'n2-05', 'n2-07', 'n2-17'],
}

const complexityByPattern = new Map<string, GenerationComplexity>(
  Object.entries(patternsByComplexity).flatMap(([complexity, ids]) =>
    ids.map((id) => [id, Number(complexity) as GenerationComplexity] as const),
  ),
)

/** Uncategorized foundation patterns remain Level 1 rather than disappearing from practice. */
export function complexityForPattern(patternId: string): GenerationComplexity {
  return complexityByPattern.get(patternId) ?? 1
}

export function patternsForComplexity(complexity: GenerationComplexity): SentencePatternRecord[] {
  return patternsByComplexity[complexity]
    .map((id) => sentencePatternCatalog.find((pattern) => pattern.id === id))
    .filter((pattern): pattern is SentencePatternRecord => pattern?.generatorReady === true)
}

export function formatComplexity(complexity: GenerationComplexity): string {
  return complexityDetails[complexity].label
}

/** Hero content is still cataloged by JLPT, so this provides a stable display bridge. */
export function heroJlptForComplexity(complexity: GenerationComplexity): JlptLevel {
  return ({ 1: 'N5', 2: 'N4', 3: 'N3', 4: 'N2', 5: 'N1' } as const)[complexity]
}
