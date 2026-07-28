import { vocabFocusSets } from './vocabFocusSets'

const KANJI_RE = /[\u3400-\u4DBF\u4E00-\u9FFF]/u

export interface KanjiFocusSet {
  id: string
  title: string
  description: string
  characters: string[]
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
  characters: [...new Set(set.cards.flatMap((card) => [...card.front].filter((character) => KANJI_RE.test(character))))].slice(0, 15),
}))
