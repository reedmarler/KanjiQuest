import type { JlptLevel } from './types'
import { getApprovedContentRecords } from './contentDatabase'
import { loadActiveSentencePatternIds, sentencePatternCatalog } from '../data/sentencePatternCatalog'
import { generateCategorySentence } from './categorySentenceEngine'
import { inferPreferredTranslation } from '../data/preferredVocabularyTranslations'

type PreviewLevel = JlptLevel
type Pos =
  | 'pronoun'
  | 'noun'
  | 'verb'
  | 'i_adjective'
  | 'na_adjective'
  | 'adverb'
  | 'time_expression'
  | 'place_expression'

interface PreviewVocabItem {
  id: string
  surface: string
  reading: string
  english: string
  pos: Pos
  jlpt: PreviewLevel
  tags: string[]
  conjugationClass?: 'ichidan' | 'godan_u' | 'godan_ku_iku' | 'godan_mu' | 'godan_ru' | 'godan_su' | 'suru'
  transitivity?: 'transitive' | 'intransitive'
  objectTags?: string[]
  userVocab?: boolean
}

interface PreviewSlotSpec {
  pos: Pos
  tags?: string[]
  transitivity?: 'transitive' | 'intransitive'
  conjugation?: 'dictionary' | 'masu' | 'te' | 'ta'
}

interface PreviewFrame {
  id: string
  jlpt: PreviewLevel
  label: string
  slots: Record<string, PreviewSlotSpec>
  tokens: Array<{ type: 'literal'; text: string } | { type: 'slot'; slot: string }>
  grammar: Array<{ pattern: string; meaning: string; jlpt: PreviewLevel }>
}

interface FilledSlot {
  item: PreviewVocabItem
  surface: string
  reading: string
  conjugation?: string
}

export interface GeneratedPreviewSentence {
  frameId: string
  level: PreviewLevel
  japanese: string
  reading: string
  english: string
  slots: Record<string, {
    id: string
    surface: string
    dictionaryForm: string
    reading: string
    english: string
    pos: Pos
    jlpt: PreviewLevel
    tags: string[]
    conjugation?: string
  }>
  furigana: Array<{ text: string; reading: string; slot?: string }>
  grammar: PreviewFrame['grammar']
  validation: string[]
}

const rank: Record<PreviewLevel, number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 }

