import { charLength, HERO_SLOT_WIDTHS, type HeroSentenceFrame, type HeroStep } from '../data/heroSentences'
import { patternsForLevel } from './generationComplexity'
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

/**
 * Swappable segment keys in reading order (left to right), each appearing
 * once. This drives the sweep — subject, then object, then whatever else the
 * pattern fills, then the verb last — matching where each word actually sits
 * in the sentence rather than an arbitrary object-key order.
 */
/**
 * Grammar-focus drill: hold the sentence still and rotate one part of speech.
 *
 * The ordinary stream sweeps every slot once, so a given word is on screen for
 * one step. A focused stream does the opposite — it keeps the sentence fixed
 * and works the chosen part of speech repeatedly, which is what makes a
 * conjugation drill a drill.
 */
export type HeroSwapFocus = 'verb' | 'noun' | 'adjective'

/** How many rotations a focused sentence gets before the stream moves on. */
const FOCUS_ROTATIONS = 5

/**
 * The sweep queue for a focused sentence, or null when this sentence cannot
 * serve the focus at all — a verbless pattern under a verb drill. Returning
 * null lets the caller skip to the next pattern instead of emitting a sentence
 * the learner cannot practise on.
 */
function focusedSweepQueue(sentence: GeneratedPreviewSentence, focus: HeroSwapFocus): string[] | null {
  const slots = orderedSwappableSlotKeys(sentence)
  if (focus === 'verb') {
    // Endings only. The verb itself stays put so the conjugation is the one
    // thing changing, which is the whole point of the drill.
    if (!slots.includes('verb')) return null
    return Array.from({ length: FOCUS_ROTATIONS }, () => 'ending')
  }
  if (focus === 'adjective') {
    // Alternate the adjective and its ending: 面白いです → 新しいです →
    // 新しくないです. Both halves of an adjective predicate get practised.
    if (!slots.includes('adjective')) return null
    return Array.from({ length: FOCUS_ROTATIONS }, (_, index) => (index % 2 === 0 ? 'adjective' : 'ending'))
  }
  // Nouns: every slot that is not the predicate or its ending, cycled until the
  // rotation budget is spent. A one-noun sentence still gets five turns at it.
  const nouns = slots.filter((slot) => slot !== 'verb' && slot !== 'adjective' && slot !== 'ending')
  if (!nouns.length) return null
  return Array.from({ length: FOCUS_ROTATIONS }, (_, index) => nouns[index % nouns.length]!)
}

function orderedSwappableSlotKeys(sentence: GeneratedPreviewSentence): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  for (const part of sentence.furigana) {
    if (!part.slot || !sentence.slots[part.slot] || seen.has(part.slot)) continue
    seen.add(part.slot)
    order.push(part.slot)
  }
  return order
}

/**
 * A rotation step is admissible when exactly one visible segment's Japanese
 * text moved. English is deliberately not required to differ — a polite ⟷
 * plain register swap (食べます ⟷ 食べる) is a real, valid rotation whose
 * English gloss is identical ("eats" either way); the renderer already leaves
 * the English untouched when it doesn't change, so there is nothing to blur.
 */
