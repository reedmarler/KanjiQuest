import { kanjiCards } from './kanji'
import { kanjiKanaMap } from './kanjiKana'
import type { StudyCard } from '../lib/types'
import type { KanjiDetail } from '../lib/kanjiTypes'

const detailMap: Record<string, KanjiDetail> = {
  'kanji-n5-hito': {
    id: 'kanji-n5-hito',
    radicals: [{ char: '人', meaning: 'person' }],
    mnemonic: 'Looks like a person walking — two legs in profile.',
    onyomi: ['じん', 'にん'],
    kunyomi: ['ひと'],
    compounds: [
      { word: '日本人', reading: 'にほんじん', meaning: 'Japanese person' },
      { word: '大人', reading: 'おとな', meaning: 'adult' },
    ],
    contextSentence: 'あの人は誰ですか。',
    contextReading: 'ひと',
  },
  'kanji-n5-hi': {
    id: 'kanji-n5-hi',
    radicals: [{ char: '日', meaning: 'sun' }],
    mnemonic: 'A box with a line through it — the sun on the horizon.',
    onyomi: ['にち', 'じつ'],
    kunyomi: ['ひ', 'か'],
    compounds: [
      { word: '日本', reading: 'にほん', meaning: 'Japan' },
      { word: '毎日', reading: 'まいにち', meaning: 'every day' },
    ],
    contextSentence: '今日はいい日だね。',
    contextReading: 'ひ',
  },
  'kanji-n5-mizu': {
    id: 'kanji-n5-mizu',
    radicals: [{ char: '水', meaning: 'water' }],
    mnemonic: 'Splash! Central stream with drops flying off both sides.',
    onyomi: ['すい'],
    kunyomi: ['みず'],
    compounds: [
      { word: '水泳', reading: 'すいえい', meaning: 'swimming' },
      { word: '水道', reading: 'すいどう', meaning: 'water supply' },
    ],
    contextSentence: '水を飲んでください。',
    contextReading: 'みず',
  },
  'kanji-n5-gaku': {
    id: 'kanji-n5-gaku',
    radicals: [
      { char: '子', meaning: 'child' },
      { char: '宀', meaning: 'roof' },
    ],
    mnemonic: 'A child (子) under a roof (宀) — studying at school.',
    onyomi: ['がく'],
    kunyomi: ['まな'],
    compounds: [
      { word: '学校', reading: 'がっこう', meaning: 'school' },
      { word: '学生', reading: 'がくせい', meaning: 'student' },
    ],
    contextSentence: '日本語を学んでいる。',
    contextReading: 'まな',
  },
  'kanji-n5-tabe': {
    id: 'kanji-n5-tabe',
    radicals: [
      { char: '食', meaning: 'eat' },
    ],
    mnemonic: 'A lid over a bowl — sitting down to eat.',
    onyomi: ['しょく', 'じき'],
    kunyomi: ['た', 'たべ'],
    compounds: [
      { word: '食べる', reading: 'たべる', meaning: 'to eat' },
      { word: '食事', reading: 'しょくじ', meaning: 'meal' },
    ],
    contextSentence: 'ご飯食べた？',
    contextReading: 'た',
  },
  'kanji-n5-suki': {
    id: 'kanji-n5-suki',
    radicals: [
      { char: '女', meaning: 'woman' },
      { char: '子', meaning: 'child' },
    ],
    mnemonic: 'A woman (女) and child (子) together — someone you\'re fond of.',
    onyomi: ['こう'],
    kunyomi: ['す', 'この', 'このみ'],
    compounds: [
      { word: '好き', reading: 'すき', meaning: 'like / fond of' },
      { word: '好物', reading: 'こうぶつ', meaning: 'favorite food' },
    ],
    contextSentence: '君のことが好きだよ。',
    contextReading: 'す',
  },
  'kanji-n5-i2': {
    id: 'kanji-n5-i2',
    radicals: [{ char: '行', meaning: 'go' }],
    mnemonic: 'A crossroads — choose a path and go.',
    onyomi: ['こう', 'ぎょう'],
    kunyomi: ['い', 'ゆ'],
    compounds: [
      { word: '銀行', reading: 'ぎんこう', meaning: 'bank' },
      { word: '旅行', reading: 'りょこう', meaning: 'travel' },
    ],
    contextSentence: '一緒に行こう。',
    contextReading: 'い',
  },
  'kanji-n5-eki': {
    id: 'kanji-n5-eki',
    radicals: [
      { char: '馬', meaning: 'horse' },
      { char: '尺', meaning: 'measure' },
    ],
    mnemonic: 'Where horses used to stop — now trains do.',
    onyomi: ['えき'],
    kunyomi: [],
    compounds: [
      { word: '駅', reading: 'えき', meaning: 'station' },
      { word: '駅前', reading: 'えきまえ', meaning: 'in front of station' },
    ],
    contextSentence: '駅で待ってるよ。',
    contextReading: 'えき',
  },
  'kanji-n4-ai': {
    id: 'kanji-n4-ai',
    radicals: [
      { char: '人', meaning: 'person' },
      { char: '云', meaning: 'say' },
    ],
    mnemonic: 'People (人) come together to say (云) things — a meeting.',
    onyomi: ['かい', 'え'],
    kunyomi: ['あ'],
    compounds: [
      { word: '会う', reading: 'あう', meaning: 'to meet' },
      { word: '会社', reading: 'かいしゃ', meaning: 'company' },
    ],
    contextSentence: '今日会える？',
    contextReading: 'あ',
  },
  'kanji-n4-machi': {
    id: 'kanji-n4-machi',
    radicals: [
      { char: '彳', meaning: 'step' },
      { char: '寺', meaning: 'temple' },
    ],
    mnemonic: 'Stepping (彳) toward the temple — waiting to arrive.',
    onyomi: ['たい'],
    kunyomi: ['ま'],
    compounds: [
      { word: '待つ', reading: 'まつ', meaning: 'to wait' },
      { word: '招待', reading: 'しょうたい', meaning: 'invitation' },
    ],
    contextSentence: 'ずっと待ってたよ。',
    contextReading: 'ま',
  },
  'kanji-n4-omoi': {
    id: 'kanji-n4-omoi',
    radicals: [
      { char: '田', meaning: 'field' },
      { char: '心', meaning: 'heart' },
    ],
    mnemonic: 'Your heart (心) in a field (田) of thoughts — thinking deeply.',
    onyomi: ['し'],
    kunyomi: ['おも'],
    compounds: [
      { word: '思う', reading: 'おもう', meaning: 'to think' },
      { word: '思想', reading: 'しそう', meaning: 'thought / ideology' },
    ],
    contextSentence: '君のこと思ってた。',
    contextReading: 'おも',
  },
  'kanji-n4-waka': {
    id: 'kanji-n4-waka',
    radicals: [
      { char: '八', meaning: 'divide' },
      { char: '刀', meaning: 'sword' },
    ],
    mnemonic: 'Cut (刀) into eight (八) parts — dividing to understand.',
    onyomi: ['ぶん', 'ふん'],
    kunyomi: ['わ'],
    compounds: [
      { word: '分かる', reading: 'わかる', meaning: 'to understand' },
      { word: '半分', reading: 'はんぶん', meaning: 'half' },
    ],
    contextSentence: '日本語が少し分かる。',
    contextReading: 'わ',
  },
  'kanji-n4-oshie': {
    id: 'kanji-n4-oshie',
    radicals: [
      { char: '孝', meaning: 'filial piety' },
      { char: '攵', meaning: 'action' },
    ],
    mnemonic: 'Passing down knowledge through action — a teacher teaching.',
    onyomi: ['きょう'],
    kunyomi: ['おし', 'おそ'],
    compounds: [
      { word: '教える', reading: 'おしえる', meaning: 'to teach' },
      { word: '教室', reading: 'きょうしつ', meaning: 'classroom' },
    ],
    contextSentence: '彼女から日本語を教わった。',
    contextReading: 'おし',
  },
  'kanji-n4-yasashi': {
    id: 'kanji-n4-yasashi',
    radicals: [
      { char: '忄', meaning: 'heart' },
      { char: '憂', meaning: 'worry' },
    ],
    mnemonic: 'A heart without worry — gentle and kind.',
    onyomi: ['ゆう'],
    kunyomi: ['やさ'],
    compounds: [
      { word: '優しい', reading: 'やさしい', meaning: 'kind' },
      { word: '優勝', reading: 'ゆうしょう', meaning: 'victory / championship' },
    ],
    contextSentence: '彼女は優しい人だ。',
    contextReading: 'やさ',
  },
  'kanji-n4-ki2': {
    id: 'kanji-n4-ki2',
    radicals: [
      { char: '气', meaning: 'steam / spirit' },
      { char: '米', meaning: 'rice' },
    ],
    mnemonic: 'Steam rising from rice — energy, mood, spirit.',
    onyomi: ['き', 'け'],
    kunyomi: [],
    compounds: [
      { word: '元気', reading: 'げんき', meaning: 'healthy / energetic' },
      { word: '天気', reading: 'てんき', meaning: 'weather' },
    ],
    contextSentence: '元気？最近どう？',
    contextReading: 'き',
  },
  'kanji-n3-keiken': {
    id: 'kanji-n3-keiken',
    radicals: [
      { char: '糸', meaning: 'thread' },
      { char: '巠', meaning: 'warp' },
      { char: '見', meaning: 'see' },
    ],
    mnemonic: 'Threads woven over time you\'ve seen — lived experience.',
    onyomi: ['けい'],
    kunyomi: [],
    compounds: [
      { word: '経験', reading: 'けいけん', meaning: 'experience' },
      { word: '経済', reading: 'けいざい', meaning: 'economy' },
    ],
    contextSentence: '豊富な経験がある。',
    contextReading: 'けいけん',
  },
  'kanji-n3-eikyou': {
    id: 'kanji-n3-eikyou',
    radicals: [
      { char: '影', meaning: 'shadow' },
      { char: '響', meaning: 'echo' },
    ],
    mnemonic: 'A shadow that echoes outward — ripple effects and influence.',
    onyomi: ['えい'],
    kunyomi: [],
    compounds: [
      { word: '影響', reading: 'えいきょう', meaning: 'influence' },
      { word: '映画', reading: 'えいが', meaning: 'movie' },
    ],
    contextSentence: '大きな影響を与えた。',
    contextReading: 'えいきょう',
  },
  'kanji-n2-dakyou': {
    id: 'kanji-n2-dakyou',
    radicals: [
      { char: '妥', meaning: 'satisfy' },
      { char: '協', meaning: 'cooperate' },
    ],
    mnemonic: 'Both sides cooperate to satisfy — neither gets everything, a compromise.',
    onyomi: ['だ', 'じょう'],
    kunyomi: [],
    compounds: [
      { word: '妥協', reading: 'だきょう', meaning: 'compromise' },
    ],
    contextSentence: '妥協点を見つけた。',
    contextReading: 'だきょう',
  },
  'kanji-n2-mujun': {
    id: 'kanji-n2-mujun',
    radicals: [
      { char: '矛', meaning: 'spear' },
      { char: '盾', meaning: 'shield' },
    ],
    mnemonic: 'Spear (矛) and shield (盾) — attack and defense contradict each other.',
    onyomi: ['む'],
    kunyomi: [],
    compounds: [
      { word: '矛盾', reading: 'むじゅん', meaning: 'contradiction' },
    ],
    contextSentence: '発言には矛盾がある。',
    contextReading: 'むじゅん',
  },
}

export function getKanjiDetail(card: StudyCard): KanjiDetail {
  const existing = detailMap[card.id]
  if (existing) return existing

  const kana = kanjiKanaMap[card.id]
  const mainChar = [...card.front][0] ?? card.front

  return {
    id: card.id,
    radicals: [{ char: mainChar, meaning: card.back.split('/')[0].trim() }],
    mnemonic: card.hint ?? `"${card.front}" — remember it means "${card.back}".`,
    onyomi: kana ? [kana] : [],
    kunyomi: [],
    compounds: card.front.length > 1
      ? [{ word: card.front, reading: kana ?? '', meaning: card.back }]
      : [],
    contextSentence: undefined,
    contextReading: kana,
  }
}

export function getKanjiDetailsForCards(cards: StudyCard[]): KanjiDetail[] {
  return cards.map(getKanjiDetail)
}

export { kanjiCards }
