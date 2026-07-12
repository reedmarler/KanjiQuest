/**
 * Curated Japanese verb–object pairings for hero sentence cycling.
 *
 * To extend swap pools safely, add words here (read/watch/listen/borrow)
 * and matching English glosses in `heroCollocations.ts` → MANUAL_COLLOCATIONS.
 *
 * Example manual entry:
 *   百科事典: { roles: { read: 'encyclopedias' }, topic: 'Encyclopedias' }
 */
export const HERO_READ_OBJECTS = [
  '本', '雑誌', '新聞', '小説', '漫画', '辞書', '手紙', '文学',
  '漢字', '歴史', '哲学', '政治', '社会', '経済', '文化', '芸術',
  '教育', '研究', '技術', '産業', '国際', '宗教', '科学', '数学',
] as const

export const HERO_WATCH_OBJECTS = [
  '映画', '写真', 'テレビ', 'ドラマ', 'アニメ', '野球', 'テニス', 'ゴルフ',
] as const

export const HERO_LISTEN_OBJECTS = ['音楽', 'ラジオ', '歌'] as const

export const HERO_BORROW_OBJECTS = [
  '本', '雑誌', '小説', '漫画', '辞書', '地図', '映画', '写真', '新聞',
] as const

export type HeroVerbObjectRole = 'read' | 'watch' | 'listen' | 'borrow'

/** Shape for a user-provided extension library (JSON or TS) */
export type HeroVerbObjectEntry = {
  word: string
  roles: HeroVerbObjectRole[]
  /** English gloss per role — keys must match roles */
  gloss: Partial<Record<HeroVerbObjectRole, string>>
  topic?: string
}
