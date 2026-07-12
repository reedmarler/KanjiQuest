import { allCards } from '../data'
import { vocabBulkKanaMap } from '../data/vocabBulkKana'
import { vocabKanaMap } from '../data/vocabKana'
import type { HeroSentenceFrame, HeroSlot } from '../data/heroSentences'
import { isPosFrame } from '../data/heroSentences'
import { getPosEnglishNormalized } from './posSentenceGloss'
import { HERO_SLOT_ORDER } from './heroSlotResize'
import { heroTopicLabel } from './heroCollocations'
import {
  derivePredicateReading,
  findMasuVerbBase,
  heroVerbForTense,
  predicateTense,
  VERB_FORMS_BY_BASE,
  type VerbConjugationForms,
} from './heroPredicateConjugation'
import { normalizeHeroEnglishGloss } from './heroEnglishNormalize'
import { formatHeroEnglishObject } from './heroWordFit'
import { getKanjiWordForm } from './kanjiWordForm'

const MODIFIER_READINGS: Record<string, string> = {
  '毎日': 'まいにち',
  'よく': 'よく',
  '今から': 'いまから',
  'とても': 'とても',
  '時々': 'ときどき',
  '一緒に': 'いっしょに',
  '週末': 'しゅうまつ',
  '午後': 'ごご',
  '今朝': 'けさ',
  '今晩': 'こんばん',
  '電車で': 'でんしゃで',
  'バスで': 'バスで',
  '友達と': 'ともだちと',
  '図書館へ': 'としょかんへ',
  '図書館で': 'としょかんでき',
  '会社で': 'かいしゃで',
  '公園で': 'こうえんで',
  '駅で': 'えきで',
  '最近は': 'さいきんは',
  'もうすぐ': 'もうすぐ',
  '図書館に行って、': 'としょかんにいって、',
  '駅に着いてから、': 'えきについてから、',
  '京都に行って、': 'きょうとにいって、',
  '本を読んでから、': 'ほんをよんでから、',
  '音楽を聞きながら、': 'おんがくをききながら、',
  '家で': 'いえで',
  '友達と会って、': 'ともだちとあって、',
  '仕事が終わってから、': 'しごとがおわってから、',
}

const PREFIX_READINGS: Record<string, string> = {
  'もし時間があれば、': 'もしじかんがあれば、',
  'お金があれば、': 'おかねがあれば、',
  '天気が良ければ、': 'てんきがよければ、',
  '仕事が終わったら、': 'しごとがおわったら、',
  '時間があったら、': 'じかんがあったら、',
  '昨日': 'きのう',
  '今朝': 'けさ',
  '先週': 'せんしゅう',
  '週末': 'しゅうまつ',
  '雨が降ったので、': 'あめがふったので、',
  '時間がないので、': 'じかんがないので、',
}

const BRIDGE_READINGS: Record<string, string> = {
  'が大切だと思いますが、': 'がたいせつだとおもいますが、',
  'が好きなので、': 'がすきなので、',
  'は難しいと思うので、': 'はむずかしいとおもうので、',
  '難しいと思うので、': 'むずかしいとおもうので、',
  'が面白いので、': 'がおもしろいので、',
  'が楽しいので、': 'がたのしいので、',
  'に興味があるので、': 'にきょうみがあるので、',
  'はとても難しいので、': 'はとてもむずかしいので、',
  'とても難しいので、': 'とてもむずかしいので、',
  'は面白いと思いますが、': 'はおもしろいとおもいますが、',
  '面白いと思いますが、': 'おもしろいとおもいますが、',
  'は学問の基礎であり、': 'はがくもんのきそであり、',
  '学問の基礎であり、': 'がくもんのきそであり、',
  'は社会の基盤であり、': 'はしゃかいのきばんであり、',
  '社会の基盤であり、': 'しゃかいのきばんであり、',
  'は日本の古都であり、': 'はにほんのことであり、',
  '日本の古都であり、': 'にほんのことであり、',
  'は現代の課題であり、': 'はげんだいのかだいであり、',
  '現代の課題であり、': 'げんだいのかだいであり、',
}

const MODIFIER_ENGLISH: Record<string, string> = {
  '毎日': 'every day',
  'よく': 'often',
  '今から': 'starting now',
  'とても': 'really',
  '時々': 'sometimes',
  '一緒に': 'together',
  '週末': 'on weekends',
  '午後': 'in the afternoon',
  '今朝': 'this morning',
  '今晩': 'tonight',
  '電車で': 'by train',
  'バスで': 'by bus',
  '友達と': 'with my friend',
  '図書館へ': 'to the library',
  '図書館で': 'at the library',
  '会社で': 'at the office',
  '公園で': 'at the park',
  '駅で': 'at the station',
  '最近は': 'lately',
  'もうすぐ': 'soon',
  '図書館に行って、': 'went to the library and',
  '駅に着いてから、': 'after arriving at the station,',
  '京都に行って、': 'went to Kyoto and',
  '本を読んでから、': 'after reading a book,',
  '音楽を聞きながら、': 'while listening to music,',
  '家で': 'at home',
  '友達と会って、': 'after meeting my friend,',
  '仕事が終わってから、': 'after work ended,',
}

const PREFIX_ENGLISH: Record<string, string> = {
  'もし時間があれば、': 'If I have time,',
  'お金があれば、': 'If I had the money,',
  '天気が良ければ、': 'If the weather is nice,',
  '仕事が終わったら、': 'When work is over,',
  '時間があったら、': 'If I have time,',
  '昨日': 'Yesterday,',
  '今朝': 'This morning,',
  '先週': 'Last week,',
  '週末': 'This weekend,',
  '雨が降ったので、': 'Because it rained,',
  '時間がないので、': 'Because I do not have time,',
}

const BRIDGE_ENGLISH: Record<string, string> = {
  'が大切だと思いますが、': ' is important, but',
  'が好きなので、': ' because I like',
  'は難しいと思うので、': ' is difficult, so',
  '難しいと思うので、': ' is difficult, so',
  'が面白いので、': ' is interesting, so',
  'が楽しいので、': ' is fun, so',
  'に興味があるので、': ' because I am interested in',
  'はとても難しいので、': ' is very difficult, so',
  'とても難しいので、': ' is very difficult, so',
  'は面白いと思いますが、': ' is interesting, but',
  '面白いと思いますが、': ' is interesting, but',
  'は学問の基礎であり、': ' is a foundation of learning, and',
  '学問の基礎であり、': ' is a foundation of learning, and',
  'は社会の基盤であり、': ' is a pillar of society, and',
  '社会の基盤であり、': ' is a pillar of society, and',
  'は日本の古都であり、': ' is an ancient capital of Japan, and',
  '日本の古都であり、': ' is an ancient capital of Japan, and',
  'は現代の課題であり、': ' is a modern challenge, and',
  '現代の課題であり、': ' is a modern challenge, and',
}
const SUBJECT_READINGS: Record<string, string> = {
  '私': 'わたし',
  '彼': 'かれ',
  '彼女': 'かのじょ',
  'みんな': 'みんな',
  '友達': 'ともだち',
  '先生': 'せんせい',
  '母': 'はは',
  '兄': 'あに',
  '姉': 'あね',
  '父さん': 'とうさん',
  '母さん': 'かあさん',
  '兄さん': 'にいさん',
}

