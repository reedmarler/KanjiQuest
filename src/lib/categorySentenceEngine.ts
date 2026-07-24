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
const CONTENT_DATABASE_EVENT = 'kanji-quest-content-database-change'
let editorWordsCache: WordRecord[] | null = null

if (typeof window !== 'undefined') {
  window.addEventListener(CONTENT_DATABASE_EVENT,()=>{ editorWordsCache=null })
}

function loadTagOverrides(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(TAG_OVERRIDES_KEY)
    return stored ? JSON.parse(stored) as Record<string, string[]> : {}
  } catch {
    return {}
  }
}

function withEffectiveTags(word: WordRecord, overrides = loadTagOverrides()): WordRecord {
  const override = overrides[word.id]
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
  editorWordsCache=null
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

export interface CategorySentenceOptions {
  /** Keep the sentence seed fixed while varying one eligible slot. */
  slotSeeds?: Partial<Record<string,number>>
  /** Force one verb usage so callers can inspect its compatible vocabulary. */
  verbId?: string
}

const words: WordRecord[] = [
  ['watashi','私','わたし','I',['Person'],['speaker']], ['watashitachi','私たち','わたしたち','we',['Person'],['speaker','group','pronoun']], ['gakusei','学生','がくせい','the student',['Person'],['student']], ['sensei','先生','せんせい','the teacher',['Person'],['teacher']], ['tomodachi','友達','ともだち','a friend',['Person'],['friend']],
  ['inu','犬','いぬ','the dog',['Animal'],['pet']], ['neko','猫','ねこ','the cat',['Animal'],['pet']],
  ['ringo','りんご','りんご','an apple',['Food'],['fruit','healthy']], ['pan','パン','パン','bread',['Food'],['baked']], ['sushi','寿司','すし','sushi',['Food'],['japanese']], ['ramen','ラーメン','ラーメン','ramen',['Food'],['noodles']], ['cake','ケーキ','ケーキ','cake',['Food'],['dessert','sweet']], ['hamburger','ハンバーガー','ハンバーガー','a hamburger',['Food'],['fast-food']],
  ['ocha','お茶','おちゃ','tea',['Drink'],['tea','hot']], ['mizu','水','みず','water',['Drink'],['cold','healthy']], ['coffee','コーヒー','コーヒー','coffee',['Drink'],['coffee','hot']], ['milk','牛乳','ぎゅうにゅう','milk',['Drink'],['dairy','cold']],
  ['gakkou','学校','がっこう','school',['Building'],['education','school']], ['kouen','公園','こうえん','the park',['Place'],['outdoor','park']], ['eki','駅','えき','the station',['Building'],['transport','station']], ['ie','家','いえ','home',['Building'],['home','house']], ['toshokan','図書館','としょかん','the library',['Building'],['public','study','library']], ['kyoushitsu','教室','きょうしつ','the classroom',['Room'],['school','classroom']],
  ['hon','本','ほん','a book',['Book'],['reading']], ['shousetsu','小説','しょうせつ','a novel',['Book'],['fiction']], ['shinbun','新聞','しんぶん','a newspaper',['Document'],['news']], ['tegami','手紙','てがみ','a letter',['Document'],['personal']],
  ['eiga','映画','えいが','a movie',['Media'],['film']], ['anime','アニメ','アニメ','anime',['Media'],['animation']], ['terebi','テレビ','テレビ','television',['Media','Technology'],['video']],
  ['shichiji','七時','しちじ','at seven',['Time'],['clock-time']], ['hachiji','八時','はちじ','at eight',['Time'],['clock-time']],
  ['yukkuri','ゆっくり','ゆっくり','slowly',['Adverb'],['adverb','manner']],
].map(([id,japanese,reading,english,categories,tags]) => ({ id, japanese, reading, english, preferredTranslation:inferPreferredTranslation(String(japanese),String(english),String(reading)), categories, tags, source: 'built-in' })) as WordRecord[]

let catalogWordCache: WordRecord[] | null = null

function catalogWords(): WordRecord[] {
  if (catalogWordCache) return catalogWordCache
  catalogWordCache = allCards.filter(card => card.type === 'vocab').map(card => {
    const classification = classifyVocabularyCard(card)
    const english = card.back || card.english || 'Meaning needed'
    return { id:`catalog-${card.id}`, japanese:card.front, reading:card.reading ?? 'Reading needed', english, preferredTranslation:inferPreferredTranslation(card.front,english,card.reading), jlpt:card.jlpt, categories:[classification.category], tags:classification.tags, source:'built-in' }
  })
  return catalogWordCache
}

// `ingredient` is deliberately absent: sugar, flour, and oil are what a dish is
// made of, not what someone sits down and eats.
const edibleTags = ['food','fruit','vegetable','meat','seafood','fish','rice','bread','noodles','soup','dessert','snack','candy','ice-cream','edible']
const drinkableTags = ['drink','drinkable','beverage','water','tea','coffee','juice','soda','alcohol','milk','dairy']
// Solid foods that also carry a drink tag — ice cream and yogurt are dairy but
// are eaten, so these tags override drinkability.
const solidFoodTags = ['dessert','snack','candy','ice-cream','yogurt','cheese','butter','fruit','vegetable','meat','seafood','fish','rice','bread','noodles','egg','protein','staple-food','meal','grain']
// A few imported dairy words arrive without a solid-food tag. Keep this small
// lexical backstop until their source metadata is enriched.
const solidFoodWords = new Set(['アイスクリーム','アイス','ヨーグルト','チーズ','バター'])
// Cooking inputs, whatever else they are tagged. 砂糖 is food, but 砂糖を食べます
// describes an odd habit rather than a meal.
const cookingInputTags = ['ingredient','seasoning','condiment','spice','flavoring','sauce','oil','flour','sugar','salt']
// `paper` and `text` are deliberately absent: they describe the material or the
// writing on an item rather than something a person reads end to end, and they
// let stamps, tickets, and name cards become objects of 読む. `letter` is absent
// for a different reason — it covers both mail and letters of the alphabet, so
// it made 文字 readable. 手紙 qualifies through `document`.
const readableTags = ['book','document','notebook','magazine','newspaper','reading','fiction','news','textbook','comic']
// Paper goods that carry writing but are not read. Tagging alone cannot separate
// these from letters and documents, so they are named directly.
const unreadableObjectWords = new Set(['切手','切符','名刺','カード','札','紙','封筒','領収書','値札'])
// A broad `media` tag is descriptive but not enough to make an item a natural
// object of 見る. For example, books are media but default to 読む.
const watchableTags = ['movie','film','television','tv','video','anime','animation','picture','photo','game']
// The current verb records describe human activities. Animals and plants need
// their own verb usages so that an otherwise valid category cannot create a
// sentence such as “a horse goes to university” or “a tree talks.”
const humanSubjectTags = ['person','pronoun','speaker','man','woman','boy','girl','baby','child','teenager','adult','elderly','human','family','mother','father','wife','husband','brother','sister','grandparent','grandchild','relative','friend','partner','classmate','coworker','neighbor','customer','boss','employee','occupation','teacher','student','doctor','nurse']
const standaloneDestinationTags = ['country','city','town','village','neighborhood','building','house','home','apartment','school','education','university','office','store','restaurant','cafe','hospital','hotel','library','museum','temple','shrine','church','bank','station','airport','park','forest','mountain','river','lake','beach','ocean','island','platform','parking-lot','room','kitchen','bathroom','bedroom','classroom','public','transport','destination']
// `education` is deliberately absent: it also covers libraries and study rooms,
// where eating is exactly what you do not do. Schools stay through `school`.
const eatingLocationTags = ['restaurant','cafe','cafeteria','house','home','kitchen','dining-room','room','school','classroom','office','workplace','park','hotel','eating-location']
// These tags describe words that can stand directly before a verb. Broad tags
// such as Speed, Manner, or naAdjective are not sufficient: 急速, for example,
// needs に and cannot be inserted as 急速読みます.
// `clearly` is excluded: はっきり describes speech and perception, and はっきり読む
// reads as “read out distinctly” rather than the plain manner of reading this
// pattern teaches.
const readingMannerTags = ['slowly','leisurely','quickly','carefully','quietly','silently','aloud','fluently','adverbial-manner']
const wakeTimeTags = ['clock-time','hour','morning','dawn','sunrise','wake-time']
const niIncompatibleTimeTags = new Set(normalizeTags(['today','tonight','tomorrow','yesterday','morning','this-morning','this-evening','this-time','frequency','daily','weekly','monthly','yearly','every-morning','every-evening','every-night','every-day']))
const niIncompatibleTimeWords = new Set(['今朝','今晩','今日','明日','昨日','毎朝','毎晩','毎日'])
// 床, 壁, and 天井 are parts of a place rather than places you travel between:
// walking from the floor to the library names no starting point.
// 国 names no particular place — “goes to a country” says nothing a learner can
// picture. 外国 and the named countries in the catalog carry the same grammar
// with a meaning attached.
const destinationIncompatibleWords = new Set(['家庭','通り','床','壁','天井','屋根','階','段','角','国'])
const destinationIncompatibleTags = new Set(normalizeTags(['household','family','street','road','route','front','surface','exterior','relative-location','floor','wall','ceiling','roof','building-part','stairs','pillar']))
const nonHumanSubjectTags = new Set(normalizeTags(['animal','pet','dog','cat','bird','fish','insect','plant','tree','flower','grass','bush','crop','body','body-part','anatomy']))
const politeSubjectIncompatibleWords = new Set(['お前','あんた','貴様','てめえ','奴','人間','人類','誰','だれ','どなた','何方'])
// Written and formal-speech pronouns. They are not wrong with ます, but these
// sentences model everyday speech, where 私たち carries the same meaning.
const formalRegisterSubjectWords = new Set(['我々','我','私共','小生','当方','貴殿','拙者'])
// Person words that need an antecedent (本人 = the person just mentioned) or that
// belong to legal and business register (個人 = an individual). A generated
// sentence supplies no such context, so 人 or a named person reads naturally
// where these do not.
const contextDependentSubjectWords = new Set(['個人','本人','他人','当人','各自','人物','相手','私自身'])
// Bare 子 is clipped or literary — everyday Japanese says 子ども, or attaches a
// modifier as in あの子. The catalog already carries 子供 and 女の子.
const preferLongerFormWords = new Set(['子'])

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
    const preferredTranslation = inferPreferredTranslation(record.japanese,record.english,record.reading) || record.preferredTranslation?.trim() || record.english
    return [{ id:`approved-${record.id}`, japanese:record.japanese, reading:record.reading, english:record.english, preferredTranslation, jlpt:record.jlpt, categories, tags:record.tags, source:'approved' as const }]
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
  if (editorWordsCache) return editorWordsCache
  const merged = new Map<string,WordRecord>()
  const overrides = loadTagOverrides()
  for (const word of [...catalogWords(), ...words, ...approvedWords()]) {
    const key = `${word.japanese}|${word.reading}`
    const existing = merged.get(key)
    merged.set(key, word.source === 'approved' ? word : existing ? { ...existing, ...word, categories:word.categories, tags:normalizeTags([...existing.tags,...word.tags]) } : word)
  }
  editorWordsCache=[...merged.values()].map(word=>withEffectiveTags(word,overrides))
  return editorWordsCache
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

// English nouns that take no article and no plural — “eats rice”, “wants money”.
// Everything else in an object slot gets “a”, which is the safer default: a
// missing article reads as broken English, while these read as broken only if
// one is added.
const uncountableGlosses = new Set([
  'water','rice','bread','milk','tea','coffee','juice','alcohol','sake','beer','wine','soup','ramen','sushi','udon','soba','pasta',
  'meat','beef','pork','chicken','fish','seafood','fruit','food','sugar','salt','oil','butter','cheese','ice cream',
  'money','music','information','news','homework','work','weather','clothing','furniture','luggage','advice','anime','paper','mail',
  // Foods English treats as a substance when eaten: “eats cake”, not “eats a cake”.
  'cake','pizza','curry','salad','chocolate','candy','cereal','yogurt','pie',
  // Language names take no article as a study/speech object: “speaks Japanese”, not “speaks a Japanese”.
  'japanese','english','chinese','french','spanish','german','korean',
])
// テレビ is the set when you want one and the medium when you watch it, so the
// article depends on the verb rather than on the noun.
const mediumNotDeviceVerbs = new Set(['見る'])

/** Plural-only nouns and regular plurals, for is/are agreement. */
function isPluralPhrase(value: string) {
  const head = value.replace(/^(?:a|an|the|my|your|his|her|our|their)\s+/i, '')
  if (/^(?:people|men|women|children|data|clothes|shoes|glasses|pants|scissors|documents|parents)$/i.test(head)) return true
  return /s$/i.test(head) && !/(?:ss|us|is)$/i.test(head)
}

/** An object phrase with the article English expects, mass nouns excepted. */
function objectEnglish(gloss: string) {
  const lower = gloss.toLowerCase()
  // "English language", "Chinese language", etc. are uncountable regardless of
  // which language, so a suffix check catches every gloss the vocab data uses
  // without needing to enumerate every language by name.
  if (uncountableGlosses.has(lower) || /\blanguage$/.test(lower)) return gloss
  return indefinite(gloss)
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

const definitePlaceTags = new Set(normalizeTags([
  'building','house','home','school','university','office','store','restaurant','cafe','hospital','hotel',
  'library','museum','temple','shrine','church','bank','station','airport','park','forest','mountain','apartment','neighborhood','local-area','post-office','movie-theater','shop',
  'river','lake','beach','ocean','platform','parking-lot','road','bridge','intersection','room','kitchen',
  'bathroom','bedroom','living-room','classroom',
]))

function animateEnglish(word: WordRecord, gloss: string) {
  const tags = tagSet(word)
  const familyReference: Record<string,string> = {
    '母':'my mother','父':'my father','娘':'my daughter','息子':'my son','妻':'my wife','夫':'my husband','主人':'my husband','両親':'my parents',
  }
  if (familyReference[word.japanese]) return familyReference[word.japanese]!
  if (/^(?:I|you|he|she|we|they|it)$/i.test(gloss)) return /^i$/i.test(gloss) ? 'I' : gloss.toLowerCase()
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
  const sentencePreferred = inferPreferredTranslation(word.japanese,word.english,word.reading)
  const gloss = primaryEnglishGloss(sentencePreferred || word.preferredTranslation?.trim() || word.english)
  const tags = tagSet(word)

  if (slot === 'subject') return animateEnglish(word, gloss)
  if (slot === 'companion' || slot === 'recipient') {
    const pronounByJapanese: Record<string,string> = { '私':'me','私自身':'me','俺':'me','僕':'me','我々':'us','私たち':'us','彼':'him','彼女':'her','彼ら':'them','あなた':'you','君':'you' }
    if (pronounByJapanese[word.japanese]) return pronounByJapanese[word.japanese]!
    const phrase=animateEnglish(word,gloss)
    const objectPronouns: Record<string,string> = { I:'me',we:'us',he:'him',she:'her',they:'them' }
    return objectPronouns[phrase] ?? phrase
  }
  if (slot === 'object' && word.japanese === '果物') return 'fruit'
  if (slot === 'object') return objectEnglish(gloss)
  if (slot === 'location') {
    if (tags.has('home') && ['家','うち','自宅'].includes(word.japanese)) return 'at home'
    if ([...tags].some(tag=>['country','city','town','village','neighborhood','island'].includes(tag))) return `in ${/^[A-Z]/.test(gloss) ? gloss : definite(gloss)}`
    if ([...tags].some(tag => ['room','kitchen','bathroom','bedroom','living-room','classroom','house'].includes(tag))) return `in ${definite(gloss)}`
    if (tags.has('school') && /^school$/i.test(gloss)) return 'at school'
    return `at ${definite(gloss)}`
  }
  if (slot === 'destination') {
    if (tags.has('home') && ['家','うち','自宅'].includes(word.japanese)) return 'the house'
    if ([...tags].some(tag => definitePlaceTags.has(tag))) return definite(gloss)
    if ([...tags].some(tag => ['country','city','town','village','island'].includes(tag))) return /^[A-Z]/.test(gloss) ? gloss : indefinite(gloss)
  }
  if (slot === 'time') {
    if (tags.has('morning')) return `in ${definite(gloss)}`
    if (tags.has('afternoon') || tags.has('evening')) return `in ${definite(gloss)}`
    if (tags.has('night') || tags.has('noon') || tags.has('midnight')) return `at ${gloss}`
    if ((tags.has('clock-time') || tags.has('hour')) && !/^at\b/i.test(gloss)) return `at ${gloss}`
  }
  return gloss
}

const companionKinshipTerms: Record<string,string> = {
  '母':'mother','父':'father','母親':'mother','父親':'father','兄':'older brother','姉':'older sister','弟':'younger brother','妹':'younger sister',
  '祖父':'grandfather','祖母':'grandmother','息子':'son','娘':'daughter','夫':'husband','妻':'wife','伯父':'uncle','叔父':'uncle','伯母':'aunt','叔母':'aunt','両親':'parents',
}

function subjectPossessive(subject: WordRecord) {
  const byJapanese: Record<string,string> = { '私':'my','私自身':'my','俺':'my','僕':'my','我々':'our','私たち':'our','あなた':'your','君':'your','彼':'his','彼女':'her','彼ら':'their' }
  if (byJapanese[subject.japanese]) return byJapanese[subject.japanese]!
  const tags=tagSet(subject)
  if (tags.has('male')) return 'his'
  if (tags.has('female')) return 'her'
  return 'their'
}

function contextualSlotEnglish(slot: string,word: WordRecord,filled: Record<string,WordRecord>,verb?: VerbUsageRecord) {
  if (slot === 'object' && word.japanese === 'テレビ' && verb && mediumNotDeviceVerbs.has(verb.japanese)) return 'television'
  if (slot === 'companion' && filled.subject) {
    const manWords=new Set(['男','男性'])
    const womanWords=new Set(['女','女性'])
    if (manWords.has(filled.subject.japanese) && manWords.has(word.japanese)) return 'another man'
    if (womanWords.has(filled.subject.japanese) && womanWords.has(word.japanese)) return 'another woman'
  }
  if ((slot === 'companion' || slot === 'recipient') && filled.subject && companionKinshipTerms[word.japanese]) {
    return `${subjectPossessive(filled.subject)} ${companionKinshipTerms[word.japanese]}`
  }
  return englishPhrase(word,slot)
}

/**
 * A kinship term belongs to whoever the sentence is about: 彼は娘に…… is his
 * daughter, not mine. Patterns that build their English by hand call this so
 * they agree with the subject the same way template patterns do.
 */
function relatedPersonEnglish(slot: string, word: WordRecord, subject: WordRecord) {
  return contextualSlotEnglish(slot,word,{ subject })
}

function contextualSubjectEnglish(word: WordRecord,verb: VerbUsageRecord,filled: Record<string,WordRecord>) {
  if (word.japanese !== '客') return englishPhrase(word,'subject')
  if (verb.tags.some(tag=>['consumption','eating','drinking'].includes(tag))) return 'a customer'
  if (verb.tags.some(tag=>['movement','motion'].includes(tag))) {
    const place=filled.destination ?? filled.location
    const placeTags=place ? tagSet(place) : new Set<string>()
    return [...placeTags].some(tag=>['hotel','house','home'].includes(tag)) ? 'a guest' : 'a visitor'
  }
  return 'a guest'
}

function subjectUsesBaseVerb(subject: string) {
  // A possessive can sit in front of the noun — “my parents” is still plural —
  // so plurality is decided by the head noun, not by the first word.
  if (/^(?:I|you|we|they)\b/i.test(subject)) return true
  return isPluralPhrase(subject)
}

function translatedVerb(verb: VerbUsageRecord, filled: Record<string,WordRecord>, useBase: boolean) {
  const objectTags = filled.object ? tagSet(filled.object) : new Set<string>()
  if (verb.japanese === '見る' && (objectTags.has('picture') || objectTags.has('photo'))) {
    return useBase ? 'look at' : 'looks at'
  }
  return useBase ? verb.english : verb.englishThird
}

function renderTranslation(template: string, verb: VerbUsageRecord, filled: Record<string,WordRecord>, verbOverride?: string) {
  const subject = filled.subject ? contextualSubjectEnglish(filled.subject,verb,filled) : ''
  const englishVerb = verbOverride ?? translatedVerb(verb, filled, subjectUsesBaseVerb(subject))
  const values: Record<string,string> = { Verb:englishVerb }
  for (const [slot,word] of Object.entries(filled)) {
    values[slot.charAt(0).toUpperCase()+slot.slice(1)] = slot==='subject' ? subject : contextualSlotEnglish(slot,word,filled,verb)
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

interface VerbForm {
  japanese: string
  reading: string
}

interface N4VerbForms {
  masu: VerbForm
  masuStem: VerbForm
  te: VerbForm
  ta: VerbForm
  aStem: VerbForm
}

function n4VerbForms(verb: VerbUsageRecord): N4VerbForms {
  const japaneseRoot=verb.japanese.slice(0,-1)
  const readingRoot=verb.reading.slice(0,-1)
  if (verb.verbClass === 'ichidan') {
    return {
      masu:{japanese:`${japaneseRoot}ます`,reading:`${readingRoot}ます`},
      masuStem:{japanese:japaneseRoot,reading:readingRoot},
      te:{japanese:`${japaneseRoot}て`,reading:`${readingRoot}て`},
      ta:{japanese:`${japaneseRoot}た`,reading:`${readingRoot}た`},
      aStem:{japanese:japaneseRoot,reading:readingRoot},
    }
  }
  const endings = verb.verbClass === 'godan-mu'
    ? { i:'み',a:'ま',te:'んで',ta:'んだ' }
    : verb.verbClass === 'godan-su'
      ? { i:'し',a:'さ',te:'して',ta:'した' }
      : { i:'き',a:'か',te:'って',ta:'った' }
  return {
    masu:{japanese:`${japaneseRoot}${endings.i}ます`,reading:`${readingRoot}${endings.i}ます`},
    masuStem:{japanese:`${japaneseRoot}${endings.i}`,reading:`${readingRoot}${endings.i}`},
    te:{japanese:`${japaneseRoot}${endings.te}`,reading:`${readingRoot}${endings.te}`},
    ta:{japanese:`${japaneseRoot}${endings.ta}`,reading:`${readingRoot}${endings.ta}`},
    aStem:{japanese:`${japaneseRoot}${endings.a}`,reading:`${readingRoot}${endings.a}`},
  }
}

function appendForm(form: VerbForm, ending: string): VerbForm {
  return { japanese:`${form.japanese}${ending}`,reading:`${form.reading}${ending}` }
}

function n4SurfaceForm(patternId: string, verb: VerbUsageRecord): VerbForm | null {
  const forms=n4VerbForms(verb)
  const byPattern: Record<string,VerbForm> = {
    'n4-01':appendForm(forms.masuStem,'たいです'),
    'n4-02':appendForm(forms.te,'います'),
    'n4-03':appendForm(forms.masuStem,'ました'),
    'n4-04':appendForm(forms.masuStem,'ません'),
    'n4-05':appendForm(forms.aStem,'なければなりません'),
    'n4-06':appendForm(forms.te,'もいいです'),
    'n4-07':appendForm(forms.te,'はいけません'),
    'n4-08':appendForm(forms.ta,'ことがあります'),
    'n4-10':appendForm(forms.masuStem,'始めます'),
  }
  return byPattern[patternId] ?? null
}

function fillVerbSlots(verb: VerbUsageRecord, vocabulary: WordRecord[], seed: number, startingSalt=2,options: CategorySentenceOptions={}) {
  const filled: Record<string,WordRecord> = {}
  const slotTagMatches: Record<string,string[]> = {}
  let salt=startingSalt
  for (const [slot,rule] of Object.entries(verb.slots)) {
    let pool=vocabulary.filter(word=>categoryMatch(word,rule.categories))
    if (rule.tags?.length) pool=pool.filter(word=>matchingTags(word,rule.tags).length>0)
    // A word only reaches 食べる through a Food category, but an import can file a
    // drink there. Anything drinkable that is not also solid food is not eaten.
    if (verb.japanese === '食べる' && slot === 'object') pool=pool.filter(word=>!['米','食べ物'].includes(word.japanese)
      && !(matchingTags(word,drinkableTags).length>0 && matchingTags(word,solidFoodTags).length===0)
      && !(matchingTags(word,cookingInputTags).length>0 && matchingTags(word,solidFoodTags).length===0))
    if (verb.japanese === '飲む' && slot === 'object') pool=pool.filter(word=>
      !solidFoodWords.has(word.japanese) && matchingTags(word,solidFoodTags).length===0)
    if (verb.id === 'yomu-adverb' && slot === 'object') pool=pool.filter(word=>!tagSet(word).has('news')&&word.japanese!=='ニュース')
    if (verb.japanese === '読む' && slot === 'object') pool=pool.filter(word=>!unreadableObjectWords.has(word.japanese))
    if (slot === 'destination') pool=pool.filter(word=>{
      const tags=tagSet(word)
      return word.japanese!=='庭'&&!destinationIncompatibleWords.has(word.japanese) && ![...tags].some(tag=>destinationIncompatibleTags.has(tag))
    })
    if (slot === 'time') pool=pool.filter(word=>{
      const tags=tagSet(word)
      return !niIncompatibleTimeWords.has(word.japanese) && ![...tags].some(tag=>niIncompatibleTimeTags.has(tag))
    })
    if (slot === 'subject' || slot === 'companion') pool=pool.filter(word=>{
      const tags=tagSet(word)
      return !politeSubjectIncompatibleWords.has(word.japanese)
        && !contextDependentSubjectWords.has(word.japanese)
        && !preferLongerFormWords.has(word.japanese)
        && !formalRegisterSubjectWords.has(word.japanese)
        && !tags.has('question')
        && !tags.has('question-word')
        && !tags.has('interrogative')
        && ![...tags].some(tag=>nonHumanSubjectTags.has(tag))
    })
    if (slot === 'companion' && filled.subject) pool=pool.filter(word=>word.id!==filled.subject.id)
    if (slot === 'companion') pool=pool.filter(word=>word.japanese!=='女')
    if (!pool.length) return null
    filled[slot]=seededPick(pool,options.slotSeeds?.[slot]??seed,salt++)
    slotTagMatches[slot]=matchingTags(filled[slot],rule.tags)
  }
  return { filled,slotTagMatches }
}

function baseFurigana(verb: VerbUsageRecord, filled: Record<string,WordRecord>, form: VerbForm) {
  const wordPart=(slot: string)=>({text:filled[slot]!.japanese,reading:kanaReading(filled[slot]!.reading,filled[slot]!.japanese),slot})
  const verbPart=()=>({text:form.japanese,reading:kanaReading(form.reading,form.japanese),slot:'verb'})
  const literalPart=(text: string,reading=text)=>({text,reading})
  const builders: Record<string,()=>GeneratedPreviewSentence['furigana']> = {
    'n5-01':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('object'),literalPart('を'),verbPart()],
    'n5-02':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('destination'),literalPart('に'),verbPart()],
    'n5-03':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('location'),literalPart('で'),wordPart('object'),literalPart('を'),verbPart()],
    'n5-04':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('companion'),literalPart('と'),verbPart()],
    'n5-05':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('time'),literalPart('に'),verbPart()],
    'n5-09':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('object'),literalPart('を'),wordPart('adverb'),verbPart()],
    'n5-10':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('destination'),literalPart('へ','え'),verbPart()],
  }
  return builders[verb.sentencePattern]?.() ?? null
}

