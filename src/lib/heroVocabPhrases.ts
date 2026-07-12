import { allCards } from '../data'
import { hasAnyHeroCollocation } from './heroCollocations'
import { getKanjiWordForm } from './kanjiWordForm'

const KANJI_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]/
const KANA_RE = /[\u3040-\u309F\u30A0-\u30FF]/

function isHeroEligibleShape(word: string): boolean {
  if (!word || word.length > 8) return false
  if (/[。、！？\s]/.test(word)) return false
  if (HERO_GRAMMAR_WORDS.has(word)) return false
  if (word.length === 1 && KANA_RE.test(word)) return false
  if (word.endsWith('る') || word.endsWith('ます') || word.endsWith('です')) return false
  if (word.endsWith('しい') || (word.endsWith('い') && word.length <= 3 && word !== 'いい')) return false
  return KANJI_RE.test(word) || KANA_RE.test(word)
}

function autoGlossFromBack(back: string): string {
  const first = back.split(';')[0]?.split('/')[0]?.trim() ?? ''
  return first
    .replace(/^(n\.|v\.|p\.|aux\.|cp\.|i-adj\.|adj\.|na-adj\.|adv\.|conj\.|interj\.|pron\.|disc\.|adn\.)\s*/i, '')
    .replace(/^to\s+/i, '')
    .trim()
    .toLowerCase()
}

/** Particles, auxiliaries, and grammar chunks — not hero sentence objects */
const HERO_GRAMMAR_WORDS = new Set([
  'の', 'に', 'は', 'が', 'を', 'て', 'と', 'も', 'で', 'だ', 'な', 'か', 'ね', 'よ', 'ば', 'や', 'へ',
  'から', 'まで', 'より', 'など', 'けれど', 'ので', 'のに', 'とは', 'って', 'という', 'です', 'ます',
  'ない', 'れる', 'せる', 'ある', 'なる', 'する', 'できる', 'いる', 'おる', 'こと', 'もの', 'ところ',
  'とき', 'まま', 'はず', 'わけ', 'ほう', 'あまり', 'だけ', 'ばかり', 'くらい', 'ぐらい', 'こそ', 'さえ',
  'しか', 'でも', 'たり', 'ながら', 'なら', 'ている', 'のです', 'のだ', 'てしまう', 'ておく', 'てくる',
  'ていく', 'てみる', 'てください', 'ません', 'ませんでした', 'でした', 'だった', 'ではありません',
  '好き', '嫌い', '大好き', '好きです',
])

