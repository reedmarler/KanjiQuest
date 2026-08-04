import { HERO_SLOT_WIDTHS, type HeroSentenceFrame, type HeroStep } from '../data/heroSentences'
import { patternsForComplexity, type GenerationComplexity } from './generationComplexity'
import { generatePreviewSentence, type GeneratedPreviewSentence } from './sentenceGeneratorPreview'
import { selectMostDiverse, SentenceDiversityTracker } from './sentenceDiversity'
import { isDashboardSentenceNatural } from './dashboardSentenceQuality'
import { generateCategorySentence } from './categorySentenceEngine'
import { sentencePatternCatalog } from '../data/sentencePatternCatalog'
import type { JlptLevel } from './types'
import type { WrongPool } from './wrongPool'

// The hero needs only the current and next sentences immediately. Building a
// 40-sentence stream with 16 candidates each made the dashboard wait on up to
// 640 full generation passes before it could render. A 20-step, 10-candidate
// stream still walks a broad range of grammar patterns and uses the same
// naturalness/diversity selection, while making the initial dashboard load
// roughly three times lighter.
const STEPS_PER_LEVEL = 20
const GENERATION_ATTEMPTS_PER_STEP = 10
const STEPS_CACHE = new Map<string, HeroStep[]>()

// These are the common endings the category engine can safely apply to the
// same verb and its governed slots.  Prohibitions are deliberately absent: a
// context-free "must not" sentence needs a rule or situation, not just a verb.
const COMMON_VERB_FORM_PATTERNS = [
  'n4-01', // ～たいです
  'n4-02', // ～ています
  'n4-03', // ～ました
  'n4-04', // ～ません
  'n4-05', // ～なければなりません
  'n4-06', // ～てもいいです
  'n4-08', // ～たことがあります
  'n4-10', // ～始めます
] as const

// Higher levels cannot safely share a bare verb with a new ending: their
// meaning lives in a whole clause or discourse context. These reviewed pairs
// keep the same learning idea while changing to a related form that has its
// own complete, natural sentence generator.
const LINKED_FORMS: Partial<Record<JlptLevel, Readonly<Record<string, readonly string[]>>>> = {
  N3: {
    'n4-10': ['n3-15', 'n3-31'],
    'n3-01': ['n3-03'],
    'n3-03': ['n3-01'],
    'n3-04': ['n3-05'],
    'n3-05': ['n3-04'],
    'n3-14': ['n3-15', 'n3-31'],
    'n3-15': ['n3-14', 'n3-31'],
    'n3-31': ['n3-14', 'n3-15'],
  },
  N2: {
    'n3-06': ['n3-07'],
    'n3-07': ['n3-06'],
    'n3-08': ['n1-03'],
    'n1-03': ['n3-08'],
    'n3-09': ['n4-18'],
    'n4-18': ['n3-09'],
    'n3-10': ['n2-09'],
    'n2-09': ['n3-10'],
    'n3-16': ['n2-12'],
    'n2-12': ['n3-16'],
  },
  N1: {
    'n2-01': ['n2-17'],
    'n2-17': ['n2-01'],
    'n2-02': ['n1-01'],
    'n1-01': ['n2-02'],
    'n1-02': ['n2-07'],
    'n2-07': ['n1-02'],
    'n1-13': ['n2-05'],
    'n2-05': ['n1-13'],
  },
}

// The dashboard's complexity buttons (L1-L5) drive JLPT level everywhere else
// in the app; the category-sentence generator groups patterns by grammatical
// complexity instead, so map back to that axis here.
const JLPT_TO_COMPLEXITY: Record<JlptLevel, GenerationComplexity> = {
  N5: 1, N4: 2, N3: 3, N2: 4, N1: 5,
}

if (typeof window !== 'undefined') {
  window.addEventListener('kanji-quest-content-database-change', () => STEPS_CACHE.clear())
}

export function clearHeroStepsCache(): void {
  STEPS_CACHE.clear()
}

function categoryFrameFor(sentence: GeneratedPreviewSentence): HeroSentenceFrame {
  return {
    generatedEnglish: sentence.english,
    generatedReading: sentence.reading,
    generatedPatternId: `category-${sentence.frameId}`,
    segments: sentence.furigana.map((part, index) => ({
      key: part.slot ?? `lit-${index}`,
      text: part.text,
      reading: part.reading,
      swappable: false,
    })),
    prefix: '',
    subject: '',
    topicParticle: '',
    modifier: '',
    word: '',
    objectParticle: '',
    bridge: '',
    predicate: '',
  }
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left
  let b = right
  while (b) [a, b] = [b, a % b]
  return a
}

function patternStride(patternCount: number): number {
  // A stride must be coprime with the pattern count.  The old fixed stride of
  // 13 was exactly the N4 pattern count, so it repeated one pattern forever.
  return [13, 11, 7, 5, 3, 2, 1].find((candidate) => greatestCommonDivisor(candidate, patternCount) === 1) ?? 1
}

function categoryVerbId(sentence: GeneratedPreviewSentence): string | null {
  const id = sentence.slots.verb?.id
  // Category-engine records are stable `verb-{id}` identifiers. Preview-only
  // fallback records use a different vocabulary ID and safely opt out.
  return id?.startsWith('verb-') ? id.slice('verb-'.length) : null
}

