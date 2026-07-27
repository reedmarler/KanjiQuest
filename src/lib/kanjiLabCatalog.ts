import { toHiragana } from 'wanakana'
import { allCards } from '../data'
import { kanjiCards } from '../data/kanji'
import { vocabBulkKanaMap } from '../data/vocabBulkKana'
import { vocabKanaMap } from '../data/vocabKana'
import type { JlptLevel, StudyCard } from './types'

const KANJI_RE = /[\u3400-\u4DBF\u4E00-\u9FFF]/u
const levelOrder: Record<JlptLevel, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 }
const readingOverrides: Record<string, string> = { 枚: 'まい' }

export interface KanjiLabEntry {
  character: string
  card: StudyCard
  isCurated: boolean
  example: {
    word: string
    reading: string
    meaning: string
  }
}

function kanaReading(card: StudyCard): string {
  const mapped = vocabKanaMap[card.id] ?? vocabBulkKanaMap[card.id]
  if (mapped) return mapped
  if (card.reading) return /[\u3040-\u30FF]/u.test(card.reading) ? card.reading : toHiragana(card.reading)
  return ''
}

function characters(text: string) {
  return [...text].filter((character) => KANJI_RE.test(character))
}

function preferredSource(current: StudyCard | undefined, candidate: StudyCard) {
  if (!current) return candidate
  const currentIsStandaloneKanji = current.type === 'kanji'
  const candidateIsStandaloneKanji = candidate.type === 'kanji'
  if (currentIsStandaloneKanji !== candidateIsStandaloneKanji) {
    return candidateIsStandaloneKanji ? current : candidate
  }
  const currentMapped = Boolean(kanaReading(current))
  const candidateMapped = Boolean(kanaReading(candidate))
  if (candidateMapped !== currentMapped) return candidateMapped ? candidate : current
  const currentLevel = levelOrder[current.jlpt ?? 'N1']
  const candidateLevel = levelOrder[candidate.jlpt ?? 'N1']
  if (candidateLevel !== currentLevel) return candidateLevel < currentLevel ? candidate : current
  return candidate.front.length < current.front.length ? candidate : current
}

const curatedByCharacter = new Map(
  kanjiCards
    .filter((card) => [...card.front].length === 1 && KANJI_RE.test(card.front))
    .map((card) => [card.front, card] as const),
)

const sourceByCharacter = new Map<string, StudyCard>()
const examplesByCharacterAndWord = new Map<string, StudyCard>()
for (const card of allCards) {
  const wordCharacters = [...new Set(characters(card.front))]
  for (const character of wordCharacters) {
    sourceByCharacter.set(character, preferredSource(sourceByCharacter.get(character), card))
  }
  // Keep real vocabulary contexts through four-kanji words. This includes
  // forms like 大きい and 大丈夫 without turning long sentence-like entries into
  // an overwhelming kanji drill.
  if (wordCharacters.length > 0 && wordCharacters.length <= 4 && kanaReading(card)) {
    for (const character of wordCharacters) {
      const key = character + '\u0000' + card.front
      examplesByCharacterAndWord.set(key, preferredSource(examplesByCharacterAndWord.get(key), card))
    }
  }
}

const fallbackEntries = [...sourceByCharacter.entries()].map(([character, source]) => ({
  character,
  source,
}))

const contextEntries = [...examplesByCharacterAndWord.entries()].map(([key, source]) => ({
  character: key.split('\u0000')[0]!,
  source,
}))

export const kanjiLabEntries: KanjiLabEntry[] = [...contextEntries, ...fallbackEntries]
  .map(({ character, source }) => {
    const curated = curatedByCharacter.get(character)
    const level = source.jlpt ?? curated?.jlpt ?? 'N1'
    const reading = kanaReading(source) || readingOverrides[character] || ''
    const card: StudyCard = curated ?? {
      id: 'kanji-derived-' + character.codePointAt(0)?.toString(16) + '-' + source.id,
      type: 'kanji',
      front: character,
      reading,
      back: source.back,
      jlpt: level,
    }
    return {
      character,
      card,
      isCurated: Boolean(curated),
      example: { word: source.front, reading, meaning: source.back },
    }
  })
  .filter((entry, index, entries) => entries.findIndex((candidate) =>
    candidate.character === entry.character && candidate.example.word === entry.example.word,
  ) === index)
  .sort((left, right) =>
    levelOrder[left.card.jlpt ?? 'N1'] - levelOrder[right.card.jlpt ?? 'N1']
    || left.character.localeCompare(right.character, 'ja')
    || left.example.word.localeCompare(right.example.word, 'ja'),
  )
