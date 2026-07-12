/** Polite verb conjugation helpers for hero predicate swaps */

export type PredicateTense = 'present' | 'negative' | 'past' | 'negativePast' | 'tai'

export interface VerbConjugationForms {
  present: [third: string, first: string]
  negative: [third: string, first: string]
  past: [third: string, first: string]
  negativePast: [third: string, first: string]
}

const MASU_ENDINGS = ['ませんでした', 'ません', 'ました', 'ます'] as const
const SHIMASU_ENDINGS = ['しませんでした', 'しません', 'しました', 'します'] as const

const MASU_READING_SUFFIX: Record<string, string> = {
  'ます': 'ます',
  'ません': 'ません',
  'ました': 'ました',
  'ませんでした': 'ませんでした',
}

const SHIMASU_READING_SUFFIX: Record<string, string> = {
  'します': 'します',
  'しません': 'しません',
  'しました': 'しました',
  'しませんでした': 'しませんでした',
}

export const VERB_FORMS_BY_BASE: Record<string, VerbConjugationForms> = {
  '食べます': {
    present: ['eats', 'eat'],
    negative: ["doesn't eat", "don't eat"],
    past: ['ate', 'ate'],
    negativePast: ["didn't eat", "didn't eat"],
  },
  '飲みます': {
    present: ['drinks', 'drink'],
    negative: ["doesn't drink", "don't drink"],
    past: ['drank', 'drank'],
    negativePast: ["didn't drink", "didn't drink"],
  },
  '読みます': {
    present: ['reads', 'read'],
    negative: ["doesn't read", "don't read"],
    past: ['read', 'read'],
    negativePast: ["didn't read", "didn't read"],
  },
  '見ます': {
    present: ['watches', 'watch'],
    negative: ["doesn't watch", "don't watch"],
    past: ['watched', 'watched'],
    negativePast: ["didn't watch", "didn't watch"],
  },
  '行きます': {
    present: ['goes', 'go'],
    negative: ["doesn't go", "don't go"],
    past: ['went', 'went'],
    negativePast: ["didn't go", "didn't go"],
  },
  '買います': {
    present: ['buys', 'buy'],
    negative: ["doesn't buy", "don't buy"],
    past: ['bought', 'bought'],
    negativePast: ["didn't buy", "didn't buy"],
  },
  '作ります': {
    present: ['makes', 'make'],
    negative: ["doesn't make", "don't make"],
    past: ['made', 'made'],
    negativePast: ["didn't make", "didn't make"],
  },
  '聞きます': {
    present: ['listens', 'listen'],
    negative: ["doesn't listen", "don't listen"],
    past: ['listened', 'listened'],
    negativePast: ["didn't listen", "didn't listen"],
  },
  '会います': {
    present: ['meets', 'meet'],
    negative: ["doesn't meet", "don't meet"],
    past: ['met', 'met'],
    negativePast: ["didn't meet", "didn't meet"],
  },
  '待ちます': {
    present: ['waits', 'wait'],
    negative: ["doesn't wait", "don't wait"],
    past: ['waited', 'waited'],
    negativePast: ["didn't wait", "didn't wait"],
  },
  '使います': {
    present: ['uses', 'use'],
    negative: ["doesn't use", "don't use"],
    past: ['used', 'used'],
    negativePast: ["didn't use", "didn't use"],
  },
  '話します': {
    present: ['speaks', 'speak'],
    negative: ["doesn't speak", "don't speak"],
    past: ['spoke', 'spoke'],
    negativePast: ["didn't speak", "didn't speak"],
  },
  '撮ります': {
    present: ['takes', 'take'],
    negative: ["doesn't take", "don't take"],
    past: ['took', 'took'],
    negativePast: ["didn't take", "didn't take"],
  },
  '勉強します': {
    present: ['studies', 'study'],
    negative: ["doesn't study", "don't study"],
    past: ['studied', 'studied'],
    negativePast: ["didn't study", "didn't study"],
  },
  'します': {
    present: ['does', 'do'],
    negative: ["doesn't do", "don't do"],
    past: ['did', 'do'],
    negativePast: ["didn't do", "didn't do"],
  },
  '考えます': {
    present: ['thinks', 'think'],
    negative: ["doesn't think", "don't think"],
    past: ['thought', 'thought'],
    negativePast: ["didn't think", "didn't think"],
  },
  '借ります': {
    present: ['borrows', 'borrow'],
    negative: ["doesn't borrow", "don't borrow"],
    past: ['borrowed', 'borrowed'],
    negativePast: ["didn't borrow", "didn't borrow"],
  },
  '書きます': {
    present: ['writes', 'write'],
    negative: ["doesn't write", "don't write"],
    past: ['wrote', 'wrote'],
    negativePast: ["didn't write", "didn't write"],
  },
  '走ります': {
    present: ['runs', 'run'],
    negative: ["doesn't run", "don't run"],
    past: ['ran', 'ran'],
    negativePast: ["didn't run", "didn't run"],
  },
  '泳ぎます': {
    present: ['swims', 'swim'],
    negative: ["doesn't swim", "don't swim"],
    past: ['swam', 'swam'],
    negativePast: ["didn't swim", "didn't swim"],
  },
  '遊びます': {
    present: ['plays', 'play'],
    negative: ["doesn't play", "don't play"],
    past: ['played', 'played'],
    negativePast: ["didn't play", "didn't play"],
  },
  '歌います': {
    present: ['sings', 'sing'],
    negative: ["doesn't sing", "don't sing"],
    past: ['sang', 'sang'],
    negativePast: ["didn't sing", "didn't sing"],
  },
  '始めます': {
    present: ['starts', 'start'],
    negative: ["doesn't start", "don't start"],
    past: ['started', 'started'],
    negativePast: ["didn't start", "didn't start"],
  },
  '覚えます': {
    present: ['learns', 'learn'],
    negative: ["doesn't learn", "don't learn"],
    past: ['learned', 'learned'],
    negativePast: ["didn't learn", "didn't learn"],
  },
  '電話します': {
    present: ['calls', 'call'],
    negative: ["doesn't call", "don't call"],
    past: ['called', 'called'],
    negativePast: ["didn't call", "didn't call"],
  },
}

