import { reconstructSentence } from './reconstruct'
import { isSwappablePos } from './posMapping'
import type { JapaneseToken, PosCategory, PosVocabulary, ReplaceOptions, ReplaceResult } from './types'

function seededPick<T>(items: readonly T[], seed: number, exclude?: T): T | null {
  if (items.length === 0) return null
  const pool = exclude !== undefined ? items.filter((item) => item !== exclude) : [...items]
  if (pool.length === 0) return null
  return pool[Math.abs(seed) % pool.length]
}

function pickReplacement(
  pos: PosCategory,
  current: string,
  vocabulary: PosVocabulary,
  seed: number,
): string | null {
  const pool = vocabulary[pos]
  if (!pool || pool.length === 0) return null

  const others = pool.filter((w) => w !== current && w.length >= Math.min(2, current.length))
  if (others.length === 0) return null

  const sameLen = others.filter((w) => w.length === current.length)
  const candidates = sameLen.length > 0 ? sameLen : others

  return seededPick(candidates, seed)
}

/** Replace swappable tokens in a parsed sentence */
export function replaceTokens(
  tokens: JapaneseToken[],
  options: ReplaceOptions,
): ReplaceResult {
  const {
    vocabulary,
    seed = 0,
    tokenIndices,
    categories,
    keepOriginal = true,
  } = options

  const allowed = categories ? new Set(categories) : null
  const replacements: ReplaceResult['replacements'] = []
  let swapSeed = seed

  const nextTokens = tokens.map((token, index) => {
    if (!token.swappable || !isSwappablePos(token.pos)) return token
    if (tokenIndices && !tokenIndices.includes(index)) return token
    if (allowed && !allowed.has(token.pos)) return token

    const replacement = pickReplacement(token.pos, token.surface, vocabulary, swapSeed++)
    if (!replacement || replacement === token.surface) {
      return keepOriginal ? token : token
    }

    replacements.push({
      index,
      from: token.surface,
      to: replacement,
      pos: token.pos,
    })

    return {
      ...token,
      surface: replacement,
      start: token.start,
      end: token.start + replacement.length,
    }
  })

  return {
    sentence: reconstructSentence(nextTokens),
    tokens: nextTokens,
    replacements,
  }
}

/** Parse + replace + reconstruct in one call (requires pre-parsed tokens) */
export function swapParsedSentence(
  parseResult: { sentence: string; tokens: JapaneseToken[] },
  options: ReplaceOptions,
): ReplaceResult {
  return replaceTokens(parseResult.tokens, options)
}