const SUBJECT_ENGLISH: Record<string, string> = {
  '私': 'I',
  '彼': 'He',
  '彼女': 'She',
  'みんな': 'Everyone',
  '友達': 'My friend',
  '先生': 'My teacher',
  '母': 'My mother',
  '兄': 'My older brother',
  '姉': 'My older sister',
  '父さん': 'Dad',
  '母さん': 'Mom',
  '兄さん': 'My older brother',
}

function heroSubject(frame: HeroSentenceFrame): string {
  return (SUBJECT_ENGLISH[frame.subject] ?? frame.subject) || 'I'
}

function heroAlsoMark(frame: HeroSentenceFrame): string {
  if (frame.topicParticle === 'も' || frame.objectParticle === 'も') return ' also'
  return ''
}

const DAILY_PROGRESSIVE_FORMS: Record<'study' | 'practice', VerbConjugationForms> = {
  study: {
    present: ['studies', 'study'],
    negative: ["doesn't study", "don't study"],
    past: ['studied', 'studied'],
    negativePast: ["didn't study", "didn't study"],
  },
  practice: {
    present: ['practices', 'practice'],
    negative: ["doesn't practice", "don't practice"],
    past: ['practiced', 'practiced'],
    negativePast: ["didn't practice", "didn't practice"],
  },
}

function dailyProgressiveVerb(
  frame: HeroSentenceFrame,
  kind: 'study' | 'practice',
): string | null {
  const stem = kind === 'study' ? '毎日勉強して' : '毎日練習して'
  if (!frame.predicate.startsWith(stem)) return null

  const tense = predicateTense(frame.predicate)
  if (!tense || tense === 'tai') return null

  const who = heroSubject(frame)
  const also = heroAlsoMark(frame)
  return heroVerbForTense(
    midSentenceSubject(who),
    also,
    DAILY_PROGRESSIVE_FORMS[kind],
    tense,
  )
}

const PREDICATE_READINGS: Record<string, string> = {
  '好きです': 'すきです',
  '食べます': 'たべます',
  '飲みます': 'のみます',
  '読みます': 'よみます',
  '勉強します': 'べんきょうします',
  '行きます': 'いきます',
  '欲しいです': 'ほしいです',
  '食べたいです': 'たべたいです',
  '行きたいです': 'いきたいです',
  '知りたいです': 'しりたいです',
  '見ます': 'みます',
  '見たいです': 'みたいです',
  '買います': 'かいます',
  '買いたいです': 'かいたいです',
  '作ります': 'つくります',
  '聞きます': 'ききます',
  'できます': 'できます',
  'します': 'します',
  '面白いです': 'おもしろいです',
  '楽しいです': 'たのしいです',
  '上手です': 'じょうずです',
  '下手です': 'へたです',
  '撮ります': 'とります',
  '会います': 'あいます',
  '話します': 'はなします',
  '待ちます': 'まちます',
  '使います': 'つかいます',
  '重要です': 'じゅうようです',
  '難しいです': 'むずかしいです',
  '変化しています': 'へんかしています',
  '興味があります': 'きょうみがあります',
  '考えます': 'かんがえます',
  '見に行きます': 'みにいきます',
  '借りに行きます': 'かりにいきます',
  '大切だと思います': 'たいせつだとおもいます',
  '難しいと思います': 'むずかしいとおもいます',
  '面白いと思います': 'おもしろいとおもいます',
  '話せるようになりたいです': 'はなせるようになりたいです',
  '読めるようになりたいです': 'よめるようになりたいです',
  '勉強し続けています': 'べんきょうしつづけています',
  '経験があります': 'けいけんがあります',
  '食べたいと思います': 'たべたいとおもいます',
  '行きたいと思います': 'いきたいとおもいます',
  '復習しなければなりません': 'ふくしゅうしなければなりません',
  '食べました': 'たべました',
  '飲みました': 'のみました',
  '飲みたいです': 'のみたいです',
  '読みたいです': 'よみたいです',
  '聞きたいです': 'ききたいです',
  '会いたいです': 'あいたいです',
  '作りたいです': 'つくりたいです',
  '撮りたいです': 'とりたいです',
  '買いました': 'かいました',
  '作りました': 'つくりました',
  '会いました': 'あいました',
  '待ちました': 'まちました',
  '勉強しました': 'べんきょうしました',
  '行きました': 'いきました',
  '読みました': 'よみました',
  '見ました': 'みました',
  '借りました': 'かりました',
  '電話しました': 'でんわしました',
  '楽しかったです': 'たのしかったです',
  'もっと勉強したいです': 'もっとべんきょうしたいです',
  'よく行きます': 'よくいきます',
  '毎日練習しています': 'まいにちれんしゅうしています',
  'よく読みます': 'よくよみます',
  '毎日勉強しています': 'まいにちべんきょうしています',
  '一度行きたいです': 'いちどいきたいです',
  'もっと考えたいです': 'もっとかんがえたいです',
}