function presentParticiple(phrase: string) {
  const [head,...rest]=phrase.split(' ')
  const irregular: Record<string,string> = { eat:'eating',drink:'drinking',read:'reading',watch:'watching',look:'looking',go:'going',talk:'talking',wake:'waking' }
  const transformed=irregular[head!] ?? (head!.endsWith('e') ? `${head!.slice(0,-1)}ing` : `${head}ing`)
  return [transformed,...rest].join(' ')
}

function pastParticiple(phrase: string) {
  const [head,...rest]=phrase.split(' ')
  const irregular: Record<string,string> = { eat:'eaten',drink:'drunk',read:'read',watch:'watched',look:'looked',go:'gone',talk:'talked',wake:'woken' }
  return [irregular[head!] ?? `${head}ed`,...rest].join(' ')
}

function simplePast(phrase: string) {
  const [head,...rest]=phrase.split(' ')
  const irregular: Record<string,string> = { eat:'ate',drink:'drank',read:'read',watch:'watched',look:'looked',go:'went',talk:'talked',wake:'woke' }
  return [irregular[head!] ?? `${head}ed`,...rest].join(' ')
}

function n4EnglishVerb(patternId: string,verb: VerbUsageRecord,filled: Record<string,WordRecord>) {
  const subject=englishPhrase(filled.subject!,'subject')
  const plural=subjectUsesBaseVerb(subject)
  const base=translatedVerb(verb,filled,true)
  if (patternId === 'n4-02' && verb.japanese === '起きる') return `${subject === 'I' ? 'am' : plural ? 'are' : 'is'} awake`
  if (patternId === 'n4-02' && verb.japanese === '行く') return `${plural?'have':'has'} gone`
  const forms: Record<string,string> = {
    'n4-01':`${plural?'want':'wants'} to ${base}`,
    'n4-02':`${subject === 'I' ? 'am' : plural ? 'are' : 'is'} ${presentParticiple(base)}`,
    'n4-03':simplePast(base),
    'n4-04':`${plural?'do':'does'} not ${base}`,
    'n4-05':`must ${base}`,
    'n4-06':`may ${base}`,
    'n4-07':`must not ${base}`,
    'n4-08':`${plural?'have':'has'} ${pastParticiple(base)}`,
    'n4-10':`${plural?'begin':'begins'} ${presentParticiple(base)}`,
  }
  return forms[patternId] ?? base
}

function generatedWordSlots(filled: Record<string,WordRecord>,slotTagMatches: Record<string,string[]>) {
  return Object.fromEntries(Object.entries(filled).map(([name,word])=>[name,{
    id:word.id,surface:word.japanese,dictionaryForm:word.japanese,reading:word.reading,english:word.preferredTranslation,
    pos:name==='subject'||name==='companion'?'pronoun':name==='time'||name==='adverb'?'time_expression':name==='destination'||name==='location'?'place_expression':'noun',
    jlpt:word.jlpt ?? 'N5',tags:[`category:${word.categories.join('|')}`,...word.tags,...(slotTagMatches[name] ?? []).map(tag=>`matched:${tag}`)],
  }])) as GeneratedPreviewSentence['slots']
}

const additionalN5PatternIds = new Set(Array.from({length:14},(_,index)=>`n5-${String(index+11).padStart(2,'0')}`))
const geographicOriginTags = new Set(normalizeTags(['country','city','town','village','neighborhood','island']))
const originSubjectDisallowedTags = new Set(normalizeTags(['patient','sick','illness','medical','hospital','guest','customer']))
const portableObjectTags = new Set(normalizeTags([
  ...edibleTags,...drinkableTags,...readableTags,'portable','light','book','document','paper','notebook','magazine','newspaper','letter',
  'phone','camera','bottle','cup','box','bag','wallet','clothing','shirt','coat','hat','shoes','tool','pen','pencil','lunch','food',
]))
const showableObjectTags = new Set(normalizeTags([...readableTags,...watchableTags,'picture','photo','phone','camera','book','document','newspaper','letter','magazine']))
// Phenomena, substances, and qualities read as concrete because every Object is
// tagged `concrete`, but none of them is a thing that sits somewhere or gets
// carried, wanted, or shown: 電気 is electric power, not a lamp; 光 and 音 are
// what a lamp or a speaker produces. Devices keep their own `electronic`,
// `phone`, and `camera` tags, so they are unaffected.
const disallowedPhysicalObjectTags = new Set(normalizeTags([
  'abstract','body','body-part','blood','anatomy','building','room','character','text','language','word','grammar',
  'nature','element','energy','weather','atmosphere','phenomenon','utility','electricity','perception','sound','emotion','philosophy','appearance','motion','activity','data','information','taste','flavor','flavour','smell','scent',
]))
// Utilities are supplied rather than located, and an import may tag them as
// household objects, so they are also named directly.
const utilitySupplyWords = new Set(['電気','電力','水道','ガス','熱','蒸気','煙','電波'])
// Vehicles that cannot be inside the buildings the existence patterns use. Cars
// and bicycles stay: they park at a company or a library.
const indoorIncompatibleWords = new Set(['電車','船','飛行機','バス','トラック','地下鉄','ヘリコプター'])
const invalidObjectLexicalTags = new Set(normalizeTags(['verb','auxiliary-verb','particle','expression','adverb','i-adjective','na-adjective','requires-modifier','unclassified']))
const invalidStandaloneObjectWords = new Set(['事','こと','もの','物','てしまう','てくださる','てくれる','ほど','など','等','くらい','ぐらい','しか','だけ','だから','ので','のに','けれど','しかし','そして','それで'])
const physicalObjectTags = new Set(normalizeTags([
  'concrete','furniture','chair','table','desk','bed','sofa','shelf','cabinet','tool','knife','pen','pencil','scissors','electronics','computer','laptop','phone','tablet','camera','television','tv',
  'vehicle','car','bus','train','bicycle','container','bottle','cup','glass','box','bag','wallet','clothing','shirt','pants','shoes','hat','coat','dress','book','document','paper','notebook','magazine','newspaper','letter','picture','photo','toy','instrument',
]))
// An everyday object resting at a pond, a mountain, or the sky reports a mishap
// rather than where the thing is kept. Existence sentences stay indoors.
const openAirLocationTags = new Set(normalizeTags(['nature','outdoor','water','sky','geography','mountain','river','ocean','sea','beach','forest','field']))
// Saying where a thing is implies somewhere it is kept or was left. Museums,
// shrines, and galleries hold exhibits, so an everyday object being “at the art
// museum” reads as a curiosity rather than a location.
const exhibitionVenueTags = new Set(normalizeTags(['museum','gallery','exhibition','shrine','temple','church','tourism','religion','monument']))
// Walking is a trip you make on foot in one go. Cities, countries, and open
// water are the wrong scale for it — nobody walks from a classroom to Tokyo.
const walkingIncompatibleTags = new Set(normalizeTags(['country','island','ocean','sea','city','prefecture','region','geography','municipality','capital']))
// Calling or showing something to “a person” or “a man” leaves out the one thing
// these sentences are about: which person. Relatives, friends, classmates, and
// occupations all name someone; these words do not.
const genericRecipientWords = new Set(['人','人々','男','女','男性','女性','大人','子','若者','人間'])
// Work documents need an office context that a generated sentence cannot supply,
// so 見せる keeps to things anyone carries and shows.
const workplaceDocumentWords = new Set(['資料','書類','名刺','報告書','表','記録'])
const inanimateCategories: SentenceCategory[] = ['Object','Tool','Technology','Vehicle','Clothing','Furniture','Book','Document','Media']
const possessableCategories: SentenceCategory[] = ['Object','Tool','Technology','Vehicle','Clothing','Furniture','Book','Document','Media','Food','Drink']

// Size and newness are properties of things you can point at. Without
// `physicalOnly` the broad Object category lets 教育 and 習慣 through, and
// “education is new” is not what this pattern teaches.
const adjectiveRules = [
  { id:'omoshiroi',japanese:'面白い',reading:'おもしろい',english:'interesting',categories:['Book','Document','Media'] as SentenceCategory[] },
  { id:'oishii',japanese:'美味しい',reading:'おいしい',english:'delicious',categories:['Food','Drink'] as SentenceCategory[] },
  { id:'ookii',japanese:'大きい',reading:'おおきい',english:'large',categories:['Object','Animal','Building','Room','Vehicle','Furniture','Technology'] as SentenceCategory[],physicalOnly:true },
  { id:'atarashii',japanese:'新しい',reading:'あたらしい',english:'new',categories:['Object','Tool','Technology','Vehicle','Clothing','Furniture','Book'] as SentenceCategory[],physicalOnly:true },
]

function hasCompositeSurface(word: WordRecord) {
  return word.japanese.includes('/') || /[／~〜]/.test(word.japanese)
}

function hasUsableMeaning(word: WordRecord) {
  const meaning=primaryEnglishGloss(word.preferredTranslation || word.english)
  return Boolean(meaning) && !/^(?:meaning|reading) needed$/i.test(meaning)
}

