import { HERO_POS_VOCABULARY, HERO_WORD_POS_INDEX } from '../data/heroPosVocabulary'
import { HERO_SUBJECTS } from '../data/heroSentences'
import type { HeroSentenceFrame, HeroSlot } from '../data/heroSentences'
import { frameToJapanese } from './heroSentenceNatural'
import {
  swapJapaneseSentence,
  type PosCategory,
  type PosVocabulary,
} from './japanesePos'

const SIMPLE_ADVERB_MODIFIERS = new Set([
  '毎日', 'よく', '時々', 'とても', '一緒に', '週末', '午後', '今朝', '今晩',
  '最近は', 'もうすぐ', '今から',
])

const PRONOUN_SUBJECTS = new Set(['私', '彼', '彼女', 'みんな'])

/** POS category for a known surface form */
export function getHeroWordPos(word: string): PosCategory | null {
  const pos = HERO_WORD_POS_INDEX[word]
  if (
    pos === 'noun'
    || pos === 'verb'
    || pos === 'i_adj'
    || pos === 'na_adj'
    || pos === 'adverb'
    || pos === 'pronoun'
  ) {
    return pos
  }
  return null
}

/** Which POS category a hero slot represents when swapping */
export function heroSlotPosCategory(
  slot: HeroSlot,
  frame: HeroSentenceFrame,
): PosCategory | null {
  switch (slot) {
    case 'subject':
      return PRONOUN_SUBJECTS.has(frame.subject) ? 'pronoun' : 'noun'
    case 'word':
      return getHeroWordPos(frame.word) ?? 'noun'
    case 'modifier':
      if (!frame.modifier || !SIMPLE_ADVERB_MODIFIERS.has(frame.modifier)) return null
      return getHeroWordPos(frame.modifier) ?? 'adverb'
    case 'predicate': {
      const stem = frame.predicate.replace(/(です|だ|ます|ません|ました|ませんでした|たいです?)$/u, '')
      return getHeroWordPos(stem) ?? getHeroWordPos(frame.predicate) ?? 'verb'
    }
    default:
      return null
  }
}

/** Whether a candidate can replace the current word in this slot (same POS) */
export function posCompatibleWithSlot(
  candidate: string,
  current: string,
  slot: HeroSlot,
  frame: HeroSentenceFrame,
): boolean {
  const required = heroSlotPosCategory(slot, { ...frame, [slot]: current })
  if (!required) return true

  const candidatePos = getHeroWordPos(candidate)
  if (!candidatePos) return slot !== 'subject'

  return candidatePos === required
}

/** POS-filtered pool for a hero slot */
export function filterByPos(
  pool: string[],
  current: string,
  slot: HeroSlot,
  frame: HeroSentenceFrame,
): string[] {
  const filtered = pool.filter((w) =>
    posCompatibleWithSlot(w, current, slot, frame),
  )
  if (filtered.length > 0) return filtered
  if (slot === 'subject') return [current]
  return pool
}

/** Pick a POS-compatible replacement from the hero vocabulary lists */
export function pickPosReplacement(
  current: string,
  category: PosCategory,
  seed: number,
  vocabulary: PosVocabulary = HERO_POS_VOCABULARY,
): string | null {
  const pool = vocabulary[category]
  if (!pool || pool.length === 0) return null

  const others = pool.filter((w) => w !== current)
  if (others.length === 0) return null

  return others[Math.abs(seed) % others.length]
}

/** Generate a new sentence by POS-swapping tokens in a frame's Japanese output */
export function swapHeroFrameSentence(
  frame: HeroSentenceFrame,
  seed = 0,
  categories?: PosCategory[],
) {
  const sentence = frameToJapanese(frame)
  return swapJapaneseSentence(
    sentence,
    HERO_POS_VOCABULARY,
    { wordPosIndex: HERO_WORD_POS_INDEX },
    { seed, categories },
  )
}

/** Simple adverb modifiers — POS-filtered; te-form phrases use alternate tables only */
export function posCompatibleModifier(candidate: string, current: string): boolean {
  const simple = SIMPLE_ADVERB_MODIFIERS.has(current) || SIMPLE_ADVERB_MODIFIERS.has(candidate)
  if (!simple) return true

  const currentPos = getHeroWordPos(current) ?? 'adverb'
  const candidatePos = getHeroWordPos(candidate) ?? 'adverb'
  return currentPos === candidatePos
}

/** Subject pool restricted to same POS (pronoun↔pronoun, noun-like↔noun-like) */
export function posFilteredSubjects(current: string, seed: number): string {
  const currentPos = getHeroWordPos(current) ?? (PRONOUN_SUBJECTS.has(current) ? 'pronoun' : 'noun')
  const pool = HERO_SUBJECTS.filter((s) => {
    const pos = getHeroWordPos(s) ?? (PRONOUN_SUBJECTS.has(s) ? 'pronoun' : 'noun')
    return pos === currentPos
  })
  const others = pool.filter((s) => s !== current)
  if (others.length === 0) return current
  return others[Math.abs(seed) % others.length]
}