const FALLBACK_WORD_READINGS: Record<string, string> = {
  'ピザ': 'ピザ',
  '寿司': 'すし',
  '弁当': 'べんとう',
  'コーヒー': 'コーヒー',
  '映画': 'えいが',
  '日本語': 'にほんご',
  '旅行': 'りょこう',
  'ラーメン': 'ラーメン',
  '京都': 'きょうと',
  'ゴルフ': 'ゴルフ',
  '音楽': 'おんがく',
  '漫画': 'まんが',
  '新聞': 'しんぶん',
  '東京': 'とうきょう',
  '大阪': 'おおさか',
  '公園': 'こうえん',
  '家族': 'かぞく',
  '散歩': 'さんぽ',
  '買い物': 'かいもの',
  'ジュース': 'ジュース',
  'ミルク': 'ミルク',
  'ハンバーガー': 'ハンバーガー',
  '本': 'ほん',
  '雑誌': 'ざっし',
  '駅': 'えき',
  '空港': 'くうこう',
  '車': 'くるま',
  '犬': 'いぬ',
  '猫': 'ねこ',
  'プレゼント': 'プレゼント',
  '誕生日': 'たんじょうび',
  'デート': 'デート',
  'ホテル': 'ホテル',
  'パン': 'パン',
  'サラダ': 'サラダ',
  'ケーキ': 'ケーキ',
  '小説': 'しょうせつ',
  '漢字': 'かんじ',
  'かばん': 'かばん',
  'パソコン': 'パソコン',
  'レストラン': 'レストラン',
  'チョコレート': 'チョコレート',
  'ドラマ': 'ドラマ',
  'アニメ': 'アニメ',
  '野球': 'やきゅう',
  '写真': 'しゃしん',
  '料理': 'りょうり',
  'ラジオ': 'ラジオ',
  '歴史': 'れきし',
  '学校': 'がっこう',
  '会社': 'かいしゃ',
  'テニス': 'テニス',
  '文化': 'ぶんか',
  '海': 'うみ',
  '電車': 'でんしゃ',
  '切符': 'きっぷ',
  '観光': 'かんこう',
  '思い出': 'おもいで',
  '経験': 'けいけん',
  '地図': 'ちず',
  '恋人': 'こいびと',
  '記念日': 'きねんび',
  '両親': 'りょうしん',
  '予約': 'よやく',
}

const FALLBACK_WORD_ENGLISH: Record<string, string> = {
  'ピザ': 'pizza',
  '寿司': 'sushi',
  '弁当': 'boxed lunch',
  'コーヒー': 'coffee',
  '映画': 'movies',
  '日本語': 'Japanese',
  '旅行': 'travel',
  'ラーメン': 'ramen',
  '京都': 'Kyoto',
  'ゴルフ': 'golf',
  '音楽': 'music',
  '漫画': 'manga',
  '新聞': 'newspapers',
  '東京': 'Tokyo',
  '大阪': 'Osaka',
  '公園': 'the park',
  '家族': 'family',
  '散歩': 'walks',
  '買い物': 'shopping',
  'ジュース': 'juice',
  'ミルク': 'milk',
  'ハンバーガー': 'hamburgers',
  '本': 'books',
  '雑誌': 'magazines',
  '駅': 'the station',
  '空港': 'the airport',
  '車': 'a car',
  '犬': 'a dog',
  '猫': 'a cat',
  'プレゼント': 'presents',
  '誕生日': 'birthdays',
  'デート': 'dates',
  'ホテル': 'the hotel',
  'パン': 'bread',
  'サラダ': 'salad',
  'ケーキ': 'cake',
  '小説': 'novels',
  '漢字': 'kanji',
  'かばん': 'a bag',
  'パソコン': 'a computer',
  'レストラン': 'the restaurant',
  'チョコレート': 'chocolate',
  'ドラマ': 'dramas',
  'アニメ': 'anime',
  '野球': 'baseball',
  '写真': 'photos',
  '料理': 'cooking',
  'ラジオ': 'the radio',
  '歴史': 'history',
  '学校': 'school',
  '会社': 'the office',
  'テニス': 'tennis',
  '文化': 'culture',
  '海': 'the beach',
  '電車': 'the train',
  '切符': 'a ticket',
  '観光': 'sightseeing',
  '思い出': 'memories',
  '経験': 'experience',
  '地図': 'maps',
  '恋人': 'my sweetheart',
  '記念日': 'our anniversary',
  '両親': 'my parents',
  '予約': 'a reservation',
  'お茶': 'tea',
  '友達': 'my friend',
  '先生': 'my teacher',
}

function findCardForWord(word: string) {
  return allCards.find((c) => {
    if (c.type === 'vocab' && c.front === word) return true
    if (c.type === 'kanji') {
      const form = getKanjiWordForm(c)
      return c.front === word || form?.word === word
    }
    return false
  })
}

export function getHeroWordReading(word: string): string | undefined {
  if (FALLBACK_WORD_READINGS[word]) return FALLBACK_WORD_READINGS[word]

  const card = findCardForWord(word)
  if (!card) return undefined

  return vocabKanaMap[card.id] ?? vocabBulkKanaMap[card.id] ?? card.reading
}

export function getHeroWordEnglish(word: string): string {
  if (FALLBACK_WORD_ENGLISH[word]) return FALLBACK_WORD_ENGLISH[word]

  const card = findCardForWord(word)
  if (!card) return word

  return card.back.split('/')[0].trim().toLowerCase()
}

export const HERO_SKIP_FURIGANA = new Set(['私', '彼', '彼女', 'みんな', '母', '兄', '姉'])

export function heroReadingForDisplay(
  text: string,
  reading?: string,
): string | undefined {
  if (!reading || HERO_SKIP_FURIGANA.has(text)) return undefined
  return reading
}

export function getSegmentReading(text: string): string | undefined {
  return getHeroWordReading(text)
}

export function getHeroSlotReading(slot: HeroSlot, frame: HeroSentenceFrame): string | undefined {
  switch (slot) {
    case 'prefix':
      return PREFIX_READINGS[frame.prefix]
    case 'subject':
      return SUBJECT_READINGS[frame.subject]
    case 'topicParticle':
    case 'objectParticle':
      return undefined
    case 'modifier':
      return MODIFIER_READINGS[frame.modifier]
    case 'word':
      return getHeroWordReading(frame.word)
    case 'bridge':
      return BRIDGE_READINGS[frame.bridge]
    case 'predicate':
      return derivePredicateReading(frame.predicate, PREDICATE_READINGS)
  }
}

/** Hiragana reading for an entire hero frame — used for full-sentence reel swaps */
export function getHeroFrameReading(frame: HeroSentenceFrame): string | undefined {
  if (isPosFrame(frame) && frame.segments) {
    let out = ''
    let hasReading = false
    for (const seg of frame.segments) {
      const reading = getSegmentReading(seg.text)
      out += reading ?? seg.text
      if (reading) hasReading = true
    }
    return hasReading ? out : undefined
  }

  let out = ''
  let hasReading = false

  for (const slot of HERO_SLOT_ORDER) {
    const text = frame[slot]
    if (!text) continue
    if (slot === 'topicParticle' && !frame.subject) continue
    const reading = getHeroSlotReading(slot, frame)
    out += reading ?? text
    if (reading) hasReading = true
  }

  return hasReading ? out : undefined
}

function heroLinkingVerb(who: string, also: string): string {
  if (who === 'I') return `I${also} am`
  return `${who}${also} is`
}

