import { getApprovedContentRecords } from './contentDatabase'
import type { GeneratedPreviewSentence } from './sentenceGeneratorPreview'
import { normalizeTags } from '../data/tagTaxonomy'
import { allCards } from '../data'
import { classifyVocabularyCard } from './vocabularyClassifier'
import { inferPreferredTranslation } from '../data/preferredVocabularyTranslations'
import type { JlptLevel } from './types'
import { toHiragana } from 'wanakana'

export const SENTENCE_CATEGORIES = [
  'Person','Animal','Plant','Food','Drink','Medicine','Place','Building','Room','Object','Tool','Technology','Vehicle','Clothing','Furniture','Book','Document','Media','Time','Weather','Emotion','Activity','Event','Adverb','Number','Money','Language',
] as const

export type SentenceCategory = typeof SENTENCE_CATEGORIES[number]

interface WordRecord {
  id: string
  japanese: string
  reading: string
  english: string
  preferredTranslation: string
  jlpt?: JlptLevel
  categories: SentenceCategory[]
  tags: string[]
  source: 'built-in' | 'approved'
}

export interface CategoryWordRecord {
  id: string
  japanese: string
  reading: string
  english: string
  preferredTranslation: string
  jlpt?: JlptLevel
  categories: SentenceCategory[]
  tags: string[]
  source: 'built-in' | 'approved'
}

const TAG_OVERRIDES_KEY = 'kanji-quest-word-tag-overrides-v1'

function loadTagOverrides(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(TAG_OVERRIDES_KEY)
    return stored ? JSON.parse(stored) as Record<string, string[]> : {}
  } catch {
    return {}
  }
}

function withEffectiveTags(word: WordRecord): WordRecord {
  const override = loadTagOverrides()[word.id]
  const tags = normalizeTags(override ?? word.tags)
  // Categories decide where a word may appear in a sentence. Tags describe
  // meaning inside that category and must never silently change the category.
  return { ...word, tags }
}

export function saveCategoryWordTags(wordId: string, tags: string[]) {
  if (typeof window === 'undefined') return
  const normalized = normalizeTags(tags)
  const overrides = loadTagOverrides()
  overrides[wordId] = normalized
  window.localStorage.setItem(TAG_OVERRIDES_KEY, JSON.stringify(overrides))
}

export function getSavedCategoryWordTags(wordId: string) {
  const saved = loadTagOverrides()[wordId]
  return saved ? normalizeTags(saved) : null
}

export type SupportedGrammarForm = 'dictionary' | 'masu'

export interface VerbSlotRule {
  categories: SentenceCategory[]
  /** At least one semantic tag must match when tags are supplied. */
  tags?: string[]
}

export interface VerbUsageRecord {
  id: string
  japanese: string
  reading: string
  english: string
  englishThird: string
  verbClass: 'ichidan' | 'godan-mu' | 'godan-su' | 'godan-ku'
  sentencePattern: string
  subjectCategories: SentenceCategory[]
  objectCategories: SentenceCategory[]
  translationTemplate: string
  supportedGrammarForms: SupportedGrammarForm[]
  tags: string[]
  slots: Record<string, VerbSlotRule>
}