const frames: PreviewFrame[] = [
  {
    id: 'n5-01',
    jlpt: 'N5',
    label: '[subject] は [object] を [verb-masu]',
    slots: {
      subject: { pos: 'pronoun', tags: ['person'] },
      object: { pos: 'noun', tags: ['edible', 'drinkable', 'readable', 'watchable'] },
      verb: { pos: 'verb', transitivity: 'transitive', conjugation: 'masu' },
    },
    tokens: [
      { type: 'slot', slot: 'subject' },
      { type: 'literal', text: 'は' },
      { type: 'slot', slot: 'object' },
      { type: 'literal', text: 'を' },
      { type: 'slot', slot: 'verb' },
    ],
    grammar: [
      { pattern: 'は', meaning: 'topic marker', jlpt: 'N5' },
      { pattern: 'を', meaning: 'direct object marker', jlpt: 'N5' },
      { pattern: 'ます', meaning: 'polite non-past verb ending', jlpt: 'N5' },
    ],
  },
  {
    id: 'n5-03',
    jlpt: 'N5',
    label: '[subject] は [place] で [object] を [verb-masu]',
    slots: {
      subject: { pos: 'pronoun', tags: ['person'] },
      place: { pos: 'place_expression', tags: ['action_place'] },
      object: { pos: 'noun', tags: ['edible', 'drinkable', 'readable', 'watchable', 'study_item'] },
      verb: { pos: 'verb', transitivity: 'transitive', conjugation: 'masu' },
    },
    tokens: [
      { type: 'slot', slot: 'subject' },
      { type: 'literal', text: 'は' },
      { type: 'slot', slot: 'place' },
      { type: 'literal', text: 'で' },
      { type: 'slot', slot: 'object' },
      { type: 'literal', text: 'を' },
      { type: 'slot', slot: 'verb' },
    ],
    grammar: [
      { pattern: 'で', meaning: 'place where an action happens', jlpt: 'N5' },
      { pattern: 'を', meaning: 'direct object marker', jlpt: 'N5' },
    ],
  },
  {
    id: 'n5-02',
    jlpt: 'N5',
    label: '[subject] は [place] に [verb-masu]',
    slots: {
      subject: { pos: 'pronoun', tags: ['person'] },
      place: { pos: 'place_expression', tags: ['destination'] },
      verb: { pos: 'verb', tags: ['movement'], transitivity: 'intransitive', conjugation: 'masu' },
    },
    tokens: [
      { type: 'slot', slot: 'subject' },
      { type: 'literal', text: 'は' },
      { type: 'slot', slot: 'place' },
      { type: 'literal', text: 'に' },
      { type: 'slot', slot: 'verb' },
    ],
    grammar: [
      { pattern: 'に', meaning: 'destination/time marker', jlpt: 'N5' },
      { pattern: 'ます', meaning: 'polite non-past verb ending', jlpt: 'N5' },
    ],
  },
  {
    id: 'n5-04', jlpt: 'N5', label: '[subject] は [companion] と [verb-masu]',
    slots: { subject: { pos: 'pronoun', tags: ['person'] }, companion: { pos: 'pronoun', tags: ['person'] }, verb: { pos: 'verb', tags: ['conversation'], transitivity: 'intransitive', conjugation: 'masu' } },
    tokens: [{ type: 'slot', slot: 'subject' }, { type: 'literal', text: 'は' }, { type: 'slot', slot: 'companion' }, { type: 'literal', text: 'と' }, { type: 'slot', slot: 'verb' }],
    grammar: [{ pattern: 'と', meaning: 'with / together with', jlpt: 'N5' }],
  },
  {
    id: 'n5-05', jlpt: 'N5', label: '[subject] は [time] に [verb-masu]',
    slots: { subject: { pos: 'pronoun', tags: ['person'] }, time: { pos: 'time_expression', tags: ['clock_time'] }, verb: { pos: 'verb', tags: ['routine'], transitivity: 'intransitive', conjugation: 'masu' } },
    tokens: [{ type: 'slot', slot: 'subject' }, { type: 'literal', text: 'は' }, { type: 'slot', slot: 'time' }, { type: 'literal', text: 'に' }, { type: 'slot', slot: 'verb' }],
    grammar: [{ pattern: 'に', meaning: 'specific time marker', jlpt: 'N5' }],
  },
  {
    id: 'n5-06', jlpt: 'N5', label: '[subject] は [object] が 好きです',
    slots: { subject: { pos: 'pronoun', tags: ['person'] }, object: { pos: 'noun', tags: ['likable'] } },
    tokens: [{ type: 'slot', slot: 'subject' }, { type: 'literal', text: 'は' }, { type: 'slot', slot: 'object' }, { type: 'literal', text: 'が好きです' }],
    grammar: [{ pattern: 'が好きです', meaning: 'likes / is fond of', jlpt: 'N5' }],
  },
  {
    id: 'n5-07', jlpt: 'N5', label: '[subject] は [adjective]',
    slots: { subject: { pos: 'time_expression', tags: ['today'] }, adjective: { pos: 'i_adjective', tags: ['weather'] } },
    tokens: [{ type: 'slot', slot: 'subject' }, { type: 'literal', text: 'は' }, { type: 'slot', slot: 'adjective' }, { type: 'literal', text: 'です' }],
    grammar: [{ pattern: 'い-adjective です', meaning: 'polite adjective predicate', jlpt: 'N5' }],
  },
  {
    id: 'n5-08', jlpt: 'N5', label: '[subject] は [noun] です',
    slots: { subject: { pos: 'pronoun', tags: ['person'] }, noun: { pos: 'noun', tags: ['identity'] } },
    tokens: [{ type: 'slot', slot: 'subject' }, { type: 'literal', text: 'は' }, { type: 'slot', slot: 'noun' }, { type: 'literal', text: 'です' }],
    grammar: [{ pattern: 'です', meaning: 'polite copula', jlpt: 'N5' }],
  },
  {
    id: 'n5-09', jlpt: 'N5', label: '[subject] は [object] を [adverb] [verb-masu]',
    slots: { subject: { pos: 'pronoun', tags: ['person'] }, object: { pos: 'noun', tags: ['readable'] }, adverb: { pos: 'adverb', tags: ['manner'] }, verb: { pos: 'verb', tags: ['study'], transitivity: 'transitive', conjugation: 'masu' } },
    tokens: [{ type: 'slot', slot: 'subject' }, { type: 'literal', text: 'は' }, { type: 'slot', slot: 'object' }, { type: 'literal', text: 'を' }, { type: 'slot', slot: 'adverb' }, { type: 'slot', slot: 'verb' }],
    grammar: [{ pattern: '副詞 + 動詞', meaning: 'adverb modifies the action', jlpt: 'N5' }],
  },
  {
    id: 'n5-10', jlpt: 'N5', label: '[subject] は [place] へ [verb-masu]',
    slots: { subject: { pos: 'pronoun', tags: ['person'] }, place: { pos: 'place_expression', tags: ['destination'] }, verb: { pos: 'verb', tags: ['movement'], transitivity: 'intransitive', conjugation: 'masu' } },
    tokens: [{ type: 'slot', slot: 'subject' }, { type: 'literal', text: 'は' }, { type: 'slot', slot: 'place' }, { type: 'literal', text: 'へ' }, { type: 'slot', slot: 'verb' }],
    grammar: [{ pattern: 'へ', meaning: 'direction marker', jlpt: 'N5' }],
  },
  {
    id: 'n4-te-kudasai',
    jlpt: 'N4',
    label: '[object] を [verb-te] ください',
    slots: {
      object: { pos: 'noun', tags: ['edible', 'drinkable', 'readable', 'study_item'] },
      verb: { pos: 'verb', transitivity: 'transitive', conjugation: 'te' },
    },
    tokens: [
      { type: 'slot', slot: 'object' },
      { type: 'literal', text: 'を' },
      { type: 'slot', slot: 'verb' },
      { type: 'literal', text: 'ください' },
    ],
    grammar: [
      { pattern: 'てください', meaning: 'please do', jlpt: 'N4' },
    ],
  },
  {
    id: 'n4-experience',
    jlpt: 'N4',
    label: '[subject] は [object] を [verb-ta] ことがあります',
    slots: {
      subject: { pos: 'pronoun', tags: ['person'] },
      object: { pos: 'noun', tags: ['edible', 'readable', 'watchable', 'study_item'] },
      verb: { pos: 'verb', transitivity: 'transitive', conjugation: 'ta' },
    },
    tokens: [
      { type: 'slot', slot: 'subject' },
      { type: 'literal', text: 'は' },
      { type: 'slot', slot: 'object' },
      { type: 'literal', text: 'を' },
      { type: 'slot', slot: 'verb' },
      { type: 'literal', text: 'ことがあります' },
    ],
    grammar: [
      { pattern: 'たことがあります', meaning: 'has done before / has experience doing', jlpt: 'N4' },
    ],
  },
]