function validHumanPool(vocabulary: WordRecord[]) {
  return vocabulary.filter(word=>{
    const tags=tagSet(word)
    return !hasCompositeSurface(word)
      && hasUsableMeaning(word)
      && word.categories.includes('Person')
      && matchingTags(word,humanSubjectTags).length>0
      && !politeSubjectIncompatibleWords.has(word.japanese)
      && !contextDependentSubjectWords.has(word.japanese)
      && !preferLongerFormWords.has(word.japanese)
      && !formalRegisterSubjectWords.has(word.japanese)
      && !tags.has('question-word')
      && !tags.has('requires-modifier')
  })
}

/** Recipients of calling and showing must identify someone, not just a human. */
function namedRecipients(humans: WordRecord[]) {
  return humans.filter(word=>!genericRecipientWords.has(word.japanese))
}

function validPlacePool(vocabulary: WordRecord[]) {
  return vocabulary.filter(word=>{
    const tags=tagSet(word)
    return !hasCompositeSurface(word)
      && hasUsableMeaning(word)
      && !['場所','所'].includes(word.japanese)
      && categoryMatch(word,['Place','Building','Room'])
      && matchingTags(word,standaloneDestinationTags).length>0
      && !destinationIncompatibleWords.has(word.japanese)
      && ![...tags].some(tag=>destinationIncompatibleTags.has(tag))
  })
}

function validTimePool(vocabulary: WordRecord[]) {
  return vocabulary.filter(word=>{
    const tags=tagSet(word)
    return word.categories.includes('Time')
      && matchingTags(word,wakeTimeTags).length>0
      && !niIncompatibleTimeWords.has(word.japanese)
      && ![...tags].some(tag=>niIncompatibleTimeTags.has(tag))
  })
}

function validInanimatePool(vocabulary: WordRecord[],categories=inanimateCategories) {
  return vocabulary.filter(word=>{
    const tags=tagSet(word)
    const meaning=primaryEnglishGloss(word.preferredTranslation || word.english)
    const verbLike=/[うくぐすつぬぶむる]$/.test(word.japanese) && (/\bto\s+[a-z]/i.test(word.english) || /\bdo something\b/i.test(word.english) || /^て/.test(word.japanese))
    return !hasCompositeSurface(word)
      && !invalidStandaloneObjectWords.has(word.japanese)
      && !utilitySupplyWords.has(word.japanese)
      && !verbLike
      && categoryMatch(word,categories)
      && Boolean(meaning)
      && !/^(?:meaning|reading) needed$/i.test(meaning)
      && ![...tags].some(tag=>disallowedPhysicalObjectTags.has(tag) || invalidObjectLexicalTags.has(tag))
  })
}

function isPhysicalObject(word: WordRecord) {
  if (categoryMatch(word,['Food','Drink','Furniture','Tool','Vehicle','Clothing','Book','Document'])) return true
  return [...tagSet(word)].some(tag=>physicalObjectTags.has(tag))
}

function originEnglish(word: WordRecord) {
  const gloss=primaryEnglishGloss(word.preferredTranslation || word.english)
  return /^[A-Z]/.test(gloss) ? gloss : englishPhrase(word,'destination')
}