const words: WordRecord[] = [
  ['watashi','私','わたし','I',['Person'],['speaker']], ['gakusei','学生','がくせい','the student',['Person'],['student']], ['sensei','先生','せんせい','the teacher',['Person'],['teacher']], ['tomodachi','友達','ともだち','a friend',['Person'],['friend']],
  ['inu','犬','いぬ','the dog',['Animal'],['pet']], ['neko','猫','ねこ','the cat',['Animal'],['pet']],
  ['ringo','りんご','りんご','an apple',['Food'],['fruit','healthy']], ['pan','パン','パン','bread',['Food'],['baked']], ['sushi','寿司','すし','sushi',['Food'],['japanese']], ['ramen','ラーメン','ラーメン','ramen',['Food'],['noodles']], ['cake','ケーキ','ケーキ','cake',['Food'],['dessert','sweet']], ['hamburger','ハンバーガー','ハンバーガー','a hamburger',['Food'],['fast-food']],
  ['ocha','お茶','おちゃ','tea',['Drink'],['tea','hot']], ['mizu','水','みず','water',['Drink'],['cold','healthy']], ['coffee','コーヒー','コーヒー','coffee',['Drink'],['coffee','hot']], ['milk','牛乳','ぎゅうにゅう','milk',['Drink'],['dairy','cold']],
  ['gakkou','学校','がっこう','school',['Building'],['education','school']], ['kouen','公園','こうえん','the park',['Place'],['outdoor','park']], ['eki','駅','えき','the station',['Building'],['transport','station']], ['ie','家','いえ','home',['Building'],['home','house']], ['toshokan','図書館','としょかん','the library',['Building'],['public','study','library']], ['kyoushitsu','教室','きょうしつ','the classroom',['Room'],['school','classroom']],
  ['hon','本','ほん','a book',['Book'],['reading']], ['shousetsu','小説','しょうせつ','a novel',['Book'],['fiction']], ['shinbun','新聞','しんぶん','a newspaper',['Document'],['news']], ['tegami','手紙','てがみ','a letter',['Document'],['personal']],
  ['eiga','映画','えいが','a movie',['Media'],['film']], ['anime','アニメ','アニメ','anime',['Media'],['animation']], ['terebi','テレビ','テレビ','television',['Media','Technology'],['video']],
  ['shichiji','七時','しちじ','at seven',['Time'],['clock-time']], ['hachiji','八時','はちじ','at eight',['Time'],['clock-time']],
  ['yukkuri','ゆっくり','ゆっくり','slowly',['Adverb'],['adverb','manner']],
].map(([id,japanese,reading,english,categories,tags]) => ({ id, japanese, reading, english, preferredTranslation:inferPreferredTranslation(String(japanese),String(english)), categories, tags, source: 'built-in' })) as WordRecord[]

function catalogWords(): WordRecord[] {
  return allCards.filter(card => card.type === 'vocab').map(card => {
    const classification = classifyVocabularyCard(card)
    const english = card.back || card.english || 'Meaning needed'
    return { id:`catalog-${card.id}`, japanese:card.front, reading:card.reading ?? 'Reading needed', english, preferredTranslation:inferPreferredTranslation(card.front,english), jlpt:card.jlpt, categories:[classification.category], tags:classification.tags, source:'built-in' }
  })
}

const edibleTags = ['food','fruit','vegetable','meat','seafood','fish','rice','bread','noodles','soup','dessert','snack','candy','ice-cream','ingredient','edible']
const drinkableTags = ['drink','drinkable','beverage','water','tea','coffee','juice','soda','alcohol','milk','dairy']
const readableTags = ['book','document','paper','notebook','magazine','newspaper','reading','fiction','news','letter','text','textbook','comic']
// A broad `media` tag is descriptive but not enough to make an item a natural
// object of 見る. For example, books are media but default to 読む.
const watchableTags = ['movie','film','television','tv','video','anime','animation','picture','photo','game']
// The current verb records describe human activities. Animals and plants need
// their own verb usages so that an otherwise valid category cannot create a
// sentence such as “a horse goes to university” or “a tree talks.”
const humanSubjectTags = ['person','pronoun','speaker','man','woman','boy','girl','baby','child','teenager','adult','elderly','human','family','mother','father','wife','husband','brother','sister','grandparent','grandchild','relative','friend','partner','classmate','coworker','neighbor','customer','boss','employee','occupation','teacher','student','doctor','nurse']
const standaloneDestinationTags = ['country','city','town','village','neighborhood','building','house','home','apartment','school','education','university','office','store','restaurant','cafe','hospital','hotel','library','museum','temple','shrine','church','bank','station','airport','park','forest','mountain','river','lake','beach','ocean','island','platform','parking-lot','room','kitchen','bathroom','bedroom','classroom','public','transport','destination']
const eatingLocationTags = ['restaurant','cafe','house','home','kitchen','dining-room','room','school','education','classroom','office','workplace','park','hotel','eating-location']
// These tags describe words that can stand directly before a verb. Broad tags
// such as Speed, Manner, or naAdjective are not sufficient: 急速, for example,
// needs に and cannot be inserted as 急速読みます.
const readingMannerTags = ['slowly','leisurely','quickly','carefully','quietly','silently','aloud','clearly','fluently','adverbial-manner']
const wakeTimeTags = ['clock-time','hour','morning','afternoon','evening','night','dawn','sunrise','noon','midnight','wake-time']
const niIncompatibleTimeTags = new Set(normalizeTags(['today','tonight','tomorrow','yesterday','this-morning','this-evening','this-time','frequency','daily','weekly','monthly','yearly','every-morning','every-evening','every-night','every-day']))
const niIncompatibleTimeWords = new Set(['今朝','今晩','今日','明日','昨日','毎朝','毎晩','毎日'])
const nonHumanSubjectTags = new Set(normalizeTags(['animal','pet','dog','cat','bird','fish','insect','plant','tree','flower','grass','bush','crop','body','body-part','anatomy']))
const politeSubjectIncompatibleWords = new Set(['お前','あんた','貴様','てめえ','奴'])