function basicVerbFormVariants(sentence: GeneratedPreviewSentence, seed: number): GeneratedPreviewSentence[] {
  const verbId = categoryVerbId(sentence)
  if (!verbId) return []

  return COMMON_VERB_FORM_PATTERNS.flatMap((patternId, formIndex) => {
    try {
      const variant = generateCategorySentence(seed + formIndex * 83, patternId, 'N4', { verbId })
      return variant && isDashboardSentenceNatural(variant) ? [variant] : []
    } catch {
      return []
    }
  })
}

function linkedHigherLevelVariants(level: Exclude<JlptLevel, 'N5'>, sentence: GeneratedPreviewSentence, seed: number): GeneratedPreviewSentence[] {
  const linkedIds = LINKED_FORMS[level]?.[sentence.frameId] ?? []
  return linkedIds.flatMap((patternId, index) => {
    const pattern = sentencePatternCatalog.find((candidate) => candidate.id === patternId)
    if (!pattern) return []
    try {
      const variant = generatePreviewSentence(pattern.jlpt, seed + index * 97, undefined, patternId, true)
      return variant && isDashboardSentenceNatural(variant) ? [variant] : []
    } catch {
      return []
    }
  })
}

function levelAppropriateFormVariants(level: JlptLevel, sentence: GeneratedPreviewSentence, seed: number): GeneratedPreviewSentence[] {
  if (level === 'N5') return basicVerbFormVariants(sentence, seed)
  return linkedHigherLevelVariants(level, sentence, seed)
}

/**
 * Each step is a complete, independently generated sentence from the same
 * hand-authored generator behind Sentence Testing — its English gloss is
 * written together with each grammar pattern rather than composed generically,
 * so unlike the old per-slot rotation there is no way for the translation to
 * drift out of sync with a rotated verb ending or adverb. The tradeoff is the
 * animation: every step is a full-sentence swap rather than a single word
 * sliding into place.
 */
function buildDatabaseHeroSteps(level: JlptLevel, sequenceSeed: number, stepCount: number): HeroStep[] {
  const complexity = JLPT_TO_COMPLEXITY[level]
  const patterns = patternsForComplexity(complexity)
  if (!patterns.length) return []

  const start = Math.abs(sequenceSeed) % patterns.length
  const stride = patternStride(patterns.length)
  const steps: HeroStep[] = []
  const tracker = new SentenceDiversityTracker()
  let pendingFormVariants: GeneratedPreviewSentence[] = []

  for (let index = 0; index < stepCount; index++) {
    // A coprime stride walks through every available pattern before repeating.
    const pattern = patterns[(start + index * stride) % patterns.length]!
    const candidates: GeneratedPreviewSentence[] = []

    for (let attempt = 0; attempt < GENERATION_ATTEMPTS_PER_STEP; attempt++) {
      const seed = sequenceSeed + 4001 + index * 97 + attempt * 733
      try {
        const candidate = generatePreviewSentence(pattern.jlpt, seed, undefined, pattern.id, true)
        if (candidate.japanese) candidates.push(candidate)
      } catch {
        // The pattern's semantic/tag rules can rule out every combination
        // for a given seed; just try the next seed.
      }
    }

    const naturalCandidates = candidates.filter(isDashboardSentenceNatural)
    // A rare new user word may have no high-confidence partner yet. Preserve
    // coverage rather than silently removing a whole grammar pattern, while
    // preferring natural defaults whenever any are available.
    const ordinaryCandidates = naturalCandidates.length ? naturalCandidates : candidates
    const nextPattern = patterns[(start + (index + 1) * stride) % patterns.length]
    // Do not force a paired form immediately before the normal pattern walk
    // would show that exact same form anyway.
    const eligibleFollowUps = pendingFormVariants.filter((candidate) => candidate.frameId !== nextPattern?.id)
    const linkedFormCandidates = index % 5 === 4 ? eligibleFollowUps : []
    // Every fifth sentence revisits a compatible form: the same verb where a
    // lower-level verb can safely carry another ending, or a paired complete
    // clause/discourse form at N3–N1. The other four keep the full pattern
    // walk broad.
    const sentence = selectMostDiverse(linkedFormCandidates.length ? linkedFormCandidates : ordinaryCandidates, tracker)
    if (!sentence) continue
    tracker.add(sentence)
    {
      if (linkedFormCandidates.length) {
        pendingFormVariants = []
      } else {
        const variants = levelAppropriateFormVariants(level, sentence, sequenceSeed + 9001 + index * 211)
        // Keep the most recent form-capable sentence ready for its scheduled
        // follow-up. Frames without a sound counterpart leave it untouched.
        if (variants.length) pendingFormVariants = variants
      }
    }
    steps.push({
      frame: categoryFrameFor(sentence),
      changed: [],
      slotWidths: HERO_SLOT_WIDTHS,
      templateRefresh: true,
    })
  }

  return steps
}

export function buildHeroSteps(
  _wrongPool: WrongPool,
  _progress: Record<string, unknown> = {},
  level: JlptLevel,
  sequenceSeed = 0,
  stepCount = STEPS_PER_LEVEL,
): HeroStep[] {
  const cacheKey = `${level}:${sequenceSeed}:${stepCount}`
  const cached = STEPS_CACHE.get(cacheKey)
  if (cached) return cached

  const steps = buildDatabaseHeroSteps(level, sequenceSeed, stepCount)
  STEPS_CACHE.set(cacheKey, steps)
  return steps
}

/** Kept for the Content Studio audit action. */
export function auditPosSteps(level: JlptLevel): number {
  return buildHeroSteps({} as WrongPool, {}, level)
    .filter((step) => !(step.frame.segments?.map((segment) => segment.text).join('')))
    .length
}