interface ParsedMasuPredicate {
  stem: string
  ending: string
  family: 'masu' | 'shimasu'
  base: string
}

export function parseMasuPredicate(predicate: string): ParsedMasuPredicate | null {
  for (const ending of SHIMASU_ENDINGS) {
    if (predicate.endsWith(ending)) {
      const stem = predicate.slice(0, -ending.length)
      if (!stem) return null
      return {
        stem,
        ending,
        family: 'shimasu',
        base: `${stem}します`,
      }
    }
  }

  for (const ending of MASU_ENDINGS) {
    if (predicate.endsWith(ending)) {
      const stem = predicate.slice(0, -ending.length)
      if (!stem) return null
      return {
        stem,
        ending,
        family: 'masu',
        base: `${stem}ます`,
      }
    }
  }

  return null
}

export function predicateTense(predicate: string): PredicateTense | null {
  if (predicate.endsWith('たいです')) return 'tai'
  if (predicate.endsWith('ませんでした')) return 'negativePast'
  if (predicate.endsWith('しませんでした')) return 'negativePast'
  if (predicate.endsWith('ません') || predicate.endsWith('しません')) return 'negative'
  if (predicate.endsWith('ました') || predicate.endsWith('しました')) return 'past'
  if (predicate.endsWith('ます') || predicate.endsWith('します')) return 'present'
  return null
}

export function masuPredicateVariants(predicate: string): string[] {
  const parsed = parseMasuPredicate(predicate)
  if (!parsed) return [predicate]

  const endings = parsed.family === 'shimasu' ? SHIMASU_ENDINGS : MASU_ENDINGS
  const variants = new Set<string>([predicate])

  for (const ending of endings) {
    variants.add(`${parsed.stem}${ending}`)
  }

  if (predicate.endsWith('たいです')) {
    variants.add(predicate.replace(/たいです$/, 'ます'))
    variants.add(predicate.replace(/たいです$/, 'ました'))
  } else if (predicate.endsWith('ました') && !predicate.endsWith('ませんでした')) {
    const tai = predicate.replace(/ました$/, 'たいです')
    if (KNOWN_TAI_PREDICATES.has(tai)) variants.add(tai)
  } else if (predicate.endsWith('ます') && !predicate.endsWith('ません')) {
    const tai = predicate.replace(/ます$/, 'たいです')
    if (KNOWN_TAI_PREDICATES.has(tai)) variants.add(tai)
  }

  return [...variants]
}

/** Tai round-trips kept from heroSequence */
const KNOWN_TAI_PREDICATES = new Set([
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

export function findMasuVerbBase(predicate: string): string | null {
  const parsed = parseMasuPredicate(predicate)
  if (!parsed) return null
  return VERB_FORMS_BY_BASE[parsed.base] ? parsed.base : null
}

export function heroVerbForTense(
  who: string,
  also: string,
  forms: VerbConjugationForms,
  tense: PredicateTense,
): string {
  const pair =
    tense === 'negative'
      ? forms.negative
      : tense === 'past'
        ? forms.past
        : tense === 'negativePast'
          ? forms.negativePast
          : forms.present

  const [third, first] = pair
  return who === 'I' ? `I${also} ${first}` : `${who}${also} ${third}`
}

export function derivePredicateReading(
  predicate: string,
  baseReadings: Record<string, string>,
): string | undefined {
  if (baseReadings[predicate]) return baseReadings[predicate]

  const parsed = parseMasuPredicate(predicate)
  if (!parsed) return undefined

  const baseReading = baseReadings[parsed.base]
  if (!baseReading) return undefined

  const suffixMap =
    parsed.family === 'shimasu' ? SHIMASU_READING_SUFFIX : MASU_READING_SUFFIX
  const suffixReading = suffixMap[parsed.ending]
  if (!suffixReading) return undefined

  const stemReading = baseReading.slice(0, -suffixMap[parsed.family === 'shimasu' ? 'します' : 'ます'].length)
  return `${stemReading}${suffixReading}`
}