const verbs: VerbUsageRecord[] = [
  { id:'taberu-basic', japanese:'食べる', reading:'たべる', english:'eat', englishThird:'eats', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','consumption','eating','ichidan','transitive','food'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'nomu-basic', japanese:'飲む', reading:'のむ', english:'drink', englishThird:'drinks', verbClass:'godan-mu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food','Drink'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','consumption','drinking','godan','transitive','drink'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food','Drink'],tags:drinkableTags} } },
  { id:'yomu-basic', japanese:'読む', reading:'よむ', english:'read', englishThird:'reads', verbClass:'godan-mu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Book','Document','Media'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','reading','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Book','Document','Media'],tags:readableTags} } },
  { id:'miru-basic', japanese:'見る', reading:'みる', english:'watch', englishThird:'watches', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Media','Technology'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','perception','watching','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Media','Technology'],tags:watchableTags} } },
  { id:'iku-ni', japanese:'行く', reading:'いく', english:'go', englishThird:'goes', verbClass:'godan-ku', sentencePattern:'n5-02', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','motion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'taberu-location', japanese:'食べる', reading:'たべる', english:'eat', englishThird:'eats', verbClass:'ichidan', sentencePattern:'n5-03', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','consumption','eating','ichidan','transitive','food'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:eatingLocationTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'hanasu-companion', japanese:'話す', reading:'はなす', english:'talk', englishThird:'talks', verbClass:'godan-su', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','speaking','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'okiru-time', japanese:'起きる', reading:'おきる', english:'wake up', englishThird:'wakes up', verbClass:'ichidan', sentencePattern:'n5-05', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Time}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','sleeping','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, time:{categories:['Time'],tags:wakeTimeTags} } },
  { id:'yomu-adverb', japanese:'読む', reading:'よむ', english:'read', englishThird:'reads', verbClass:'godan-mu', sentencePattern:'n5-09', subjectCategories:['Person'], objectCategories:['Object','Book','Document','Media'], translationTemplate:'{Subject} {Adverb} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','reading','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Book','Document','Media'],tags:readableTags}, adverb:{categories:['Adverb'],tags:readingMannerTags} } },
  { id:'iku-e', japanese:'行く', reading:'いく', english:'go', englishThird:'goes', verbClass:'godan-ku', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','motion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
]

export function getVerbUsageRecords(): VerbUsageRecord[] {
  return verbs.map(verb => ({
    ...verb,
    subjectCategories:[...verb.subjectCategories],
    objectCategories:[...verb.objectCategories],
    supportedGrammarForms:[...verb.supportedGrammarForms],
    tags:[...verb.tags],
    slots:Object.fromEntries(Object.entries(verb.slots).map(([slot,rule]) => [slot,{ categories:[...rule.categories], tags:rule.tags ? [...rule.tags] : undefined }])),
  }))
}