function heroVerb(who: string, also: string, third: string, first: string): string {
  return who === 'I' ? `I${also} ${first}` : `${who}${also} ${third}`
}

function heroPrefixedVerb(
  who: string,
  also: string,
  prefix: string,
  third: string,
  first: string,
): string {
  const verb = who === 'I' ? first : third
  return `${who === 'I' ? 'I' : who}${also} ${prefix}${verb}`
}

function topicCommentSentence(
  word: string,
  adjective: string,
  also: boolean,
): string | null {
  const topic = heroTopicLabel(word)
  if (!topic) return null
  const verb = topic.plural ? 'are' : 'is'
  const alsoWord = also ? ' also' : ''
  return `${topic.label} ${verb}${alsoWord} ${adjective}.`
}

function stripSubjectClause(clause: string, who: string): string {
  const alsoPattern = who === 'I' ? /^I( also)?\s+/i : new RegExp(`^${who}( also)?\\s+`, 'i')
  return clause.replace(alsoPattern, '').replace(/\.\s*$/, '')
}

function midSentenceSubject(who: string): string {
  if (who === 'I') return 'I'
  return who.charAt(0).toLowerCase() + who.slice(1)
}

function heroVerbMid(who: string, also: string, third: string, first: string): string {
  return heroVerb(midSentenceSubject(who), also, third, first)
}

/** Topic word at the start of a bridge / topic-comment gloss line */
function scaffoldTopicWord(frame: HeroSentenceFrame): string {
  const topic = heroTopicLabel(frame.word)
  if (topic) return topic.label
  const phrase = formatHeroEnglishObject(frame)
  if (!phrase) return frame.word
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}

/** Prefix + main clause — lowercases the clause lead after a temporal opener */
function prefixLeadSentence(lead: string, clause: string): string {
  if (!lead) return clause.endsWith('.') ? clause : `${clause}.`
  const prefix = lead.trim().replace(/,$/, '')
  const trimmed = clause.trim().replace(/\.\s*$/, '')
  const normalized = trimmed
    .replace(/, She\b/g, ', she')
    .replace(/, He\b/g, ', he')
    .replace(/, My /g, ', my ')
    .replace(/ and She\b/g, ' and she')
    .replace(/ and He\b/g, ' and he')
    .replace(/ and My /g, ' and my ')
    .replace(/, Everyone\b/g, ', everyone')
  const lowered = `${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`
  return `${prefix}, ${lowered}.`
}

type TeModifierConnector = (
  who: string,
  also: string,
  clause: string,
) => string

/** Te-form / temporal modifier leads that connect into the main verb */
const TE_MODIFIER_CONNECTORS: Record<string, TeModifierConnector> = {
  '図書館に行って、': (who, also, clause) => {
    const rest = stripSubjectClause(clause, who)
    return `${heroVerb(who, also, 'went', 'went')} to the library and ${rest}.`
  },
  '京都に行って、': (who, also, clause) => {
    const rest = stripSubjectClause(clause, who)
    return `${heroVerb(who, also, 'went', 'went')} to Kyoto and ${rest}.`
  },
  '駅に着いてから、': (who, also, clause) => {
    const rest = stripSubjectClause(clause, who)
    return `After arriving at the station, ${midSentenceSubject(who)}${also} ${rest}.`
  },
  '友達と会って、': (who, also, clause) => {
    const rest = stripSubjectClause(clause, who)
    return `After meeting my friend, ${midSentenceSubject(who)}${also} ${rest}.`
  },
  '仕事が終わってから、': (who, also, clause) => {
    const rest = stripSubjectClause(clause, who)
    return `After work ended, ${midSentenceSubject(who)}${also} ${rest}.`
  },
  '本を読んでから、': (who, also, clause) => {
    const rest = stripSubjectClause(clause, who)
    return `After reading a book, ${midSentenceSubject(who)}${also} ${rest}.`
  },
  '音楽を聞きながら、': (who, also, clause) => {
    const rest = stripSubjectClause(clause, who)
    return `${midSentenceSubject(who)}${also} ${rest} while listening to music.`
  },
}

/** Wrap a core clause with time prefix and te-form modifier leads */
function applyEnglishFrame(frame: HeroSentenceFrame, clause: string): string {
  if (frame.bridge) return clause

  const who = heroSubject(frame)
  const also = heroAlsoMark(frame)

  let body = clause
  const teConnector = frame.modifier ? TE_MODIFIER_CONNECTORS[frame.modifier] : undefined
  if (teConnector) {
    body = teConnector(who, also, clause)
  } else if (frame.modifier) {
    const mod = MODIFIER_ENGLISH[frame.modifier]
    if (mod && !teConnector) {
      const adverbLead = mod.endsWith(',') ? mod : `${mod} `
      const rest = stripSubjectClause(clause, who)
      body = `${who === 'I' ? 'I' : who}${also} ${adverbLead}${rest}.`
    }
  }

  const lead = PREFIX_ENGLISH[frame.prefix]
  if (lead) {
    return prefixLeadSentence(lead, body)
  }

  return body
}

