import type { HeroPhraseRole } from './heroPhraseRole'
import {
  HERO_BORROW_OBJECTS,
  HERO_LISTEN_OBJECTS,
  HERO_READ_OBJECTS,
  HERO_WATCH_OBJECTS,
} from '../data/heroVerbObjectLibrary'
import { findMasuVerbBase } from './heroPredicateConjugation'

const ROLE_OBJECT_PARTICLE: Partial<Record<HeroPhraseRole, string>> = {
  go: 'に',
  meet: 'に',
  wait: 'に',
}

const ROLE_PREDICATE_BASE: Partial<Record<HeroPhraseRole, string>> = {
  eat: '食べます',
  drink: '飲みます',
  read: '読みます',
  watch: '見ます',
  listen: '聞きます',
  use: '使います',
  make: '作ります',
  takePhoto: '撮ります',
  study: '勉強します',
  buy: '買います',
  activity: 'します',
  meet: '会います',
  wait: '待ちます',
  go: '行きます',
}

/** Whether a collocation role is compatible with a word's verb-object semantics */
export function roleFitsVerbObject(word: string, role: HeroPhraseRole): boolean {
  const base = ROLE_PREDICATE_BASE[role]
  if (!base) return true
  const particle = ROLE_OBJECT_PARTICLE[role] ?? 'を'
  return wordFitsPredicate(word, base, particle)
}

const FOOD_WORDS = new Set([
  'ピザ', '寿司', '弁当', 'ラーメン', 'ハンバーガー', 'サラダ', 'ケーキ',
  'チョコレート', 'パン', '魚', '肉', '米', '卵', '野菜', '果物',
])

const DRINK_WORDS = new Set([
  'コーヒー', 'ジュース', 'ミルク', 'お茶', 'ビール', 'ワイン',
])

const READ_WORDS = new Set<string>(HERO_READ_OBJECTS)

const WATCH_WORDS = new Set<string>(HERO_WATCH_OBJECTS)

const LISTEN_WORDS = new Set<string>(HERO_LISTEN_OBJECTS)

const BORROW_WORDS = new Set<string>(HERO_BORROW_OBJECTS)

const USE_WORDS = new Set(['車', '電車', '地図', '辞書', 'パソコン', 'かばん'])

const MAKE_WORDS = new Set(['ケーキ', '料理', 'パン', '弁当'])

const PHOTO_WORDS = new Set(['写真'])

const STUDY_WORDS = new Set([
  '漢字', '日本語', '数学', '科学', '歴史', '哲学', '政治', '社会',
  '経済', '文化', '芸術', '教育', '研究', '技術', '産業', '国際', '宗教',
])

const PEOPLE_WORDS = new Set(['友達', '先生', '恋人', '両親'])

const PLACE_WORDS = new Set([
  '京都', '東京', '大阪', '公園', '駅', '空港', '銀行', '病院', '図書館',
  '美術館', '動物園', '港', '島', '町', '村', '海', '温泉', '神社', '寺',
  'レストラン', 'ホテル', '学校', '会社', '教室', '市場', '庭', '川', '山',
  'デート',
])

const ACTIVITY_WORDS = new Set(['野球', 'テニス', 'ゴルフ', '散歩', '買い物'])

const BUY_WORDS = new Set([
  'ピザ', '寿司', '弁当', 'ラーメン', 'ケーキ', 'パン', '花', 'かばん',
  'パソコン', 'プレゼント', '切符', 'チケット', '地図', '辞書', '本', '雑誌',
])

const WO_VERB_WORDS: Record<string, ReadonlySet<string>> = {
  食べます: FOOD_WORDS,
  飲みます: DRINK_WORDS,
  読みます: READ_WORDS,
  見ます: WATCH_WORDS,
  聞きます: LISTEN_WORDS,
  借ります: BORROW_WORDS,
  使います: USE_WORDS,
  作ります: MAKE_WORDS,
  撮ります: PHOTO_WORDS,
  勉強します: STUDY_WORDS,
  買います: BUY_WORDS,
  します: ACTIVITY_WORDS,
  話します: new Set(['日本語']),
  歌います: new Set(['歌', '音楽']),
  始めます: new Set([...STUDY_WORDS, '仕事', '勉強', '料理', '映画']),
  覚えます: STUDY_WORDS,
  待ちます: PEOPLE_WORDS,
}

const NI_VERB_WORDS: Record<string, ReadonlySet<string>> = {
  行きます: PLACE_WORDS,
  来ます: PLACE_WORDS,
  帰ります: PLACE_WORDS,
  会います: PEOPLE_WORDS,
}

const PHONE_PREDICATES = new Set([
  '電話します', '電話しました', '電話しません', '電話しませんでした',
])

const MODIFIER_VERB_DENY: Partial<Record<string, Partial<Record<string, ReadonlySet<string>>>>> = {
  '友達と会って、': {
    読みます: new Set(['地図', '新聞', '雑誌']),
    見ます: new Set(['本', '小説', '雑誌', '新聞', '漫画', '文学', '哲学', '歴史']),
    買います: new Set(['地図']),
  },
  '図書館に行って、': {
    見ます: new Set(['本', '小説', '雑誌', '新聞', '漫画', '文学', '哲学', '歴史', '経済', '政治']),
  },
}

/** Whether a vocab word makes sense with the frame's predicate + particle */
export function wordFitsPredicate(
  word: string,
  predicate: string,
  objectParticle: string,
  modifier = '',
): boolean {
  if (PHONE_PREDICATES.has(predicate)) {
    return PEOPLE_WORDS.has(word)
  }

  const base = findMasuVerbBase(predicate)
  if (base && modifier) {
    const deny = MODIFIER_VERB_DENY[modifier]?.[base]
    if (deny?.has(word)) return false
  }

  if (objectParticle === 'に') {
    if (!base) return false
    const allowed = NI_VERB_WORDS[base]
    if (!allowed) return false
    return allowed.has(word)
  }

  if (objectParticle !== 'を') return true

  if (!base) return false

  const allowed = WO_VERB_WORDS[base]
  if (!allowed) return false
  return allowed.has(word)
}

/** English object tweaks for natural verb pairing */
export function naturalVerbObject(
  word: string,
  predicateBase: string,
  defaultObject: string,
): string {
  if (predicateBase === '見ます' && word === '写真') return 'photos'
  if (predicateBase === '見ます' && ['本', '小説', '雑誌', '新聞', '漫画', '文学', '哲学', '歴史', '経済', '政治'].includes(word)) {
    return defaultObject
  }
  if (predicateBase === '読みます' && ['映画', 'ドラマ', 'アニメ', 'テレビ', '写真'].includes(word)) {
    return defaultObject
  }
  if (predicateBase === '借ります' && word === '写真') return 'photo books'
  if (predicateBase === '借ります' && word === '映画') return 'movies'
  if (predicateBase === '聞きます') {
    return defaultObject.startsWith('to ') ? defaultObject : `to ${defaultObject}`
  }
  return defaultObject
}