export function categorySeedCount(category: SentenceCategory) {
  return words.filter(word => word.categories.includes(category)).length
}

export function categoryVerbUseCount(category: SentenceCategory) {
  return verbs.filter(verb => Object.values(verb.slots).some(rule => rule.categories.includes(category))).length
}

const categoryLookup = new Map<string,SentenceCategory>([
  ...SENTENCE_CATEGORIES.map(category => [category.toLowerCase(), category] as const),
  ['people & living things','Person'],['places','Place'],['objects','Object'],['food & drink','Food'],
  ['actions','Activity'],['descriptors','Adverb'],['time & numbers','Time'],['function words','Language'],
])

function approvedWords(): WordRecord[] {
  return getApprovedContentRecords().flatMap(record => {
    if (record.kind !== 'vocabulary') return []
    const categories = (record.categories?.length ? record.categories : [record.category]).flatMap(value => {
      const category = categoryLookup.get(value.toLowerCase())
      return category ? [category] : []
    })
    if (!categories.length) return []
    return [withEffectiveTags({ id:`approved-${record.id}`, japanese:record.japanese, reading:record.reading, english:record.english, preferredTranslation:record.preferredTranslation ?? inferPreferredTranslation(record.japanese,record.english), jlpt:record.jlpt, categories, tags:record.tags, source:'approved' as const })]
  })
}

export function getCategoryWords(category: SentenceCategory): CategoryWordRecord[] {
  return editorWords()
    .filter(word => word.categories.includes(category))
    .sort((a, b) => a.english.localeCompare(b.english))
}

export function getAllCategoryWords(): CategoryWordRecord[] {
  return editorWords()
    .sort((a, b) => a.english.localeCompare(b.english))
}

function editorWords(): WordRecord[] {
  const merged = new Map<string,WordRecord>()
  for (const word of [...catalogWords(), ...words, ...approvedWords()]) {
    const key = `${word.japanese}|${word.reading}`
    const existing = merged.get(key)
    merged.set(key, word.source === 'approved' ? word : existing ? { ...existing, ...word, categories:word.categories, tags:normalizeTags([...existing.tags,...word.tags]) } : word)
  }
  return [...merged.values()].map(withEffectiveTags)
}

function seededPick<T>(items: T[], seed: number, salt: number) {
  const mixed = (Math.imul(seed + salt * 101, 0x9e3779b1) >>> 0)
  return items[mixed % items.length]!
}

function conjugate(verb: VerbUsageRecord) {
  if (verb.verbClass === 'ichidan') return { japanese:verb.japanese.slice(0,-1)+'ます', reading:verb.reading.slice(0,-1)+'ます' }
  const endings = verb.verbClass === 'godan-mu' ? 'みます' : verb.verbClass === 'godan-su' ? 'します' : 'きます'
  return { japanese:verb.japanese.slice(0,-1)+endings, reading:verb.reading.slice(0,-1)+endings }
}

function categoryMatch(word: WordRecord, allowed: SentenceCategory[]) {
  return word.categories.some(category => allowed.includes(category))
}

function matchingTags(word: WordRecord, allowedTags?: string[]) {
  if (!allowedTags?.length) return []
  const allowed = new Set(normalizeTags(allowedTags))
  return word.tags.filter(tag => allowed.has(tag))
}

function primaryEnglishGloss(value: string) {
  return value
    .split(/\s*(?:;|\/|,)\s*/)[0]!
    .replace(/^\(\d+\)\s*/, '')
    .replace(/^\([^)]*\)\s*/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/[.;,]+$/, '')
    .trim()
}

function hasDeterminer(value: string) {
  return /^(?:a|an|the|this|that|these|those|my|your|his|her|our|their|another|each|every|some|any|no)\b/i.test(value)
}