function additionalN5Sentence(seed: number,patternId: string,options: CategorySentenceOptions={}): GeneratedPreviewSentence | null {
  if (!additionalN5PatternIds.has(patternId)) return null
  const vocabulary=editorWords()
  const humans=validHumanPool(vocabulary)
  const places=validPlacePool(vocabulary)
  const localizedPlaces=places.filter(word=>![...tagSet(word)].some(tag=>geographicOriginTags.has(tag)))
  const enclosedPlaces=localizedPlaces.filter(word=>![...tagSet(word)].some(tag=>openAirLocationTags.has(tag) || exhibitionVenueTags.has(tag)))
  const times=validTimePool(vocabulary)
  const inanimate=validInanimatePool(vocabulary)
  const pick=(pool: WordRecord[],salt: number)=>pool.length ? seededPick(pool,seed,salt) : null
  const wordPart=(word: WordRecord,slot: string)=>({text:word.japanese,reading:kanaReading(word.reading,word.japanese),slot})
  const literalPart=(text: string,reading=text)=>({text,reading})
  const verbSlot=(id: string,surface: string,dictionaryForm: string,reading: string,english: string,tags: string[]) => ({
    id,surface,dictionaryForm,reading,english,pos:'verb' as const,jlpt:'N5' as const,tags,conjugation:'masu',
  })
  const finish=(furigana: GeneratedPreviewSentence['furigana'],english: string,filled: Record<string,WordRecord>,extraSlots: GeneratedPreviewSentence['slots'],validation: string[]) => ({
    frameId:patternId,level:'N5' as const,japanese:furigana.map(part=>part.text).join(''),reading:furigana.map(part=>part.reading||part.text).join(''),english,
    slots:{...generatedWordSlots(filled,{}),...extraSlots},furigana,grammar:[{pattern:patternId,meaning:'Reviewed N5 slot template',jlpt:'N5' as const}],validation,
  })

  if (patternId === 'n5-11') {
    const place=pick(localizedPlaces,111)
    const animatePool=vocabulary.filter(word=>word.categories.includes('Animal') && hasUsableMeaning(word)).concat(humans.filter(word=>{
      const tags=tagSet(word)
      return !['pronoun','speaker','second-person','demonstrative','question-word'].some(tag=>tags.has(tag))
    }))
    const subject=pick(animatePool,112)
    if (!place || !subject) return null
    const subjectEnglish=indefinite(primaryEnglishGloss(subject.preferredTranslation || subject.english))
    const plural=subjectUsesBaseVerb(subjectEnglish)
    const furigana=[wordPart(place,'place'),literalPart('に'),wordPart(subject,'subject'),literalPart('が'),{text:'います',reading:'います',slot:'verb'}]
    return finish(furigana,`There ${plural?'are':'is'} ${subjectEnglish} ${englishPhrase(place,'location')}.`,{place,subject},{verb:verbSlot('verb-iru','います','いる','います','exist',['existence','animate'])},['Subject is animate.','Place supports an existence location.'])
  }
  if (patternId === 'n5-12') {
    const place=pick(enclosedPlaces,121),object=pick(inanimate.filter(word=>isPhysicalObject(word) && !indoorIncompatibleWords.has(word.japanese)),122)
    if (!place || !object) return null
    const furigana=[wordPart(place,'place'),literalPart('に'),wordPart(object,'object'),literalPart('が'),{text:'あります',reading:'あります',slot:'verb'}]
    const existingEnglish=objectEnglish(primaryEnglishGloss(object.preferredTranslation || object.english))
    return finish(furigana,`There ${isPluralPhrase(existingEnglish)?'are':'is'} ${existingEnglish} ${englishPhrase(place,'location')}.`,{place,object},{verb:verbSlot('verb-aru','あります','ある','あります','exist',['existence','inanimate'])},['Object is inanimate.','Place supports an existence location.'])
  }
  if (patternId === 'n5-13') {
    const time=pick(times,131),subject=pick(humans,132)
    if (!time || !subject) return null
    const subjectEnglish=englishPhrase(subject,'subject'),comes=subjectUsesBaseVerb(subjectEnglish)?'come':'comes'
    const furigana=[wordPart(time,'time'),literalPart('に'),wordPart(subject,'subject'),literalPart('が'),{text:'来ます',reading:'きます',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${comes} ${englishPhrase(time,'time')}.`,{time,subject},{verb:verbSlot('verb-kuru','来ます','来る','きます','come',['movement','arrival','time-compatible'])},['Time naturally accepts に.','来る supports the selected time frame.'])
  }
  if (patternId === 'n5-14') {
    const object=pick(inanimate.filter(word=>isPhysicalObject(word) && !indoorIncompatibleWords.has(word.japanese)),141),place=pick(enclosedPlaces,142)
    if (!object || !place) return null
    const objectPhrase=objectEnglish(primaryEnglishGloss(object.preferredTranslation || object.english))
    const furigana=[wordPart(object,'object'),literalPart('は','わ'),wordPart(place,'place'),literalPart('に'),{text:'あります',reading:'あります',slot:'verb'}]
    return finish(furigana,`${objectPhrase.charAt(0).toUpperCase()+objectPhrase.slice(1)} ${isPluralPhrase(objectPhrase)?'are':'is'} ${englishPhrase(place,'location')}.`,{object,place},{verb:verbSlot('verb-aru-location','あります','ある','あります','be located',['existence','location','inanimate'])},['Object is inanimate.','Place is a valid location.'])
  }
  if (patternId === 'n5-15') {
    const origins=places.filter(word=>[...tagSet(word)].some(tag=>geographicOriginTags.has(tag)))
    const originSubjects=humans.filter(word=>![...tagSet(word)].some(tag=>originSubjectDisallowedTags.has(tag)))
    const subject=pick(originSubjects.length?originSubjects:humans,151),origin=pick(origins,152)
    if (!subject || !origin) return null
    const subjectEnglish=englishPhrase(subject,'subject'),comes=subjectUsesBaseVerb(subjectEnglish)?'come':'comes'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(origin,'origin'),literalPart('から'),{text:'来ます',reading:'きます',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${comes} from ${originEnglish(origin)}.`,{subject,origin},{verb:verbSlot('verb-kuru-origin','来ます','来る','きます','come',['movement','origin'])},['Origin is a city, country, town, village, or island.'])
  }
  if (patternId === 'n5-16') {
    const walkablePlaces=places.filter(word=>![...tagSet(word)].some(tag=>walkingIncompatibleTags.has(tag)))
    const subject=pick(humans,161),endpoint=pick(walkablePlaces,162)
    if (!subject || !endpoint) return null
    const subjectEnglish=englishPhrase(subject,'subject'),walks=subjectUsesBaseVerb(subjectEnglish)?'walk':'walks'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(endpoint,'endpoint'),literalPart('まで'),{text:'歩きます',reading:'あるきます',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${walks} to ${englishPhrase(endpoint,'destination')}.`,{subject,endpoint},{verb:verbSlot('verb-aruku-endpoint','歩きます','歩く','あるきます','walk',['movement','endpoint'])},['歩く is a movement verb.','Endpoint is a valid destination.'])
  }
  if (patternId === 'n5-17') {
    const adjective=seededPick(adjectiveRules,seed,171)
    const object=pick(validInanimatePool(vocabulary,adjective.categories).filter(word=>!adjective.physicalOnly || isPhysicalObject(word)),172)
    if (!object) return null
    const objectPhrase=objectEnglish(primaryEnglishGloss(object.preferredTranslation || object.english))
    const furigana=[wordPart(object,'object'),literalPart('が'),{text:`${adjective.japanese}です`,reading:`${adjective.reading}です`,slot:'adjective'}]
    const adjectiveSlot={id:`adjective-${adjective.id}`,surface:`${adjective.japanese}です`,dictionaryForm:adjective.japanese,reading:`${adjective.reading}です`,english:adjective.english,pos:'i_adjective' as const,jlpt:'N5' as const,tags:['adjective','compatible-predicate']}
    return finish(furigana,`${objectPhrase.charAt(0).toUpperCase()+objectPhrase.slice(1)} ${isPluralPhrase(objectPhrase)?'are':'is'} ${adjective.english}.`,{object},{adjective:adjectiveSlot},['Adjective selected from a reviewed noun-compatibility rule.'])
  }
  if (patternId === 'n5-18') {
    const subject=pick(humans,181)
    const recipient=pick(namedRecipients(humans).filter(word=>word.id!==subject?.id),182)
    if (!subject || !recipient) return null
    const subjectEnglish=englishPhrase(subject,'subject'),calls=subjectUsesBaseVerb(subjectEnglish)?'call':'calls'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(recipient,'recipient'),literalPart('に'),{text:'電話します',reading:'でんわします',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${calls} ${relatedPersonEnglish('recipient',recipient,subject)}.`,{subject,recipient},{verb:verbSlot('verb-denwa','電話します','電話する','でんわします','call',['communication','recipient-ni','suru-verb'])},['Recipient is a different person from the subject.','電話する accepts a に recipient.'])
  }
  if (patternId === 'n5-19') {
    const subject=pick(humans,191),recipient=pick(namedRecipients(humans).filter(word=>word.id!==subject?.id),192)
    const showable=inanimate.filter(word=>[...tagSet(word)].some(tag=>showableObjectTags.has(tag)) && !workplaceDocumentWords.has(word.japanese))
    const object=pick(showable,193)
    if (!subject || !recipient || !object) return null
    const subjectEnglish=englishPhrase(subject,'subject'),shows=subjectUsesBaseVerb(subjectEnglish)?'show':'shows'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(recipient,'recipient'),literalPart('に'),wordPart(object,'object'),literalPart('を'),{text:'見せます',reading:'みせます',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${shows} ${englishPhrase(object,'object')} to ${relatedPersonEnglish('recipient',recipient,subject)}.`,{subject,recipient,object},{verb:verbSlot('verb-miseru','見せます','見せる','みせます','show',['transfer','showing','recipient-ni','transitive'])},['Object is reasonably showable.','Recipient is a different person from the subject.'])
  }
  if (patternId === 'n5-20') {
    const subject=pick(humans,201),destination=pick(places,202)
    const portable=vocabulary.filter(word=>categoryMatch(word,possessableCategories) && [...tagSet(word)].some(tag=>portableObjectTags.has(tag)) && ![...tagSet(word)].some(tag=>disallowedPhysicalObjectTags.has(tag)))
    const object=pick(portable,203)
    if (!subject || !destination || !object) return null
    const subjectEnglish=englishPhrase(subject,'subject'),takes=subjectUsesBaseVerb(subjectEnglish)?'take':'takes'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(destination,'destination'),literalPart('へ','え'),wordPart(object,'object'),literalPart('を'),{text:'持って行きます',reading:'もっていきます',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${takes} ${englishPhrase(object,'object')} to ${englishPhrase(destination,'destination')}.`,{subject,destination,object},{verb:verbSlot('verb-motte-iku','持って行きます','持って行く','もっていきます','take',['movement','carrying','portable-object'])},['Object has a portable semantic tag.','Destination is valid for movement.'])
  }
  if (patternId === 'n5-21') {
    const subject=pick(humans,211)
    const objects=validInanimatePool(vocabulary,possessableCategories).filter(word=>isPhysicalObject(word) && !tagSet(word).has('rare'))
    const object=pick(objects,212)
    if (!subject || !object) return null
    const subjectEnglish=englishPhrase(subject,'subject'),wants=subjectUsesBaseVerb(subjectEnglish)?'want':'wants'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('が'),{text:'ほしいです',reading:'ほしいです',slot:'predicate'}]
    const predicate={id:'predicate-hoshii',surface:'ほしいです',dictionaryForm:'ほしい',reading:'ほしいです',english:'want',pos:'i_adjective' as const,jlpt:'N5' as const,tags:['desire','possessable-object']}
    return finish(furigana,`${englishPhrase(subject,'subject').replace(/^./,character=>character.toUpperCase())} ${wants} ${englishPhrase(object,'object')}.`,{subject,object},{predicate},['Object is tangible and reasonably possessable.'])
  }
  if (patternId === 'n5-22') {
    const walkablePlaces=places.filter(word=>![...tagSet(word)].some(tag=>walkingIncompatibleTags.has(tag)))
    const subject=pick(humans,221),origin=pick(walkablePlaces,222)
    const destination=pick(walkablePlaces.filter(word=>word.japanese!==origin?.japanese),223)
    if (!subject || !origin || !destination) return null
    const subjectEnglish=englishPhrase(subject,'subject'),walks=subjectUsesBaseVerb(subjectEnglish)?'walk':'walks'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(origin,'origin'),literalPart('から'),wordPart(destination,'destination'),literalPart('まで'),{text:'歩きます',reading:'あるきます',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${walks} from ${originEnglish(origin)} to ${englishPhrase(destination,'destination')}.`,{subject,origin,destination},{verb:verbSlot('verb-aruku-route','歩きます','歩く','あるきます','walk',['movement','origin','endpoint'])},['Origin and destination are different valid places.','歩く is a movement verb.'])
  }
  if (patternId === 'n5-24') {
    const directVerbs=verbs.filter(verb=>['taberu-basic','nomu-basic','yomu-basic','miru-basic'].includes(verb.id))
    const verb=options.verbId ? directVerbs.find(candidate=>candidate.id===options.verbId) : seededPick(directVerbs,seed,241)
    const result=verb ? fillVerbSlots(verb,vocabulary,seed,242) : null
    if (!verb||!result) return null
    const negative=appendForm(n4VerbForms(verb).masuStem,'ません')
    const subject=result.filled.subject!,object=result.filled.object!
    const subjectEnglish=englishPhrase(subject,'subject')
    const englishVerb=translatedVerb(verb,{subject,object},subjectUsesBaseVerb(subjectEnglish))
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('しか'),{text:negative.japanese,reading:negative.reading,slot:'verb'}]
    const verbSlotData={...verbSlot(`verb-${verb.id}-shika-nai`,negative.japanese,verb.japanese,negative.reading,verb.english,['only','negative-polite','shika-nai']),conjugation:'negative-polite'}
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} only ${englishVerb} ${englishPhrase(object,'object')}.`,{subject,object},{verb:verbSlotData},['Verb selected first and supplied the object rule.','しか is paired with a negative polite verb.'])
  }
  const subject=pick(humans,231)
  if (!subject) return null
  const subjectEnglish=englishPhrase(subject,'subject'),go=subjectUsesBaseVerb(subjectEnglish)?'go':'goes'
  const furigana=[wordPart(subject,'subject'),literalPart('も'),{text:'行きます',reading:'いきます',slot:'verb'}]
  return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${go} too.`,{subject},{verb:verbSlot('verb-iku-mo','行きます','行く','いきます','go',['movement','additive-topic','context-dependent'])},['も marks an additional subject.','This template assumes prior discourse context.'])
}

const additionalN4PatternIds = new Set(Array.from({length:15},(_,index)=>`n4-${String(index+11).padStart(2,'0')}`))

function additionalN4Sentence(seed: number,patternId: string,options: CategorySentenceOptions={}): GeneratedPreviewSentence | null {
  if (!additionalN4PatternIds.has(patternId)) return null
  const vocabulary=editorWords()
  const humans=validHumanPool(vocabulary)
  const places=validPlacePool(vocabulary)
  const pick=<T>(pool: T[],salt: number)=>pool.length ? seededPick(pool,seed,salt) : null
  const exact=(japanese: string[])=>vocabulary.filter(word=>japanese.includes(word.japanese) && hasUsableMeaning(word))
  const wordPart=(word: WordRecord,slot: string)=>({text:word.japanese,reading:kanaReading(word.reading,word.japanese),slot})
  const literalPart=(text: string,reading=text,slot?: string)=>({text,reading,slot})
  const grammarSlot=(id: string,surface: string,dictionaryForm: string,reading: string,english: string,tags: string[],pos: 'verb'|'noun'|'i_adjective'|'na_adjective'='verb')=>({
    id,surface,dictionaryForm,reading,english,pos,jlpt:'N4' as const,tags,conjugation:patternId,
  })
  const finish=(furigana: GeneratedPreviewSentence['furigana'],english: string,filled: Record<string,WordRecord>,extraSlots: GeneratedPreviewSentence['slots'],validation: string[]): GeneratedPreviewSentence=>({
    frameId:patternId,level:'N4',japanese:furigana.map(part=>part.text).join(''),reading:furigana.map(part=>part.reading||part.text).join(''),english,
    slots:{...generatedWordSlots(filled,{}),...extraSlots},furigana,grammar:[{pattern:patternId,meaning:'Reviewed N4 sentence template',jlpt:'N4'}],validation,
  })
  const destinationEnglish=(word: WordRecord)=>({家:'home',学校:'school',大学:'university',高校:'high school'}[word.japanese]??englishPhrase(word,'destination'))
  const movementDestination=(word: WordRecord)=>word.japanese==='家'?'home':`to ${destinationEnglish(word)}`
  const studyLocationEnglish=(word: WordRecord)=>({家:'at home',学校:'at school',大学:'at university',高校:'at high school'}[word.japanese]??englishPhrase(word,'location'))
  const directActionVerbs=verbs.filter(verb=>['taberu-basic','nomu-basic','yomu-basic','miru-basic'].includes(verb.id))
  const pickDirectVerb=(salt: number) => options.verbId
    ? directActionVerbs.find(candidate=>candidate.id===options.verbId)
    : seededPick(directActionVerbs,seed,salt)
  const actionPair=(salt: number) => {
    const firstVerb=pickDirectVerb(salt)
    const firstResult=firstVerb ? fillVerbSlots(firstVerb,vocabulary,seed,salt+1) : null
    const mainVerb=pick(directActionVerbs.filter(verb=>verb.id!==firstVerb?.id),salt+2)
    if (!firstVerb||!firstResult||!mainVerb) return null

    let mainResult: ReturnType<typeof fillVerbSlots> = null
    for (let attempt=0;attempt<8;attempt+=1) {
      const candidate=fillVerbSlots(mainVerb,vocabulary,seed+attempt,salt+3+attempt)
      if (candidate && candidate.filled.object?.id!==firstResult.filled.object?.id) {
        mainResult=candidate
        break
      }
    }
    const subject=pick(humans,salt+20)
    if (!mainResult||!subject) return null
    firstResult.filled.subject=subject
    mainResult.filled.subject=subject
    return { firstVerb, firstResult, mainVerb, mainResult, subject }
  }

  if (patternId==='n4-11') {
    const studyPlaces=new Set(['図書館','学校','大学','高校','教室','家','カフェ'])
    const studySubjectTags=new Set(normalizeTags(['student','teacher','child','teenager','boy','girl','son','daughter','pupil','classmate']))
    const place=pick(places.filter(word=>studyPlaces.has(word.japanese)),411)
    const ageMismatchTags=place?.japanese==='大学'?new Set(normalizeTags(['baby','child','boy','girl'])):place?.japanese==='高校'?new Set(normalizeTags(['baby','child'])):new Set<string>()
    const subject=pick(humans.filter(word=>{
      const tags=tagSet(word)
      return [...tags].some(tag=>studySubjectTags.has(tag))&&![...tags].some(tag=>ageMismatchTags.has(tag))
    }),412)
    if (!place||!subject) return null
    const subjectEnglish=englishPhrase(subject,'subject')
    const studies=subjectEnglish==='I'?'am studying':subjectUsesBaseVerb(subjectEnglish)?'are studying':'is studying'
    const furigana=[wordPart(place,'place'),literalPart('で'),wordPart(subject,'subject'),literalPart('が'),literalPart('勉強しています','べんきょうしています','verb')]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${studies} ${studyLocationEnglish(place)}.`,{place,subject},{verb:grammarSlot('verb-benkyou-progressive','勉強しています','勉強する','べんきょうしています','study',['ongoing','study','location-compatible'])},['Place supports studying.','Subject is compatible with the activity.'])
  }
  if (patternId==='n4-12') {
    const pastTimeWords=new Set(['昨日','昨夜','先週','先月','去年','一昨日','七時','八時'])
    const noParticleTimes=new Set(['昨日','昨夜','先週','先月','去年','一昨日'])
    const time=pick(vocabulary.filter(word=>word.categories.includes('Time')&&pastTimeWords.has(word.japanese)),421)
    const subject=pick(humans,422)
    if (!time||!subject) return null
    const useNi=!noParticleTimes.has(time.japanese)
    const subjectEnglish=englishPhrase(subject,'subject')
    const furigana=[wordPart(time,'time'),...(useNi?[literalPart('に')]:[]),wordPart(subject,'subject'),literalPart('が'),literalPart('来ました','きました','verb')]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} came ${englishPhrase(time,'time')}.`,{time,subject},{verb:grammarSlot('verb-kuru-past','来ました','来る','きました','come',['completed-event','past'])},[useNi?'Specific clock time accepts に.':'Relative time correctly omits に.'])
  }
  if (patternId==='n4-13') {
    const activityVerb=pickDirectVerb(431)
    if (!activityVerb) return null
    const activity=fillVerbSlots(activityVerb,vocabulary,seed,432)
    const destinations=places.filter(word=>[...tagSet(word)].some(tag=>['school','university','library','office','store','park','station','home','house'].includes(tag)))
    const destination=pick(destinations,433)
    if (!activity||!destination) return null
    const selectedObject=activity.filled.object!
    const subject=activity.filled.subject!
    const replacementFoods=exact(['ご飯','パン','魚','肉','果物','卵','ラーメン','寿司'])
    const object=selectedObject.japanese==='食べ物'?(pick(replacementFoods,434)??selectedObject):selectedObject
    const te=n4VerbForms(activityVerb).te
    const objectEnglish=object.japanese==='ご飯'?'a meal':object.japanese==='食べ物'?'food':englishPhrase(object,'object')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart(`${te.japanese}から`,`${te.reading}から`,'firstVerb'),wordPart(destination,'destination'),literalPart('へ','え'),literalPart('行きます','いきます','mainVerb')]
    const extra={firstVerb:grammarSlot(`verb-${activityVerb.id}-tekara`,`${te.japanese}から`,activityVerb.japanese,`${te.reading}から`,activityVerb.english,['sequence','te-kara']),mainVerb:grammarSlot('verb-iku-after','行きます','行く','いきます','go',['movement','sequence-result'])}
    const subjectEnglish=englishPhrase(subject,'subject')
    const goes=subjectUsesBaseVerb(subjectEnglish)?'go':'goes'
    return finish(furigana,`After ${presentParticiple(activityVerb.english)} ${objectEnglish}, ${subjectEnglish} ${goes} ${movementDestination(destination)}.`,{subject,object,destination},extra,['firstVerb.object is governed by the first verb.','mainVerb.destination is governed by the main verb.','Both actions share one compatible subject.'])
  }
  if (patternId==='n4-14') {
    const purposes=[
      {id:'play',stem:'遊び',reading:'あそび',dictionary:'遊ぶ',english:'play',placeTags:['park','amusement-park']},
      {id:'study',stem:'勉強し',reading:'べんきょうし',dictionary:'勉強する',english:'study',placeTags:['school','university','library','classroom']},
      {id:'shop',stem:'買い物し',reading:'かいものし',dictionary:'買い物する',english:'do some shopping',placeTags:['store','shop','shopping']},
    ]
    const purpose=seededPick(purposes,seed,441)
    const destination=pick(places.filter(word=>[...tagSet(word)].some(tag=>purpose.placeTags.includes(tag))),442)
    if (!destination) return null
    const purposeSurface=`${purpose.stem}に行きます`,purposeReading=`${purpose.reading}にいきます`
    const furigana=[wordPart(destination,'destination'),literalPart('へ','え'),literalPart(purposeSurface,purposeReading,'purposeVerb')]
    return finish(furigana,`I go ${movementDestination(destination)} to ${purpose.english}.`,{destination},{purposeVerb:grammarSlot(`purpose-${purpose.id}`,purposeSurface,purpose.dictionary,purposeReading,purpose.english,['purpose','movement'])},['Purpose is an activity.','Destination supports that activity.'])
  }
  if (patternId==='n4-15') {
    const pluralBenefactors=new Set(['人々','我々','私たち','両親','家族'])
    const benefactor=pick(humans.filter(word=>!pluralBenefactors.has(word.japanese)&&![...tagSet(word)].some(tag=>['speaker','first-person','second-person','pronoun'].includes(tag))),451)
    const object=pick(exact(['本','記事','新聞','辞書','小説']),452)
    if (!benefactor||!object) return null
    const subjectEnglish=englishPhrase(benefactor,'subject')
    const lends=subjectUsesBaseVerb(subjectEnglish)?'lend':'lends'
    const furigana=[wordPart(benefactor,'subject'),literalPart('が'),wordPart(object,'object'),literalPart('を'),literalPart('貸してくれます','かしてくれます','verb')]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${lends} me ${englishPhrase(object,'object')}.`,{subject:benefactor,object},{verb:grammarSlot('verb-kashite-kureru','貸してくれます','貸す','かしてくれます','lend',['benefactive','speaker-benefit','te-kureru'])},['Action benefits the speaker.','Object can reasonably be lent.'])
  }
  if (patternId==='n4-16') {
    const helpers=humans.filter(word=>[...tagSet(word)].some(tag=>['teacher','parent','friend','student','classmate'].includes(tag)))
    const helper=pick(helpers,461),object=pick(exact(['日本語','英語','中国語','外国語']),462)
    if (!helper||!object) return null
    const furigana=[wordPart(helper,'helper'),literalPart('に'),wordPart(object,'object'),literalPart('を'),literalPart('教えてもらいます','おしえてもらいます','verb')]
    const languageEnglish={日本語:'Japanese',英語:'English',中国語:'Chinese',外国語:'a foreign language'}[object.japanese]??primaryEnglishGloss(object.preferredTranslation||object.english)
    const helperEnglish=companionKinshipTerms[helper.japanese]?`my ${companionKinshipTerms[helper.japanese]}`:englishPhrase(helper,'recipient')
    return finish(furigana,`I have ${helperEnglish} teach me ${languageEnglish}.`,{helper,object},{verb:grammarSlot('verb-oshiete-morau','教えてもらいます','教える','おしえてもらいます','have teach',['assistance','te-morau'])},['Helper is a person suited to teaching or assistance.'])
  }
  if (patternId==='n4-17') {
    const firstPersonRecipients=new Set(['私','俺','我々'])
    const subject=pick(exact(['私','俺']),471),recipient=pick(humans.filter(word=>word.id!==subject?.id&&!firstPersonRecipients.has(word.japanese)),472),object=pick(exact(['本','記事','新聞','辞書','小説']),473)
    if (!subject||!recipient||!object) return null
    const subjectEnglish=englishPhrase(subject,'subject'),recipientEnglish=contextualSlotEnglish('companion',recipient,{subject}),lends=subjectUsesBaseVerb(subjectEnglish)?'lend':'lends'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(recipient,'recipient'),literalPart('に'),wordPart(object,'object'),literalPart('を'),literalPart('貸してあげます','かしてあげます','verb')]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${lends} ${recipientEnglish} ${englishPhrase(object,'object')} as a favor.`,{subject,recipient,object},{verb:grammarSlot('verb-kashite-ageru','貸してあげます','貸す','かしてあげます','lend',['benefactive','recipient-benefit','te-ageru'])},['Subject and recipient are different people.','Action benefits the recipient.'])
  }
  if (patternId==='n4-18') {
    const variants=[
      {japanese:'雨が降っているから家にいます',reading:'あめがふっているからいえにいます',english:'Because it is raining, I stay home.',cause:'雨が降っている',causeReading:'あめがふっている',result:'家にいます',resultReading:'いえにいます'},
      {japanese:'寒いから窓を閉めます',reading:'さむいからまどをしめます',english:'Because it is cold, I close the window.',cause:'寒い',causeReading:'さむい',result:'窓を閉めます',resultReading:'まどをしめます'},
      {japanese:'天気がいいから公園に行きます',reading:'てんきがいいからこうえんにいきます',english:'Because the weather is nice, I go to the park.',cause:'天気がいい',causeReading:'てんきがいい',result:'公園に行きます',resultReading:'こうえんにいきます'},
    ]
    const variant=seededPick(variants,seed,481)
    const furigana=[literalPart(variant.cause,variant.causeReading,'causeClause'),literalPart('から'),literalPart(variant.result,variant.resultReading,'resultClause')]
    return finish(furigana,variant.english,{}, {causeClause:grammarSlot('clause-cause',variant.cause,variant.cause,variant.causeReading,'cause',['cause-clause'],'noun'),resultClause:grammarSlot('clause-result',variant.result,variant.result,variant.resultReading,'result',['logical-result'],'noun')},['Result is logically licensed by the cause.'])
  }
  if (patternId==='n4-19') {
    const pairs=[
      {one:'安い',oneReading:'やすい',oneEnglish:'inexpensive',two:'便利です',twoReading:'べんりです',twoEnglish:'convenient',english:"It's inexpensive, and it's convenient."},
      {one:'静かだ',oneReading:'しずかだ',oneEnglish:'quiet',two:'きれいです',twoReading:'きれいです',twoEnglish:'clean',english:"It's quiet, and it's clean."},
      {one:'大きい',oneReading:'おおきい',oneEnglish:'large',two:'新しいです',twoReading:'あたらしいです',twoEnglish:'new',english:"It's large, and it's new."},
    ]
    const pair=seededPick(pairs,seed,491)
    const furigana=[literalPart(pair.one,pair.oneReading,'property1'),literalPart('し'),literalPart(pair.two,pair.twoReading,'property2')]
    return finish(furigana,pair.english,{}, {property1:grammarSlot('property-1',pair.one,pair.one,pair.oneReading,pair.oneEnglish,['shared-topic-property'],'i_adjective'),property2:grammarSlot('property-2',pair.two,pair.two.replace(/です$/,''),pair.twoReading,pair.twoEnglish,['shared-topic-property'],'na_adjective')},['Both properties describe the same implied topic.'])
  }
  if (patternId==='n4-20') {
    const subject=pick(humans,501),object=pick(exact(['漢字','本','記事','新聞','小説','辞書']),502)
    if (!subject||!object) return null
    const subjectEnglish=englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('が'),literalPart('読めます','よめます','verb')]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} can read ${englishPhrase(object,'object')}.`,{subject,object},{verb:grammarSlot('verb-yomeru','読めます','読める','よめます','can read',['potential','ability','godan-potential'])},['Uses the correct potential form 読める.','Object is readable.'])
  }
  if (patternId==='n4-21' || patternId==='n4-22' || patternId==='n4-23') {
    const pair=actionPair(patternId==='n4-21'?511:patternId==='n4-22'?521:531)
    if (!pair) return null
    const {firstVerb,firstResult,mainVerb,mainResult,subject}=pair
    const firstObject=firstResult.filled.object!,mainObject=mainResult.filled.object!
    const subjectEnglish=englishPhrase(subject,'subject')
    const firstEnglish=translatedVerb(firstVerb,{subject,object:firstObject},true)
    const mainEnglish=translatedVerb(mainVerb,{subject,object:mainObject},subjectUsesBaseVerb(subjectEnglish))
    const firstForms=n4VerbForms(firstVerb),mainForms=n4VerbForms(mainVerb)
    const firstObjectEnglish=englishPhrase(firstObject,'object'),mainObjectEnglish=englishPhrase(mainObject,'object')
    const sharedFilled={subject,firstObject,mainObject}

    if (patternId==='n4-21') {
      const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(firstObject,'firstObject'),literalPart('を'),literalPart(firstVerb.japanese,firstVerb.reading,'firstVerb'),literalPart('前に','まえに'),wordPart(mainObject,'mainObject'),literalPart('を'),literalPart(mainForms.masu.japanese,mainForms.masu.reading,'mainVerb')]
      return finish(furigana,`Before ${presentParticiple(firstEnglish)} ${firstObjectEnglish}, ${subjectEnglish} ${mainEnglish} ${mainObjectEnglish}.`,sharedFilled,{firstVerb:grammarSlot(`verb-${firstVerb.id}-mae`,firstVerb.japanese,firstVerb.japanese,firstVerb.reading,firstVerb.english,['before','dictionary-form']),mainVerb:grammarSlot(`verb-${mainVerb.id}-mae`,mainForms.masu.japanese,mainVerb.japanese,mainForms.masu.reading,mainVerb.english,['main-action','masu'])},['firstVerb.object is governed by the first verb.','mainVerb.object is governed by the main verb.','Both actions share one compatible subject.'])
    }
    if (patternId==='n4-22') {
      const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(firstObject,'firstObject'),literalPart('を'),literalPart(firstForms.ta.japanese,firstForms.ta.reading,'firstVerb'),literalPart('後で','あとで'),wordPart(mainObject,'mainObject'),literalPart('を'),literalPart(mainForms.masu.japanese,mainForms.masu.reading,'mainVerb')]
      return finish(furigana,`After ${presentParticiple(firstEnglish)} ${firstObjectEnglish}, ${subjectEnglish} ${mainEnglish} ${mainObjectEnglish}.`,sharedFilled,{firstVerb:grammarSlot(`verb-${firstVerb.id}-ato`,firstForms.ta.japanese,firstVerb.japanese,firstForms.ta.reading,firstVerb.english,['after','past-plain']),mainVerb:grammarSlot(`verb-${mainVerb.id}-ato`,mainForms.masu.japanese,mainVerb.japanese,mainForms.masu.reading,mainVerb.english,['main-action','masu'])},['firstVerb.object is governed by the first verb.','mainVerb.object is governed by the main verb.','The two objects are different.'])
    }
    const firstTari=appendForm(firstForms.ta,'り'),mainTari=appendForm(mainForms.ta,'り')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(firstObject,'firstObject'),literalPart('を'),literalPart(firstTari.japanese,firstTari.reading,'firstVerb'),wordPart(mainObject,'mainObject'),literalPart('を'),literalPart(mainTari.japanese,mainTari.reading,'mainVerb'),literalPart('します','します','summaryVerb')]
    const doesThings=subjectUsesBaseVerb(subjectEnglish)?'do things':'does things'
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${doesThings} like ${presentParticiple(firstEnglish)} ${firstObjectEnglish} and ${presentParticiple(translatedVerb(mainVerb,{subject,object:mainObject},true))} ${mainObjectEnglish}.`,sharedFilled,{firstVerb:grammarSlot(`verb-${firstVerb.id}-tari`,firstTari.japanese,firstVerb.japanese,firstTari.reading,firstVerb.english,['example-action','tari-form']),mainVerb:grammarSlot(`verb-${mainVerb.id}-tari`,mainTari.japanese,mainVerb.japanese,mainTari.reading,mainVerb.english,['example-action','tari-form']),summaryVerb:grammarSlot('verb-suru-tari','します','する','します','do',['summary-action','tari-tari'])},['firstVerb.object is governed by the first verb.','mainVerb.object is governed by the main verb.','The two objects are different.'])
  }
  if (patternId==='n4-24' || patternId==='n4-25') {
    const verb=pickDirectVerb(541)
    const result=verb ? fillVerbSlots(verb,vocabulary,seed,542) : null
    if (!verb||!result) return null
    const subject=result.filled.subject!,object=result.filled.object!
    const subjectEnglish=englishPhrase(subject,'subject')
    const base=translatedVerb(verb,{subject,object},true)
    const forms=n4VerbForms(verb)
    if (patternId==='n4-24') {
      const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('を'),literalPart(verb.japanese,verb.reading,'verb'),literalPart('ことができます','ことができます')]
      return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} can ${base} ${englishPhrase(object,'object')}.`,{subject,object},{verb:grammarSlot(`verb-${verb.id}-dekiru`,verb.japanese,verb.japanese,verb.reading,verb.english,['ability','dictionary-form','koto-ga-dekiru'])},['Verb selected first and supplied the object rule.','ことができます attaches to the dictionary form.'])
    }
    const negative=appendForm(forms.aStem,'なくてもいいです')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('を'),literalPart(negative.japanese,negative.reading,'verb')]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} does not have to ${base} ${englishPhrase(object,'object')}.`,{subject,object},{verb:grammarSlot(`verb-${verb.id}-nakute`,negative.japanese,verb.japanese,negative.reading,verb.english,['not-required','nakute-mo-ii'])},['Verb selected first and supplied the object rule.','なくてもいい expresses that the action is not required.'])
  }
  return null
}

const n3PatternIds = new Set(Array.from({length:10},(_,index)=>`n3-${String(index+1).padStart(2,'0')}`))
const n3PatternMeanings: Record<string,string> = {
  'n3-01':'make an effort or habit','n3-02':'decide to do','n3-03':'change in ability or habit','n3-04':'completion or regret','n3-05':'do in preparation',
  'n3-06':'conditional if','n3-07':'conditional when or if','n3-08':'although or despite','n3-09':'because or since','n3-10':'in order to',
}

function generateN3CategorySentence(seed: number,patternId: string): GeneratedPreviewSentence | null {
  if (!n3PatternIds.has(patternId)) return null
  const vocabulary=editorWords()
  const humans=validHumanPool(vocabulary)
  const places=validPlacePool(vocabulary)
  const pick=<T>(pool: T[],salt: number)=>pool.length?seededPick(pool,seed,salt):null
  const exact=(japanese: string[])=>vocabulary.filter(word=>japanese.includes(word.japanese)&&hasUsableMeaning(word))
  const wordPart=(word: WordRecord,slot: string)=>({text:word.japanese,reading:kanaReading(word.reading,word.japanese),slot})
  const literalPart=(text: string,reading=text,slot?: string)=>({text,reading,slot})
  const grammarSlot=(id: string,surface: string,dictionaryForm: string,reading: string,english: string,tags: string[],pos: 'verb'|'noun'|'i_adjective'|'na_adjective'='verb')=>({
    id,surface,dictionaryForm,reading,english,pos,jlpt:'N3' as const,tags,conjugation:patternId,
  })
  const finish=(furigana: GeneratedPreviewSentence['furigana'],english: string,filled: Record<string,WordRecord>,extraSlots: GeneratedPreviewSentence['slots'],validation: string[]): GeneratedPreviewSentence=>({
    frameId:patternId,level:'N3',japanese:furigana.map(part=>part.text).join(''),reading:furigana.map(part=>part.reading||part.text).join(''),english,
    slots:{...generatedWordSlots(filled,{}),...extraSlots},furigana,grammar:[{pattern:patternId,meaning:n3PatternMeanings[patternId]!,jlpt:'N3'}],validation,
  })
  const capitalize=(value: string)=>value.charAt(0).toUpperCase()+value.slice(1)
  const firstPerson=exact(['私']).filter(word=>word.categories.includes('Person'))
  const readable=exact(['漢字','本','記事','新聞','小説','辞書'])
  const languages=exact(['日本語','英語','中国語','外国語'])

  if (patternId==='n3-01') {
    const subject=pick(firstPerson.length?firstPerson:humans,601)
    if (!subject) return null
    const subjectEnglish=englishPhrase(subject,'subject'),make=subjectUsesBaseVerb(subjectEnglish)?'make':'makes'
    const habits: Array<{furigana: GeneratedPreviewSentence['furigana'];filled: Record<string,WordRecord>;extra: GeneratedPreviewSentence['slots'];english: string;rule: string}>=[]
    const readingObject=pick(readable.filter(word=>word.japanese!=='辞書'),602)
    if (readingObject) habits.push({
      furigana:[wordPart(subject,'subject'),literalPart('は','わ'),literalPart('毎日','まいにち','time'),wordPart(readingObject,'object'),literalPart('を'),literalPart('読むようにします','よむようにします','verb')],
      filled:{subject,object:readingObject},extra:{time:grammarSlot('time-mainichi','毎日','毎日','まいにち','every day',['frequency','daily'],'noun'),verb:grammarSlot('verb-yomu-younisuru','読むようにします','読む','よむようにします','make a point of reading',['habit','youni-suru'])},
      english:`${capitalize(subjectEnglish)} ${make} a point of reading ${englishPhrase(readingObject,'object')} every day.`,rule:'Readable objects are paired with 読む.',
    })
    const language=pick(languages,603)
    if (language) habits.push({
      furigana:[wordPart(subject,'subject'),literalPart('は','わ'),literalPart('毎日','まいにち','time'),wordPart(language,'object'),literalPart('を'),literalPart('勉強するようにします','べんきょうするようにします','verb')],
      filled:{subject,object:language},extra:{time:grammarSlot('time-mainichi-study','毎日','毎日','まいにち','every day',['frequency','daily'],'noun'),verb:grammarSlot('verb-benkyou-younisuru','勉強するようにします','勉強する','べんきょうするようにします','make a point of studying',['habit','learning','youni-suru'])},
      english:`${capitalize(subjectEnglish)} ${make} a point of studying ${{日本語:'Japanese',英語:'English',中国語:'Chinese',外国語:'a foreign language'}[language.japanese]??primaryEnglishGloss(language.preferredTranslation||language.english)} every day.`,rule:'Language vocabulary is paired with studying.',
    })
    const habit=pick(habits,604)
    return habit?finish(habit.furigana,habit.english,habit.filled,habit.extra,[habit.rule,'ようにする expresses a deliberate habit or effort.']):null
  }

  if (patternId==='n3-02') {
    const subject=pick(firstPerson.length?firstPerson:humans,611)
    const destinationPool=places.filter(word=>['日本','東京','大阪','学校','大学','図書館','公園','駅','病院'].includes(word.japanese))
    const destination=pick(destinationPool,612)
    if (!subject||!destination) return null
    const subjectEnglish=englishPhrase(subject,'subject'),have=subjectUsesBaseVerb(subjectEnglish)?'have':'has'
    const destinationEnglish={学校:'school',大学:'university'}[destination.japanese]??englishPhrase(destination,'destination')
    const movement=destination.japanese==='家'?'go home':`go to ${destinationEnglish}`
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(destination,'destination'),literalPart('へ','え'),literalPart('行くことにします','いくことにします','verb')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${have} decided to ${movement}.`,{subject,destination},{verb:grammarSlot('verb-iku-kotonisuru','行くことにします','行く','いくことにします','decide to go',['decision','movement','kotoni-suru'])},['Destination is valid for 行く.','ことにする expresses the subject’s decision.'])
  }

  if (patternId==='n3-03') {
    const learnerSubjects=exact(['私','学生','生徒','子供','少年','少女','男の子','女の子']).filter(word=>word.categories.includes('Person'))
    const subject=pick(learnerSubjects.length?learnerSubjects:humans,621),object=pick(readable.filter(word=>word.japanese!=='辞書'),622)
    if (!subject||!object) return null
    const subjectEnglish=englishPhrase(subject,'subject'),becomes=subjectUsesBaseVerb(subjectEnglish)?'become':'becomes'
    const abilityObjectEnglish={漢字:'kanji',本:'books',記事:'articles',新聞:'newspapers',小説:'novels',辞書:'dictionaries'}[object.japanese]??primaryEnglishGloss(object.preferredTranslation||object.english)
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('が'),literalPart('読めるようになります','よめるようになります','verb')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${becomes} able to read ${abilityObjectEnglish}.`,{subject,object},{verb:grammarSlot('verb-yomeru-youninaru','読めるようになります','読める','よめるようになります','become able to read',['ability-change','potential','youni-naru'])},['Object is readable.','Ability statements use a general class of readable things, not one specific item.','Uses the correct potential form 読める before ようになる.'])
  }

  if (patternId==='n3-04') {
    const subject=pick(firstPerson.length?firstPerson:humans,631)
    if (!subject) return null
    type RegretAction={object: WordRecord;surface: string;reading: string;dictionary: string;english: string;englishVerb: string;tags: string[]}
    const actions: RegretAction[]=[]
    const homework=pick(exact(['宿題','約束']),632)
    if (homework) actions.push({object:homework,surface:'忘れてしまいます',reading:'わすれてしまいます',dictionary:'忘れる',english:'forget',englishVerb:'forgetting',tags:['regret','forgetting']})
    const lostItem=pick(exact(['財布','鍵','切符','携帯電話']),633)
    if (lostItem) actions.push({object:lostItem,surface:'なくしてしまいます',reading:'なくしてしまいます',dictionary:'なくす',english:'lose',englishVerb:'losing',tags:['regret','loss']})
    const fragileItem=pick(exact(['コップ','皿','時計']),634)
    if (fragileItem) actions.push({object:fragileItem,surface:'壊してしまいます',reading:'こわしてしまいます',dictionary:'壊す',english:'break',englishVerb:'breaking',tags:['regret','damage']})
    const action=pick(actions,635)
    if (!action) return null
    const subjectEnglish=englishPhrase(subject,'subject'),ends=subjectUsesBaseVerb(subjectEnglish)?'end':'ends'
    const regretObjectEnglish={宿題:'my homework',約束:'a promise',財布:'my wallet',鍵:'my key',切符:'my ticket',携帯電話:'my phone',コップ:'a glass',皿:'a plate',時計:'my watch'}[action.object.japanese]??englishPhrase(action.object,'object')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(action.object,'object'),literalPart('を'),literalPart(action.surface,action.reading,'verb')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${ends} up ${action.englishVerb} ${regretObjectEnglish}.`,{subject,object:action.object},{verb:grammarSlot(`verb-${action.dictionary}-teshimau`,action.surface,action.dictionary,action.reading,action.english,[...action.tags,'te-shimau'])},['Verb and object form a natural accidental or regrettable event.'])
  }

  if (patternId==='n3-05') {
    const subject=pick(firstPerson.length?firstPerson:humans,641)
    if (!subject) return null
    type Preparation={object: WordRecord;surface: string;reading: string;dictionary: string;english: string;englishVerb: string;objectEnglish?: string}
    const preparations: Preparation[]=[]
    const reservation=pick(exact(['席','部屋','ホテル']),642)
    if (reservation) preparations.push({object:reservation,surface:'予約しておきます',reading:'よやくしておきます',dictionary:'予約する',english:'reserve',englishVerb:'reserve',objectEnglish:reservation.japanese==='ホテル'?'a hotel room':undefined})
    const material=pick(exact(['資料','書類','教科書']),643)
    if (material) preparations.push({object:material,surface:'準備しておきます',reading:'じゅんびしておきます',dictionary:'準備する',english:'prepare',englishVerb:'prepare'})
    const ticket=pick(exact(['切符','チケット','食べ物']),644)
    if (ticket) preparations.push({object:ticket,surface:'買っておきます',reading:'かっておきます',dictionary:'買う',english:'buy',englishVerb:'buy'})
    const preparation=pick(preparations,645)
    if (!preparation) return null
    const subjectEnglish=englishPhrase(subject,'subject'),futureSubject=subjectEnglish==='I'?"I'll":`${capitalize(subjectEnglish)} will`
    const objectEnglish=preparation.objectEnglish??({席:'a seat',部屋:'a room',切符:'a ticket',チケット:'a ticket',食べ物:'food'}[preparation.object.japanese]??englishPhrase(preparation.object,'object'))
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(preparation.object,'object'),literalPart('を'),literalPart(preparation.surface,preparation.reading,'verb')]
    return finish(furigana,`${futureSubject} ${preparation.englishVerb} ${objectEnglish} in advance.`,{subject,object:preparation.object},{verb:grammarSlot(`verb-${preparation.dictionary}-teoku`,preparation.surface,preparation.dictionary,preparation.reading,preparation.english,['preparation','te-oku'])},['Object can reasonably be prepared, reserved, or purchased in advance.'])
  }

  if (patternId==='n3-06') {
    type Conditional={furigana: GeneratedPreviewSentence['furigana'];filled: Record<string,WordRecord>;english: string;condition: string;conditionReading: string;result: string;resultReading: string;rule: string}
    const variants: Conditional[]=[]
    const rain=pick(exact(['雨']),651),park=pick(exact(['公園']),652)
    if (rain&&park) variants.push({furigana:[wordPart(rain,'weather'),literalPart('が'),literalPart('降れば','ふれば','condition'),wordPart(park,'destination'),literalPart('へ','え'),literalPart('行きません','いきません','result')],filled:{weather:rain,destination:park},english:'If it rains, I will not go to the park.',condition:'雨が降れば',conditionReading:'あめがふれば',result:'公園へ行きません',resultReading:'こうえんへいきません',rule:'Rain logically changes the outdoor plan.'})
    const time=pick(exact(['時間']),653),readingObject=pick(exact(['本','新聞','小説','記事']),654)
    if (time&&readingObject) variants.push({furigana:[wordPart(time,'time'),literalPart('が'),literalPart('あれば','あれば','condition'),wordPart(readingObject,'object'),literalPart('を'),literalPart('読みます','よみます','result')],filled:{time,object:readingObject},english:`If I have time, I will read ${englishPhrase(readingObject,'object')}.`,condition:'時間があれば',conditionReading:'じかんがあれば',result:`${readingObject.japanese}を読みます`,resultReading:`${kanaReading(readingObject.reading,readingObject.japanese)}をよみます`,rule:'The result is an activity that requires available time.'})
    const variant=pick(variants,655)
    if (!variant) return null
    return finish(variant.furigana,variant.english,variant.filled,{condition:grammarSlot('condition-ba',variant.condition,variant.condition,variant.conditionReading,'if condition',['conditional','ba-form'],'noun'),result:grammarSlot('result-ba',variant.result,variant.result,variant.resultReading,'result',['logical-result'],'noun')},[variant.rule,'Uses a valid ば-form condition.'])
  }

  if (patternId==='n3-07') {
    type TaraConditional={furigana: GeneratedPreviewSentence['furigana'];filled: Record<string,WordRecord>;english: string;condition: string;conditionReading: string;result: string;resultReading: string;rule: string}
    const variants: TaraConditional[]=[]
    const time=pick(exact(['時間']),661),readingObject=pick(exact(['本','新聞','小説','記事']),662)
    if (time&&readingObject) variants.push({furigana:[wordPart(time,'time'),literalPart('が'),literalPart('あったら','あったら','condition'),wordPart(readingObject,'object'),literalPart('を'),literalPart('読みます','よみます','result')],filled:{time,object:readingObject},english:`If I have time, I will read ${englishPhrase(readingObject,'object')}.`,condition:'時間があったら',conditionReading:'じかんがあったら',result:`${readingObject.japanese}を読みます`,resultReading:`${kanaReading(readingObject.reading,readingObject.japanese)}をよみます`,rule:'The result depends on having enough time.'})
    const rain=pick(exact(['雨']),663),umbrella=pick(exact(['傘']),664)
    if (rain&&umbrella) variants.push({furigana:[wordPart(rain,'weather'),literalPart('が'),literalPart('降ったら','ふったら','condition'),wordPart(umbrella,'object'),literalPart('を'),literalPart('使います','つかいます','result')],filled:{weather:rain,object:umbrella},english:'If it rains, I will use an umbrella.',condition:'雨が降ったら',conditionReading:'あめがふったら',result:'傘を使います',resultReading:'かさをつかいます',rule:'An umbrella is appropriate when it rains.'})
    const variant=pick(variants,665)
    if (!variant) return null
    return finish(variant.furigana,variant.english,variant.filled,{condition:grammarSlot('condition-tara',variant.condition,variant.condition,variant.conditionReading,'if or when condition',['conditional','tara-form'],'noun'),result:grammarSlot('result-tara',variant.result,variant.result,variant.resultReading,'result',['logical-result'],'noun')},[variant.rule,'Uses a valid たら-form condition.'])
  }

  if (patternId==='n3-08') {
    type Contrast={furigana: GeneratedPreviewSentence['furigana'];filled: Record<string,WordRecord>;english: string;clause: string;clauseReading: string;result: string;resultReading: string;rule: string}
    const variants: Contrast[]=[]
    const studyObject=pick(exact(['漢字','単語']),671)
    if (studyObject) variants.push({furigana:[wordPart(studyObject,'object'),literalPart('を'),literalPart('勉強した','べんきょうした','clause'),literalPart('のに'),literalPart('忘れました','わすれました','result')],filled:{object:studyObject},english:`Although I studied ${{漢字:'kanji',単語:'the words'}[studyObject.japanese]??primaryEnglishGloss(studyObject.preferredTranslation||studyObject.english)}, I forgot them.`,clause:`${studyObject.japanese}を勉強した`,clauseReading:`${kanaReading(studyObject.reading,studyObject.japanese)}をべんきょうした`,result:'忘れました',resultReading:'わすれました',rule:'Forgetting contrasts naturally with having studied.'})
    const umbrella=pick(exact(['傘']),672),rain=pick(exact(['雨']),673)
    if (umbrella&&rain) variants.push({furigana:[wordPart(umbrella,'object'),literalPart('を'),literalPart('持って行った','もっていった','clause'),literalPart('のに'),wordPart(rain,'weather'),literalPart('が'),literalPart('降りませんでした','ふりませんでした','result')],filled:{object:umbrella,weather:rain},english:'Although I took an umbrella, it did not rain.',clause:'傘を持って行った',clauseReading:'かさをもっていった',result:'雨が降りませんでした',resultReading:'あめがふりませんでした',rule:'The unused precaution creates a natural contrast.'})
    const variant=pick(variants,674)
    if (!variant) return null
    return finish(variant.furigana,variant.english,variant.filled,{clause:grammarSlot('clause-noni',variant.clause,variant.clause,variant.clauseReading,'although clause',['contrast','noni'],'noun'),result:grammarSlot('result-noni',variant.result,variant.result,variant.resultReading,'unexpected result',['unexpected-result'],'noun')},[variant.rule,'The result genuinely contrasts with the first clause.'])
  }

  if (patternId==='n3-09') {
    type Reason={furigana: GeneratedPreviewSentence['furigana'];filled: Record<string,WordRecord>;english: string;clause: string;clauseReading: string;result: string;resultReading: string;rule: string}
    const variants: Reason[]=[]
    const rain=pick(exact(['雨']),681),home=pick(exact(['家']),682)
    if (rain&&home) variants.push({furigana:[wordPart(rain,'weather'),literalPart('が'),literalPart('降っている','ふっている','reason'),literalPart('ので'),wordPart(home,'location'),literalPart('に'),literalPart('います','います','result')],filled:{weather:rain,location:home},english:'Because it is raining, I stay home.',clause:'雨が降っている',clauseReading:'あめがふっている',result:'家にいます',resultReading:'いえにいます',rule:'Staying home is a reasonable result of rain.'})
    const illness=pick(exact(['病気']),683),hospital=pick(exact(['病院']),684)
    if (illness&&hospital) variants.push({furigana:[wordPart(illness,'state'),literalPart('な'),literalPart('ので'),wordPart(hospital,'destination'),literalPart('へ','え'),literalPart('行きます','いきます','result')],filled:{state:illness,destination:hospital},english:'Because I am sick, I go to the hospital.',clause:'病気な',clauseReading:'びょうきな',result:'病院へ行きます',resultReading:'びょういんへいきます',rule:'Illness reasonably motivates a hospital visit.'})
    const variant=pick(variants,685)
    if (!variant) return null
    return finish(variant.furigana,variant.english,variant.filled,{reason:grammarSlot('reason-node',variant.clause,variant.clause,variant.clauseReading,'reason',['reason','node'],'noun'),result:grammarSlot('result-node',variant.result,variant.result,variant.resultReading,'logical result',['logical-result'],'noun')},[variant.rule,'ので connects a genuine cause and result.'])
  }

  const travelPairs=[
    {country:'日本',language:'日本語',countryEnglish:'Japan',languageEnglish:'Japanese'},
    {country:'中国',language:'中国語',countryEnglish:'China',languageEnglish:'Chinese'},
    {country:'アメリカ',language:'英語',countryEnglish:'the United States',languageEnglish:'English'},
  ].flatMap(pair=>{
    const country=exact([pair.country])[0],language=exact([pair.language])[0]
    return country&&language?[{...pair,country,language}]:[]
  })
  const pair=pick(travelPairs,691)
  if (!pair) return null
  const furigana=[wordPart(pair.country,'destination'),literalPart('へ','え'),literalPart('行く','いく','purpose'),literalPart('ために'),wordPart(pair.language,'object'),literalPart('を'),literalPart('勉強します','べんきょうします','mainVerb')]
  return finish(furigana,`I study ${pair.languageEnglish} in order to go to ${pair.countryEnglish}.`,{destination:pair.country,object:pair.language},{purpose:grammarSlot('purpose-tameni','行く','行く','いく','go',['purpose','movement'],'verb'),mainVerb:grammarSlot('main-benkyou','勉強します','勉強する','べんきょうします','study',['learning','purpose-result'])},['Country and language are paired deliberately.','The main action supports the stated purpose.'])
}

