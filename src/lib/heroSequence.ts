import { HERO_SLOT_WIDTHS, type HeroSentenceFrame, type HeroStep } from '../data/heroSentences'
import { patternsForComplexity, type GenerationComplexity } from './generationComplexity'
import { generatePreviewSentence, type GeneratedPreviewSentence } from './sentenceGeneratorPreview'
import type { JlptLevel } from './types'
import type { WrongPool } from './wrongPool'

const STEPS_PER_LEVEL = 40
const GENERATION_ATTEMPTS_PER_STEP = 6
const STEPS_CACHE = new Map<string, HeroStep[]>()

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

/**
 * Each step is a complete, independently generated sentence from the same
 * hand-authored generator behind Sentence Testing — its English gloss is
 * written together with each grammar pattern rather than composed generically,
 * so unlike the old per-slot rotation there is no way for the translation to
 * drift out of sync with a rotated verb ending or adverb. The tradeoff is the
 * animation: every step is a full-sentence swap rather than a single word
 * sliding into place.
 */
function buildDatabaseHeroSteps(level: JlptLevel, sequenceSeed: number): HeroStep[] {
  const complexity = JLPT_TO_COMPLEXITY[level]
  const patterns = patternsForComplexity(complexity)
  if (!patterns.length) return []

  const start = Math.abs(sequenceSeed) % patterns.length
  const steps: HeroStep[] = []
  const seen = new Set<string>()

  for (let index = 0; index < STEPS_PER_LEVEL; index++) {
    // 13 walks through the pattern bank without clustering neighboring grammar.
    const pattern = patterns[(start + index * 13) % patterns.length]!
    let sentence: GeneratedPreviewSentence | null = null

    for (let attempt = 0; attempt < GENERATION_ATTEMPTS_PER_STEP; attempt++) {
      const seed = sequenceSeed + 4001 + index * 97 + attempt * 733
      try {
        const candidate = generatePreviewSentence(pattern.jlpt, seed, undefined, pattern.id, true)
        if (!candidate.japanese) continue
        if (!sentence) sentence = candidate
        if (!seen.has(candidate.japanese)) {
          sentence = candidate
          break
        }
      } catch {
        // The pattern's semantic/tag rules can rule out every combination
        // for a given seed; just try the next seed.
      }
    }

    if (!sentence) continue
    seen.add(sentence.japanese)
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
): HeroStep[] {
  const cacheKey = `${level}:${sequenceSeed}`
  const cached = STEPS_CACHE.get(cacheKey)
  if (cached) return cached

  const steps = buildDatabaseHeroSteps(level, sequenceSeed)
  STEPS_CACHE.set(cacheKey, steps)
  return steps
}

/** Kept for the Content Studio audit action. */
export function auditPosSteps(level: JlptLevel): number {
  return buildHeroSteps({} as WrongPool, {}, level)
    .filter((step) => !(step.frame.segments?.map((segment) => segment.text).join('')))
    .length
}