function indefinite(value: string) {
  const lower = value.toLowerCase()
  const plural = /^(?:people|men|women|children|data)$/.test(lower) || (/s$/.test(lower) && !/(?:ss|us|is)$/.test(lower))
  if (!value || hasDeterminer(value) || plural) return value
  return `${/^[aeiou]/i.test(value) ? 'an' : 'a'} ${value}`
}

function definite(value: string) {
  if (!value || hasDeterminer(value)) return value
  return `the ${value}`
}

function tagSet(word: WordRecord) {
  return new Set(normalizeTags(word.tags))
}

const animateEnglishByTag: Array<[string,string]> = [
  ['parent','parent'],['mother','mother'],['father','father'],['daughter','daughter'],['son','son'],['wife','wife'],['husband','husband'],
  ['brother','brother'],['sister','sister'],['grandparent','grandparent'],
  ['grandchild','grandchild'],['relative','relative'],
  ['boy','boy'],['girl','girl'],['man','man'],['woman','woman'],['baby','baby'],['child','child'],
  ['teenager','teenager'],['adult','adult'],['elderly','elderly person'],['student','student'],
  ['teacher','teacher'],['doctor','doctor'],['nurse','nurse'],['police','police officer'],
  ['firefighter','firefighter'],['lawyer','lawyer'],['engineer','engineer'],['programmer','programmer'],
  ['artist','artist'],['writer','writer'],['musician','musician'],['chef','chef'],['farmer','farmer'],
  ['cashier','cashier'],['driver','driver'],['athlete','athlete'],['player','player'],['boss','boss'],
  ['employee','employee'],['customer','customer'],['coworker','coworker'],['classmate','classmate'],
  ['neighbor','neighbor'],['friend','friend'],['partner','partner'],['opponent','opponent'],
  ['dog','dog'],['cat','cat'],['bird','bird'],['fish','fish'],['horse','horse'],['cow','cow'],
  ['pig','pig'],['chicken','chicken'],['rabbit','rabbit'],['bear','bear'],['lion','lion'],
  ['tiger','tiger'],['elephant','elephant'],['monkey','monkey'],['snake','snake'],['insect','insect'],
]

const countableObjectTags = new Set(normalizeTags([
  'book','document','paper','notebook','magazine','newspaper','letter','textbook','comic','dictionary',
  'movie','film','picture','photo','game','computer','laptop','phone','tablet','camera','television',
  'bottle','cup','glass','box','bag','wallet','pen','pencil','knife','tool',
]))

const definitePlaceTags = new Set(normalizeTags([
  'building','house','home','school','university','office','store','restaurant','cafe','hospital','hotel',
  'library','museum','temple','shrine','church','bank','station','airport','park','forest','mountain','apartment',
  'river','lake','beach','ocean','platform','parking-lot','road','bridge','intersection','room','kitchen',
  'bathroom','bedroom','living-room','classroom',
]))

function animateEnglish(word: WordRecord, gloss: string) {
  const tags = tagSet(word)
  const familyReference: Record<string,string> = {
    '母':'my mother','父':'my father','娘':'my daughter','息子':'my son','妻':'my wife','夫':'my husband','主人':'my husband',
  }
  if (familyReference[word.japanese]) return familyReference[word.japanese]!
  if (/^(?:I|you|he|she|we|they|it)$/i.test(gloss)) return gloss
  if (/^(?:people|men|women|children)$/i.test(gloss)) return gloss
  if (word.preferredTranslation.trim()) {
    if (/^family$/i.test(gloss)) return definite('family')
    return indefinite(gloss)
  }
  const taggedNoun = animateEnglishByTag.find(([tag]) => tags.has(tag))?.[1]
  if (taggedNoun) return indefinite(taggedNoun)
  if (/^family$/i.test(gloss)) return definite('family')
  return indefinite(taggedNoun ?? gloss)
}

