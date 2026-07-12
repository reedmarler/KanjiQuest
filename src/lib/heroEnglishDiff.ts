import type { HeroSentenceFrame, HeroSlot } from '../data/heroSentences'
import { heroTopicLabel } from './heroCollocations'
import { formatHeroEnglishObject } from './heroWordFit'
import { heroEnglishSlotWidthUnits } from './heroEnglishSlotWidth'

export interface EnglishWordDiff {
  before: string
  prevWord: string
  nextWord: string
  after: string
}

const ALSO_MARKER = ' also'

function englishSwapWordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/** Max words in a partial English swap span — short gloss phrases only */
const ENGLISH_PARTIAL_MAX_WORDS = 4

/** Slots whose English gloss can swap a single inline span */
export const ENGLISH_PARTIAL_SLOTS: HeroSlot[] = [
  'word',
  'topicParticle',
  'objectParticle',
  'predicate',
  'modifier',
]

export function isMinimalEnglishSlotChange(
  changingSlots: HeroSlot[],
  frame: HeroSentenceFrame,
  prevFrame: HeroSentenceFrame,
): HeroSlot | null {
  const actual = changingSlots.filter((slot) => frame[slot] !== prevFrame[slot])
  if (actual.length !== 1) return null

  const slot = actual[0]
  if (slot === 'word') return 'word'

  if (slot === 'topicParticle' && frame.subject) {
    const particles = new Set([prevFrame.topicParticle, frame.topicParticle])
    if (particles.has('は') && particles.has('も')) return 'topicParticle'
  }

  if (slot === 'objectParticle' && !frame.subject && !prevFrame.subject) {
    const particles = new Set([prevFrame.objectParticle, frame.objectParticle])
    if (particles.has('は') && particles.has('も')) return 'objectParticle'
  }

  if (slot === 'predicate') return 'predicate'

  if (slot === 'modifier') return 'modifier'

  return null
}

function rebuildPartialEnglish(diff: EnglishWordDiff, useNext: boolean): string {
  const word = useNext ? diff.nextWord : diff.prevWord
  if (isEnglishAlsoDiff(diff)) {
    return diff.before + englishAlsoSlotText(word) + diff.after
  }
  return diff.before + word + diff.after
}

/** は↔も — English only inserts/removes "also" */
export function diffEnglishAlsoSwap(prev: string, next: string): EnglishWordDiff | null {
  if (!prev || !next || prev === next) return null

  if (next.includes(ALSO_MARKER) && !prev.includes(ALSO_MARKER)) {
    const at = next.indexOf(ALSO_MARKER)
    const rebuilt = next.slice(0, at) + next.slice(at + ALSO_MARKER.length)
    if (rebuilt !== prev) return null
    return {
      before: next.slice(0, at),
      prevWord: '',
      nextWord: 'also',
      after: next.slice(at + ALSO_MARKER.length),
    }
  }

  if (prev.includes(ALSO_MARKER) && !next.includes(ALSO_MARKER)) {
    const at = prev.indexOf(ALSO_MARKER)
    const rebuilt = prev.slice(0, at) + prev.slice(at + ALSO_MARKER.length)
    if (rebuilt !== next) return null
    return {
      before: prev.slice(0, at),
      prevWord: 'also',
      nextWord: '',
      after: prev.slice(at + ALSO_MARKER.length),
    }
  }

  return null
}

function heroWordGlossCandidates(
  frame: HeroSentenceFrame,
  english: string,
): string[] {
  const candidates = new Set<string>()
  const topic = heroTopicLabel(frame.word)
  if (topic) {
    candidates.add(topic.label)
    if (english.includes(topic.label.toLowerCase())) {
      candidates.add(topic.label.toLowerCase())
    }
  }

  const base = formatHeroEnglishObject(frame)
  if (!base) return [...candidates]

  candidates.add(base)
  if (base !== base.toLowerCase()) candidates.add(base.toLowerCase())

  for (const prefix of ['to ', 'a ', 'the ', 'my ']) {
    const phrase = `${prefix}${base}`
    if (english.includes(phrase)) candidates.add(phrase)
  }

  return [...candidates]
}

export function diffEnglishPhraseSwap(
  prevEnglish: string,
  english: string,
  prevPhrases: string[],
  nextPhrases: string[],
): EnglishWordDiff | null {
  for (const prevWord of prevPhrases) {
    for (const nextWord of nextPhrases) {
      if (prevWord === nextWord) continue

      let searchFrom = 0
      while (searchFrom <= prevEnglish.length) {
        const idx = prevEnglish.indexOf(prevWord, searchFrom)
        if (idx < 0) break
        const before = prevEnglish.slice(0, idx)
        const after = prevEnglish.slice(idx + prevWord.length)
        if (before + nextWord + after === english) {
          return { before, prevWord, nextWord, after }
        }
        searchFrom = idx + 1
      }
    }
  }

  return null
}

