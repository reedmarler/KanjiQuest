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
  let particleCount = 0
  return {
    generatedEnglish: sentence.english,
    generatedReading: sentence.reading,
    generatedPatternId: `category-${sentence.frameId}`,
    segments: sentence.furigana.map((part, index) => {
      if (!part.slot) {
        // A case particle is the one literal the drill rotates, so it needs a
        // key that survives the swap and a `swappable` flag — the segment diff
        // ignores inert literals, which is why nothing could move a particle
        // before. Every other literal stays inert.
        if (CASE_PARTICLES.has(part.text.trim())) {
          const occurrence = (particleCount += 1)
          return { key: `particle-${occurrence}`, text: part.text, reading: part.reading, swappable: true }
        }
        return { key: `lit-${index}`, text: part.text, reading: part.reading, swappable: false }
      }
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
export type HeroSwapFocus = 'verb' | 'noun' | 'adjective' | 'adverb' | 'auxiliary' | 'particle'

/** How many rotations a focused sentence gets before the stream moves on. */
const FOCUS_ROTATIONS = 5

/**
 * Whether this sentence's predicate carries a grammar auxiliary rather than a
 * plain conjugation.
 *
 * Both cases rotate the same `ending` slot, but they are different drills. On
 * an N5 pattern the ending walks the bare verb's own inflections — 着ます,
 * 着ました, 着ません, 着ない, 着た — and the generator marks it with an
 * inflection name. On a pattern built around an auxiliary the ending walks
 * that auxiliary instead — 預けたいです, 預けたくないです, 預けたかったです —
 * and the generator marks it with the pattern's own id, because the form
 * belongs to the pattern. That marker is the split.
 */
function hasGrammarAuxiliary(sentence: GeneratedPreviewSentence): boolean {
  const ending = sentence.slots['ending']
  return Boolean(ending && ending.pos === 'verb' && ending.conjugation === sentence.frameId)
}

/** True when the sentence shows a case particle of its own, between slots. */
function particleSegments(sentence: GeneratedPreviewSentence): string[] {
  return sentence.furigana
    .filter((part) => !part.slot && CASE_PARTICLES.has(part.text.trim()))
    .map((part) => part.text.trim())
}

/**
 * The particles the drill contrasts. Deliberately the case markers only: these
 * are the ones whose choice changes what a noun is doing in the sentence,
 * which is the thing being practised.
 */
const CASE_PARTICLES = new Set(['は', 'が', 'を', 'に', 'で', 'へ', 'と', 'から', 'まで', 'より', 'の'])

/**
 * Whether the generator marked this slot as holding an adjective.
 *
 * Frames do not agree on a name for the slot their description sits in:
 * `adjective` at N5, `ending` where the whole predicate is one segment
 * (大切でした), `predicate` across the N3 comparison and quotation frames
 * (孫より早いです, 忙しいと思います), `reason` in the N2 concessions
 * (安いとはいえ). What they do agree on is the part of speech they record, so
 * the drill asks that, the same way `hasGrammarAuxiliary` reads the verb case,
 * rather than keeping names or pattern ids by hand. A hand-kept list drifts,
 * and did: it named n4-33, whose ending rotates 大切でした -> 短い時代でした —
 * a whole noun predicate swapped, which is the noun drill's business — while
 * leaving out the frames that genuinely inflect a な-adjective.
 *
 * It is also what keeps the noun drill off these slots, since `predicate` and
 * `reason` are otherwise exactly the shape of slot nouns rotate.
 */
function isAdjectivalSlot(sentence: GeneratedPreviewSentence, slot: string): boolean {
  const record = sentence.slots[slot]
  return record?.pos === 'i_adjective' || record?.pos === 'na_adjective'
}

/**
 * Which slots a focus rotates, in the order it rotates them. Empty means the
 * sentence cannot serve the focus and the stream should move to another
 * pattern; a focus that deliberately does not rotate (particles, below) is
 * asked about through `focusRotatesInPlace` instead.
 */
export const HERO_FOCUS_SLOTS: Record<HeroSwapFocus, string> = {
  noun: 'every slot that is not the predicate or its ending',
  verb: 'ending, on patterns whose ending is a plain verb conjugation',
  adjective: 'every slot the generator marked as an adjective, and the ending of an adjective predicate',
  adverb: 'manner, degree, and sequence adverbials',
  auxiliary: 'ending, on patterns built around a grammar auxiliary',
  particle: 'each particle that genuinely alternates on its own noun, then that noun',
}

/**
 * The levels where a focus has patterns to run on at all.
 *
 * These are not preferences — they are what the generator can currently do,
 * measured by `npm run audit:hero-focus`, which fails if this table drifts
 * from what it finds. They matter because a focus with no serving pattern
 * produces an empty stream, and an empty stream is a blank hero: the drill
 * has to be closed off at those levels rather than offered and broken.
 *
 * Plain verb conjugation only exists at N5 because every pattern above it wraps
 * the predicate in a grammar form, and that form is what the auxiliary drill
 * rotates instead — and since every level above N5 is built that way, the
 * auxiliary drill runs on all four of them. Adjectives run everywhere: the N3
 * comparison and quotation frames and the N2 concessions all describe with
 * one, and n1-14 (〜に越したことはない) was written for the top of the range,
 * where every other pattern governs a noun or a whole clause.
 * Degree adverbs also have reviewed N4 frames, sequence adverbials deepen the
 * N5 adverb pool, and the two N3 frames that fix a single action carry a
 * manner one.
 */
export const HERO_FOCUS_LEVELS: Record<HeroSwapFocus, readonly JlptLevel[]> = {
  noun: ['N5', 'N4', 'N3', 'N2', 'N1'],
  particle: ['N5', 'N4', 'N3', 'N2', 'N1'],
  verb: ['N5'],
  auxiliary: ['N4', 'N3', 'N2', 'N1'],
  adjective: ['N5', 'N4', 'N3', 'N2', 'N1'],
  adverb: ['N5', 'N4', 'N3'],
}

export function focusAvailableAt(focus: HeroSwapFocus, level: JlptLevel): boolean {
  return HERO_FOCUS_LEVELS[focus].includes(level)
}

/**
 * Every focus rotates inside a held sentence now.
 *
 * Particles were the exception: most of them are fixed by the predicate, so
 * the drill contrasted across sentences instead. It still does that, but only
 * after working the swaps a sentence genuinely allows — see
 * PARTICLE_ALTERNATIVES.
 */
export function focusRotatesInPlace(_focus: HeroSwapFocus): boolean {
  return true
}

/**
 * The slots a focus would rotate on this sentence, empty when it cannot serve
 * the focus at all. Exported for the depth audit, which needs the same answer
 * the stream builder gets.
 */
export function focusSlotsFor(sentence: GeneratedPreviewSentence, focus: HeroSwapFocus): string[] {
  const slots = orderedSwappableSlotKeys(sentence)
  if (focus === 'verb') {
    // Endings only. The verb itself stays put so the conjugation is the one
    // thing changing, which is the whole point of the drill. Patterns whose
    // ending is an auxiliary belong to that drill instead, or the two modes
    // would be the same mode on the same sentences. The ending slot has to
    // exist: several N4 patterns bake the form into the verb and expose no
    // ending, so asking to rotate one there yields a sentence that never
    // moves — a drill in name only.
    if (!slots.includes('verb') || !sentence.slots['ending'] || hasGrammarAuxiliary(sentence)) return []
    return ['ending']
  }
  if (focus === 'auxiliary') {
    // ～たい, ～ている, ～てもいい, ～なければならない, ～べき: the pattern
    // supplies the auxiliary and the ending slot inflects it.
    if (!hasGrammarAuxiliary(sentence)) return []
    return ['ending']
  }
  if (focus === 'adjective') {
    // Alternate the adjective and its ending: 面白いです → 新しいです →
    // 新しくないです. Both halves of an adjective predicate get practised.
    // `ending` is a synthetic key on these frames — it has no segment of its
    // own, and rotateOneSlot resolves it against the predicate — so it is
    // named here rather than found by the scan below.
    if (slots.includes('adjective')) return ['adjective', 'ending']
    return slots.filter((slot) => isAdjectivalSlot(sentence, slot))
  }
  if (focus === 'adverb') {
    if (slots.includes('adverb')) return ['adverb']
    if (slots.includes('sequence')) return ['sequence']
    return []
  }
  // Particles rotate nothing; `focusServes` is what answers for them.
  if (focus === 'particle') return []
  // Nouns: every slot that is not the predicate or its ending.
  return slots.filter((slot) => slot !== 'verb' && slot !== 'adjective' && slot !== 'ending' && slot !== 'adverb'
    && !isAdjectivalSlot(sentence, slot))
}

/** Whether this sentence can carry the focus at all. */
export function focusServes(sentence: GeneratedPreviewSentence, focus: HeroSwapFocus): boolean {
  if (focus === 'particle') return particleSegments(sentence).length > 0
  return focusSlotsFor(sentence, focus).length > 0
}

/** The case particles this sentence shows, for the contrast stream and audit. */
export function particlesIn(sentence: GeneratedPreviewSentence): string[] {
  return particleSegments(sentence)
}

/**
 * The particle swaps that are actually Japanese.
 *
 * Which particle a noun takes is mostly decided by the predicate — 山に登る but
 * 高校で飲む — so most of them cannot be swapped at all, and that is why this
 * drill used to contrast across sentences instead of rotating one. But some
 * genuinely alternate on the same noun in the same sentence, and those are the
 * ones worth practising, because choosing between them is a real decision a
 * learner makes:
 *
 *   は ⟷ が   on a subject: topic versus the thing being singled out
 *   を ⟷ は   on an object: stated plainly, or raised to the topic
 *   に ⟷ へ   on a destination: arrival versus direction
 *
 * The role gate is what keeps this honest. に marks a destination in 山に登る
 * and a time in 七時に起きる, and only the first can become へ — so an
 * alternative applies only after the slots it is licensed for, read off the
 * segment the particle follows.
 *
 * English is deliberately left alone across these. The difference は/が draws
 * is information structure, which English marks with a cleft or with stress
 * rather than with words, and を/は and に/へ are the same kind of shift; the
 * renderer already leaves the gloss untouched when it does not change, the way
 * it does for a polite ⟷ plain swap.
 */
const PARTICLE_ALTERNATIVES: ReadonlyArray<{ from: string; to: string; roles: ReadonlySet<string> }> = [
  { from: 'は', to: 'が', roles: new Set(['subject', 'topic']) },
  { from: 'が', to: 'は', roles: new Set(['subject', 'topic']) },
  { from: 'を', to: 'は', roles: new Set(['object']) },
  { from: 'に', to: 'へ', roles: new Set(['destination']) },
  { from: 'へ', to: 'に', roles: new Set(['destination']) },
]

/** A segment key without its occurrence suffix: `object-2` is still an object. */
function segmentRole(key: string): string {
  return key.replace(/-\d+$/, '')
}

/**
 * The particle swaps this frame can make, in reading order, each one a single
 * segment's worth of change.
 */
function particleRotationsFor(frame: HeroSentenceFrame): Array<{ key: string; from: string; to: string }> {
  const segments = frame.segments ?? []
  const rotations: Array<{ key: string; from: string; to: string }> = []
  segments.forEach((segment, index) => {
    if (!segment.key.startsWith('particle-')) return
    const role = segmentRole(segments[index - 1]?.key ?? '')
    const current = segment.text.trim()
    for (const alternative of PARTICLE_ALTERNATIVES) {
      if (alternative.from !== current || !alternative.roles.has(role)) continue
      // A clause takes one topic. 夫婦は新聞は読みます is two, so raising an
      // object to the topic is only available once the subject has moved off
      // は — which is exactly what the preceding rotation does, so the two
      // swaps chain rather than collide.
      const topicElsewhere = segments.some((other) => other !== segment
        && other.key.startsWith('particle-') && other.text.trim() === 'は')
      if (alternative.to === 'は' && topicElsewhere) continue
      rotations.push({ key: segment.key, from: alternative.from, to: alternative.to })
    }
  })
  return rotations
}

/**
 * The swaps this sentence walks, in order — each one segment's worth of change,
 * each particle segment getting one turn. Recomputed after every step because
 * an earlier swap can license a later one: raising an object to the topic only
 * becomes available once the subject has moved off は.
 */
function particleRotationWalk(frame: HeroSentenceFrame): Array<{ key: string; to: string; frame: HeroSentenceFrame }> {
  const walk: Array<{ key: string; to: string; frame: HeroSentenceFrame }> = []
  const rotated = new Set<string>()
  let current = frame
  for (;;) {
    const rotation = particleRotationsFor(current).find((candidate) => !rotated.has(candidate.key))
    if (!rotation) break
    rotated.add(rotation.key)
    current = withParticle(current, rotation.key, rotation.to)
    walk.push({ key: rotation.key, to: rotation.to, frame: current })
  }
  return walk
}

/**
 * Every marker this sentence can put on screen: the ones it already shows plus
 * the ones its swaps reach. Exported for the depth audit, which needs the same
 * answer the stream gets.
 */
export function particlesReachable(sentence: GeneratedPreviewSentence): string[] {
  const reached = new Set(particlesIn(sentence))
  for (const step of particleRotationWalk(categoryFrameFor(sentence))) reached.add(step.to)
  return [...reached]
}

/**
 * The word a rotated particle attaches to — the one whose swap the particle
 * drill follows its rotations with. The particle sits after its noun, so the
 * segment before the first one rotated is that noun.
 */
function anchorSlotForParticles(frame: HeroSentenceFrame, rotated: ReadonlySet<string>): string | null {
  const segments = frame.segments ?? []
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!
    if (!rotated.has(segment.key)) continue
    const preceding = segments[index - 1]
    if (preceding?.swappable) return preceding.key
  }
  return null
}

/** The same frame with one particle segment replaced. */
function withParticle(frame: HeroSentenceFrame, key: string, particle: string): HeroSentenceFrame {
  const segments = (frame.segments ?? []).map((segment) => segment.key === key
    ? { ...segment, text: particle, reading: particle }
    : segment)
  return {
    ...frame,
    segments,
    generatedReading: segments.map((segment) => segment.reading || segment.text).join(''),
  }
}

/**
 * The sweep queue for a focused sentence, or null when this sentence cannot
 * serve the focus at all — a verbless pattern under a verb drill. Returning
 * null lets the caller skip to the next pattern instead of emitting a sentence
 * the learner cannot practise on.
 */
function focusedSweepQueue(sentence: GeneratedPreviewSentence, focus: HeroSwapFocus): string[] | null {
  /*
   * Particles do not sweep slots the way the other focuses do: they are
   * literals the pattern owns, so the stream builder rewrites them directly
   * (see PARTICLE_ALTERNATIVES) rather than re-seeding a slot. An empty queue
   * here says "this sentence serves the focus, but not through the sweep".
   */
  if (focus === 'particle') return particleSegments(sentence).length ? [] : null

  const slots = focusSlotsFor(sentence, focus)
  if (!slots.length) return null
  return Array.from({ length: FOCUS_ROTATIONS }, (_, index) => slots[index % slots.length]!)
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
  const endingAnchor = current.segments?.some((segment) => segment.key === 'adjective')
    ? 'adjective'
    : current.segments?.some((segment) => segment.key === 'verb') ? 'verb' : 'ending'
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
  /** Particles shown by the previous step, so the next one can differ. */
  let lastParticles = new Set<string>()
  /** Whole-stream usage keeps the particle drill moving through its complete
   *  marker pool rather than bouncing between two locally fresh choices. */
  const particleUsage = new Map<string, number>()

  // Each pass appends a base sentence plus however many rotations that sentence
  // supports, so the bound is on emitted steps rather than on passes.
  for (let index = 0; steps.length < stepCount; index++) {
    // A coprime stride walks through every available pattern before repeating.
    const pattern = patterns[(start + index * stride) % patterns.length]!
    /*
     * A level whose patterns all fail to generate would otherwise spin forever
     * now that the loop counts steps instead of passes. The bound has to clear
     * the whole pattern list as well as the step budget: the stride is coprime,
     * so every pattern is reached within `patterns.length` passes, and a focus
     * that only one pattern serves — adverbs, on n5-09 — was starved at small
     * step counts, which is exactly what the hero's two-step first build asks
     * for. It came back empty, and an empty stream is a blank hero. Three laps
     * rather than one, because each lap re-enters a pattern on fresh seeds:
     * the one adverb pattern can fail to rotate on a given seed, and with a
     * single lap that failure was the whole stream.
     */
    if (index >= Math.max(stepCount * 4, patterns.length * 3)) break
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
    /*
     * The particle drill is a contrast rather than a swap, so its variety has
     * to come from which sentence is chosen. Prefer a candidate showing a
     * particle the last step did not, and fall back to any that shows one at
     * all rather than blanking the step.
     */
    let biasedPool = favouringCandidates.length ? favouringCandidates : pool
    if (focus === 'particle') {
      const carrying = biasedPool.filter((candidate) => particlesIn(candidate).length)
      const fresh = carrying.filter((candidate) => particlesIn(candidate).some((particle) => !lastParticles.has(particle)))
      const contrastPool = fresh.length ? fresh : carrying
      const usageScore = (candidate: GeneratedPreviewSentence) => particlesIn(candidate)
        .reduce((score, particle) => score + (particleUsage.get(particle) ?? 0), 0)
      const lowestUsage = Math.min(...contrastPool.map(usageScore))
      biasedPool = contrastPool.filter((candidate) => usageScore(candidate) === lowestUsage)
    } else if (focus) {
      // A pattern can generate both focused and unfocused variants (n4-30 may
      // omit its optional degree adverb). Choose from serving candidates here,
      // before diversity selection, so the selected sentence cannot silently
      // fall back to the ordinary all-slot sweep under a Grammar label.
      biasedPool = biasedPool.filter((candidate) => focusServes(candidate, focus))
    }
    const sentence = selectMostDiverse(biasedPool, tracker)
    if (!sentence) continue
    if (focus === 'particle') {
      lastParticles = new Set(particlesIn(sentence))
      lastParticles.forEach((particle) => particleUsage.set(particle, (particleUsage.get(particle) ?? 0) + 1))
      // Once every marker has had a turn the list has been walked, so it
      // starts again rather than letting the first cycle's counts pin the
      // stream to whichever markers happened to come up least.
      if (CASE_PARTICLES.size === particleUsage.size) particleUsage.clear()
    }
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

    /*
     * The particle drill holds the sentence and works the particles it can
     * genuinely alternate, one at a time, before the stream moves on. Each
     * swap applies to the sentence as the last one left it, so a sentence with
     * both a subject and an object marker walks both without ever changing two
     * things at once.
     *
     * These frames are built here rather than through rotateOneSlot: that
     * re-runs the generator with a new seed, and a particle is a literal the
     * pattern owns, not a slot the generator fills. Rewriting the segment is
     * the only way to hold every word still and move the particle alone —
     * which is the whole drill.
     */
    if (focus === 'particle') {
      const baseFrame = current
      const rotated = new Set<string>()
      const swapped = new Map<string, string>()
      for (const rotation of particleRotationWalk(baseFrame)) {
        if (steps.length >= stepCount) break
        rotated.add(rotation.key)
        swapped.set(rotation.key, rotation.to)
        steps.push({
          frame: rotation.frame,
          changed: changedSegmentKeys(current, rotation.frame),
          slotWidths: HERO_SLOT_WIDTHS,
          templateRefresh: false,
        })
        current = rotation.frame
      }
      /*
       * With the particles spent, the word they attach to is what is worth
       * changing next — the same marker on a new noun is a second look at the
       * same decision, and it keeps the sentence otherwise still rather than
       * jumping straight to an unrelated one.
       *
       * The swap is generated against the frame as it stood before any
       * particle moved, because the generator only knows the pattern's own
       * particles; the rotations are then re-applied on top, which is what
       * leaves the noun as the single thing that changed.
       */
      const anchorSlot = anchorSlotForParticles(baseFrame, rotated)
      const particleSeed = seedBySentence.get(sentence)
      if (steps.length < stepCount && particleSeed !== undefined && anchorSlot) {
        const swap = rotateOneSlot(level, sentence.frameId, particleSeed, baseFrame, {}, {}, anchorSlot, 97)
        if (swap) {
          const next = swapped.size
            ? [...swapped].reduce((frame, [key, particle]) => withParticle(frame, key, particle), swap.frame)
            : swap.frame
          const changed = changedSegmentKeys(current, next)
          if (changed.length === 1) {
            steps.push({ frame: next, changed, slotWidths: HERO_SLOT_WIDTHS, templateRefresh: false })
            current = next
          }
        }
      }
      continue
    }

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
    let rotations = 0
    const endingHistory: string[] = []
    for (let position = 0; baseSeed !== undefined && position < sweepQueue.length && steps.length < stepCount; position++) {
      const slot = sweepQueue[position]!
      if (slot === 'ending') {
        const endingAnchor = current.segments?.some((segment) => segment.key === 'adjective')
          ? 'adjective'
          : current.segments?.some((segment) => segment.key === 'verb') ? 'verb' : 'ending'
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
      rotations += 1
      current = next.frame
    }
    /*
     * A focused sentence that produced no rotation is a still frame wearing a
     * drill's name: the slot was there but every candidate for it failed the
     * naturalness or single-slot check. Drop it and let the walk find a
     * sentence that can actually be worked. Particles are exempt — that drill
     * is the sentence changing, so it has no rotations by design.
     */
    if (focus && rotations === 0) steps.pop()
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

  /*
   * A focus that no pattern at this level can serve builds nothing, and an
   * empty stream does not just look blank — the hero stops there. It only
   * auto-advances with two steps or more, so it never reaches the rollover
   * that would carry it to the next level, and the blank is permanent.
   *
   * The dashboard already closes a focus off at levels it cannot serve, but
   * the two can disagree for a moment: raising the difficulty switches the
   * requested level immediately while the hero keeps showing the old one until
   * its replacement stream is ready. Falling back to the ordinary sweep means
   * the worst case in that moment is a drill that has not started yet, rather
   * than a dashboard with nothing on it.
   */
  const focused = buildDatabaseHeroSteps(level, sequenceSeed, stepCount, focus, favouriteWords)
  const steps = focus && !focused.length
    ? buildDatabaseHeroSteps(level, sequenceSeed, stepCount, undefined, favouriteWords)
    : focused
  STEPS_CACHE.set(cacheKey, steps)
  return steps
}

/** Kept for the Content Studio audit action. */
export function auditPosSteps(level: JlptLevel): number {
  return buildHeroSteps({} as WrongPool, {}, level)
    .filter((step) => !(step.frame.segments?.map((segment) => segment.text).join('')))
    .length
}
