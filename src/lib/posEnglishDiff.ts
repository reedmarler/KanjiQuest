import type { HeroSentenceFrame } from '../data/heroSentences'
import { isPosFrame } from '../data/heroSentences'
import type { EnglishWordDiff } from './heroEnglishDiff'
import { diffEnglishPhraseSwap } from './heroEnglishDiff'
import { heroObjectPhrase } from './heroVocabPhrases'

function segmentText(frame: HeroSentenceFrame, key: string): string {
  if (!isPosFrame(frame)) return ''
  return frame.segments?.find((s) => s.key === key)?.text ?? ''
}

function nounPhraseCandidates(word: string): string[] {
  if (!word) return []
  const base = heroObjectPhrase(word) ?? word
  const lower = base.toLowerCase()
  const set = new Set<string>([base, lower])
  for (const prefix of ['to ', 'the ', 'a ', 'my ', 'at ']) {
    set.add(`${prefix}${base}`)
    set.add(`${prefix}${lower}`)
  }
  return [...set].sort((a, b) => b.length - a.length)
}

const ADV_GLOSS: Record<string, string[]> = {
  '早く': ['early'],
  '遅く': ['late'],
  '毎日': ['every day'],
  'もっと': ['more'],
  '少し': ['a little'],
  'とても': ['very'],
  '今日': ['today'],
  '昨日': ['yesterday'],
  'すぐ': ['soon'],
  'よく': ['often'],
}

const IADJ_GLOSS: Record<string, string[]> = {
  '新しい': ['new'],
  '古い': ['old'],
  '面白い': ['interesting'],
  '大きい': ['big'],
  '小さい': ['small'],
  '静か': ['quiet'],
}

const NAADJ_GLOSS: Record<string, string[]> = {
  '静か': ['quiet'],
  'にぎやか': ['lively'],
  '新しい': ['new'],
}

/** Map a curated segment slot to the English phrase that should blur-reel */
export function diffEnglishForSegmentSlot(
  slot: string,
  frame: HeroSentenceFrame,
  prevFrame: HeroSentenceFrame,
  prevEnglish: string,
  english: string,
): EnglishWordDiff | null {
  if (!isPosFrame(frame) || !isPosFrame(prevFrame)) return null

  if (slot === 'N' || slot === 'N2' || slot === 'N3') {
    const prevPhrases = nounPhraseCandidates(segmentText(prevFrame, slot))
    const nextPhrases = nounPhraseCandidates(segmentText(frame, slot))
    if (prevPhrases.length === 0 || nextPhrases.length === 0) return null
    return diffEnglishPhraseSwap(prevEnglish, english, prevPhrases, nextPhrases)
  }

  if (slot === 'Adv') {
    const prevAdv = segmentText(prevFrame, slot)
    const nextAdv = segmentText(frame, slot)
    const prevPhrases = ADV_GLOSS[prevAdv] ?? [prevAdv]
    const nextPhrases = ADV_GLOSS[nextAdv] ?? [nextAdv]
    return diffEnglishPhraseSwap(prevEnglish, english, prevPhrases, nextPhrases)
  }

  if (slot === 'IAdj') {
    const prevPhrases = IADJ_GLOSS[segmentText(prevFrame, slot)] ?? []
    const nextPhrases = IADJ_GLOSS[segmentText(frame, slot)] ?? []
    if (prevPhrases.length === 0 || nextPhrases.length === 0) return null
    return diffEnglishPhraseSwap(prevEnglish, english, prevPhrases, nextPhrases)
  }

  if (slot === 'NaAdj') {
    const prevPhrases = NAADJ_GLOSS[segmentText(prevFrame, slot)] ?? []
    const nextPhrases = NAADJ_GLOSS[segmentText(frame, slot)] ?? []
    if (prevPhrases.length === 0 || nextPhrases.length === 0) return null
    return diffEnglishPhraseSwap(prevEnglish, english, prevPhrases, nextPhrases)
  }

  return null
}