const vocab: PreviewVocabItem[] = [
  { id: 'watashi', surface: '私', reading: 'わたし', english: 'I', pos: 'pronoun', jlpt: 'N5', tags: ['person'], userVocab: true },
  { id: 'tomodachi', surface: '友だち', reading: 'ともだち', english: 'my friend', pos: 'pronoun', jlpt: 'N5', tags: ['person'], userVocab: true },
  { id: 'sensei', surface: '先生', reading: 'せんせい', english: 'the teacher', pos: 'pronoun', jlpt: 'N5', tags: ['person'], userVocab: true },
  { id: 'gohan', surface: 'ご飯', reading: 'ごはん', english: 'rice', pos: 'noun', jlpt: 'N5', tags: ['thing', 'food', 'edible'], userVocab: true },
  { id: 'pan', surface: 'パン', reading: 'パン', english: 'bread', pos: 'noun', jlpt: 'N5', tags: ['thing', 'food', 'edible'], userVocab: true },
  { id: 'ocha', surface: 'お茶', reading: 'おちゃ', english: 'tea', pos: 'noun', jlpt: 'N5', tags: ['thing', 'drinkable'], userVocab: true },
  { id: 'hon', surface: '本', reading: 'ほん', english: 'a book', pos: 'noun', jlpt: 'N5', tags: ['thing', 'readable', 'study_item'], userVocab: true },
  { id: 'eiga', surface: '映画', reading: 'えいが', english: 'a movie', pos: 'noun', jlpt: 'N5', tags: ['thing', 'watchable'], userVocab: true },
  { id: 'kanji', surface: '漢字', reading: 'かんじ', english: 'kanji', pos: 'noun', jlpt: 'N5', tags: ['thing', 'study_item', 'readable'], userVocab: true },
  { id: 'gakkou', surface: '学校', reading: 'がっこう', english: 'school', pos: 'place_expression', jlpt: 'N5', tags: ['place', 'destination', 'action_place'], userVocab: true },
  { id: 'ie', surface: '家', reading: 'いえ', english: 'home', pos: 'place_expression', jlpt: 'N5', tags: ['place', 'destination', 'action_place'], userVocab: true },
  { id: 'toshoshitsu', surface: '図書室', reading: 'としょしつ', english: 'the library room', pos: 'place_expression', jlpt: 'N4', tags: ['place', 'destination', 'action_place', 'readable_place'] },
  { id: 'ashita', surface: '明日', reading: 'あした', english: 'tomorrow', pos: 'time_expression', jlpt: 'N5', tags: ['time', 'future_time'], userVocab: true },
  { id: 'mainichi', surface: '毎日', reading: 'まいにち', english: 'every day', pos: 'time_expression', jlpt: 'N5', tags: ['time', 'routine_time'], userVocab: true },
  { id: 'raishuu', surface: '来週', reading: 'らいしゅう', english: 'next week', pos: 'time_expression', jlpt: 'N5', tags: ['time', 'future_time'] },
  { id: 'kyou', surface: '今日', reading: 'きょう', english: 'today', pos: 'time_expression', jlpt: 'N5', tags: ['time', 'today'] },
  { id: 'shichiji', surface: '七時', reading: 'しちじ', english: 'at seven', pos: 'time_expression', jlpt: 'N5', tags: ['time', 'clock_time'] },
  { id: 'hachiji', surface: '八時', reading: 'はちじ', english: 'at eight', pos: 'time_expression', jlpt: 'N5', tags: ['time', 'clock_time'] },
  { id: 'ongaku', surface: '音楽', reading: 'おんがく', english: 'music', pos: 'noun', jlpt: 'N5', tags: ['thing', 'likable'] },
  { id: 'nihongo', surface: '日本語', reading: 'にほんご', english: 'Japanese', pos: 'noun', jlpt: 'N5', tags: ['thing', 'likable', 'study_item'] },
  { id: 'gakusei', surface: '学生', reading: 'がくせい', english: 'a student', pos: 'noun', jlpt: 'N5', tags: ['identity', 'person'] },
  { id: 'kaishain', surface: '会社員', reading: 'かいしゃいん', english: 'an office worker', pos: 'noun', jlpt: 'N5', tags: ['identity', 'person'] },
  { id: 'atsui', surface: '暑い', reading: 'あつい', english: 'hot', pos: 'i_adjective', jlpt: 'N5', tags: ['weather'] },
  { id: 'samui', surface: '寒い', reading: 'さむい', english: 'cold', pos: 'i_adjective', jlpt: 'N5', tags: ['weather'] },
  { id: 'yukkuri', surface: 'ゆっくり', reading: 'ゆっくり', english: 'slowly', pos: 'adverb', jlpt: 'N5', tags: ['manner'] },
  { id: 'taberu', surface: '食べる', reading: 'たべる', english: 'eat', pos: 'verb', jlpt: 'N5', tags: ['action'], conjugationClass: 'ichidan', transitivity: 'transitive', objectTags: ['edible'], userVocab: true },
  { id: 'nomu', surface: '飲む', reading: 'のむ', english: 'drink', pos: 'verb', jlpt: 'N5', tags: ['action'], conjugationClass: 'godan_mu', transitivity: 'transitive', objectTags: ['drinkable'], userVocab: true },
  { id: 'yomu', surface: '読む', reading: 'よむ', english: 'read', pos: 'verb', jlpt: 'N5', tags: ['action', 'study'], conjugationClass: 'godan_mu', transitivity: 'transitive', objectTags: ['readable'], userVocab: true },
  { id: 'miru', surface: '見る', reading: 'みる', english: 'watch', pos: 'verb', jlpt: 'N5', tags: ['action'], conjugationClass: 'ichidan', transitivity: 'transitive', objectTags: ['watchable'], userVocab: true },
  { id: 'benkyou_suru', surface: '勉強する', reading: 'べんきょうする', english: 'study', pos: 'verb', jlpt: 'N5', tags: ['action', 'study'], conjugationClass: 'suru', transitivity: 'transitive', objectTags: ['study_item', 'readable'], userVocab: true },
  { id: 'iku', surface: '行く', reading: 'いく', english: 'go', pos: 'verb', jlpt: 'N5', tags: ['movement'], conjugationClass: 'godan_ku_iku', transitivity: 'intransitive', userVocab: true },
  { id: 'kaeru', surface: '帰る', reading: 'かえる', english: 'return', pos: 'verb', jlpt: 'N5', tags: ['movement'], conjugationClass: 'godan_ru', transitivity: 'intransitive' },
  { id: 'hanasu', surface: '話す', reading: 'はなす', english: 'talk', pos: 'verb', jlpt: 'N5', tags: ['conversation'], conjugationClass: 'godan_su', transitivity: 'intransitive' },
  { id: 'okiru', surface: '起きる', reading: 'おきる', english: 'wake up', pos: 'verb', jlpt: 'N5', tags: ['routine'], conjugationClass: 'ichidan', transitivity: 'intransitive' },
  { id: 'tsukuru', surface: '作る', reading: 'つくる', english: 'make', pos: 'verb', jlpt: 'N4', tags: ['action'], conjugationClass: 'godan_ru', transitivity: 'transitive', objectTags: ['food', 'thing'] },
]

