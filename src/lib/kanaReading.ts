import { getKanjiDetail } from '../data/kanjiDetails'
import { kanjiContextKanaMap, kanjiKanaMap } from '../data/kanjiKana'
import {
  getKanjiReadingInWordForm,
  getKanjiWordForm,
} from './kanjiWordForm'
import type { StudyCard } from './types'

const KANA_RE = /[\u3040-\u309F\u30A0-\u30FF]/

export function isKana(text: string): boolean {
  return KANA_RE.test(text)
}

/** Primary kana reading for quiz answers and kanji flashcard display. */
export function getKanaReading(card: StudyCard): string {
  const wordForm = getKanjiWordForm(card)
  if (wordForm) return wordForm.kana

  if (kanjiKanaMap[card.id]) return kanjiKanaMap[card.id]

  const detail = getKanjiDetail(card)
  if (detail.kunyomi[0] && isKana(detail.kunyomi[0])) return detail.kunyomi[0]
  if (detail.onyomi[0] && isKana(detail.onyomi[0])) return detail.onyomi[0]

  const compound = detail.compounds[0]
  if (compound?.reading && isKana(compound.reading)) return compound.reading

  return ''
}

/** Kana reading as used in a sentence context (okurigana, etc.). */
export function getContextKanaReading(card: StudyCard): string {
  if (kanjiContextKanaMap[card.id]) return kanjiContextKanaMap[card.id]

  const inWord = getKanjiReadingInWordForm(card)
  if (inWord) return inWord

  const detail = getKanjiDetail(card)
  if (detail.contextReading && isKana(detail.contextReading)) return detail.contextReading

  return getKanaReading(card)
}

/** All kana readings for display in Learn mode. */
export function getKanaReadingsDisplay(card: StudyCard): { kunyomi: string[]; onyomi: string[] } {
  const wordForm = getKanjiWordForm(card)
  if (wordForm) {
    return { kunyomi: [wordForm.kana], onyomi: [] }
  }

  const detail = getKanjiDetail(card)
  const kunyomi = detail.kunyomi.filter(isKana)
  const onyomi = detail.onyomi.filter(isKana)

  if (kunyomi.length === 0 && onyomi.length === 0 && kanjiKanaMap[card.id]) {
    return { kunyomi: [kanjiKanaMap[card.id]], onyomi: [] }
  }

  return { kunyomi, onyomi }
}
