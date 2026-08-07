import { charLength, HERO_SLOT_WIDTHS, type HeroSentenceFrame, type HeroStep } from '../data/heroSentences'
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
  // A slot name can appear twice in one sentence (two objects, two verbs in a
  // たり…たり frame), so disambiguate by occurrence — otherwise both segments
  // share a key and the rotation diff cannot tell which one moved.
  const occurrences = new Map<string, number>()
  return {
    generatedEnglish: sentence.english,
    generatedReading: sentence.reading,
    generatedPatternId: `category-${sentence.frameId}`,
    segments: sentence.furigana.map((part, index) => {
      if (!part.slot) return { key: `lit-${index}`, text: part.text, reading: part.reading, swappable: false }
      const occurrence = occurrences.get(part.slot) ?? 0
      occurrences.set(part.slot, occurrence + 1)
      return {
        key: occurrence === 0 ? part.slot : `${part.slot}-${occurrence + 1}`,
        text: part.text,
        reading: part.reading,
        swappable: true,
      }
    }),
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
 * Two frames are comparable only when they came from the same pattern and laid
 * out the same segments — otherwise "one thing changed" is meaningless because
 * the whole shape moved.
 */
function structureKey(frame: HeroSentenceFrame) {
  return (frame.segments ?? []).map((segment) => `${segment.key}:${segment.swappable ? 'slot' : segment.text}`).join('|')
}

function changedSegmentKeys(previous: HeroSentenceFrame, current: HeroSentenceFrame) {
  if (structureKey(previous) !== structureKey(current)) return []
  const previousByKey = new Map((previous.segments ?? []).map((segment) => [segment.key, segment.text]))
  return (current.segments ?? [])
    .filter((segment) => segment.swappable && previousByKey.get(segment.key) !== segment.text)
    .map((segment) => segment.key)
}

/** A rotation step is admissible only when exactly one visible slot moved. */
function isSingleSlotNeighbor(previous: HeroSentenceFrame, current: HeroSentenceFrame) {
  return changedSegmentKeys(previous, current).length === 1
    && previous.generatedEnglish !== current.generatedEnglish
}

/**
 * Prefer a replacement close in length to what it replaces: the reel animates a
 * single word in place, and a large width change makes the rest of the line
 * reflow around it.
 */
function replacementLengthDelta(previous: HeroSentenceFrame, current: HeroSentenceFrame) {
  const changed = changedSegmentKeys(previous, current)
  if (changed.length !== 1) return Number.POSITIVE_INFINITY
  const key = changed[0]!
  const before = (previous.segments ?? []).find((segment) => segment.key === key)?.text ?? ''
  const after = (current.segments ?? []).find((segment) => segment.key === key)?.text ?? ''
  return Math.abs(charLength(before) - charLength(after))
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

// A minimum, not a fixed count: the loop below keeps attempting slots (cycling
// back through the same ones if needed) until this many rotations actually
// land, rather than giving up after a fixed number of tries that may include
// failures. MAX_ROTATION_ATTEMPTS bounds the cost when a sentence genuinely
// has few — or few successful — rotatable slots.
const MIN_ROTATIONS_PER_SENTENCE = 5
const MAX_ROTATION_ATTEMPTS = 30
const ROTATION_ATTEMPTS_PER_SLOT = 8

/**
 * Rotate one slot of an already-approved sentence, holding every other slot
 * fixed. Both the base and the rotation come out of the generator complete, so
 * each carries its own hand-authored English — the caller can diff the two
 * strings rather than composing a translation from parts.
 *
 * Returns the closest-in-length admissible neighbour, or null when this slot
 * has no replacement that changes exactly one visible segment.
 */
function rotateOneSlot(
  level: JlptLevel,
  patternId: string,
  baseSeed: number,
  current: HeroSentenceFrame,
  slotSeeds: Record<string, number>,
  slot: string,
  salt: number,
): { seed: number; frame: HeroSentenceFrame } | null {
  // Excluding the word already on screen means the first candidate that
  // survives the natural-sentence and category checks is a genuine change —
  // without it, a small candidate pool (a handful of valid objects for a given
  // verb) can spend every attempt re-picking the same word by chance.
  const currentText = current.segments?.find((segment) => segment.key === slot)?.text
  const candidates: Array<{ seed: number; frame: HeroSentenceFrame }> = []
  for (let attempt = 1; attempt <= ROTATION_ATTEMPTS_PER_SLOT; attempt++) {
    const candidateSeed = baseSeed + 17 + salt * 11 + attempt
    let candidate: GeneratedPreviewSentence | null = null
    try {
      candidate = generateCategorySentence(baseSeed, patternId, level, {
        slotSeeds: { ...slotSeeds, [slot]: candidateSeed },
        avoidWords: currentText ? { [slot]: currentText } : undefined,
      })
    } catch {
      continue
    }
    if (!candidate?.japanese || !isDashboardSentenceNatural(candidate)) continue
    const frame = categoryFrameFor(candidate)
    if (!isSingleSlotNeighbor(current, frame)) continue
    candidates.push({ seed: candidateSeed, frame })
  }
  return candidates.sort((a, b) => replacementLengthDelta(current, a.frame) - replacementLengthDelta(current, b.frame))[0] ?? null
}

/**
 * A sentence is shown, then rotated one slot at a time — noun, verb, adverb —
 * before the stream refreshes to a new pattern. Every step is a fully generated
 * sentence, so its English is the generator's own rather than something
 * composed from parts; the renderer diffs consecutive glosses to find what to
 * animate, and falls back to a whole-line fade when more than one word moved.
 *
 * `templateRefresh` marks the steps that jump to a new pattern; the rest carry
 * exactly one key in `changed`.
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

  // Each pass appends a base sentence plus however many rotations that sentence
  // supports, so the bound is on emitted steps rather than on passes.
  for (let index = 0; steps.length < stepCount; index++) {
    // A coprime stride walks through every available pattern before repeating.
    const pattern = patterns[(start + index * stride) % patterns.length]!
    // A level whose patterns all fail to generate would otherwise spin forever
    // now that the loop counts steps instead of passes.
    if (index >= stepCount * 4) break
    const candidates: GeneratedPreviewSentence[] = []
    // Rotation has to re-enter the generator on the *same* seed that produced
    // the chosen sentence, holding every other slot fixed, so remember which
    // seed each candidate came from.
    const seedBySentence = new Map<GeneratedPreviewSentence, number>()

    for (let attempt = 0; attempt < GENERATION_ATTEMPTS_PER_STEP; attempt++) {
      const seed = sequenceSeed + 4001 + index * 97 + attempt * 733
      try {
        const candidate = generatePreviewSentence(pattern.jlpt, seed, undefined, pattern.id, true)
        if (candidate.japanese) {
          candidates.push(candidate)
          seedBySentence.set(candidate, seed)
        }
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
    let current = categoryFrameFor(sentence)
    steps.push({
      frame: current,
      changed: [],
      slotWidths: HERO_SLOT_WIDTHS,
      templateRefresh: true,
    })

    // Rotate individual slots of this sentence before moving on. Any slot the
    // pattern filled is a candidate; isSingleSlotNeighbor decides which ones
    // actually yield a clean one-word change, so no hand-maintained list of
    // rotatable slot names can fall out of date with the generator.
    //
    // 'subject' is Object.keys(sentence.slots)[0] for nearly every pattern, and
    // the subject pool is large enough that a rotation attempt on it almost
    // always succeeds. Always starting the cycle there would make subject the
    // one slot with a guaranteed turn every sentence, at every other slot's
    // expense — rotating the start position (deterministically, off the
    // sentence's own seed) gives each slot an equal shot at going first.
    const rotatableSlots = Object.keys(sentence.slots)
    const rotationStart = Math.abs(seedBySentence.get(sentence) ?? 0) % rotatableSlots.length
    const baseSeed = seedBySentence.get(sentence)
    let slotSeeds: Record<string, number> = {}
    let successCount = 0
    // `rotation` counts attempts, not successes — a slot that fails (small
    // pool, avoidWords exhausting the alternatives) must not eat into the
    // minimum, so keep cycling through the slot list, wrapping around as many
    // times as it takes, until MIN_ROTATIONS_PER_SENTENCE actually land or the
    // attempt budget runs out.
    for (
      let rotation = 0;
      baseSeed !== undefined && successCount < MIN_ROTATIONS_PER_SENTENCE
        && rotation < MAX_ROTATION_ATTEMPTS && steps.length < stepCount;
      rotation++
    ) {
      const slot = rotatableSlots[(rotationStart + rotation) % rotatableSlots.length]
      if (!slot) break
      // Subject's pool is unusually large and a rotation attempt on it nearly
      // always succeeds, so even with a randomized start it still wins far
      // more turns than any other slot. Deterministically skipping half of
      // its turns lets object/verb/location/etc. surface roughly as often as
      // their own (lower) success rate allows, instead of being crowded out.
      if (slot === 'subject' && (baseSeed + rotation) % 2 === 0) continue
      const next = rotateOneSlot(level, sentence.frameId, baseSeed, current, slotSeeds, slot, rotation)
      if (!next) continue
      slotSeeds = { ...slotSeeds, [slot]: next.seed }
      successCount++
      steps.push({
        frame: next.frame,
        changed: changedSegmentKeys(current, next.frame),
        slotWidths: HERO_SLOT_WIDTHS,
        templateRefresh: false,
      })
      current = next.frame
    }
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