function englishPhrase(word: WordRecord, slot: string) {
  const gloss = primaryEnglishGloss(word.preferredTranslation || word.english)
  const tags = tagSet(word)

  if (slot === 'subject' || slot === 'companion') return animateEnglish(word, gloss)
  if (slot === 'object' && [...tags].some(tag => countableObjectTags.has(tag))) return indefinite(gloss)
  if (slot === 'location') {
    if (tags.has('home')) return 'at home'
    if ([...tags].some(tag => ['room','kitchen','bathroom','bedroom','living-room','classroom','house'].includes(tag))) return `in ${definite(gloss)}`
    if (tags.has('school') && /^school$/i.test(gloss)) return 'at school'
    return `at ${definite(gloss)}`
  }
  if (slot === 'destination') {
    if (tags.has('home')) return 'the house'
    if ([...tags].some(tag => definitePlaceTags.has(tag))) return definite(gloss)
    if ([...tags].some(tag => ['country','city','town','village','neighborhood','island'].includes(tag))) return indefinite(gloss)
  }
  if (slot === 'time') {
    if (tags.has('morning')) return `in ${definite(gloss)}`
    if (tags.has('afternoon') || tags.has('evening')) return `in ${definite(gloss)}`
    if (tags.has('night') || tags.has('noon') || tags.has('midnight')) return `at ${gloss}`
    if ((tags.has('clock-time') || tags.has('hour')) && !/^at\b/i.test(gloss)) return `at ${gloss}`
  }
  return gloss
}

function subjectUsesBaseVerb(subject: string) {
  return /^(?:I|you|we|they|people|men|women|children)\b/i.test(subject)
}

function translatedVerb(verb: VerbUsageRecord, filled: Record<string,WordRecord>, useBase: boolean) {
  const objectTags = filled.object ? tagSet(filled.object) : new Set<string>()
  if (verb.japanese === '見る' && (objectTags.has('picture') || objectTags.has('photo'))) {
    return useBase ? 'look at' : 'looks at'
  }
  return useBase ? verb.english : verb.englishThird
}

function renderTranslation(template: string, verb: VerbUsageRecord, filled: Record<string,WordRecord>) {
  const subject = filled.subject ? englishPhrase(filled.subject, 'subject') : ''
  const englishVerb = translatedVerb(verb, filled, subjectUsesBaseVerb(subject))
  const values: Record<string,string> = { Verb:englishVerb }
  for (const [slot,word] of Object.entries(filled)) {
    values[slot.charAt(0).toUpperCase()+slot.slice(1)] = englishPhrase(word, slot)
  }
  const rendered = template.replace(/\{([A-Za-z]+)\}/g, (_,name: string) => values[name] ?? `{${name}}`)
  return rendered.charAt(0).toUpperCase() + rendered.slice(1)
}

function kanaReading(reading: string, surface='') {
  if (surface && /^[\u30A0-\u30FFー]+$/.test(surface)) {
    return surface.replace(/[\u30A1-\u30F6]/g, character => String.fromCharCode(character.charCodeAt(0)-0x60))
  }
  const primary=reading.split(/\s*(?:\/|;|,)\s*/)[0]?.trim() ?? ''
  if (!primary || /reading needed/i.test(primary)) return ''
  return toHiragana(primary.replace(/\s+/g,''))
}