/**
 * Advanced (N2/N1) grammar attaches to whole propositions rather than a single
 * governed verb, so — like the trickier N3 blocks — these mix real vocabulary
 * pools with a handful of hand-verified grammar templates per pattern. Every
 * combination of subject/object/verb still gets correct per-word furigana.
 */
const advancedPatternMeanings: Record<string,string> = {
  'n2-01':'it is not that','n2-02':'cannot afford to','n2-09':'so that','n1-01':'have no choice but to','n1-02':'nothing other than',
  'n3-11':'while (bounded window)','n3-12':'while / before it is too late','n3-13':'just did','n3-14':'finish doing','n3-15':'continue doing',
  'n2-10':'about to, in the middle of, or just did',
  'n3-16':'thanks to','n3-17':'because of (blame)','n3-18':'leaving a state as-is','n3-19':'while (formal)',
  'n2-11':'should do','n1-03':'although','n1-04':'might result in something negative',
  'n2-12':'as / along with a change','n2-13':'even (emphatic)','n2-14':'precisely / it is X that','n2-15':'not only X but also Y',
  'n1-11':'if / supposing','n1-12':'according to / depending on','n1-13':'not necessarily',
  'n2-04':'there is no need to','n1-05':'unless something is done','n1-06':'extending even to','n1-07':'unique or characteristic of',
  'n1-08':'in accordance with','n1-09':'concerning or surrounding a topic','n1-10':'on the occasion of',
}