function getScaffoldEnglish(frame: HeroSentenceFrame): string | null {
  const who = heroSubject(frame)
  const also = heroAlsoMark(frame)
  const topicLead = scaffoldTopicWord(frame)
  const object = formatHeroEnglishObject(frame)
  const lead = PREFIX_ENGLISH[frame.prefix] ?? ''
  const bridge = BRIDGE_ENGLISH[frame.bridge] ?? ''

  if (frame.prefix === 'もし時間があれば、' && frame.predicate === '行きたいです') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'wants', 'want')} to go to ${object}`)
  }
  if (frame.prefix === 'お金があれば、' && frame.predicate === '行きたいです') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'would', 'would')} like to go to ${object}`)
  }
  if (frame.prefix === '天気が良ければ、' && frame.predicate === '行きます') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'will', 'will')} go to ${object}`)
  }
  if (frame.prefix === '仕事が終わったら、' && frame.predicate === '行きます') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'will', 'will')} go to ${object}`)
  }
  if (frame.prefix === '時間があったら、' && frame.predicate === '見たいです') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'would', 'would')} like to watch ${object}`)
  }

  if (frame.prefix === '昨日' && frame.predicate === '食べました') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'ate', 'ate')} ${object}`)
  }
  if (frame.prefix === '今朝' && frame.predicate === '飲みました') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'drank', 'drank')} ${object}`)
  }
  if (frame.prefix === '昨日' && frame.predicate === '行きました') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'went', 'went')} to ${object}`)
  }
  if (frame.prefix === '先週' && frame.predicate === '読みました') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'read', 'read')} ${object}`)
  }
  if (frame.prefix === '昨日' && frame.predicate === '見ました') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'watched', 'watched')} ${object}`)
  }
  if (frame.prefix === '週末' && frame.predicate === '楽しかったです') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'went', 'went')} to ${object} and had fun`)
  }

  if (frame.prefix === '昨日' && frame.modifier === '図書館に行って、' && frame.predicate === '借りました') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'went', 'went')} to the library and borrowed ${object}`)
  }
  if (frame.modifier === '駅に着いてから、' && frame.predicate === '電話しました') {
    const target = frame.word === '友達' ? 'my friend'
      : frame.word === '先生' ? 'my teacher'
        : frame.word === '恋人' ? 'my sweetheart'
          : frame.word === '両親' ? 'my parents'
            : object
    return `After arriving at the station, ${heroVerbMid(who, also, 'called', 'called')} ${target}.`
  }
  if (frame.prefix === '先週' && frame.modifier === '京都に行って、' && frame.predicate === '見ました') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'went', 'went')} to Kyoto and saw ${object}`)
  }

  if (frame.bridge === 'が大切だと思いますが、' && frame.predicate === 'もっと勉強したいです') {
    const thinks = who === 'I' ? 'think' : 'thinks'
    return `${who}${also} ${thinks} ${topicLead} is important, but ${heroVerbMid(who, also, 'wants', 'want')} to study more.`
  }
  if (frame.bridge === 'が好きなので、' && frame.predicate === 'よく行きます') {
    const likes = who === 'I' ? 'like' : 'likes'
    const go = who === 'I' ? 'often go' : 'often goes'
    const subj = midSentenceSubject(who)
    return `Because ${subj}${also} ${likes} ${topicLead}, ${subj}${also} ${go} there.`
  }
  if (frame.bridge === '難しいと思うので、' || frame.bridge === 'は難しいと思うので、') {
    const daily = dailyProgressiveVerb(frame, 'practice')
    if (daily) {
      const subj = midSentenceSubject(who)
      return `Because ${subj}${also} think${who === 'I' ? '' : 's'} ${topicLead} is difficult, ${daily} every day.`
    }
  }
  if (frame.bridge === 'とても難しいので、' || frame.bridge === 'はとても難しいので、') {
    const daily = dailyProgressiveVerb(frame, 'practice')
    if (daily) {
      return `Because ${topicLead} is very difficult, ${daily} every day.`
    }
  }
  if (frame.bridge === '学問の基礎であり、' || frame.bridge === 'は学問の基礎であり、') {
    const daily = dailyProgressiveVerb(frame, 'study')
    if (daily) {
      return `${topicLead} is a foundation of learning, so ${daily} it every day.`
    }
  }
  if (frame.bridge === 'が面白いので、' && frame.predicate === 'よく読みます') {
    return `Because ${topicLead} is interesting, ${heroVerbMid(who, also, 'often reads', 'often read')} about it.`
  }
  if (frame.bridge === 'が楽しいので、' && frame.predicate === 'よく行きます') {
    const go = who === 'I' ? 'often go' : 'often goes'
    return `Because ${topicLead} is fun, ${midSentenceSubject(who)}${also} ${go} there.`
  }
  if (frame.bridge === 'に興味があるので、' && frame.predicate === 'もっと勉強したいです') {
    const interestWho =
      who === 'I' ? 'I am' : `${midSentenceSubject(who)} is`
    return `Because ${interestWho}${also} interested in ${topicLead}, ${heroVerbMid(who, also, 'wants', 'want')} to study more.`
  }
  if (frame.bridge === '面白いと思いますが、' || frame.bridge === 'は面白いと思いますが、') {
    const thinks = who === 'I' ? 'think' : 'thinks'
    return `${who}${also} ${thinks} ${topicLead} is interesting, but ${heroVerbMid(who, also, 'wants', 'want')} to study more.`
  }
  if (frame.bridge === '社会の基盤であり、' || frame.bridge === 'は社会の基盤であり、') {
    return `${topicLead} is a pillar of society, and ${heroVerbMid(who, also, 'wants', 'want')} to study it more.`
  }
  if (frame.bridge === '日本の古都であり、' || frame.bridge === 'は日本の古都であり、') {
    return `${topicLead} is an ancient capital of Japan, and ${heroVerbMid(who, also, 'wants', 'want')} to visit it someday.`
  }
  if (frame.bridge === '現代の課題であり、' || frame.bridge === 'は現代の課題であり、') {
    return `${topicLead} is a modern challenge, and ${heroVerbMid(who, also, 'wants', 'want')} to think about it more.`
  }
  if (frame.prefix === '雨が降ったので、' && frame.modifier === '家で' && frame.predicate === '読みました') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'read', 'read')} ${object} at home`)
  }
  if (frame.prefix === '時間がないので、' && frame.predicate === '読みます') {
    return prefixLeadSentence(lead, `${heroVerb(who, also, 'reads', 'read')} ${object}`)
  }
  if (frame.modifier === '友達と会って、' && frame.predicate === '見ました') {
    return `After meeting my friend, ${heroVerbMid(who, also, 'watched', 'watched')} ${object}.`
  }
  if (frame.modifier === '仕事が終わってから、' && frame.predicate === '行きました') {
    return `After work ended, ${heroVerbMid(who, also, 'went', 'went')} to ${object}.`
  }
  if (frame.modifier === '音楽を聞きながら、' && frame.predicate === '勉強します') {
    return `${heroVerb(who, also, 'studies', 'study')} ${object} while listening to music.`
  }
  if (frame.modifier === '本を読んでから、' && frame.predicate === '行きました') {
    return `After reading a book, ${heroVerbMid(who, also, 'went', 'went')} to ${object}.`
  }

  if (lead || bridge) return null
  return null
}