/** Locate the gloss object phrase inside the full English line */
export function diffEnglishObjectSwap(
  frame: HeroSentenceFrame,
  prevFrame: HeroSentenceFrame,
  prevEnglish: string,
  english: string,
): EnglishWordDiff | null {
  const prevPhrases = heroWordGlossCandidates(prevFrame, prevEnglish)
  const nextPhrases = heroWordGlossCandidates(frame, english)

  const phraseDiff = diffEnglishPhraseSwap(
    prevEnglish,
    english,
    prevPhrases,
    nextPhrases,
  )
  if (phraseDiff) return phraseDiff

  const prevWord = formatHeroEnglishObject(prevFrame)
  const nextWord = formatHeroEnglishObject(frame)
  if (!prevWord || !nextWord || prevWord === nextWord) return null

  let searchFrom = 0
  while (searchFrom <= prevEnglish.length) {
    const idx = prevEnglish.indexOf(prevWord, searchFrom)
    if (idx < 0) break
    const before = prevEnglish.slice(0, idx)
    const after = prevEnglish.slice(idx + prevWord.length)
    if (before + nextWord + after === english) {
      return { before, prevWord, nextWord, after }
    }
    searchFrom = idx + 1
  }

  return null
}

/** Split two English glosses when only a single middle span changed (vocab swap). */
export function diffEnglishWordSwap(
  prev: string,
  next: string,
  relaxed = false,
): EnglishWordDiff | null {
  if (!prev || !next || prev === next) return null

  let prefix = 0
  const minLen = Math.min(prev.length, next.length)
  while (prefix < minLen && prev[prefix] === next[prefix]) prefix++

  let suffix = 0
  while (
    suffix < prev.length - prefix
    && suffix < next.length - prefix
    && prev[prev.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++
  }

  const prevWord = prev.slice(prefix, prev.length - suffix)
  const nextWord = next.slice(prefix, next.length - suffix)
  if (!prevWord || !nextWord || prevWord === nextWord) return null

  const before = prev.slice(0, prefix)
  const after = prev.slice(prev.length - suffix)

  if (!relaxed) {
    const stableChars = before.length + after.length
    const minStable = Math.min(prev.length, next.length) * 0.25
    if (stableChars < minStable) return null

    const maxWordChars = Math.max(prev.length, next.length) * 0.55
    if (prevWord.length > maxWordChars || nextWord.length > maxWordChars) return null
  } else if (before.length + after.length < 4) {
    return null
  }

  return { before, prevWord, nextWord, after }
}

/** Max inline English words for a partial swap reel */
export function maxEnglishWordsForSlot(slot?: string): number {
  if (!slot) return ENGLISH_PARTIAL_MAX_WORDS
  switch (slot) {
    case 'P':
      return 2
    case 'N':
    case 'N2':
    case 'N3':
    case 'word':
      return 3
    case 'V':
    case 'V2':
    case 'predicate':
      return 2
    case 'Adv':
    case 'modifier':
      return 2
    case 'IAdj':
    case 'NaAdj':
    case 'Adj':
      return 1
    default:
      return 1
  }
}

/** True when the diff span is exactly one English word on each side */
export function isStrictSingleWordEnglishDiff(diff: EnglishWordDiff): boolean {
  if (isEnglishAlsoDiff(diff)) return true
  return (
    englishSwapWordCount(diff.prevWord) === 1
    && englishSwapWordCount(diff.nextWord) === 1
  )
}

/** Only allow partial English swap when grammar is unchanged — one span swaps in place */
export function englishPartialSwapAllowed(
  prev: string,
  next: string,
  diff: EnglishWordDiff | null,
  changedSlot?: HeroSlot | string,
): diff is EnglishWordDiff {
  if (!diff) return false

  const prevRebuilt = rebuildPartialEnglish(diff, false)
  const nextRebuilt = rebuildPartialEnglish(diff, true)
  if (prevRebuilt !== prev || nextRebuilt !== next) return false

  if (!diff.prevWord && !diff.nextWord) return false

  if (diff.prevWord === 'also' || diff.nextWord === 'also') return true

  const maxWords = maxEnglishWordsForSlot(changedSlot)
  const prevWords = englishSwapWordCount(diff.prevWord)
  const nextWords = englishSwapWordCount(diff.nextWord)
  if (prevWords > maxWords || nextWords > maxWords) {
    return false
  }

  return true
}

export function resolveEnglishPartialSwap(
  prev: string,
  next: string,
  changedSlot: HeroSlot | string,
  frame?: HeroSentenceFrame,
  prevFrame?: HeroSentenceFrame,
): EnglishWordDiff | null {
  const slot = changedSlot as string

  if (
    slot === 'P'
    || slot === 'N'
    || slot === 'N2'
    || slot === 'N3'
    || slot === 'V'
    || slot === 'V2'
    || slot === 'Adv'
    || slot === 'IAdj'
    || slot === 'NaAdj'
    || slot === 'Adj'
  ) {
    const relaxed = diffEnglishWordSwap(prev, next, true)
    if (englishPartialSwapAllowed(prev, next, relaxed, slot)) {
      return relaxed
    }
    return null
  }

  if (changedSlot === 'word') {
    if (frame && prevFrame) {
      const objectDiff = diffEnglishObjectSwap(frame, prevFrame, prev, next)
      if (englishPartialSwapAllowed(prev, next, objectDiff, changedSlot)) {
        return objectDiff
      }
    }

    const strict = diffEnglishWordSwap(prev, next)
    if (englishPartialSwapAllowed(prev, next, strict, changedSlot)) {
      return strict
    }

    const relaxed = diffEnglishWordSwap(prev, next, true)
    return englishPartialSwapAllowed(prev, next, relaxed, changedSlot) ? relaxed : null
  }

  if (changedSlot === 'topicParticle' || changedSlot === 'objectParticle') {
    const diff = diffEnglishAlsoSwap(prev, next)
    return englishPartialSwapAllowed(prev, next, diff, changedSlot) ? diff : null
  }

  if (changedSlot === 'predicate') {
    const strict = diffEnglishWordSwap(prev, next)
    if (englishPartialSwapAllowed(prev, next, strict, changedSlot)) {
      return strict
    }

    const relaxed = diffEnglishWordSwap(prev, next, true)
    return englishPartialSwapAllowed(prev, next, relaxed, changedSlot) ? relaxed : null
  }

  if (changedSlot === 'modifier') {
    const strict = diffEnglishWordSwap(prev, next)
    if (englishPartialSwapAllowed(prev, next, strict, changedSlot)) {
      return strict
    }

    const relaxed = diffEnglishWordSwap(prev, next, true)
    return englishPartialSwapAllowed(prev, next, relaxed, changedSlot) ? relaxed : null
  }

  return null
}

export function buildForcedSlotEnglishDiff(
  slot: HeroSlot | string,
  frame: HeroSentenceFrame,
  prevFrame: HeroSentenceFrame,
  prevEnglish: string,
  english: string,
): EnglishWordDiff | null {
  if (slot === 'word') {
    const diff = diffEnglishObjectSwap(frame, prevFrame, prevEnglish, english)
    if (englishPartialSwapAllowed(prevEnglish, english, diff, slot)) return diff
  }

  if (slot === 'topicParticle' || slot === 'objectParticle') {
    const diff = diffEnglishAlsoSwap(prevEnglish, english)
    if (englishPartialSwapAllowed(prevEnglish, english, diff, slot)) return diff
  }

  const relaxed = diffEnglishWordSwap(prevEnglish, english, true)
  if (englishPartialSwapAllowed(prevEnglish, english, relaxed, slot)) return relaxed

  return null
}

export function formatPartialEnglishParts(diff: EnglishWordDiff): {
  before: string
  after: string
} {
  if (isEnglishAlsoDiff(diff)) {
    return {
      before: diff.before.trimEnd(),
      after: diff.after.replace(/\.\s*$/, ''),
    }
  }

  const stem = diff.before.trimEnd()
  const after = diff.after.replace(/\.\s*$/, '')
  return {
    before: stem ? `${stem} ` : '',
    after,
  }
}

function alsoSlotWord(word: string): string {
  if (!word) return ''
  return word === 'also' ? ` ${word}` : word
}

export function englishAlsoSlotText(word: string): string {
  return alsoSlotWord(word)
}

export function isEnglishAlsoDiff(diff: EnglishWordDiff | null): boolean {
  if (!diff) return false
  return diff.prevWord === 'also' || diff.nextWord === 'also'
}

export function englishSwapSpanChars(diff: EnglishWordDiff): {
  prevSlotChars: number
  targetSlotChars: number
} {
  if (isEnglishAlsoDiff(diff)) {
    return {
      prevSlotChars: diff.prevWord
        ? heroEnglishSlotWidthUnits(alsoSlotWord(diff.prevWord))
        : 0,
      targetSlotChars: diff.nextWord
        ? heroEnglishSlotWidthUnits(alsoSlotWord(diff.nextWord))
        : 0,
    }
  }

  return {
    prevSlotChars: heroEnglishSlotWidthUnits(diff.prevWord),
    targetSlotChars: heroEnglishSlotWidthUnits(diff.nextWord),
  }
}