function seeded(seed: number) {
  let value = ((Math.imul(seed || 1, 0x9e3779b1) >>> 0) % 0x7fffffff) || 1
  return () => {
    value = (value * 48271) % 0x7fffffff
    return value / 0x7fffffff
  }
}

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)]!
}

function allowsLevel(item: { jlpt: PreviewLevel }, target: PreviewLevel) {
  return rank[item.jlpt] <= rank[target]
}

function hasAny(itemTags: string[], wanted?: string[]) {
  return !wanted?.length || wanted.some((tag) => itemTags.includes(tag))
}

const nonHumanSubjectTags = new Set(['animal','pet','dog','cat','bird','fish','insect','plant','tree','flower','grass','bush','crop','body','body-part','bodypart','anatomy'])
const politeSubjectIncompatibleWords = new Set(['お前','あんた','貴様','てめえ','奴'])

function isHumanSlotItem(item: PreviewVocabItem) {
  const tags = item.tags.map(tag => tag.trim().replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase().replace(/[_\s]+/g,'-'))
  return !politeSubjectIncompatibleWords.has(item.surface) && !tags.some(tag => nonHumanSubjectTags.has(tag))
}

function candidates(spec: PreviewSlotSpec, target: PreviewLevel, previousId?: string) {
  return [...vocab, ...approvedPreviewVocabulary()]
    .filter((item) => item.pos === spec.pos)
    .filter((item) => allowsLevel(item, target))
    .filter((item) => item.id !== previousId)
    .filter((item) => hasAny(item.tags, spec.tags))
    .filter((item) => !spec.transitivity || item.transitivity === spec.transitivity)
    .sort((a, b) => Number(Boolean(b.userVocab)) - Number(Boolean(a.userVocab)))
}