function isSingleSlotNeighbor(previous: HeroSentenceFrame, current: HeroSentenceFrame) {
  return changedSegmentKeys(previous, current).length === 1
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
  avoidWords: Record<string, string>,
  slot: string,
  salt: number,
  extraAvoidTexts: readonly string[] = [],
): { seed: number; frame: HeroSentenceFrame; avoidWords: Record<string, string> } | null {
  // Excluding the word already on screen means the first candidate that
  // survives the natural-sentence and category checks is a genuine change —
  // without it, a small candidate pool (a handful of valid objects for a given
  // verb) can spend every attempt re-picking the same word by chance. The
  // 'ending' slot is a synthetic key with no segment of its own — the text it
  // has to avoid is whatever the sentence's predicate segment currently shows
  // (the 'verb' segment normally, or 'adjective' for a verbless adjective+
  // copula predicate like n5-17's Xが好きです), since that's the conjugated
  // ending's own surface form.
  const endingAnchor = current.segments?.some((segment) => segment.key === 'adjective') ? 'adjective' : 'verb'
  const currentText = current.segments?.find((segment) => segment.key === (slot === 'ending' ? endingAnchor : slot))?.text
  // A slot's seeded pick is only reproducible if the candidate pool it was
  // drawn from stays the same shape on every later call — and avoidWords
  // filters that pool. Once a slot is locked in via slotSeeds, the avoidWords
  // entry that was in effect when it was picked has to keep being passed on
  // every subsequent rotation too, or a later call regenerates that "locked"
  // slot against a differently-shaped pool and silently drifts to a new word.
  const nextAvoidWords = currentText ? { ...avoidWords, [slot]: currentText } : avoidWords
  const candidates: Array<{ seed: number; frame: HeroSentenceFrame }> = []
  for (let attempt = 1; attempt <= ROTATION_ATTEMPTS_PER_SLOT; attempt++) {
    const candidateSeed = baseSeed + 17 + salt * 11 + attempt
    let candidate: GeneratedPreviewSentence | null = null
    try {
      candidate = generateCategorySentence(baseSeed, patternId, level, {
        slotSeeds: { ...slotSeeds, [slot]: candidateSeed },
        avoidWords: Object.keys(nextAvoidWords).length ? nextAvoidWords : undefined,
      })
    } catch {
      continue
    }
    if (!candidate?.japanese || !isDashboardSentenceNatural(candidate)) continue
    const frame = categoryFrameFor(candidate)
    if (!isSingleSlotNeighbor(current, frame)) continue
    // The two-ending cluster (see buildDatabaseHeroSteps) can otherwise swing
    // the second rotation straight back to the form shown before the first —
    // べきです -> べきではありません -> べきです — since each call only avoids
    // the single form it's replacing. extraAvoidTexts carries that earlier
    // form forward so the second rotation is forced to a genuinely new one.
    if (slot === 'ending') {
      const candidateText = frame.segments?.find((segment) => segment.key === endingAnchor)?.text
      if (candidateText && extraAvoidTexts.includes(candidateText)) continue
    }
    candidates.push({ seed: candidateSeed, frame })
  }
  // A real word swap prefers the least jarring width change, so nearest-length
  // wins there. The 'ending' slot has no such visual reason to prefer one
  // form over another — sorting it by length delta would make same-length
  // forms (masu/nai, both plain-length) permanently out-compete the rest
  // (masendeshita, ta, nakatta), since every attempt regenerates all 8 forms
  // and the shortest-delta one always wins. Take it in attempt order instead
  // so every conjugation gets a fair turn.
  const best = slot === 'ending'
    ? candidates[0]
    : candidates.sort((a, b) => replacementLengthDelta(current, a.frame) - replacementLengthDelta(current, b.frame))[0]
  return best ? { ...best, avoidWords: nextAvoidWords } : null
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
function buildDatabaseHeroSteps(level: JlptLevel, sequenceSeed: number, stepCount: number, focus?: HeroSwapFocus, favouriteWords: ReadonlySet<string> = new Set()): HeroStep[] {
  const patterns = patternsForLevel(level)
  if (!patterns.length) return []

  const start = Math.abs(sequenceSeed) % patterns.length
  const stride = patternStride(patterns.length)
  const steps: HeroStep[] = []
  const tracker = new SentenceDiversityTracker()
  let pendingFormVariants: GeneratedPreviewSentence[] = []
  // Alternates every sentence: left-to-right, then right-to-left, then back —
  // seeded off the stream's own seed so two streams don't all start the same
  // direction, but stable within one stream (no Math.random mid-render).
  let sweepForward = Math.abs(sequenceSeed) % 2 === 0

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
    const pool = linkedFormCandidates.length ? linkedFormCandidates : ordinaryCandidates
    // Starred words bias the choice rather than dictating it: candidates using
    // one are preferred when this seed produced any, and the normal pool is
    // used otherwise. Filtering outright would blank whole grammar patterns
    // that no favourite happens to fit.
    const favouringCandidates = favouriteWords.size
      ? pool.filter((candidate) => [...favouriteWords].some((word) => candidate.japanese.includes(word)))
      : []
    const sentence = selectMostDiverse(favouringCandidates.length ? favouringCandidates : pool, tracker)
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

    // Sweep every visible slot in reading order — left to right, then right to
    // left on the next sentence — rather than picking slots at random. This is
    // what stops any one slot (subject, with its oversized pool) from
    // dominating: every slot gets exactly one turn per pass, in the position
    // it actually sits in the sentence. The sentence's final predicate — a
    // verb, or an adjective+copula predicate for verbless patterns like
    // n5-17's Xが好きです — gets a 3-step cluster of its own — a word swap
    // plus two ending toggles — since it's both a normal rotatable slot and
    // the seat of tense/polarity/register.
    const positionalSlots = orderedSwappableSlotKeys(sentence)
    const predicateSlot = positionalSlots.includes('verb') ? 'verb' : positionalSlots.includes('adjective') ? 'adjective' : null
    const otherSlots = predicateSlot ? positionalSlots.filter((slot) => slot !== predicateSlot) : positionalSlots
    const predicateCluster = predicateSlot ? [predicateSlot, 'ending', 'ending'] : []
    // Forward reaches the predicate (sentence-final in Japanese) last, so its
    // cluster leads with the word swap, then the two endings. Reversed reaches
    // it first, so the endings come before the word swap — the mirror image.
    const focusedQueue = focus ? focusedSweepQueue(sentence, focus) : undefined
    // A sentence that cannot serve the focus is dropped rather than shown
    // without rotations — the pattern walk moves on to one that can.
    if (focus && !focusedQueue) {
      steps.pop()
      continue
    }
    const sweepQueue = focusedQueue ?? (sweepForward
      ? [...otherSlots, ...predicateCluster]
      : [...predicateCluster.slice().reverse(), ...otherSlots.slice().reverse()])
    sweepForward = !sweepForward

    const baseSeed = seedBySentence.get(sentence)
    let slotSeeds: Record<string, number> = {}
    let avoidWords: Record<string, string> = {}
    const endingHistory: string[] = []
    for (let position = 0; baseSeed !== undefined && position < sweepQueue.length && steps.length < stepCount; position++) {
      const slot = sweepQueue[position]!
      if (slot === 'ending') {
        const endingAnchor = current.segments?.some((segment) => segment.key === 'adjective') ? 'adjective' : 'verb'
        const anchorText = current.segments?.find((segment) => segment.key === endingAnchor)?.text
        if (anchorText && !endingHistory.includes(anchorText)) endingHistory.push(anchorText)
      }
      const next = rotateOneSlot(level, sentence.frameId, baseSeed, current, slotSeeds, avoidWords, slot, position, endingHistory)
      if (!next) continue
      slotSeeds = { ...slotSeeds, [slot]: next.seed }
      avoidWords = next.avoidWords
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
  focus?: HeroSwapFocus,
  favouriteWords: ReadonlySet<string> = new Set(),
): HeroStep[] {
  // The favourites belong in the cache key: the same level and seed produce a
  // different stream once a word is starred, and a stale hit would silently
  // ignore the new favourite.
  const favouriteKey = favouriteWords.size ? [...favouriteWords].sort().join(',') : 'none'
  const cacheKey = `${level}:${sequenceSeed}:${stepCount}:${focus ?? 'sweep'}:${favouriteKey}`
  const cached = STEPS_CACHE.get(cacheKey)
  if (cached) return cached

  const steps = buildDatabaseHeroSteps(level, sequenceSeed, stepCount, focus, favouriteWords)
  STEPS_CACHE.set(cacheKey, steps)
  return steps
}

/** Kept for the Content Studio audit action. */
export function auditPosSteps(level: JlptLevel): number {
  return buildHeroSteps({} as WrongPool, {}, level)
    .filter((step) => !(step.frame.segments?.map((segment) => segment.text).join('')))
    .length
}
