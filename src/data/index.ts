import { hiraganaCards, katakanaCards } from './kana'
import { vocabularyCards } from './vocabulary'
import { vocabBulkCards } from './vocabBulk'
import { vocabBulkHeroCards } from './vocabBulkHero'
import { vocabBulkListCards } from './vocabBulkList'
import { vocabTop1000Cards } from './vocabTop1000'
import { kanjiCards } from './kanji'
import { readingCards } from './readings'
import { readingEnglish } from './readingEnglish'
import { additionalVocabularySenseCards } from './vocabularySenseOverrides'
import type { CardType, StudyCard } from '../lib/types'

const readingCardsWithEnglish: StudyCard[] = readingCards.map((card) => ({
  ...card,
  english: readingEnglish[card.id],
}))

export const allCards: StudyCard[] = [
  ...hiraganaCards,
  ...katakanaCards,
  ...vocabularyCards,
  ...vocabBulkCards,
  ...vocabBulkHeroCards,
  ...vocabBulkListCards,
  ...vocabTop1000Cards,
  ...additionalVocabularySenseCards,
  ...kanjiCards,
  ...readingCardsWithEnglish,
]

export function getCardsByType(type: CardType): StudyCard[] {
  return allCards.filter((c) => c.type === type)
}

export function getCardById(id: string): StudyCard | undefined {
  return allCards.find((c) => c.id === id)
}

export const deckInfo = [
  { type: 'reading' as const, label: 'Reading Quiz', count: readingCardsWithEnglish.length, emoji: '読' },
  { type: 'kanji' as const, label: 'Kanji', count: kanjiCards.length, emoji: '漢' },
  { type: 'vocab' as const, label: 'Vocabulary', count: vocabularyCards.length + vocabBulkCards.length + vocabBulkHeroCards.length + vocabBulkListCards.length + vocabTop1000Cards.length + additionalVocabularySenseCards.length, emoji: '語' },
  { type: 'hiragana' as const, label: 'Hiragana', count: hiraganaCards.length, emoji: 'あ' },
  { type: 'katakana' as const, label: 'Katakana', count: katakanaCards.length, emoji: 'ア' },
]
