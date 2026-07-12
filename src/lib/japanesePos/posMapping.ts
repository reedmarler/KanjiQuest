import type { FixedPosCategory, PosCategory, TokenPos } from './types'

/** Kuromoji / IPADIC coarse POS → our category */
export function kuromojiPosToCategory(
  pos: string,
  posDetail1?: string,
  conjugationType?: string,
): TokenPos {
  if (pos === '助詞') return 'particle'
  if (pos === '助動詞') return 'auxiliary'

  if (pos === '動詞') return 'verb'
  if (pos === '形容詞') return 'i_adj'
  if (pos === '形容動詞語幹') return 'na_adj'
  if (pos === '副詞') return 'adverb'
  if (pos === '代名詞') return 'pronoun'

  if (pos === '名詞') {
    if (posDetail1 === '代名詞') return 'pronoun'
    return 'noun'
  }

  if (pos === '接尾辞' && conjugationType === '動詞接尾') return 'verb'

  return 'other'
}

export function isSwappablePos(pos: TokenPos): pos is PosCategory {
  return (
    pos === 'noun'
    || pos === 'verb'
    || pos === 'i_adj'
    || pos === 'na_adj'
    || pos === 'adverb'
    || pos === 'pronoun'
  )
}

export function isFixedPos(pos: TokenPos): pos is FixedPosCategory {
  return pos === 'particle' || pos === 'auxiliary' || pos === 'other'
}
