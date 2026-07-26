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
  // godan-ku-iku models 行く specifically — its て/た forms (行って/行った) are
  // irregular. Every other class follows the regular rule for verbs ending in
  // that kana, including a real godan-ku for verbs like 書く (書いて/書いた).
  verbClass: 'ichidan' | 'godan-mu' | 'godan-su' | 'godan-ku' | 'godan-ku-iku' | 'godan-u' | 'godan-tsu' | 'godan-ru' | 'godan-nu' | 'godan-bu' | 'godan-gu' | 'irregular'
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
// Concrete, handleable things — excludes abstractions like それで/歴史/作品 that
// share a category with real tools but are not something you physically use.
const usableToolTags = ['tool','knife','scissors','electronics','computer','laptop','phone','tablet','camera','television','tv','pen','pencil','instrument']
// Concrete "things" broad enough for existence sentences (ある) — a union of
// several already-curated lists rather than a bare category, so abstract or
// junk-classified words never slip in the way an untagged category would.
const existenceObjectTags = [...usableToolTags,...readableTags,...watchableTags,...edibleTags,...drinkableTags,'clothing','shirt','coat','furniture','chair','table','desk','picture','photo','bag','box','bottle','cup','key']
// Words classified Animal all carry this single tag (see vocabularyClassifier.ts).
const animalSubjectTags = ['animal','dog','cat','bird','fish','pet']
// The current verb records describe human activities. Animals and plants need
// their own verb usages so that an otherwise valid category cannot create a
// sentence such as “a horse goes to university” or “a tree talks.”
const humanSubjectTags = ['person','pronoun','speaker','man','woman','boy','girl','baby','child','teenager','adult','elderly','human','family','mother','father','wife','husband','brother','sister','grandparent','grandchild','relative','friend','partner','classmate','coworker','neighbor','customer','boss','employee','occupation','teacher','student','doctor','nurse']
const standaloneDestinationTags = ['country','city','town','village','neighborhood','building','house','home','apartment','school','education','university','office','store','restaurant','cafe','hospital','hotel','library','museum','temple','shrine','church','bank','station','airport','park','forest','mountain','river','lake','beach','ocean','island','platform','parking-lot','room','kitchen','bathroom','bedroom','classroom','public','transport','destination']
// A subset of destinations you can walk into and be inside of. Open-air or
// natural places (mountains, forests, rivers) fit 行く/帰る but not 入る —
// nobody "enters" a mountain, they climb it.
const enterableDestinationTags = ['country','city','town','village','neighborhood','building','house','home','apartment','school','education','university','office','store','restaurant','cafe','hospital','hotel','library','museum','temple','shrine','church','bank','station','airport','platform','parking-lot','room','kitchen','bathroom','bedroom','classroom']
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
  { id:'iku-ni', japanese:'行く', reading:'いく', english:'go', englishThird:'goes', verbClass:'godan-ku-iku', sentencePattern:'n5-02', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','motion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'taberu-location', japanese:'食べる', reading:'たべる', english:'eat', englishThird:'eats', verbClass:'ichidan', sentencePattern:'n5-03', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','consumption','eating','ichidan','transitive','food'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:eatingLocationTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'hanasu-companion', japanese:'話す', reading:'はなす', english:'talk', englishThird:'talks', verbClass:'godan-su', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','speaking','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'okiru-time', japanese:'起きる', reading:'おきる', english:'wake up', englishThird:'wakes up', verbClass:'ichidan', sentencePattern:'n5-05', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Time}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','sleeping','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, time:{categories:['Time'],tags:wakeTimeTags} } },
  { id:'yomu-adverb', japanese:'読む', reading:'よむ', english:'read', englishThird:'reads', verbClass:'godan-mu', sentencePattern:'n5-09', subjectCategories:['Person'], objectCategories:['Object','Book','Document','Media'], translationTemplate:'{Subject} {Adverb} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','reading','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Book','Document','Media'],tags:readableTags}, adverb:{categories:['Adverb'],tags:readingMannerTags} } },
  { id:'iku-e', japanese:'行く', reading:'いく', english:'go', englishThird:'goes', verbClass:'godan-ku-iku', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','motion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'kau-basic', japanese:'買う', reading:'かう', english:'buy', englishThird:'buys', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','shopping','godan','transitive','food'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'tsukuru-basic', japanese:'作る', reading:'つくる', english:'make', englishThird:'makes', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cooking','godan','transitive','food'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'tsukau-basic', japanese:'使う', reading:'つかう', english:'use', englishThird:'uses', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'kaku-basic', japanese:'書く', reading:'かく', english:'write', englishThird:'writes', verbClass:'godan-ku', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Document'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','writing','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Document'],tags:readableTags} } },
  { id:'au-companion', japanese:'会う', reading:'あう', english:'meet', englishThird:'meets', verbClass:'godan-u', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','meeting','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'asobu-companion', japanese:'遊ぶ', reading:'あそぶ', english:'play', englishThird:'plays', verbClass:'godan-bu', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','leisure','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'matsu-basic', japanese:'待つ', reading:'まつ', english:'wait for', englishThird:'waits for', verbClass:'godan-tsu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','waiting','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kaeru-destination', japanese:'帰る', reading:'かえる', english:'return', englishThird:'returns', verbClass:'godan-ru', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','motion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'arau-basic', japanese:'洗う', reading:'あらう', english:'wash', englishThird:'washes', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Clothing'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Clothing']} } },
  { id:'tetsudau-basic', japanese:'手伝う', reading:'てつだう', english:'help', englishThird:'helps', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','helping','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kayou-destination', japanese:'通う', reading:'かよう', english:'commute', englishThird:'commutes', verbClass:'godan-u', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','routine','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'nomu-location', japanese:'飲む', reading:'のむ', english:'drink', englishThird:'drinks', verbClass:'godan-mu', sentencePattern:'n5-03', subjectCategories:['Person'], objectCategories:['Food','Drink'], translationTemplate:'{Subject} {Verb} {Object} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','consumption','drinking','godan','transitive','drink'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:eatingLocationTags}, object:{categories:['Food','Drink'],tags:drinkableTags} } },
  { id:'yomu-location', japanese:'読む', reading:'よむ', english:'read', englishThird:'reads', verbClass:'godan-mu', sentencePattern:'n5-03', subjectCategories:['Person'], objectCategories:['Object','Book','Document','Media'], translationTemplate:'{Subject} {Verb} {Object} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','reading','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:eatingLocationTags}, object:{categories:['Object','Book','Document','Media'],tags:readableTags} } },
  { id:'neru-time', japanese:'寝る', reading:'ねる', english:'sleep', englishThird:'sleeps', verbClass:'ichidan', sentencePattern:'n5-05', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Time}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','sleeping','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, time:{categories:['Time'],tags:wakeTimeTags} } },
  { id:'oyogu-time', japanese:'泳ぐ', reading:'およぐ', english:'swim', englishThird:'swims', verbClass:'godan-gu', sentencePattern:'n5-05', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Time}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','sports','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, time:{categories:['Time'],tags:wakeTimeTags} } },
  { id:'kaku-adverb', japanese:'書く', reading:'かく', english:'write', englishThird:'writes', verbClass:'godan-ku', sentencePattern:'n5-09', subjectCategories:['Person'], objectCategories:['Document'], translationTemplate:'{Subject} {Adverb} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','writing','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Document'],tags:readableTags}, adverb:{categories:['Adverb'],tags:readingMannerTags} } },
  { id:'uru-basic', japanese:'売る', reading:'うる', english:'sell', englishThird:'sells', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','commerce','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'motsu-basic', japanese:'持つ', reading:'もつ', english:'hold', englishThird:'holds', verbClass:'godan-tsu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','possession','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'hashiru-destination', japanese:'走る', reading:'はしる', english:'run', englishThird:'runs', verbClass:'godan-ru', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','sports','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'hairu-destination', japanese:'入る', reading:'はいる', english:'enter', englishThird:'enters', verbClass:'godan-ru', sentencePattern:'n5-02', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:enterableDestinationTags} } },
  { id:'toru-basic', japanese:'取る', reading:'とる', english:'take', englishThird:'takes', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'oku-basic', japanese:'置く', reading:'おく', english:'put', englishThird:'puts', verbClass:'godan-ku', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'sagasu-basic', japanese:'探す', reading:'さがす', english:'search for', englishThird:'searches for', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'mitsukeru-basic', japanese:'見つける', reading:'みつける', english:'find', englishThird:'finds', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'hirou-basic', japanese:'拾う', reading:'ひろう', english:'pick up', englishThird:'picks up', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'kariru-basic', japanese:'借りる', reading:'かりる', english:'borrow', englishThird:'borrows', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'kasu-basic', japanese:'貸す', reading:'かす', english:'lend', englishThird:'lends', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'harau-basic', japanese:'払う', reading:'はらう', english:'pay', englishThird:'pays', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Money'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','commerce','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Money'],tags:['money','currency','price','cost']} } },
  { id:'yaku-basic', japanese:'焼く', reading:'やく', english:'bake', englishThird:'bakes', verbClass:'godan-ku', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cooking','godan','transitive','food'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'sasou-basic', japanese:'誘う', reading:'さそう', english:'invite', englishThird:'invites', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'hakobu-basic', japanese:'運ぶ', reading:'はこぶ', english:'carry', englishThird:'carries', verbClass:'godan-bu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'deau-companion', japanese:'出会う', reading:'であう', english:'meet', englishThird:'meets', verbClass:'godan-u', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','meeting','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'tatakau-companion', japanese:'戦う', reading:'たたかう', english:'fight', englishThird:'fights', verbClass:'godan-u', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','conflict','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'noboru-destination', japanese:'登る', reading:'のぼる', english:'climb', englishThird:'climbs', verbClass:'godan-ru', sentencePattern:'n5-02', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:['mountain']} } },
  { id:'yasumu-time', japanese:'休む', reading:'やすむ', english:'rest', englishThird:'rests', verbClass:'godan-mu', sentencePattern:'n5-05', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Time}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, time:{categories:['Time'],tags:wakeTimeTags} } },
  { id:'kuru-destination', japanese:'来る', reading:'くる', english:'come', englishThird:'comes', verbClass:'irregular', sentencePattern:'n5-02', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'hataraku-location', japanese:'働く', reading:'はたらく', english:'work', englishThird:'works', verbClass:'godan-ku', sentencePattern:'n5-25', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','occupation','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'sumu-location', japanese:'住む', reading:'すむ', english:'live', englishThird:'lives', verbClass:'godan-mu', sentencePattern:'n5-26', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','living','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'tomaru-location', japanese:'泊まる', reading:'とまる', english:'stay', englishThird:'stays', verbClass:'godan-ru', sentencePattern:'n5-26', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','lodging','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:['hotel','house','home','apartment']} } },
  { id:'erabu-basic', japanese:'選ぶ', reading:'えらぶ', english:'choose', englishThird:'chooses', verbClass:'godan-bu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'oboeru-basic', japanese:'覚える', reading:'おぼえる', english:'memorize', englishThird:'memorizes', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Book','Document','Media'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Book','Document','Media'],tags:readableTags} } },
  { id:'wasureru-basic', japanese:'忘れる', reading:'わすれる', english:'forget', englishThird:'forgets', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'narau-basic', japanese:'習う', reading:'ならう', english:'learn', englishThird:'learns', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Book','Document','Media'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Book','Document','Media'],tags:readableTags} } },
  { id:'tomeru-basic', japanese:'止める', reading:'とめる', english:'stop', englishThird:'stops', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Vehicle','Tool','Technology'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Vehicle','Tool','Technology'],tags:['car','vehicle','bicycle','train','bus','machine','clock','engine']} } },
  { id:'akeru-basic', japanese:'開ける', reading:'あける', english:'open', englishThird:'opens', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object','Furniture'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object','Furniture'],tags:['door','window','box','bag','bottle','jar','suitcase']} } },
  { id:'shimeru-basic', japanese:'閉める', reading:'しめる', english:'close', englishThird:'closes', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object','Furniture'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object','Furniture'],tags:['door','window','box','bag','bottle','jar','suitcase']} } },
  { id:'hajimeru-basic', japanese:'始める', reading:'はじめる', english:'begin', englishThird:'begins', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Book','Document','Media','Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','time','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Book','Document','Media','Food'],tags:[...readableTags,...edibleTags]} } },
  { id:'wakareru-companion', japanese:'別れる', reading:'わかれる', english:'break up', englishThird:'breaks up', verbClass:'ichidan', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'modoru-destination', japanese:'戻る', reading:'もどる', english:'go back', englishThird:'goes back', verbClass:'godan-ru', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'tsutomeru-location', japanese:'勤める', reading:'つとめる', english:'work', englishThird:'works', verbClass:'ichidan', sentencePattern:'n5-25', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','occupation','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'naosu-basic', japanese:'直す', reading:'なおす', english:'fix', englishThird:'fixes', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Vehicle'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Vehicle'],tags:usableToolTags} } },
  { id:'kowasu-basic', japanese:'壊す', reading:'こわす', english:'break', englishThird:'breaks', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'migaku-basic', japanese:'磨く', reading:'みがく', english:'polish', englishThird:'polishes', verbClass:'godan-ku', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object'],tags:usableToolTags} } },
  { id:'kakeru-basic', japanese:'掛ける', reading:'かける', english:'hang', englishThird:'hangs', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Clothing','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Clothing','Object'],tags:['clothing','shirt','coat','hat','jacket','picture','photo','key','towel','bag']} } },
  { id:'nugu-basic', japanese:'脱ぐ', reading:'ぬぐ', english:'take off', englishThird:'takes off', verbClass:'godan-gu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Clothing'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Clothing']} } },
  { id:'kiru-wear-basic', japanese:'着る', reading:'きる', english:'wear', englishThird:'wears', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Clothing'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Clothing']} } },
  { id:'haku-basic', japanese:'履く', reading:'はく', english:'wear', englishThird:'wears', verbClass:'godan-ku', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Clothing'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Clothing']} } },
  { id:'kaburu-basic', japanese:'かぶる', reading:'かぶる', english:'wear', englishThird:'wears', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Clothing'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Clothing']} } },
  { id:'tsutsumu-basic', japanese:'包む', reading:'つつむ', english:'wrap', englishThird:'wraps', verbClass:'godan-mu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object'],tags:usableToolTags} } },
  { id:'naraberu-basic', japanese:'並べる', reading:'ならべる', english:'arrange', englishThird:'arranges', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object','Furniture'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object','Furniture'],tags:usableToolTags} } },
  { id:'sodateru-basic', japanese:'育てる', reading:'そだてる', english:'raise', englishThird:'raises', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Plant'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Plant']} } },
  { id:'tateru-basic', japanese:'建てる', reading:'たてる', english:'build', englishThird:'builds', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Building'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Building']} } },
  { id:'shiraberu-basic', japanese:'調べる', reading:'しらべる', english:'investigate', englishThird:'investigates', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object','Document'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object','Document'],tags:usableToolTags} } },
  { id:'yurusu-basic', japanese:'許す', reading:'ゆるす', english:'forgive', englishThird:'forgives', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'utagau-basic', japanese:'疑う', reading:'うたがう', english:'doubt', englishThird:'doubts', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'shinjiru-basic', japanese:'信じる', reading:'しんじる', english:'believe', englishThird:'believes', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kirau-basic', japanese:'嫌う', reading:'きらう', english:'dislike', englishThird:'dislikes', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','emotion','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'sasaeru-basic', japanese:'支える', reading:'ささえる', english:'support', englishThird:'supports', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'tasukeru-basic', japanese:'助ける', reading:'たすける', english:'save', englishThird:'saves', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'mamoru-basic', japanese:'守る', reading:'まもる', english:'protect', englishThird:'protects', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'otosu-basic', japanese:'落とす', reading:'おとす', english:'drop', englishThird:'drops', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object'],tags:usableToolTags} } },
  { id:'sawaru-basic', japanese:'触る', reading:'さわる', english:'touch', englishThird:'touches', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object'],tags:usableToolTags} } },
  { id:'osu-basic', japanese:'押す', reading:'おす', english:'push', englishThird:'pushes', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object'],tags:usableToolTags} } },
  { id:'hiku-basic', japanese:'引く', reading:'ひく', english:'pull', englishThird:'pulls', verbClass:'godan-ku', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object'],tags:usableToolTags} } },
  { id:'niru-basic', japanese:'煮る', reading:'にる', english:'boil', englishThird:'boils', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cooking','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'ageru-fry-basic', japanese:'揚げる', reading:'あげる', english:'fry', englishThird:'fries', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cooking','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'hiyasu-basic', japanese:'冷やす', reading:'ひやす', english:'chill', englishThird:'chills', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food','Drink'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cooking','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food','Drink'],tags:[...edibleTags,...drinkableTags]} } },
  { id:'atatameru-basic', japanese:'温める', reading:'あたためる', english:'warm up', englishThird:'warms up', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food','Drink'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cooking','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food','Drink'],tags:[...edibleTags,...drinkableTags]} } },
  { id:'wakasu-basic', japanese:'沸かす', reading:'わかす', english:'boil', englishThird:'boils', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Drink'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cooking','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Drink'],tags:drinkableTags} } },
  { id:'kesu-basic', japanese:'消す', reading:'けす', english:'turn off', englishThird:'turns off', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Technology','Tool'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Technology','Tool'],tags:usableToolTags} } },
  { id:'tsukeru-basic', japanese:'点ける', reading:'つける', english:'turn on', englishThird:'turns on', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Technology','Tool'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Technology','Tool'],tags:usableToolTags} } },
  { id:'katazukeru-basic', japanese:'片付ける', reading:'かたづける', english:'tidy up', englishThird:'tidies up', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object'],tags:usableToolTags} } },
  { id:'kaeru-change-basic', japanese:'変える', reading:'かえる', english:'change', englishThird:'changes', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object'],tags:usableToolTags} } },
  { id:'kuraberu-basic', japanese:'比べる', reading:'くらべる', english:'compare', englishThird:'compares', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object'],tags:usableToolTags} } },
  { id:'arasou-companion', japanese:'争う', reading:'あらそう', english:'compete', englishThird:'competes', verbClass:'godan-u', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','conflict','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'nigeru-destination', japanese:'逃げる', reading:'にげる', english:'flee', englishThird:'flees', verbClass:'ichidan', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'mukau-destination', japanese:'向かう', reading:'むかう', english:'head', englishThird:'heads', verbClass:'godan-u', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'suwaru-location', japanese:'座る', reading:'すわる', english:'sit', englishThird:'sits', verbClass:'godan-ru', sentencePattern:'n5-26', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','body','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Furniture'],tags:['chair','bench','sofa','stool']} } },
  { id:'tatsu-location', japanese:'立つ', reading:'たつ', english:'stand', englishThird:'stands', verbClass:'godan-tsu', sentencePattern:'n5-26', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','body','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'nemuru-time', japanese:'眠る', reading:'ねむる', english:'sleep', englishThird:'sleeps', verbClass:'godan-ru', sentencePattern:'n5-05', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Time}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, time:{categories:['Time'],tags:wakeTimeTags} } },
  { id:'suru-basic', japanese:'する', reading:'する', english:'do', englishThird:'does', verbClass:'irregular', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Activity'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','irregular','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Activity']} } },
  { id:'iru-existence', japanese:'いる', reading:'いる', english:'are', englishThird:'is', verbClass:'ichidan', sentencePattern:'n5-27', subjectCategories:['Person','Animal'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','existence','ichidan','intransitive'], slots:{ location:{categories:['Place','Building','Room'],tags:standaloneDestinationTags}, subject:{categories:['Person','Animal'],tags:[...humanSubjectTags,...animalSubjectTags]} } },
  { id:'aru-existence', japanese:'ある', reading:'ある', english:'are', englishThird:'is', verbClass:'godan-ru', sentencePattern:'n5-27', subjectCategories:['Object','Tool','Technology','Food','Drink','Book','Document','Media','Furniture','Clothing'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','existence','godan','intransitive'], slots:{ location:{categories:['Place','Building','Room'],tags:standaloneDestinationTags}, subject:{categories:['Object','Tool','Technology','Food','Drink','Book','Document','Media','Furniture','Clothing'],tags:existenceObjectTags} } },
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

// One entry per godan row. i/a are the ます-stem and ない-stem kana; te/ta are
// the て/た endings, which do not follow the same row as i/a (う・つ・る verbs
// all promote to った/って despite ending in different kana).
const godanEndings: Record<Exclude<VerbUsageRecord['verbClass'], 'ichidan' | 'irregular'>, { i: string; a: string; te: string; ta: string }> = {
  'godan-mu': { i:'み', a:'ま', te:'んで', ta:'んだ' },
  'godan-su': { i:'し', a:'さ', te:'して', ta:'した' },
  'godan-ku': { i:'き', a:'か', te:'いて', ta:'いた' },
  'godan-ku-iku': { i:'き', a:'か', te:'って', ta:'った' },
  'godan-gu': { i:'ぎ', a:'が', te:'いで', ta:'いだ' },
  'godan-u': { i:'い', a:'わ', te:'って', ta:'った' },
  'godan-tsu': { i:'ち', a:'た', te:'って', ta:'った' },
  'godan-ru': { i:'り', a:'ら', te:'って', ta:'った' },
  'godan-nu': { i:'に', a:'な', te:'んで', ta:'んだ' },
  'godan-bu': { i:'び', a:'ば', te:'んで', ta:'んだ' },
}

function conjugate(verb: VerbUsageRecord) {
  if (verb.verbClass === 'ichidan') return { japanese:verb.japanese.slice(0,-1)+'ます', reading:verb.reading.slice(0,-1)+'ます' }
  if (verb.verbClass === 'irregular') return irregularForms(verb).masu
  const endings = godanEndings[verb.verbClass].i + 'ます'
  return { japanese:verb.japanese.slice(0,-1)+endings, reading:verb.reading.slice(0,-1)+endings }
}

// する and 来る are the only two truly irregular Japanese verbs — neither fits
// the "slice one kana, append a row ending" logic every other class shares.
// する drops both kana of its ending; 来る keeps its kanji but changes the
// kanji's *reading* per form (くる → き/こ), which no suffix rule can express.
function irregularForms(verb: VerbUsageRecord): N4VerbForms {
  const isKuru = verb.japanese.endsWith('来る')
  const japaneseRoot = verb.japanese.slice(0, -2)
  const readingRoot = verb.reading.slice(0, -2)
  if (isKuru) {
    return {
      masu:{japanese:`${japaneseRoot}来ます`,reading:`${readingRoot}きます`},
      masuStem:{japanese:`${japaneseRoot}来`,reading:`${readingRoot}き`},
      te:{japanese:`${japaneseRoot}来て`,reading:`${readingRoot}きて`},
      ta:{japanese:`${japaneseRoot}来た`,reading:`${readingRoot}きた`},
      aStem:{japanese:`${japaneseRoot}来`,reading:`${readingRoot}こ`},
    }
  }
  return {
    masu:{japanese:`${japaneseRoot}します`,reading:`${readingRoot}します`},
    masuStem:{japanese:`${japaneseRoot}し`,reading:`${readingRoot}し`},
    te:{japanese:`${japaneseRoot}して`,reading:`${readingRoot}して`},
    ta:{japanese:`${japaneseRoot}した`,reading:`${readingRoot}した`},
    aStem:{japanese:`${japaneseRoot}し`,reading:`${readingRoot}し`},
  }
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
  // Academic subjects read as a field of study, not a countable item: “studied math”, not “studied a math”.
  'math','mathematics','history','grammar','pronunciation','science','literature','philosophy',
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
    return objectEnglish(gloss)
  }
  const taggedNoun = animateEnglishByTag.find(([tag]) => tags.has(tag))?.[1]
  if (taggedNoun) return objectEnglish(taggedNoun)
  if (/^family$/i.test(gloss)) return definite('family')
  // A subject slot is normally a person, but existence sentences (ある) also
  // put ordinary things there — 米 is uncountable ("rice is", not "a rice").
  return objectEnglish(taggedNoun ?? gloss)
}

function englishPhrase(word: WordRecord, slot: string) {
  const sentencePreferred = inferPreferredTranslation(word.japanese,word.english,word.reading)
  const gloss = primaryEnglishGloss(sentencePreferred || word.preferredTranslation?.trim() || word.english)
  const tags = tagSet(word)

  if (slot === 'subject') return animateEnglish(word, gloss)
  if (slot === 'companion' || slot === 'recipient') {
    const pronounByJapanese: Record<string,string> = { '私':'me','私自身':'me','俺':'me','僕':'me','我々':'us','私たち':'us','彼':'him','彼女':'her','彼ら':'them','あなた':'you','君':'you','お前':'you' }
    if (pronounByJapanese[word.japanese]) return pronounByJapanese[word.japanese]!
    const phrase=animateEnglish(word,gloss)
    const objectPronouns: Record<string,string> = { I:'me',we:'us',he:'him',she:'her',they:'them' }
    return objectPronouns[phrase] ?? phrase
  }
  if (slot === 'object' && word.japanese === '果物') return 'fruit'
  if (slot === 'object') {
    // A person as a direct object ("waits for you") still needs object-case
    // pronouns, not the indefinite article objectEnglish() adds to nouns.
    const pronounByJapanese: Record<string,string> = { '私':'me','私自身':'me','俺':'me','僕':'me','我々':'us','私たち':'us','彼':'him','彼女':'her','彼ら':'them','あなた':'you','君':'you','お前':'you' }
    if (pronounByJapanese[word.japanese]) return pronounByJapanese[word.japanese]!
    return objectEnglish(gloss)
  }
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
  const byJapanese: Record<string,string> = { '私':'my','私自身':'my','俺':'my','僕':'my','我々':'our','私たち':'our','あなた':'your','君':'your','お前':'your','彼':'his','彼女':'her','彼ら':'their' }
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
  // "are" is the base form for I/you/we/they everywhere else, but the copula
  // is the one English verb where "I" alone still needs its own form ("am").
  if ((verb.id === 'iru-existence' || verb.id === 'aru-existence') && useBase && filled.subject) {
    const subjectEnglish = englishPhrase(filled.subject,'subject')
    if (subjectEnglish === 'I') return 'am'
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

export function n4VerbForms(verb: VerbUsageRecord): N4VerbForms {
  if (verb.verbClass === 'irregular') return irregularForms(verb)
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
  const endings = godanEndings[verb.verbClass]
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
    // The classifier files any verb gloss under Activity right alongside real
    // する-compatible nouns like 買い物/料理/相談, and not every verb entry in
    // that bucket carries a reliable 'verb' tag (some come from an imported
    // source with its own tag set). Every Japanese verb dictionary form ends
    // in one of these hiragana; a real suru-noun essentially never does.
    if (verb.id === 'suru-basic' && slot === 'object') pool=pool.filter(word=>!/(?:[うくぐすつぬぶむる]|[てでたなければ])$/.test(word.japanese))
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
    'n5-25':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('location'),literalPart('で'),verbPart()],
    'n5-26':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('location'),literalPart('に'),verbPart()],
    'n5-27':()=>[wordPart('location'),literalPart('に'),wordPart('subject'),literalPart('が'),verbPart()],
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
  const irregular: Record<string,string> = { eat:'eaten',drink:'drunk',read:'read',watch:'watched',look:'looked',go:'gone',talk:'talked',wake:'woken',buy:'bought',make:'made',use:'used',write:'written',meet:'met' }
  return [irregular[head!] ?? `${head}ed`,...rest].join(' ')
}

function simplePast(phrase: string) {
  const [head,...rest]=phrase.split(' ')
  const irregular: Record<string,string> = { eat:'ate',drink:'drank',read:'read',watch:'watched',look:'looked',go:'went',talk:'talked',wake:'woke',buy:'bought',make:'made',use:'used',write:'wrote',meet:'met' }
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
const invalidObjectLexicalTags = new Set(normalizeTags(['verb','auxiliary-verb','particle','expression','adverb','i-adjective','na-adjective','requires-modifier','unclassified','pronoun','question-word','demonstrative','number','conjunction','interjection']))
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
  // Size, age, price, and physical-property descriptors — same compatible
  // categories as ookii/atarashii above, since they all describe a handleable thing.
  { id:'warui',japanese:'悪い',reading:'わるい',english:'bad',categories:['Object','Food','Book','Document','Media'] as SentenceCategory[] },
  { id:'chiisai',japanese:'小さい',reading:'ちいさい',english:'small',categories:['Object','Animal','Building','Room','Vehicle','Furniture','Technology'] as SentenceCategory[],physicalOnly:true },
  { id:'furui',japanese:'古い',reading:'ふるい',english:'old',categories:['Object','Tool','Technology','Vehicle','Clothing','Furniture','Book','Building'] as SentenceCategory[],physicalOnly:true },
  { id:'takai',japanese:'高い',reading:'たかい',english:'expensive',categories:['Object','Food','Building','Vehicle','Technology'] as SentenceCategory[],physicalOnly:true },
  { id:'yasui',japanese:'安い',reading:'やすい',english:'cheap',categories:['Object','Food','Building','Vehicle','Technology'] as SentenceCategory[],physicalOnly:true },
  { id:'nagai',japanese:'長い',reading:'ながい',english:'long',categories:['Object','Document','Book','Vehicle'] as SentenceCategory[],physicalOnly:true },
  { id:'mijikai',japanese:'短い',reading:'みじかい',english:'short',categories:['Object','Document','Book','Vehicle'] as SentenceCategory[],physicalOnly:true },
  { id:'ooi',japanese:'多い',reading:'おおい',english:'plentiful',categories:['Object','Food'] as SentenceCategory[] },
  { id:'sukunai',japanese:'少ない',reading:'すくない',english:'scarce',categories:['Object','Food'] as SentenceCategory[] },
  { id:'hiroi',japanese:'広い',reading:'ひろい',english:'spacious',categories:['Building','Room','Place','Furniture'] as SentenceCategory[] },
  { id:'semai',japanese:'狭い',reading:'せまい',english:'cramped',categories:['Building','Room','Place','Furniture'] as SentenceCategory[] },
  { id:'chikai',japanese:'近い',reading:'ちかい',english:'nearby',categories:['Place','Building'] as SentenceCategory[] },
  { id:'tooi',japanese:'遠い',reading:'とおい',english:'far',categories:['Place','Building'] as SentenceCategory[] },
  { id:'hayai-early',japanese:'早い',reading:'はやい',english:'early',categories:['Time'] as SentenceCategory[] },
  { id:'osoi',japanese:'遅い',reading:'おそい',english:'late',categories:['Time'] as SentenceCategory[] },
  { id:'hayai-fast',japanese:'速い',reading:'はやい',english:'fast',categories:['Vehicle','Technology','Animal'] as SentenceCategory[] },
  { id:'omoi',japanese:'重い',reading:'おもい',english:'heavy',categories:['Object','Furniture','Vehicle'] as SentenceCategory[] },
  { id:'karui',japanese:'軽い',reading:'かるい',english:'light',categories:['Object','Furniture','Vehicle'] as SentenceCategory[] },
  { id:'tsuyoi',japanese:'強い',reading:'つよい',english:'strong',categories:['Person','Animal'] as SentenceCategory[] },
  { id:'yowai',japanese:'弱い',reading:'よわい',english:'weak',categories:['Person','Animal'] as SentenceCategory[] },
  // Weather and temperature — split by whether the thing is felt in the air
  // (暑い/寒い/涼しい) or by touch (熱い/冷たい/暖かい).
  { id:'atsui-weather',japanese:'暑い',reading:'あつい',english:'hot',categories:['Weather'] as SentenceCategory[] },
  { id:'samui',japanese:'寒い',reading:'さむい',english:'cold',categories:['Weather'] as SentenceCategory[] },
  { id:'atsui-touch',japanese:'熱い',reading:'あつい',english:'hot',categories:['Food','Drink'] as SentenceCategory[] },
  { id:'tsumetai',japanese:'冷たい',reading:'つめたい',english:'cold',categories:['Food','Drink'] as SentenceCategory[] },
  { id:'atatakai',japanese:'暖かい',reading:'あたたかい',english:'warm',categories:['Weather','Food','Drink'] as SentenceCategory[] },
  { id:'suzushii',japanese:'涼しい',reading:'すずしい',english:'cool',categories:['Weather'] as SentenceCategory[] },
  // Appearance and color.
  { id:'akarui',japanese:'明るい',reading:'あかるい',english:'bright',categories:['Room','Place'] as SentenceCategory[] },
  { id:'kurai',japanese:'暗い',reading:'くらい',english:'dark',categories:['Room','Place'] as SentenceCategory[] },
  { id:'shiroi',japanese:'白い',reading:'しろい',english:'white',categories:['Object','Clothing','Animal'] as SentenceCategory[] },
  { id:'kuroi',japanese:'黒い',reading:'くろい',english:'black',categories:['Object','Clothing','Animal'] as SentenceCategory[] },
  { id:'akai',japanese:'赤い',reading:'あかい',english:'red',categories:['Object','Clothing'] as SentenceCategory[] },
  { id:'aoi',japanese:'青い',reading:'あおい',english:'blue',categories:['Object','Clothing'] as SentenceCategory[] },
  { id:'kiiroi',japanese:'黄色い',reading:'きいろい',english:'yellow',categories:['Object','Clothing'] as SentenceCategory[] },
  { id:'chairoi',japanese:'茶色い',reading:'ちゃいろい',english:'brown',categories:['Object','Clothing'] as SentenceCategory[] },
  { id:'marui',japanese:'丸い',reading:'まるい',english:'round',categories:['Object'] as SentenceCategory[] },
  { id:'shikakui',japanese:'四角い',reading:'しかくい',english:'square',categories:['Object'] as SentenceCategory[] },
  { id:'wakai',japanese:'若い',reading:'わかい',english:'young',categories:['Person','Animal'] as SentenceCategory[] },
  // Person traits and states.
  { id:'isogashii',japanese:'忙しい',reading:'いそがしい',english:'busy',categories:['Person'] as SentenceCategory[] },
  { id:'hima',japanese:'暇',reading:'ひま',english:'free',categories:['Person'] as SentenceCategory[] },
  { id:'yuumei',japanese:'有名',reading:'ゆうめい',english:'famous',categories:['Person','Place','Building'] as SentenceCategory[] },
  { id:'shizuka',japanese:'静か',reading:'しずか',english:'quiet',categories:['Place','Room','Person'] as SentenceCategory[] },
  { id:'nigiyaka',japanese:'にぎやか',reading:'にぎやか',english:'lively',categories:['Place','Room'] as SentenceCategory[] },
  { id:'kirei',japanese:'きれい',reading:'きれい',english:'pretty',categories:['Person','Object','Room','Place'] as SentenceCategory[] },
  { id:'genki',japanese:'元気',reading:'げんき',english:'energetic',categories:['Person'] as SentenceCategory[] },
  { id:'shinsetsu',japanese:'親切',reading:'しんせつ',english:'kind',categories:['Person'] as SentenceCategory[] },
  { id:'benri',japanese:'便利',reading:'べんり',english:'convenient',categories:['Object','Technology','Place'] as SentenceCategory[] },
  { id:'fuben',japanese:'不便',reading:'ふべん',english:'inconvenient',categories:['Object','Technology','Place'] as SentenceCategory[] },
  { id:'kantan',japanese:'簡単',reading:'かんたん',english:'easy',categories:['Book','Document','Media'] as SentenceCategory[] },
  { id:'muzukashii',japanese:'難しい',reading:'むずかしい',english:'difficult',categories:['Book','Document','Media'] as SentenceCategory[] },
  { id:'tsumaranai',japanese:'つまらない',reading:'つまらない',english:'boring',categories:['Book','Document','Media'] as SentenceCategory[] },
  { id:'tanoshii',japanese:'楽しい',reading:'たのしい',english:'fun',categories:['Media'] as SentenceCategory[] },
  { id:'ureshii',japanese:'嬉しい',reading:'うれしい',english:'happy',categories:['Person'] as SentenceCategory[] },
  { id:'kanashii',japanese:'悲しい',reading:'かなしい',english:'sad',categories:['Person'] as SentenceCategory[] },
  { id:'sabishii',japanese:'寂しい',reading:'さびしい',english:'lonely',categories:['Person'] as SentenceCategory[] },
  { id:'kowai',japanese:'怖い',reading:'こわい',english:'scary',categories:['Person','Media'] as SentenceCategory[] },
  { id:'itai',japanese:'痛い',reading:'いたい',english:'painful',categories:['Person'] as SentenceCategory[] },
  // Taste and texture.
  { id:'amai',japanese:'甘い',reading:'あまい',english:'sweet',categories:['Food','Drink'] as SentenceCategory[] },
  { id:'karai',japanese:'辛い',reading:'からい',english:'spicy',categories:['Food'] as SentenceCategory[] },
  { id:'nigai',japanese:'苦い',reading:'にがい',english:'bitter',categories:['Food','Drink'] as SentenceCategory[] },
  { id:'suppai',japanese:'酸っぱい',reading:'すっぱい',english:'sour',categories:['Food','Drink'] as SentenceCategory[] },
  { id:'mazui',japanese:'まずい',reading:'まずい',english:'unappetizing',categories:['Food','Drink'] as SentenceCategory[] },
  { id:'katai',japanese:'硬い',reading:'かたい',english:'hard',categories:['Object','Food'] as SentenceCategory[] },
  { id:'yawarakai',japanese:'柔らかい',reading:'やわらかい',english:'soft',categories:['Object','Food','Furniture'] as SentenceCategory[] },
  // Safety, importance, and abstract qualities.
  { id:'abunai',japanese:'危ない',reading:'あぶない',english:'dangerous',categories:['Place','Object','Vehicle'] as SentenceCategory[] },
  { id:'anzen',japanese:'安全',reading:'あんぜん',english:'safe',categories:['Place','Object','Vehicle'] as SentenceCategory[] },
  { id:'taisetsu',japanese:'大切',reading:'たいせつ',english:'important',categories:['Object','Person','Document'] as SentenceCategory[] },
  { id:'hitsuyou',japanese:'必要',reading:'ひつよう',english:'necessary',categories:['Object','Document'] as SentenceCategory[] },
  { id:'tokubetsu',japanese:'特別',reading:'とくべつ',english:'special',categories:['Object','Food','Event'] as SentenceCategory[] },
  { id:'futsuu',japanese:'普通',reading:'ふつう',english:'ordinary',categories:['Object','Person','Food'] as SentenceCategory[] },
  { id:'onaji',japanese:'同じ',reading:'おなじ',english:'the same',categories:['Object'] as SentenceCategory[] },
  { id:'tadashii',japanese:'正しい',reading:'ただしい',english:'correct',categories:['Document'] as SentenceCategory[] },
  { id:'utsukushii',japanese:'美しい',reading:'うつくしい',english:'beautiful',categories:['Person','Place','Object'] as SentenceCategory[] },
  { id:'kawaii',japanese:'かわいい',reading:'かわいい',english:'cute',categories:['Person','Animal','Object'] as SentenceCategory[] },
  { id:'kakkoii',japanese:'かっこいい',reading:'かっこいい',english:'cool',categories:['Person','Vehicle'] as SentenceCategory[] },
  { id:'kitanai',japanese:'汚い',reading:'きたない',english:'dirty',categories:['Place','Object','Room'] as SentenceCategory[] },
  { id:'seiketsu',japanese:'清潔',reading:'せいけつ',english:'clean',categories:['Room','Place','Object'] as SentenceCategory[] },
  { id:'yutaka',japanese:'豊か',reading:'ゆたか',english:'rich',categories:['Person','Place'] as SentenceCategory[] },
  { id:'mazushii',japanese:'貧しい',reading:'まずしい',english:'poor',categories:['Person','Place'] as SentenceCategory[] },
  { id:'shiawase',japanese:'幸せ',reading:'しあわせ',english:'happy',categories:['Person'] as SentenceCategory[] },
  { id:'fukou',japanese:'不幸',reading:'ふこう',english:'unhappy',categories:['Person'] as SentenceCategory[] },
  { id:'majime',japanese:'真面目',reading:'まじめ',english:'serious',categories:['Person'] as SentenceCategory[] },
  { id:'yasashii-kind',japanese:'優しい',reading:'やさしい',english:'kind',categories:['Person'] as SentenceCategory[] },
  { id:'kibishii',japanese:'厳しい',reading:'きびしい',english:'strict',categories:['Person'] as SentenceCategory[] },
  { id:'teinei',japanese:'丁寧',reading:'ていねい',english:'polite',categories:['Person'] as SentenceCategory[] },
  { id:'shitsurei',japanese:'失礼',reading:'しつれい',english:'rude',categories:['Person'] as SentenceCategory[] },
  { id:'rippa',japanese:'立派',reading:'りっぱ',english:'splendid',categories:['Object','Person','Building'] as SentenceCategory[] },
  { id:'fukuzatsu',japanese:'複雑',reading:'ふくざつ',english:'complex',categories:['Document','Object'] as SentenceCategory[] },
  { id:'tanjun',japanese:'単純',reading:'たんじゅん',english:'simple',categories:['Document','Object'] as SentenceCategory[] },
  { id:'juubun',japanese:'十分',reading:'じゅうぶん',english:'sufficient',categories:['Food','Object','Money'] as SentenceCategory[] },
  { id:'kanzen',japanese:'完全',reading:'かんぜん',english:'complete',categories:['Object','Document'] as SentenceCategory[] },
  { id:'jiyuu',japanese:'自由',reading:'じゆう',english:'free',categories:['Person'] as SentenceCategory[] },
  { id:'daijoubu',japanese:'大丈夫',reading:'だいじょうぶ',english:'okay',categories:['Person','Object'] as SentenceCategory[] },
  { id:'suki',japanese:'好き',reading:'すき',english:'likable',categories:['Food','Media','Person'] as SentenceCategory[] },
  { id:'kirai',japanese:'嫌い',reading:'きらい',english:'disliked',categories:['Food','Media','Person'] as SentenceCategory[] },
  { id:'jouzu',japanese:'上手',reading:'じょうず',english:'skillful',categories:['Person'] as SentenceCategory[] },
  { id:'heta',japanese:'下手',reading:'へた',english:'unskillful',categories:['Person'] as SentenceCategory[] },
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
    // あげる/渡す/送る/見せる give TO the recipient; もらう receives FROM them —
    // opposite direction, same Subject-Person(に)-Object(を) surface shape, so
    // one pattern still works with a per-verb preposition and English verb.
    const givingVerbs: Array<{ id:string; japanese:string; dictionary:string; reading:string; base:string; baseThird:string; tags:string[]; objectTags:Set<string>; preposition:'to'|'from' }> = [
      { id:'miseru', japanese:'見せます', dictionary:'見せる', reading:'みせます', base:'show', baseThird:'shows', tags:['transfer','showing','recipient-ni','transitive'], objectTags:showableObjectTags, preposition:'to' },
      { id:'ageru', japanese:'あげます', dictionary:'あげる', reading:'あげます', base:'give', baseThird:'gives', tags:['transfer','giving','recipient-ni','transitive'], objectTags:portableObjectTags, preposition:'to' },
      { id:'watasu', japanese:'渡します', dictionary:'渡す', reading:'わたします', base:'hand over', baseThird:'hands over', tags:['transfer','handing-over','recipient-ni','transitive'], objectTags:portableObjectTags, preposition:'to' },
      { id:'okuru-gift', japanese:'送ります', dictionary:'送る', reading:'おくります', base:'send', baseThird:'sends', tags:['transfer','sending','recipient-ni','transitive'], objectTags:portableObjectTags, preposition:'to' },
      { id:'morau', japanese:'もらいます', dictionary:'もらう', reading:'もらいます', base:'receive', baseThird:'receives', tags:['transfer','receiving','source-ni','transitive'], objectTags:portableObjectTags, preposition:'from' },
    ]
    const givingVerb=seededPick(givingVerbs,seed,190)
    const subject=pick(humans,191),recipient=pick(namedRecipients(humans).filter(word=>word.id!==subject?.id),192)
    if (!givingVerb || !subject || !recipient) return null
    const eligible=inanimate.filter(word=>[...tagSet(word)].some(tag=>givingVerb.objectTags.has(tag)) && !workplaceDocumentWords.has(word.japanese))
    const object=pick(eligible,193)
    if (!object) return null
    const subjectEnglish=englishPhrase(subject,'subject'),verbEnglish=subjectUsesBaseVerb(subjectEnglish)?givingVerb.base:givingVerb.baseThird
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(recipient,'recipient'),literalPart('に'),wordPart(object,'object'),literalPart('を'),{text:givingVerb.japanese,reading:givingVerb.reading,slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${verbEnglish} ${englishPhrase(object,'object')} ${givingVerb.preposition} ${relatedPersonEnglish('recipient',recipient,subject)}.`,{subject,recipient,object},{verb:verbSlot(`verb-${givingVerb.id}`,givingVerb.japanese,givingVerb.dictionary,givingVerb.reading,givingVerb.base,[...givingVerb.tags])},['Object matches the chosen verb\'s own transfer-object tags.','Recipient is a different person from the subject.'])
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
  'n2-03':'it has been decided that','n2-05':'must certainly be','n2-06':'expected or supposed to','n2-07':'general truth or recollection',
  'n2-08':'noun resembling another noun','n2-16':'should not do','n2-17':'it is not that (softened)','n2-18':'cannot do (polite refusal)',
  'n3-20':'I think that','n3-21':'apparently (hearsay)','n3-22':'I heard that (hearsay)','n3-23':'seems (own judgment)',
  'n3-24':'more than (comparison)','n3-25':'not as much as','n3-26':'only',
  'n3-27':'if it is the case that','n3-28':'whenever (automatic result)','n3-29':'things like (informal listing)','n3-30':'and (partial listing)','n3-31':'try doing',
  'n2-19':'despite','n2-20':'even though (critical)','n2-21':'far from',
  'n3-32':'during (the whole span)','n3-33':'no longer do','n3-34':'to the extent that (degree)','n3-35':'only / nothing but (habitual)',
  'n3-36':'so much that','n3-37':'say that (quotation)','n3-38':'looks like (appearance)','n3-39':'please do not',
  'n2-22':'the moment that','n2-23':'as soon as','n2-24':'ever since','n2-25':'after doing (as a basis)',
  'n2-26':'right in the middle of','n2-27':'because (excuse-giving)','n2-28':'there is a risk of','n2-29':'judging from / because',
  'n2-30':'though (formal contrast)','n2-31':'although (concessive)','n2-32':'as long as','n2-33':'compared with',
  'n2-34':'toward / in response to','n2-35':'even (formal emphasis)','n2-36':'there is no way that','n2-37':'try to / be about to',
}

// N2/N1 grammar overwhelmingly attaches to abstract concepts (理由, 結果,
// 状況…), not the concrete Food/Object/Place nouns the base engine's category
// pools are built from — にほかならない or ものだ said of a physical object
// reads as broken as it would in English. Rather than each advanced pattern
// hand-typing its own 3-5 word list (43 separate `exact()` calls existed
// before this), they can now share this one curated pool.
export const abstractConcepts: Array<{ id:string; japanese:string; reading:string; english:string }> = [
  { id:'imi', japanese:'意味', reading:'いみ', english:'meaning' },
  { id:'riyuu', japanese:'理由', reading:'りゆう', english:'reason' },
  { id:'kangae', japanese:'考え', reading:'かんがえ', english:'thought' },
  { id:'iken', japanese:'意見', reading:'いけん', english:'opinion' },
  { id:'chishiki', japanese:'知識', reading:'ちしき', english:'knowledge' },
  { id:'jouhou', japanese:'情報', reading:'じょうほう', english:'information' },
  { id:'jijitsu', japanese:'事実', reading:'じじつ', english:'fact' },
  { id:'mondai', japanese:'問題', reading:'もんだい', english:'problem' },
  { id:'houhou', japanese:'方法', reading:'ほうほう', english:'method' },
  { id:'kekka', japanese:'結果', reading:'けっか', english:'result' },
  { id:'gen-in', japanese:'原因', reading:'げんいん', english:'cause' },
  { id:'mokuteki', japanese:'目的', reading:'もくてき', english:'purpose' },
  { id:'keikaku', japanese:'計画', reading:'けいかく', english:'plan' },
  { id:'yotei', japanese:'予定', reading:'よてい', english:'schedule' },
  { id:'yume', japanese:'夢', reading:'ゆめ', english:'dream' },
  { id:'kibou', japanese:'希望', reading:'きぼう', english:'hope' },
  { id:'mokuhyou', japanese:'目標', reading:'もくひょう', english:'goal' },
  { id:'seikou', japanese:'成功', reading:'せいこう', english:'success' },
  { id:'shippai', japanese:'失敗', reading:'しっぱい', english:'failure' },
  { id:'keiken', japanese:'経験', reading:'けいけん', english:'experience' },
  { id:'doryoku', japanese:'努力', reading:'どりょく', english:'effort' },
  { id:'seikaku', japanese:'性格', reading:'せいかく', english:'personality' },
  { id:'kimochi', japanese:'気持ち', reading:'きもち', english:'feeling' },
  { id:'kanjou', japanese:'感情', reading:'かんじょう', english:'emotion' },
  { id:'ai', japanese:'愛', reading:'あい', english:'love' },
  { id:'koi', japanese:'恋', reading:'こい', english:'romance' },
  { id:'yuujou', japanese:'友情', reading:'ゆうじょう', english:'friendship' },
  { id:'shinrai', japanese:'信頼', reading:'しんらい', english:'trust' },
  { id:'sonkei', japanese:'尊敬', reading:'そんけい', english:'respect' },
  { id:'yuuki', japanese:'勇気', reading:'ゆうき', english:'courage' },
  { id:'yorokobi', japanese:'喜び', reading:'よろこび', english:'joy' },
  { id:'tanoshimi', japanese:'楽しみ', reading:'たのしみ', english:'anticipation' },
  { id:'kanashimi', japanese:'悲しみ', reading:'かなしみ', english:'sorrow' },
  { id:'ikari', japanese:'怒り', reading:'いかり', english:'anger' },
  { id:'fuan', japanese:'不安', reading:'ふあん', english:'anxiety' },
  { id:'kyoufu', japanese:'恐怖', reading:'きょうふ', english:'fear' },
  { id:'kitai', japanese:'期待', reading:'きたい', english:'expectation' },
  { id:'shinpai', japanese:'心配', reading:'しんぱい', english:'worry' },
  { id:'anshin', japanese:'安心', reading:'あんしん', english:'peace of mind' },
  { id:'kinchou', japanese:'緊張', reading:'きんちょう', english:'tension' },
  { id:'kyoumi', japanese:'興味', reading:'きょうみ', english:'interest' },
  { id:'kanshin', japanese:'関心', reading:'かんしん', english:'concern' },
  { id:'inshou', japanese:'印象', reading:'いんしょう', english:'impression' },
  { id:'kioku', japanese:'記憶', reading:'きおく', english:'memory' },
  { id:'omoide', japanese:'思い出', reading:'おもいで', english:'memory' },
  { id:'kikai', japanese:'機会', reading:'きかい', english:'opportunity' },
  { id:'baai', japanese:'場合', reading:'ばあい', english:'case' },
  { id:'joukyou', japanese:'状況', reading:'じょうきょう', english:'situation' },
  { id:'joutai', japanese:'状態', reading:'じょうたい', english:'condition' },
  { id:'henka', japanese:'変化', reading:'へんか', english:'change' },
  { id:'seichou', japanese:'成長', reading:'せいちょう', english:'growth' },
  { id:'hatten', japanese:'発展', reading:'はってん', english:'development' },
  { id:'shinpo', japanese:'進歩', reading:'しんぽ', english:'progress' },
  { id:'sekinin', japanese:'責任', reading:'せきにん', english:'responsibility' },
  { id:'gimu', japanese:'義務', reading:'ぎむ', english:'duty' },
  { id:'kenri', japanese:'権利', reading:'けんり', english:'right' },
  { id:'kisoku', japanese:'規則', reading:'きそく', english:'rule' },
  { id:'dentou', japanese:'伝統', reading:'でんとう', english:'tradition' },
  { id:'kachi', japanese:'価値', reading:'かち', english:'value' },
  { id:'rieki', japanese:'利益', reading:'りえき', english:'profit' },
  { id:'sonshitsu', japanese:'損失', reading:'そんしつ', english:'loss' },
  { id:'shuunyuu', japanese:'収入', reading:'しゅうにゅう', english:'income' },
  { id:'shishutsu', japanese:'支出', reading:'ししゅつ', english:'expenditure' },
]

// Degree, frequency, time, manner, and discourse adverbs for advanced
// patterns to draw from — the mimetic/onomatopoeia words from the source list
// (にこにこ, わくわく, きらきら…) are left out: they gloss awkwardly in
// isolation and matter far less to N2/N1 grammar than degree and discourse
// adverbs do.
export const adverbPool: Array<{ id:string; japanese:string; reading:string; english:string }> = [
  // Degree
  { id:'totemo', japanese:'とても', reading:'とても', english:'very' },
  { id:'kanari', japanese:'かなり', reading:'かなり', english:'considerably' },
  { id:'sukoshi', japanese:'少し', reading:'すこし', english:'a little' },
  { id:'chotto', japanese:'ちょっと', reading:'ちょっと', english:'a bit' },
  { id:'motto', japanese:'もっと', reading:'もっと', english:'more' },
  { id:'zutto', japanese:'ずっと', reading:'ずっと', english:'by far' },
  { id:'amari', japanese:'あまり', reading:'あまり', english:'not very' },
  { id:'hotondo', japanese:'ほとんど', reading:'ほとんど', english:'almost' },
  { id:'zenzen', japanese:'全然', reading:'ぜんぜん', english:'not at all' },
  { id:'sugoku', japanese:'すごく', reading:'すごく', english:'incredibly' },
  { id:'hijouni', japanese:'非常に', reading:'ひじょうに', english:'extremely' },
  { id:'kiwamete', japanese:'極めて', reading:'きわめて', english:'exceedingly' },
  { id:'hikakuteki', japanese:'比較的', reading:'ひかくてき', english:'relatively' },
  { id:'soutou', japanese:'相当', reading:'そうとう', english:'considerably' },
  { id:'tashou', japanese:'多少', reading:'たしょう', english:'somewhat' },
  { id:'hobo', japanese:'ほぼ', reading:'ほぼ', english:'nearly' },
  { id:'zenbu', japanese:'全部', reading:'ぜんぶ', english:'entirely' },
  { id:'subete', japanese:'全て', reading:'すべて', english:'entirely' },
  { id:'hanbun', japanese:'半分', reading:'はんぶん', english:'halfway' },
  { id:'kanzenni', japanese:'完全に', reading:'かんぜんに', english:'completely' },
  { id:'juubunni', japanese:'十分に', reading:'じゅうぶんに', english:'sufficiently' },
  { id:'sukoshizutsu', japanese:'少しずつ', reading:'すこしずつ', english:'little by little' },
  { id:'dandan', japanese:'だんだん', reading:'だんだん', english:'gradually' },
  { id:'masumasu', japanese:'ますます', reading:'ますます', english:'increasingly' },
  { id:'sarani', japanese:'さらに', reading:'さらに', english:'furthermore' },
  { id:'mattaku', japanese:'まったく', reading:'まったく', english:'entirely' },
  { id:'sukkari', japanese:'すっかり', reading:'すっかり', english:'completely' },
  { id:'sappari', japanese:'さっぱり', reading:'さっぱり', english:'not at all' },
  // Frequency
  { id:'yoku', japanese:'よく', reading:'よく', english:'often' },
  { id:'itsumo', japanese:'いつも', reading:'いつも', english:'always' },
  { id:'mainichi', japanese:'毎日', reading:'まいにち', english:'every day' },
  { id:'maishuu', japanese:'毎週', reading:'まいしゅう', english:'every week' },
  { id:'maitsuki', japanese:'毎月', reading:'まいつき', english:'every month' },
  { id:'mainen', japanese:'毎年', reading:'まいねん', english:'every year' },
  { id:'tokidoki', japanese:'時々', reading:'ときどき', english:'sometimes' },
  { id:'tamani', japanese:'たまに', reading:'たまに', english:'occasionally' },
  { id:'shibashiba', japanese:'しばしば', reading:'しばしば', english:'frequently' },
  { id:'hinpanni', japanese:'頻繁に', reading:'ひんぱんに', english:'frequently' },
  { id:'taitei', japanese:'たいてい', reading:'たいてい', english:'usually' },
  // Time
  { id:'sakini', japanese:'先に', reading:'さきに', english:'ahead of time' },
  { id:'atode', japanese:'あとで', reading:'あとで', english:'later' },
  { id:'mou', japanese:'もう', reading:'もう', english:'already' },
  { id:'mada', japanese:'まだ', reading:'まだ', english:'still' },
  { id:'sugu', japanese:'すぐ', reading:'すぐ', english:'right away' },
  { id:'mamonaku', japanese:'まもなく', reading:'まもなく', english:'shortly' },
  { id:'yatto', japanese:'やっと', reading:'やっと', english:'finally' },
  { id:'youyaku', japanese:'ようやく', reading:'ようやく', english:'at last' },
  { id:'totsuzen', japanese:'突然', reading:'とつぜん', english:'suddenly' },
  { id:'kyuuni', japanese:'急に', reading:'きゅうに', english:'suddenly' },
  { id:'mukashi', japanese:'昔', reading:'むかし', english:'long ago' },
  { id:'saikin', japanese:'最近', reading:'さいきん', english:'recently' },
  { id:'izen', japanese:'以前', reading:'いぜん', english:'previously' },
  { id:'saishoni', japanese:'最初に', reading:'さいしょに', english:'at first' },
  { id:'saigoni', japanese:'最後に', reading:'さいごに', english:'lastly' },
  { id:'doujini', japanese:'同時に', reading:'どうじに', english:'simultaneously' },
  { id:'tsuneni', japanese:'常に', reading:'つねに', english:'constantly' },
  { id:'futatabi', japanese:'再び', reading:'ふたたび', english:'once again' },
  { id:'mouichido', japanese:'もう一度', reading:'もういちど', english:'one more time' },
  { id:'nandomo', japanese:'何度も', reading:'なんども', english:'many times' },
  { id:'itsuka', japanese:'いつか', reading:'いつか', english:'someday' },
  { id:'toutou', japanese:'とうとう', reading:'とうとう', english:'finally' },
  { id:'tsuini', japanese:'ついに', reading:'ついに', english:'at last' },
  { id:'kekkyoku', japanese:'結局', reading:'けっきょく', english:'in the end' },
  { id:'ikinari', japanese:'いきなり', reading:'いきなり', english:'abruptly' },
  // Manner
  { id:'yukkuri', japanese:'ゆっくり', reading:'ゆっくり', english:'slowly' },
  { id:'isoide', japanese:'急いで', reading:'いそいで', english:'hurriedly' },
  { id:'hayaku', japanese:'速く', reading:'はやく', english:'quickly' },
  { id:'osoku', japanese:'遅く', reading:'おそく', english:'slowly' },
  { id:'shizukani', japanese:'静かに', reading:'しずかに', english:'quietly' },
  { id:'ookiku', japanese:'大きく', reading:'おおきく', english:'largely' },
  { id:'chiisaku', japanese:'小さく', reading:'ちいさく', english:'in a small way' },
  { id:'tsuyoku', japanese:'強く', reading:'つよく', english:'strongly' },
  { id:'yowaku', japanese:'弱く', reading:'よわく', english:'weakly' },
  { id:'yasashiku', japanese:'優しく', reading:'やさしく', english:'gently' },
  { id:'teineini', japanese:'丁寧に', reading:'ていねいに', english:'carefully' },
  { id:'kantanni', japanese:'簡単に', reading:'かんたんに', english:'easily' },
  { id:'rakuni', japanese:'楽に', reading:'らくに', english:'comfortably' },
  { id:'jiyuuni', japanese:'自由に', reading:'じゆうに', english:'freely' },
  { id:'shizenni', japanese:'自然に', reading:'しぜんに', english:'naturally' },
  { id:'shinkenni', japanese:'真剣に', reading:'しんけんに', english:'seriously' },
  { id:'isshoukenmei', japanese:'一生懸命', reading:'いっしょうけんめい', english:'as hard as possible' },
  { id:'isshoni', japanese:'一緒に', reading:'いっしょに', english:'together' },
  { id:'betsubetsuni', japanese:'別々に', reading:'べつべつに', english:'separately' },
  { id:'jibunde', japanese:'自分で', reading:'じぶんで', english:'by oneself' },
  { id:'tagaini', japanese:'互いに', reading:'たがいに', english:'mutually' },
  { id:'junbanni', japanese:'順番に', reading:'じゅんばんに', english:'in order' },
  { id:'tsugitsugini', japanese:'次々に', reading:'つぎつぎに', english:'one after another' },
  { id:'hakkiri', japanese:'はっきり', reading:'はっきり', english:'clearly' },
  { id:'shikkari', japanese:'しっかり', reading:'しっかり', english:'firmly' },
  { id:'kichinto', japanese:'きちんと', reading:'きちんと', english:'properly' },
  // Discourse and logical connectors
  { id:'hontouni', japanese:'本当に', reading:'ほんとうに', english:'truly' },
  { id:'jitsuwa', japanese:'実は', reading:'じつは', english:'actually' },
  { id:'tashikani', japanese:'確かに', reading:'たしかに', english:'certainly' },
  { id:'mochiron', japanese:'もちろん', reading:'もちろん', english:'of course' },
  { id:'tabun', japanese:'たぶん', reading:'たぶん', english:'probably' },
  { id:'kitto', japanese:'きっと', reading:'きっと', english:'surely' },
  { id:'osoraku', japanese:'おそらく', reading:'おそらく', english:'perhaps' },
  { id:'zehi', japanese:'ぜひ', reading:'ぜひ', english:'by all means' },
  { id:'kanarazu', japanese:'必ず', reading:'かならず', english:'without fail' },
  { id:'zettaini', japanese:'絶対に', reading:'ぜったいに', english:'absolutely' },
  { id:'kesshite', japanese:'決して', reading:'けっして', english:'never' },
  { id:'tatoeba', japanese:'例えば', reading:'たとえば', english:'for example' },
  { id:'tsumari', japanese:'つまり', reading:'つまり', english:'in other words' },
  { id:'yougo', japanese:'要するに', reading:'ようするに', english:'in short' },
  { id:'tokuni', japanese:'特に', reading:'とくに', english:'especially' },
  { id:'ippanni', japanese:'一般に', reading:'いっぱんに', english:'generally' },
  { id:'jissaini', japanese:'実際に', reading:'じっさいに', english:'in reality' },
  { id:'omoni', japanese:'主に', reading:'おもに', english:'mainly' },
  { id:'igaini', japanese:'意外に', reading:'いがいに', english:'unexpectedly' },
  { id:'jitsuni', japanese:'実に', reading:'じつに', english:'truly' },
]

const advancedPatternIds = new Set([
  'n2-01', 'n2-02', 'n2-09', 'n1-01', 'n1-02', 'n3-11', 'n3-12', 'n3-13', 'n3-14', 'n3-15', 'n2-10',
  'n3-16', 'n3-17', 'n3-18', 'n3-19', 'n2-11', 'n1-03', 'n1-04',
  'n2-12', 'n2-13', 'n2-14', 'n2-15', 'n1-11', 'n1-12', 'n1-13',
  'n2-04', 'n1-05', 'n1-06', 'n1-07', 'n1-08', 'n1-09', 'n1-10',
  'n2-03', 'n2-05', 'n2-06', 'n2-07', 'n2-08', 'n2-16', 'n2-17', 'n2-18',
  'n3-20', 'n3-21', 'n3-22', 'n3-23', 'n3-24', 'n3-25', 'n3-26',
  'n3-27', 'n3-28', 'n3-29', 'n3-30', 'n3-31', 'n2-19', 'n2-20', 'n2-21',
  'n3-32', 'n3-33', 'n3-34', 'n3-35', 'n3-36', 'n3-37', 'n3-38', 'n3-39',
  'n2-22', 'n2-23', 'n2-24', 'n2-25', 'n2-26', 'n2-27', 'n2-28', 'n2-29',
  'n2-30', 'n2-31', 'n2-32', 'n2-33', 'n2-34', 'n2-35', 'n2-36', 'n2-37',
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
  // matsu-basic is excluded here: "wait for" reads as a dangling preposition in
  // these verb-only contexts, which never supply the object its gloss needs.
  // tsukau-basic (use) is excluded for the same reason — "just used." / "cannot
  // afford to use." reads broken in English even though 使う alone is fine in
  // Japanese; the other transitive verbs here have idiomatic bare-object
  // readings in English ("I already ate", "I already wrote") that use lacks.
  const smallVerbPool = verbs.filter(verb => [
    'iku-e','hanasu-companion','yomu-basic','nomu-basic','taberu-basic','miru-basic','okiru-time',
    'kau-basic','tsukuru-basic','kaku-basic','au-companion','asobu-companion','kaeru-destination','arau-basic',
  ].includes(verb.id))

  if (patternId === 'n2-09') {
    type Variant = { furigana: GeneratedPreviewSentence['furigana']; filled: Record<string,WordRecord>; english: string; note: string }
    const variants: Variant[] = []
    const readable = exact(['漢字','本','新聞','小説','記事'])
    const readingTarget = pick(readable, 801)
    const effort = pick([
      { surface:'勉強します', reading:'べんきょうします', english:'study' },
      { surface:'練習します', reading:'れんしゅうします', english:'practice' },
      { surface:'努力します', reading:'どりょくします', english:'make an effort' },
    ], 802)
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
    const verb = pick(smallVerbPool, 811)
    const subject = pick(humans, 812)
    const reason = pick([
      { surface:'ルールなので、', reading:'るーるなので、', english:'Since it is the rule' },
      { surface:'約束なので、', reading:'やくそくなので、', english:'Since it is a promise' },
      { surface:'仕事なので、', reading:'しごとなので、', english:'Since it is work' },
      { surface:'責任なので、', reading:'せきにんなので、', english:'Since it is a responsibility' },
      { surface:'義務なので、', reading:'ぎむなので、', english:'Since it is a duty' },
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
      { surface:'発展', reading:'はってん', english:'development' },
      { surface:'成長', reading:'せいちょう', english:'growth' },
    ], 821)
    const cause = pick([
      { surface:'努力', reading:'どりょく', english:'effort' },
      { surface:'準備', reading:'じゅんび', english:'preparation' },
      { surface:'練習', reading:'れんしゅう', english:'practice' },
      { surface:'経験', reading:'けいけん', english:'experience' },
      { surface:'信頼', reading:'しんらい', english:'trust' },
    ], 822)
    const tail = pick([{ surface:'結果', reading:'けっか', english:'result' }, { surface:'成果', reading:'せいか', english:'fruit' }], 823)
    if (!subject || !cause || !tail) return null
    const furigana=[literalPart(subject.surface,subject.reading,'subject'),literalPart('は','わ'),literalPart(cause.surface,cause.reading,'cause'),literalPart('の'),literalPart(tail.surface,tail.reading,'object'),literalPart('にほかならない。')]
    return finish(furigana,`${capitalize(subject.english)} is nothing other than the ${tail.english} of ${cause.english}.`,{},{},'にほかならない equates a result with its single true cause.')
  }

  if (patternId === 'n2-01') {
    type Variant = { furigana: GeneratedPreviewSentence['furigana']; filled: Record<string,WordRecord>; english: string }
    const variants: Variant[] = []
    const dislikable = vocabulary.filter(word => categoryMatch(word,['Food']) && matchingTags(word,edibleTags).length>0)
    const dislikeObject = pick(dislikable, 831)
    if (dislikeObject) variants.push({
      furigana:[wordPart(dislikeObject,'object'),literalPart('が'),literalPart('嫌い','きらい','predicate'),literalPart('な'),literalPart('わけではありません。')],
      filled:{object:dislikeObject},english:`It is not that I dislike ${englishPhrase(dislikeObject,'object')}.`,
    })
    const habitVerb = pick(smallVerbPool, 832)
    // "always"/"constantly" read naturally before the verb; "every day/week/year"
    // read naturally after it — English frequency adverbs don't share one slot.
    const habitualFrequencies = [
      { id:'itsumo', japanese:'いつも', reading:'いつも', preposed:'always' },
      { id:'mainichi', japanese:'毎日', reading:'まいにち', postposed:'every day' },
      { id:'maishuu', japanese:'毎週', reading:'まいしゅう', postposed:'every week' },
      { id:'mainen', japanese:'毎年', reading:'まいねん', postposed:'every year' },
      { id:'tsuneni', japanese:'常に', reading:'つねに', preposed:'constantly' },
    ]
    const frequency = pick(habitualFrequencies, 833)
    if (habitVerb && frequency) {
      const te = n4VerbForms(habitVerb).te
      const englishPhraseText = frequency.preposed
        ? `${frequency.preposed} ${habitVerb.english}`
        : `${habitVerb.english} ${frequency.postposed}`
      variants.push({
        furigana:[literalPart(frequency.japanese,frequency.reading,'time'),{text:te.japanese,reading:te.reading,slot:'verb'},literalPart('いるわけではありません。')],
        filled:{},english:`It is not that I ${englishPhraseText}.`,
      })
    }
    const variant = pick(variants, 834)
    return variant ? finish(variant.furigana, capitalize(variant.english), variant.filled, {}, 'わけではない softens an assumed generalization.') : null
  }

  if (patternId === 'n2-02') {
    const reason = pick(exact(['試験','仕事','会議','約束','責任','予定','計画']), 841)
    const declinedVerb = pick(smallVerbPool, 842)
    if (!reason || !declinedVerb) return null
    const furigana=[wordPart(reason,'reason'),literalPart('が'),literalPart('あるので、'),{text:declinedVerb.japanese,reading:declinedVerb.reading,slot:'verb'},literalPart('わけにはいきません。')]
    return finish(furigana,`There is ${englishPhrase(reason,'object')}, so I cannot afford to ${declinedVerb.english}.`,{reason},{},'わけにはいかない marks an option the situation forbids.')
  }

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
    const studyObject = pick(exact(['漢字','単語','文法','発音','歴史','数学']), 951)
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
    const readingTarget = pick(vocabulary.filter(word => categoryMatch(word,['Object','Book','Document','Media']) && matchingTags(word,readableTags).length>0), 982)
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
      { surface:'責任者', reading:'せきにんしゃ', english:'the one responsible' },
      { surface:'代表', reading:'だいひょう', english:'the representative' },
    ], 992)
    if (!subject || !predicate) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('こそ、'),literalPart(predicate.surface,predicate.reading,'object'),literalPart('です。')]
    const copula = subjectEnglish==='I' ? 'am' : subjectUsesBaseVerb(subjectEnglish) ? 'are' : 'is'
    return finish(furigana,`${capitalize(subjectEnglish)} ${copula} precisely ${predicate.english}.`,{subject},{},'こそ emphasizes that the preceding word — and no other — fits the predicate.')
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

  if (patternId === 'n2-03') {
    const scene = pick([
      { clause:'転勤する', clauseReading:'てんきんする', english:'It has been decided that I will be transferred.' },
      { clause:'引っ越す', clauseReading:'ひっこす', english:'It has been decided that I will move.' },
      { clause:'結婚する', clauseReading:'けっこんする', english:'It has been decided that we will get married.' },
    ], 1111)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'verb'),literalPart('ことになりました。')]
    return finish(furigana,scene.english,{},{},'ことになる announces a decision or arrangement, often one made by someone else.')
  }

  if (patternId === 'n2-05') {
    const subject = pick(humans, 1121)
    const predicate = pick([
      { surface:'犯人', reading:'はんにん', english:'the culprit' },
      { surface:'天才', reading:'てんさい', english:'a genius' },
      { surface:'専門家', reading:'せんもんか', english:'an expert' },
    ], 1122)
    if (!subject || !predicate) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('が'),literalPart(predicate.surface,predicate.reading,'object'),literalPart('に違いない。','にちがいない。')]
    return finish(furigana,`${capitalize(subjectEnglish)} must be ${predicate.english}.`,{subject},{},'に違いない expresses strong certainty based on evidence, not just guessing.')
  }

  if (patternId === 'n2-06') {
    const verb = pick(smallVerbPool, 1131)
    const subject = pick(humans, 1132)
    if (!verb || !subject) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),{text:verb.japanese,reading:verb.reading,slot:'verb'},literalPart('はずです。')]
    const copula = subjectEnglish === 'I' ? 'am' : subjectUsesBaseVerb(subjectEnglish) ? 'are' : 'is'
    return finish(furigana,`${capitalize(subjectEnglish)} ${copula} supposed to ${verb.english}.`,{subject},{verb:grammarSlot(`verb-${verb.id}-hazuda`,`${verb.japanese}はずです`,verb.japanese,`${verb.reading}はずです`,`supposed to ${verb.english}`,['expectation','hazuda'])},'はずだ expresses a confident expectation based on what the speaker already knows.')
  }

  if (patternId === 'n2-07') {
    const topic = pick(abstractConcepts, 1141)
    // ものだ states a generic truth about a concept, so only adjectives that make
    // sense as a timeless quality (not physical properties like "large"/"red")
    // are eligible here.
    // 同じ is excluded: it attaches directly to a noun without な (同じもの, not
    // 同じなもの) unlike every other na-adjective here.
    const predicate = pick(adjectiveRules.filter(rule => ['muzukashii','kantan','taisetsu','hitsuyou','fukuzatsu','tanjun','juubun','kanzen','tokubetsu','rippa','futsuu'].includes(rule.id)), 1142)
    if (!topic || !predicate) return null
    const isIAdjective = predicate.japanese.endsWith('い')
    const attributive = isIAdjective ? predicate.japanese : `${predicate.japanese}な`
    const attributiveReading = isIAdjective ? predicate.reading : `${predicate.reading}な`
    const furigana=[literalPart(topic.japanese,topic.reading,'subject'),literalPart('は','わ'),literalPart(attributive,attributiveReading,'object'),literalPart('ものだ。')]
    return finish(furigana,`${capitalize(topic.english)} is ${indefinite(`${predicate.english} thing`)}.`,{},{},'ものだ states something as a natural or generally accepted truth.')
  }

  if (patternId === 'n2-08') {
    const scene = pick([
      { thing:'声', thingReading:'こえ', compare:'鳥', compareReading:'とり', english:'a voice like a bird', plural:false },
      { thing:'心', thingReading:'こころ', compare:'天使', compareReading:'てんし', english:'a heart like an angel', plural:false },
      { thing:'目', thingReading:'め', compare:'宝石', compareReading:'ほうせき', english:'eyes like jewels', plural:true },
    ], 1151)
    if (!scene) return null
    const furigana=[literalPart(scene.compare,scene.compareReading,'object'),literalPart('のような'),literalPart(scene.thing,scene.thingReading,'subject'),literalPart('だ。')]
    return finish(furigana,capitalize(`${scene.plural?'these are':'this is'} ${scene.english}.`),{},{},'のような compares one noun to another to describe its quality.')
  }

  if (patternId === 'n2-16') {
    const verb = pick(smallVerbPool, 1161)
    const subject = pick(humans, 1162)
    if (!verb || !subject) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),{text:verb.japanese,reading:verb.reading,slot:'verb'},literalPart('べきではありません。')]
    return finish(furigana,`${capitalize(subjectEnglish)} should not ${verb.english}.`,{subject},{verb:grammarSlot(`verb-${verb.id}-bekidewanai`,`${verb.japanese}べきではありません`,verb.japanese,`${verb.reading}べきではありません`,`should not ${verb.english}`,['obligation','bekidewanai'])},'べきではない attaches to the dictionary form and expresses a recommendation against doing something.')
  }

  if (patternId === 'n2-17') {
    const object = pick(vocabulary.filter(word => categoryMatch(word,['Food']) && matchingTags(word,edibleTags).length>0), 1171)
    if (!object) return null
    const furigana=[wordPart(object,'object'),literalPart('が'),literalPart('嫌い','きらい','predicate'),literalPart('という'),literalPart('わけではありません。')]
    return finish(furigana,`It is not that I dislike ${englishPhrase(object,'object')}.`,{object},{},'というわけではない softens a claim, denying that it is a blanket truth.')
  }

  if (patternId === 'n2-18') {
    const verb = pick(smallVerbPool, 1181)
    if (!verb) return null
    const masuStem = n4VerbForms(verb).masuStem
    const furigana=[{text:masuStem.japanese,reading:masuStem.reading,slot:'verb'},literalPart('かねます。')]
    return finish(furigana,`I cannot readily ${verb.english}.`,{},{verb:grammarSlot(`verb-${verb.id}-kanemasu`,`${masuStem.japanese}かねます`,verb.japanese,`${masuStem.reading}かねます`,`cannot readily ${verb.english}`,['polite-refusal','kaneru'])},'かねる is a formal, polite way to say something is difficult or impossible to do.')
  }

  if (patternId === 'n3-20') {
    const scene = pick([
      { clause:'明日は雨だ', clauseReading:'あしたはあめだ', english:'I think it will rain tomorrow.' },
      { clause:'この本は面白い', clauseReading:'このほんはおもしろい', english:'I think this book is interesting.' },
      { clause:'彼は忙しい', clauseReading:'かれはいそがしい', english:'I think he is busy.' },
    ], 1191)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('と思います。','とおもいます。')]
    return finish(furigana,scene.english,{},{},'と思う reports the speaker\'s own opinion or judgment.')
  }

  if (patternId === 'n3-21') {
    const scene = pick([
      { clause:'明日は雨', clauseReading:'あしたはあめ', english:'Apparently it will rain tomorrow.' },
      { clause:'彼は忙しい', clauseReading:'かれはいそがしい', english:'Apparently he is busy.' },
      { clause:'あの店は有名', clauseReading:'あのみせはゆうめい', english:'Apparently that shop is famous.' },
    ], 1201)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('らしいです。')]
    return finish(furigana,scene.english,{},{},'らしい reports something the speaker heard or read from an outside source.')
  }

  if (patternId === 'n3-22') {
    const scene = pick([
      { clause:'明日は雨だ', clauseReading:'あしたはあめだ', english:'I heard it will rain tomorrow.' },
      { clause:'彼は忙しい', clauseReading:'かれはいそがしい', english:'I heard he is busy.' },
      { clause:'あの店は有名だ', clauseReading:'あのみせはゆうめいだ', english:'I heard that shop is famous.' },
    ], 1211)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('そうです。')]
    return finish(furigana,scene.english,{},{},'そうだ after a plain-form clause reports something the speaker heard, without personal judgment.')
  }

  if (patternId === 'n3-23') {
    const scene = pick([
      { clause:'彼は忙しい', clauseReading:'かれはいそがしい', english:'He seems busy.' },
      { clause:'雨が降っている', clauseReading:'あめがふっている', english:'It seems to be raining.' },
      { clause:'あの人は疲れている', clauseReading:'あのひとはつかれている', english:'That person seems tired.' },
    ], 1221)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('ようです。')]
    return finish(furigana,scene.english,{},{},'ようだ expresses the speaker\'s own impression, usually from what they can see or sense.')
  }

  if (patternId === 'n3-24') {
    const scene = pick([
      { a:'犬', aReading:'いぬ', b:'猫', bReading:'ねこ', adjective:'大きい', adjectiveReading:'おおきい', english:'Dogs are bigger than cats.' },
      { a:'日本語', aReading:'にほんご', b:'英語', bReading:'えいご', adjective:'難しい', adjectiveReading:'むずかしい', english:'Japanese is more difficult than English.' },
      { a:'今日', aReading:'きょう', b:'昨日', bReading:'きのう', adjective:'暑い', adjectiveReading:'あつい', english:'Today is hotter than yesterday.' },
    ], 1231)
    if (!scene) return null
    const furigana=[literalPart(scene.a,scene.aReading,'subject'),literalPart('は','わ'),literalPart(scene.b,scene.bReading,'object'),literalPart('より'),literalPart(scene.adjective,scene.adjectiveReading,'predicate'),literalPart('です。')]
    return finish(furigana,scene.english,{},{},'より marks the thing being compared against — "more than B."')
  }

  if (patternId === 'n3-25') {
    const subject = pick(humans, 1241)
    const other = pick(humans.filter(word => word.id !== subject?.id), 1242)
    // かっこいい is excluded: いい/良い negate irregularly (よくありません, not
    // かっこいくありません), unlike every other い-adjective here.
    const adjective = pick(adjectiveRules.filter(rule => rule.id !== 'kakkoii' && (rule.categories as SentenceCategory[]).includes('Person')), 1243)
    if (!subject || !other || !adjective) return null
    // きれい and 嫌い both end in い but are na-adjectives — the classic
    // exception that trips up the naive "ends in い" i-adjective heuristic.
    const isIAdjective = adjective.japanese.endsWith('い') && !['kirei','kirai'].includes(adjective.id)
    const trait = isIAdjective
      ? { surface:`${adjective.japanese.slice(0,-1)}くありません`, reading:`${adjective.reading.slice(0,-1)}くありません` }
      : { surface:`${adjective.japanese}ではありません`, reading:`${adjective.reading}ではありません` }
    const subjectEnglish = englishPhrase(subject,'subject')
    const otherEnglish = englishPhrase(other,'companion')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(other,'object'),literalPart('ほど'),literalPart(trait.surface,trait.reading,'predicate')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${subjectUsesBaseVerb(subjectEnglish)?'are':'is'} not as ${adjective.english} as ${otherEnglish}.`,{subject,object:other},{},'ほど with a negative predicate sets an upper bound: not reaching that level.')
  }

  if (patternId === 'n3-26') {
    const subject = pick(humans, 1251)
    const drink = pick(vocabulary.filter(word => categoryMatch(word,['Food','Drink']) && matchingTags(word,drinkableTags).length>0), 1252)
    if (!subject || !drink) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(drink,'object'),literalPart('だけ'),literalPart('飲みます。','のみます。')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${subjectUsesBaseVerb(subjectEnglish)?'drink':'drinks'} only ${englishPhrase(drink,'object')}.`,{subject,object:drink},{},'だけ restricts the preceding word to being the only one that applies.')
  }

  if (patternId === 'n3-27') {
    const destination = pick(validPlacePool(vocabulary).filter(word => ['日本','東京','大阪','学校','大学','図書館','公園','駅','病院'].includes(word.japanese)), 1261)
    const advice = pick([
      { surface:'パスポート', reading:'ぱすぽーと', english:'a passport' },
      { surface:'お金', reading:'おかね', english:'money' },
      { surface:'地図', reading:'ちず', english:'a map' },
      { surface:'時間', reading:'じかん', english:'time' },
      { surface:'準備', reading:'じゅんび', english:'preparation' },
    ], 1262)
    if (!destination || !advice) return null
    const furigana=[wordPart(destination,'destination'),literalPart('へ','え'),literalPart('行く','いく','reason'),literalPart('なら、'),literalPart(advice.surface,advice.reading,'object'),literalPart('が'),literalPart('必要です。','ひつようです。')]
    return finish(furigana,`If you are going to ${englishPhrase(destination,'destination')}, you need ${advice.english}.`,{destination},{},'なら responds to a stated topic with fitting advice or a conclusion.')
  }

  if (patternId === 'n3-28') {
    const scene = pick([
      { cause:'春になる', causeReading:'はるになる', result:'桜が咲きます', resultReading:'さくらがさきます', english:'Whenever spring comes, the cherry blossoms bloom.' },
      { cause:'ボタンを押す', causeReading:'ぼたんをおす', result:'ドアが開きます', resultReading:'どあがあきます', english:'Whenever you press the button, the door opens.' },
      { cause:'夜になる', causeReading:'よるになる', result:'星が見えます', resultReading:'ほしがみえます', english:'Whenever night falls, the stars become visible.' },
    ], 1271)
    if (!scene) return null
    const furigana=[literalPart(scene.cause,scene.causeReading,'reason'),literalPart('と、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'と links a condition to an automatic, always-true result.')
  }

  if (patternId === 'n3-29') {
    const foods = [
      { surface:'寿司', reading:'すし', english:'sushi' }, { surface:'天ぷら', reading:'てんぷら', english:'tempura' },
      { surface:'ラーメン', reading:'ラーメン', english:'ramen' }, { surface:'うどん', reading:'うどん', english:'udon' },
      { surface:'そば', reading:'そば', english:'soba' }, { surface:'ケーキ', reading:'ケーキ', english:'cake' },
    ]
    const firstIdx = Math.abs(seed + 1281) % foods.length
    const first = foods[firstIdx]!
    const second = foods[(firstIdx + 1 + (Math.abs(seed + 1282) % (foods.length - 1))) % foods.length]!
    const furigana=[literalPart(first.surface,first.reading,'object'),literalPart('とか'),literalPart(second.surface,second.reading,'result'),literalPart('とか'),literalPart('が'),literalPart('好きです。','すきです。')]
    return finish(furigana,`I like things like ${first.english} and ${second.english}.`,{},{},'とか lists a few informal examples out of a larger set.')
  }

  if (patternId === 'n3-30') {
    const fruits = [
      { surface:'りんご', reading:'りんご', english:'apples' }, { surface:'バナナ', reading:'バナナ', english:'bananas' },
      { surface:'みかん', reading:'みかん', english:'oranges' }, { surface:'ぶどう', reading:'ぶどう', english:'grapes' },
      { surface:'いちご', reading:'いちご', english:'strawberries' },
    ]
    const subject = pick(humans, 1293)
    if (!subject) return null
    const firstIdx = Math.abs(seed + 1291) % fruits.length
    const first = fruits[firstIdx]!
    const second = fruits[(firstIdx + 1 + (Math.abs(seed + 1292) % (fruits.length - 1))) % fruits.length]!
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart(first.surface,first.reading,'object'),literalPart('や'),literalPart(second.surface,second.reading,'result'),literalPart('を'),literalPart('食べます。','たべます。')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${subjectUsesBaseVerb(subjectEnglish)?'eat':'eats'} ${first.english} and ${second.english}, among other things.`,{subject},{},'や lists some but not all of the relevant items, unlike と.')
  }

  if (patternId === 'n3-31') {
    const objectVerbPairs = [
      { verbId:'taberu-basic', objects: exact(['ご飯','パン','ケーキ']), english:'eating' },
      { verbId:'nomu-basic', objects: exact(['お茶','コーヒー']), english:'drinking' },
      { verbId:'yomu-basic', objects: exact(['本','小説','記事']), english:'reading' },
    ].filter(pair => pair.objects.length)
    const pair = pick(objectVerbPairs, 1301)
    const verb = pair ? verbs.find(candidate => candidate.id === pair.verbId) : null
    const object = pair ? pick(pair.objects, 1302) : null
    const subject = pick(humans, 1303)
    if (!pair || !verb || !object || !subject) return null
    const te = n4VerbForms(verb).te
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('を'),{text:te.japanese,reading:te.reading,slot:'verb'},literalPart('みます。')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${subjectUsesBaseVerb(subjectEnglish)?'try':'tries'} ${pair.english} ${englishPhrase(object,'object')}.`,{subject,object},{},'てみる means to try doing something to see how it goes.')
  }

  if (patternId === 'n2-19') {
    const scene = pick([
      { clause:'雨', clauseReading:'あめ', result:'試合は続きました', resultReading:'しあいはつづきました', english:'Despite the rain, the match continued.' },
      { clause:'努力', clauseReading:'どりょく', result:'失敗しました', resultReading:'しっぱいしました', english:'Despite the effort, it ended in failure.' },
      { clause:'反対', clauseReading:'はんたい', result:'計画は進みました', resultReading:'けいかくはすすみました', english:'Despite the opposition, the plan moved forward.' },
    ], 1311)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('にもかかわらず、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'にもかかわらず marks a strong, formal contrast — the result defies the expectation.')
  }

  if (patternId === 'n2-20') {
    // Third-person subjects only: くせに carries a blaming tone that fits describing
    // someone else, and it keeps the fixed English predicates ("is bad at it", "wants
    // to teach") in agreement without per-person conjugation.
    const subject = pick(humans.filter(word => !['私','俺','僕','私自身','我々','私たち','あなた','君'].includes(word.japanese) && !isPluralPhrase(englishPhrase(word,'subject'))), 1321)
    const scene = pick([
      { trait:'下手な', traitReading:'へたな', result:'教えたがります', resultReading:'おしえたがります', copula:'is', predicate:'bad at it', clause:'wants to teach' },
      { trait:'知らない', traitReading:'しらない', result:'説明します', resultReading:'せつめいします', copula:"doesn't", predicate:'know it', clause:'explains anyway' },
      { trait:'子供の', traitReading:'こどもの', result:'偉そうです', resultReading:'えらそうです', copula:'is', predicate:'just a child', clause:'acts important' },
    ], 1322)
    if (!subject || !scene) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart(scene.trait,scene.traitReading,'reason'),literalPart('くせに、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,`Even though ${subjectEnglish} ${scene.copula} ${scene.predicate}, ${subjectEnglish} ${scene.clause}.`,{subject},{},'くせに adds a critical, blaming tone to a contrast — "even though, and shouldn\'t."')
  }

  if (patternId === 'n2-21') {
    const scene = pick([
      { expectation:'上手', expectationReading:'じょうず', reality:'下手', realityReading:'へた', english:'Far from being skilled, he is bad at it.' },
      { expectation:'安い', expectationReading:'やすい', reality:'高い', realityReading:'たかい', english:'Far from being cheap, it is expensive.' },
      { expectation:'簡単', expectationReading:'かんたん', reality:'難しい', realityReading:'むずかしい', english:'Far from being easy, it is difficult.' },
    ], 1331)
    if (!scene) return null
    const furigana=[literalPart(scene.expectation,scene.expectationReading,'reason'),literalPart('どころか、'),literalPart(scene.reality,scene.realityReading,'result'),literalPart('です。')]
    return finish(furigana,scene.english,{},{},'どころか rejects an expectation and asserts the opposite extreme.')
  }

  if (patternId === 'n3-32') {
    // "was" only agrees with third-person singular, so both sides of this
    // sentence are drawn from a pool restricted to that (matches the n2-20 くせに fix below).
    const thirdPersonSingular = humans.filter(word => !subjectUsesBaseVerb(englishPhrase(word,'subject')))
    const subject = pick(thirdPersonSingular, 1341)
    const companion = pick(thirdPersonSingular.filter(word => word.id !== subject?.id), 1342)
    const scene = pick([
      { activity:'寝て', activityReading:'ねて', result:'家事をしていました', resultReading:'かじをしていました', companionVerb:'slept', resultEnglish:'was doing housework' },
      { activity:'話して', activityReading:'はなして', result:'ずっと聞いていました', resultReading:'ずっときいていました', companionVerb:'talked', resultEnglish:'was listening the whole time' },
      { activity:'勉強して', activityReading:'べんきょうして', result:'テレビを見ていました', resultReading:'てれびをみていました', companionVerb:'studied', resultEnglish:'was watching television' },
    ], 1343)
    if (!subject || !companion || !scene) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const companionEnglish = englishPhrase(companion,'subject')
    const furigana=[wordPart(companion,'companion'),literalPart('が'),literalPart(scene.activity,scene.activityReading,'reason'),literalPart('いる'),literalPart('間、'),wordPart(subject,'subject'),literalPart('は','わ'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,capitalize(`for the whole time ${companionEnglish} ${scene.companionVerb}, ${subjectEnglish} ${scene.resultEnglish}.`),{subject,companion},{},'間 (without に) spans the entire duration of the background action, unlike 間に which picks one moment within it.')
  }

  if (patternId === 'n3-33') {
    const verb = pick(smallVerbPool, 1351)
    const subject = pick(humans, 1352)
    if (!verb || !subject) return null
    const aStem = n4VerbForms(verb).aStem
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),{text:aStem.japanese,reading:aStem.reading,slot:'verb'},literalPart('なくなりました。')]
    const verbEnglish = subjectEnglish==='I' || subjectUsesBaseVerb(subjectEnglish) ? verb.english : verb.englishThird
    return finish(furigana,`${capitalize(subjectEnglish)} no longer ${verbEnglish}.`,{subject},{verb:grammarSlot(`verb-${verb.id}-nakunaru`,`${aStem.japanese}なくなりました`,verb.japanese,`${aStem.reading}なくなりました`,`no longer ${verb.english}`,['cessation','nakunaru'])},'なくなる attaches to the nai-stem and marks that an action or state has stopped happening.')
  }

  if (patternId === 'n3-34') {
    const scene = pick([
      { clause:'泣きたい', clauseReading:'なきたい', predicate:'嬉しいです', predicateReading:'うれしいです', english:'I am happy enough to cry.' },
      { clause:'死にたい', clauseReading:'しにたい', predicate:'疲れました', predicateReading:'つかれました', english:'I am tired enough to feel like dying.' },
      { clause:'涙が出る', clauseReading:'なみだがでる', predicate:'感動しました', predicateReading:'かんどうしました', english:'I was moved to the point of tears.' },
    ], 1361)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('くらい'),literalPart(scene.predicate,scene.predicateReading,'result')]
    return finish(furigana,scene.english,{},{},'くらい after an extreme example sets the degree of the feeling being described.')
  }

  if (patternId === 'n3-35') {
    const subject = pick(humans, 1371)
    const pair = pick([
      { object: pick(exact(['ケーキ','パン','肉']), 1372), verb:'食べて', verbReading:'たべて', base:'eat', third:'eats' },
      { object: pick(exact(['お茶','コーヒー']), 1373), verb:'飲んで', verbReading:'のんで', base:'drink', third:'drinks' },
    ], 1374)
    if (!subject || !pair?.object) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const verbEnglish = subjectEnglish==='I' || subjectUsesBaseVerb(subjectEnglish) ? pair.base : pair.third
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(pair.object,'object'),literalPart('ばかり'),literalPart(pair.verb,pair.verbReading,'verb'),literalPart('います。')]
    return finish(furigana,`${capitalize(subjectEnglish)} only ${verbEnglish} ${englishPhrase(pair.object,'object')}.`,{subject,object:pair.object},{},'ばかり after an object criticizes a one-sided, repetitive habit.')
  }

  if (patternId === 'n3-36') {
    const scene = pick([
      { cause:'嬉しさの', causeReading:'うれしさの', result:'泣いてしまいました', resultReading:'ないてしまいました', english:'I was so happy that I ended up crying.' },
      { cause:'驚きの', causeReading:'おどろきの', result:'声も出ませんでした', resultReading:'こえもでませんでした', english:'I was so surprised that I could not even speak.' },
      { cause:'悲しさの', causeReading:'かなしさの', result:'眠れませんでした', resultReading:'ねむれませんでした', english:'I was so sad that I could not sleep.' },
    ], 1381)
    if (!scene) return null
    const furigana=[literalPart(scene.cause,scene.causeReading,'reason'),literalPart('あまり、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'あまり links an extreme feeling to a result caused entirely by its intensity.')
  }

  if (patternId === 'n3-37') {
    const subject = pick(humans, 1391)
    const quote = pick([
      { surface:'頑張って', reading:'がんばって', english:'"Do your best"' },
      { surface:'ありがとう', reading:'ありがとう', english:'"Thank you"' },
      { surface:'気をつけて', reading:'きをつけて', english:'"Be careful"' },
    ], 1392)
    if (!subject || !quote) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart('「'),literalPart(quote.surface,quote.reading,'object'),literalPart('」と'),literalPart('言いました。','いいました。')]
    return finish(furigana,`${capitalize(subjectEnglish)} said ${quote.english}.`,{subject},{},'「quote」と言う reports someone\'s exact words.')
  }

  if (patternId === 'n3-38') {
    const scene = pick([
      { subject:'このケーキ', subjectReading:'このけーき', stem:'美味し', stemReading:'おいし', english:'This cake looks delicious.' },
      { subject:'あの映画', subjectReading:'あのえいが', stem:'面白', stemReading:'おもしろ', english:'That movie looks interesting.' },
      { subject:'この問題', subjectReading:'このもんだい', stem:'難し', stemReading:'むずかし', english:'This problem looks difficult.' },
    ], 1401)
    if (!scene) return null
    const furigana=[literalPart(scene.subject,scene.subjectReading,'subject'),literalPart('は','わ'),literalPart(scene.stem,scene.stemReading,'predicate'),literalPart('そうです。')]
    return finish(furigana,scene.english,{},{},'い-adjective stem + そう describes an appearance-based guess, unlike the hearsay そうだ that follows a full plain-form clause.')
  }

  if (patternId === 'n3-39') {
    const verb = pick(smallVerbPool, 1411)
    if (!verb) return null
    const aStem = n4VerbForms(verb).aStem
    const furigana=[{text:aStem.japanese,reading:aStem.reading,slot:'verb'},literalPart('ないでください。')]
    return finish(furigana,`Please do not ${verb.english}.`,{},{verb:grammarSlot(`verb-${verb.id}-naidekudasai`,`${aStem.japanese}ないでください`,verb.japanese,`${aStem.reading}ないでください`,`please do not ${verb.english}`,['polite-request','naide-kudasai'])},'ないでください politely asks someone not to do something.')
  }

  if (patternId === 'n2-22') {
    const scene = pick([
      { clause:'家を出た', clauseReading:'いえをでた', result:'雨が降り出しました', resultReading:'あめがふりだしました', english:'The moment I left the house, it started to rain.' },
      { clause:'ドアを開けた', clauseReading:'どあをあけた', result:'猫が飛び出しました', resultReading:'ねこがとびだしました', english:'The moment I opened the door, the cat jumped out.' },
      { clause:'席に座った', clauseReading:'せきにすわった', result:'電話が鳴りました', resultReading:'でんわがなりました', english:'The moment I sat down, the phone rang.' },
    ], 1421)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('とたん、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'とたん marks a second event that happens the instant the first one finishes, often catching the speaker off guard.')
  }

  if (patternId === 'n2-23') {
    const scene = pick([
      { clause:'着き', clauseReading:'つき', result:'連絡します', resultReading:'れんらくします', english:'As soon as I arrive, I will contact you.' },
      { clause:'準備ができ', clauseReading:'じゅんびができ', result:'始めます', resultReading:'はじめます', english:'As soon as preparations are ready, we will begin.' },
      { clause:'分かり', clauseReading:'わかり', result:'お知らせします', resultReading:'おしらせします', english:'As soon as I find out, I will let you know.' },
    ], 1431)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('次第、','しだい、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'次第 attaches to the masu-stem and means the result follows immediately once the first event happens.')
  }

  if (patternId === 'n2-24') {
    const scene = pick([
      { clause:'日本に来て', clauseReading:'にほんにきて', result:'ずっと忙しいです', resultReading:'ずっといそがしいです', english:'Ever since I came to Japan, I have been busy the whole time.' },
      { clause:'引っ越して', clauseReading:'ひっこして', result:'会っていません', resultReading:'あっていません', english:'Ever since I moved, I have not seen them.' },
      { clause:'卒業して', clauseReading:'そつぎょうして', result:'連絡していません', resultReading:'れんらくしていません', english:'Ever since graduating, I have not been in touch.' },
    ], 1441)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('以来、','いらい、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'て以来 marks a starting point for a state or situation that has continued ever since.')
  }

  if (patternId === 'n2-25') {
    const scene = pick([
      { clause:'よく考えた', clauseReading:'よくかんがえた', result:'決めます', resultReading:'きめます', english:'After thinking it over carefully, I will decide.' },
      { clause:'相談した', clauseReading:'そうだんした', result:'返事します', resultReading:'へんじします', english:'After consulting with others, I will reply.' },
      { clause:'確認した', clauseReading:'かくにんした', result:'送ります', resultReading:'おくります', english:'After confirming, I will send it.' },
    ], 1451)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('うえで、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'うえで means the first action is completed as a deliberate basis before the second happens.')
  }

  if (patternId === 'n2-26') {
    const scene = pick([
      { clause:'食事をしている', clauseReading:'しょくじをしている', result:'電話が鳴りました', resultReading:'でんわがなりました', english:'Right in the middle of eating, the phone rang.' },
      { clause:'会議をしている', clauseReading:'かいぎをしている', result:'地震がありました', resultReading:'じしんがありました', english:'Right in the middle of the meeting, there was an earthquake.' },
      { clause:'勉強をしている', clauseReading:'べんきょうをしている', result:'友達が来ました', resultReading:'ともだちがきました', english:'Right in the middle of studying, a friend came.' },
    ], 1461)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('最中に、','さいちゅうに、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'最中に interrupts an action at its peak, right when it is most fully underway.')
  }

  if (patternId === 'n2-27') {
    const scene = pick([
      { clause:'道が混んでいた', clauseReading:'みちがこんでいた', result:'遅れました', resultReading:'おくれました', english:'Because the road was congested, I was late.' },
      { clause:'急いでいた', clauseReading:'いそいでいた', result:'忘れ物をしました', resultReading:'わすれものをしました', english:'Because I was in a hurry, I forgot something.' },
      { clause:'眠かった', clauseReading:'ねむかった', result:'寝坊しました', resultReading:'ねぼうしました', english:'Because I was sleepy, I overslept.' },
    ], 1471)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('ものだから、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'ものだから offers a reason with an excuse-making, self-justifying tone.')
  }

  if (patternId === 'n2-28') {
    const scene = pick([
      { clause:'台風が来る', clauseReading:'たいふうがくる', english:'There is a risk that a typhoon will come.' },
      { clause:'事故が起きる', clauseReading:'じこがおきる', english:'There is a risk that an accident will occur.' },
      { clause:'値段が上がる', clauseReading:'ねだんがあがる', english:'There is a risk that the price will rise.' },
    ], 1481)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('おそれがあります。')]
    return finish(furigana,scene.english,{},{},'おそれがある is a formal way to warn about a possible negative outcome.')
  }

  if (patternId === 'n2-29') {
    const scene = pick([
      { clause:'顔色が悪い', clauseReading:'かおいろがわるい', result:'体調が悪いと分かりました', resultReading:'たいちょうがわるいとわかりました', english:"Judging from his poor complexion, I could tell he wasn't feeling well." },
      { clause:'足跡がある', clauseReading:'あしあとがある', result:'誰かが来たと分かりました', resultReading:'だれかがきたとわかりました', english:'Judging from the footprints, I could tell someone had come.' },
      { clause:'電気がついている', clauseReading:'でんきがついている', result:'誰かがいると分かりました', resultReading:'だれかがいるとわかりました', english:'Judging from the light being on, I could tell someone was there.' },
    ], 1491)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('ことから、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'ことから draws a conclusion from an observable piece of evidence.')
  }

  if (patternId === 'n2-30') {
    const scene = pick([
      { clause:'安い', clauseReading:'やすい', result:'品質は良いです', resultReading:'ひんしつはいいです', english:'Though it is cheap, the quality is good.' },
      { clause:'難しい', clauseReading:'むずかしい', result:'挑戦する価値があります', resultReading:'ちょうせんするかちがあります', english:'Though it is difficult, it is worth attempting.' },
      { clause:'小さい', clauseReading:'ちいさい', result:'とても丈夫です', resultReading:'とてもじょうぶです', english:'Though it is small, it is very sturdy.' },
    ], 1501)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('とはいえ、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'とはいえ concedes a point formally before pointing out that it does not change the outcome.')
  }

  if (patternId === 'n2-31') {
    const scene = pick([
      { clause:'狭い', clauseReading:'せまい', result:'楽しい家です', resultReading:'たのしいいえです', english:'Although it is small, it is a fun house.' },
      { clause:'安い', clauseReading:'やすい', result:'質の良い店です', resultReading:'しつのよいみせです', english:'Although it is cheap, it is a good-quality shop.' },
      { clause:'若い', clauseReading:'わかい', result:'とても頼りになります', resultReading:'とてもたよりになります', english:'Although young, they are very reliable.' },
    ], 1511)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('ながらも、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'ながら(も) after an adjective concedes a quality while asserting something that seems to contradict it.')
  }

  if (patternId === 'n2-32') {
    const scene = pick([
      { clause:'生きている', clauseReading:'いきている', result:'頑張ります', resultReading:'がんばります', english:'As long as I am alive, I will keep trying.' },
      { clause:'時間がある', clauseReading:'じかんがある', result:'手伝います', resultReading:'てつだいます', english:'As long as I have time, I will help.' },
      { clause:'ルールを守る', clauseReading:'るーるをまもる', result:'自由に遊べます', resultReading:'じゆうにあそべます', english:'As long as you follow the rules, you can play freely.' },
    ], 1521)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('限り、','かぎり、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'限り sets an upper boundary: the result holds only within that condition.')
  }

  if (patternId === 'n2-33') {
    const scene = pick([
      { a:'今年', aReading:'ことし', b:'去年', bReading:'きょねん', predicate:'暑いです', predicateReading:'あついです', english:'Compared with last year, this year is hot.' },
      { a:'この町', aReading:'このまち', b:'あの町', bReading:'あのまち', predicate:'静かです', predicateReading:'しずかです', english:'Compared with that town, this town is quiet.' },
      { a:'今回', aReading:'こんかい', b:'前回', bReading:'ぜんかい', predicate:'簡単でした', predicateReading:'かんたんでした', english:'Compared with last time, this time was easy.' },
    ], 1531)
    if (!scene) return null
    const furigana=[literalPart(scene.a,scene.aReading,'subject'),literalPart('は','わ'),literalPart(scene.b,scene.bReading,'object'),literalPart('に比べて、','にくらべて、'),literalPart(scene.predicate,scene.predicateReading,'result')]
    return finish(furigana,scene.english,{},{},'に比べて sets up an explicit comparison baseline for the statement that follows.')
  }

  if (patternId === 'n2-34') {
    const scene = pick([
      { topic:'その意見', topicReading:'そのいけん', result:'反対しました', resultReading:'はんたいしました', english:'They objected in response to that opinion.' },
      { topic:'新しい方針', topicReading:'あたらしいほうしん', result:'賛成しました', resultReading:'さんせいしました', english:'They agreed in response to the new policy.' },
      { topic:'その質問', topicReading:'そのしつもん', result:'丁寧に答えました', resultReading:'ていねいにこたえました', english:'They answered that question carefully.' },
    ], 1541)
    if (!scene) return null
    const furigana=[literalPart(scene.topic,scene.topicReading,'object'),literalPart('に対して、','にたいして、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{},'に対して marks the specific target that a reaction or attitude is directed at.')
  }

  if (patternId === 'n2-35') {
    const subject = pick(humans, 1551)
    const object = pick(vocabulary.filter(word => categoryMatch(word,['Object','Book','Document','Media']) && matchingTags(word,readableTags).length>0), 1552)
    if (!subject || !object) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('すら'),literalPart('知りません。','しりません。')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${subjectUsesBaseVerb(subjectEnglish)?"don't":"doesn't"} even know ${englishPhrase(object,'object')}.`,{subject,object},{},'すら is a formal, literary equivalent of さえ, singling out an extreme example.')
  }

  if (patternId === 'n2-36') {
    const scene = pick([
      { subject:'彼', subjectReading:'かれ', verb:'来る', verbReading:'くる', english:'There is no way he is coming.' },
      { subject:'彼女', subjectReading:'かのじょ', verb:'知っている', verbReading:'しっている', english:'There is no way she knows.' },
      { subject:'あの人', subjectReading:'あのひと', verb:'間違える', verbReading:'まちがえる', english:'There is no way that person makes a mistake.' },
    ], 1561)
    if (!scene) return null
    const furigana=[literalPart(scene.subject,scene.subjectReading,'subject'),literalPart('が'),literalPart(scene.verb,scene.verbReading,'verb'),literalPart('はずがありません。')]
    return finish(furigana,scene.english,{},{},'はずがない firmly rules out a possibility as logically impossible.')
  }

  if (patternId === 'n2-37') {
    const scene = pick([
      { subject:'子供', subjectReading:'こども', clause:'ドアを開けよう', clauseReading:'どあをあけよう', english:'The child tried to open the door.' },
      { subject:'選手', subjectReading:'せんしゅ', clause:'記録を破ろう', clauseReading:'きろくをやぶろう', english:'The athlete tried to break the record.' },
      { subject:'犬', subjectReading:'いぬ', clause:'逃げよう', clauseReading:'にげよう', english:'The dog tried to run away.' },
    ], 1571)
    if (!scene) return null
    const furigana=[literalPart(scene.subject,scene.subjectReading,'subject'),literalPart('は','わ'),literalPart(scene.clause,scene.clauseReading,'verb'),literalPart('としました。')]
    return finish(furigana,scene.english,{},{},'volitional + とする means to attempt or be on the verge of doing something.')
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