/** Manually reviewed natural English for hero object words */
export const HERO_OBJECT_PHRASES: Record<string, string> = {
  'ピザ': 'pizza',
  '寿司': 'sushi',
  '弁当': 'a boxed lunch',
  '映画': 'movies',
  '漫画': 'manga',
  '音楽': 'music',
  '旅行': 'traveling',
  '京都': 'Kyoto',
  '東京': 'Tokyo',
  '大阪': 'Osaka',
  '公園': 'the park',
  '家族': 'spending time with family',
  'ラーメン': 'ramen',
  '日本語': 'Japanese',
  'ゴルフ': 'golf',
  'デート': 'a date',
  'ホテル': 'the hotel',
  'コーヒー': 'coffee',
  'プレゼント': 'presents',
  '誕生日': 'birthdays',
  'チョコレート': 'chocolate',
  'ハンバーガー': 'hamburgers',
  'ジュース': 'juice',
  'ミルク': 'milk',
  '新聞': 'the newspaper',
  '本': 'books',
  '雑誌': 'magazines',
  '小説': 'novels',
  '漢字': 'kanji',
  '歴史': 'history',
  '駅': 'the station',
  '空港': 'the airport',
  '車': 'a car',
  '犬': 'a dog',
  '猫': 'a cat',
  'かばん': 'a new bag',
  'パソコン': 'a new computer',
  'レストラン': 'the restaurant',
  'ドラマ': 'dramas',
  'アニメ': 'anime',
  '野球': 'baseball',
  '写真': 'pictures',
  '料理': 'cooking',
  'ラジオ': 'the radio',
  '学校': 'school',
  '会社': 'the office',
  'テニス': 'tennis',
  'パン': 'bread',
  'サラダ': 'salad',
  'ケーキ': 'cake',
  'お茶': 'tea',
  '友達': 'my friend',
  '先生': 'my teacher',
  '散歩': 'a walk',
  '買い物': 'shopping',
  '文化': 'culture',
  '海': 'the beach',
  '電車': 'the train',
  '切符': 'a ticket',
  '地図': 'a map',
  '恋人': 'my sweetheart',
  '両親': 'my parents',
  // N5 hero bulk
  '教室': 'the classroom',
  '銀行': 'the bank',
  '病院': 'the hospital',
  '魚': 'fish',
  '肉': 'meat',
  '米': 'rice',
  '卵': 'eggs',
  '野菜': 'vegetables',
  '果物': 'fruit',
  '花': 'flowers',
  '鳥': 'birds',
  'バス': 'the bus',
  '道': 'the street',
  '橋': 'bridges',
  '川': 'rivers',
  '山': 'mountains',
  '春': 'spring',
  '夏': 'summer',
  '秋': 'autumn',
  '冬': 'winter',
  '朝': 'mornings',
  '夜': 'nights',
  '仕事': 'work',
  '天気': 'the weather',
  '服': 'clothes',
  '靴': 'shoes',
  '帽子': 'hats',
  '辞書': 'dictionaries',
  '歌': 'songs',
  '財布': 'a wallet',
  // N4 hero bulk
  '図書館': 'the library',
  '美術館': 'art museums',
  '動物園': 'the zoo',
  '温泉': 'hot springs',
  '神社': 'shrines',
  '市場': 'the market',
  '港': 'the harbor',
  '島': 'islands',
  '村': 'villages',
  '町': 'towns',
  '世界': 'the world',
  '外国': 'foreign countries',
  '試験': 'exams',
  '宿題': 'homework',
  '手紙': 'letters',
  '鍵': 'keys',
  '傘': 'umbrellas',
  '眼鏡': 'glasses',
  '時計': 'watches',
  '庭': 'the garden',
  '試合': 'games',
  '練習': 'practice',
  '数学': 'math',
  '科学': 'science',
  // N3 hero bulk
  '博物館': 'museums',
  '遊園地': 'amusement parks',
  '水族館': 'aquariums',
  '劇場': 'the theater',
  '伝統': 'tradition',
  '習慣': 'customs',
  '経験': 'experience',
  '趣味': 'hobbies',
  '才能': 'talent',
  '環境': 'the environment',
  '自然': 'nature',
  '景色': 'the scenery',
  '故郷': 'my hometown',
  '留学': 'studying abroad',
  '会話': 'conversation',
  '発音': 'pronunciation',
  '文法': 'grammar',
  '単語': 'vocabulary',
  '文章': 'writing',
  // N2 hero bulk
  '文学': 'literature',
  '哲学': 'philosophy',
  '政治': 'politics',
  '経済': 'the economy',
  '社会': 'society',
  '芸術': 'art',
  '宗教': 'religion',
  '建築': 'architecture',
  '産業': 'industry',
  '技術': 'technology',
  '研究': 'research',
  '教育': 'education',
  '国際': 'international affairs',
  '交流': 'cultural exchange',
  // N1 hero bulk
  '文明': 'civilization',
  '思想': 'ideas',
  '概念': 'concepts',
  '本質': 'the essence',
  '現象': 'phenomena',
  '構造': 'structure',
  '理論': 'theory',
  '洞察': 'insight',
  '精神': 'the mind',
  '人間': 'human nature',
  // N2 vocabulary extras
  '客観': 'objectivity',
  '協議': 'negotiations',
  '適応': 'adaptation',
  '依存': 'dependence',
  '寛容': 'tolerance',
  '郷愁': 'nostalgia',
}

const AUTO_HERO_PHRASES: Record<string, string> = (() => {
  const result: Record<string, string> = {}
  for (const card of allCards) {
    if (card.type !== 'vocab' && card.type !== 'kanji') continue
    const word =
      card.type === 'vocab'
        ? card.front
        : getKanjiWordForm(card)?.word ?? card.front
    if (!word || !isHeroEligibleShape(word)) continue
    if (HERO_OBJECT_PHRASES[word]) continue
    result[word] = autoGlossFromBack(card.back)
  }
  return result
})()

export function heroObjectPhrase(word: string): string | undefined {
  return HERO_OBJECT_PHRASES[word] ?? AUTO_HERO_PHRASES[word]
}

/** Drill / fallback gloss only — not used for hero sentence generation */
export function heroDrillPhrase(word: string): string | undefined {
  return heroObjectPhrase(word)
}

export function cardHeroWord(id: string): string | null {
  const card = allCards.find((c) => c.id === id)
  if (!card) return null
  if (card.type === 'vocab') return card.front
  if (card.type === 'kanji') {
    const form = getKanjiWordForm(card)
    return form?.word ?? card.front
  }
  return null
}

export function isHeroGrammarWord(word: string): boolean {
  return HERO_GRAMMAR_WORDS.has(word)
}

export function isCuratedHeroWord(word: string): boolean {
  if (!word || word.length > 8) return false
  if (/[。、！？\s]/.test(word)) return false
  if (HERO_GRAMMAR_WORDS.has(word)) return false
  if (word.length === 1 && KANA_RE.test(word)) return false
  if (word.endsWith('る') || word.endsWith('ます') || word.endsWith('です')) return false
  if (word.endsWith('しい') || (word.endsWith('い') && word.length <= 3 && word !== 'いい')) return false
  const gloss = heroObjectPhrase(word)
  if (!gloss || gloss.length < 2) return false
  if (/^(case |conj\.|disc\.|copula|polite|assertion|passive|not |question|reason )/i.test(gloss)) {
    return false
  }
  if (!hasAnyHeroCollocation(word)) return false
  return KANJI_RE.test(word) || KANA_RE.test(word)
}
