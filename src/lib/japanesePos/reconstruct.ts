import type { JapaneseToken } from './types'

/** Join parsed tokens back into a sentence, preserving original spacing (none for JP) */
export function reconstructSentence(tokens: readonly JapaneseToken[]): string {
  return tokens.map((t) => t.surface).join('')
}