export function generateCategorySentence(seed: number, requestedPatternId?: string): GeneratedPreviewSentence | null {
  // A requested pattern limits the eligible records, but the executable unit is
  // still the verb: once chosen, its own pattern and slot rules drive the rest.
  const verbPool = requestedPatternId ? verbs.filter(verb => verb.sentencePattern === requestedPatternId) : verbs
  if (!verbPool.length) return null
  const verb = seededPick(verbPool, seed, 1)
  const vocabulary = editorWords()
  const filled: Record<string, WordRecord> = {}
  const slotTagMatches: Record<string,string[]> = {}
  let salt = 2
  for (const [slot, rule] of Object.entries(verb.slots)) {
    let pool = vocabulary.filter(word => categoryMatch(word, rule.categories))
    if (rule.tags?.length) pool = pool.filter(word => matchingTags(word, rule.tags).length > 0)
    if (verb.id === 'yomu-adverb' && slot === 'object') pool = pool.filter(word => !tagSet(word).has('news'))
    if (slot === 'time') pool = pool.filter(word => {
      const tags = tagSet(word)
      return !niIncompatibleTimeWords.has(word.japanese) && ![...tags].some(tag => niIncompatibleTimeTags.has(tag))
    })
    if (slot === 'subject' || slot === 'companion') pool = pool.filter(word => {
      const tags = tagSet(word)
      return !politeSubjectIncompatibleWords.has(word.japanese)
        && !tags.has('question')
        && !tags.has('question-word')
        && !tags.has('interrogative')
        && ![...tags].some(tag => nonHumanSubjectTags.has(tag))
    })
    if (slot === 'companion' && filled.subject) pool = pool.filter(word => word.id !== filled.subject.id)
    if (!pool.length) return null
    filled[slot] = seededPick(pool, seed, salt++)
    slotTagMatches[slot] = matchingTags(filled[slot], rule.tags)
  }
  const polite = conjugate(verb)
  const wordPart = (slot: string) => ({ text:filled[slot]!.japanese, reading:kanaReading(filled[slot]!.reading, filled[slot]!.japanese), slot })
  const verbPart = () => ({ text:polite.japanese, reading:kanaReading(polite.reading, polite.japanese), slot:'verb' })
  const literalPart = (text: string, reading=text) => ({ text, reading })
  const builders: Record<string, () => GeneratedPreviewSentence['furigana']> = {
    'n5-01':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('object'),literalPart('を'),verbPart()],
    'n5-02':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('destination'),literalPart('に'),verbPart()],
    'n5-03':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('location'),literalPart('で'),wordPart('object'),literalPart('を'),verbPart()],
    'n5-04':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('companion'),literalPart('と'),verbPart()],
    'n5-05':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('time'),literalPart('に'),verbPart()],
    'n5-09':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('object'),literalPart('を'),wordPart('adverb'),verbPart()],
    'n5-10':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('destination'),literalPart('へ','え'),verbPart()],
  }
  const furigana = builders[verb.sentencePattern]?.()
  if (!furigana) return null
  const japanese=furigana.map(part=>part.text).join('')
  const reading=furigana.map(part=>part.reading || part.text).join('')
  const slots: GeneratedPreviewSentence['slots'] = Object.fromEntries(Object.entries(filled).map(([name,word]) => [name,{ id:word.id, surface:word.japanese, dictionaryForm:word.japanese, reading:word.reading, english:word.preferredTranslation, pos:name==='subject'||name==='companion'?'pronoun':name==='time'||name==='adverb'?'time_expression':name==='destination'||name==='location'?'place_expression':'noun', jlpt:word.jlpt ?? 'N5', tags:[`category:${word.categories.join('|')}`,...word.tags,...slotTagMatches[name].map(tag=>`matched:${tag}`)] }]))
  slots.verb = { id:`verb-${verb.id}`, surface:polite.japanese, dictionaryForm:verb.japanese, reading:polite.reading, english:verb.english, pos:'verb', jlpt:'N5', tags:[...verb.tags,`pattern:${verb.sentencePattern}`,`forms:${verb.supportedGrammarForms.join('|')}`], conjugation:'masu' }
  const semanticChecks = Object.entries(slotTagMatches).filter(([,tags])=>tags.length).map(([slot,tags])=>`${slot}: ${tags.join(', ')}`)
  return { frameId:verb.sentencePattern, level:'N5', japanese, reading, english:renderTranslation(verb.translationTemplate,verb,filled), slots, furigana, grammar:[{pattern:verb.sentencePattern,meaning:'Verb-selected category and tag pattern',jlpt:'N5'}], validation:[`Verb selected first: ${verb.japanese}.`,`Verb selected pattern: ${verb.sentencePattern.toUpperCase()}.`,`Slots matched allowed categories${semanticChecks.length ? ` and semantic tags (${semanticChecks.join('; ')})` : ''}.`,`Supported forms: ${verb.supportedGrammarForms.join(', ')}.`] }
}
