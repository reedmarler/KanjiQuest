import { allCards } from '../data'
import { hiraganaCards, katakanaCards } from '../data/kana'
import { sentenceExercises } from '../data/sentenceExercises'
import { getApprovedContentRecords } from './contentDatabase'
import type { JlptLevel, StudyCard } from './types'
import type { SentenceExercise } from '../data/sentenceExercises'

/**
 * Dedupe key for merging added vocab with the seed. Matches on the Japanese
 * word alone because seed readings are stored inconsistently (romaji vs kana),
 * which would otherwise surface the same word twice.
 */
function vocabKey(japanese: string): string {
  return japanese.trim()
}

export const JLPT_LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

export type ContentBucket = 'kana' | 'vocab' | 'grammar' | 'kanji' | 'reading' | 'sentences'

export interface LevelContentSummary {
  level: JlptLevel
  kana: number
  vocab: number
  grammar: number
  kanji: number
  reading: number
  sentences: number
  total: number
}

export interface LevelContent {
  level: JlptLevel
  kana: StudyCard[]
  vocab: StudyCard[]
  grammar: StudyCard[]
  kanji: StudyCard[]
  reading: StudyCard[]
  sentences: SentenceExercise[]
  summary: LevelContentSummary
}

function cardsAtLevel(level: JlptLevel, type: StudyCard['type']): StudyCard[] {
  return allCards.filter((c) => c.type === type && c.jlpt === level)
}

function uniqueVocabulary(cards: StudyCard[]): StudyCard[] {
  const seen = new Set<string>()
  return cards.filter((card) => {
    const key = vocabKey(card.front)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Approved vocabulary from the runtime content database (Content Studio),
 * surfaced alongside the built-in seed vocab. Deduped against the seed and
 * against itself so words added via the vocabulary editor appear here too.
 */
function addedVocabAtLevel(level: JlptLevel, seedKeys: Set<string>): StudyCard[] {
  const seen = new Set<string>()
  return getApprovedContentRecords().flatMap((record) => {
    if (record.kind !== 'vocabulary' || (record.jlpt ?? 'N5') !== level) return []
    const key = vocabKey(record.japanese)
    if (seedKeys.has(key) || seen.has(key)) return []
    seen.add(key)
    return [{
      id: record.id,
      type: 'vocab' as const,
      front: record.japanese,
      reading: record.reading,
      back: record.english,
      jlpt: record.jlpt,
    }]
  })
}

function sentencesAtLevel(level: JlptLevel): SentenceExercise[] {
  return sentenceExercises.filter((ex) => ex.jlpt === level)
}

export function getLevelContent(level: JlptLevel): LevelContent {
  const kana = level === 'N5' ? [...hiraganaCards, ...katakanaCards] : []
  // The library combines several intentionally overlapping sources. Show each
  // Japanese word once, while still allowing every source to support Kanji Lab.
  const seedVocab = uniqueVocabulary(cardsAtLevel(level, 'vocab'))
  const seedVocabKeys = new Set(seedVocab.map((c) => vocabKey(c.front)))
  const vocab = [...seedVocab, ...addedVocabAtLevel(level, seedVocabKeys)]
  const grammar = cardsAtLevel(level, 'grammar')
  const kanji = cardsAtLevel(level, 'kanji')
  const reading = cardsAtLevel(level, 'reading')
  const sentences = sentencesAtLevel(level)

  const summary: LevelContentSummary = {
    level,
    kana: kana.length,
    vocab: vocab.length,
    grammar: grammar.length,
    kanji: kanji.length,
    reading: reading.length,
    sentences: sentences.length,
    total: kana.length + vocab.length + grammar.length + kanji.length + reading.length + sentences.length,
  }

  return { level, kana, vocab, grammar, kanji, reading, sentences, summary }
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
  grammar: 'Grammar',
  kanji: 'Kanji',
  reading: 'Reading',
  sentences: 'Sentences',
}
