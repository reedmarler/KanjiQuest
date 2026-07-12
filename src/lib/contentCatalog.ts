import { allCards } from '../data'
import { hiraganaCards, katakanaCards } from '../data/kana'
import { sentenceExercises } from '../data/sentenceExercises'
import type { JlptLevel, StudyCard } from './types'
import type { SentenceExercise } from '../data/sentenceExercises'

export const JLPT_LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

export type ContentBucket = 'kana' | 'vocab' | 'kanji' | 'reading' | 'sentences'

export interface LevelContentSummary {
  level: JlptLevel
  kana: number
  vocab: number
  kanji: number
  reading: number
  sentences: number
  total: number
}

export interface LevelContent {
  level: JlptLevel
  kana: StudyCard[]
  vocab: StudyCard[]
  kanji: StudyCard[]
  reading: StudyCard[]
  sentences: SentenceExercise[]
  summary: LevelContentSummary
}

function cardsAtLevel(level: JlptLevel, type: StudyCard['type']): StudyCard[] {
  return allCards.filter((c) => c.type === type && c.jlpt === level)
}

function sentencesAtLevel(level: JlptLevel): SentenceExercise[] {
  return sentenceExercises.filter((ex) => ex.jlpt === level)
}

export function getLevelContent(level: JlptLevel): LevelContent {
  const kana = level === 'N5' ? [...hiraganaCards, ...katakanaCards] : []
  const vocab = cardsAtLevel(level, 'vocab')
  const kanji = cardsAtLevel(level, 'kanji')
  const reading = cardsAtLevel(level, 'reading')
  const sentences = sentencesAtLevel(level)

  const summary: LevelContentSummary = {
    level,
    kana: kana.length,
    vocab: vocab.length,
    kanji: kanji.length,
    reading: reading.length,
    sentences: sentences.length,
    total: kana.length + vocab.length + kanji.length + reading.length + sentences.length,
  }

  return { level, kana, vocab, kanji, reading, sentences, summary }
}

export function getAllLevelSummaries(): LevelContentSummary[] {
  return JLPT_LEVELS.map((level) => getLevelContent(level).summary)
}

export function totalCatalogItems(): number {
  return getAllLevelSummaries().reduce((sum, s) => sum + s.total, 0)
}

export const BUCKET_LABELS: Record<ContentBucket, string> = {
  kana: 'Kana',
  vocab: 'Vocabulary',
  kanji: 'Kanji',
  reading: 'Reading',
  sentences: 'Sentences',
}
