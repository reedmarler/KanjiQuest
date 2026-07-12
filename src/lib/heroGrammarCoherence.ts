import type { HeroSentenceFrame } from '../data/heroSentences'
import {
  masuPredicateVariants,
  parseMasuPredicate,
  predicateTense,
} from './heroPredicateConjugation'
import { wordFitsPredicate } from './heroWordVerbFit'

export type FrameTenseRequirement = 'past' | 'present' | 'conditional' | 'desire' | 'any'

const PAST_PREFIXES = new Set(['昨日', '今朝', '先週'])
const PAST_PREDICATE_RE = /(ました|でした|した|かったです)$/

const CONDITIONAL_PREFIX_RE = /(ば、|たら、|ければ、)/

/** What tense the predicate should use given time prefix / frame shape */
export function frameTenseRequirement(frame: HeroSentenceFrame): FrameTenseRequirement {
  if (frame.prefix) {
    if (PAST_PREFIXES.has(frame.prefix)) return 'past'
    if (frame.prefix === '週末') return 'past'
    if (CONDITIONAL_PREFIX_RE.test(frame.prefix)) return 'conditional'
    if (frame.prefix.includes('ので、')) return 'present'
  }

  if (
    frame.modifier?.includes('てから、')
    || frame.modifier?.includes('行って、')
    || frame.modifier?.includes('会って、')
  ) {
    return 'past'
  }

  if (frame.predicate.endsWith('たいです') || frame.predicate.includes('たい')) {
    return 'desire'
  }

  return 'present'
}

function isPastPredicate(predicate: string): boolean {
  const tense = predicateTense(predicate)
  return tense === 'past' || tense === 'negativePast' || PAST_PREDICATE_RE.test(predicate)
}

export function predicateMatchesFrameTense(
  predicate: string,
  requirement: FrameTenseRequirement,
): boolean {
  if (requirement === 'any') return true

  if (requirement === 'past') {
    return isPastPredicate(predicate)
  }

  if (requirement === 'conditional') {
    const tense = predicateTense(predicate)
    return tense === 'present' || tense === 'negative' || tense === 'tai'
  }

  if (requirement === 'desire') {
    return predicate.includes('たい')
  }

  // habitual present — no plain past
  return !isPastPredicate(predicate)
}

/** Pick a conjugation of basePredicate that matches the frame's tense requirement */
export function coercePredicateToTense(
  basePredicate: string,
  frame: HeroSentenceFrame,
): string | null {
  const requirement = frameTenseRequirement(frame)
  const variants = masuPredicateVariants(basePredicate)

  const matching = variants.filter((v) => predicateMatchesFrameTense(v, requirement))
  if (matching.length > 0) return matching[0]

  const parsed = parseMasuPredicate(basePredicate)
  if (!parsed) return predicateMatchesFrameTense(basePredicate, requirement) ? basePredicate : null

  if (requirement === 'past') {
    const ending = parsed.family === 'shimasu' ? 'しました' : 'ました'
    return `${parsed.stem}${ending}`
  }

  if (requirement === 'conditional' || requirement === 'present') {
    const ending = parsed.family === 'shimasu' ? 'します' : 'ます'
    return `${parsed.stem}${ending}`
  }

  return basePredicate
}

/** Alternate verb/adjective roots that share the same object particle */
const ROOTS_BY_OBJECT_PARTICLE: Record<string, readonly string[]> = {
  'を': [
    '食べます',
    '飲みます',
    '読みます',
    '見ます',
    '買います',
    '作ります',
    '聞きます',
    '撮ります',
    '使います',
    '勉強します',
    '借ります',
  ],
  'に': ['行きます', '会います', '待ちます'],
  'が': ['好きです', '欲しいです', 'できます'],
  'は': ['重要です', '難しいです', '面白いです', '楽しいです'],
  'について': ['勉強します', '考えます', '読みます'],
  'で': ['食べます', '勉強します', '会います', '待ちます'],
}

const TAI_ROOTS = new Set([
  '食べたいです',
  '飲みたいです',
  '読みたいです',
  '見たいです',
  '行きたいです',
  '買いたいです',
  '作りたいです',
  '聞きたいです',
  '会いたいです',
  '撮りたいです',
  '知りたいです',
])

export function alternatePredicateRoots(
  frame: HeroSentenceFrame,
  seed: number,
): string[] {
  const pool = ROOTS_BY_OBJECT_PARTICLE[frame.objectParticle] ?? []
  const requirement = frameTenseRequirement(frame)
  const roots: string[] = []

  for (let i = 0; i < pool.length; i++) {
    const base = pool[(seed + i) % pool.length]
    if (base === frame.predicate) continue

    let candidate = base
    if (requirement === 'past' && parseMasuPredicate(base)) {
      const coerced = coercePredicateToTense(base, frame)
      if (coerced) candidate = coerced
    } else if (requirement === 'conditional' && TAI_ROOTS.has(base.replace(/ます$/, 'たいです'))) {
      candidate = base.replace(/ます$/, 'たいです')
    } else if (!parseMasuPredicate(base)) {
      candidate = base
    } else {
      const coerced = coercePredicateToTense(base, frame)
      if (coerced) candidate = coerced
    }

    if (candidate === frame.predicate) continue
    if (!predicateMatchesFrameTense(candidate, requirement)) continue
    if (!wordFitsPredicate(frame.word, candidate, frame.objectParticle, frame.modifier)) continue
    roots.push(candidate)
  }

  return roots
}

export function predicateEndingVariantsForFrame(
  frame: HeroSentenceFrame,
): string[] {
  const requirement = frameTenseRequirement(frame)
  const all = masuPredicateVariants(frame.predicate)

  return all.filter((candidate) => {
    if (candidate === frame.predicate) return false
    return predicateMatchesFrameTense(candidate, requirement)
  })
}
