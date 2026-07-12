/** Japanese particles — never replaced */
export const JAPANESE_PARTICLES = [
  'は', 'が', 'を', 'に', 'で', 'と', 'も', 'へ', 'から', 'まで', 'より', 'の',
  'か', 'ね', 'よ', 'な', 'ぞ', 'さ', 'ば', 'て', 'で', 'ながら',
] as const

/** Auxiliary / copula endings — never replaced as standalone swaps */
export const JAPANESE_AUXILIARY_SUFFIXES = [
  'です', 'だ', 'ます', 'ません', 'ました', 'ませんでした',
  'たい', 'たいです', 'たくない', 'たくないです',
  'ている', 'ています', 'ていません', 'ていました',
  'ない', 'なかった', 'ないです', 'なかったです',
  'でしょう', 'だろう', 'ましょう',
] as const

/** Sort longest-first for greedy matching */
export const SORTED_PARTICLES = [...JAPANESE_PARTICLES].sort((a, b) => b.length - a.length)

export const SORTED_AUXILIARIES = [...JAPANESE_AUXILIARY_SUFFIXES].sort(
  (a, b) => b.length - a.length,
)
