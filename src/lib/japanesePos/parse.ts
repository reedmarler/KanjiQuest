import { kuromojiPosToCategory, isSwappablePos } from './posMapping'
import { SORTED_AUXILIARIES, SORTED_PARTICLES } from './particles'
import type { JapaneseToken, ParseResult, TokenPos } from './types'

export type WordPosLookup = Readonly<Record<string, TokenPos>>

export interface RuntimeParseOptions {
  /** word surface → POS category */
  wordPosIndex: WordPosLookup
  /** Additional known multi-char segments (modifiers, bridges) */
  knownPhrases?: readonly string[]
}

function sortedPhrases(phrases: readonly string[]): string[] {
  return [...phrases].sort((a, b) => b.length - a.length)
}

function lookupPos(surface: string, index: WordPosLookup): TokenPos {
  if (index[surface]) return index[surface]

  // Strip polite verb endings and re-lookup stem
  for (const suffix of SORTED_AUXILIARIES) {
    if (surface.endsWith(suffix) && surface.length > suffix.length) {
      const stem = surface.slice(0, -suffix.length)
      if (index[stem]) return index[stem]
      if (index[stem + 'る']) return 'verb'
      if (index[stem + 'う']) return 'verb'
    }
  }

  // 形容動詞 + です/だ
  if (surface.endsWith('です') || surface.endsWith('だ')) {
    const stem = surface.replace(/(です|だ)$/, '')
    if (index[stem] === 'na_adj') return 'na_adj'
  }

  // i-adjective past/negative forms
  if (/[いくさたな]$/u.test(surface) && index[surface.slice(0, -1) + 'い']) {
    return 'i_adj'
  }

  return 'other'
}

function matchAt(
  sentence: string,
  pos: number,
  candidates: string[],
): string | null {
  for (const candidate of candidates) {
    if (sentence.startsWith(candidate, pos)) return candidate
  }
  return null
}

/**
 * Runtime tokenizer — dictionary longest-match + POS index.
 * No Kuromoji bundle required in the browser.
 */
export function parseJapaneseSentence(
  sentence: string,
  options: RuntimeParseOptions,
): ParseResult {
  const phraseList = sortedPhrases([
    ...(options.knownPhrases ?? []),
    ...Object.keys(options.wordPosIndex),
    ...SORTED_PARTICLES,
  ])

  const tokens: JapaneseToken[] = []
  let cursor = 0

  while (cursor < sentence.length) {
    const particle = matchAt(sentence, cursor, SORTED_PARTICLES)
    if (particle) {
      tokens.push({
        surface: particle,
        pos: 'particle',
        start: cursor,
        end: cursor + particle.length,
        swappable: false,
      })
      cursor += particle.length
      continue
    }

    const phrase = matchAt(sentence, cursor, phraseList)
    const surface = phrase ?? sentence[cursor]
    const tokenPos = lookupPos(surface, options.wordPosIndex)

    tokens.push({
      surface,
      pos: tokenPos,
      start: cursor,
      end: cursor + surface.length,
      swappable: isSwappablePos(tokenPos),
    })
    cursor += surface.length
  }

  return { sentence, tokens }
}

/** Kuromoji token shape (scripts only) */
export interface KuromojiToken {
  surface_form: string
  pos: string
  pos_detail_1?: string
  pos_detail_2?: string
  conjugation_type?: string
  basic_form?: string
}

/** Convert Kuromoji tokens to our token model */
export function tokensFromKuromoji(
  sentence: string,
  kuromojiTokens: KuromojiToken[],
): ParseResult {
  let cursor = 0
  const tokens: JapaneseToken[] = kuromojiTokens.map((kt) => {
    const pos = kuromojiPosToCategory(
      kt.pos,
      kt.pos_detail_1,
      kt.conjugation_type,
    )
    const surface = kt.surface_form
    const start = sentence.indexOf(surface, cursor)
    const safeStart = start >= 0 ? start : cursor
    cursor = safeStart + surface.length
    return {
      surface,
      pos,
      start: safeStart,
      end: safeStart + surface.length,
      swappable: isSwappablePos(pos),
    }
  })

  return { sentence, tokens }
}
