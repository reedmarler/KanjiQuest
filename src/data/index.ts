import { hiraganaCards, katakanaCards } from './kana'
import { vocabularyCards } from './vocabulary'
import { vocabBulkCards } from './vocabBulk'
import { vocabBulkHeroCards } from './vocabBulkHero'
import { vocabBulkListCards } from './vocabBulkList'
import { vocabTop1000Cards } from './vocabTop1000'
import { userAddedVocabCards } from './userAddedVocab'
import { kanjiCards } from './kanji'
import { readingCards } from './readings'
import { readingEnglish } from './readingEnglish'
import { additionalVocabularySenseCards } from './vocabularySenseOverrides'
import { grammarCards } from './grammar'
import type { StudyCard } from '../lib/types'

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
  ...userAddedVocabCards,
  ...grammarCards,
  ...kanjiCards,
  ...readingCardsWithEnglish,
]

export function getCardById(id: string): StudyCard | undefined {
  return allCards.find((c) => c.id === id)
}