function approvedPreviewVocabulary(): PreviewVocabItem[] {
  return getApprovedContentRecords().flatMap((record) => {
    if (record.jlpt !== 'N5' && record.jlpt !== 'N4') return []
    const category = record.category.toLowerCase()
    const isVerb = record.kind === 'verb'
    const pos: Pos = isVerb ? 'verb' : category === 'person' ? 'pronoun' : category === 'place' || category === 'destination' ? 'place_expression' : category === 'time' ? 'time_expression' : category === 'adverb' ? 'adverb' : category === 'adjective' ? 'i_adjective' : 'noun'
    const meaning = record.english.toLowerCase()
    const tags = [...new Set([
      ...record.tags,
      category,
      category === 'food' ? 'edible' : '',
      category === 'place' ? 'action_place' : '',
      category === 'destination' ? 'destination' : '',
      category === 'object' ? 'thing' : '',
      /book|letter|newspaper|magazine|kanji|text/.test(meaning) ? 'readable' : '',
      /movie|film|television|video|anime/.test(meaning) ? 'watchable' : '',
      /tea|coffee|water|juice|milk|drink/.test(meaning) ? 'drinkable' : '',
      /food|rice|bread|meat|fish|fruit|meal/.test(meaning) ? 'edible' : '',
      /book|kanji|homework|lesson|text/.test(meaning) ? 'study_item' : '',
    ].filter(Boolean))]
    const verbClass = record.verbClass?.toLowerCase()
    const conjugationClass: PreviewVocabItem['conjugationClass'] = verbClass?.includes('ichidan') ? 'ichidan' : verbClass?.includes('suru') || verbClass?.includes('irregular') ? 'suru' : verbClass?.includes('-mu') ? 'godan_mu' : verbClass?.includes('-ru') ? 'godan_ru' : verbClass?.includes('-ku') ? 'godan_ku_iku' : verbClass?.includes('-su') ? 'godan_su' : verbClass?.includes('-u') ? 'godan_u' : undefined
    const generatorEnglish = record.kind === 'vocabulary'
      ? record.preferredTranslation ?? inferPreferredTranslation(record.japanese,record.english,record.reading)
      : record.english.replace(/^to\s+/i, '')
    return [{ id: `approved-${record.id}`, surface: record.japanese, reading: record.reading, english: generatorEnglish, pos, jlpt: record.jlpt, tags: tags.length ? tags : ['thing'], conjugationClass, transitivity: record.transitivity ?? (isVerb ? 'transitive' : undefined), objectTags: isVerb ? ['thing', 'edible', 'drinkable', 'readable', 'watchable', 'study_item'] : undefined, userVocab: true }]
  })
}

