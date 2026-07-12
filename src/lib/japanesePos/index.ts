import type { RuntimeParseOptions } from './parse'
import { parseJapaneseSentence } from './parse'
import { replaceTokens } from './replace'
import type { PosVocabulary, ReplaceOptions, ReplaceResult } from './types'

export type { PosCategory, PosVocabulary, JapaneseToken, ParseResult, ReplaceOptions, ReplaceResult } from './types'
export type { RuntimeParseOptions, KuromojiToken } from './parse'
export { kuromojiPosToCategory, isSwappablePos } from './posMapping'
export { parseJapaneseSentence, tokensFromKuromoji } from './parse'
export { replaceTokens, swapParsedSentence } from './replace'
export { reconstructSentence } from './reconstruct'

/** Full pipeline: parse → replace swappable POS → reconstruct */
export function swapJapaneseSentence(
  sentence: string,
  vocabulary: PosVocabulary,
  parseOptions: RuntimeParseOptions,
  replaceOptions: Omit<ReplaceOptions, 'vocabulary'> = {},
): ReplaceResult {
  const parsed = parseJapaneseSentence(sentence, parseOptions)
  return replaceTokens(parsed.tokens, { ...replaceOptions, vocabulary })
}
