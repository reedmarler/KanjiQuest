/** Swappable parts-of-speech categories for sentence rotation */
export type PosCategory =
  | 'noun'
  | 'verb'
  | 'i_adj'
  | 'na_adj'
  | 'adverb'
  | 'pronoun'

/** Vocabulary lists keyed by POS — user-specified shape */
export type PosVocabulary = Record<PosCategory, readonly string[]>

/** Non-swappable token classes */
export type FixedPosCategory = 'particle' | 'auxiliary' | 'other'

export type TokenPos = PosCategory | FixedPosCategory

export interface JapaneseToken {
  /** Surface form as it appears in the sentence */
  surface: string
  pos: TokenPos
  start: number
  end: number
  /** Whether this token may be replaced */
  swappable: boolean
}

export interface ParseResult {
  sentence: string
  tokens: JapaneseToken[]
}

export interface ReplaceOptions {
  vocabulary: PosVocabulary
  /** Optional RNG seed for deterministic picks */
  seed?: number
  /** Replace only these token indices */
  tokenIndices?: number[]
  /** Limit replacement to these POS categories */
  categories?: PosCategory[]
  /** Keep current surface when no replacement found */
  keepOriginal?: boolean
}

export interface ReplaceResult {
  sentence: string
  tokens: JapaneseToken[]
  replacements: Array<{ index: number; from: string; to: string; pos: PosCategory }>
}