const godan: Record<string, { masu: string; te: string; ta: string }> = {
  godan_u: { masu: 'います', te: 'って', ta: 'った' },
  godan_ku_iku: { masu: 'きます', te: 'って', ta: 'った' },
  godan_mu: { masu: 'みます', te: 'んで', ta: 'んだ' },
  godan_ru: { masu: 'ります', te: 'って', ta: 'った' },
  godan_su: { masu: 'します', te: 'して', ta: 'した' },
}

function conjugate(item: PreviewVocabItem, form?: PreviewSlotSpec['conjugation']) {
  if (!form || form === 'dictionary' || item.pos !== 'verb') {
    return { surface: item.surface, reading: item.reading }
  }
  if (item.conjugationClass === 'ichidan') {
    const stem = item.surface.slice(0, -1)
    const readingStem = item.reading.slice(0, -1)
    const ending = form === 'masu' ? 'ます' : form === 'te' ? 'て' : 'た'
    return { surface: stem + ending, reading: readingStem + ending }
  }
  if (item.conjugationClass === 'suru') {
    const base = item.surface.slice(0, -2)
    const readingBase = item.reading.slice(0, -2)
    const ending = form === 'masu' ? 'します' : form === 'te' ? 'して' : 'した'
    return { surface: base + ending, reading: readingBase + ending }
  }
  const endings = item.conjugationClass ? godan[item.conjugationClass] : undefined
  if (endings) {
    const stem = item.surface.slice(0, -1)
    const readingStem = item.reading.slice(0, -1)
    return { surface: stem + endings[form], reading: readingStem + endings[form] }
  }
  return { surface: item.surface, reading: item.reading }
}

function compatible(object?: PreviewVocabItem, verb?: PreviewVocabItem) {
  if (!object || !verb || verb.transitivity !== 'transitive' || !verb.objectTags?.length) return true
  return object.tags.some((tag) => verb.objectTags?.includes(tag))
}

function verb3(verb: string, subject: string) {
  if (subject === 'I') return verb
  if (verb.endsWith('y')) return `${verb.slice(0, -1)}ies`
  if (verb.endsWith('ch') || verb.endsWith('sh') || verb.endsWith('s') || verb.endsWith('o')) return `${verb}es`
  return `${verb}s`
}

const participle: Record<string, string> = {
  eat: 'eaten',
  drink: 'drunk',
  read: 'read',
  watch: 'watched',
  study: 'studied',
  make: 'made',
}

