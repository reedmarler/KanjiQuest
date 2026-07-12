/**
 * Generates src/data/curatedHeroSentences.ts from compact row definitions.
 * Run: npx tsx scripts/gen-curated-hero-data.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

type PatternId =
  | 'wo'
  | 'ni'
  | 'ni_return'
  | 'to'
  | 'de'
  | 'adv_v'
  | 'teiru'
  | 'tai_wo'
  | 'tai_adv'
  | 'tai_ni'
  | 'ta_wo'
  | 'ta_ni'
  | 'ta_adv'
  | 'nai_wo'
  | 'nakatta_wo'
  | 'nakatta_adv'
  | 'adj_pred'
  | 'i_n_wo'
  | 'i_n_ni'
  | 'de_go'
  | 'ga_pot'
  | 'adv_pot'
  | 'ga_suki'
  | 'na_ga_suki'
  | 'koto_wo'

interface Row {
  id: number
  pattern: PatternId
  P: string
  N?: string
  V?: string
  Adv?: string
  IAdj?: string
  NaAdj?: string
  Adj?: string
}

const ROWS: Row[] = [
  { id: 1, pattern: 'wo', P: '私', N: '水', V: '飲む' },
  { id: 2, pattern: 'wo', P: '私', N: 'お茶', V: '飲む' },
  { id: 3, pattern: 'wo', P: '私', N: 'コーヒー', V: '飲む' },
  { id: 4, pattern: 'wo', P: '彼', N: '水', V: '飲む' },
  { id: 5, pattern: 'wo', P: '彼女', N: '水', V: '飲む' },
  { id: 6, pattern: 'wo', P: '私', N: 'ご飯', V: '食べる' },
  { id: 7, pattern: 'wo', P: '私', N: 'パン', V: '食べる' },
  { id: 8, pattern: 'wo', P: '私', N: 'りんご', V: '食べる' },
  { id: 9, pattern: 'wo', P: '彼', N: 'ご飯', V: '食べる' },
  { id: 10, pattern: 'wo', P: '彼女', N: 'パン', V: '食べる' },
  { id: 11, pattern: 'wo', P: '私', N: '本', V: '読む' },
  { id: 12, pattern: 'wo', P: '私', N: '新聞', V: '読む' },
  { id: 13, pattern: 'wo', P: '私', N: '雑誌', V: '読む' },
  { id: 14, pattern: 'wo', P: '彼', N: '本', V: '読む' },
  { id: 15, pattern: 'wo', P: '彼女', N: '新聞', V: '読む' },
  { id: 16, pattern: 'wo', P: '私', N: '音楽', V: '聞く' },
  { id: 17, pattern: 'wo', P: '私', N: 'ラジオ', V: '聞く' },
  { id: 18, pattern: 'wo', P: '私', N: '歌', V: '聞く' },
  { id: 19, pattern: 'wo', P: '彼', N: '音楽', V: '聞く' },
  { id: 20, pattern: 'wo', P: '彼女', N: '歌', V: '聞く' },
  { id: 21, pattern: 'ni', P: '私', N: '学校', V: '行く' },
  { id: 22, pattern: 'ni', P: '私', N: '会社', V: '行く' },
  { id: 23, pattern: 'ni', P: '私', N: '駅', V: '行く' },
  { id: 24, pattern: 'ni', P: '彼', N: '学校', V: '行く' },
  { id: 25, pattern: 'ni', P: '彼女', N: '会社', V: '行く' },
  { id: 26, pattern: 'ni_return', P: '私', N: '家', V: '帰る' },
  { id: 27, pattern: 'ni_return', P: '私', N: '部屋', V: '帰る' },
  { id: 28, pattern: 'ni_return', P: '私', N: 'ホテル', V: '帰る' },
  { id: 29, pattern: 'ni_return', P: '彼', N: '家', V: '帰る' },
  { id: 30, pattern: 'ni_return', P: '彼女', N: 'ホテル', V: '帰る' },
  { id: 31, pattern: 'to', P: '私', N: '友達', V: '話す' },
  { id: 32, pattern: 'to', P: '私', N: '先生', V: '話す' },
  { id: 33, pattern: 'to', P: '私', N: '母', V: '話す' },
  { id: 34, pattern: 'to', P: '彼', N: '友達', V: '話す' },
  { id: 35, pattern: 'to', P: '彼女', N: '先生', V: '話す' },
  { id: 36, pattern: 'wo', P: '私', N: '映画', V: '見る' },
  { id: 37, pattern: 'wo', P: '私', N: 'テレビ', V: '見る' },
  { id: 38, pattern: 'wo', P: '私', N: '動画', V: '見る' },
  { id: 39, pattern: 'wo', P: '彼', N: '映画', V: '見る' },
  { id: 40, pattern: 'wo', P: '彼女', N: 'テレビ', V: '見る' },
  { id: 41, pattern: 'adv_v', P: '私', Adv: '早く', V: '起きる' },
  { id: 42, pattern: 'adv_v', P: '私', Adv: '遅く', V: '起きる' },
  { id: 43, pattern: 'adv_v', P: '彼', Adv: '早く', V: '起きる' },
  { id: 44, pattern: 'adv_v', P: '彼女', Adv: '遅く', V: '起きる' },
  { id: 45, pattern: 'adv_v', P: '私', Adv: '毎日', V: '起きる' },
  { id: 46, pattern: 'wo', P: '私', N: '日本語', V: '勉強する' },
  { id: 47, pattern: 'wo', P: '私', N: '英語', V: '勉強する' },
  { id: 48, pattern: 'wo', P: '私', N: '数学', V: '勉強する' },
  { id: 49, pattern: 'wo', P: '彼', N: '日本語', V: '勉強する' },
  { id: 50, pattern: 'wo', P: '彼女', N: '英語', V: '勉強する' },
  { id: 51, pattern: 'wo', P: '私', N: '仕事', V: '始める' },
  { id: 52, pattern: 'wo', P: '私', N: '勉強', V: '始める' },
  { id: 53, pattern: 'wo', P: '彼', N: '仕事', V: '始める' },
  { id: 54, pattern: 'wo', P: '彼女', N: '勉強', V: '始める' },
  { id: 55, pattern: 'wo', P: '私', N: '新しいこと', V: '始める' },
  { id: 56, pattern: 'wo', P: '私', N: '本', V: '買う' },
  { id: 57, pattern: 'wo', P: '私', N: '服', V: '買う' },
  { id: 58, pattern: 'wo', P: '私', N: '食べ物', V: '買う' },
  { id: 59, pattern: 'wo', P: '彼', N: '本', V: '買う' },
  { id: 60, pattern: 'wo', P: '彼女', N: '服', V: '買う' },
  { id: 61, pattern: 'de', P: '私', N: '店', V: '働く' },
  { id: 62, pattern: 'de', P: '私', N: '会社', V: '働く' },
  { id: 63, pattern: 'de', P: '私', N: '家', V: '働く' },
  { id: 64, pattern: 'de', P: '彼', N: '会社', V: '働く' },
  { id: 65, pattern: 'de', P: '彼女', N: '店', V: '働く' },
  { id: 66, pattern: 'de', P: '私', N: '公園', V: '走る' },
  { id: 67, pattern: 'de', P: '私', N: '道', V: '走る' },
  { id: 68, pattern: 'de', P: '彼', N: '公園', V: '走る' },
  { id: 69, pattern: 'de', P: '彼女', N: '道', V: '走る' },
  { id: 70, pattern: 'adv_v', P: '私', Adv: '毎日', V: '走る' },
  { id: 71, pattern: 'ni', P: '私', N: '友達', V: '会う' },
  { id: 72, pattern: 'ni', P: '私', N: '先生', V: '会う' },
  { id: 73, pattern: 'ni', P: '私', N: '家族', V: '会う' },
  { id: 74, pattern: 'ni', P: '彼', N: '友達', V: '会う' },
  { id: 75, pattern: 'ni', P: '彼女', N: '家族', V: '会う' },
  { id: 76, pattern: 'teiru', P: '私', N: '音楽', V: '聞いている' },
  { id: 77, pattern: 'teiru', P: '私', N: '本', V: '読んでいる' },
  { id: 78, pattern: 'teiru', P: '私', N: 'テレビ', V: '見ている' },
  { id: 79, pattern: 'teiru', P: '彼', N: '音楽', V: '聞いている' },
  { id: 80, pattern: 'teiru', P: '彼女', N: '本', V: '読んでいる' },
  { id: 81, pattern: 'tai_wo', P: '私', N: 'ご飯', V: '食べたい' },
  { id: 82, pattern: 'tai_wo', P: '私', N: 'パン', V: '食べたい' },
  { id: 83, pattern: 'tai_wo', P: '私', N: '寿司', V: '食べたい' },
  { id: 84, pattern: 'tai_wo', P: '彼', N: 'ご飯', V: '食べたい' },
  { id: 85, pattern: 'tai_wo', P: '彼女', N: '寿司', V: '食べたい' },
  { id: 86, pattern: 'tai_wo', P: '私', N: '水', V: '飲みたい' },
  { id: 87, pattern: 'tai_wo', P: '私', N: 'お茶', V: '飲みたい' },
  { id: 88, pattern: 'tai_wo', P: '彼', N: '水', V: '飲みたい' },
  { id: 89, pattern: 'tai_wo', P: '彼女', N: 'お茶', V: '飲みたい' },
  { id: 90, pattern: 'tai_wo', P: '私', N: 'コーヒー', V: '飲みたい' },
  { id: 91, pattern: 'tai_adv', P: '私', Adv: '早く', V: '帰りたい' },
  { id: 92, pattern: 'tai_ni', P: '私', N: '家', V: '帰りたい' },
  { id: 93, pattern: 'tai_adv', P: '彼', Adv: '早く', V: '帰りたい' },
  { id: 94, pattern: 'tai_ni', P: '彼女', N: '家', V: '帰りたい' },
  { id: 95, pattern: 'tai_adv', P: '私', Adv: 'すぐ', V: '帰りたい' },
  { id: 96, pattern: 'ta_wo', P: '私', N: '本', V: '読んだ' },
  { id: 97, pattern: 'ta_wo', P: '私', N: '映画', V: '見た' },
  { id: 98, pattern: 'ta_wo', P: '私', N: 'ご飯', V: '食べた' },
  { id: 99, pattern: 'ta_wo', P: '彼', N: '本', V: '読んだ' },
  { id: 100, pattern: 'ta_wo', P: '彼女', N: '映画', V: '見た' },
  { id: 101, pattern: 'ta_ni', P: '私', N: '日本', V: '行った' },
  { id: 102, pattern: 'ta_ni', P: '私', N: '学校', V: '行った' },
  { id: 103, pattern: 'ta_ni', P: '彼', N: '日本', V: '行った' },
  { id: 104, pattern: 'ta_ni', P: '彼女', N: '学校', V: '行った' },
  { id: 105, pattern: 'ta_adv', P: '私', Adv: '昨日', V: '行った' },
  { id: 106, pattern: 'nai_wo', P: '私', N: '本', V: '読まない' },
  { id: 107, pattern: 'nai_wo', P: '私', N: '映画', V: '見ない' },
  { id: 108, pattern: 'nai_wo', P: '私', N: 'ご飯', V: '食べない' },
  { id: 109, pattern: 'nai_wo', P: '彼', N: '本', V: '読まない' },
  { id: 110, pattern: 'nai_wo', P: '彼女', N: '映画', V: '見ない' },
  { id: 111, pattern: 'nakatta_wo', P: '私', N: '水', V: '飲まなかった' },
  { id: 112, pattern: 'nakatta_wo', P: '私', N: 'ご飯', V: '食べなかった' },
  { id: 113, pattern: 'nakatta_wo', P: '彼', N: '水', V: '飲まなかった' },
  { id: 114, pattern: 'nakatta_wo', P: '彼女', N: 'ご飯', V: '食べなかった' },
  { id: 115, pattern: 'nakatta_adv', P: '私', Adv: '昨日', V: '食べなかった' },
  { id: 116, pattern: 'adv_v', P: '私', Adv: 'もっと', V: '勉強する' },
  { id: 117, pattern: 'adv_v', P: '私', Adv: '少し', V: '勉強する' },
  { id: 118, pattern: 'adv_v', P: '私', Adv: '毎日', V: '勉強する' },
  { id: 119, pattern: 'adv_v', P: '彼', Adv: 'もっと', V: '勉強する' },
  { id: 120, pattern: 'adv_v', P: '彼女', Adv: '毎日', V: '勉強する' },
  { id: 121, pattern: 'adj_pred', P: '私', Adv: 'とても', Adj: '疲れている' },
  { id: 122, pattern: 'adj_pred', P: '私', Adv: '少し', Adj: '疲れている' },
  { id: 123, pattern: 'adj_pred', P: '彼', Adv: 'とても', Adj: '疲れている' },
  { id: 124, pattern: 'adj_pred', P: '彼女', Adv: '少し', Adj: '疲れている' },
  { id: 125, pattern: 'adj_pred', P: '私', Adv: '今日', Adj: '疲れている' },
  { id: 126, pattern: 'i_n_wo', P: '私', IAdj: '新しい', N: '本', V: '読む' },
  { id: 127, pattern: 'i_n_wo', P: '私', IAdj: '古い', N: '本', V: '読む' },
  { id: 128, pattern: 'i_n_wo', P: '彼', IAdj: '新しい', N: '本', V: '読む' },
  { id: 129, pattern: 'i_n_wo', P: '彼女', IAdj: '古い', N: '本', V: '読む' },
  { id: 130, pattern: 'i_n_wo', P: '私', IAdj: '面白い', N: '本', V: '読む' },
  { id: 131, pattern: 'i_n_ni', P: '私', IAdj: '大きい', N: '家', V: '住む' },
  { id: 132, pattern: 'i_n_ni', P: '私', IAdj: '小さい', N: '家', V: '住む' },
  { id: 133, pattern: 'i_n_ni', P: '彼', IAdj: '大きい', N: '家', V: '住む' },
  { id: 134, pattern: 'i_n_ni', P: '彼女', IAdj: '小さい', N: '家', V: '住む' },
  { id: 135, pattern: 'i_n_ni', P: '私', IAdj: '静か', N: '家', V: '住む' },
  { id: 136, pattern: 'de_go', P: '私', N: '電車', V: '行く' },
  { id: 137, pattern: 'de_go', P: '私', N: 'バス', V: '行く' },
  { id: 138, pattern: 'de_go', P: '私', N: '車', V: '行く' },
  { id: 139, pattern: 'de_go', P: '彼', N: '電車', V: '行く' },
  { id: 140, pattern: 'de_go', P: '彼女', N: '車', V: '行く' },
  { id: 141, pattern: 'to', P: '私', N: '友達', V: '遊ぶ' },
  { id: 142, pattern: 'to', P: '私', N: '家族', V: '遊ぶ' },
  { id: 143, pattern: 'to', P: '彼', N: '友達', V: '遊ぶ' },
  { id: 144, pattern: 'to', P: '彼女', N: '家族', V: '遊ぶ' },
  { id: 145, pattern: 'adv_v', P: '私', Adv: '毎日', V: '遊ぶ' },
  { id: 146, pattern: 'ga_pot', P: '私', N: '英語', V: '話せる' },
  { id: 147, pattern: 'ga_pot', P: '私', N: '日本語', V: '話せる' },
  { id: 148, pattern: 'ga_pot', P: '彼', N: '英語', V: '話せる' },
  { id: 149, pattern: 'ga_pot', P: '彼女', N: '日本語', V: '話せる' },
  { id: 150, pattern: 'adv_pot', P: '私', Adv: '少し', V: '話せる' },
  { id: 151, pattern: 'adv_v', P: '私', Adv: '早く', V: '寝る' },
  { id: 152, pattern: 'adv_v', P: '私', Adv: '遅く', V: '寝る' },
  { id: 153, pattern: 'adv_v', P: '彼', Adv: '早く', V: '寝る' },
  { id: 154, pattern: 'adv_v', P: '彼女', Adv: '遅く', V: '寝る' },
  { id: 155, pattern: 'adv_v', P: '私', Adv: '毎日', V: '寝る' },
  { id: 156, pattern: 'ni', P: '私', N: '友達', V: '電話する' },
  { id: 157, pattern: 'ni', P: '私', N: '母', V: '電話する' },
  { id: 158, pattern: 'ni', P: '彼', N: '友達', V: '電話する' },
  { id: 159, pattern: 'ni', P: '彼女', N: '母', V: '電話する' },
  { id: 160, pattern: 'adv_v', P: '私', Adv: '毎日', V: '電話する' },
  { id: 161, pattern: 'de', P: '私', N: '店', V: '買い物する' },
  { id: 162, pattern: 'de', P: '私', N: 'スーパー', V: '買い物する' },
  { id: 163, pattern: 'de', P: '彼', N: '店', V: '買い物する' },
  { id: 164, pattern: 'de', P: '彼女', N: 'スーパー', V: '買い物する' },
  { id: 165, pattern: 'adv_v', P: '私', Adv: 'よく', V: '買い物する' },
  { id: 166, pattern: 'wo', P: '私', N: '新しいこと', V: '学ぶ' },
  { id: 167, pattern: 'wo', P: '私', N: '日本語', V: '学ぶ' },
  { id: 168, pattern: 'wo', P: '彼', N: '新しいこと', V: '学ぶ' },
  { id: 169, pattern: 'wo', P: '彼女', N: '日本語', V: '学ぶ' },
  { id: 170, pattern: 'adv_v', P: '私', Adv: '毎日', V: '学ぶ' },
  { id: 171, pattern: 'de', P: '私', N: '公園', V: '休む' },
  { id: 172, pattern: 'de', P: '私', N: '家', V: '休む' },
  { id: 173, pattern: 'de', P: '彼', N: '公園', V: '休む' },
  { id: 174, pattern: 'de', P: '彼女', N: '家', V: '休む' },
  { id: 175, pattern: 'adv_v', P: '私', Adv: '毎日', V: '休む' },
  { id: 176, pattern: 'wo', P: '私', N: '写真', V: '撮る' },
  { id: 177, pattern: 'wo', P: '私', N: '景色', V: '撮る' },
  { id: 178, pattern: 'wo', P: '彼', N: '写真', V: '撮る' },
  { id: 179, pattern: 'wo', P: '彼女', N: '景色', V: '撮る' },
  { id: 180, pattern: 'adv_v', P: '私', Adv: 'よく', V: '撮る' },
  { id: 181, pattern: 'wo', P: '私', N: '料理', V: '作る' },
  { id: 182, pattern: 'wo', P: '私', N: '夕飯', V: '作る' },
  { id: 183, pattern: 'wo', P: '彼', N: '料理', V: '作る' },
  { id: 184, pattern: 'wo', P: '彼女', N: '夕飯', V: '作る' },
  { id: 185, pattern: 'adv_v', P: '私', Adv: '毎日', V: '作る' },
  { id: 186, pattern: 'ni', P: '私', N: '新しい店', V: '行く' },
  { id: 187, pattern: 'ni', P: '私', N: '有名な店', V: '行く' },
  { id: 188, pattern: 'ni', P: '彼', N: '新しい店', V: '行く' },
  { id: 189, pattern: 'ni', P: '彼女', N: '有名な店', V: '行く' },
  { id: 190, pattern: 'adv_v', P: '私', Adv: 'よく', V: '行く' },
  { id: 191, pattern: 'ga_suki', P: '私', N: '音楽' },
  { id: 192, pattern: 'ga_suki', P: '私', N: '映画' },
  { id: 193, pattern: 'ga_suki', P: '彼', N: '音楽' },
  { id: 194, pattern: 'ga_suki', P: '彼女', N: '映画' },
  { id: 195, pattern: 'ga_suki', P: '私', N: 'スポーツ' },
  { id: 196, pattern: 'na_ga_suki', P: '私', NaAdj: '静か', N: '場所' },
  { id: 197, pattern: 'na_ga_suki', P: '私', NaAdj: 'にぎやか', N: '場所' },
  { id: 198, pattern: 'na_ga_suki', P: '彼', NaAdj: '静か', N: '場所' },
  { id: 199, pattern: 'na_ga_suki', P: '彼女', NaAdj: 'にぎやか', N: '場所' },
  { id: 200, pattern: 'na_ga_suki', P: '私', NaAdj: '新しい', N: '場所' },
]

const SLOT_KEYS: Record<PatternId, string[]> = {
  wo: ['P', 'N', 'V'],
  ni: ['P', 'N', 'V'],
  ni_return: ['P', 'N'],
  to: ['P', 'N', 'V'],
  de: ['P', 'N', 'V'],
  adv_v: ['P', 'Adv', 'V'],
  teiru: ['P', 'N', 'V'],
  tai_wo: ['P', 'N', 'V'],
  tai_adv: ['P', 'Adv', 'V'],
  tai_ni: ['P', 'N', 'V'],
  ta_wo: ['P', 'N', 'V'],
  ta_ni: ['P', 'N', 'V'],
  ta_adv: ['P', 'Adv', 'V'],
  nai_wo: ['P', 'N', 'V'],
  nakatta_wo: ['P', 'N', 'V'],
  nakatta_adv: ['P', 'Adv', 'V'],
  adj_pred: ['P', 'Adv', 'Adj'],
  i_n_wo: ['P', 'IAdj', 'N', 'V'],
  i_n_ni: ['P', 'IAdj', 'N', 'V'],
  de_go: ['P', 'N', 'V'],
  ga_pot: ['P', 'N', 'V'],
  adv_pot: ['P', 'Adv', 'V'],
  ga_suki: ['P', 'N'],
  na_ga_suki: ['P', 'NaAdj', 'N'],
  koto_wo: ['P', 'N', 'V'],
}

function lit(text: string) {
  return JSON.stringify({ key: '_', text, swappable: false })
}

function seg(key: string, text: string, swappable = true) {
  return JSON.stringify({ key, text, swappable, posCategory: key === 'P' ? 'pronoun' : key === 'N' ? 'noun' : key === 'V' ? 'verb' : key === 'Adv' ? 'adverb' : key === 'IAdj' ? 'i_adj' : key === 'NaAdj' ? 'na_adj' : undefined })
}

function buildSegments(row: Row): string {
  const parts: string[] = []
  const push = (s: string) => parts.push(s)

  switch (row.pattern) {
    case 'wo':
    case 'teiru':
    case 'tai_wo':
    case 'ta_wo':
    case 'nai_wo':
    case 'nakatta_wo':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('N', row.N!))
      push(lit('を'))
      push(seg('V', row.V!))
      break
    case 'koto_wo':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('N', row.N!))
      push(lit('を'))
      push(seg('V', row.V!))
      break
    case 'ni':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('N', row.N!))
      push(lit('に'))
      push(seg('V', row.V!))
      break
    case 'ni_return':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('N', row.N!))
      push(lit('に'))
      push(seg('V', '帰る'))
      break
    case 'to':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('N', row.N!))
      push(lit('と'))
      push(seg('V', row.V!))
      break
    case 'de':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('N', row.N!))
      push(lit('で'))
      push(seg('V', row.V!))
      break
    case 'de_go':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('N', row.N!))
      push(lit('で'))
      push(seg('V', '行く'))
      break
    case 'adv_v':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('Adv', row.Adv!))
      push(seg('V', row.V!))
      break
    case 'tai_adv':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('Adv', row.Adv!))
      push(seg('V', '帰りたい'))
      break
    case 'tai_ni':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('N', row.N!))
      push(lit('に'))
      push(seg('V', '帰りたい'))
      break
    case 'ta_ni':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('N', row.N!))
      push(lit('に'))
      push(seg('V', '行った'))
      break
    case 'ta_adv':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('Adv', row.Adv!))
      push(seg('V', '行った'))
      break
    case 'nakatta_adv':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('Adv', row.Adv!))
      push(seg('V', '食べなかった'))
      break
    case 'adj_pred':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('Adv', row.Adv!))
      push(seg('Adj', row.Adj!))
      break
    case 'i_n_wo':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('IAdj', row.IAdj!))
      push(seg('N', row.N!))
      push(lit('を'))
      push(seg('V', row.V!))
      break
    case 'i_n_ni':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('IAdj', row.IAdj!))
      push(seg('N', row.N!))
      push(lit('に'))
      push(seg('V', row.V!))
      break
    case 'ga_pot':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('N', row.N!))
      push(lit('が'))
      push(seg('V', row.V!))
      break
    case 'adv_pot':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('Adv', row.Adv!))
      push(seg('V', row.V!))
      break
    case 'ga_suki':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('N', row.N!))
      push(lit('が好きだ'))
      break
    case 'na_ga_suki':
      push(seg('P', row.P!))
      push(lit('は'))
      push(seg('NaAdj', row.NaAdj!))
      push(seg('N', row.N!))
      push(lit('が好きだ'))
      break
    default:
      throw new Error(`Unknown pattern ${row.pattern}`)
  }
  return `[${parts.join(', ')}]`
}

function slotValue(row: Row, key: string): string {
  return (row as Record<string, string | undefined>)[key] ?? ''
}

function hammingOne(a: Row, b: Row): string | null {
  if (a.pattern !== b.pattern) return null
  const keys = SLOT_KEYS[a.pattern]
  let diff: string | null = null
  for (const k of keys) {
    if (slotValue(a, k) !== slotValue(b, k)) {
      if (diff) return null
      diff = k
    }
  }
  return diff
}

const neighbors: Record<number, number[]> = {}
for (const row of ROWS) {
  neighbors[row.id] = []
}
for (let i = 0; i < ROWS.length; i++) {
  for (let j = i + 1; j < ROWS.length; j++) {
    const diff = hammingOne(ROWS[i]!, ROWS[j]!)
    if (diff) {
      neighbors[ROWS[i]!.id]!.push(ROWS[j]!.id)
      neighbors[ROWS[j]!.id]!.push(ROWS[i]!.id)
    }
  }
}

// English gloss builder
const PRONOUN: Record<string, [string, string]> = {
  '私': ['I', 'I'],
  '彼': ['He', 'he'],
  '彼女': ['She', 'she'],
}

const NOUN_EN: Record<string, string> = {
  '水': 'water', 'お茶': 'tea', 'コーヒー': 'coffee', 'ご飯': 'rice', 'パン': 'bread',
  'りんご': 'apples', '本': 'books', '新聞': 'newspapers', '雑誌': 'magazines',
  '音楽': 'music', 'ラジオ': 'the radio', '歌': 'songs', '学校': 'school',
  '会社': 'work', '駅': 'the station', '家': 'home', '部屋': 'my room',
  'ホテル': 'the hotel', '友達': 'friends', '先生': 'my teacher', '母': 'my mom',
  '映画': 'movies', 'テレビ': 'TV', '動画': 'videos', '日本語': 'Japanese',
  '英語': 'English', '数学': 'math', '仕事': 'work', '勉強': 'studying',
  '新しいこと': 'something new', '服': 'clothes', '食べ物': 'food',
  '店': 'the store', '公園': 'the park', '道': 'the street', '家族': 'family',
  '寿司': 'sushi', '日本': 'Japan', '電車': 'train', 'バス': 'bus', '車': 'car',
  'スーパー': 'the supermarket', '写真': 'photos', '景色': 'scenery',
  '料理': 'cooking', '夕飯': 'dinner', '新しい店': 'a new restaurant',
  '有名な店': 'a famous restaurant', 'スポーツ': 'sports', '場所': 'places',
}

const ADV_EN: Record<string, string> = {
  '早く': 'early', '遅く': 'late', '毎日': 'every day', 'もっと': 'more',
  '少し': 'a little', 'とても': 'very', '今日': 'today', '昨日': 'yesterday',
  'すぐ': 'soon', 'よく': 'often',
}

const IADJ_EN: Record<string, string> = {
  '新しい': 'new', '古い': 'old', '面白い': 'interesting', '大きい': 'big',
  '小さい': 'small', '静か': 'quiet',
}

const NAADJ_EN: Record<string, string> = {
  '静か': 'quiet', 'にぎやか': 'lively', '新しい': 'new',
}

function noun(n?: string) { return n ? (NOUN_EN[n] ?? n) : 'it' }
function subj(p: string) { return PRONOUN[p]?.[1] ?? 'I' }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function en(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function verbPair(who: string, first: string, third: string): string {
  return who === 'I' ? first : third
}

function englishFor(row: Row): string {
  const who = subj(row.P)
  const Who = cap(who)

  switch (row.pattern) {
    case 'wo': {
      const v = row.V!
      const n = row.N!
      if (v === '撮る') {
        if (n === '景色') return en(`${Who} ${verbPair(who, 'take photos of', 'takes photos of')} scenery`)
        return en(`${Who} ${verbPair(who, 'take', 'takes')} photos`)
      }
      if (v === '作る') {
        if (n === '夕飯') return en(`${Who} ${verbPair(who, 'make', 'makes')} dinner`)
        return en(`${Who} ${verbPair(who, 'cook', 'cooks')}`)
      }
      const obj = noun(n)
      const verbs: Record<string, [string, string]> = {
        '飲む': ['drink', 'drinks'], '食べる': ['eat', 'eats'], '読む': ['read', 'reads'],
        '聞く': ['listen to', 'listens to'], '見る': ['watch', 'watches'],
        '勉強する': ['study', 'studies'], '始める': ['start', 'starts'], '買う': ['buy', 'buys'],
        '学ぶ': ['learn', 'learns'],
      }
      const [first, third] = verbs[v] ?? ['do', 'does']
      return en(`${Who} ${verbPair(who, first, third)} ${obj}`)
    }
    case 'ni': {
      const v = row.V!
      const n = row.N!
      if (v === '電話する') return en(`${Who} ${verbPair(who, 'call', 'calls')} ${noun(n)}`)
      if (v === '会う') return en(`${Who} ${verbPair(who, 'meet', 'meets')} ${noun(n)}`)
      const dest = n === '会社' ? 'work' : noun(n)
      return en(`${Who} ${verbPair(who, 'go', 'goes')} to ${dest}`)
    }
    case 'ni_return': {
      const n = row.N!
      if (n === '家') return en(`${Who} ${verbPair(who, 'return', 'returns')} home`)
      return en(`${Who} ${verbPair(who, 'return', 'returns')} to ${noun(n)}`)
    }
    case 'to': {
      const v = row.V!
      const n = noun(row.N)
      if (v === '話す') return en(`${Who} ${verbPair(who, 'talk', 'talks')} with ${n}`)
      return en(`${Who} ${verbPair(who, 'play', 'plays')} with ${n}`)
    }
    case 'de': {
      const v = row.V!
      const n = row.N!
      const place = n === '会社' ? 'the office' : noun(n)
      const map: Record<string, [string, string]> = {
        '働く': ['work', 'works'], '走る': ['run', 'runs'], '買い物する': ['shop', 'shops'],
        '休む': ['rest', 'rests'],
      }
      const [first, third] = map[v] ?? ['am', 'is']
      return en(`${Who} ${verbPair(who, first, third)} at ${place}`)
    }
    case 'de_go':
      return en(`${Who} ${verbPair(who, 'go', 'goes')} by ${noun(row.N)}`)
    case 'adv_v': {
      const adv = ADV_EN[row.Adv!] ?? row.Adv!
      const v = row.V!
      if (row.Adv === 'もっと' && v === '勉強する') {
        return en(`${Who} ${verbPair(who, 'study', 'studies')} more`)
      }
      const map: Record<string, [string, string]> = {
        '起きる': ['wake up', 'wakes up'], '勉強する': ['study', 'studies'],
        '走る': ['run', 'runs'], '遊ぶ': ['play', 'plays'], '寝る': ['sleep', 'sleeps'],
        '電話する': ['call', 'calls'], '買い物する': ['shop', 'shops'], '学ぶ': ['learn', 'learns'],
        '休む': ['rest', 'rests'], '撮る': ['take photos', 'takes photos'],
        '作る': ['cook', 'cooks'], '行く': ['go', 'goes'],
      }
      const [first, third] = map[v] ?? ['do it', 'does it']
      return en(`${Who} ${verbPair(who, first, third)} ${adv}`)
    }
    case 'teiru': {
      const map: Record<string, [string, string]> = {
        '聞いている': ['am listening to', 'is listening to'],
        '読んでいる': ['am reading', 'is reading'],
        '見ている': ['am watching', 'is watching'],
      }
      const [first, third] = map[row.V!] ?? ['am doing', 'is doing']
      return en(`${Who} ${verbPair(who, first, third)} ${noun(row.N)}`)
    }
    case 'tai_wo': {
      const n = noun(row.N)
      let verb = 'have'
      if (row.V === '食べたい') verb = 'eat'
      else if (row.V === '飲みたい') verb = 'drink'
      return en(`${Who} ${verbPair(who, 'want', 'wants')} to ${verb} ${n}`)
    }
    case 'tai_adv':
      return en(`${Who} ${verbPair(who, 'want', 'wants')} to go home ${ADV_EN[row.Adv!] ?? row.Adv}`)
    case 'tai_ni': {
      const n = row.N!
      if (n === '家') return en(`${Who} ${verbPair(who, 'want', 'wants')} to go home`)
      return en(`${Who} ${verbPair(who, 'want', 'wants')} to go to ${noun(n)}`)
    }
    case 'ta_wo': {
      const map: Record<string, string> = {
        '読んだ': 'read', '見た': 'watched', '食べた': 'ate',
      }
      return en(`${Who} ${map[row.V!] ?? 'did'} ${noun(row.N)}`)
    }
    case 'ta_ni':
      return en(`${Who} went to ${noun(row.N)}`)
    case 'ta_adv':
      return en(`${Who} went ${ADV_EN[row.Adv!] ?? row.Adv}`)
    case 'nai_wo': {
      const map: Record<string, string> = {
        '読まない': 'read', '見ない': 'watch', '食べない': 'eat',
      }
      const verb = map[row.V!] ?? 'do'
      return who === 'I'
        ? en(`${Who} do not ${verb} ${noun(row.N)}`)
        : en(`${Who} does not ${verb} ${noun(row.N)}`)
    }
    case 'nakatta_wo': {
      const map: Record<string, string> = {
        '飲まなかった': 'drink', '食べなかった': 'eat',
      }
      return en(`${Who} did not ${map[row.V!] ?? 'do'} ${noun(row.N)}`)
    }
    case 'nakatta_adv':
      return en(`${Who} did not eat ${ADV_EN[row.Adv!] ?? row.Adv}`)
    case 'adj_pred': {
      if (row.Adv === '今日') return en(`${Who} ${verbPair(who, 'am', 'is')} tired today`)
      return en(`${Who} ${verbPair(who, 'am', 'is')} ${ADV_EN[row.Adv!] ?? row.Adv} tired`)
    }
    case 'i_n_wo':
      return en(`${Who} ${verbPair(who, 'read', 'reads')} ${IADJ_EN[row.IAdj!] ?? row.IAdj} ${noun(row.N)}`)
    case 'i_n_ni':
      return en(`${Who} ${verbPair(who, 'live', 'lives')} in a ${IADJ_EN[row.IAdj!] ?? row.IAdj} house`)
    case 'ga_pot':
      return en(`${Who} can speak ${noun(row.N)}`)
    case 'adv_pot':
      return en(`${Who} can speak ${ADV_EN[row.Adv!] ?? row.Adv}`)
    case 'ga_suki':
      return en(`${Who} ${verbPair(who, 'like', 'likes')} ${noun(row.N)}`)
    case 'na_ga_suki':
      return en(`${Who} ${verbPair(who, 'like', 'likes')} ${NAADJ_EN[row.NaAdj!] ?? row.NaAdj} places`)
    case 'koto_wo':
      return en(`${Who} ${verbPair(who, 'start', 'starts')} something new`)
    default:
      return ''
  }
}

function englishForFixed(row: Row): string {
  return englishFor(row)
}

const entries = ROWS.map((row) => {
  const jp = JSON.parse(buildSegments(row).replace(/'/g, '"').replace(/(\w+):/g, '"$1":'))
    .map((s: { text: string }) => s.text).join('')
  return `  {
    id: ${row.id},
    pattern: '${row.pattern}',
    slots: ${JSON.stringify(Object.fromEntries(SLOT_KEYS[row.pattern].map((k) => [k, slotValue(row, k)])))},
    segments: ${buildSegments(row)},
    japanese: ${JSON.stringify(jp)},
    english: ${JSON.stringify(englishForFixed(row))},
    neighbors: ${JSON.stringify(neighbors[row.id]!.sort((a, b) => a - b))},
  }`
})

const out = `// AUTO-GENERATED by scripts/gen-curated-hero-data.ts — do not edit by hand
import type { HeroSegment } from '../lib/posSentenceEngine'

export type CuratedPatternId =
${Object.keys(SLOT_KEYS).map((k) => `  | '${k}'`).join('\n')}

export interface CuratedHeroSentence {
  id: number
  pattern: CuratedPatternId
  slots: Record<string, string>
  segments: HeroSegment[]
  japanese: string
  english: string
  neighbors: readonly number[]
}

export const CURATED_HERO_SENTENCES: readonly CuratedHeroSentence[] = [
${entries.join(',\n')},
]

export const CURATED_BY_ID: ReadonlyMap<number, CuratedHeroSentence> = new Map(
  CURATED_HERO_SENTENCES.map((s) => [s.id, s]),
)
`

const target = join(process.cwd(), 'src', 'data', 'curatedHeroSentences.ts')
writeFileSync(target, out, 'utf8')
console.log(`Wrote ${ROWS.length} sentences to ${target}`)

// Audit neighbor coverage
let deadEnds = 0
for (const row of ROWS) {
  if ((neighbors[row.id]?.length ?? 0) === 0) deadEnds++
}
console.log(`Dead ends (no neighbors): ${deadEnds}`)