function getMasuConjugationEnglish(frame: HeroSentenceFrame): string | null {
  if (frame.objectParticle === 'について') return null

  const base = findMasuVerbBase(frame.predicate)
  if (!base) return null

  const forms = VERB_FORMS_BY_BASE[base]
  if (!forms) return null

  const tense = predicateTense(frame.predicate)
  if (!tense || tense === 'tai') return null

  const who = heroSubject(frame)
  const also = heroAlsoMark(frame)
  const what = formatHeroEnglishObject(frame)
  const mod = frame.modifier ? MODIFIER_ENGLISH[frame.modifier] : ''
  const daily = mod === 'every day' ? ' every day' : ''
  const v = heroVerbForTense(who, also, forms, tense)

  if (base === '見ます' && frame.word === '地図') {
    if (tense === 'negativePast') {
      return `${heroVerb(who, also, "didn't look at", "didn't look at")} a map.`
    }
    if (tense === 'negative') {
      return `${heroVerb(who, also, "doesn't look at", "don't look at")} a map.`
    }
    if (tense === 'past') {
      return `${heroVerb(who, also, 'looked at', 'looked at')} a map.`
    }
    return `${heroVerb(who, also, 'looks at', 'look at')} a map.`
  }

  if (base === '食べます' && frame.objectParticle === 'で') {
    return `${v} at ${what}${daily}.`
  }
  if (base === '食べます') {
    return daily ? `${v} ${what}${daily}.` : `${v} ${what}.`
  }
  if (base === '飲みます') {
    return `${v} ${what}.`
  }
  if (base === '読みます') {
    if (frame.word === '地図') return `${v} a map.`
    return `${v} ${what}.`
  }
  if (base === '見ます') {
    return `${v} ${what}.`
  }
  if (base === '行きます') {
    if (frame.word === 'デート') return `${v} on a date.`
    return `${v} to ${what}.`
  }
  if (base === '買います') {
    return `${v} ${what}.`
  }
  if (base === '作ります') {
    return `${v} ${what}.`
  }
  if (base === '聞きます') {
    return `${v} ${what}.`
  }
  if (base === '会います') {
    return `${v} ${what}.`
  }
  if (base === '電話します') {
    const target = frame.word === '友達' ? 'my friend'
      : frame.word === '先生' ? 'my teacher'
        : frame.word === '恋人' ? 'my sweetheart'
          : frame.word === '両親' ? 'my parents'
            : what
    return `${v} ${target}.`
  }
  if (base === '待ちます') {
    return `${v} for ${what}.`
  }
  if (base === '使います') {
    return `${v} ${what}.`
  }
  if (base === '話します') {
    return `${v} ${what}.`
  }
  if (base === '撮ります') {
    return `${v} ${what}.`
  }
  if (base === '勉強します') {
    return daily ? `${v} ${what}${daily}.` : `${v} ${what}.`
  }
  if (base === 'します') {
    return `${v} ${what}.`
  }
  if (base === '考えます') {
    return `${v} about ${what}.`
  }
  if (base === '借ります') {
    return `${v} ${what}.`
  }

  return `${v} ${what}.`
}

function getVerbEndingEnglish(frame: HeroSentenceFrame): string | null {
  const who = heroSubject(frame)
  const also = heroAlsoMark(frame)
  const what = formatHeroEnglishObject(frame)
  const mod = frame.modifier ? MODIFIER_ENGLISH[frame.modifier] : ''
  const daily = mod === 'every day' ? ' every day' : ''

  switch (frame.predicate) {
    case '食べました':
      return `${heroVerb(who, also, 'ate', 'ate')} ${what}${daily}.`
    case '飲みました':
      return `${heroVerb(who, also, 'drank', 'drank')} ${what}.`
    case '読みました':
      return `${heroVerb(who, also, 'read', 'read')} ${what}.`
    case '見ました':
      return `${heroVerb(who, also, 'watched', 'watched')} ${what}.`
    case '行きました':
      return `${heroVerb(who, also, 'went', 'went')} to ${what}.`
    case '買いました':
      return `${heroVerb(who, also, 'bought', 'bought')} ${what}.`
    case '聞きました':
      return `${heroVerb(who, also, 'listened', 'listened')} to ${what}.`
    case '作りました':
      return `${heroVerb(who, also, 'made', 'made')} ${what}.`
    case '会いました':
      return `${heroLinkingVerb(who, also)} met ${what}.`
    case '待ちました':
      return `${heroLinkingVerb(who, also)} waited for ${what}.`
    case '借りました':
      return `${heroVerb(who, also, 'borrowed', 'borrowed')} ${what}.`
    case '借りませんでした':
      return `${heroVerb(who, also, "didn't borrow", "didn't borrow")} ${what}.`
    case '勉強しました':
      return `${heroVerb(who, also, 'studied', 'study')} ${what}${daily}.`
    case '飲みたいです':
      return `${heroVerb(who, also, 'wants', 'want')} to drink ${what}.`
    case '読みたいです':
      return `${heroVerb(who, also, 'wants', 'want')} to read ${what}.`
    case '聞きたいです':
      return `${heroVerb(who, also, 'wants', 'want')} to listen to ${what}.`
    case '会いたいです':
      return `${heroLinkingVerb(who, also)} hoping to meet ${what}.`
    case '作りたいです':
      return `${heroVerb(who, also, 'wants', 'want')} to make ${what}.`
    case '撮りたいです':
      return `${heroVerb(who, also, 'wants', 'want')} to take ${what}.`
    default:
      return null
  }
}

export function getHeroEnglish(frame: HeroSentenceFrame): string {
  if (isPosFrame(frame)) return getPosEnglishNormalized(frame)
  return normalizeHeroEnglishGloss(resolveHeroEnglish(frame))
}