function english(frame: PreviewFrame, slots: Record<string, FilledSlot>) {
  const subject = slots.subject?.item.english ?? ''
  if (frame.id === 'n5-01') {
    return `${subject} ${verb3(slots.verb!.item.english, subject)} ${slots.object!.item.english}.`
  }
  if (frame.id === 'n5-03') {
    return `${subject} ${verb3(slots.verb!.item.english, subject)} ${slots.object!.item.english} at ${slots.place!.item.english}.`
  }
  if (frame.id === 'n5-02' || frame.id === 'n5-10') {
    const place = slots.place!.item.english === 'home' ? 'home' : `to ${slots.place!.item.english}`
    return `${subject} ${verb3(slots.verb!.item.english, subject)} ${place}.`
  }
  if (frame.id === 'n5-04') return `${subject} ${verb3(slots.verb!.item.english, subject)} with ${slots.companion!.item.english}.`
  if (frame.id === 'n5-05') return `${subject} ${verb3(slots.verb!.item.english, subject)} ${slots.time!.item.english}.`
  if (frame.id === 'n5-06') return `${subject} ${subject === 'I' ? 'like' : 'likes'} ${slots.object!.item.english}.`
  if (frame.id === 'n5-07') return `${slots.subject!.item.english} is ${slots.adjective!.item.english}.`
  if (frame.id === 'n5-08') return `${subject} ${subject === 'I' ? 'am' : 'is'} ${slots.noun!.item.english}.`
  if (frame.id === 'n5-09') return `${subject} ${slots.adverb!.item.english} ${verb3(slots.verb!.item.english, subject)} ${slots.object!.item.english}.`
  if (frame.id === 'n4-te-kudasai') {
    return `Please ${slots.verb!.item.english} ${slots.object!.item.english}.`
  }
  if (frame.id === 'n4-experience') {
    const have = subject === 'I' ? 'have' : 'has'
    const done = participle[slots.verb!.item.english] ?? slots.verb!.item.english
    return `${subject} ${have} ${done} ${slots.object!.item.english} before.`
  }
  return 'Generated sentence.'
}

const catalogEnglish: Record<string, string> = {
  'n4-01': 'I want to read a book.', 'n4-02': 'I am reading a book.', 'n4-03': 'I read a book.', 'n4-04': 'I do not read a book.', 'n4-05': 'I have to study.', 'n4-06': 'You may eat.', 'n4-07': 'You must not enter.', 'n4-08': 'I have been to Japan.', 'n4-09': 'I study while listening to music.', 'n4-10': 'I begin studying.',
  'n3-01': 'I make a point of studying every day.', 'n3-02': 'I have decided to go to Japan.', 'n3-03': 'I become able to read kanji.', 'n3-04': 'I accidentally forget my homework.', 'n3-05': 'I make a reservation in advance.', 'n3-06': 'If it rains, I will not go.', 'n3-07': 'If I have time, I will go.', 'n3-08': 'Although I studied, I forgot it.', 'n3-09': 'Because it is raining, I stay home.', 'n3-10': 'I study in order to go to Japan.',
  'n2-01': 'It is not that I dislike it.', 'n2-02': 'I cannot allow myself to go.', 'n2-03': 'It was decided that I would be transferred.', 'n2-04': 'There is no need to worry.', 'n2-05': 'He must be the culprit.', 'n2-06': 'He should come.', 'n2-07': 'Life is difficult.', 'n2-08': "A voice like a bird's.", 'n2-09': 'I write it down so I do not forget.', 'n2-10': 'I am just about to go home.',
  'n1-01': 'I have no choice but to go.', 'n1-02': 'Success is nothing other than the result of effort.', 'n1-03': 'Although I studied, I forgot it.', 'n1-04': 'It could lead to an accident.', 'n1-05': 'Nothing can begin unless you eat.', 'n1-06': 'Even children know about it.', 'n1-07': 'Culture unique to Japan.', 'n1-08': 'Think according to reality.', 'n1-09': 'Discuss the issue.', 'n1-10': 'Offer a greeting on the occasion of departure.',
}

function catalogExample(frameId: string, level: PreviewLevel): GeneratedPreviewSentence | null {
  const pattern = sentencePatternCatalog.find(item => item.id === frameId && item.jlpt === level)
  if (!pattern) return null
  return {
    frameId: pattern.id,
    level,
    japanese: pattern.example,
    reading: '',
    english: catalogEnglish[pattern.id] ?? pattern.meaning,
    slots: {},
    furigana: [{ text: pattern.example, reading: pattern.example }],
    grammar: [{ pattern: pattern.structure, meaning: pattern.meaning, jlpt: level }],
    validation: [`Catalog pattern ${pattern.id.toUpperCase()}.`, `Required form: ${pattern.verbForm}.`, 'Advanced pattern uses its reviewed reference example.'],
  }
}

