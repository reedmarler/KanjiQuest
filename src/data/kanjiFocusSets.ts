import { vocabFocusSets } from './vocabFocusSets'

const KANJI_RE = /[\u3400-\u4DBF\u4E00-\u9FFF]/u

export interface KanjiFocusSet {
  id: string
  title: string
  description: string
  symbol: string
  characters: string[]
}

const PATH_SYMBOLS: Readonly<Record<string, string>> = {
  home: '家',
  food: '食',
  shopping: '買',
  travel: '旅',
  school: '学',
  work: '職',
  health: '健',
  city: '市',
  nature: '山',
  feelings: '心',
  technology: '技',
  time: '時',
  restaurant: '店',
  sports: '運',
  animals: '動',
  clothing: '服',
  directions: '道',
  cooking: '料',
  emergency: '急',
  family: '家',
  numbers: '数',
  communication: '話',
  holidays: '祝',
}

/**
 * Kanji Paths inherit a concrete setting from the focused vocab paths, but
 * deliberately expose characters rather than words. This connects the two
 * modes without turning Kanji Lab into another vocabulary flashcard screen.
 */
export const kanjiFocusSets: readonly KanjiFocusSet[] = vocabFocusSets.map((set) => ({
  id: set.id,
  title: set.title,
  description: set.description,
  symbol: PATH_SYMBOLS[set.id] ?? '漢',
  characters: [...new Set(set.cards.flatMap((card) => [...card.front].filter((character) => KANJI_RE.test(character))))].slice(0, 15),
}))
