import { vocabBulkListCards } from './vocabBulkList'

/** Hiragana readings for vocab-list bulk cards */
export const vocabBulkListKanaMap: Record<string, string> = Object.fromEntries(
  vocabBulkListCards.map((card) => [card.id, card.reading ?? '']),
)
