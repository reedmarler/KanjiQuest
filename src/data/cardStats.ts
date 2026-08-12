import { allCards } from './index'

/**
 * Denominator for the dashboard's "learned" percentage. Derived rather than
 * written down: the hand-maintained figure had drifted well below the real
 * deck, and deduplicating the vocabulary moved it again.
 */
export const CARD_TOTAL = allCards.length