const advancedPatternIds = new Set([
  'n2-01', 'n2-02', 'n2-09', 'n1-01', 'n1-02', 'n3-11', 'n3-12', 'n3-13', 'n3-14', 'n3-15', 'n2-10',
  'n3-16', 'n3-17', 'n3-18', 'n3-19', 'n2-11', 'n1-03', 'n1-04',
  'n2-12', 'n2-13', 'n2-14', 'n2-15', 'n1-11', 'n1-12', 'n1-13',
  'n2-04', 'n1-05', 'n1-06', 'n1-07', 'n1-08', 'n1-09', 'n1-10',
])

function advancedPatternLevel(patternId: string): 'N4' | 'N3' | 'N2' | 'N1' {
  if (patternId.startsWith('n1-')) return 'N1'
  if (patternId.startsWith('n2-')) return 'N2'
  if (patternId.startsWith('n3-')) return 'N3'
  return 'N4'
}

function generateAdvancedCategorySentence(seed: number, patternId: string): GeneratedPreviewSentence | null {
  if (!advancedPatternIds.has(patternId)) return null
  const level = advancedPatternLevel(patternId)
  const vocabulary = editorWords()
  const humans = validHumanPool(vocabulary)
  const pick = <T>(pool: T[], salt: number) => pool.length ? seededPick(pool, seed, salt) : null
  const exact = (japanese: string[]) => vocabulary.filter(word => japanese.includes(word.japanese) && hasUsableMeaning(word))
  const wordPart = (word: WordRecord, slot: string) => ({ text: word.japanese, reading: kanaReading(word.reading, word.japanese), slot })
  const literalPart = (text: string, reading = text, slot?: string) => ({ text, reading, slot })
  const grammarSlot = (id: string, surface: string, dictionaryForm: string, reading: string, english: string, tags: string[]) => ({
    id, surface, dictionaryForm, reading, english, pos: 'verb' as const, jlpt: level, tags, conjugation: patternId,
  })
  const finish = (furigana: GeneratedPreviewSentence['furigana'], english: string, filled: Record<string,WordRecord>, extraSlots: GeneratedPreviewSentence['slots'], note: string): GeneratedPreviewSentence => ({
    frameId: patternId, level, japanese: furigana.map(part => part.text).join(''), reading: furigana.map(part => part.reading || part.text).join(''), english,
    slots: { ...generatedWordSlots(filled, {}), ...extraSlots }, furigana, grammar: [{ pattern: patternId, meaning: advancedPatternMeanings[patternId]!, jlpt: level }],
    validation: [note, 'Advanced-grammar sentence combining vocabulary pools with a verified template.'],
  })
  const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

  if (patternId === 'n2-09') {
    type Variant = { furigana: GeneratedPreviewSentence['furigana']; filled: Record<string,WordRecord>; english: string; note: string }
    const variants: Variant[] = []
    const readable = exact(['漢字','本','新聞','小説','記事'])
    const readingTarget = pick(readable, 801)
    const effort = pick([{ surface:'勉強します', reading:'べんきょうします', english:'study' }, { surface:'練習します', reading:'れんしゅうします', english:'practice' }], 802)
    if (readingTarget && effort) variants.push({
      furigana:[wordPart(readingTarget,'object'),literalPart('が'),literalPart('読める','よめる','ability'),literalPart('ように、'),literalPart('毎日','まいにち','time'),literalPart(effort.surface,effort.reading,'verb')],
      filled:{object:readingTarget},english:`I ${effort.english} every day so that I can read ${englishPhrase(readingTarget,'object')}.`,
      note:'ように pairs a potential verb with the effort that achieves it.',
    })
    const prevention = pick([
      { trigger:'忘れ',triggerReading:'わすれ',action:'メモします',actionReading:'めもします',english:['forget','take notes']},
      { trigger:'遅刻し',triggerReading:'ちこくし',action:'早く家を出ます',actionReading:'はやくいえをでます',english:['be late','leave home early']},
      { trigger:'風邪をひか',triggerReading:'かぜをひか',action:'気をつけます',actionReading:'きをつけます',english:['catch a cold','am careful']},
    ], 803)
    if (prevention) variants.push({
      furigana:[literalPart(prevention.trigger,prevention.triggerReading,'verb'),literalPart('ないように、'),literalPart(prevention.action,prevention.actionReading,'result')],
      filled:{},english:`I ${prevention.english[1]} so that I will not ${prevention.english[0]}.`,
      note:'ように pairs a negative verb with a deliberate preventive action.',
    })
    const variant = pick(variants, 804)
    return variant ? finish(variant.furigana, capitalize(variant.english), variant.filled, {}, variant.note) : null
  }

  if (patternId === 'n1-01') {
    const candidateVerbs = verbs.filter(verb => ['iku-e','hanasu-companion','yomu-basic','nomu-basic','taberu-basic','miru-basic','okiru-time'].includes(verb.id))
    const verb = pick(candidateVerbs, 811)
    const subject = pick(humans, 812)
    const reason = pick([
      { surface:'ルールなので、', reading:'るーるなので、', english:'Since it is the rule' },
      { surface:'約束なので、', reading:'やくそくなので、', english:'Since it is a promise' },
      { surface:'仕事なので、', reading:'しごとなので、', english:'Since it is work' },
    ], 813)
    if (!verb || !subject || !reason) return null
    const aStem = n4VerbForms(verb).aStem
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[literalPart(reason.surface,reason.reading,'reason'),wordPart(subject,'subject'),literalPart('は','わ'),{text:aStem.japanese,reading:aStem.reading,slot:'verb'},literalPart('ざるを'),literalPart('得ません。','えません。','modal')]
    return finish(furigana,`${reason.english}, ${subjectEnglish} ${subjectUsesBaseVerb(subjectEnglish)?'have':'has'} no choice but to ${verb.english}.`,{subject},{verb:grammarSlot(`verb-${verb.id}-zaruoenai`,`${aStem.japanese}ざるを得ません`,verb.japanese,`${aStem.reading}ざるをえません`,`have no choice but to ${verb.english}`,['obligation','zaru-o-enai'])},'ざるを得ない follows a reason the subject cannot resist.')
  }

  if (patternId === 'n1-02') {
    const subject = pick([
      { surface:'成功', reading:'せいこう', english:'success' },
      { surface:'合格', reading:'ごうかく', english:'passing the exam' },
      { surface:'勝利', reading:'しょうり', english:'victory' },
    ], 821)
    const cause = pick([
      { surface:'努力', reading:'どりょく', english:'effort' },
      { surface:'準備', reading:'じゅんび', english:'preparation' },
      { surface:'練習', reading:'れんしゅう', english:'practice' },
    ], 822)
    const tail = pick([{ surface:'結果', reading:'けっか', english:'result' }, { surface:'成果', reading:'せいか', english:'fruit' }], 823)
    if (!subject || !cause || !tail) return null
    const furigana=[literalPart(subject.surface,subject.reading,'subject'),literalPart('は','わ'),literalPart(cause.surface,cause.reading,'cause'),literalPart('の'),literalPart(tail.surface,tail.reading,'object'),literalPart('にほかならない。')]
    return finish(furigana,`${capitalize(subject.english)} is nothing other than the ${tail.english} of ${cause.english}.`,{},{},'にほかならない equates a result with its single true cause.')
  }

  if (patternId === 'n2-01') {
    type Variant = { furigana: GeneratedPreviewSentence['furigana']; filled: Record<string,WordRecord>; english: string }
    const variants: Variant[] = []
    const dislikable = exact(['肉','魚','野菜','勉強'])
    const dislikeObject = pick(dislikable, 831)
    if (dislikeObject) variants.push({
      furigana:[wordPart(dislikeObject,'object'),literalPart('が'),literalPart('嫌い','きらい','predicate'),literalPart('な'),literalPart('わけではありません。')],
      filled:{object:dislikeObject},english:`It is not that I dislike ${englishPhrase(dislikeObject,'object')}.`,
    })
    const habitVerb = pick([
      { surface:'勉強して', reading:'べんきょうして', english:'study' },
      { surface:'運動して', reading:'うんどうして', english:'exercise' },
      { surface:'料理して', reading:'りょうりして', english:'cook' },
    ], 832)
    const frequency = pick([{ surface:'毎日', reading:'まいにち' }, { surface:'いつも', reading:'いつも' }], 833)
    if (habitVerb && frequency) variants.push({
      furigana:[literalPart(frequency.surface,frequency.reading,'time'),literalPart(habitVerb.surface,habitVerb.reading,'verb'),literalPart('いるわけではありません。')],
      filled:{},english:`It is not that I ${habitVerb.english} ${frequency.surface==='毎日'?'every day':'always'}.`,
    })
    const variant = pick(variants, 834)
    return variant ? finish(variant.furigana, capitalize(variant.english), variant.filled, {}, 'わけではない softens an assumed generalization.') : null
  }

  if (patternId === 'n2-02') {
    const reason = pick(exact(['試験','仕事','会議','約束']), 841)
    const declinedVerb = pick([
      { surface:'休む', reading:'やすむ', english:'skip it' },
      { surface:'帰る', reading:'かえる', english:'go home' },
      { surface:'寝る', reading:'ねる', english:'go to sleep' },
      { surface:'断る', reading:'ことわる', english:'refuse' },
    ], 842)
    if (!reason || !declinedVerb) return null
    const furigana=[wordPart(reason,'reason'),literalPart('が'),literalPart('あるので、'),literalPart(declinedVerb.surface,declinedVerb.reading,'verb'),literalPart('わけにはいきません。')]
    return finish(furigana,`There is ${englishPhrase(reason,'object')}, so I cannot afford to ${declinedVerb.english}.`,{reason},{},'わけにはいかない marks an option the situation forbids.')
  }

  const smallVerbPool = verbs.filter(verb => ['iku-e','hanasu-companion','yomu-basic','nomu-basic','taberu-basic','miru-basic','okiru-time'].includes(verb.id))

  if (patternId === 'n3-13') {
    const verb = pick(smallVerbPool, 851)
    const subject = pick(humans, 852)
    if (!verb || !subject) return null
    const ta = n4VerbForms(verb).ta
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),{text:ta.japanese,reading:ta.reading,slot:'verb'},literalPart('ばかりです。')]
    return finish(furigana,`${capitalize(subjectEnglish)} just ${simplePast(verb.english)}.`,{subject},{verb:grammarSlot(`verb-${verb.id}-tabakari`,`${ta.japanese}ばかりです`,verb.japanese,`${ta.reading}ばかりです`,`just ${verb.english}`,['just-completed','ta-bakari'])},'たばかり marks an action that finished a moment ago.')
  }

  if (patternId === 'n2-10') {
    const verb = pick(smallVerbPool, 861)
    const subject = pick(humans, 862)
    const aspect = pick(['about-to','ongoing','just-did'] as const, 863)
    if (!verb || !subject || !aspect) return null
    const forms = n4VerbForms(verb)
    const subjectEnglish = englishPhrase(subject,'subject')
    if (aspect === 'about-to') {
      const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart('今から','いまから','time'),{text:verb.japanese,reading:verb.reading,slot:'verb'},literalPart('ところです。')]
      const beAboutTo = subjectEnglish==='I'?'am':subjectUsesBaseVerb(subjectEnglish)?'are':'is'
      return finish(furigana,`${capitalize(subjectEnglish)} ${beAboutTo} just about to ${verb.english}.`,{subject},{},'ところだ with a dictionary-form verb means about to do something.')
    }
    if (aspect === 'ongoing') {
      const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart('今','いま','time'),{text:forms.te.japanese,reading:forms.te.reading,slot:'verb'},literalPart('いるところです。')]
      const beOngoing = subjectEnglish==='I'?'am':subjectUsesBaseVerb(subjectEnglish)?'are':'is'
      return finish(furigana,`${capitalize(subjectEnglish)} ${beOngoing} in the middle of ${presentParticiple(verb.english)}.`,{subject},{},'ところだ with ている means currently in the middle of doing something.')
    }
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart('今','いま','time'),{text:forms.ta.japanese,reading:forms.ta.reading,slot:'verb'},literalPart('ところです。')]
    return finish(furigana,`${capitalize(subjectEnglish)} just ${simplePast(verb.english)}.`,{subject},{},'ところだ with a past-form verb means an action just finished.')
  }

  if (patternId === 'n3-11') {
    const subject = pick(humans, 871)
    const companion = pick(humans.filter(word => word.id !== subject?.id), 872)
    const scene = pick([
      { activity:'話して', activityReading:'はなして', result:'メモを取ります', resultReading:'めもをとります', companionVerb:['talks','talk'], resultBase:'take notes', resultThird:'takes notes' },
      { activity:'テレビを見て', activityReading:'てれびをみて', result:'家事をします', resultReading:'かじをします', companionVerb:['watches television','watch television'], resultBase:'do housework', resultThird:'does housework' },
      { activity:'寝て', activityReading:'ねて', result:'宿題をします', resultReading:'しゅくだいをします', companionVerb:['sleeps','sleep'], resultBase:'do homework', resultThird:'does homework' },
    ], 873)
    if (!subject || !companion || !scene) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const companionEnglish = englishPhrase(companion,'subject')
    const companionUsesBase = subjectUsesBaseVerb(companionEnglish)
    const resultVerb = subjectEnglish==='I' || subjectUsesBaseVerb(subjectEnglish) ? scene.resultBase : scene.resultThird
    const furigana=[wordPart(companion,'companion'),literalPart('が'),literalPart(scene.activity,scene.activityReading,'reason'),literalPart('いる'),literalPart('間に','あいだに'),wordPart(subject,'subject'),literalPart('は','わ'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,capitalize(`while ${companionEnglish} ${companionUsesBase ? scene.companionVerb[1] : scene.companionVerb[0]}, ${subjectEnglish} ${resultVerb}.`),{subject,companion},{},'間に marks a bounded window during which the main action happens.')
  }

  if (patternId === 'n3-12') {
    const subject = pick(humans, 881)
    const scene = pick([
      { condition:'若い', conditionReading:'わかい', result:'たくさん勉強します', resultReading:'たくさんべんきょうします', english:'young', resultBase:'study a lot', resultThird:'studies a lot' },
      { condition:'元気な', conditionReading:'げんきな', result:'旅行します', resultReading:'りょこうします', english:'healthy', resultBase:'travel', resultThird:'travels' },
    ], 882)
    if (!subject || !scene) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const beVerb = subjectEnglish==='I' ? 'am' : subjectUsesBaseVerb(subjectEnglish) ? 'are' : 'is'
    const resultVerb = subjectEnglish==='I' || subjectUsesBaseVerb(subjectEnglish) ? scene.resultBase : scene.resultThird
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart(scene.condition,scene.conditionReading,'condition'),literalPart('うちに、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,`While ${subjectEnglish} ${beVerb} still ${scene.english}, ${subjectEnglish==='I'?'I':subjectEnglish} ${resultVerb}.`,{subject},{},'うちに marks a window that closes, so the action must happen before it does.')
  }

  const objectVerbPairs = [
    { verbId:'taberu-basic', objects: exact(['ご飯','パン','肉','魚']) },
    { verbId:'yomu-basic', objects: exact(['本','新聞','小説','記事']) },
    { verbId:'nomu-basic', objects: exact(['水','お茶','コーヒー']) },
  ]

  if (patternId === 'n3-14' || patternId === 'n3-15') {
    const pairPool = objectVerbPairs.filter(pair => pair.objects.length)
    const pair = pick(pairPool, 891)
    const verb = pair ? verbs.find(candidate => candidate.id === pair.verbId) : null
    const object = pair ? pick(pair.objects, 892) : null
    const subject = pick(humans, 893)
    if (!verb || !object || !subject) return null
    const masuStem = n4VerbForms(verb).masuStem
    const subjectEnglish = englishPhrase(subject,'subject')
    if (patternId === 'n3-14') {
      const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('を'),{text:masuStem.japanese,reading:masuStem.reading,slot:'verb'},literalPart('終わりました。','おわりました。')]
      return finish(furigana,`${capitalize(subjectEnglish)} finished ${presentParticiple(verb.english)} ${englishPhrase(object,'object')}.`,{subject,object},{},'終わる attaches to the masu-stem and means to finish doing something.')
    }
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('を'),{text:masuStem.japanese,reading:masuStem.reading,slot:'verb'},literalPart('続けています。','つづけています。')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${subjectUsesBaseVerb(subjectEnglish)?'keep':'keeps'} ${presentParticiple(verb.english)} ${englishPhrase(object,'object')}.`,{subject,object},{},'続ける attaches to the masu-stem and means to continue doing something.')
  }

  if (patternId === 'n3-16') {
    const subject = pick(humans, 901)
    const scene = pick([
      { cause:'先生', causeReading:'せんせい', causeEnglish:'the teacher', result:'合格しました', resultReading:'ごうかくしました', resultEnglish:'passed' },
      { cause:'努力', causeReading:'どりょく', causeEnglish:'the effort', result:'成功しました', resultReading:'せいこうしました', resultEnglish:'succeeded' },
      { cause:'練習', causeReading:'れんしゅう', causeEnglish:'the practice', result:'上手になりました', resultReading:'じょうずになりました', resultEnglish:'became skilled' },
    ], 902)
    if (!subject || !scene) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[literalPart(scene.cause,scene.causeReading,'cause'),literalPart('のおかげで、'),wordPart(subject,'subject'),literalPart('は','わ'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,`Thanks to ${scene.causeEnglish}, ${subjectEnglish} ${scene.resultEnglish}.`,{subject},{},'おかげで credits a cause for a positive result.')
  }

  if (patternId === 'n3-17') {
    const subject = pick(humans, 911)
    const scene = pick([
      { cause:'雨', causeReading:'あめ', causeEnglish:'the rain', result:'遅れました', resultReading:'おくれました', resultEnglish:'was late' },
      { cause:'渋滞', causeReading:'じゅうたい', causeEnglish:'the traffic jam', result:'遅刻しました', resultReading:'ちこくしました', resultEnglish:'arrived late' },
      { cause:'病気', causeReading:'びょうき', causeEnglish:'the illness', result:'休みました', resultReading:'やすみました', resultEnglish:'stayed home' },
    ], 912)
    if (!subject || !scene) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[literalPart(scene.cause,scene.causeReading,'cause'),literalPart('のせいで、'),wordPart(subject,'subject'),literalPart('は','わ'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,`Because of ${scene.causeEnglish}, ${subjectEnglish} ${scene.resultEnglish}.`,{subject},{},'せいで blames a cause for a negative result.')
  }

  if (patternId === 'n3-18') {
    const subject = pick(humans, 921)
    const scene = pick([
      { clause:'靴を履いた', clauseReading:'くつをはいた', result:'部屋に入りました', resultReading:'へやにはいりました', english:'entered the room with shoes still on' },
      { clause:'窓を開けた', clauseReading:'まどをあけた', result:'出かけました', resultReading:'でかけました', english:'went out leaving the window open' },
      { clause:'テレビをつけた', clauseReading:'てれびをつけた', result:'寝ました', resultReading:'ねました', english:'slept with the television on' },
    ], 922)
    if (!subject || !scene) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('まま、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${scene.english}.`,{subject},{},'たまま means an action leaves a state unchanged while something else happens.')
  }

  if (patternId === 'n3-19') {
    const readable = exact(['漢字','本','新聞','小説','記事'])
    const readingTarget = pick(readable, 931)
    const subject = pick(humans, 932)
    const secondary = pick([
      { surface:'メモを取ります', reading:'めもをとります', base:'take notes', third:'takes notes' },
      { surface:'お茶を飲みます', reading:'おちゃをのみます', base:'drink tea', third:'drinks tea' },
    ], 933)
    if (!readingTarget || !subject || !secondary) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const secondaryVerb = subjectEnglish==='I' || subjectUsesBaseVerb(subjectEnglish) ? secondary.base : secondary.third
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(readingTarget,'object'),literalPart('を'),literalPart('読み','よみ','verb'),literalPart('つつ、'),literalPart(secondary.surface,secondary.reading,'result')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${secondaryVerb} while reading ${englishPhrase(readingTarget,'object')}.`,{subject,object:readingTarget},{},'つつ is a formal equivalent of ながら for two simultaneous actions.')
  }

  if (patternId === 'n2-11') {
    const verb = pick(smallVerbPool, 941)
    const subject = pick(humans, 942)
    if (!verb || !subject) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),{text:verb.japanese,reading:verb.reading,slot:'verb'},literalPart('べきです。')]
    return finish(furigana,`${capitalize(subjectEnglish)} should ${verb.english}.`,{subject},{verb:grammarSlot(`verb-${verb.id}-bekida`,`${verb.japanese}べきです`,verb.japanese,`${verb.reading}べきです`,`should ${verb.english}`,['obligation','bekida'])},'べきだ attaches to the dictionary form and expresses a recommendation or duty.')
  }

  if (patternId === 'n1-03') {
    type Variant = { furigana: GeneratedPreviewSentence['furigana']; filled: Record<string,WordRecord>; english: string }
    const variants: Variant[] = []
    const studyObject = pick(exact(['漢字','単語']), 951)
    if (studyObject) variants.push({
      furigana:[wordPart(studyObject,'object'),literalPart('を'),literalPart('勉強した','べんきょうした','clause'),literalPart('ものの、'),literalPart('忘れました','わすれました','result')],
      filled:{object:studyObject},english:`Although I studied ${englishPhrase(studyObject,'object')}, I forgot it.`,
    })
    const umbrella = pick(exact(['傘']), 952), rain = pick(exact(['雨']), 953)
    if (umbrella && rain) variants.push({
      furigana:[wordPart(umbrella,'object'),literalPart('を'),literalPart('持って行った','もっていった','clause'),literalPart('ものの、'),wordPart(rain,'weather'),literalPart('は','わ'),literalPart('降りませんでした','ふりませんでした','result')],
      filled:{object:umbrella,weather:rain},english:'Although I took an umbrella, it did not rain.',
    })
    const variant = pick(variants, 954)
    return variant ? finish(variant.furigana, capitalize(variant.english), variant.filled, {}, 'ものの is a formal equivalent of のに for an unexpected contrast.') : null
  }

  if (patternId === 'n1-04') {
    const scene = pick([
      { cause:'無理をする', causeReading:'むりをする', result:'病気になり', resultReading:'びょうきになり', english:'Overdoing it might result in illness.' },
      { cause:'油断する', causeReading:'ゆだんする', result:'事故になり', resultReading:'じこになり', english:'Carelessness might result in an accident.' },
      { cause:'遅刻する', causeReading:'ちこくする', result:'信用を失い', resultReading:'しんようをうしない', english:'Being late might result in losing trust.' },
    ], 961)
    if (!scene) return null
    const furigana=[literalPart(scene.cause,scene.causeReading,'reason'),literalPart('と、'),literalPart(scene.result,scene.resultReading,'result'),literalPart('かねません。')]
    return finish(furigana,scene.english,{},{},'かねない attaches to the masu-stem and warns of a possible negative outcome.')
  }

  if (patternId === 'n2-12') {
    const scene = pick([
      { cause:'年を取る', causeReading:'としをとる', result:'体が弱くなります', resultReading:'からだがよわくなります', english:'As you get older, your body weakens.' },
      { cause:'練習する', causeReading:'れんしゅうする', result:'上手になります', resultReading:'じょうずになります', english:'As you practice, you get better.' },
      { cause:'勉強する', causeReading:'べんきょうする', result:'漢字が読めるようになります', resultReading:'かんじがよめるようになります', english:'As you study, you become able to read kanji.' },
    ], 971)
    if (!scene) return null
    const furigana=[literalPart(scene.cause,scene.causeReading,'reason'),literalPart('につれて、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'につれて links two changes that progress together.')
  }

  if (patternId === 'n2-13') {
    const subject = pick(humans, 981)
    const readingTarget = pick(exact(['漢字','本','新聞','小説','記事']), 982)
    if (!subject || !readingTarget) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(readingTarget,'object'),literalPart('さえ'),literalPart('読めません。','よめません。')]
    return finish(furigana,`${capitalize(subjectEnglish)} cannot even read ${englishPhrase(readingTarget,'object')}.`,{subject,object:readingTarget},{},'さえ singles out an extreme example to emphasize a broader claim.')
  }

  if (patternId === 'n2-14') {
    const subject = pick(humans, 991)
    const predicate = pick([
      { surface:'天才', reading:'てんさい', english:'the genius' },
      { surface:'専門家', reading:'せんもんか', english:'the expert' },
      { surface:'リーダー', reading:'リーダー', english:'the leader' },
    ], 992)
    if (!subject || !predicate) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('こそ、'),literalPart(predicate.surface,predicate.reading,'object'),literalPart('です。')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${subjectEnglish==='I'||subjectUsesBaseVerb(subjectEnglish)?'are':'is'} precisely ${predicate.english}.`,{subject},{},'こそ emphasizes that the preceding word — and no other — fits the predicate.')
  }

  if (patternId === 'n2-15') {
    const languageEnglish: Record<string,string> = { 日本語:'Japanese', 英語:'English', 中国語:'Chinese', 外国語:'a foreign language' }
    const subject = pick(humans, 1001)
    const languages = exact(['日本語','英語','中国語','外国語'])
    const first = pick(languages, 1002)
    const second = pick(languages.filter(word => word.id !== first?.id), 1003)
    if (!subject || !first || !second) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(first,'object'),literalPart('ばかりか、'),wordPart(second,'result'),literalPart('も'),literalPart('話せます。','はなせます。')]
    return finish(furigana,`${capitalize(subjectEnglish)} can speak not only ${languageEnglish[first.japanese]} but also ${languageEnglish[second.japanese]}.`,{subject,object:first},{},'ばかりか adds a second, often more surprising, item on top of the first.')
  }

  if (patternId === 'n1-11') {
    const destination = pick(validPlacePool(vocabulary).filter(word => ['日本','東京','大阪','学校','大学','図書館','公園','駅','病院'].includes(word.japanese)), 1011)
    const requirement = pick([
      { surface:'お金', reading:'おかね', english:'money' },
      { surface:'準備', reading:'じゅんび', english:'preparation' },
      { surface:'時間', reading:'じかん', english:'time' },
    ], 1012)
    if (!destination || !requirement) return null
    const destinationEnglish = englishPhrase(destination,'destination')
    const furigana=[wordPart(destination,'destination'),literalPart('へ','え'),literalPart('行く','いく','reason'),literalPart('とすれば、'),literalPart(requirement.surface,requirement.reading,'object'),literalPart('が'),literalPart('必要です。','ひつようです。')]
    return finish(furigana,`If we suppose you go to ${destinationEnglish}, you will need ${requirement.english}.`,{destination},{},'とすれば sets up a hypothetical premise and reasons from it.')
  }

  if (patternId === 'n1-12') {
    const scene = pick([
      { basis:'天気', basisReading:'てんき', result:'予定が変わります', resultReading:'よていがかわります', english:"Plans change according to the weather." },
      { basis:'成績', basisReading:'せいせき', result:'評価が決まります', resultReading:'ひょうかがきまります', english:"Evaluation is decided according to the grades." },
      { basis:'状況', basisReading:'じょうきょう', result:'対応が変わります', resultReading:'たいおうがかわります', english:"The response changes according to the situation." },
    ], 1021)
    if (!scene) return null
    const furigana=[literalPart(scene.basis,scene.basisReading,'reason'),literalPart('に応じて、','におうじて、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'に応じて marks a basis that a result varies with.')
  }

  if (patternId === 'n1-13') {
    const scene = pick([
      { clause:'高いものがいい', clauseReading:'たかいものがいい', english:'Expensive things are not necessarily good.' },
      { clause:'有名な店がおいしい', clauseReading:'ゆうめいなみせがおいしい', english:'A famous restaurant is not necessarily delicious.' },
      { clause:'頭がいい人が成功する', clauseReading:'あたまがいいひとがせいこうする', english:'Smart people do not necessarily succeed.' },
    ], 1031)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('とは','とわ'),literalPart('限りません。','かぎりません。')]
    return finish(furigana,scene.english,{},{},'とは限らない denies that a general rule always holds.')
  }

  if (patternId === 'n2-04') {
    const verb = pick(smallVerbPool, 1041)
    if (!verb) return null
    const furigana=[{text:verb.japanese,reading:verb.reading,slot:'verb'},literalPart('ことはありません。')]
    return finish(furigana,`There is no need to ${verb.english}.`,{},{verb:grammarSlot(`verb-${verb.id}-kotohanai`,`${verb.japanese}ことはありません`,verb.japanese,`${verb.reading}ことはありません`,`no need to ${verb.english}`,['no-need','koto-ha-nai'])},'ことはない attaches to the dictionary form and reassures that something is unnecessary.')
  }

  if (patternId === 'n1-05') {
    const scene = pick([
      { cause:'参加しない', causeReading:'さんかしない', result:'始まりません', resultReading:'はじまりません', english:'Unless you participate, it will not start.' },
      { cause:'試してみない', causeReading:'ためしてみない', result:'わかりません', resultReading:'わかりません', english:'Unless you try it, you will not know.' },
      { cause:'練習しない', causeReading:'れんしゅうしない', result:'上手になりません', resultReading:'じょうずになりません', english:'Unless you practice, you will not improve.' },
    ], 1051)
    if (!scene) return null
    const furigana=[literalPart(scene.cause,scene.causeReading,'reason'),literalPart('ことには、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'ないことには states that nothing else can happen until this precondition is met.')
  }

  if (patternId === 'n1-06') {
    const scene = pick([
      { start:'子供', startReading:'こども', end:'大人', endReading:'おとな', result:'みんな知っています', resultReading:'みんなしっています', english:'From children to adults, everyone knows it.' },
      { start:'朝', startReading:'あさ', end:'夜', endReading:'よる', result:'休みなく働きます', resultReading:'やすみなくはたらきます', english:'From morning to night, they work without rest.' },
      { start:'初心者', startReading:'しょしんしゃ', end:'上級者', endReading:'じょうきゅうしゃ', result:'誰でも楽しめます', resultReading:'だれでもたのしめます', english:'From beginners to advanced learners, anyone can enjoy it.' },
    ], 1061)
    if (!scene) return null
    const furigana=[literalPart(scene.start,scene.startReading,'reason'),literalPart('から'),literalPart(scene.end,scene.endReading,'object'),literalPart('に至るまで、','にいたるまで、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'に至るまで stretches a range out to an extreme endpoint.')
  }

  if (patternId === 'n1-07') {
    const scene = pick([
      { place:'日本', placeReading:'にほん', noun:'文化', nounReading:'ぶんか', english:'culture unique to Japan' },
      { place:'京都', placeReading:'きょうと', noun:'魅力', nounReading:'みりょく', english:'charm unique to Kyoto' },
      { place:'この店', placeReading:'このみせ', noun:'味', nounReading:'あじ', english:'a flavor unique to this restaurant' },
    ], 1071)
    if (!scene) return null
    const furigana=[literalPart(scene.place,scene.placeReading,'subject'),literalPart('ならではの'),literalPart(scene.noun,scene.nounReading,'object'),literalPart('です。')]
    return finish(furigana,capitalize(`this is ${scene.english}.`),{},{},'ならでは marks something only possible because of that specific place or thing.')
  }

  if (patternId === 'n1-08') {
    const scene = pick([
      { basis:'現実', basisReading:'げんじつ', result:'考えます', resultReading:'かんがえます', english:'think in accordance with reality' },
      { basis:'事実', basisReading:'じじつ', result:'判断します', resultReading:'はんだんします', english:'judge in accordance with the facts' },
      { basis:'規則', basisReading:'きそく', result:'行動します', resultReading:'こうどうします', english:'act in accordance with the rules' },
    ], 1081)
    if (!scene) return null
    const furigana=[literalPart(scene.basis,scene.basisReading,'reason'),literalPart('に即して、','にそくして、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,capitalize(`${scene.english}.`),{},{},'に即して means acting strictly on the basis of something concrete, not personal opinion.')
  }

  if (patternId === 'n1-09') {
    const scene = pick([
      { topic:'問題', topicReading:'もんだい', result:'議論します', resultReading:'ぎろんします', english:'discuss concerning the issue' },
      { topic:'予算', topicReading:'よさん', result:'対立します', resultReading:'たいりつします', english:'clash over the budget' },
      { topic:'契約', topicReading:'けいやく', result:'交渉します', resultReading:'こうしょうします', english:'negotiate concerning the contract' },
    ], 1091)
    if (!scene) return null
    const furigana=[literalPart(scene.topic,scene.topicReading,'object'),literalPart('をめぐって、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,capitalize(`they ${scene.english}.`),{},{},'をめぐって marks the contested topic that an action revolves around.')
  }

  if (patternId === 'n1-10') {
    const scene = pick([
      { event:'出発', eventReading:'しゅっぱつ', result:'挨拶します', resultReading:'あいさつします', english:'give a greeting on the occasion of departure' },
      { event:'卒業', eventReading:'そつぎょう', result:'感謝します', resultReading:'かんしゃします', english:'express gratitude on the occasion of graduation' },
      { event:'開会', eventReading:'かいかい', result:'演説します', resultReading:'えんぜつします', english:'give a speech on the occasion of the opening' },
    ], 1101)
    if (!scene) return null
    const furigana=[literalPart(scene.event,scene.eventReading,'reason'),literalPart('に際して、','にさいして、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,capitalize(`they ${scene.english}.`),{},{},'に際して marks a formal occasion that prompts the following action.')
  }

  return null
}

const n4PatternMeanings: Record<string,string> = {
  'n4-01':'want to do','n4-02':'ongoing action or resulting state','n4-03':'polite past action','n4-04':'polite negative action',
  'n4-05':'must do','n4-06':'permission to do','n4-07':'must not do','n4-08':'past experience','n4-09':'two simultaneous actions','n4-10':'begin doing',
}

const schoolAttendanceDestinationTags = new Set(normalizeTags(['school','high-school','university','classroom']))
const schoolAttendanceSubjectTags = new Set(normalizeTags(['student','child','teenager','boy','girl','son','daughter','pupil','classmate']))
const highSchoolAttendanceSubjectTags = new Set(normalizeTags(['student','teenager','boy','girl','son','daughter','pupil','classmate']))
const universityAttendanceSubjectTags = new Set(normalizeTags(['student','son','daughter','classmate']))
const obligationWakeTimeTags = new Set(normalizeTags(['clock-time','hour','wake-time']))
const permissionEatingLocationTags = new Set(normalizeTags(['restaurant','cafe','house','home','kitchen','dining-room','park','hotel','eating-location']))

function alignN4CrossSlotContext(
  patternId: string,
  verb: VerbUsageRecord,
  vocabulary: WordRecord[],
  result: { filled: Record<string,WordRecord>; slotTagMatches: Record<string,string[]> },
  seed: number,
) {
  if (patternId === 'n4-05' && verb.id === 'okiru-time') {
    const timeRule=verb.slots.time
    const candidates=vocabulary.filter(word=>{
      const tags=tagSet(word)
      return categoryMatch(word,timeRule.categories)
        && [...tags].some(tag=>obligationWakeTimeTags.has(tag))
        && !niIncompatibleTimeWords.has(word.japanese)
        && ![...tags].some(tag=>niIncompatibleTimeTags.has(tag))
    })
    if (!candidates.length) return false
    result.filled.time=seededPick(candidates,seed,95)
    result.slotTagMatches.time=matchingTags(result.filled.time,timeRule.tags)
  }
  if (patternId === 'n4-06' && verb.id === 'taberu-location') {
    const locationRule=verb.slots.location
    const candidates=vocabulary.filter(word=>{
      const tags=tagSet(word)
      return categoryMatch(word,locationRule.categories) && [...tags].some(tag=>permissionEatingLocationTags.has(tag))
    })
    if (!candidates.length) return false
    result.filled.location=seededPick(candidates,seed,96)
    result.slotTagMatches.location=matchingTags(result.filled.location,locationRule.tags)
  }
  if (patternId !== 'n4-10' || !verb.id.startsWith('iku-') || !result.filled.destination) return true
  const destinationTags=tagSet(result.filled.destination)
  if (![...destinationTags].some(tag=>schoolAttendanceDestinationTags.has(tag))) return true
  const allowedSubjectTags=destinationTags.has('university')
    ? universityAttendanceSubjectTags
    : destinationTags.has('high-school')
      ? highSchoolAttendanceSubjectTags
      : schoolAttendanceSubjectTags
  const subjectRule=verb.slots.subject
  const candidates=vocabulary.filter(word=>{
    const tags=tagSet(word)
    return categoryMatch(word,subjectRule.categories)
      && matchingTags(word,subjectRule.tags).length>0
      && [...tags].some(tag=>allowedSubjectTags.has(tag))
      && !politeSubjectIncompatibleWords.has(word.japanese)
  })
  if (!candidates.length) return false
  result.filled.subject=seededPick(candidates,seed,97)
  result.slotTagMatches.subject=matchingTags(result.filled.subject,subjectRule.tags)
  return true
}

function generateN4Nagara(seed: number,vocabulary: WordRecord[]): GeneratedPreviewSentence | null {
  const activityVerb=seededPick(verbs.filter(verb=>['taberu-basic','nomu-basic'].includes(verb.id)),seed,71)
  const mainVerb=seededPick(verbs.filter(verb=>['yomu-basic','miru-basic'].includes(verb.id)),seed,72)
  const mainResult=fillVerbSlots(mainVerb,vocabulary,seed,73)
  const activityResult=fillVerbSlots(activityVerb,vocabulary,seed,83)
  if (!mainResult || !activityResult) return null
  activityResult.filled.subject=mainResult.filled.subject!
  const activityForm=appendForm(n4VerbForms(activityVerb).masuStem,'ながら')
  const mainForm=n4VerbForms(mainVerb).masu
  const wordPart=(word: WordRecord,slot: string)=>({text:word.japanese,reading:kanaReading(word.reading,word.japanese),slot})
  const literalPart=(text: string,reading=text)=>({text,reading})
  const furigana: GeneratedPreviewSentence['furigana'] = [
    wordPart(mainResult.filled.subject!,'subject'),literalPart('は','わ'),wordPart(activityResult.filled.object!,'activityObject'),literalPart('を'),
    {text:activityForm.japanese,reading:kanaReading(activityForm.reading,activityForm.japanese),slot:'secondaryVerb'},
    wordPart(mainResult.filled.object!,'object'),literalPart('を'),{text:mainForm.japanese,reading:kanaReading(mainForm.reading,mainForm.japanese),slot:'verb'},
  ]
  const mainEnglish=renderTranslation(mainVerb.translationTemplate,mainVerb,mainResult.filled).replace(/\.$/,'')
  const activityObjectEnglish=activityResult.filled.object!.japanese==='ご飯' ? 'rice' : englishPhrase(activityResult.filled.object!,'object')
  const activityEnglish=`${presentParticiple(translatedVerb(activityVerb,activityResult.filled,true))} ${activityObjectEnglish}`
  const slots=generatedWordSlots(mainResult.filled,mainResult.slotTagMatches)
  slots.activityObject={...generatedWordSlots({activityObject:activityResult.filled.object!},{activityObject:activityResult.slotTagMatches.object ?? []}).activityObject!}
  slots.secondaryVerb={id:`verb-${activityVerb.id}`,surface:activityForm.japanese,dictionaryForm:activityVerb.japanese,reading:activityForm.reading,english:activityVerb.english,pos:'verb',jlpt:'N5',tags:[...activityVerb.tags,'grammar:n4-09'],conjugation:'masu-stem + ながら'}
  slots.verb={id:`verb-${mainVerb.id}`,surface:mainForm.japanese,dictionaryForm:mainVerb.japanese,reading:mainForm.reading,english:mainVerb.english,pos:'verb',jlpt:'N5',tags:[...mainVerb.tags,'grammar:n4-09'],conjugation:'masu'}
  return {
    frameId:'n4-09',level:'N4',japanese:furigana.map(part=>part.text).join(''),reading:furigana.map(part=>part.reading||part.text).join(''),
    english:`${mainEnglish} while ${activityEnglish}.`,slots,furigana,
    grammar:[{pattern:'〜ながら',meaning:n4PatternMeanings['n4-09']!,jlpt:'N4'}],
    validation:[`Activity verb selected: ${activityVerb.japanese}.`,`Main verb selected: ${mainVerb.japanese}.`,'Both verbs used their own category and tag rules.','Applied N4 masu-stem + ながら.'],
  }
}

function generateN4CategorySentence(seed: number,requestedPatternId?: string,options: CategorySentenceOptions={}): GeneratedPreviewSentence | null {
  const patternIds=Object.keys(n4PatternMeanings)
  const patternId=requestedPatternId && patternIds.includes(requestedPatternId) ? requestedPatternId : seededPick(patternIds,seed,61)
  const vocabulary=editorWords()
  if (patternId === 'n4-09') return generateN4Nagara(seed,vocabulary)
  let verbPool=verbs.filter(verb=>verb.id!=='yomu-adverb')
  const incompatibleVerbs: Record<string,Set<string>> = {
    // A context-free prohibition against waking up is grammatical but not a
    // useful generated sentence. Keep 起きる for desire, past, negative, and
    // obligation patterns where it has a natural interpretation.
    'n4-07':new Set(['okiru-time']),
    'n4-08':new Set(['okiru-time']),
    'n4-10':new Set(['okiru-time']),
  }
  const excluded=incompatibleVerbs[patternId]
  if (excluded) verbPool=verbPool.filter(verb=>!excluded.has(verb.id))
  if (options.verbId) verbPool=verbPool.filter(verb=>verb.id===options.verbId)
  if (!verbPool.length) return null
  const verb=seededPick(verbPool,seed,62)
  const result=fillVerbSlots(verb,vocabulary,seed,63,options)
  const form=n4SurfaceForm(patternId,verb)
  if (!result || !form) return null
  if (!alignN4CrossSlotContext(patternId,verb,vocabulary,result,seed)) return null
  const objectlessEatingProhibition=patternId==='n4-07' && verb.id==='taberu-location'
  if (objectlessEatingProhibition) {
    delete result.filled.object
    delete result.slotTagMatches.object
  }
  const furigana=objectlessEatingProhibition
    ? [
        {text:result.filled.subject!.japanese,reading:kanaReading(result.filled.subject!.reading,result.filled.subject!.japanese),slot:'subject'},
        {text:'は',reading:'わ'},
        {text:result.filled.location!.japanese,reading:kanaReading(result.filled.location!.reading,result.filled.location!.japanese),slot:'location'},
        {text:'で',reading:'で'},
        {text:form.japanese,reading:kanaReading(form.reading,form.japanese),slot:'verb'},
      ]
    : baseFurigana(verb,result.filled,form)
  if (!furigana) return null
  const slots=generatedWordSlots(result.filled,result.slotTagMatches)
  slots.verb={id:`verb-${verb.id}`,surface:form.japanese,dictionaryForm:verb.japanese,reading:form.reading,english:verb.english,pos:'verb',jlpt:'N5',tags:[...verb.tags,`base-pattern:${verb.sentencePattern}`,`grammar:${patternId}`],conjugation:patternId}
  let english=objectlessEatingProhibition
    ? `${englishPhrase(result.filled.subject!,'subject')} must not eat ${englishPhrase(result.filled.location!,'location')}.`
    : renderTranslation(verb.translationTemplate,verb,result.filled,n4EnglishVerb(patternId,verb,result.filled))
  english=english.charAt(0).toUpperCase()+english.slice(1)
  if (patternId === 'n4-08') english=english.replace(/\.$/,' before.')
  return {
    frameId:patternId,level:'N4',japanese:furigana.map(part=>part.text).join(''),reading:furigana.map(part=>part.reading||part.text).join(''),english,slots,furigana,
    grammar:[{pattern:patternId,meaning:n4PatternMeanings[patternId]!,jlpt:'N4'}],
    validation:[`Verb selected first: ${verb.japanese}.`,`Verb supplied base frame: ${verb.sentencePattern.toUpperCase()}.`,`Slots matched the verb's category and semantic-tag rules.`,objectlessEatingProhibition?'Omitted the food object so the prohibition applies to eating at the location.':`Applied executable N4 grammar: ${patternId.toUpperCase()}.`],
  }
}

export function generateCategorySentence(seed: number, requestedPatternId?: string, level: 'N5'|'N4'|'N3'|'N2'|'N1'='N5',options: CategorySentenceOptions={}): GeneratedPreviewSentence | null {
  if (requestedPatternId && advancedPatternIds.has(requestedPatternId)) return generateAdvancedCategorySentence(seed,requestedPatternId)
  if (level==='N2'||level==='N1') return null
  if (level==='N3'||requestedPatternId?.startsWith('n3-')) return requestedPatternId?generateN3CategorySentence(seed,requestedPatternId):null
  if (requestedPatternId && additionalN4PatternIds.has(requestedPatternId)) return additionalN4Sentence(seed,requestedPatternId,options)
  if (level === 'N4' || requestedPatternId?.startsWith('n4-')) return generateN4CategorySentence(seed,requestedPatternId,options)
  if (requestedPatternId && additionalN5PatternIds.has(requestedPatternId)) return additionalN5Sentence(seed,requestedPatternId,options)
  // A requested pattern limits the eligible records, but the executable unit is
  // still the verb: once chosen, its own pattern and slot rules drive the rest.
  const verbPool = requestedPatternId ? verbs.filter(verb => verb.sentencePattern === requestedPatternId) : verbs
  if (!verbPool.length) return null
  const verb = options.verbId
    ? verbPool.find(candidate => candidate.id === options.verbId)
    : seededPick(verbPool, seed, 1)
  if (!verb) return null
  const vocabulary = editorWords()
  const result = fillVerbSlots(verb,vocabulary,seed,2,options)
  if (!result) return null
  const { filled,slotTagMatches } = result
  const polite = conjugate(verb)
  const furigana = baseFurigana(verb,filled,polite)
  if (!furigana) return null
  const japanese=furigana.map(part=>part.text).join('')
  const reading=furigana.map(part=>part.reading || part.text).join('')
  const slots: GeneratedPreviewSentence['slots'] = Object.fromEntries(Object.entries(filled).map(([name,word]) => [name,{ id:word.id, surface:word.japanese, dictionaryForm:word.japanese, reading:word.reading, english:word.preferredTranslation, pos:name==='subject'||name==='companion'?'pronoun':name==='time'||name==='adverb'?'time_expression':name==='destination'||name==='location'?'place_expression':'noun', jlpt:word.jlpt ?? 'N5', tags:[`category:${word.categories.join('|')}`,...word.tags,...slotTagMatches[name].map(tag=>`matched:${tag}`)] }]))
  slots.verb = { id:`verb-${verb.id}`, surface:polite.japanese, dictionaryForm:verb.japanese, reading:polite.reading, english:verb.english, pos:'verb', jlpt:'N5', tags:[...verb.tags,`pattern:${verb.sentencePattern}`,`forms:${verb.supportedGrammarForms.join('|')}`], conjugation:'masu' }
  const semanticChecks = Object.entries(slotTagMatches).filter(([,tags])=>tags.length).map(([slot,tags])=>`${slot}: ${tags.join(', ')}`)
  const renderedEnglish=renderTranslation(verb.translationTemplate,verb,filled)
  const english=renderedEnglish.charAt(0).toUpperCase()+renderedEnglish.slice(1)
  return { frameId:verb.sentencePattern, level:'N5', japanese, reading, english, slots, furigana, grammar:[{pattern:verb.sentencePattern,meaning:'Verb-selected category and tag pattern',jlpt:'N5'}], validation:[`Verb selected first: ${verb.japanese}.`,`Verb selected pattern: ${verb.sentencePattern.toUpperCase()}.`,`Slots matched allowed categories${semanticChecks.length ? ` and semantic tags (${semanticChecks.join('; ')})` : ''}.`,`Supported forms: ${verb.supportedGrammarForms.join(', ')}.`] }
}
