import { allCards, getCardById } from '../data'
import type { JlptLevel } from './types'
import { cardToHeroWord } from './heroStudyPool'

export const HERO_JLPT_LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

/** Template words without a tagged vocab/kanji card */
const HERO_TEMPLATE_WORD_JLPT: Partial<Record<string, JlptLevel>> = {
  'ピザ': 'N5',
  '寿司': 'N5',
  '弁当': 'N5',
  'ラーメン': 'N5',
  'コーヒー': 'N5',
  'ハンバーガー': 'N5',
  'チョコレート': 'N5',
  'かばん': 'N5',
  'パソコン': 'N5',
  '恋人': 'N4',
  '両親': 'N4',
  '切符': 'N4',
  '温泉': 'N4',
  '神社': 'N4',
  '図書館': 'N4',
  '美術館': 'N4',
  '動物園': 'N4',
}

let wordJlptCache: Map<string, JlptLevel> | null = null

export function nextHeroJlptLevel(current: JlptLevel): JlptLevel {
  const index = HERO_JLPT_LEVELS.indexOf(current)
  return HERO_JLPT_LEVELS[(index + 1) % HERO_JLPT_LEVELS.length]
}

export function cardAtJlptLevel(id: string, level: JlptLevel): boolean {
  const card = getCardById(id)
  return card?.jlpt === level
}

export function buildWordJlptMap(): Map<string, JlptLevel> {
  if (wordJlptCache) return wordJlptCache

  const map = new Map<string, JlptLevel>()

  for (const card of allCards) {
    if (!card.jlpt) continue

    if (card.type === 'vocab') {
      map.set(card.front, card.jlpt)
      continue
    }

    if (card.type === 'kanji') {
      const word = cardToHeroWord(card.id)
      if (word) map.set(word, card.jlpt)
    }
  }

  for (const [word, level] of Object.entries(HERO_TEMPLATE_WORD_JLPT)) {
    if (!map.has(word) && level) map.set(word, level)
  }

  wordJlptCache = map
  return map
}

export function wordAtJlptLevel(
  word: string,
  level: JlptLevel,
  wordJlpt = buildWordJlptMap(),
): boolean {
  return wordJlpt.get(word) === level
}

export function wordAllowedAtHeroLevel(
  word: string,
  level: JlptLevel,
  studyPoolCardIds: string[],
  wordJlpt = buildWordJlptMap(),
): boolean {
  if (wordAtJlptLevel(word, level, wordJlpt)) return true
  return studyPoolCardIds.some((id) => cardToHeroWord(id) === word)
}

export function cardsAtJlptLevel(level: JlptLevel): string[] {
  return allCards
    .filter((card) => card.jlpt === level && (card.type === 'vocab' || card.type === 'kanji'))
    .map((card) => card.id)
}

export function heroWordsAtJlptLevel(level: JlptLevel): string[] {
  const words = new Set<string>()
  const map = buildWordJlptMap()

  for (const [word, wordLevel] of map) {
    if (wordLevel === level) words.add(word)
  }

  return [...words]
}