export function generatePreviewSentence(
  level: PreviewLevel,
  seed: number,
  previous?: GeneratedPreviewSentence,
  requestedFrameId?: string,
  includeInactive = false,
): GeneratedPreviewSentence {
  const rand = seeded(seed)
  const readyLevelPatterns=sentencePatternCatalog.filter(pattern=>pattern.jlpt===level && pattern.generatorReady)
  const effectiveRequestedFrameId=requestedFrameId ?? readyLevelPatterns[Math.abs(seed)%readyLevelPatterns.length]?.id
  if (level === 'N5' || level === 'N4' || level === 'N3') {
    const categorySentence = generateCategorySentence(seed, effectiveRequestedFrameId, level)
    if (categorySentence) return categorySentence
  }
  if (effectiveRequestedFrameId && !frames.some(frame => frame.id === effectiveRequestedFrameId)) {
    const example = catalogExample(effectiveRequestedFrameId, level)
    if (example) return example
  }
  const eligible = frames.filter((frame) => frame.jlpt === level)
  const activeIds = new Set(loadActiveSentencePatternIds())
  const activePool = level === 'N5' && !includeInactive ? eligible.filter(frame => activeIds.has(frame.id)) : eligible
  const requestedPool = effectiveRequestedFrameId ? activePool.filter(frame => frame.id === effectiveRequestedFrameId) : activePool
  const framePool = requestedPool.length ? requestedPool : activePool.length ? activePool : eligible
  if (!framePool.length) {
    const fallback = sentencePatternCatalog.find(pattern => pattern.jlpt === level)
    const example = fallback ? catalogExample(fallback.id, level) : null
    if (example) return example
    throw new Error(`No sentence patterns available for ${level}`)
  }
  const frame = pick(framePool, rand)
  const slots: Record<string, FilledSlot> = {}

  for (const [slotName, spec] of Object.entries(frame.slots)) {
    const previousId = previous?.frameId === frame.id ? previous.slots[slotName]?.id : undefined
    let pool = candidates(spec, level, previousId)
    if (slotName === 'subject' || slotName === 'companion') pool = pool.filter(isHumanSlotItem)
    if (slotName === 'companion' && slots.subject) pool = pool.filter(item => item.id !== slots.subject.item.id)
    const item = pick(pool, rand)
    const form = conjugate(item, spec.conjugation)
    slots[slotName] = { item, ...form, conjugation: spec.conjugation }
  }

  if (!compatible(slots.object?.item, slots.verb?.item) && slots.object && slots.verb) {
    const object = slots.object.item
    const spec = frame.slots.verb!
    const verbPool = candidates(spec, level).filter((item) => compatible(object, item))
    const item = pick(verbPool, rand)
    slots.verb = { item, ...conjugate(item, spec.conjugation), conjugation: spec.conjugation }
  }

  const furigana = frame.tokens.map((token) => {
    if (token.type === 'literal') return { text: token.text, reading: token.text }
    const slot = slots[token.slot]!
    return { text: slot.surface, reading: slot.reading, slot: token.slot }
  })

  const validation = [
    `Frame is ${frame.jlpt}.`,
    'Vocab and grammar do not exceed target level.',
    'Object/verb compatibility checked.',
    'User app vocab is preferred when available.',
  ]

  return {
    frameId: frame.id,
    level,
    japanese: furigana.map((part) => part.text).join(''),
    reading: furigana.map((part) => part.reading).join(''),
    english: english(frame, slots),
    slots: Object.fromEntries(Object.entries(slots).map(([name, slot]) => [
      name,
      {
        id: slot.item.id,
        surface: slot.surface,
        dictionaryForm: slot.item.surface,
        reading: slot.reading,
        english: slot.item.english,
        pos: slot.item.pos,
        jlpt: slot.item.jlpt,
        tags: slot.item.tags,
        conjugation: slot.conjugation,
      },
    ])),
    furigana,
    grammar: frame.grammar,
    validation,
  }
}