function resolveHeroEnglish(frame: HeroSentenceFrame): string {
  const scaffold = getScaffoldEnglish(frame)
  if (scaffold) return scaffold

  const conjugated = getMasuConjugationEnglish(frame)
  if (conjugated) return applyEnglishFrame(frame, conjugated)

  const verbEnding = getVerbEndingEnglish(frame)
  if (verbEnding) return applyEnglishFrame(frame, verbEnding)

  const who = heroSubject(frame)
  const also = heroAlsoMark(frame)
  const topicAlso = frame.objectParticle === 'も' ? ' also' : ''
  const what = formatHeroEnglishObject(frame)
  const mod = frame.modifier ? MODIFIER_ENGLISH[frame.modifier] : ''
  const really = mod === 'really' ? 'really ' : ''
  const together = mod === 'together' ? ' together' : ''
  const sometimes = mod === 'sometimes' ? 'sometimes ' : ''
  const often = mod === 'often' ? 'often ' : ''
  const daily = mod === 'every day' ? ' every day' : ''

  const weekend = mod === 'on weekends' ? ' on weekends' : ''
  const afternoon = mod === 'in the afternoon' ? ' in the afternoon' : ''
  const thisMorning = mod === 'this morning' ? ' this morning' : ''
  const tonight = mod === 'tonight' ? ' tonight' : ''

  if (frame.objectParticle === 'について' && frame.predicate === '知りたいです') {
    return `${heroVerb(who, also, 'wants', 'want')} to learn about ${what}.`
  }
  if (frame.objectParticle === 'について' && frame.predicate === '勉強します') {
    return `${heroVerb(who, also, 'studies', 'study')} ${what}.`
  }
  if (frame.objectParticle === 'について' && frame.predicate === '考えます') {
    return `${heroVerb(who, also, 'thinks', 'think')} about ${what}.`
  }
  if (frame.objectParticle === 'について' && frame.predicate === '読みます') {
    return `${heroVerb(who, also, 'reads', 'read')} about ${what}.`
  }
  if (frame.objectParticle === 'は' && frame.predicate === '重要です') {
    return topicCommentSentence(frame.word, 'important', topicAlso !== '') ?? `${what} is important.`
  }
  if (frame.objectParticle === 'は' && frame.predicate === '難しいです') {
    return topicCommentSentence(frame.word, 'difficult', topicAlso !== '') ?? `${what} is difficult.`
  }
  if (frame.objectParticle === 'は' && frame.predicate === '変化しています') {
    return topicCommentSentence(frame.word, 'changing', topicAlso !== '') ?? `${what} is changing.`
  }
  if (frame.objectParticle === 'は' && frame.predicate === '面白いです') {
    return topicCommentSentence(frame.word, 'interesting', topicAlso !== '') ?? `${what} is interesting.`
  }
  if (frame.predicate === '興味があります') {
    return `${heroLinkingVerb(who, also)} interested in ${what}.`
  }
  if (frame.predicate === '好きです') {
    if (frame.word === '旅行') return `${heroPrefixedVerb(who, also, really, 'likes', 'like')} to travel.`
    if (frame.word === '家族') return `${heroPrefixedVerb(who, also, really, 'likes', 'like')} spending time with family.`
    if (frame.word === '文化') return `${heroPrefixedVerb(who, also, really, 'likes', 'like')} learning about culture.`
    return `${heroPrefixedVerb(who, also, really, 'likes', 'like')} ${what}.`
  }
  if (frame.predicate === '面白いです') {
    return `${heroVerb(who, also, 'finds', 'find')} ${what} interesting.`
  }
  if (frame.predicate === '楽しいです') {
    return `${heroVerb(who, also, 'finds', 'find')} ${what} fun.`
  }
  if (frame.predicate === '上手です') {
    if (frame.word === '日本語') return `${heroLinkingVerb(who, also)} good at Japanese.`
    if (frame.word === '料理') return `${heroLinkingVerb(who, also)} good at cooking.`
    return `${heroLinkingVerb(who, also)} good at ${what}.`
  }
  if (frame.predicate === '下手です') {
    if (frame.word === '料理') return `${heroLinkingVerb(who, also)} not great at cooking.`
    if (frame.word === '漢字') return `${heroLinkingVerb(who, also)} struggling with kanji.`
    return `${heroLinkingVerb(who, also)} not great at ${what}.`
  }
  if (frame.predicate === '欲しいです') {
    if (frame.word === '旅行') return `${heroPrefixedVerb(who, also, really, 'wants', 'want')} to travel.`
    return `${heroPrefixedVerb(who, also, really, 'wants', 'want')} ${what}.`
  }
  if (frame.predicate === '食べたいです') {
    return `${heroVerb(who, also, 'wants', 'want')} to eat ${what}.`
  }
  if (frame.predicate === '行きたいです') {
    if (frame.word === 'デート') return `${heroVerb(who, also, 'wants', 'want')} to go on a date.`
    return `${heroVerb(who, also, 'wants', 'want')} to go to ${what}.`
  }
  if (frame.predicate === '見たいです') {
    return `${heroVerb(who, also, 'wants', 'want')} to watch ${what}.`
  }
  if (frame.predicate === '買いたいです') {
    return `${heroVerb(who, also, 'wants', 'want')} to buy ${what}.`
  }
  if (frame.objectParticle === 'で' && frame.predicate === '食べます') {
    return `${heroVerb(who, also, 'eats', 'eat')} at ${what}${daily}.`
  }
  if (frame.predicate === '食べます') {
    return daily
      ? `${heroVerb(who, also, 'eats', 'eat')} ${what}${daily}.`
      : `${heroVerb(who, also, 'eats', 'eat')} ${what}.`
  }
  if (frame.predicate === '飲みます') {
    if (thisMorning) {
      return `${heroVerb(who, also, 'drinks', 'drink')} ${what}${thisMorning}.`
    }
    if (tonight) {
      return `${heroVerb(who, also, 'drinks', 'drink')} ${what}${tonight}.`
    }
    if (sometimes) {
      return `${heroPrefixedVerb(who, also, sometimes, 'drinks', 'drink')} ${what}.`
    }
    if (afternoon) {
      return `${heroVerb(who, also, 'drinks', 'drink')} ${what}${afternoon}.`
    }
    return `${heroVerb(who, also, 'drinks', 'drink')} ${what}.`
  }
  if (frame.predicate === '読みます') {
    if (frame.word === '地図') {
      return often
        ? `${heroPrefixedVerb(who, also, often, 'reads', 'read')} a map.`
        : `${heroVerb(who, also, 'reads', 'read')} a map.`
    }
    return often
      ? `${heroPrefixedVerb(who, also, often, 'reads', 'read')} ${what}.`
      : `${heroVerb(who, also, 'reads', 'read')} ${what}.`
  }
  if (frame.predicate === '勉強します') {
    return daily
      ? `${heroVerb(who, also, 'studies', 'study')} ${what}${daily}.`
      : `${heroVerb(who, also, 'studies', 'study')} ${what}.`
  }
  if (frame.predicate === '行きます') {
    if (frame.word === 'デート') {
      if (mod === 'starting now') return `${heroLinkingVerb(who, also)} going on a date now.`
      if (together) return `${heroLinkingVerb(who, also)} going on a date${together}.`
      if (weekend) return `${heroVerb(who, also, 'goes', 'go')} on a date${weekend}.`
      if (afternoon) return `${heroLinkingVerb(who, also)} going on a date${afternoon}.`
      if (tonight) return `${heroLinkingVerb(who, also)} going on a date${tonight}.`
      return `${heroLinkingVerb(who, also)} going on a date.`
    }
    if (mod === 'starting now') {
      return `${heroLinkingVerb(who, also)} going to ${what} now.`
    }
    if (together) {
      return `${heroLinkingVerb(who, also)} going to ${what}${together}.`
    }
    if (weekend) {
      return `${heroVerb(who, also, 'goes', 'go')} to ${what}${weekend}.`
    }
    if (afternoon) {
      return `${heroLinkingVerb(who, also)} going to ${what}${afternoon}.`
    }
    if (tonight) {
      return `${heroLinkingVerb(who, also)} going to ${what}${tonight}.`
    }
    return `${heroVerb(who, also, 'goes', 'go')} to ${what}.`
  }
  if (frame.predicate === '見ます') {
    return daily
      ? `${heroVerb(who, also, 'watches', 'watch')} ${what}${daily}.`
      : `${heroVerb(who, also, 'watches', 'watch')} ${what}.`
  }
  if (frame.predicate === '買います') {
    return `${heroVerb(who, also, 'buys', 'buy')} ${what}.`
  }
  if (frame.predicate === '作ります') {
    return `${heroVerb(who, also, 'makes', 'make')} ${what}.`
  }
  if (frame.predicate === '撮ります') {
    return `${heroVerb(who, also, 'takes', 'take')} ${what}.`
  }
  if (frame.predicate === '会います') {
    return `${heroLinkingVerb(who, also)} meeting ${what}${tonight}.`
  }
  if (frame.predicate === '話します') {
    return `${heroVerb(who, also, 'speaks', 'speak')} ${what}.`
  }
  if (frame.predicate === '待ちます') {
    return `${heroLinkingVerb(who, also)} waiting for ${what}.`
  }
  if (frame.predicate === '使います') {
    return `${heroVerb(who, also, 'uses', 'use')} ${what}.`
  }
  if (frame.predicate === '聞きます') {
    return often
      ? `${heroPrefixedVerb(who, also, often, 'listens', 'listen')} to ${what}.`
      : `${heroVerb(who, also, 'listens', 'listen')} to ${what}.`
  }
  if (frame.predicate === 'できます') {
    if (frame.word === '日本語') return `${who}${also} can speak Japanese.`
    if (frame.word === '漢字') return `${who}${also} can read kanji.`
    if (frame.word === '料理') return `${who}${also} can cook.`
    return `${who}${also} can do ${what}.`
  }
  if (frame.predicate === 'します') {
    if (frame.word === '野球') return `${heroVerb(who, also, 'plays', 'play')} baseball${weekend}.`
    if (frame.word === 'テニス') return `${heroVerb(who, also, 'plays', 'play')} tennis${weekend}.`
    if (frame.word === 'ゴルフ') return `${heroVerb(who, also, 'plays', 'play')} golf${weekend}.`
    if (frame.word === '散歩') {
      if (frame.modifier === '公園で') {
        return `${heroVerb(who, also, 'takes', 'take')} a walk in the park${weekend}.`
      }
      return `${heroVerb(who, also, 'goes', 'go')} for a walk${weekend}.`
    }
    if (frame.word === '買い物') return `${heroVerb(who, also, 'goes', 'go')} shopping${weekend}.`
    return `${heroVerb(who, also, 'does', 'do')} ${what}${weekend}.`
  }

  if (frame.predicate === '見に行きます') {
    const withFriend = frame.modifier === '友達と' ? ' with my friend' : ''
    return `${heroVerb(who, also, 'goes', 'go')}${withFriend} to see ${what}.`
  }
  if (frame.predicate === '借りに行きます') {
    return `${heroVerb(who, also, 'goes', 'go')} to the library to borrow ${what}.`
  }
  if (frame.predicate === '大切だと思います') {
    return `${heroVerb(who, also, 'thinks', 'think')} ${what} is important.`
  }
  if (frame.predicate === '難しいと思います') {
    return `${heroVerb(who, also, 'thinks', 'think')} ${what} is difficult.`
  }
  if (frame.predicate === '面白いと思います') {
    return `${heroVerb(who, also, 'thinks', 'think')} ${what} is interesting.`
  }
  if (frame.predicate === '話せるようになりたいです') {
    return `${heroVerb(who, also, 'wants', 'want')} to become able to speak ${what}.`
  }
  if (frame.predicate === '読めるようになりたいです') {
    return `${heroVerb(who, also, 'wants', 'want')} to become able to read ${what}.`
  }
  if (frame.predicate === '勉強し続けています') {
    return `${heroVerb(who, also, 'keeps', 'keep')} studying ${what}${daily}.`
  }
  if (frame.predicate === '復習しなければなりません') {
    return `${heroVerb(who, also, 'has', 'have')} to review ${what}${daily}.`
  }
  if (frame.predicate === '経験があります') {
    if (frame.word === '旅行') return `${who}${also} has travel experience.`
    if (frame.word === '留学') return `${who}${also} has experience studying abroad.`
    if (frame.word === '仕事') return `${who}${also} has work experience.`
    return `${who}${also} has experience with ${what}.`
  }
  if (frame.predicate === '食べたいと思います') {
    return `${heroVerb(who, also, 'feels', 'feel')} like eating ${what}.`
  }
  if (frame.predicate === '行きたいと思います') {
    return `${heroVerb(who, also, 'feels', 'feel')} like going to ${what}.`
  }
  if (frame.predicate === '行きます' && mod === 'by train') {
    return `${heroVerb(who, also, 'goes', 'go')} to ${what} by train.`
  }
  if (frame.predicate === '行きます' && mod === 'by bus') {
    return `${heroVerb(who, also, 'goes', 'go')} to ${what} by bus.`
  }
  if (frame.predicate === '行きます' && mod === 'with my friend') {
    return `${heroVerb(who, also, 'goes', 'go')} to ${what} with my friend.`
  }
  if (frame.predicate === '行きます' && mod === 'soon') {
    return `${heroVerb(who, also, 'is', 'am')} going to ${what} soon.`
  }
  if (frame.predicate === '興味があります' && mod === 'lately') {
    return `${heroLinkingVerb(who, also)} been interested in ${what} lately.`
  }
  if (frame.predicate === '読みます' && mod === 'at the library') {
    return `${heroVerb(who, also, 'reads', 'read')} ${what} at the library.`
  }
  if (frame.predicate === '食べます' && mod === 'at the office') {
    return `${heroVerb(who, also, 'eats', 'eat')} ${what} at the office.`
  }
  if (frame.predicate === '会います' && mod === 'at the station') {
    return `${heroLinkingVerb(who, also)} meeting ${what} at the station.`
  }
  if (frame.predicate === '待ちます' && mod === 'at the station') {
    return `${heroLinkingVerb(who, also)} waiting for ${what} at the station.`
  }

  const masuRetry = getMasuConjugationEnglish(frame)
  if (masuRetry) return applyEnglishFrame(frame, masuRetry)

  if (frame.predicate.endsWith('ました') || frame.predicate.endsWith('でした')) {
    return applyEnglishFrame(
      frame,
      `${heroVerb(who, also, 'did something with', 'did something with')} ${what}.`,
    )
  }

  return applyEnglishFrame(frame, `${heroVerb(who, also, 'uses', 'use')} ${what}.`)
}
