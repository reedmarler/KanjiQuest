import { getApprovedContentRecords } from './contentDatabase'
import type { GeneratedPreviewSentence } from './sentenceGeneratorPreview'
import { normalizeTags } from '../data/tagTaxonomy'
import { allCards } from '../data'
import { classifyVocabularyCard, refineCoarseCategory } from './vocabularyClassifier'
import { inferPreferredTranslation } from '../data/preferredVocabularyTranslations'
import type { JlptLevel, StudyCard } from './types'
import { toHiragana } from 'wanakana'

export const SENTENCE_CATEGORIES = [
  'Person','Animal','Plant','Food','Drink','Medicine','Place','Building','Room','Object','Tool','Technology','Vehicle','Clothing','Furniture','Book','Document','Media','Time','Weather','Emotion','Activity','Event','Adverb','Number','Money','Language',
] as const

export type SentenceCategory = typeof SENTENCE_CATEGORIES[number]

/**
 * The tag every word in a category is guaranteed to carry.
 *
 * Slot rules gate on *tags*, not categories alone, so a word whose tags miss
 * whatever allowlist a slot happens to check is silently unreachable: present
 * in the pool, accepted by nothing, and indistinguishable from a word that is
 * simply rare. That failure has no error and no test — 馬 tagged `farm`
 * instead of `animal`, 監督 tagged `coach` instead of `occupation`, and 現金
 * tagged `payment` instead of `money` all looked correct and all generated
 * exactly nothing.
 *
 * Guaranteeing this tag (see `withCanonicalCategoryTags`) makes category
 * membership sufficient for the broad category-shaped allowlists below, which
 * are in turn *derived* from this map rather than repeating its values. A
 * miswritten tag then costs discoverability inside a category, never
 * reachability itself.
 *
 * Approved (human-reviewed) records are exempt: their tags are the reviewed
 * artifact, and overriding a reviewer's omission is how 共 ("both; together")
 * briefly became a valid sentence subject.
 *
 * This deliberately does not collapse the narrower semantic lists
 * (`edibleTags`, `readableTags`, `standaloneDestinationTags`, ...) onto their
 * categories: those encode real distinctions that must survive. 塩 is Food but
 * is not eaten, 切手 is a Document but is not read, and 交差点 is a Place but is
 * not somewhere you travel *to*. Those lists stay hand-curated on purpose.
 */
const CANONICAL_CATEGORY_TAGS: Record<SentenceCategory,string> = {
  Person:'person', Animal:'animal', Plant:'plant', Food:'food', Drink:'drink',
  Medicine:'medicine', Place:'place', Building:'building', Room:'room',
  Object:'object', Tool:'tool', Technology:'technology', Vehicle:'vehicle',
  Clothing:'clothing', Furniture:'furniture', Book:'book', Document:'document',
  Media:'media', Time:'time', Weather:'weather', Emotion:'emotion',
  Activity:'activity', Event:'event', Adverb:'adverb', Number:'number',
  Money:'money', Language:'language',
}

/** Adds each category's guaranteed tag, keeping the author's own tags first. */
function withCanonicalCategoryTags(categories: SentenceCategory[], tags: string[]) {
  return normalizeTags([...tags, ...categories.map(category => CANONICAL_CATEGORY_TAGS[category])])
}

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
  /**
   * Explicit allowlist for slots where tags cannot express the restriction —
   * the Adverb category tags manner, degree, epistemic and negative-polarity
   * words all as `adverb`. Declared on the rule rather than filtered inside
   * fillVerbSlots so the reachability audit sees the same pool the generator
   * does; hiding it in the generator inflated the audit by 60-odd words.
   */
  words?: ReadonlySet<string>
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
  /**
   * Exclude the word currently shown in a slot from that slot's candidate
   * pool. Re-seeding a slot with a small pool (a handful of valid objects for
   * a given verb) often just re-picks the same word within a few attempts —
   * excluding it outright means the very first candidate is a genuine change
   * whenever the pool has more than one member.
   */
  avoidWords?: Partial<Record<string,string>>
  /** Force one verb usage so callers can inspect its compatible vocabulary. */
  verbId?: string
  /**
   * Force this exact Japanese word into whichever slot it legitimately fits,
   * so callers can build an example sentence *for* a specific word. The word
   * still has to pass that slot's normal category/tag rules — this narrows the
   * candidate pool, it never bypasses a compatibility check. Generation fails
   * (returns null) rather than producing a sentence without the word.
   */
  requiredWord?: string
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

  // N5 words previously absent from every generation pool (audited against
  // the full N5 vocab list — see the vocab-coverage report). Concrete,
  // unambiguous nouns only; verbs and adjectives need their own slot
  // machinery and are left for a follow-up pass.
  ['san','三','さん','three',['Number'],['number']], ['go','五','ご','five',['Number'],['number']], ['roku','六','ろく','six',['Number'],['number']], ['futari','二人','ふたり','two people',['Number'],['number','people']],
  ['gozen','午前','ごぜん','the morning',['Time'],['clock-time']], ['gogo','午後','ごご','the afternoon',['Time'],['clock-time']], ['yuugata','夕方','ゆうがた','evening',['Time'],['clock-time']],
  ['yuki','雪','ゆき','snow',['Weather'],['cold','precipitation']], ['kumo','雲','くも','a cloud',['Weather'],['sky']], ['kaminari','雷','かみなり','thunder',['Weather'],['storm']], ['hare','晴れ','はれ','sunny weather',['Weather'],['clear']], ['kumori','曇り','くもり','cloudy weather',['Weather'],['overcast']],
  ['kusa','草','くさ','grass',['Plant'],['outdoor']], ['ha','葉','は','a leaf',['Plant'],['outdoor']],
  ['uma','馬','うま','a horse',['Animal'],['animal']],
  ['ike','池','いけ','a pond',['Place'],['outdoor','water']], ['mizuumi','湖','みずうみ','a lake',['Place'],['outdoor','water']], ['mukou','向こう','むこう','over there',['Place'],['direction']], ['kousaten','交差点','こうさてん','the intersection',['Place'],['street']], ['oudanhodou','横断歩道','おうだんほどう','the crosswalk',['Place'],['street']],
  ['suupaa','スーパー','すーぱー','the supermarket',['Building'],['shopping']], ['konbini','コンビニ','こんびに','the convenience store',['Building'],['shopping']],
  ['toriniku','鶏肉','とりにく','chicken',['Food'],['meat']], ['shio','塩','しお','salt',['Food'],['condiment']],
  ['kagami','鏡','かがみ','a mirror',['Object'],['household']], ['haburashi','歯ブラシ','はぶらし','a toothbrush',['Object'],['household']], ['sekken','石けん','せっけん','soap',['Object'],['household']],
  ['moufu','毛布','もうふ','a blanket',['Furniture'],['bedroom']],
  ['megane','眼鏡','めがね','glasses',['Clothing'],['accessory']],
  ['jugyou','授業','じゅぎょう','class',['Activity'],['school']], ['supootsu','スポーツ','すぽーつ','sports',['Activity'],['hobby']], ['souji','掃除','そうじ','cleaning',['Activity'],['chore']],
  ['matsuri','祭り','まつり','a festival',['Event'],['seasonal']], ['kaji','火事','かじ','a fire',['Event'],['emergency']],
  ['genkin','現金','げんきん','cash',['Money'],['money','currency']], ['otsuri','お釣り','おつり','change',['Money'],['money']],

  // N4-N1 words from the study-only core-expansion/focus decks that were
  // never admitted into the generator (see the catalogWords() comment above
  // for why those decks stay excluded by default). Concrete nouns only,
  // hand-reviewed the same way as the N5 batch above; verbs and highly
  // abstract N2/N1 discourse vocabulary (制度/傾向/根拠/...) need dedicated
  // sentence patterns rather than a pool entry and are left for later.
  ['kisetsu','季節','きせつ','a season',['Time'],['calendar']], ['kyuuryou','給料','きゅうりょう','a salary',['Money'],['money','currency']], ['yakkyoku','薬局','やっきょく','the pharmacy',['Building'],['shopping']], ['bai','倍','ばい','times/-fold',['Number'],['number']], ['hanabi','花火','はなび','fireworks',['Event'],['seasonal']], ['shukujitsu','祝日','しゅくじつ','a national holiday',['Event'],['calendar']], ['massugu','真っ直ぐ','まっすぐ','straight ahead',['Adverb'],['adverb','manner']], ['sentakuki','洗濯機','せんたくき','a washing machine',['Furniture'],['household','machine']], ['soujiki','掃除機','そうじき','a vacuum cleaner',['Furniture'],['household','machine']], ['touchaku','到着','とうちゃく','arrival',['Event'],['travel']], ['hikkoshi','引っ越し','ひっこし','moving house',['Event'],['home']], ['uketsuke','受付','うけつけ','the reception desk',['Place'],['workplace']],
  ['kibun','気分','きぶん','a feeling',['Emotion'],['mood']], ['torizara','取り皿','とりざら','a small serving plate',['Object'],['kitchenware']], ['mochikaeri','持ち帰り','もちかえり','takeout',['Activity'],['restaurant']], ['denpyou','伝票','でんぴょう','a bill',['Document'],['receipt']], ['kantoku','監督','かんとく','the coach',['Person'],['occupation']], ['hikiwake','引き分け','ひきわけ','a draw',['Event'],['sports']], ['yuushou','優勝','ゆうしょう','a championship win',['Event'],['sports']], ['buta','豚','ぶた','a pig',['Animal'],['animal']], ['zou','象','ぞう','an elephant',['Animal'],['animal']], ['yubiwa','指輪','ゆびわ','a ring',['Clothing'],['accessory']], ['keshou','化粧','けしょう','makeup',['Object'],['accessory']], ['hinan','避難','ひなん','evacuation',['Event'],['emergency']], ['hijouguchi','非常口','ひじょうぐち','the emergency exit',['Place'],['building']], ['tanjou','誕生','たんじょう','a birth',['Event'],['family']], ['shuushoku','就職','しゅうしょく','finding employment',['Event'],['work']], ['goukei','合計','ごうけい','a total',['Number'],['number']], ['keigo','敬語','けいご','polite language',['Language'],['japanese']], ['hanami','花見','はなみ','flower viewing',['Event'],['seasonal']], ['okurimono','贈り物','おくりもの','a gift',['Object'],['present']], ['shoutai','招待','しょうたい','an invitation',['Event'],['social']], ['kinenbi','記念日','きねんび','an anniversary',['Event'],['calendar']],
  ['shinpan','審判','しんぱん','the referee',['Person'],['occupation']], ['juui','獣医','じゅうい','the veterinarian',['Person'],['occupation']], ['mejirushi','目印','めじるし','a landmark',['Object'],['direction']], ['choumiryou','調味料','ちょうみりょう','seasoning',['Food'],['condiment']], ['tsuuhou','通報','つうほう','a report to authorities',['Event'],['emergency']], ['tounan','盗難','とうなん','theft',['Event'],['emergency']], ['rikon','離婚','りこん','a divorce',['Event'],['family']], ['taishoku','退職','たいしょく','retirement',['Event'],['work']], ['soushiki','葬式','そうしき','a funeral',['Event'],['family']], ['hanataba','花束','はなたば','a bouquet',['Object'],['present']], ['bonodori','盆踊り','ぼんおどり','a bon dance',['Event'],['seasonal']],
  ['oukyuuteate','応急手当','おうきゅうてあて','first aid',['Activity'],['emergency']],
].map(([id,japanese,reading,english,categories,tags]) => ({ id, japanese, reading, english, preferredTranslation:inferPreferredTranslation(String(japanese),String(english),String(reading)), categories, tags:withCanonicalCategoryTags(categories as SentenceCategory[],tags as string[]), source: 'built-in' })) as WordRecord[]

let catalogWordCache: WordRecord[] | null = null

function catalogWords(): WordRecord[] {
  if (catalogWordCache) return catalogWordCache
  // The study-only core-expansion and focus decks have no reviewed generator
  // tags, so they stay out: admitting them weakens the semantic constraints the
  // rest of this file exists to enforce.
  //
  // Admitting them by the classifier's own "high confidence" was tried and
  // reverted. That confidence only means a keyword matched the English gloss,
  // which misfires badly on compound nouns — 交番 "police box" matched `police`
  // and became a *person* ("a police box may boil tea"), and 留守 "absence; not
  // at home" matched `home` and became a place you can walk from. Widening this
  // pool safely needs per-word review, not a confidence heuristic.
  catalogWordCache = allCards.filter(card =>
    card.type === 'vocab' && !isStudyOnlyDeck(card.id),
  ).map(toCategoryWordRecord)
  return catalogWordCache
}

function isStudyOnlyDeck(id: string) {
  return id.startsWith('vocab-core-expansion-') || id.startsWith('vocab-focus-')
}

function toCategoryWordRecord(card: StudyCard): WordRecord {
  const classification = classifyVocabularyCard(card)
  const english = card.back || card.english || 'Meaning needed'
  return { id:`catalog-${card.id}`, japanese:card.front, reading:card.reading ?? 'Reading needed', english, preferredTranslation:inferPreferredTranslation(card.front,english,card.reading), jlpt:card.jlpt, categories:[classification.category], tags:withCanonicalCategoryTags([classification.category],classification.tags), source:'built-in' }
}

/**
 * The study-only words the generator refuses to use until a human has checked
 * their category and tags, carrying the classifier's unverified guess so a
 * reviewer has somewhere to start. Approving one in Content Studio stores a
 * reviewed record, which `approvedWords()` then feeds into the generator — the
 * per-word path that the rejected confidence heuristic was standing in for.
 */
export function getPendingReviewWords(): CategoryWordRecord[] {
  return allCards
    .filter(card => card.type === 'vocab' && isStudyOnlyDeck(card.id))
    .map(toCategoryWordRecord)
    .sort((a, b) => a.english.localeCompare(b.english))
}

// `ingredient` is deliberately absent: sugar, flour, and oil are what a dish is
// made of, not what someone sits down and eats.
const edibleTags = [CANONICAL_CATEGORY_TAGS.Food,'fruit','vegetable','meat','seafood','fish','rice','bread','noodles','soup','dessert','snack','candy','ice-cream','edible']
// `medicine` rides along because 薬 is drunk rather than eaten in Japanese.
// It doubles as the guard that keeps medicine out of 食べる, which excludes
// anything drinkable that carries no solid-food tag.
const drinkableTags = [CANONICAL_CATEGORY_TAGS.Drink,CANONICAL_CATEGORY_TAGS.Medicine,'drinkable','beverage','water','tea','coffee','juice','soda','alcohol','milk','dairy']
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
const readableTags = [CANONICAL_CATEGORY_TAGS.Book,CANONICAL_CATEGORY_TAGS.Document,'notebook','magazine','newspaper','reading','fiction','news','textbook','comic']
// Declared early so verb entries above `portableObjectTags` (which is built
// from this and other tag lists further down the file) can still reference a
// generic "handleable object" tag set without a use-before-declaration error.
const genericObjectTags = ['portable','light','book','document','paper','notebook','magazine','newspaper','letter','phone','camera','bottle','cup','box','bag','wallet','clothing','shirt','coat','hat','shoes','tool','pen','pencil']
// Paper goods that carry writing but are not read. Tagging alone cannot separate
// these from letters and documents, so they are named directly.
const unreadableObjectWords = new Set(['切手','切符','名刺','カード','札','紙','封筒','領収書','値札'])
// A broad `media` tag is descriptive but not enough to make an item a natural
// object of 見る. For example, books are media but default to 読む.
const watchableTags = ['movie','film','television','tv','video','anime','animation','picture','photo','game']
// Concrete, handleable things — excludes abstractions like それで/歴史/作品 that
// share a category with real tools but are not something you physically use.
// 'household'/'machine' cover genuinely bulky appliances (冷蔵庫, 掃除機) that
// you operate rather than hold — fine for 使う (use), excluded from 持つ below.
const usableToolTags = [CANONICAL_CATEGORY_TAGS.Tool,CANONICAL_CATEGORY_TAGS.Vehicle,'knife','scissors','electronics','computer','laptop','phone','tablet','camera','television','tv','pen','pencil','instrument','household','machine','bicycle','kitchenware','ball','sport','equipment','personal-item','wearable','accessory']
// Abstractions — ideas, feelings, situations. They share the Object category
// with physical things but no physical-object slot will ever take them: you do
// not read a tendency or carry a responsibility around. They were the single
// largest block of unreachable vocabulary until the topic patterns below gave
// them frames of their own.
// 'state', 'condition' and 'information' are deliberately absent even though
// they look abstract: the imported taxonomy hangs them on weather (曇り, 晴れ)
// and on concrete carriers of information (写真, 電話番号), which produced
// "explains the cloudy weather". Every genuinely abstract word that carried one
// of them also carries 'abstract', so nothing is lost by dropping them.
const abstractTopicTags = ['abstract','emotion','feeling','philosophy','thought','ideology','psychology','logic','society','relationship','situation','reason','result','outcome','method','process','opinion','belief','value','goal','problem','communication','experience','memory','knowledge','learning','plan','purpose','trend','pattern','responsibility','duty','ethics','reality','ideal']
// Body parts, weather and other concrete nouns pick up 'state' or 'condition'
// from the imported taxonomy, and a handful of words carry an abstract tag
// beside a thoroughly physical gloss. Naming them is cheaper and safer than
// trying to out-tag the source data.
// 中心 is included for a different reason: it is genuinely abstract, but its
// gloss is the bare "center", and "explains the center" reads as a missing
// noun rather than an idea.
const nonAbstractTopicWords = new Set(['体','声','目','眼','顔','手','足','頭','心臓','実','点','気','水','空','風','雨','雪','雲','熱','色','形','音','中心',
  // 話 glosses as "talk", which collides with the verb of the について frame:
  // "he talks about the talk". お願い glosses as "please", which is not a noun
  // in English at all.
  '話','お願い'])
const portablePhysicalObjectTags = [...genericObjectTags,'toy','ball','key','money','currency','wallet']
// 持つ normally describes something a person can comfortably carry or hold.
// Keep bulky electronics/appliances (television, refrigerator, vacuum) out
// even though they are concrete — 'personal-item'/'wearable'/'accessory'/
// 'kitchenware' cover genuinely handheld things (傘, 眼鏡, 指輪, 箸) that were
// simply missing from this list, not things that need excluding.
const handHeldObjectTags = [...portablePhysicalObjectTags,'phone','camera','personal-item','wearable','accessory','kitchenware','ball','sport','equipment']
// Concrete "things" broad enough for existence sentences (ある) — a union of
// several already-curated lists rather than a bare category, so abstract or
// junk-classified words never slip in the way an untagged category would.
const existenceObjectTags = [...usableToolTags,...readableTags,...watchableTags,...edibleTags,...drinkableTags,'clothing','shirt','coat','furniture','chair','table','desk','picture','photo','bag','box','bottle','cup','key']
// Category-shaped lists: "any member of this category, plus the finer-grained
// tags an individual word may carry instead". These lead with the category's
// canonical tag rather than repeating its literal value, so a category can
// never drift out of the list that is supposed to accept all of its members —
// the drift that made 馬 (Animal, tagged `farm`) unusable as a subject.
const animalSubjectTags = [CANONICAL_CATEGORY_TAGS.Animal,'dog','cat','bird','fish','pet']
// The current verb records describe human activities. Animals and plants need
// their own verb usages so that an otherwise valid category cannot create a
// sentence such as “a horse goes to university” or “a tree talks.”
const humanSubjectTags = [CANONICAL_CATEGORY_TAGS.Person,'pronoun','speaker','man','woman','boy','girl','baby','child','teenager','adult','elderly','human','family','mother','father','wife','husband','brother','sister','grandparent','grandchild','relative','friend','partner','classmate','coworker','neighbor','customer','boss','employee','occupation','teacher','student','doctor','nurse','citizen']
// zoo/bridge/port/intersection/shop/hot-spring/countryside/aquarium/direction
// were missing even though 動物園, 橋, 港, 交差点, 薬局, 温泉, 田舎, 水族館,
// and 東/西/南/北 are all ordinary, natural destinations — the same class of
// gap as readingMannerTags: real words carrying real destination-shaped tags
// that simply weren't in this allowlist yet.
const standaloneDestinationTags = ['country','city','town','village','neighborhood',CANONICAL_CATEGORY_TAGS.Building,'house','home','apartment','school','education','university','office','store','shop','restaurant','cafe','hospital','hotel','library','museum','temple','shrine','church','bank','station','airport','park','forest','mountain','river','lake','beach','ocean','island','platform','parking-lot',CANONICAL_CATEGORY_TAGS.Room,'kitchen','bathroom','bedroom','classroom','public','transport','destination','zoo','bridge','port','intersection','hot-spring','countryside','aquarium','direction',
  // Same class of gap again: 市場, 劇場, 地域, ヨーロッパ and 通り are ordinary
  // destinations carrying destination-shaped tags that were never listed.
  //
  // 世界 and 地球 are excluded despite being places: 世界に行きます is not
  // something anyone says, and it generated "runs to world". 土地 is excluded
  // for the same reason. Positional nouns (上, 横, そば) stay out too — they are
  // relations rather than places you travel to, and get their own frame.
  'market','theater','region','continent','street','urban','road','highway','infrastructure']
const workplaceLocationTags = ['company','office','store','shop','school','education','university','hospital','bank','restaurant','cafe','library','museum','station','airport','hotel','post-office','movie-theater']
const crowdedPlaceTags = ['city','town','village','neighborhood','park','restaurant','cafe','station','market','festival','event','downtown','public']
const pushableObjectTags = ['button','door','box','bag','cart','chair','table','furniture','switch','key','tool']
const pullableObjectTags = ['door','drawer','cart','rope','string','handle','bag','box','chair','table','furniture']
const bakedFoodTags = ['meat','seafood','fish','bread','dessert','cake','pie','pastry','baked']
const boilableFoodTags = ['meat','seafood','fish','vegetable','bean','egg','potato','tofu']
// 揚げる (deep-fry) — rice/staples/soup are cooked other ways, not deep-fried.
const deepFryableTags = ['meat','seafood','fish','vegetable','potato','chicken','shrimp','tofu','dumpling']
// A subset of destinations you can walk into and be inside of. Open-air or
// natural places (mountains, forests, rivers) fit 行く/帰る but not 入る —
// nobody "enters" a mountain, they climb it.
const enterableDestinationTags = ['country','city','town','village','neighborhood',CANONICAL_CATEGORY_TAGS.Building,'house','home','apartment','school','education','university','office','store','restaurant','cafe','hospital','hotel','library','museum','temple','shrine','church','bank','station','airport','platform','parking-lot',CANONICAL_CATEGORY_TAGS.Room,'kitchen','bathroom','bedroom','classroom']
// `education` is deliberately absent: it also covers libraries and study rooms,
// where eating is exactly what you do not do. Schools stay through `school`.
const eatingLocationTags = ['restaurant','cafe','cafeteria','house','home','kitchen','dining-room','room','school','classroom','office','workplace','park','hotel','eating-location']
// Places someone plausibly commutes to on a routine basis (通う). Excludes
// one-off destinations like a museum or airport — 通う reads as habitual,
// so "commutes to the airport" is as odd in English as it is in Japanese.
const routineAttendanceDestinationTags = ['school','education','university','office','hospital','workplace']
// 住む takes a dwelling or a locality, never a room inside one — 洗面所 and
// 玄関 both carry the 'room' tag, which is how "lives in the washroom" and
// "lives in the entryway" were getting generated.
const residenceLocationTags = ['country','city','town','village','neighborhood','island','house','home','apartment','residence']
// いる existence ("X is at Y") reads fine for ordinary indoor/public places
// but odd for wide-open nature — "there's a daughter in the forest" needs a
// story to make sense, while "there's a daughter at home" doesn't.
const personExistenceLocationTags = standaloneDestinationTags.filter(tag => !['forest','mountain','river','lake','beach','ocean','island'].includes(tag))
// The mirror image of the exclusion above: "there's an elephant at the
// company" or "a cow is at the sales floor" is exactly the nonsense that
// filter exists to prevent for people, but institutional/office places are
// where it lands once the subject is an animal instead. Animals belong in
// nature, farm, and pet-appropriate settings.
const animalExistenceLocationTags = ['forest','mountain','river','lake','beach','ocean','park','zoo','farm','house','home','garden']
// ある existence for a generic object ("X is at Y") reads plausibly only for
// everyday places things actually sit around in — specialized institutional
// buildings (bank, hospital, airport, temple) make an arbitrary object's
// presence there feel like a non sequitur ("the shoes are at the bank").
const objectExistenceLocationTags = ['building','house','home','apartment','school','office','store','restaurant','cafe','library','room','kitchen','bathroom','bedroom','classroom','station','park']
// 逃げる destinations: places that make sense to flee TO — shelter (a
// building, home) or open space to run into (forest, mountain, park). A
// bank, museum, or classroom is a plausible destination in general but not
// a plausible place to flee toward.
const fleeingDestinationTags = ['building','house','home','apartment','room','forest','mountain','park','outdoor','station']
// These tags describe words that can stand directly before a verb. Broad tags
// such as Speed, Manner, or naAdjective are not sufficient: 急速, for example,
// needs に and cannot be inserted as 急速読みます.
// `clearly` is excluded: はっきり describes speech and perception, and はっきり読む
// reads as “read out distinctly” rather than the plain manner of reading this
// pattern teaches.
const readingMannerTags = ['slowly','leisurely','quickly','carefully','quietly','silently','aloud','fluently','adverbial-manner']
/**
 * Adverbs safe to drop in front of a plain action verb.
 *
 * Named individually because the classifier gives almost every adverb the
 * single tag `adverb`, which cannot separate the ones that work here from the
 * ones that produce broken Japanese or broken English:
 *
 *   余り / ぜんぜん  negative-polarity — ungrammatical without 〜ない, and this
 *                   slot's ending rotates through affirmative forms
 *   とても / すごく / 非常に / 極めて / かなり
 *                   degree adverbs that modify adjectives, not verbs
 *                   (とても食べます is wrong)
 *   もう / まだ      tense-sensitive; wrong against most of the 8 endings
 *   たぶん / きっと / 確か / やはり / 結局 / 一体
 *                   sentence-level epistemics, not verb manner
 *   たくさん / 少し / 全部 / 一緒に
 *                   grammatical, but English wants them *after* the verb
 *                   ("eats a lot"), and this pattern renders {Adverb} before
 *                   it ("a lot eats")
 *   ございます       a polite verb the classifier filed under Adverb
 *
 * What remains is frequency and manner, which read correctly pre-verbally in
 * both languages.
 */
const actionAdverbWords = new Set([
  'よく','たまに','たいてい','ゆっくり','すぐ','だんだん',
  'しっかり','きちんと','一生懸命','静かに','丁寧に',
  // Frequency and manner adverbs that pass the same test as the originals:
  // grammatical before a plain verb in Japanese and natural before the verb in
  // English ("always reads a book", "suddenly ate bread"). They were sitting in
  // the unreachable list purely because nothing had vetted them yet, unlike the
  // degree and sentence adverbs above, which are excluded on purpose.
  // 直接 is deliberately absent: it belongs with speech verbs (直接聞く,
  // 直接話す) and produced "directly drinks tea" against this slot's verbs.
  'いつも','常に','早く','突然','急に','はっきり','どんどん',
])
// A distinct array instance: fillVerbSlots keys the word filter off this
// identity, the same way it keys the reading-manner widening off
// readingMannerTags.
const actionAdverbTags = ['adverb']
const wakeTimeTags = ['clock-time','hour','morning','dawn','sunrise','wake-time']
// Time expressions that take に generally, not just the wake-up ones. 起きる
// still restricts itself to wakeTimeTags through its own slot rule, so this
// wider set only affects patterns where any point in time is fine.
const generalTimeTags = [...wakeTimeTags,'afternoon','evening','night','noon','season','spring','summer','autumn','fall','winter','month','year','date','day','weekday','holiday','birthday']
const niIncompatibleTimeTags = new Set(normalizeTags(['today','tonight','tomorrow','yesterday','morning','this-morning','this-evening','this-time','frequency','daily','weekly','monthly','yearly','every-morning','every-evening','every-night','every-day']))
// Relative time words name a period by its distance from now, and Japanese
// attaches them directly ("来週行きます"), so に reads wrong on them.
const niIncompatibleTimeWords = new Set(['今朝','今晩','今日','明日','昨日','毎朝','毎晩','毎日','今週','来週','先週','今月','来月','先月','今年','来年','去年','今','最近'])
// englishPhrase(...,'time') is tuned for mid-sentence use after a verb
// ("comes tonight", "comes in this month"), where a preposition helps it
// flow — but reads broken as a fronted sentence-initial adjunct ("In the
// tonight, ..."). These are the plain, bare glosses a fronted adjunct needs.
const frontedTimeAdjunctEnglish: Record<string,string> = {
  今朝:'this morning',今晩:'tonight',今日:'today',明日:'tomorrow',昨日:'yesterday',
  毎朝:'every morning',毎晩:'every night',毎日:'every day',
  今週:'this week',来週:'next week',先週:'last week',
  今月:'this month',来月:'next month',先月:'last month',
  今年:'this year',来年:'next year',去年:'last year',
  今:'right now',最近:'recently',
}
// A bare duration noun names a span, not a point on the calendar, so it cannot
// host an event with に — 年に来ます is as broken as the English "comes year".
const durationOnlyTimeWords = new Set(['年','月','週','日','一日','時間','分','秒','世紀','年間','週間'])
// 床, 壁, and 天井 are parts of a place rather than places you travel between:
// walking from the floor to the library names no starting point.
// 国 names no particular place — “goes to a country” says nothing a learner can
// picture. 外国 and the named countries in the catalog carry the same grammar
// with a meaning attached.
const destinationIncompatibleWords = new Set(['家庭','通り','床','壁','天井','屋根','階','段','角','国'])
// opposite-side (向こう, "over there") is a relative position, not a place a
// learner sentence can name on its own — same reasoning as relative-location.
// Its gloss is also a multi-word adverbial phrase, so definitePlaceTags
// applying "the" to it produces "the over there" if it ever reaches a
// destination/location slot regardless of this exclusion.
const destinationIncompatibleTags = new Set(normalizeTags(['household','family','street','road','route','front','surface','exterior','relative-location','opposite-side','floor','wall','ceiling','roof','building-part','stairs','pillar']))
const nonHumanSubjectTags = new Set(normalizeTags(['animal','pet','dog','cat','bird','fish','insect','plant','tree','flower','grass','bush','crop','body','body-part','anatomy']))
// Subjects too young to plausibly be the one drinking 酒 (alcohol).
const minorSubjectTags = new Set(normalizeTags(['child','boy','girl','baby','pupil']))
// Explicit list of words that actually denote a child, for contexts where
// tag-based matching has proven unreliable (see n2-20's 子供の branch).
const childWords = new Set(['子供','子ども','息子','娘','男の子','女の子','少年','少女','赤ちゃん','幼児','児童','生徒'])
// A guest, customer, or employee is not the one who'd be doing another
// household's chores while someone else in the scene relaxes.
const nonHouseholdSubjectTags = new Set(normalizeTags(['customer','guest','employee','worker','clerk','staff']))
// 人間 ("a human being") was grouped in here alongside actual rude/casual
// pronouns (お前, あんた, 貴様, てめえ) and interrogatives (誰, どなた) — it's
// neither. "人間は忙しいです" is as ordinary as "人は忙しいです"; there's no
// politeness concern with the word itself, so it belongs in the human
// subject pool, not this exclusion list.
const politeSubjectIncompatibleWords = new Set(['お前','あんた','貴様','てめえ','奴','人類','誰','だれ','どなた','何方'])
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
  // Medicine belongs here because Japanese takes medicine by drinking it
  // (薬を飲む), which is also the only slot that consumes the Medicine
  // category — without it, splitting 薬 out of Food would leave it stranded.
  { id:'nomu-basic', japanese:'飲む', reading:'のむ', english:'drink', englishThird:'drinks', verbClass:'godan-mu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food','Drink','Medicine'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','consumption','drinking','godan','transitive','drink'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food','Drink','Medicine'],tags:drinkableTags} } },
  { id:'yomu-basic', japanese:'読む', reading:'よむ', english:'read', englishThird:'reads', verbClass:'godan-mu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Book','Document','Media'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','reading','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Book','Document','Media'],tags:readableTags} } },
  { id:'miru-basic', japanese:'見る', reading:'みる', english:'watch', englishThird:'watches', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Media','Technology'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','perception','watching','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Media','Technology'],tags:watchableTags} } },
  // n5-09 (Subject は Object を Adverb Verb) existed but only 読む and 書く used
  // it, so the whole Adverb category reached the stream through one
  // reading-specific slot with two candidates. These reuse the layout with the
  // curated action-adverb pool and each verb's existing object rules.
  { id:'taberu-adverb', japanese:'食べる', reading:'たべる', english:'eat', englishThird:'eats', verbClass:'ichidan', sentencePattern:'n5-09', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Adverb} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','consumption','eating','ichidan','transitive','food'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags}, adverb:{categories:['Adverb'],tags:actionAdverbTags,words:actionAdverbWords} } },
  { id:'nomu-adverb', japanese:'飲む', reading:'のむ', english:'drink', englishThird:'drinks', verbClass:'godan-mu', sentencePattern:'n5-09', subjectCategories:['Person'], objectCategories:['Food','Drink','Medicine'], translationTemplate:'{Subject} {Adverb} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','consumption','drinking','godan','transitive','drink'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food','Drink','Medicine'],tags:drinkableTags}, adverb:{categories:['Adverb'],tags:actionAdverbTags,words:actionAdverbWords} } },
  { id:'miru-adverb', japanese:'見る', reading:'みる', english:'watch', englishThird:'watches', verbClass:'ichidan', sentencePattern:'n5-09', subjectCategories:['Person'], objectCategories:['Object','Media','Technology'], translationTemplate:'{Subject} {Adverb} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','perception','watching','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Media','Technology'],tags:watchableTags}, adverb:{categories:['Adverb'],tags:actionAdverbTags,words:actionAdverbWords} } },
  { id:'tsukau-adverb', japanese:'使う', reading:'つかう', english:'use', englishThird:'uses', verbClass:'godan-u', sentencePattern:'n5-09', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Adverb} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags}, adverb:{categories:['Adverb'],tags:actionAdverbTags,words:actionAdverbWords} } },
  { id:'tsukuru-adverb', japanese:'作る', reading:'つくる', english:'make', englishThird:'makes', verbClass:'godan-ru', sentencePattern:'n5-09', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Adverb} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cooking','godan','transitive','food'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:['bread','dessert','cake','pie','pastry','baked','noodles','sushi','dish','meal']}, adverb:{categories:['Adverb'],tags:actionAdverbTags,words:actionAdverbWords} } },
  { id:'iku-ni', japanese:'行く', reading:'いく', english:'go', englishThird:'goes', verbClass:'godan-ku-iku', sentencePattern:'n5-02', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','motion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  // n5-30, means of transport (〜で行きます). The Vehicle category had 13 words
  // and only two slots accepting it, neither of which was about travelling —
  // this is the pattern those words exist for.
  { id:'iku-transport', japanese:'行く', reading:'いく', english:'go', englishThird:'goes', verbClass:'godan-ku-iku', sentencePattern:'n5-32', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} by {Transport}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','motion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, transport:{categories:['Vehicle'],tags:[CANONICAL_CATEGORY_TAGS.Vehicle,'car','bus','train','bicycle','motorcycle','airplane','ship']} } },
  { id:'kaeru-transport', japanese:'帰る', reading:'かえる', english:'return home', englishThird:'returns home', verbClass:'godan-ru', sentencePattern:'n5-32', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} by {Transport}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','motion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, transport:{categories:['Vehicle'],tags:[CANONICAL_CATEGORY_TAGS.Vehicle,'car','bus','train','bicycle','motorcycle','airplane','ship']} } },
  { id:'kuru-transport', japanese:'来る', reading:'くる', english:'come', englishThird:'comes', verbClass:'irregular', sentencePattern:'n5-32', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} by {Transport}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','motion','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, transport:{categories:['Vehicle'],tags:[CANONICAL_CATEGORY_TAGS.Vehicle,'car','bus','train','bicycle','motorcycle','airplane','ship']} } },
  { id:'taberu-location', japanese:'食べる', reading:'たべる', english:'eat', englishThird:'eats', verbClass:'ichidan', sentencePattern:'n5-03', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','consumption','eating','ichidan','transitive','food'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:eatingLocationTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'hanasu-companion', japanese:'話す', reading:'はなす', english:'talk', englishThird:'talks', verbClass:'godan-su', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','speaking','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'okiru-time', japanese:'起きる', reading:'おきる', english:'wake up', englishThird:'wakes up', verbClass:'ichidan', sentencePattern:'n5-05', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Time}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','sleeping','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, time:{categories:['Time'],tags:wakeTimeTags} } },
  { id:'yomu-adverb', japanese:'読む', reading:'よむ', english:'read', englishThird:'reads', verbClass:'godan-mu', sentencePattern:'n5-09', subjectCategories:['Person'], objectCategories:['Object','Book','Document','Media'], translationTemplate:'{Subject} {Adverb} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','reading','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Book','Document','Media'],tags:readableTags}, adverb:{categories:['Adverb'],tags:actionAdverbTags,words:actionAdverbWords} } },
  { id:'iku-e', japanese:'行く', reading:'いく', english:'go', englishThird:'goes', verbClass:'godan-ku-iku', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','motion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'kau-basic', japanese:'買う', reading:'かう', english:'buy', englishThird:'buys', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','shopping','godan','transitive','food'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'tsukuru-basic', japanese:'作る', reading:'つくる', english:'make', englishThird:'makes', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cooking','godan','transitive','food'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:['bread','dessert','cake','pie','pastry','baked','noodles','sushi','dish','meal']} } },
  { id:'tsukau-basic', japanese:'使う', reading:'つかう', english:'use', englishThird:'uses', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'kaku-basic', japanese:'書く', reading:'かく', english:'write', englishThird:'writes', verbClass:'godan-ku', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Document'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','writing','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Document'],tags:readableTags} } },
  { id:'au-companion', japanese:'会う', reading:'あう', english:'meet', englishThird:'meets', verbClass:'godan-u', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','meeting','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'asobu-companion', japanese:'遊ぶ', reading:'あそぶ', english:'play', englishThird:'plays', verbClass:'godan-bu', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','leisure','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'matsu-basic', japanese:'待つ', reading:'まつ', english:'wait for', englishThird:'waits for', verbClass:'godan-tsu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','waiting','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kaeru-destination', japanese:'帰る', reading:'かえる', english:'return', englishThird:'returns', verbClass:'godan-ru', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','motion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'arau-basic', japanese:'洗う', reading:'あらう', english:'wash', englishThird:'washes', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Clothing'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Clothing']} } },
  { id:'tetsudau-basic', japanese:'手伝う', reading:'てつだう', english:'help', englishThird:'helps', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','helping','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kayou-destination', japanese:'通う', reading:'かよう', english:'commute', englishThird:'commutes', verbClass:'godan-u', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','routine','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:routineAttendanceDestinationTags} } },
  { id:'nomu-location', japanese:'飲む', reading:'のむ', english:'drink', englishThird:'drinks', verbClass:'godan-mu', sentencePattern:'n5-03', subjectCategories:['Person'], objectCategories:['Food','Drink'], translationTemplate:'{Subject} {Verb} {Object} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','consumption','drinking','godan','transitive','drink'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:eatingLocationTags}, object:{categories:['Food','Drink'],tags:drinkableTags} } },
  { id:'yomu-location', japanese:'読む', reading:'よむ', english:'read', englishThird:'reads', verbClass:'godan-mu', sentencePattern:'n5-03', subjectCategories:['Person'], objectCategories:['Object','Book','Document','Media'], translationTemplate:'{Subject} {Verb} {Object} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','reading','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:eatingLocationTags}, object:{categories:['Object','Book','Document','Media'],tags:readableTags} } },
  { id:'neru-time', japanese:'寝る', reading:'ねる', english:'sleep', englishThird:'sleeps', verbClass:'ichidan', sentencePattern:'n5-05', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Time}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','sleeping','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, time:{categories:['Time'],tags:wakeTimeTags} } },
  { id:'oyogu-time', japanese:'泳ぐ', reading:'およぐ', english:'swim', englishThird:'swims', verbClass:'godan-gu', sentencePattern:'n5-05', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Time}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','sports','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, time:{categories:['Time'],tags:wakeTimeTags} } },
  { id:'kaku-adverb', japanese:'書く', reading:'かく', english:'write', englishThird:'writes', verbClass:'godan-ku', sentencePattern:'n5-09', subjectCategories:['Person'], objectCategories:['Document'], translationTemplate:'{Subject} {Adverb} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','writing','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Document'],tags:readableTags}, adverb:{categories:['Adverb'],tags:actionAdverbTags,words:actionAdverbWords} } },
  { id:'uru-basic', japanese:'売る', reading:'うる', english:'sell', englishThird:'sells', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','commerce','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'motsu-basic', japanese:'持つ', reading:'もつ', english:'hold', englishThird:'holds', verbClass:'godan-tsu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','possession','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:handHeldObjectTags} } },
  { id:'hashiru-destination', japanese:'走る', reading:'はしる', english:'run', englishThird:'runs', verbClass:'godan-ru', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','sports','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'hairu-destination', japanese:'入る', reading:'はいる', english:'enter', englishThird:'enters', verbClass:'godan-ru', sentencePattern:'n5-02', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:enterableDestinationTags} } },
  { id:'toru-basic', japanese:'取る', reading:'とる', english:'take', englishThird:'takes', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'oku-basic', japanese:'置く', reading:'おく', english:'put', englishThird:'puts', verbClass:'godan-ku', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'sagasu-basic', japanese:'探す', reading:'さがす', english:'search for', englishThird:'searches for', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'mitsukeru-basic', japanese:'見つける', reading:'みつける', english:'find', englishThird:'finds', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'hirou-basic', japanese:'拾う', reading:'ひろう', english:'pick up', englishThird:'picks up', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object','Money'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object','Money'],tags:portablePhysicalObjectTags} } },
  { id:'kariru-basic', japanese:'借りる', reading:'かりる', english:'borrow', englishThird:'borrows', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'kasu-basic', japanese:'貸す', reading:'かす', english:'lend', englishThird:'lends', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'harau-basic', japanese:'払う', reading:'はらう', english:'pay', englishThird:'pays', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Money'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','commerce','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Money'],tags:[CANONICAL_CATEGORY_TAGS.Money,'currency','price','cost']} } },
  { id:'yaku-basic', japanese:'焼く', reading:'やく', english:'bake', englishThird:'bakes', verbClass:'godan-ku', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cooking','godan','transitive','food'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:bakedFoodTags} } },
  { id:'sasou-basic', japanese:'誘う', reading:'さそう', english:'invite', englishThird:'invites', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'hakobu-basic', japanese:'運ぶ', reading:'はこぶ', english:'carry', englishThird:'carries', verbClass:'godan-bu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:portablePhysicalObjectTags} } },
  { id:'deau-companion', japanese:'出会う', reading:'であう', english:'meet', englishThird:'meets', verbClass:'godan-u', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','meeting','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'tatakau-companion', japanese:'戦う', reading:'たたかう', english:'fight', englishThird:'fights', verbClass:'godan-u', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','conflict','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'noboru-destination', japanese:'登る', reading:'のぼる', english:'climb', englishThird:'climbs', verbClass:'godan-ru', sentencePattern:'n5-02', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:['mountain']} } },
  { id:'yasumu-time', japanese:'休む', reading:'やすむ', english:'rest', englishThird:'rests', verbClass:'godan-mu', sentencePattern:'n5-05', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Time}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, time:{categories:['Time'],tags:wakeTimeTags} } },
  { id:'kuru-destination', japanese:'来る', reading:'くる', english:'come', englishThird:'comes', verbClass:'irregular', sentencePattern:'n5-02', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'hataraku-location', japanese:'働く', reading:'はたらく', english:'work', englishThird:'works', verbClass:'godan-ku', sentencePattern:'n5-25', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','occupation','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:workplaceLocationTags} } },
  { id:'sumu-location', japanese:'住む', reading:'すむ', english:'live', englishThird:'lives', verbClass:'godan-mu', sentencePattern:'n5-26', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','living','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:residenceLocationTags} } },
  { id:'tomaru-location', japanese:'泊まる', reading:'とまる', english:'stay', englishThird:'stays', verbClass:'godan-ru', sentencePattern:'n5-26', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','lodging','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:['hotel','house','home','apartment']} } },
  { id:'erabu-basic', japanese:'選ぶ', reading:'えらぶ', english:'choose', englishThird:'chooses', verbClass:'godan-bu', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Technology','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Technology','Object'],tags:usableToolTags} } },
  { id:'oboeru-basic', japanese:'覚える', reading:'おぼえる', english:'memorize', englishThird:'memorizes', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Book','Document','Media'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Book','Document','Media'],tags:readableTags} } },
  { id:'wasureru-basic', japanese:'忘れる', reading:'わすれる', english:'forget', englishThird:'forgets', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object','Book','Document'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object','Book','Document'],tags:['wallet','key','book','document','notebook','bag','umbrella','phone','letter','ticket']} } },
  { id:'narau-basic', japanese:'習う', reading:'ならう', english:'learn', englishThird:'learns', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Language','Activity','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Language','Activity','Object'],tags:['language','skill','instrument','sport','swimming','music','studying','practice']} } },
  { id:'tomeru-basic', japanese:'止める', reading:'とめる', english:'stop', englishThird:'stops', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Vehicle','Tool','Technology'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Vehicle','Tool','Technology'],tags:['car','vehicle','bicycle','train','bus','machine','clock','engine']} } },
  { id:'akeru-basic', japanese:'開ける', reading:'あける', english:'open', englishThird:'opens', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object','Furniture'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object','Furniture'],tags:['door','window','box','bag','bottle','jar','suitcase']} } },
  { id:'shimeru-basic', japanese:'閉める', reading:'しめる', english:'close', englishThird:'closes', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object','Furniture'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object','Furniture'],tags:['door','window','box','bag','bottle','jar','suitcase']} } },
  { id:'hajimeru-basic', japanese:'始める', reading:'はじめる', english:'begin', englishThird:'begins', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Activity','Event'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','time','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Activity','Event'],tags:['studying','working','practice','exercise','meal','meeting','event','activity']} } },
  { id:'wakareru-companion', japanese:'別れる', reading:'わかれる', english:'break up', englishThird:'breaks up', verbClass:'ichidan', sentencePattern:'n5-04', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} with {Companion}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, companion:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'modoru-destination', japanese:'戻る', reading:'もどる', english:'go back', englishThird:'goes back', verbClass:'godan-ru', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  // 勤める takes its workplace with に ("works at" as affiliation), unlike 働く
  // (n5-25, で — "works at" as the place the activity happens), so it needs the
  // に-marked template (n5-26) instead of sharing 働く's で template.
  { id:'tsutomeru-location', japanese:'勤める', reading:'つとめる', english:'work', englishThird:'works', verbClass:'ichidan', sentencePattern:'n5-26', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','occupation','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Place','Building','Room'],tags:workplaceLocationTags} } },
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
  { id:'shiraberu-basic', japanese:'調べる', reading:'しらべる', english:'investigate', englishThird:'investigates', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Technology','Document','Language'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Technology','Document','Language'],tags:[...readableTags,'computer','laptop','tablet','information','data']} } },
  { id:'yurusu-basic', japanese:'許す', reading:'ゆるす', english:'forgive', englishThird:'forgives', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'utagau-basic', japanese:'疑う', reading:'うたがう', english:'doubt', englishThird:'doubts', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'shinjiru-basic', japanese:'信じる', reading:'しんじる', english:'believe', englishThird:'believes', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kirau-basic', japanese:'嫌う', reading:'きらう', english:'dislike', englishThird:'dislikes', verbClass:'godan-u', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','emotion','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'sasaeru-basic', japanese:'支える', reading:'ささえる', english:'support', englishThird:'supports', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'tasukeru-basic', japanese:'助ける', reading:'たすける', english:'save', englishThird:'saves', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'mamoru-basic', japanese:'守る', reading:'まもる', english:'protect', englishThird:'protects', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'otosu-basic', japanese:'落とす', reading:'おとす', english:'drop', englishThird:'drops', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object'],tags:usableToolTags} } },
  { id:'sawaru-basic', japanese:'触る', reading:'さわる', english:'touch', englishThird:'touches', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object'],tags:usableToolTags} } },
  { id:'osu-basic', japanese:'押す', reading:'おす', english:'push', englishThird:'pushes', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object','Furniture'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object','Furniture'],tags:pushableObjectTags} } },
  { id:'hiku-basic', japanese:'引く', reading:'ひく', english:'pull', englishThird:'pulls', verbClass:'godan-ku', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Tool','Object','Furniture'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Tool','Object','Furniture'],tags:pullableObjectTags} } },
  { id:'niru-basic', japanese:'煮る', reading:'にる', english:'boil', englishThird:'boils', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cooking','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:boilableFoodTags} } },
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
  { id:'nigeru-destination', japanese:'逃げる', reading:'にげる', english:'flee', englishThird:'flees', verbClass:'ichidan', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:fleeingDestinationTags} } },
  { id:'mukau-destination', japanese:'向かう', reading:'むかう', english:'head', englishThird:'heads', verbClass:'godan-u', sentencePattern:'n5-10', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} to {Destination}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, destination:{categories:['Place','Building','Room'],tags:standaloneDestinationTags} } },
  { id:'suwaru-location', japanese:'座る', reading:'すわる', english:'sit', englishThird:'sits', verbClass:'godan-ru', sentencePattern:'n5-26', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','body','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, location:{categories:['Furniture','Object'],tags:['chair','bench','sofa','stool','seat']} } },
  { id:'nemuru-time', japanese:'眠る', reading:'ねむる', english:'sleep', englishThird:'sleeps', verbClass:'godan-ru', sentencePattern:'n5-05', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Time}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, time:{categories:['Time'],tags:wakeTimeTags} } },
  { id:'suru-basic', japanese:'する', reading:'する', english:'do', englishThird:'does', verbClass:'irregular', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Activity'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','action','irregular','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Activity']} } },
  // subject before location (unlike most verb records) so fillVerbSlots'
  // animal-vs-person location narrowing below can see which one got picked —
  // that filter needs filled.subject to already exist.
  { id:'iru-existence', japanese:'いる', reading:'いる', english:'are', englishThird:'is', verbClass:'ichidan', sentencePattern:'n5-27', subjectCategories:['Person','Animal'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','existence','ichidan','intransitive'], slots:{ subject:{categories:['Person','Animal'],tags:[...humanSubjectTags,...animalSubjectTags]}, location:{categories:['Place','Building','Room'],tags:personExistenceLocationTags} } },
  { id:'aru-existence', japanese:'ある', reading:'ある', english:'are', englishThird:'is', verbClass:'godan-ru', sentencePattern:'n5-27', subjectCategories:['Object','Tool','Technology','Food','Drink','Book','Document','Media','Furniture','Clothing'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Location}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','existence','godan','intransitive'], slots:{ location:{categories:['Place','Building','Room'],tags:objectExistenceLocationTags}, subject:{categories:['Object','Tool','Technology','Food','Drink','Book','Document','Media','Furniture','Clothing'],tags:existenceObjectTags} } },
  // Bare "Subject wa Verb" shape (n5-28) — the first shape with no slot at all
  // beyond subject, for verbs that genuinely take no object/destination/location.
  // Animals had 15 words and exactly one slot (there-is sentences), so nothing
  // an animal does was expressible. These reuse n5-28's existing subject-は-verb
  // layout rather than adding a builder, and take Person too since people run
  // and sleep as readily as animals do.
  { id:'hashiru-basic', japanese:'走る', reading:'はしる', english:'run', englishThird:'runs', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person','Animal'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','motion','godan','intransitive'], slots:{ subject:{categories:['Person','Animal'],tags:[...humanSubjectTags,...animalSubjectTags]} } },
  { id:'neru-basic', japanese:'寝る', reading:'ねる', english:'sleep', englishThird:'sleeps', verbClass:'ichidan', sentencePattern:'n5-28', subjectCategories:['Person','Animal'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','sleeping','ichidan','intransitive'], slots:{ subject:{categories:['Person','Animal'],tags:[...humanSubjectTags,...animalSubjectTags]} } },
  { id:'tatsu-basic', japanese:'立つ', reading:'たつ', english:'stand', englishThird:'stands', verbClass:'godan-tsu', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','body','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'suwaru-basic', japanese:'座る', reading:'すわる', english:'sit', englishThird:'sits', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','body','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'naku-basic', japanese:'泣く', reading:'なく', english:'cry', englishThird:'cries', verbClass:'godan-ku', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','emotion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'warau-basic', japanese:'笑う', reading:'わらう', english:'laugh', englishThird:'laughs', verbClass:'godan-u', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','emotion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'okoru-basic', japanese:'怒る', reading:'おこる', english:'get angry', englishThird:'gets angry', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','emotion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'tsukareru-basic', japanese:'疲れる', reading:'つかれる', english:'get tired', englishThird:'gets tired', verbClass:'ichidan', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'komaru-basic', japanese:'困る', reading:'こまる', english:'be troubled', englishThird:'is troubled', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  // する-compounds, kept object-less: the vocab pool's Activity category is a
  // classifier catch-all for any verb-shaped gloss (see suru-basic's own
  // object filter), so giving these an object slot risks the same "does a
  // die" class of bug found there. Bare usage ("cleans up", "practices") is
  // natural and avoids that trap entirely.
  { id:'souji-suru', japanese:'掃除する', reading:'そうじする', english:'clean up', englishThird:'cleans up', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'renshuu-suru', japanese:'練習する', reading:'れんしゅうする', english:'practice', englishThird:'practices', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','learning','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'shitsumon-suru', japanese:'質問する', reading:'しつもんする', english:'ask a question', englishThird:'asks a question', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'shinpai-suru', japanese:'心配する', reading:'しんぱいする', english:'worry', englishThird:'worries', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','emotion','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'junbi-suru', japanese:'準備する', reading:'じゅんびする', english:'prepare', englishThird:'prepares', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'setsumei-suru', japanese:'説明する', reading:'せつめいする', english:'explain', englishThird:'explains', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kakunin-suru', japanese:'確認する', reading:'かくにんする', english:'confirm', englishThird:'confirms', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'riyou-suru', japanese:'利用する', reading:'りようする', english:'make use of it', englishThird:'makes use of it', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'sanka-suru', japanese:'参加する', reading:'さんかする', english:'participate', englishThird:'participates', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'touchaku-suru', japanese:'到着する', reading:'とうちゃくする', english:'arrive', englishThird:'arrives', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'shuppatsu-suru', japanese:'出発する', reading:'しゅっぱつする', english:'depart', englishThird:'departs', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'seikou-suru', japanese:'成功する', reading:'せいこうする', english:'succeed', englishThird:'succeeds', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'shippai-suru', japanese:'失敗する', reading:'しっぱいする', english:'fail', englishThird:'fails', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'sentaku-suru', japanese:'選択する', reading:'せんたくする', english:'choose', englishThird:'chooses', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'anshin-suru', japanese:'安心する', reading:'あんしんする', english:'feel relieved', englishThird:'feels relieved', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','emotion','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kansha-suru', japanese:'感謝する', reading:'かんしゃする', english:'feel grateful', englishThird:'feels grateful', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','emotion','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kitai-suru', japanese:'期待する', reading:'きたいする', english:'have expectations', englishThird:'has expectations', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','emotion','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'deru-source', japanese:'出る', reading:'でる', english:'leave', englishThird:'leaves', verbClass:'ichidan', sentencePattern:'n5-29', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb} {Source}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, source:{categories:['Building','Room'],tags:['building','house','home','apartment','school','office','store','shop','restaurant','cafe','hospital','hotel','library','bank','station','airport','room','kitchen','bathroom','bedroom','classroom']} } },
  { id:'shiru-basic', japanese:'知る', reading:'しる', english:'know', englishThird:'knows', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  // Bare intransitive/stative verbs (n5-28) — abstract-subject pairs like
  // 深まる/高まる/伝わる/届く are deliberately excluded: their natural subject
  // is a concept (friendship, popularity, news) rather than a Person, which
  // this shape doesn't support yet.
  { id:'tsuduku-basic', japanese:'続く', reading:'つづく', english:'continue', englishThird:'continues', verbClass:'godan-ku', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','time','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kimeru-basic', japanese:'決める', reading:'きめる', english:'decide', englishThird:'decides', verbClass:'ichidan', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','cognition','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kawaru-basic', japanese:'変わる', reading:'かわる', english:'change', englishThird:'changes', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'fueru-basic', japanese:'増える', reading:'ふえる', english:'increase', englishThird:'increases', verbClass:'ichidan', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'heru-basic', japanese:'減る', reading:'へる', english:'decrease', englishThird:'decreases', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'umareru-basic', japanese:'生まれる', reading:'うまれる', english:'be born', englishThird:'is born', verbClass:'ichidan', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'sodatsu-basic', japanese:'育つ', reading:'そだつ', english:'grow up', englishThird:'grows up', verbClass:'godan-tsu', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'nakunaru-basic', japanese:'亡くなる', reading:'なくなる', english:'pass away', englishThird:'passes away', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'nokoru-basic', japanese:'残る', reading:'のこる', english:'remain', englishThird:'remains', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'susumu-basic', japanese:'進む', reading:'すすむ', english:'advance', englishThird:'advances', verbClass:'godan-mu', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','movement','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'hajimaru-basic', japanese:'始まる', reading:'はじまる', english:'begin', englishThird:'begins', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','time','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'owaru-basic', japanese:'終わる', reading:'おわる', english:'end', englishThird:'ends', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','time','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kuwawaru-basic', japanese:'加わる', reading:'くわわる', english:'join', englishThird:'joins', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'mazaru-basic', japanese:'混ざる', reading:'まざる', english:'get mixed in', englishThird:'gets mixed in', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'atsumaru-basic', japanese:'集まる', reading:'あつまる', english:'gather', englishThird:'gathers', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'hirogaru-basic', japanese:'広がる', reading:'ひろがる', english:'spread', englishThird:'spreads', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'ayamaru-basic', japanese:'謝る', reading:'あやまる', english:'apologize', englishThird:'apologizes', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'odoroku-basic', japanese:'驚く', reading:'おどろく', english:'be surprised', englishThird:'is surprised', verbClass:'godan-ku', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','emotion','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kotowaru-basic', japanese:'断る', reading:'ことわる', english:'decline', englishThird:'declines', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'tayoru-basic', japanese:'頼る', reading:'たよる', english:'rely on someone', englishThird:'relies on someone', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'tanomu-basic', japanese:'頼む', reading:'たのむ', english:'make a request', englishThird:'makes a request', verbClass:'godan-mu', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'shiharau-basic', japanese:'支払う', reading:'しはらう', english:'pay', englishThird:'pays', verbClass:'godan-u', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kasegu-basic', japanese:'稼ぐ', reading:'かせぐ', english:'earn money', englishThird:'earns money', verbClass:'godan-gu', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'tameru-basic', japanese:'貯める', reading:'ためる', english:'save up money', englishThird:'saves up money', verbClass:'ichidan', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'ushinau-basic', japanese:'失う', reading:'うしなう', english:'lose something', englishThird:'loses something', verbClass:'godan-u', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'eru-basic', japanese:'得る', reading:'える', english:'gain something', englishThird:'gains something', verbClass:'ichidan', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','ichidan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'iwau-basic', japanese:'祝う', reading:'いわう', english:'celebrate', englishThird:'celebrates', verbClass:'godan-u', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'inoru-basic', japanese:'祈る', reading:'いのる', english:'pray', englishThird:'prays', verbClass:'godan-ru', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'negau-basic', japanese:'願う', reading:'ねがう', english:'wish', englishThird:'wishes', verbClass:'godan-u', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','godan','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  // Bare する-compounds not covered in the earlier batch.
  { id:'kyoka-suru', japanese:'許可する', reading:'きょかする', english:'give permission', englishThird:'gives permission', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'setsuyaku-suru', japanese:'節約する', reading:'せつやくする', english:'economize', englishThird:'economizes', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'koukan-suru', japanese:'交換する', reading:'こうかんする', english:'exchange things', englishThird:'exchanges things', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'annai-suru', japanese:'案内する', reading:'あんないする', english:'show the way', englishThird:'shows the way', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'kandou-suru', japanese:'感動する', reading:'かんどうする', english:'be moved', englishThird:'is moved', verbClass:'irregular', sentencePattern:'n5-28', subjectCategories:['Person'], objectCategories:[], translationTemplate:'{Subject} {Verb}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','emotion','irregular','intransitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags} } },
  // Transitive verbs taking a generic Object (n5-01) — kept to portable/handleable
  // things (portableObjectTags) to avoid pulling in abstract nonsense objects.
  { id:'ukeru-basic', japanese:'受ける', reading:'うける', english:'receive', englishThird:'receives', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Document'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','transfer','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Document'],tags:genericObjectTags} } },
  { id:'nokosu-basic', japanese:'残す', reading:'のこす', english:'leave behind', englishThird:'leaves behind', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','state','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Food'],tags:genericObjectTags} } },
  { id:'kuwaeru-basic', japanese:'加える', reading:'くわえる', english:'add', englishThird:'adds', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'mazeru-basic', japanese:'混ぜる', reading:'まぜる', english:'mix', englishThird:'mixes', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Food'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Food'],tags:edibleTags} } },
  { id:'atsumeru-basic', japanese:'集める', reading:'あつめる', english:'collect', englishThird:'collects', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object'],tags:genericObjectTags} } },
  { id:'hirogeru-basic', japanese:'広げる', reading:'ひろげる', english:'spread out', englishThird:'spreads out', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Document'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','daily-life','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Document'],tags:['paper','document','map','newspaper','cloth']} } },
  { id:'todokeru-basic', japanese:'届ける', reading:'とどける', english:'deliver', englishThird:'delivers', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Document'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','transfer','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Document'],tags:genericObjectTags} } },
  { id:'tsutaeru-basic', japanese:'伝える', reading:'つたえる', english:'convey', englishThird:'conveys', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Document'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','communication','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Document'],tags:readableTags} } },
  { id:'uketoru-basic', japanese:'受け取る', reading:'うけとる', english:'receive', englishThird:'receives', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object','Document'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','transfer','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object','Document'],tags:genericObjectTags} } },
  { id:'azukeru-basic', japanese:'預ける', reading:'あずける', english:'leave', englishThird:'leaves', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object'], translationTemplate:'{Subject} {Verb} {Object} for safekeeping.', supportedGrammarForms:['dictionary','masu'], tags:['verb','transfer','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object'],tags:genericObjectTags} } },
  { id:'azukaru-basic', japanese:'預かる', reading:'あずかる', english:'look after', englishThird:'looks after', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Object'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','transfer','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Object'],tags:genericObjectTags} } },
  // Transitive verbs taking a Person object.
  { id:'maneku-basic', japanese:'招く', reading:'まねく', english:'invite', englishThird:'invites', verbClass:'godan-ku', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'mukaeru-basic', japanese:'迎える', reading:'むかえる', english:'welcome', englishThird:'welcomes', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'shoukai-suru', japanese:'紹介する', reading:'しょうかいする', english:'introduce', englishThird:'introduces', verbClass:'irregular', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','irregular','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'ouen-suru', japanese:'応援する', reading:'おうえんする', english:'cheer for', englishThird:'cheers for', verbClass:'irregular', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','irregular','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'hagemasu-basic', japanese:'励ます', reading:'はげます', english:'encourage', englishThird:'encourages', verbClass:'godan-su', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'homeru-basic', japanese:'褒める', reading:'ほめる', english:'praise', englishThird:'praises', verbClass:'ichidan', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','ichidan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
  { id:'shikaru-basic', japanese:'叱る', reading:'しかる', english:'scold', englishThird:'scolds', verbClass:'godan-ru', sentencePattern:'n5-01', subjectCategories:['Person'], objectCategories:['Person'], translationTemplate:'{Subject} {Verb} {Object}.', supportedGrammarForms:['dictionary','masu'], tags:['verb','social','godan','transitive'], slots:{ subject:{categories:['Person'],tags:humanSubjectTags}, object:{categories:['Person'],tags:humanSubjectTags} } },
]

export function getVerbUsageRecords(): VerbUsageRecord[] {
  return verbs.map(verb => ({
    ...verb,
    subjectCategories:[...verb.subjectCategories],
    objectCategories:[...verb.objectCategories],
    supportedGrammarForms:[...verb.supportedGrammarForms],
    tags:[...verb.tags],
    slots:Object.fromEntries(Object.entries(verb.slots).map(([slot,rule]) => [slot,{ categories:[...rule.categories], tags:rule.tags ? [...rule.tags] : undefined, words:rule.words }])),
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
    // Approved records carry the same coarse imported buckets the classifier
    // does, so they need the same tag-driven split — "time & numbers" is where
    // 現金/料金/給料 were arriving as Time. Approved records also *replace* the
    // built-in entry for a word outright (see the merge in editorWords), so
    // leaving this unrefined silently discarded the hand-authored Money
    // records for those words too.
    const recordTags = normalizeTags(record.tags)
    const categories = (record.categories?.length ? record.categories : [record.category]).flatMap(value => {
      const category = categoryLookup.get(value.toLowerCase())
      return category ? [refineCoarseCategory(category,recordTags)] : []
    })
    if (!categories.length) return []
    const preferredTranslation = inferPreferredTranslation(record.japanese,record.english,record.reading) || record.preferredTranslation?.trim() || record.english
    // Deliberately NOT given canonical category tags. An approved record's tag
    // set is the reviewed artifact — a reviewer who left `person` off a
    // Person-category word was making a judgement, and injecting it back
    // overrides them. 共 ("both; together; plural ending") is filed under
    // Person and reviewed down to together/companion/group precisely so it
    // never becomes a sentence subject; adding `person` produced "共は足が痛く
    // ないです" ("a both's foot does not hurt").
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

let generatorWordCache: WordRecord[] | null = null

if (typeof window !== 'undefined') {
  window.addEventListener(CONTENT_DATABASE_EVENT,()=>{ generatorWordCache=null })
}

/**
 * The vocabulary generators may draw from, as opposed to the one the editor
 * lists.
 *
 * A composite entry such as 目/眼 is two dictionary alternatives joined by a
 * slash in the source data, never a usable surface — 「課長は目/眼が痛いです」
 * reached the dashboard because the slash-guard was applied per pool, and the
 * body-part pool was one of several hand-rolled `vocabulary.filter(...)` calls
 * that had never had it added. Filtering once, here, is what makes that
 * impossible rather than merely fixed in the places someone remembered.
 *
 * Content Studio keeps reading editorWords() directly: a reviewer needs to see
 * these entries in order to repair them.
 */
function generatorWords(): WordRecord[] {
  if (generatorWordCache) return generatorWordCache
  generatorWordCache = editorWords().filter(word => !hasCompositeSurface(word) && hasUsableMeaning(word))
  return generatorWordCache
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

/**
 * Builds the slot picker a pattern generator uses, biased so that a
 * caller-required word wins the first slot it legitimately fits. Each pool has
 * already been through that pattern's own category/tag filtering, so preferring
 * a member of it can never bypass a compatibility rule — it only decides which
 * of the already-valid candidates is chosen. Pools hold either vocabulary
 * records or small literal `{surface}` objects depending on the pattern, so
 * both shapes are recognised.
 */
function requiredWordPicker(seed: number, requiredWord?: string, options: CategorySentenceOptions = {}) {
  let pending = Boolean(requiredWord)
  const surfaceOf = (item: unknown) => {
    if (!item || typeof item !== 'object') return undefined
    const record = item as { japanese?: string; surface?: string }
    return record.japanese ?? record.surface
  }
  // A pick tagged with a slot name can be re-seeded and have its current word
  // excluded independently of the rest of the sentence — the same mechanism
  // the base N5/N4 generator gets from fillVerbSlots, extended to the
  // hand-templated N5/N4/N3 generators that pick their own slots directly.
  return <T>(pool: T[], salt: number, slot?: string): T | null => {
    let candidatePool = pool
    if (slot && options.avoidWords?.[slot]) {
      const avoided = candidatePool.filter(item => surfaceOf(item) !== options.avoidWords![slot])
      if (avoided.length) candidatePool = avoided
    }
    if (!candidatePool.length) return null
    if (pending) {
      const match = candidatePool.find(item => surfaceOf(item) === requiredWord)
      if (match !== undefined) {
        pending = false
        return match
      }
    }
    return seededPick(candidatePool, slot ? options.slotSeeds?.[slot] ?? seed : seed, salt)
  }
}

/**
 * A generator can legitimately produce a sentence without the required word
 * (the word may fit no slot in that particular pattern). Callers asked for a
 * sentence *containing* the word, so treat that as a miss rather than a result.
 */
function enforceRequiredWord(sentence: GeneratedPreviewSentence | null, options: CategorySentenceOptions) {
  if (!options.requiredWord || !sentence) return sentence
  return sentence.japanese.includes(options.requiredWord) ? sentence : null
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
  'water','rice','bread','milk','tea','coffee','juice','alcohol','sake','beer','wine','soup','miso soup','ramen','sushi','udon','soba','pasta',
  'meat','beef','pork','chicken','fish','seafood','fruit','food','sugar','salt','oil','butter','cheese','ice cream',
  'money','music','information','news','homework','work','weather','clothing','furniture','luggage','advice','anime','paper','mail',
  // "takes medicine", never "takes a medicine".
  'medicine',
  // These foods are generally treated as substances when eaten.
  'pizza','curry','salad','chocolate','candy','cereal','yogurt','tofu',
  // Language names take no article as a study/speech object: “speaks Japanese”, not “speaks a Japanese”.
  'japanese','english','chinese','french','spanish','german','korean',
  // Academic subjects read as a field of study, not a countable item: “studied math”, not “studied a math”.
  'math','mathematics','history','grammar','pronunciation','science','literature','philosophy','kanji','lunch',
  // Eaten as a substance in these frames — "only eats cake", not "eats a cake".
  'cake','feed','animal feed',
])
// テレビ is the set when you want one and the medium when you watch it, so the
// article depends on the verb rather than on the noun.
const mediumNotDeviceVerbs = new Set(['見る'])

/** Plural-only nouns and regular plurals, for is/are agreement. */

/** Regular English plural, enough for the concrete nouns the counters take. */
function pluralize(noun: string) {
  if (/(s|x|z|ch|sh)$/i.test(noun)) return `${noun}es`
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0,-1)}ies`
  return `${noun}s`
}

/**
 * Plural of a person noun. `pluralize` is a spelling rule and person nouns are
 * where English keeps its irregulars, so it produced "womans" and "grandchilds".
 * Glosses that are already plural (両親 "parents") are left alone.
 */
const irregularPersonPlurals: Record<string,string> = {
  woman:'women', man:'men', child:'children', grandchild:'grandchildren',
  person:'people', wife:'wives', housewife:'housewives', policeman:'policemen',
  policewoman:'policewomen', salesman:'salesmen', businessman:'businessmen',
  fisherman:'fishermen', chairman:'chairmen',
}
function pluralizePerson(gloss: string) {
  if (isPluralPhrase(gloss)) return gloss
  const lower = gloss.toLowerCase()
  if (irregularPersonPlurals[lower]) return irregularPersonPlurals[lower]!
  // Compounds inherit the head's irregular plural: "older brother" → "older
  // brothers" is regular, but "old man" → "old men" is not.
  const head = lower.split(' ').pop()!
  if (irregularPersonPlurals[head]) return `${gloss.slice(0, gloss.length - head.length)}${irregularPersonPlurals[head]}`
  return pluralize(gloss)
}
/** People whose gloss is inherently definite or non-countable in this frame. */
const countableExemptPeople = new Set([
  '私','僕','俺','私たち','我々','あなた','君','お前','彼','彼女','彼ら','自分','皆',
  // Group nouns whose English gloss is singular and so slips past the
  // already-plural test: 夫婦 is counted with 組, 家族 with 人 only when you
  // mean its members.
  '夫婦','家族','兄弟','姉妹','親戚','双子',
])

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
  // A modified mass noun stays a mass noun — "black tea", "green tea",
  // "fruit juice" are all as article-less as their head word is, so match on
  // the head instead of enumerating every modifier the vocab data may use.
  const head = lower.split(' ').pop()!
  if (head !== lower && uncountableGlosses.has(head)) return gloss
  return indefinite(gloss)
}

/**
 * An abstract noun in a topic slot. The default is "the", which is the mirror
 * of the reasoning behind `objectEnglish`: half these glosses are countable
 * ("the reason", "the result", "the problem") and a bare countable noun is
 * outright broken, whereas a definite mass noun ("the experience") is at worst
 * slightly narrower than intended. Japanese topic nouns in these frames are
 * contextually definite anyway, so "the" is usually the better reading. Glosses
 * already known to be uncountable keep taking no article at all.
 */
function abstractTopicEnglish(gloss: string) {
  const lower = gloss.toLowerCase()
  if (uncountableGlosses.has(lower) || abstractMassGlosses.has(lower)) return gloss
  return `the ${gloss}`
}

// Abstractions that name a whole domain rather than an instance of one. These
// are the cases where the definite article is not merely narrow but wrong:
// "talks about life", never "talks about the life".
const abstractMassGlosses = new Set([
  'life','death','nature','society','culture','education','knowledge','freedom','happiness','love','trust','permission','responsibility','experience','knowledge','ethics','reality','nostalgia','jealousy','hope','peace','justice','honesty','patience','courage','luck','fate','progress','growth','health','beauty','truth','power','strength','confidence','pride','respect','stress','sleep','fun','trouble','damage','demand','supply','evidence',
])

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
  // Added with the destination widening above: without these, 市場/劇場/地域
  // rendered as "goes to market" with no article at all.
  'market','theater','region','street','urban',
  'bathroom','bedroom','living-room','classroom',
  // Kept in sync with standaloneDestinationTags' zoo/port/hot-spring/
  // countryside/aquarium/direction additions — without an entry here too,
  // those newly-reachable words fell through to a bare gloss ("comes to
  // zoo") instead of "comes to the zoo".
  'zoo','port','hot-spring','countryside','aquarium','direction',
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
  // The dictionary gloss for these is written for general use ("properly,
  // neatly, correctly" / "with utmost effort"), not for sitting directly
  // before "reads"/"writes" in a sentence — a plain -ly adverb reads far more
  // naturally there than the raw dictionary sense.
  if (slot === 'adverb') {
    const readingWritingAdverbEnglish: Record<string,string> = {
      きちんと:'properly', 静かに:'quietly', はっきり:'clearly',
      丁寧に:'carefully', しっかり:'attentively', 一生懸命:'diligently',
      // Same reason as above: the dictionary glosses here are "early", "abrupt",
      // "direct" and "more and more", none of which sit correctly in front of a
      // verb the way the adverbial form does.
      早く:'quickly', 突然:'suddenly', 急に:'suddenly', 直接:'directly',
      どんどん:'rapidly', いつも:'always', 常に:'always',
    }
    if (readingWritingAdverbEnglish[word.japanese]) return readingWritingAdverbEnglish[word.japanese]!
  }
  if (slot === 'companion' || slot === 'recipient') {
    const pronounByJapanese: Record<string,string> = { '私':'me','私自身':'me','俺':'me','僕':'me','我々':'us','私たち':'us','彼':'him','彼女':'her','彼ら':'them','あなた':'you','君':'you','お前':'you' }
    if (pronounByJapanese[word.japanese]) return pronounByJapanese[word.japanese]!
    const phrase=animateEnglish(word,gloss)
    const objectPronouns: Record<string,string> = { I:'me',we:'us',he:'him',she:'her',they:'them' }
    return objectPronouns[phrase] ?? phrase
  }
  if (slot === 'object' && word.japanese === '果物') return 'fruit'
  if (slot === 'object' && word.japanese === '意味') return definite(gloss)
  if (slot === 'object') {
    // A person as a direct object ("waits for you") still needs object-case
    // pronouns, not the indefinite article objectEnglish() adds to nouns.
    const pronounByJapanese: Record<string,string> = { '私':'me','私自身':'me','俺':'me','僕':'me','我々':'us','私たち':'us','彼':'him','彼女':'her','彼ら':'them','あなた':'you','君':'you','お前':'you' }
    if (pronounByJapanese[word.japanese]) return pronounByJapanese[word.japanese]!
    return objectEnglish(gloss)
  }
  if (slot === 'location') {
    if (/^(?:inside|in front of|behind|next to)\b/i.test(gloss)) return gloss
    if (word.japanese === '床' || tags.has('floor')) return 'on the floor'
    if (tags.has('home') && ['家','うち','自宅'].includes(word.japanese)) return 'at home'
    if (tags.has('island')) return `on ${/^[A-Z]/.test(gloss) ? gloss : indefinite(gloss)}`
    if ([...tags].some(tag=>['country','city','town','village','neighborhood'].includes(tag))) return `in ${/^[A-Z]/.test(gloss) ? gloss : definite(gloss)}`
    if ([...tags].some(tag => ['room','kitchen','bathroom','bedroom','living-room','classroom','house'].includes(tag))) return `in ${definite(gloss)}`
    if (tags.has('school') && /^school$/i.test(gloss)) return 'at school'
    return `at ${definite(gloss)}`
  }
  if (slot === 'destination' || slot === 'source') {
    // 店内 already glosses as "inside the store" — prepending an article gives
    // "to the inside the store". Same guard the location slot applies.
    if (/^(?:inside|outside|in front of|behind|next to)\b/i.test(gloss)) return gloss
    if (tags.has('home') && ['家','うち','自宅'].includes(word.japanese)) return 'the house'
    if ([...tags].some(tag => definitePlaceTags.has(tag))) return definite(gloss)
    if ([...tags].some(tag => ['country','city','town','village','island'].includes(tag))) return /^[A-Z]/.test(gloss) ? gloss : indefinite(gloss)
  }
  if (slot === 'time') {
    const monthEnglish: Record<string,string> = { 一月:'January', 二月:'February', 三月:'March', 四月:'April', 五月:'May', 六月:'June', 七月:'July', 八月:'August', 九月:'September', 十月:'October', 十一月:'November', 十二月:'December' }
    if (monthEnglish[word.japanese]) return `in ${monthEnglish[word.japanese]}`
    if (tags.has('month') || /^[一二三四五六七八九十]+月$/.test(word.japanese)) return `in ${gloss}`
    if (tags.has('morning')) return `in ${definite(gloss)}`
    if (tags.has('afternoon') || tags.has('evening')) return `in ${definite(gloss)}`
    if (tags.has('night') || tags.has('noon') || tags.has('midnight')) return `at ${gloss}`
    if ((tags.has('clock-time') || tags.has('hour')) && !/^at\b/i.test(gloss)) return `at ${gloss}`
    if (tags.has('season') || ['春','夏','秋','冬'].includes(word.japanese)) return `in ${gloss}`
    if (tags.has('weekday') || tags.has('day-of-week') || /曜日$/.test(word.japanese)) return `on ${gloss}`
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

/**
 * Subject pronoun for a second mention of the same subject in one sentence —
 * "while a lover is young, they study" rather than repeating the noun phrase.
 * The vocabulary pools carry no gender, so a third-person noun takes they/them
 * instead of guessing he or she.
 */
function subjectPronoun(subjectEnglish: string) {
  const lower = subjectEnglish.toLowerCase()
  if (lower === 'i') return 'I'
  if (['you','we','they','he','she','it'].includes(lower)) return lower
  return 'they'
}

/**
 * The copula agreeing with a subject phrase. "I" is the one subject that takes
 * neither is nor are, which is the trap in writing this inline: subjectUsesBaseVerb
 * returns true for "I", so the obvious `usesBase ? 'are' : 'is'` yields "I are".
 */
function copulaFor(subjectEnglish: string) {
  if (subjectEnglish === 'I') return 'am'
  return subjectUsesBaseVerb(subjectEnglish) ? 'are' : 'is'
}

function subjectUsesBaseVerb(subject: string) {
  // A possessive can sit in front of the noun — “my parents” is still plural —
  // so plurality is decided by the head noun, not by the first word.
  if (/^(?:I|you|we|they)\b/i.test(subject)) return true
  return isPluralPhrase(subject)
}

function translatedVerb(verb: VerbUsageRecord, filled: Record<string,WordRecord>, useBase: boolean) {
  const objectTags = filled.object ? tagSet(filled.object) : new Set<string>()
  if (verb.japanese === '焼く' && (objectTags.has('meat') || objectTags.has('seafood') || objectTags.has('fish'))) {
    return useBase ? 'grill' : 'grills'
  }
  if (verb.japanese === '見る' && (objectTags.has('picture') || objectTags.has('photo'))) {
    return useBase ? 'look at' : 'looks at'
  }
  // Japanese drinks medicine; English takes it. 薬を飲む is the reason the
  // Medicine category reaches 飲む at all, so the gloss has to follow.
  if (verb.japanese === '飲む' && objectTags.has('medicine')) {
    return useBase ? 'take' : 'takes'
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
  const rawVerb = verbOverride ?? translatedVerb(verb, filled, subjectUsesBaseVerb(subject))
  // 感動する and friends store their English as a bare copula phrase ("be
  // moved") so modal frames can say "must be moved". A plain declarative has to
  // conjugate it — otherwise the template renders "I be moved".
  const englishVerb = /^be\b/.test(rawVerb)
    ? rawVerb.replace(/^be\b/, subject === 'I' ? 'am' : subjectUsesBaseVerb(subject) ? 'are' : 'is')
    : rawVerb
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
  // 眠り始める is grammatical, but 寝始める is the natural expression for
  // starting to sleep / going to sleep.
  if (patternId === 'n4-10' && verb.id === 'nemuru-time') return { japanese:'寝始めます', reading:'ねはじめます' }
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
  let requiredWordPending=Boolean(options.requiredWord)
  for (const [slot,rule] of Object.entries(verb.slots)) {
    // A composite entry like "町／街" is two words joined by a slash in the
    // source data, not one usable word — the generator must pick one, not
    // paste the raw alternatives straight into a sentence.
    let pool=vocabulary.filter(word=>categoryMatch(word,rule.categories) && !hasCompositeSurface(word) && hasUsableMeaning(word))
    if (rule.tags?.length) pool=pool.filter(word=>matchingTags(word,rule.tags).length>0)
    // A word only reaches 食べる through a Food category, but an import can file a
    // drink there. Anything drinkable that is not also solid food is not eaten.
    if (verb.japanese === '食べる' && slot === 'object') pool=pool.filter(word=>!['米','食べ物'].includes(word.japanese)
      && !(matchingTags(word,drinkableTags).length>0 && matchingTags(word,solidFoodTags).length===0)
      && !(matchingTags(word,cookingInputTags).length>0 && matchingTags(word,solidFoodTags).length===0))
    if (verb.japanese === '飲む' && slot === 'object') pool=pool.filter(word=>
      !solidFoodWords.has(word.japanese) && matchingTags(word,solidFoodTags).length===0)
    // 揚げる specifically means deep-fry, not "cook" in general — rice/meals are
    // not deep-fried, only foods actually suited to the technique are.
    if (verb.id === 'ageru-fry-basic' && slot === 'object') pool=pool.filter(word=>matchingTags(word,deepFryableTags).length>0)
    // Alcohol needs an adult subject — a child/pupil drinking 酒 is not a
    // plausible sentence regardless of how natural the verb usage otherwise is.
    if (verb.id === 'nomu-basic' && slot === 'object' && filled.subject
      && [...tagSet(filled.subject)].some(tag=>minorSubjectTags.has(tag))) {
      pool=pool.filter(word=>matchingTags(word,['alcohol']).length===0)
    }
    if (verb.id === 'yomu-adverb' && slot === 'object') pool=pool.filter(word=>!tagSet(word).has('news')&&word.japanese!=='ニュース')
    // readingMannerTags only actually matches one word in the vocabulary
    // (ゆっくり) — every other manner-of-reading adverb that exists (静かに,
    // はっきり, 丁寧に, ...) is tagged inconsistently (some as plain
    // "unclassified"), so the tag filter alone starves this slot down to a
    // single word repeated forever. Widening by literal text, the same way
    // several other slots above do, doesn't require re-tagging the whole
    // vocabulary to get the words that already exist into rotation.
    if (slot === 'adverb' && rule.tags === readingMannerTags) {
      const extraMannerAdverbs = new Set(['静かに','はっきり','丁寧に','一生懸命','しっかり','きちんと'])
      const extra = vocabulary.filter(word => extraMannerAdverbs.has(word.japanese))
      if (extra.length) pool = [...pool, ...extra]
    }
    if (rule.words) pool = pool.filter(word => rule.words!.has(word.japanese))
    if (verb.japanese === '読む' && slot === 'object') pool=pool.filter(word=>!unreadableObjectWords.has(word.japanese))
    if (verb.id === 'hirou-basic' && slot === 'object') pool=pool.filter(word=>!['光','電気','音','熱','空気','影'].includes(word.japanese))
    // 冷蔵庫/冷凍庫 carry a 'kitchenware' tag alongside 'machine'/'household'
    // (kitchenware tagging doesn't distinguish handheld dishware from large
    // appliances) — kitchenware was widened onto handHeldObjectTags for 箸/
    // 茶碗/皿, but "holds a refrigerator" is exactly what that list's own
    // comment says to keep out.
    if (verb.id === 'motsu-basic' && slot === 'object') pool=pool.filter(word=>!['冷蔵庫','冷凍庫'].includes(word.japanese))
    // 見つける is most natural in these context-free examples when the thing
    // plausibly went missing; a television or washing machine needs a story.
    if (verb.id === 'mitsukeru-basic' && slot === 'object') {
      const findableLostItems = new Set(['鍵','財布','手紙','切符','チケット','携帯電話','電話','かばん','傘'])
      pool=pool.filter(word=>findableLostItems.has(word.japanese))
    }
    if (verb.id === 'ukeru-basic' && slot === 'object') {
      const receivableItems = new Set(['手紙','メール','荷物','賞','招待状','通知','電話'])
      pool=pool.filter(word=>receivableItems.has(word.japanese))
    }
    if (verb.id === 'narau-basic' && slot === 'object') pool=pool.filter(word=>narauCompatibleWords.has(word.japanese))
    // The classifier files any verb gloss under Activity right alongside real
    // する-compatible nouns like 買い物/料理/相談, and not every verb entry in
    // that bucket carries a reliable 'verb' tag (some come from an imported
    // source with its own tag set). Every Japanese verb dictionary form ends
    // in one of these hiragana; a real suru-noun essentially never does.
    // 把握 (grasp/understand) is itself transitive-shaped — "grasp" needs its own
    // object (状況を把握する), so bare "把握をします" reads as an incomplete verb
    // phrase rather than a real activity like 買い物 or 相談.
    if (verb.id === 'suru-basic' && slot === 'object') pool=pool.filter(word=>word.japanese!=='練習' && word.japanese!=='把握' && !/(?:[うくぐすつぬぶむる]|[てでたなければ])$/.test(word.japanese))
    if (slot === 'destination') pool=pool.filter(word=>{
      const tags=tagSet(word)
      if (verb.id === 'kayou-destination' && word.japanese === '教室') return false
      if (verb.id === 'hairu-destination' && word.japanese === '入口') return false
      // 廊下 carries the same 'room' tag as an actual room, but a hallway is a
      // route you pass through, not somewhere you'd flee TO and stay.
      if (verb.id === 'nigeru-destination' && word.japanese === '廊下') return false
      return word.japanese!=='庭'&&!destinationIncompatibleWords.has(word.japanese) && ![...tags].some(tag=>destinationIncompatibleTags.has(tag))
    })
    if (slot === 'location' && filled.subject && (verb.id === 'hataraku-location' || verb.id === 'tsutomeru-location')) {
      const subjectGloss = `${filled.subject.english} ${filled.subject.preferredTranslation ?? ''}`.toLowerCase()
      const requiredTags = occupationWorkplaceTags.find(([pattern]) => pattern.test(subjectGloss))?.[1]
      if (requiredTags) pool=pool.filter(word=>matchingTags(word,requiredTags).length>0)
    }
    if (slot === 'location' && (verb.id === 'hataraku-location' || verb.id === 'tsutomeru-location')) {
      pool=pool.filter(word=>!['廊下','台所','トイレ','浴室'].includes(word.japanese))
    }
    if (slot === 'location' && verb.id === 'tomaru-location') {
      // 庭/ベランダ carry a 'home' tag from imported data (they're part of a
      // home) but are outdoor features, not lodging — nobody "stays overnight
      // at the garden" the way they stay at a hotel or house.
      pool=pool.filter(word=>!['台所','キッチン','浴室','トイレ','廊下','庭','ベランダ','バルコニー'].includes(word.japanese))
    }
    // Now that iru-existence accepts animal subjects, "an elephant is at the
    // company" and "a cow is at the sales floor" are exactly the kind of
    // bizarre pairing personExistenceLocationTags exists to prevent for
    // people — just aimed at an institutional pool that makes no sense once
    // the subject isn't human. Swap to nature/farm/pet-appropriate places.
    if (slot === 'location' && verb.id === 'iru-existence' && filled.subject && [...tagSet(filled.subject)].some(tag=>animalSubjectTags.includes(tag))) {
      const animalPool = pool.filter(word=>matchingTags(word,animalExistenceLocationTags).length>0)
      if (animalPool.length) pool = animalPool
    }
    if (slot === 'time') pool=pool.filter(word=>{
      const tags=tagSet(word)
      return !niIncompatibleTimeWords.has(word.japanese) && ![...tags].some(tag=>niIncompatibleTimeTags.has(tag))
    })
    // A verb that explicitly opts into animal subjects (iru-existence declares
    // subjectCategories:['Person','Animal']) had that permission silently
    // overridden here — this filter ran for every subject slot regardless of
    // what the verb itself allowed, so 馬/牛/虫/etc never reached even the one
    // verb built to accept them.
    const verbAllowsAnimalSubjects = verb.subjectCategories.includes('Animal')
    if (slot === 'subject' || slot === 'companion') pool=pool.filter(word=>{
      const tags=tagSet(word)
      return !politeSubjectIncompatibleWords.has(word.japanese)
        && !contextDependentSubjectWords.has(word.japanese)
        && !preferLongerFormWords.has(word.japanese)
        && !formalRegisterSubjectWords.has(word.japanese)
        && !tags.has('question')
        && !tags.has('question-word')
        && !tags.has('interrogative')
        && (verbAllowsAnimalSubjects || ![...tags].some(tag=>nonHumanSubjectTags.has(tag)))
    })
    if (slot === 'subject' && (verb.id === 'hataraku-location' || verb.id === 'tsutomeru-location')) {
      pool=pool.filter(word=>{
        const tags=tagSet(word)
        if (['客','お客様','患者','病人'].includes(word.japanese)) return false
        return tags.has('occupation') || tags.has('employee') || tags.has('worker') || tags.has('teacher') || tags.has('doctor') || tags.has('nurse') || tags.has('student')
      })
    }
    // Interrogative pronouns (誰/だれ/どなた) leak in as Person-category words
    // for who-question patterns elsewhere, but they read as nonsense objects
    // in plain declarative sentences ("introduces a who"), so exclude them here too.
    if (slot === 'object') pool=pool.filter(word=>{
      const tags=tagSet(word)
      return !politeSubjectIncompatibleWords.has(word.japanese)
        // Verb object pools are built straight from the vocabulary rather than
        // through validInanimatePool, so they need the same standalone-object
        // exclusions that pool applies (税込み, こと, もの…).
        && !invalidStandaloneObjectWords.has(word.japanese)
        && !tags.has('question')
        && !tags.has('question-word')
        && !tags.has('interrogative')
    })
    // A professional driver drinking alcohol is an especially misleading
    // default scenario in a beginner sentence generator.
    if (slot === 'object' && verb.id === 'nomu-basic' && filled.subject?.japanese === '運転手') {
      pool=pool.filter(word=>word.japanese !== '酒')
    }
    // 餌 is what a person feeds an animal, not what they eat. The vocab data
    // tags it as food, which otherwise lets it fill any human eating slot.
    if (slot === 'object' && verb.tags.includes('eating')) {
      pool=pool.filter(word=>word.japanese !== '餌')
    }
    // 残す + 電話 means leaving a telephone behind, not leaving a message.
    // Keep phone out of this generic object slot until the generator has a
    // dedicated "leave a message" construction.
    if (slot === 'object' && verb.id === 'nokosu-basic') {
      pool=pool.filter(word=>!['電話','携帯電話'].includes(word.japanese))
    }
    // 集まる describes a group gathering; a single companion is not enough.
    if (slot === 'subject' && verb.id === 'atsumaru-basic') {
      pool=pool.filter(word=>['人々','家族','両親','仲間たち'].includes(word.japanese))
    }
    if (slot === 'subject' && verb.id === 'aru-existence' && filled.location) {
      const location=filled.location.japanese
      // Cars belong in a parking area or garage, not literally in a library.
      pool=pool.filter(word=>!['車','自動車'].includes(word.japanese) || ['駐車場','車庫','家'].includes(location))
      // These combinations are grammatical but too arbitrary to teach as
      // standalone examples.
      if (location === '美容院') pool=pool.filter(word=>word.japanese !== '切手')
      if (location === '消防署') pool=pool.filter(word=>word.japanese !== '本')
    }
    if (slot === 'companion' && filled.subject) pool=pool.filter(word=>word.id!==filled.subject.id)
    if (slot === 'companion' && verb.id === 'asobu-companion' && filled.subject) {
      const subjectTags=tagSet(filled.subject)
      if ([...subjectTags].some(tag=>['child','boy','girl','son','daughter'].includes(tag))) {
        pool=pool.filter(word=>!['息子','娘'].includes(word.japanese))
      }
    }
    if (slot === 'companion') pool=pool.filter(word=>word.japanese!=='女')
    // 出会う means an unexpected or first-time encounter. A customer/guest/client
    // implies a pre-existing service relationship, which reads as a planned
    // meeting rather than a chance one — 会う fits those roles, not 出会う.
    if (slot === 'companion' && verb.id === 'deau-companion') pool=pool.filter(word=>!['人','人々','個人','客','お客様','患者'].includes(word.japanese))
    // Rotation asks for a *different* word in this slot. Dropping the current
    // one from the pool up front means the very next pick is a genuine change
    // instead of relying on a random re-roll to eventually miss it — the pools
    // for many verb+slot combinations are only a handful of words wide.
    if (options.avoidWords?.[slot]) {
      const avoided=pool.filter(word=>word.japanese!==options.avoidWords![slot])
      if (avoided.length) pool=avoided
    }
    if (!pool.length) return null
    // The required word is chosen from the *filtered* pool, so it only lands in
    // a slot it genuinely qualifies for — every category, tag, and per-verb
    // compatibility rule above has already been applied to `pool`.
    const required = requiredWordPending
      ? pool.find(word=>word.japanese===options.requiredWord)
      : undefined
    if (required) requiredWordPending=false
    filled[slot]=required ?? seededPick(pool,options.slotSeeds?.[slot]??seed,salt++)
    slotTagMatches[slot]=matchingTags(filled[slot],rule.tags)
  }
  // Asked for a sentence containing a specific word but no slot could take it:
  // fail rather than quietly return a sentence that doesn't use it.
  if (requiredWordPending) return null
  return { filled,slotTagMatches }
}

function baseFurigana(verb: VerbUsageRecord, filled: Record<string,WordRecord>, form: VerbForm) {
  const wordPart=(slot: string)=>({text:filled[slot]!.japanese,reading:kanaReading(filled[slot]!.reading,filled[slot]!.japanese),slot})
  const verbPart=()=>({text:form.japanese,reading:kanaReading(form.reading,form.japanese),slot:'verb'})
  const literalPart=(text: string,reading=text)=>({text,reading})
  const builders: Record<string,()=>GeneratedPreviewSentence['furigana']> = {
    // An optional bare relative-time adjunct (毎日, 今日, ...) — filled.time
    // only exists when generateCategorySentence's own seeded coin-flip chose
    // to add one for this sentence; every other n5-01 verb keeps the plain
    // three-part shape untouched.
    'n5-01':()=>filled.time
      ? [wordPart('time'),literalPart('、'),wordPart('subject'),literalPart('は','わ'),wordPart('object'),literalPart('を'),verbPart()]
      : [wordPart('subject'),literalPart('は','わ'),wordPart('object'),literalPart('を'),verbPart()],
    'n5-02':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('destination'),literalPart('に'),verbPart()],
    'n5-03':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('location'),literalPart('で'),wordPart('object'),literalPart('を'),verbPart()],
    'n5-04':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('companion'),literalPart('と'),verbPart()],
    'n5-05':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('time'),literalPart('に'),verbPart()],
    'n5-09':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('object'),literalPart('を'),wordPart('adverb'),verbPart()],
    'n5-10':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('destination'),literalPart('へ','え'),verbPart()],
    'n5-25':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('location'),literalPart('で'),verbPart()],
    'n5-26':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('location'),literalPart('に'),verbPart()],
    'n5-27':()=>[wordPart('location'),literalPart('に'),wordPart('subject'),literalPart('が'),verbPart()],
    'n5-28':()=>[wordPart('subject'),literalPart('は','わ'),verbPart()],
    'n5-29':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('source'),literalPart('から'),verbPart()],
    // Means of transport: 電車で行きます. Distinct from n5-25's location で
    // ("by train", not "at the station") and from n5-31's 乗る, which is
    // boarding rather than travelling by.
    'n5-32':()=>[wordPart('subject'),literalPart('は','わ'),wordPart('transport'),literalPart('で'),verbPart()],
  }
  return builders[verb.sentencePattern]?.() ?? null
}

/**
 * English marks the comparative with -er on short adjectives (big → bigger,
 * busy → busier) but switches to "more X" once the word gets long or ends in
 * a multi-syllable suffix (famous, energetic) — "more strong"/"more weak"
 * reads as a learner mistake, not a stylistic choice.
 */
function comparativeForm(word: string): string {
  const irregular: Record<string,string> = { good:'better', bad:'worse', far:'farther', little:'less', many:'more', much:'more' }
  if (irregular[word]) return irregular[word]!
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0,-1)}ier`
  if (word.endsWith('e')) return `${word}r`
  if (word.length <= 6 && !/(?:ous|ful|ive|al|ing|ic)$/.test(word)) {
    return doublesFinalConsonant(word) ? `${word}${word.slice(-1)}er` : `${word}er`
  }
  return `more ${word}`
}

function presentParticiple(phrase: string) {
  const [head,...rest]=phrase.split(' ')
  const irregular: Record<string,string> = { eat:'eating',drink:'drinking',read:'reading',watch:'watching',look:'looking',go:'going',talk:'talking',wake:'waking',forget:'forgetting',be:'being',get:'getting',put:'putting',run:'running',sit:'sitting',begin:'beginning',stop:'stopping' }
  const transformed=irregular[head!]
    ?? (head!.endsWith('e') ? `${head!.slice(0,-1)}ing`
      : doublesFinalConsonant(head!) ? `${head}${head!.slice(-1)}ing`
      : `${head}ing`)
  return [transformed,...rest].join(' ')
}

/**
 * English doubles a final consonant before -ed/-ing when the last syllable is
 * stressed. Stress is not recoverable from spelling, but single-syllable verbs
 * are always stressed on their only syllable, so restricting the rule to those
 * gets drop/dropped and wrap/wrapped right without breaking visit/visited.
 */
function doublesFinalConsonant(head: string) {
  const vowelGroups = head.match(/[aeiou]+/gi)
  if (!vowelGroups || vowelGroups.length !== 1) return false
  // Consonant-vowel-consonant, where the final consonant is not w/x/y — those
  // never double ("show" → "showed", "fix" → "fixed", "play" → "played").
  return /[^aeiou][aeiou][^aeiouwxy]$/i.test(head)
}

function regularPast(head: string) {
  if (head.endsWith('e')) return `${head}d`
  if (/[^aeiou]y$/i.test(head)) return `${head.slice(0,-1)}ied`
  if (doublesFinalConsonant(head)) return `${head}${head.slice(-1)}ed`
  return `${head}ed`
}

function pastParticiple(phrase: string) {
  const [head,...rest]=phrase.split(' ')
  const irregular: Record<string,string> = { be:'been',break:'broken',choose:'chosen',eat:'eaten',drink:'drunk',forget:'forgotten',give:'given',read:'read',watch:'watched',look:'looked',go:'gone',come:'come',get:'gotten',run:'run',hold:'held',have:'had',sit:'sat',sleep:'slept',spread:'spread',invite:'invited',save:'saved',dislike:'disliked',talk:'talked',wake:'woken',buy:'bought',make:'made',use:'used',write:'written',meet:'met',fight:'fought',lend:'lent',
    find:'found',feel:'felt',lose:'lost',send:'sent',spend:'spent',teach:'taught',catch:'caught',bring:'brought',think:'thought',sell:'sold',tell:'told',leave:'left',win:'won',wear:'worn',take:'taken',see:'seen',know:'known',grow:'grown',throw:'thrown',ride:'ridden',drive:'driven',fall:'fallen',feed:'fed',hear:'heard',keep:'kept',stand:'stood',understand:'understood',begin:'begun',swim:'swum',sing:'sung',speak:'spoken',steal:'stolen',pay:'paid',say:'said',become:'become',build:'built',mean:'meant',fly:'flown',cut:'cut',put:'put',hit:'hit',set:'set',let:'let',hurt:'hurt',shut:'shut',lie:'lain',rise:'risen',wash:'washed',forgive:'forgiven' }
  return [irregular[head!] ?? regularPast(head!),...rest].join(' ')
}

function simplePast(phrase: string) {
  const [head,...rest]=phrase.split(' ')
  const irregular: Record<string,string> = { be:'was',break:'broke',choose:'chose',eat:'ate',drink:'drank',forget:'forgot',give:'gave',read:'read',watch:'watched',look:'looked',go:'went',come:'came',get:'got',run:'ran',sit:'sat',hold:'held',have:'had',sleep:'slept',spread:'spread',invite:'invited',save:'saved',dislike:'disliked',compete:'competed',talk:'talked',wake:'woke',buy:'bought',make:'made',use:'used',write:'wrote',meet:'met',fight:'fought',lend:'lent',
    find:'found',feel:'felt',lose:'lost',send:'sent',spend:'spent',teach:'taught',catch:'caught',bring:'brought',think:'thought',sell:'sold',tell:'told',leave:'left',win:'won',wear:'wore',take:'took',see:'saw',know:'knew',grow:'grew',throw:'threw',ride:'rode',drive:'drove',fall:'fell',feed:'fed',hear:'heard',keep:'kept',stand:'stood',understand:'understood',begin:'began',swim:'swam',sing:'sang',speak:'spoke',steal:'stole',pay:'paid',say:'said',become:'became',build:'built',mean:'meant',fly:'flew',cut:'cut',put:'put',hit:'hit',set:'set',let:'let',hurt:'hurt',shut:'shut',lie:'lay',rise:'rose',wash:'washed',forgive:'forgave' }
  return [irregular[head!] ?? regularPast(head!),...rest].join(' ')
}

function n4EnglishVerb(patternId: string,verb: VerbUsageRecord,filled: Record<string,WordRecord>) {
  const subject=englishPhrase(filled.subject!,'subject')
  const plural=subjectUsesBaseVerb(subject)
  const base=translatedVerb(verb,filled,true)
  if (patternId === 'n4-02' && verb.japanese === '起きる') return `${subject === 'I' ? 'am' : plural ? 'are' : 'is'} awake`
  if (patternId === 'n4-02' && verb.japanese === '行く') return `${plural?'have':'has'} gone`
  if (patternId === 'n4-02' && verb.japanese === '置く') return `${plural?'have':'has'} placed`
  if (patternId === 'n4-02' && verb.japanese === '忘れる') return `${plural?'have':'has'} forgotten`
  if (patternId === 'n4-08' && verb.japanese === '来る') return `${plural?'have':'has'} been to`
  if (patternId === 'n4-08' && (verb.id === 'iru-existence' || verb.id === 'aru-existence')) return `${plural?'have':'has'} been`
  if (patternId === 'n4-06' && (verb.id === 'iru-existence' || verb.id === 'aru-existence')) return 'may be'
  // A copula-phrase base ("be troubled") reads fine after "to" or "must
  // (not)" but breaks after bare "does/do not" — "does not be troubled" —
  // the same fix the ending-rotation negation uses below.
  const copula=subject==='I'?'am':plural?'are':'is'
  const bareCopulaPhrase=/^be\b(.*)$/.exec(base)
  const negatedBase=bareCopulaPhrase ? `${copula} not${bareCopulaPhrase[1]}`
    : ['is','are','am'].includes(base) ? `${copula} not`
    : `${plural?'do':'does'} not ${base}`
  const forms: Record<string,string> = {
    'n4-01':`${plural?'want':'wants'} to ${base}`,
    'n4-02':`${subject === 'I' ? 'am' : plural ? 'are' : 'is'} ${presentParticiple(base)}`,
    'n4-03':simplePast(base),
    'n4-04':negatedBase,
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


/**
 * Counter forms, written out rather than composed.
 *
 * Japanese counters are not a number plus a suffix: 一本 is いっぽん, 三本 is
 * さんぼん and 六本 is ろっぽん, and the same gemination and rendaku hit 杯, 匹
 * and 個 differently. Generating the reading by rule would need all of those
 * exceptions encoded anyway, so the forms are simply listed and can be checked
 * by eye. Indexed 0-4 for one to five.
 *
 * This is what the Number category was missing. Its 34 entries are a grab-bag
 * of 一杯/まず/最初に/単位 alongside bare numerals, and a bare numeral cannot
 * appear in a sentence at all without one of these.
 */
const COUNTER_FORMS: Record<string, ReadonlyArray<readonly [string,string]>> = {
  satsu: [['一冊','いっさつ'],['二冊','にさつ'],['三冊','さんさつ'],['四冊','よんさつ'],['五冊','ごさつ']],
  hai:   [['一杯','いっぱい'],['二杯','にはい'],['三杯','さんばい'],['四杯','よんはい'],['五杯','ごはい']],
  ko:    [['一個','いっこ'],['二個','にこ'],['三個','さんこ'],['四個','よんこ'],['五個','ごこ']],
  mai:   [['一枚','いちまい'],['二枚','にまい'],['三枚','さんまい'],['四枚','よんまい'],['五枚','ごまい']],
  // 〜つ is the native series and is irregular throughout — ひとつ/ふたつ/みっつ
  // share no reading with 一/二/三 at all.
  tsu:   [['一つ','ひとつ'],['二つ','ふたつ'],['三つ','みっつ'],['四つ','よっつ'],['五つ','いつつ']],
  // 一人 and 二人 are ひとり/ふたり, not いちにん/357にん; from three on the
  // series is regular apart from 四人 being よにん rather than よんにん.
  nin:   [['一人','ひとり'],['二人','ふたり'],['三人','さんにん'],['四人','よにん'],['五人','ごにん']],
}
const COUNTER_ENGLISH = ['one','two','three','four','five'] as const

/**
 * Time words for n5-35, each with the tense its meaning forces.
 *
 * The tense is the whole point of the pattern: 昨日 requires a past verb and
 * 明日 forbids one, in both languages. Getting that wrong produces the single
 * most common learner error this vocabulary is involved in, so the time word
 * chooses the verb form rather than the two being drawn independently.
 *
 * None of these take に — they are relative to now, which is what
 * `niIncompatibleTimeWords` above records. Curated because the glosses in the
 * source data are unusable as adverbials: 後 is "afterwards", 先 is "future",
 * 頃 is "time".
 */
const TIME_ADVERBIALS: ReadonlyArray<{japanese:string;reading:string;english:string;tense:'past'|'future'|'present'}> = [
  { japanese:'今日', reading:'きょう', english:'today', tense:'present' },
  { japanese:'今', reading:'いま', english:'now', tense:'present' },
  { japanese:'今晩', reading:'こんばん', english:'tonight', tense:'present' },
  { japanese:'今週', reading:'こんしゅう', english:'this week', tense:'present' },
  { japanese:'今月', reading:'こんげつ', english:'this month', tense:'present' },
  { japanese:'今年', reading:'ことし', english:'this year', tense:'present' },
  { japanese:'週末', reading:'しゅうまつ', english:'on the weekend', tense:'present' },
  { japanese:'毎日', reading:'まいにち', english:'every day', tense:'present' },
  { japanese:'毎週', reading:'まいしゅう', english:'every week', tense:'present' },
  { japanese:'毎年', reading:'まいとし', english:'every year', tense:'present' },
  { japanese:'時々', reading:'ときどき', english:'sometimes', tense:'present' },
  { japanese:'普段', reading:'ふだん', english:'usually', tense:'present' },
  { japanese:'昨日', reading:'きのう', english:'yesterday', tense:'past' },
  { japanese:'先週', reading:'せんしゅう', english:'last week', tense:'past' },
  { japanese:'先月', reading:'せんげつ', english:'last month', tense:'past' },
  { japanese:'去年', reading:'きょねん', english:'last year', tense:'past' },
  { japanese:'最近', reading:'さいきん', english:'recently', tense:'past' },
  { japanese:'昔', reading:'むかし', english:'long ago', tense:'past' },
  { japanese:'明日', reading:'あした', english:'tomorrow', tense:'future' },
  { japanese:'来週', reading:'らいしゅう', english:'next week', tense:'future' },
  { japanese:'来月', reading:'らいげつ', english:'next month', tense:'future' },
  { japanese:'来年', reading:'らいねん', english:'next year', tense:'future' },
  { japanese:'将来', reading:'しょうらい', english:'in the future', tense:'future' },
]
const timeAdverbialWords = new Set(TIME_ADVERBIALS.map(entry => entry.japanese))

/**
 * Positional nouns for n5-36 — 机の上に本があります.
 *
 * These are relations, not places: 上 is "the top of something", so it cannot
 * stand in a destination slot the way 公園 can, which is why widening the
 * destination tags left them behind. In Japanese they are ordinary nouns joined
 * by の, and in English they are prepositions, so the frame has to translate a
 * two-noun construction into a preposition rather than word-for-word.
 *
 * `surfaceOnly` marks the ones that need the reference noun to have a top
 * surface — "on the cat" is not where you put a book.
 */
const POSITION_REFERENCE_SETS = {
  // 上 needs a top surface, 下 needs something with space beneath it, and 中
  // needs a container. Sharing one reference list produced "in the door" and
  // "under the park".
  surface: new Set(['机','椅子','棚','テーブル','ベッド']),
  under:   new Set(['机','椅子','棚','テーブル','ベッド','木','窓']),
  inside:  new Set(['部屋','家','鞄','店','病院','学校','駅']),
  beside:  new Set(['机','椅子','棚','窓','ドア','家','学校','駅','公園','店','病院','木']),
} as const
const POSITION_NOUNS: ReadonlyArray<{japanese:string;reading:string;english:string;references:keyof typeof POSITION_REFERENCE_SETS}> = [
  { japanese:'上', reading:'うえ', english:'on', references:'surface' },
  { japanese:'下', reading:'した', english:'under', references:'under' },
  { japanese:'中', reading:'なか', english:'in', references:'inside' },
  { japanese:'前', reading:'まえ', english:'in front of', references:'beside' },
  { japanese:'後ろ', reading:'うしろ', english:'behind', references:'beside' },
  { japanese:'横', reading:'よこ', english:'beside', references:'beside' },
  { japanese:'隣', reading:'となり', english:'next to', references:'beside' },
  { japanese:'近く', reading:'ちかく', english:'near', references:'beside' },
  { japanese:'そば', reading:'そば', english:'beside', references:'beside' },
]
const positionNounWords = new Set(POSITION_NOUNS.map(entry => entry.japanese))

/**
 * Question words for n5-37, each with the frame it belongs in.
 *
 * A question word is not interchangeable with the others: どこ replaces a
 * destination, 何 replaces an object, どうして replaces nothing and fronts the
 * whole clause. One question slot filled from a pool would produce 「学生は
 * どうしてを食べますか」, so each carries its own shape.
 *
 * Readings are stated because 何 is recorded as "nani / nan" — two readings in
 * one field, which would render as furigana literally reading "nani / nan".
 * Here it is なに, the reading 何を takes.
 *
 * どんな, どの, どちら and どれ are absent: they modify or choose between nouns
 * already under discussion, so they need a context this generator has no way to
 * establish. かしら is a sentence-ending particle, not a question word.
 */
const QUESTION_FRAMES: ReadonlyArray<{
  japanese:string
  reading:string
  shape:'destination'|'object'|'reason'|'price'
}> = [
  { japanese:'どこ', reading:'どこ', shape:'destination' },
  { japanese:'何', reading:'なに', shape:'object' },
  { japanese:'どうして', reading:'どうして', shape:'reason' },
  { japanese:'なぜ', reading:'なぜ', shape:'reason' },
  { japanese:'いくら', reading:'いくら', shape:'price' },
]
const questionWords = new Set(QUESTION_FRAMES.map(entry => entry.japanese))

/**
 * Weather words for n5-38, each with the frame its meaning takes.
 *
 * Weather does not have one shape: 雨 falls, 晴れ is a state, 風 is strong, and
 * 天気 is good or bad. English differs again — 「今日は雨です」 is "it is rainy
 * today", where the Japanese predicate is a noun and the English is an
 * adjective with a dummy subject Japanese does not use at all.
 */
const WEATHER_FRAMES: ReadonlyArray<{
  japanese:string
  reading:string
  shape:'state'|'falls'|'strong'|'quality'|'pretty'
  english:string
}> = [
  { japanese:'雨', reading:'あめ', shape:'state', english:'rainy' },
  { japanese:'雪', reading:'ゆき', shape:'state', english:'snowy' },
  { japanese:'晴れ', reading:'はれ', shape:'state', english:'sunny' },
  { japanese:'曇り', reading:'くもり', shape:'state', english:'cloudy' },
  { japanese:'雨', reading:'あめ', shape:'falls', english:'rains' },
  { japanese:'雪', reading:'ゆき', shape:'falls', english:'snows' },
  { japanese:'風', reading:'かぜ', shape:'strong', english:'wind' },
  { japanese:'雷', reading:'かみなり', shape:'strong', english:'thunder' },
  { japanese:'天気', reading:'てんき', shape:'quality', english:'weather' },
  { japanese:'景色', reading:'けしき', shape:'pretty', english:'scenery' },
  { japanese:'星', reading:'ほし', shape:'pretty', english:'stars' },
  { japanese:'雲', reading:'くも', shape:'pretty', english:'clouds' },
]
const weatherWords = new Set(WEATHER_FRAMES.map(entry => entry.japanese))
/** Only the present-tense time words make sense with a weather report. */
const WEATHER_TIMES = TIME_ADVERBIALS.filter(entry => entry.tense !== 'past' && ['今日','今週','明日','週末','今晩'].includes(entry.japanese))
/** Objects with a price, for the いくら frame. */
const PRICED_OBJECTS = new Set(['本','傘','鞄','靴','時計','眼鏡','切符','シャツ','辞書','雑誌','財布'])
const POSITION_SUBJECTS = new Set(['本','鞄','傘','皿','雑誌','新聞','辞書','時計','眼鏡','財布','鍵','猫','犬','鳥'])
/** Verb and object pairings for n5-35, in the two polite forms the tenses need. */
const TIMED_ACTION_FRAMES: ReadonlyArray<{
  words: ReadonlySet<string>
  present: {japanese:string;reading:string}
  past: {japanese:string;reading:string}
  english: {base:string;third:string;past:string}
}> = [
  { words:new Set(['本','小説','雑誌','辞書','教科書','漫画','新聞']),
    present:{japanese:'読みます',reading:'よみます'}, past:{japanese:'読みました',reading:'よみました'},
    english:{base:'read',third:'reads',past:'read'} },
  { words:new Set(['お茶','コーヒー','水','牛乳','ジュース']),
    present:{japanese:'飲みます',reading:'のみます'}, past:{japanese:'飲みました',reading:'のみました'},
    english:{base:'drink',third:'drinks',past:'drank'} },
  { words:new Set(['ご飯','パン','魚','肉','果物','卵','ケーキ']),
    present:{japanese:'食べます',reading:'たべます'}, past:{japanese:'食べました',reading:'たべました'},
    english:{base:'eat',third:'eats',past:'ate'} },
  // テレビ is absent: with 見る it is the medium, "watches television", not a
  // countable set, and this frame renders the object with an article.
  { words:new Set(['映画','番組','アニメ']),
    present:{japanese:'見ます',reading:'みます'}, past:{japanese:'見ました',reading:'みました'},
    english:{base:'watch',third:'watches',past:'watched'} },
]
/**
 * The numerals and counter words these forms are built from.
 *
 * 三冊 is a fused surface, so the vocabulary entry 三 never appears as its own
 * token — but the learner does see it, and it is the entry the deck teaches.
 * Deriving this from the tables rather than listing it keeps the two from
 * drifting apart.
 */
const counterSourceWords = new Set<string>(
  Object.values(COUNTER_FORMS).flatMap(forms => forms.flatMap(([surface]) => [
    surface.charAt(0),
    surface.slice(1),
    surface,
  ])).filter(Boolean),
)

/**
 * Which counter an object takes, and the verb that object belongs with.
 *
 * パン and 紙 are deliberately absent even though they take these counters:
 * their English is uncountable, and "two breads"/"two papers" is wrong in a
 * way the Japanese is not.
 * Restricted to combinations that are unambiguous in both languages — a
 * counted object needs a plural English noun, so anything whose gloss does not
 * pluralise cleanly is left out rather than guessed at.
 */
const COUNTED_FRAMES: ReadonlyArray<{
  counter: keyof typeof COUNTER_FORMS
  words: ReadonlySet<string>
  verb: { japanese: string; reading: string; english: string; englishThird: string }
  /** "two cups of tea" rather than "two teas". */
  measureOf?: string
}> = [
  { counter:'satsu', words:new Set(['本','小説','雑誌','辞書','教科書','漫画']),
    verb:{japanese:'読みます',reading:'よみます',english:'read',englishThird:'reads'} },
  { counter:'hai', words:new Set(['お茶','コーヒー','水','牛乳','ジュース']),
    verb:{japanese:'飲みます',reading:'のみます',english:'drink',englishThird:'drinks'}, measureOf:'cup' },
  { counter:'ko', words:new Set(['卵','りんご','ケーキ','おにぎり','みかん']),
    verb:{japanese:'食べます',reading:'たべます',english:'eat',englishThird:'eats'} },
  { counter:'tsu', words:new Set(['椅子','机','傘','鞄','窓']),
    verb:{japanese:'買います',reading:'かいます',english:'buy',englishThird:'buys'} },
  { counter:'mai', words:new Set(['シャツ','切符','写真','皿','はがき']),
    verb:{japanese:'買います',reading:'かいます',english:'buy',englishThird:'buys'} },
]

const additionalN5PatternIds = new Set([...Array.from({length:14},(_,index)=>`n5-${String(index+11).padStart(2,'0')}`),'n5-30','n5-31','n5-33','n5-34','n5-35','n5-36','n5-37','n5-38'])
const geographicOriginTags = new Set(normalizeTags(['country','city','town','village','neighborhood','island']))
const originSubjectDisallowedTags = new Set(normalizeTags(['patient','sick','illness','medical','hospital','guest','customer']))
const portableObjectTags = new Set(normalizeTags([
  ...edibleTags,...drinkableTags,...readableTags,'portable','light','book','document','paper','notebook','magazine','newspaper','letter',
  'phone','camera','bottle','cup','box','bag','wallet','clothing','shirt','coat','hat','shoes','tool','pen','pencil','lunch','food',
]))
const mailableObjectTags = new Set(normalizeTags(['letter','postcard','package','parcel','box','document','mail','shipping']))
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
const indoorIncompatibleWords = new Set(['電車','船','飛行機','バス','トラック','地下鉄','ヘリコプター','救急車','消防車','パトカー','タクシー','自動車'])
const invalidObjectLexicalTags = new Set(normalizeTags(['verb','auxiliary-verb','particle','expression','adverb','i-adjective','na-adjective','requires-modifier','unclassified','pronoun','question-word','demonstrative','number','conjunction','interjection']))
// 税込み and friends are price notations printed on a label, not things a
// person can hold, hand over, or pick up — they read as nouns to the tagger but
// never work as a concrete direct object.
const invalidStandaloneObjectWords = new Set(['事','こと','もの','物','てしまう','てくださる','てくれる','ほど','など','等','くらい','ぐらい','しか','だけ','だから','ので','のに','けれど','しかし','そして','それで','税込み','税抜き','消費税'])
// 必要だ ("is necessary") reads naturally for things worth wanting — time,
// money, permission, information, tools — but not for an arbitrary
// Object-category noun like trash or a hat ("the garbage is necessary" is
// nonsense in any context). The Object/Document categories are too broad to
// filter by tag alone, so this is a curated allow-list instead.
const hitsuyouCompatibleWords = new Set(['時間','お金','許可','情報','道具','休み','経験','知識','協力','説明','準備','練習','資料','証拠','許可証','パスポート','切符','チケット','地図','鍵','薬'])
const physicalObjectTags = new Set(normalizeTags([
  'concrete','furniture','chair','table','desk','bed','sofa','shelf','cabinet','tool','knife','pen','pencil','scissors','electronics','computer','laptop','phone','tablet','camera','television','tv',
  'vehicle','car','bus','train','bicycle','container','bottle','cup','glass','box','bag','wallet','clothing','shirt','pants','shoes','hat','coat','dress','book','document','paper','notebook','magazine','newspaper','letter','picture','photo','toy','instrument',
]))
// An everyday object resting at a pond, a mountain, or the sky reports a mishap
// rather than where the thing is kept. Existence sentences stay indoors.
// Saying where a thing is implies somewhere it is kept or was left. Museums,
// shrines, and galleries hold exhibits, so an everyday object being “at the art
// museum” reads as a curiosity rather than a location.
// Walking is a trip you make on foot in one go. Cities, countries, and open
// water are the wrong scale for it — nobody walks from a classroom to Tokyo.
const walkingIncompatibleTags = new Set(normalizeTags(['country','island','ocean','sea','city','prefecture','region','geography','municipality','capital']))
// Sub-building structural parts — too small-scale to be a walking route's
// origin/destination on their own; they're part of a building, not a place
// you walk "from" or "to" independent of the building containing them.
const subBuildingStructureWords = new Set(['階段','廊下','玄関','エレベーター','エスカレーター'])
// Calling or showing something to “a person” or “a man” leaves out the one thing
// these sentences are about: which person. Relatives, friends, classmates, and
// occupations all name someone; these words do not.
const genericRecipientWords = new Set(['人','人々','男','女','男性','女性','大人','子','若者','人間'])
// Work documents need an office context that a generated sentence cannot supply,
// so 見せる keeps to things anyone carries and shows.
const workplaceDocumentWords = new Set(['資料','書類','名刺','報告書','表','記録'])
const sukunaiCompatibleWords = new Set(['人','人々','時間','お金','問題','機会','車','木'])
const kanzenCompatibleWords = new Set(['計画','準備','情報','資料','書類','システム','状態','答え'])
// Things whose salient property is genuinely their length — 長い/短い restrict
// to this list instead of the broad physical-object categories, so 靴 (shoes,
// described by size/fit, not length) never comes up as "the shoes are long."
const linearDimensionWords = new Set(['道','道路','髪','紐','棒','川','橋','廊下','列車','ネクタイ','ズボン','鉛筆','傘','ロープ','電車'])
const narauCompatibleWords = new Set(['日本語','英語','中国語','韓国語','フランス語','ピアノ','ギター','歌','水泳','ダンス','書道','料理'])
const animalHoshiiTags = new Set(normalizeTags([...edibleTags,...drinkableTags,'food','water','bone','toy','pet-toy']))
const inanimateCategories: SentenceCategory[] = ['Object','Tool','Technology','Vehicle','Clothing','Furniture','Book','Document','Media']
const possessableCategories: SentenceCategory[] = ['Object','Tool','Technology','Vehicle','Clothing','Furniture','Book','Document','Media','Food','Drink']
const contextNeedyBareVerbIds = new Set([
  'tsuduku-basic','hajimaru-basic','owaru-basic','eru-basic','negau-basic',
  'kawaru-basic','fueru-basic','heru-basic','nokoru-basic','susumu-basic',
  'mazaru-basic','hirogaru-basic','tameru-basic','ushinau-basic','sodatsu-basic','tayoru-basic','kuraberu-basic',
])
const occupationWorkplaceTags: Array<[RegExp,string[]]> = [
  [/station employee/i, ['station']],
  [/store employee|cashier|shop assistant/i, ['store','shop']],
  [/teacher|student|pupil|classmate/i, ['school','education','university','classroom']],
  [/doctor|nurse/i, ['hospital']],
  [/banker|bank employee/i, ['bank']],
  [/chef|cook|waiter|waitress/i, ['restaurant','cafe']],
  [/librarian/i, ['library']],
  [/office worker|company employee|coworker|boss/i, ['office','company']],
]

// Size and newness are properties of things you can point at. Without
// `physicalOnly` the broad Object category lets 教育 and 習慣 through, and
// “education is new” is not what this pattern teaches.
export const adjectiveRules = [
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
  // 早い describes an arrival, event, vehicle, or person.  A duration such as
  // 二年 is not itself "early" without additional context.
  { id:'hayai-early',japanese:'早い',reading:'はやい',english:'early',categories:['Person','Vehicle','Event'] as SentenceCategory[] },
  { id:'osoi',japanese:'遅い',reading:'おそい',english:'late',categories:['Person','Vehicle','Event'] as SentenceCategory[] },
  { id:'hayai-fast',japanese:'速い',reading:'はやい',english:'fast',categories:['Vehicle','Technology','Animal'] as SentenceCategory[] },
  // physicalOnly: weight is a property of a thing you can pick up. Without it
  // the broad Object bucket yields "a movie is heavy".
  { id:'omoi',japanese:'重い',reading:'おもい',english:'heavy',categories:['Object','Furniture','Vehicle'] as SentenceCategory[],physicalOnly:true },
  { id:'karui',japanese:'軽い',reading:'かるい',english:'light',categories:['Object','Furniture','Vehicle'] as SentenceCategory[],physicalOnly:true },
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
  { id:'akai',japanese:'赤い',reading:'あかい',english:'red',categories:['Object','Clothing'] as SentenceCategory[],physicalOnly:true },
  { id:'aoi',japanese:'青い',reading:'あおい',english:'blue',categories:['Object','Clothing'] as SentenceCategory[],physicalOnly:true },
  { id:'kiiroi',japanese:'黄色い',reading:'きいろい',english:'yellow',categories:['Object','Clothing'] as SentenceCategory[],physicalOnly:true },
  { id:'chairoi',japanese:'茶色い',reading:'ちゃいろい',english:'brown',categories:['Object','Clothing'] as SentenceCategory[],physicalOnly:true },
  { id:'marui',japanese:'丸い',reading:'まるい',english:'round',categories:['Object'] as SentenceCategory[],physicalOnly:true },
  { id:'shikakui',japanese:'四角い',reading:'しかくい',english:'square',categories:['Object'] as SentenceCategory[],physicalOnly:true },
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
  { id:'katai',japanese:'硬い',reading:'かたい',english:'hard',categories:['Object','Food'] as SentenceCategory[],physicalOnly:true },
  { id:'yawarakai',japanese:'柔らかい',reading:'やわらかい',english:'soft',categories:['Object','Food','Furniture'] as SentenceCategory[],physicalOnly:true },
  // Safety, importance, and abstract qualities.
  { id:'abunai',japanese:'危ない',reading:'あぶない',english:'dangerous',categories:['Place','Object','Vehicle'] as SentenceCategory[] },
  { id:'anzen',japanese:'安全',reading:'あんぜん',english:'safe',categories:['Place','Object','Vehicle'] as SentenceCategory[] },
  { id:'taisetsu',japanese:'大切',reading:'たいせつ',english:'important',categories:['Object','Person','Document'] as SentenceCategory[] },
  { id:'hitsuyou',japanese:'必要',reading:'ひつよう',english:'necessary',categories:['Object','Document'] as SentenceCategory[] },
  { id:'tokubetsu',japanese:'特別',reading:'とくべつ',english:'special',categories:['Object','Food','Event'] as SentenceCategory[] },
  { id:'futsuu',japanese:'普通',reading:'ふつう',english:'ordinary',categories:['Object','Person','Food'] as SentenceCategory[] },
  // 同じ normally needs an explicit comparison, so it is handled by comparison
  // patterns rather than the simple "Noun が Adjective です" generator.
  { id:'tadashii',japanese:'正しい',reading:'ただしい',english:'correct',categories:['Document'] as SentenceCategory[] },
  { id:'utsukushii',japanese:'美しい',reading:'うつくしい',english:'beautiful',categories:['Person','Place','Object'] as SentenceCategory[] },
  { id:'kawaii',japanese:'かわいい',reading:'かわいい',english:'cute',categories:['Person','Animal','Object'] as SentenceCategory[] },
  { id:'kakkoii',japanese:'かっこいい',reading:'かっこいい',english:'cool',categories:['Person','Vehicle'] as SentenceCategory[] },
  { id:'kitanai',japanese:'汚い',reading:'きたない',english:'dirty',categories:['Place','Object','Room'] as SentenceCategory[],physicalOnly:true },
  { id:'seiketsu',japanese:'清潔',reading:'せいけつ',english:'clean',categories:['Room','Place','Object'] as SentenceCategory[] },
  { id:'yutaka',japanese:'豊か',reading:'ゆたか',english:'rich',categories:['Person','Place'] as SentenceCategory[] },
  { id:'mazushii',japanese:'貧しい',reading:'まずしい',english:'poor',categories:['Person','Place'] as SentenceCategory[] },
  { id:'shiawase',japanese:'幸せ',reading:'しあわせ',english:'happy',categories:['Person'] as SentenceCategory[] },
  { id:'fukou',japanese:'不幸',reading:'ふこう',english:'unhappy',categories:['Person'] as SentenceCategory[] },
  { id:'majime',japanese:'真面目',reading:'まじめ',english:'serious',categories:['Person'] as SentenceCategory[] },
  { id:'yasashii-kind',japanese:'優しい',reading:'やさしい',english:'kind',categories:['Person'] as SentenceCategory[] },
  { id:'kibishii',japanese:'厳しい',reading:'きびしい',english:'strict',categories:['Person'] as SentenceCategory[] },
  { id:'teinei',japanese:'丁寧',reading:'ていねい',english:'polite',categories:['Person'] as SentenceCategory[] },
  { id:'rippa',japanese:'立派',reading:'りっぱ',english:'splendid',categories:['Object','Person','Building'] as SentenceCategory[] },
  { id:'fukuzatsu',japanese:'複雑',reading:'ふくざつ',english:'complex',categories:['Document','Object'] as SentenceCategory[] },
  { id:'tanjun',japanese:'単純',reading:'たんじゅん',english:'simple',categories:['Document','Object'] as SentenceCategory[] },
  { id:'juubun',japanese:'十分',reading:'じゅうぶん',english:'sufficient',categories:['Food','Object','Money'] as SentenceCategory[] },
  { id:'kanzen',japanese:'完全',reading:'かんぜん',english:'complete',categories:['Document'] as SentenceCategory[] },
  { id:'jiyuu',japanese:'自由',reading:'じゆう',english:'free',categories:['Person'] as SentenceCategory[] },
  { id:'daijoubu',japanese:'大丈夫',reading:'だいじょうぶ',english:'okay',categories:['Person','Object'] as SentenceCategory[] },
  // Person is excluded: 好き/嫌い are experiencer adjectives, so "母は好きです"
  // reads as "mother likes (it)" rather than "mother is liked" — the sentence
  // is ambiguous exactly when the topic is a person.
  { id:'suki',japanese:'好き',reading:'すき',english:'likable',categories:['Food','Media'] as SentenceCategory[] },
  { id:'kirai',japanese:'嫌い',reading:'きらい',english:'disliked',categories:['Food','Media'] as SentenceCategory[] },
  { id:'jouzu',japanese:'上手',reading:'じょうず',english:'skillful',categories:['Person'] as SentenceCategory[] },
  { id:'heta',japanese:'下手',reading:'へた',english:'unskillful',categories:['Person'] as SentenceCategory[] },
  // Additional temperature/texture and person-trait words.
  { id:'atatakai-touch',japanese:'温かい',reading:'あたたかい',english:'warm',categories:['Food','Drink'] as SentenceCategory[],physicalOnly:true },
  { id:'atsui-thick',japanese:'厚い',reading:'あつい',english:'thick',categories:['Book','Document','Clothing','Object'] as SentenceCategory[],physicalOnly:true },
  { id:'usui',japanese:'薄い',reading:'うすい',english:'thin',categories:['Book','Document','Clothing','Object'] as SentenceCategory[],physicalOnly:true },
  { id:'mezurashii',japanese:'珍しい',reading:'めずらしい',english:'rare',categories:['Object','Animal','Event','Food'] as SentenceCategory[] },
  { id:'shinsen',japanese:'新鮮',reading:'しんせん',english:'fresh',categories:['Food'] as SentenceCategory[],physicalOnly:true },
  { id:'shoujiki',japanese:'正直',reading:'しょうじき',english:'honest',categories:['Person'] as SentenceCategory[] },
  { id:'kashikoi',japanese:'賢い',reading:'かしこい',english:'clever',categories:['Person','Animal'] as SentenceCategory[] },
  { id:'sunao',japanese:'素直',reading:'すなお',english:'obedient',categories:['Person'] as SentenceCategory[] },
  { id:'ganko',japanese:'頑固',reading:'がんこ',english:'stubborn',categories:['Person'] as SentenceCategory[] },
  { id:'reisei',japanese:'冷静',reading:'れいせい',english:'calm',categories:['Person'] as SentenceCategory[] },
  { id:'shinchou-cautious',japanese:'慎重',reading:'しんちょう',english:'cautious',categories:['Person'] as SentenceCategory[] },
  { id:'fuan',japanese:'不安',reading:'ふあん',english:'anxious',categories:['Person'] as SentenceCategory[] },
  { id:'manzoku',japanese:'満足',reading:'まんぞく',english:'satisfied',categories:['Person'] as SentenceCategory[] },
  { id:'fuman',japanese:'不満',reading:'ふまん',english:'dissatisfied',categories:['Person'] as SentenceCategory[] },
  // Person is deliberately excluded: 残念 describes an outcome or situation
  // ("残念な結果"), not a person's own trait — "a son is regrettable" is not
  // what this word means.
  { id:'zannen',japanese:'残念',reading:'ざんねん',english:'regrettable',categories:['Event'] as SentenceCategory[] },
  // Abstract quality/evaluation words — Document/Object here follows the same
  // pattern as 複雑/単純/必要/大切 above: Object's abstract fallback bucket is
  // exactly the pool these evaluative words are meant to describe.
  // Document only, deliberately: these judge a plan, method, or piece of
  // information, never a physical thing — "a train is appropriate" and "shoes
  // are realistic" are what the broader Object category produced.
  { id:'tekisetsu',japanese:'適切',reading:'てきせつ',english:'appropriate',categories:['Document'] as SentenceCategory[] },
  { id:'futekisetsu',japanese:'不適切',reading:'ふてきせつ',english:'inappropriate',categories:['Document'] as SentenceCategory[] },
  { id:'koukateki',japanese:'効果的',reading:'こうかてき',english:'effective',categories:['Document'] as SentenceCategory[] },
  { id:'seikaku-accurate',japanese:'正確',reading:'せいかく',english:'accurate',categories:['Document'] as SentenceCategory[] },
  { id:'gutaiteki',japanese:'具体的',reading:'ぐたいてき',english:'concrete',categories:['Document'] as SentenceCategory[] },
  { id:'genjitsuteki',japanese:'現実的',reading:'げんじつてき',english:'realistic',categories:['Document'] as SentenceCategory[] },
  { id:'ippanteki',japanese:'一般的',reading:'いっぱんてき',english:'general',categories:['Document'] as SentenceCategory[] },
  { id:'shinkoku',japanese:'深刻',reading:'しんこく',english:'serious',categories:['Event'] as SentenceCategory[] },
  { id:'kanou',japanese:'可能',reading:'かのう',english:'possible',categories:['Document'] as SentenceCategory[] },
  { id:'fukanou',japanese:'不可能',reading:'ふかのう',english:'impossible',categories:['Document'] as SentenceCategory[] },
]

function hasCompositeSurface(word: WordRecord) {
  return word.japanese.includes('/') || /[／~〜]/.test(word.japanese)
}

function hasUsableMeaning(word: WordRecord) {
  const meaning=primaryEnglishGloss(word.preferredTranslation || word.english)
  return Boolean(meaning) && !/^(?:meaning|reading) needed$/i.test(meaning)
}

/**
 * The pool helpers below scan the whole ~2,000-word vocabulary and are called
 * on every single generation, which dominated generation cost. Results depend
 * only on the vocabulary array, so they are memoized against its identity —
 * `editorWords()` returns a new array whenever the content database changes,
 * which invalidates these automatically.
 */
function memoizePool<A extends unknown[]>(
  build: (vocabulary: WordRecord[], ...args: A) => WordRecord[],
) {
  let sourceVocabulary: WordRecord[] | null = null
  let byKey = new Map<string, WordRecord[]>()
  return (vocabulary: WordRecord[], ...args: A): WordRecord[] => {
    if (sourceVocabulary !== vocabulary) {
      sourceVocabulary = vocabulary
      byKey = new Map()
    }
    const key = args.length ? JSON.stringify(args) : ''
    const cached = byKey.get(key)
    if (cached) return cached
    const built = build(vocabulary, ...args)
    byKey.set(key, built)
    return built
  }
}

const validHumanPool = memoizePool(function validHumanPool(vocabulary: WordRecord[]) {
  return vocabulary.filter(word=>{
    const tags=tagSet(word)
    return !hasCompositeSurface(word)
      && hasUsableMeaning(word)
      && word.categories.includes('Person')
      && matchingTags(word,humanSubjectTags).length>0
      // Defensive: imported data has occasionally mis-tagged an animal word
      // (e.g. 犬) into the Person category. Even so, never let it through as
      // a human subject — 犬 reading a book, however it got there, is wrong.
      && ![...tags].some(tag=>nonHumanSubjectTags.has(tag))
      && !politeSubjectIncompatibleWords.has(word.japanese)
      && !contextDependentSubjectWords.has(word.japanese)
      && !preferLongerFormWords.has(word.japanese)
      && !formalRegisterSubjectWords.has(word.japanese)
      && !tags.has('question-word')
      && !tags.has('requires-modifier')
  })
})

/** Recipients of calling and showing must identify someone, not just a human. */
function namedRecipients(humans: WordRecord[]) {
  return humans.filter(word=>!genericRecipientWords.has(word.japanese))
}

const validPlacePool = memoizePool(function validPlacePool(vocabulary: WordRecord[]) {
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
})

const validTimePool = memoizePool(function validTimePool(vocabulary: WordRecord[]) {
  return vocabulary.filter(word=>{
    const tags=tagSet(word)
    return word.categories.includes('Time')
      && matchingTags(word,generalTimeTags).length>0
      // A composite entry like 日/陽 is two alternatives joined by a slash in
      // the source data, never a usable surface on its own.
      && !hasCompositeSurface(word)
      && !niIncompatibleTimeWords.has(word.japanese)
      && ![...tags].some(tag=>niIncompatibleTimeTags.has(tag))
  })
})

/**
 * Adjectives that describe a person, for the n4-29 predicate frame.
 *
 * Curated rather than derived, for two reasons the vocabulary data makes
 * unavoidable. First, the classifier files these under Adverb, so category
 * alone cannot find them. Second, a な-adjective's dictionary gloss is usually
 * a noun — 健康 glosses as "health", 寛容 as "tolerance" — so the English
 * predicate has to be stated, not read off the record.
 *
 * Restricted to adjectives that describe people. The rest of the miscategorised
 * adjectives are degree and comparison words (絶対, 同様, 一般) that need
 * something to modify and produce nonsense as a bare predicate about a person.
 */
const personAdjectives: ReadonlyArray<{japanese:string;reading:string;english:string;na:boolean}> = [
  { japanese:'健康', reading:'けんこう', english:'healthy', na:true },
  { japanese:'素敵', reading:'すてき', english:'lovely', na:true },
  { japanese:'寛容', reading:'かんよう', english:'tolerant', na:true },
  { japanese:'変', reading:'へん', english:'strange', na:true },
  { japanese:'満腹', reading:'まんぷく', english:'full', na:true },
  { japanese:'積極的', reading:'せっきょくてき', english:'proactive', na:true },
  { japanese:'消極的', reading:'しょうきょくてき', english:'passive', na:true },
  { japanese:'恥ずかしい', reading:'はずかしい', english:'embarrassed', na:false },
  { japanese:'可愛い', reading:'かわいい', english:'cute', na:false },
  { japanese:'素晴らしい', reading:'すばらしい', english:'wonderful', na:false },
  { japanese:'詳しい', reading:'くわしい', english:'knowledgeable', na:false },
  { japanese:'うまい', reading:'うまい', english:'skillful', na:false },
]
const personAdjectiveWords = new Set(personAdjectives.map(entry => entry.japanese))

/**
 * Adjectives that judge an idea or situation rather than a person, for n4-30.
 *
 * `suffix` carries 的 for the words that are noun stems in the vocabulary data
 * but only ever function as adjectives with it attached: the entry is 客観, the
 * adjective is 客観的. `noDegree` marks the variety words, which describe a
 * spread rather than a quantity — "very various" is not English.
 *
 * Readings are stated here because several of these records carry romaji or
 * incorrect readings in the source data (客観 is listed as "kakkyoku", not
 * きゃっかん), and a wrong reading would render as wrong furigana.
 */
const abstractJudgementAdjectives: ReadonlyArray<{japanese:string;reading:string;english:string;na:boolean;suffix?:string;noDegree?:boolean}> = [
  { japanese:'重要', reading:'じゅうよう', english:'important', na:true },
  { japanese:'大事', reading:'だいじ', english:'important', na:true },
  { japanese:'明らか', reading:'あきらか', english:'obvious', na:true },
  { japanese:'明確', reading:'めいかく', english:'clear', na:true },
  { japanese:'不思議', reading:'ふしぎ', english:'mysterious', na:true },
  { japanese:'無理', reading:'むり', english:'impossible', na:true },
  { japanese:'妥当', reading:'だとう', english:'reasonable', na:true },
  { japanese:'意外', reading:'いがい', english:'unexpected', na:true },
  { japanese:'極端', reading:'きょくたん', english:'extreme', na:true },
  { japanese:'危険', reading:'きけん', english:'dangerous', na:true },
  { japanese:'端的', reading:'たんてき', english:'concise', na:true },
  { japanese:'精緻', reading:'せいち', english:'elaborate', na:true },
  { japanese:'未曾有', reading:'みぞう', english:'unprecedented', na:true },
  { japanese:'急速', reading:'きゅうそく', english:'rapid', na:true },
  { japanese:'客観', reading:'きゃっかんてき', english:'objective', na:true, suffix:'的' },
  { japanese:'抽象', reading:'ちゅうしょうてき', english:'abstract', na:true, suffix:'的' },
  { japanese:'具体', reading:'ぐたいてき', english:'concrete', na:true, suffix:'的' },
  { japanese:'相対', reading:'そうたいてき', english:'relative', na:true, suffix:'的' },
  { japanese:'絶対', reading:'ぜったいてき', english:'absolute', na:true, suffix:'的' },
  { japanese:'普遍', reading:'ふへんてき', english:'universal', na:true, suffix:'的' },
  { japanese:'一般', reading:'いっぱんてき', english:'general', na:true, suffix:'的' },
  { japanese:'国際', reading:'こくさいてき', english:'international', na:true, suffix:'的' },
  { japanese:'必然的', reading:'ひつぜんてき', english:'inevitable', na:true },
  { japanese:'著しい', reading:'いちじるしい', english:'remarkable', na:false },
  { japanese:'激しい', reading:'はげしい', english:'intense', na:false },
  { japanese:'深い', reading:'ふかい', english:'deep', na:false },
  { japanese:'細かい', reading:'こまかい', english:'detailed', na:false },
  { japanese:'様々', reading:'さまざま', english:'varied', na:true, noDegree:true },
  { japanese:'いろいろ', reading:'いろいろ', english:'varied', na:true, noDegree:true },
]
/** Degree adverbs for n4-30. All are ungrammatical before a plain verb, which is why they are here and not in `actionAdverbWords`. */
const degreeAdverbs: ReadonlyArray<{japanese:string;reading:string;english:string}> = [
  { japanese:'非常に', reading:'ひじょうに', english:'extremely' },
  { japanese:'かなり', reading:'かなり', english:'quite' },
  { japanese:'極端に', reading:'きょくたんに', english:'extremely' },
  { japanese:'明らかに', reading:'あきらかに', english:'clearly' },
  { japanese:'意外に', reading:'いがいに', english:'surprisingly' },
  { japanese:'わずかに', reading:'わずかに', english:'slightly' },
  { japanese:'結構', reading:'けっこう', english:'fairly' },
  { japanese:'大変', reading:'たいへん', english:'very' },
]
/**
 * Words whose meaning is a relation between two things, for n4-31. They cannot
 * work in the n4-30 predicate frame: "the reason is different" needs something
 * to be different *from*.
 */
const comparisonAdjectives: ReadonlyArray<{japanese:string;reading:string;english:string}> = [
  { japanese:'同じ', reading:'おなじ', english:'the same as' },
  { japanese:'同様', reading:'どうよう', english:'similar to' },
  { japanese:'一緒', reading:'いっしょ', english:'the same as' },
  { japanese:'別', reading:'べつ', english:'separate from' },
  { japanese:'逆', reading:'ぎゃく', english:'the opposite of' },
]
/**
 * Concept pairs for n4-31, with the relation that actually holds between them.
 *
 * Curated because a comparison of two arbitrary abstractions is grammatical and
 * empty — "the laugh is the same as the daily life". Constraining the pair to a
 * shared tag was tried first and is not enough: the tags these words share are
 * `abstract` and their JLPT level, which say nothing about whether comparing
 * them means anything. These are the pairs Japanese actually contrasts.
 */
const conceptPairs: ReadonlyArray<{first:string;second:string;comparison:string}> = [
  { first:'理想', second:'現実', comparison:'逆' },
  { first:'本音', second:'建前', comparison:'逆' },
  { first:'原因', second:'結果', comparison:'別' },
  { first:'過程', second:'結果', comparison:'別' },
  { first:'理由', second:'根拠', comparison:'同様' },
  { first:'意見', second:'考え', comparison:'同様' },
  { first:'問題', second:'課題', comparison:'同様' },
  { first:'目的', second:'目標', comparison:'同じ' },
  { first:'方法', second:'手段', comparison:'同じ' },
  { first:'経験', second:'知識', comparison:'別' },
]
const abstractAdjectiveWords = new Set([
  ...abstractJudgementAdjectives.map(entry => entry.japanese),
  ...degreeAdverbs.map(entry => entry.japanese),
  ...comparisonAdjectives.map(entry => entry.japanese),
  // The bare stems the degree adverbs are built from: the vocabulary entry is
  // 非常/極端/明らか, and the adverb attaches に.
  '非常','極端','明らか','意外','わずか',
])

/**
 * Abstractions eligible for the topic patterns (n4-26 … n4-28).
 *
 * Defined here rather than inline in the generator so the reachability audit
 * can see it. A pool that only exists inside a generator is invisible to the
 * audit, which then reports its members as unreachable — the same mistake that
 * hid the curated adverb list until it moved onto `VerbSlotRule.words`.
 */
/**
 * Body parts for the 痛い frame (n5-30).
 *
 * Extracted from inside the generator so the audit can see it. Filtered inline,
 * it reported all 26 body parts as unreachable when they generate fine — the
 * third time a generator-local pool has produced a phantom gap in the report.
 *
 * 血, 身 and 尻尾 are excluded: blood and one's person do not ache in the way
 * this frame means, and a tail is not a body part of the people in the subject
 * pool.
 */
const bodyPartPool = memoizePool(function bodyPartPool(vocabulary: WordRecord[]) {
  return vocabulary.filter(word => word.tags.includes('body-part') && !['尻尾','血','身'].includes(word.japanese))
})

const abstractTopicPool = memoizePool(function abstractTopicPool(vocabulary: WordRecord[]) {
  return vocabulary.filter(word=>
    categoryMatch(word,['Object'])
    && hasUsableMeaning(word)
    && !nonAbstractTopicWords.has(word.japanese)
    && [...tagSet(word)].some(tag=>abstractTopicTags.includes(tag)))
})

const validInanimatePool = memoizePool<[categories?: SentenceCategory[]]>(function validInanimatePool(vocabulary: WordRecord[],categories: SentenceCategory[]=inanimateCategories) {
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
})

function isPhysicalObject(word: WordRecord) {
  if (categoryMatch(word,['Food','Drink','Furniture','Tool','Vehicle','Clothing','Book','Document'])) return true
  return [...tagSet(word)].some(tag=>physicalObjectTags.has(tag))
}

let slotIndexCache: Set<string> | null = null

if (typeof window !== 'undefined') {
  window.addEventListener(CONTENT_DATABASE_EVENT,()=>{ slotIndexCache=null })
}

/**
 * Every word that clears the category/tag gate of at least one slot anywhere in
 * the generator. Deciding a word fits *nowhere* otherwise costs a scan of every
 * pattern (over a second), which is far too slow for screens that build many
 * example sentences in one render — this answers that question with a lookup.
 *
 * Membership means "worth attempting", not "guaranteed to work": a word can
 * still be rejected later by a per-verb rule or a cross-slot check. The set is
 * deliberately built from the same pool helpers the generators use, so it can
 * never exclude a word those generators would have accepted.
 */
function slotEligibleWords(): Set<string> {
  if (slotIndexCache) return slotIndexCache
  const vocabulary = generatorWords()
  const eligible = new Set<string>()

  for (const verb of verbs) {
    eligible.add(verb.japanese)
    for (const rule of Object.values(verb.slots)) {
      for (const word of vocabulary) {
        if (!categoryMatch(word,rule.categories)) continue
        if (rule.tags?.length && matchingTags(word,rule.tags).length === 0) continue
        if (rule.words && !rule.words.has(word.japanese)) continue
        eligible.add(word.japanese)
      }
    }
  }

  // Pattern generators outside the verb-slot path draw from these curated pools
  // directly, so their members are reachable even when no verb slot accepts them.
  for (const pool of [
    validHumanPool(vocabulary),
    validPlacePool(vocabulary),
    validTimePool(vocabulary),
    validInanimatePool(vocabulary),
    abstractTopicPool(vocabulary),
    bodyPartPool(vocabulary),
  ]) {
    for (const word of pool) eligible.add(word.japanese)
  }
  for (const japanese of personAdjectiveWords) eligible.add(japanese)
  for (const japanese of abstractAdjectiveWords) eligible.add(japanese)
  for (const japanese of counterSourceWords) eligible.add(japanese)
  for (const japanese of timeAdverbialWords) eligible.add(japanese)
  for (const japanese of positionNounWords) eligible.add(japanese)
  for (const japanese of questionWords) eligible.add(japanese)
  for (const japanese of weatherWords) eligible.add(japanese)
  for (const rule of adjectiveRules) eligible.add(rule.japanese)

  slotIndexCache = eligible
  return eligible
}

export interface ApprovedOverride {
  japanese: string
  reading: string
  builtInCategories: SentenceCategory[]
  approvedCategories: SentenceCategory[]
  /** Tags the built-in record carried that the approved record drops. */
  droppedTags: string[]
}

/**
 * Approved records that replace a built-in entry, and what that costs.
 *
 * `editorWords` lets an approved record win outright rather than merging: a
 * reviewer's category and tag set is a decision, and unioning it with the
 * built-in tags would quietly undo their edits. That is deliberate — but it
 * also means a reviewer can drop the one tag a slot rule gates on and make a
 * word unreachable without anything saying so, which is how 共 once became a
 * person subject and produced "a both's foot does not hurt".
 *
 * Reporting the shadowing keeps the reviewer's authority while making its
 * effects visible, which changing the merge would not.
 */
export function auditApprovedOverrides(): ApprovedOverride[] {
  const builtIn = new Map<string,WordRecord>()
  for (const word of [...catalogWords(), ...words]) {
    const key = `${word.japanese}|${word.reading}`
    const existing = builtIn.get(key)
    builtIn.set(key, existing ? { ...existing, ...word, categories:word.categories, tags:normalizeTags([...existing.tags,...word.tags]) } : word)
  }
  const overrides: ApprovedOverride[] = []
  for (const approved of approvedWords()) {
    const original = builtIn.get(`${approved.japanese}|${approved.reading}`)
    if (!original) continue
    const approvedTags = new Set(normalizeTags(approved.tags))
    const droppedTags = normalizeTags(original.tags).filter(tag => !approvedTags.has(tag))
    const sameCategories = original.categories.length === approved.categories.length
      && original.categories.every(category => approved.categories.includes(category))
    if (sameCategories && !droppedTags.length) continue
    overrides.push({
      japanese: approved.japanese,
      reading: approved.reading,
      builtInCategories: original.categories,
      approvedCategories: approved.categories,
      droppedTags,
    })
  }
  return overrides
}

export interface WordReachability {
  japanese: string
  reading: string
  english: string
  jlpt?: JlptLevel
  categories: SentenceCategory[]
  tags: string[]
  /** `verbId.slot` gates this word clears outright. */
  slots: string[]
  /** Curated pools (human/place/time/inanimate) that accept this word. */
  pools: string[]
  reachable: boolean
  /**
   * Slots that accept the word's category but reject its tags, as
   * `verbId.slot wants a|b|c`. Usually this is a filter working correctly — an
   * い-adjective is rightly refused by a manner-of-reading adverb slot — so it
   * is context for reading the unreachable list, not a defect list itself.
   */
  tagBlockedBy: string[]
  /**
   * Categories whose canonical tag the word is missing. This is the real
   * invariant: `withCanonicalCategoryTags` guarantees it at construction, so
   * any violation means a built-in record bypassed that helper. Unlike
   * `tagBlockedBy` this is never legitimate, which makes it safe to fail on.
   *
   * Always empty for approved records — a reviewer's tag set is deliberate and
   * is not held to this invariant (see `approvedWords`).
   */
  missingCanonicalTags: SentenceCategory[]
}

/**
 * Static reachability report for every word the generator can see.
 *
 * Deliberately mirrors `slotEligibleWords` rather than sampling generated
 * sentences: a word that no slot accepts produces nothing no matter how many
 * seeds are drawn, so sampling can only ever show its absence as a very long
 * run of bad luck. This answers it directly, in about a second, and is the
 * check that would have caught the 馬/監督/現金 mistagging immediately.
 */
export function auditWordReachability(): WordReachability[] {
  const vocabulary = generatorWords()
  const poolMembership: Array<[string, Set<string>]> = [
    ['human', new Set(validHumanPool(vocabulary).map(word => word.japanese))],
    ['place', new Set(validPlacePool(vocabulary).map(word => word.japanese))],
    ['time', new Set(validTimePool(vocabulary).map(word => word.japanese))],
    ['inanimate', new Set(validInanimatePool(vocabulary).map(word => word.japanese))],
    // Adjectives reach the stream through their own rules rather than a verb
    // slot; slotEligibleWords counts them, so this has to as well or the audit
    // reports the entire adjective vocabulary as unreachable.
    ['adjective', new Set(adjectiveRules.map(rule => rule.japanese))],
    ['abstract-topic', new Set(abstractTopicPool(vocabulary).map(word => word.japanese))],
    ['body-part', new Set(bodyPartPool(vocabulary).map(word => word.japanese))],
    ['person-adjective', personAdjectiveWords],
    ['abstract-adjective', abstractAdjectiveWords],
    ['counter-source', counterSourceWords],
    ['time-adverbial', timeAdverbialWords],
    ['position-noun', positionNounWords],
    ['question-word', questionWords],
    ['weather', weatherWords],
  ]

  return vocabulary.map(word => {
    const slots: string[] = []
    const tagBlockedBy: string[] = []
    for (const verb of verbs) {
      for (const [slot, rule] of Object.entries(verb.slots)) {
        if (!categoryMatch(word, rule.categories)) continue
        if (rule.tags?.length && matchingTags(word, rule.tags).length === 0) {
          tagBlockedBy.push(`${verb.id}.${slot} wants ${rule.tags.slice(0, 6).join('|')}`)
          continue
        }
        if (rule.words && !rule.words.has(word.japanese)) {
          tagBlockedBy.push(`${verb.id}.${slot} allows only a named set`)
          continue
        }
        slots.push(`${verb.id}.${slot}`)
      }
    }
    const pools = poolMembership.filter(([, members]) => members.has(word.japanese)).map(([name]) => name)
    const carried = new Set(word.tags)
    return {
      japanese: word.japanese,
      reading: word.reading,
      english: word.preferredTranslation || word.english,
      jlpt: word.jlpt,
      categories: word.categories,
      tags: word.tags,
      slots,
      pools,
      reachable: slots.length > 0 || pools.length > 0,
      tagBlockedBy,
      missingCanonicalTags: word.source === 'approved'
        ? []
        : word.categories.filter(category => !carried.has(CANONICAL_CATEGORY_TAGS[category])),
    }
  })
}

function originEnglish(word: WordRecord) {
  const gloss=primaryEnglishGloss(word.preferredTranslation || word.english)
  return /^[A-Z]/.test(gloss) ? gloss : englishPhrase(word,'destination')
}

function additionalN5Sentence(seed: number,patternId: string,options: CategorySentenceOptions={}): GeneratedPreviewSentence | null {
  if (!additionalN5PatternIds.has(patternId)) return null
  const vocabulary=generatorWords()
  const humans=validHumanPool(vocabulary)
  const places=validPlacePool(vocabulary)
  const localizedPlaces=places.filter(word=>![...tagSet(word)].some(tag=>geographicOriginTags.has(tag)))
  const personExistencePlaces=localizedPlaces.filter(word=>[...tagSet(word)].some(tag=>personExistenceLocationTags.includes(tag)))
  const objectExistencePlaces=localizedPlaces.filter(word=>[...tagSet(word)].some(tag=>objectExistenceLocationTags.includes(tag)))
  const times=validTimePool(vocabulary)
  const inanimate=validInanimatePool(vocabulary)
  const pick=requiredWordPicker(seed,options.requiredWord,options)
  const placesForObject=(object: WordRecord)=> {
    const objectTags=tagSet(object)
    if (object.categories.includes('Clothing') || ['靴','靴下','帽子','服','上着','コート'].includes(object.japanese) || objectTags.has('clothing')) {
      return objectExistencePlaces.filter(word=>matchingTags(word,['house','home','apartment','room','bedroom','bathroom','store','shop']).length>0)
    }
    if (['茶碗','皿','コップ','箸','スプーン','フォーク'].includes(object.japanese)) {
      return objectExistencePlaces.filter(word=>matchingTags(word,['house','home','apartment','room','kitchen','restaurant','cafe','store','shop']).length>0)
    }
    return objectExistencePlaces
  }
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
    const place=pick(personExistencePlaces,111,'location')
    const animatePool=vocabulary.filter(word=>word.categories.includes('Animal') && hasUsableMeaning(word)).concat(humans.filter(word=>{
      const tags=tagSet(word)
      return !['pronoun','speaker','second-person','demonstrative','question-word'].some(tag=>tags.has(tag))
    }))
    const subject=pick(animatePool,112,'subject')
    if (!place || !subject) return null
    const subjectEnglish=indefinite(primaryEnglishGloss(subject.preferredTranslation || subject.english))
    const plural=subjectUsesBaseVerb(subjectEnglish)
    const furigana=[wordPart(place,'place'),literalPart('に'),wordPart(subject,'subject'),literalPart('が'),{text:'います',reading:'います',slot:'verb'}]
    return finish(furigana,`There ${plural?'are':'is'} ${subjectEnglish} ${englishPhrase(place,'location')}.`,{place,subject},{verb:verbSlot('verb-iru','います','いる','います','exist',['existence','animate'])},['Subject is animate.','Place supports an existence location.'])
  }
  if (patternId === 'n5-12') {
    const object=pick(inanimate.filter(word=>isPhysicalObject(word) && !indoorIncompatibleWords.has(word.japanese)),122,'object')
    const place=object ? pick(placesForObject(object),121) : null
    if (!place || !object) return null
    const furigana=[wordPart(place,'place'),literalPart('に'),wordPart(object,'object'),literalPart('が'),{text:'あります',reading:'あります',slot:'verb'}]
    const existingEnglish=objectEnglish(primaryEnglishGloss(object.preferredTranslation || object.english))
    return finish(furigana,`There ${isPluralPhrase(existingEnglish)?'are':'is'} ${existingEnglish} ${englishPhrase(place,'location')}.`,{place,object},{verb:verbSlot('verb-aru','あります','ある','あります','exist',['existence','inanimate'])},['Object is inanimate.','Place supports an existence location.'])
  }
  if (patternId === 'n5-13') {
    // The catalog constrains this pattern to times that naturally accept に.
    // validTimePool alone does not enforce that, so apply the same relative-time
    // and duration exclusions the verb-driven slot filler uses.
    const niCompatibleTimes=times.filter(word=>{
      const tags=tagSet(word)
      return !niIncompatibleTimeWords.has(word.japanese)
        && !durationOnlyTimeWords.has(word.japanese)
        && ![...tags].some(tag=>niIncompatibleTimeTags.has(tag))
    })
    const time=pick(niCompatibleTimes,131,'time'),subject=pick(humans,132,'subject')
    if (!time || !subject) return null
    const subjectEnglish=englishPhrase(subject,'subject'),comes=subjectUsesBaseVerb(subjectEnglish)?'come':'comes'
    const furigana=[wordPart(time,'time'),literalPart('に'),wordPart(subject,'subject'),literalPart('が'),{text:'来ます',reading:'きます',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${comes} ${englishPhrase(time,'time')}.`,{time,subject},{verb:verbSlot('verb-kuru','来ます','来る','きます','come',['movement','arrival','time-compatible'])},['Time naturally accepts に.','来る supports the selected time frame.'])
  }
  if (patternId === 'n5-14') {
    const object=pick(inanimate.filter(word=>isPhysicalObject(word) && !indoorIncompatibleWords.has(word.japanese)),141,'object')
    const place=object ? pick(placesForObject(object),142) : null
    if (!object || !place) return null
    const objectPhrase=object.categories.includes('Person')
      ? englishPhrase(object,'subject')
      : objectEnglish(primaryEnglishGloss(object.preferredTranslation || object.english))
    const furigana=[wordPart(object,'object'),literalPart('は','わ'),wordPart(place,'place'),literalPart('に'),{text:'あります',reading:'あります',slot:'verb'}]
    return finish(furigana,`${objectPhrase.charAt(0).toUpperCase()+objectPhrase.slice(1)} ${isPluralPhrase(objectPhrase)?'are':'is'} ${englishPhrase(place,'location')}.`,{object,place},{verb:verbSlot('verb-aru-location','あります','ある','あります','be located',['existence','location','inanimate'])},['Object is inanimate.','Place is a valid location.'])
  }
  if (patternId === 'n5-15') {
    const origins=places.filter(word=>[...tagSet(word)].some(tag=>geographicOriginTags.has(tag)))
    const originSubjects=humans.filter(word=>![...tagSet(word)].some(tag=>originSubjectDisallowedTags.has(tag)))
    const subject=pick(originSubjects.length?originSubjects:humans,151,'subject'),origin=pick(origins,152,'origin')
    if (!subject || !origin) return null
    const subjectEnglish=englishPhrase(subject,'subject')
    // Non-past 来ます/"comes from" reads as an unfinished habitual claim without
    // extra context ("comes from the village [on a schedule]?"). Past tense
    // states the plain, complete fact a generated sentence actually needs.
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(origin,'origin'),literalPart('から'),{text:'来ました',reading:'きました',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} came from ${originEnglish(origin)}.`,{subject,origin},{verb:verbSlot('verb-kuru-origin','来ました','来る','きました','come',['movement','origin'])},['Origin is a city, country, town, village, or island.'])
  }
  if (patternId === 'n5-16') {
    const walkablePlaces=places.filter(word=>![...tagSet(word)].some(tag=>walkingIncompatibleTags.has(tag)) && !['山','売り場'].includes(word.japanese))
    const subject=pick(humans,161,'subject'),endpoint=pick(walkablePlaces,162,'endpoint')
    if (!subject || !endpoint) return null
    const subjectEnglish=englishPhrase(subject,'subject'),walks=subjectUsesBaseVerb(subjectEnglish)?'walk':'walks'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(endpoint,'endpoint'),literalPart('まで'),{text:'歩きます',reading:'あるきます',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${walks} to ${englishPhrase(endpoint,'destination')}.`,{subject,endpoint},{verb:verbSlot('verb-aruku-endpoint','歩きます','歩く','あるきます','walk',['movement','endpoint'])},['歩く is a movement verb.','Endpoint is a valid destination.'])
  }
  if (patternId === 'n5-17') {
    // Routed through `pick` rather than seededPick so that asking for an
    // example sentence for an adjective selects that adjective, instead of
    // hoping a random one matches.
    // When the required word is a *noun* instead, the adjective has to be
    // chosen to suit it: the object pool below is filtered by the adjective's
    // categories, so picking blind here would usually exclude the very word
    // the sentence is being built for.
    const requiredRecord = options.requiredWord && !adjectiveRules.some(rule=>rule.japanese===options.requiredWord)
      ? vocabulary.find(word=>word.japanese===options.requiredWord)
      : undefined
    const describingAdjectives = requiredRecord
      ? adjectiveRules.filter(rule=>categoryMatch(requiredRecord,rule.categories as SentenceCategory[]))
      : adjectiveRules
    const adjective=pick(describingAdjectives.length?describingAdjectives:adjectiveRules,171)
    if (!adjective) return null
    // 普通 needs a comparison or a concrete context (e.g. この服は普通です);
    // it is not useful as an unqualified generated predicate.
    if (adjective.id === 'futsuu') return null
    // 必要だ is exempted from the normal category+tag pool: its curated
    // allow-list crosses several classifier categories (time, money, tools,
    // documents), and a couple of its words (経験, 知識, 協力) fall through
    // the classifier's fallback bucket entirely, which validInanimatePool
    // excludes outright. Matching by exact word text sidesteps both issues.
    const object=adjective.id==='hitsuyou'
      ? pick(vocabulary.filter(word=>hitsuyouCompatibleWords.has(word.japanese) && hasUsableMeaning(word)),172)
      : adjective.id==='sukunai'
        ? pick(vocabulary.filter(word=>sukunaiCompatibleWords.has(word.japanese) && hasUsableMeaning(word)),172)
        : adjective.id==='kanzen'
          ? pick(vocabulary.filter(word=>kanzenCompatibleWords.has(word.japanese) && hasUsableMeaning(word)),172)
        : adjective.id==='nigiyaka'
          ? pick(validPlacePool(vocabulary).filter(word=>matchingTags(word,crowdedPlaceTags).length>0 && !['ヨーロッパ','アジア','アフリカ','外国'].includes(word.japanese)),172)
          : adjective.id==='kurai' || adjective.id==='akarui'
            // A whole city or country is not intrinsically dark/bright — that
            // only makes sense for a bounded local space (room, street, forest).
            ? pick(validInanimatePool(vocabulary,adjective.categories).filter(word=>![...tagSet(word)].some(tag=>geographicOriginTags.has(tag))),172)
          : adjective.id==='nagai' || adjective.id==='mijikai'
            // 長い/短い describe a clear linear dimension. The broad Object/Document/
            // Book/Vehicle categories let anything physical through (shoes, a bag),
            // most of which are not naturally described that way.
            ? pick(vocabulary.filter(word=>linearDimensionWords.has(word.japanese) && hasUsableMeaning(word)),172)
          : adjective.id==='daijoubu'
            ? pick([...validHumanPool(vocabulary),...validInanimatePool(vocabulary,['Object']).filter(isPhysicalObject)],172)
            : adjective.id==='osoi' || adjective.id==='hayai-early'
              ? pick([...validHumanPool(vocabulary),...validInanimatePool(vocabulary,['Vehicle','Event'])],172)
              : adjective.categories.length===1 && adjective.categories[0]==='Person'
                ? pick(validHumanPool(vocabulary),172)
            : pick(validInanimatePool(vocabulary,adjective.categories).filter(word=>!adjective.physicalOnly || isPhysicalObject(word)),172)
    if (!object) return null
    const topicPredicate=(adjective.categories as SentenceCategory[]).includes('Person')
    // A person filling this slot needs subject-case English. objectEnglish()
    // stamps an indefinite article on whatever it is given, which turns the
    // pronoun pool into "an I is free" / "a he is free".
    const objectPhrase=topicPredicate
      ? englishPhrase(object,'subject')
      : objectEnglish(primaryEnglishGloss(object.preferredTranslation || object.english))
    // subjectUsesBaseVerb covers I/you/we/they plus plural noun phrases; "I" is
    // the one subject among them whose copula is neither is nor are.
    const copula=objectPhrase==='I'
      ? 'am'
      : subjectUsesBaseVerb(objectPhrase) ? 'are' : 'is'
    const copulaPast=objectPhrase==='I'
      ? 'was'
      : subjectUsesBaseVerb(objectPhrase) ? 'were' : 'was'
    // きれい/嫌い both end in い but are na-adjectives (でした/ではありません
    // attach directly); every other い-ending entry is a real i-adjective,
    // whose negative/past instead replace the final い (くない/かった).
    const isIAdjective = adjective.japanese.endsWith('い') && !['kirei','kirai'].includes(adjective.id)
    const adjectiveStem = isIAdjective ? adjective.japanese.slice(0,-1) : adjective.japanese
    const readingStem = isIAdjective ? adjective.reading.slice(0,-1) : adjective.reading
    const suffixes = isIAdjective
      ? ['いです。','くないです。','かったです。','くなかったです。']
      : ['です。','ではありません。','でした。','ではありませんでした。']
    const endingVariants=[
      `${objectPhrase.charAt(0).toUpperCase()+objectPhrase.slice(1)} ${copula} ${adjective.english}.`,
      `${objectPhrase.charAt(0).toUpperCase()+objectPhrase.slice(1)} ${copula} not ${adjective.english}.`,
      `${objectPhrase.charAt(0).toUpperCase()+objectPhrase.slice(1)} ${copulaPast} ${adjective.english}.`,
      `${objectPhrase.charAt(0).toUpperCase()+objectPhrase.slice(1)} ${copulaPast} not ${adjective.english}.`,
    ]
    let endingIndex = options.slotSeeds?.ending !== undefined ? Math.abs(options.slotSeeds.ending) % suffixes.length : 0
    const surfaceFor = (index: number) => `${adjectiveStem}${suffixes[index]}`
    if (options.avoidWords?.ending && surfaceFor(endingIndex) === options.avoidWords.ending) {
      endingIndex = (endingIndex + 1) % suffixes.length
    }
    const surface = surfaceFor(endingIndex)
    const reading = `${readingStem}${suffixes[endingIndex]}`
    const english = endingVariants[endingIndex]!
    const furigana=[wordPart(object,'object'),literalPart(topicPredicate?'は':'が',topicPredicate?'わ':'が'),{text:surface,reading,slot:'adjective'}]
    const adjectiveSlot={id:`adjective-${adjective.id}-${endingIndex}`,surface,dictionaryForm:adjective.japanese,reading,english,pos:'i_adjective' as const,jlpt:'N5' as const,tags:['adjective','compatible-predicate']}
    const endingSlot={id:`adjective-ending-${endingIndex}`,surface:suffixes[endingIndex]!,dictionaryForm:adjective.japanese,reading:suffixes[endingIndex]!,english,pos:'i_adjective' as const,jlpt:'N5' as const,tags:['ending']}
    return finish(furigana,english,{object},{adjective:adjectiveSlot,ending:endingSlot},['Adjective selected from a reviewed noun-compatibility rule.'])
  }
  if (patternId === 'n5-18') {
    const subject=pick(humans,181,'subject')
    const recipient=pick(namedRecipients(humans).filter(word=>word.id!==subject?.id),182,'recipient')
    if (!subject || !recipient) return null
    const subjectEnglish=englishPhrase(subject,'subject'),calls=subjectUsesBaseVerb(subjectEnglish)?'call':'calls'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(recipient,'recipient'),literalPart('に'),{text:'電話します',reading:'でんわします',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${calls} ${relatedPersonEnglish('recipient',recipient,subject)}.`,{subject,recipient},{verb:verbSlot('verb-denwa','電話します','電話する','でんわします','call',['communication','recipient-ni','suru-verb'])},['Recipient is a different person from the subject.','電話する accepts a に recipient.'])
  }
  if (patternId === 'n5-19') {
    // あげる/渡す/送る/見せる give TO the recipient; もらう receives FROM them —
    // opposite direction, same Subject-Person(に)-Object(を) surface shape, so
    // one pattern still works with a per-verb preposition and English verb.
    const givingVerbs: Array<{ id:string; japanese:string; dictionary:string; reading:string; base:string; baseThird:string; tags:string[]; objectTags:Set<string>; preposition:'to'|'from'; fixedRecipient?:boolean }> = [
      { id:'miseru', japanese:'見せます', dictionary:'見せる', reading:'みせます', base:'show', baseThird:'shows', tags:['transfer','showing','recipient-ni','transitive'], objectTags:showableObjectTags, preposition:'to' },
      { id:'ageru', japanese:'あげます', dictionary:'あげる', reading:'あげます', base:'give', baseThird:'gives', tags:['transfer','giving','recipient-ni','transitive'], objectTags:portableObjectTags, preposition:'to' },
      { id:'watasu', japanese:'渡します', dictionary:'渡す', reading:'わたします', base:'hand over', baseThird:'hands over', tags:['transfer','handing-over','recipient-ni','transitive'], objectTags:portableObjectTags, preposition:'to' },
      { id:'okuru-gift', japanese:'送ります', dictionary:'送る', reading:'おくります', base:'send', baseThird:'sends', tags:['transfer','sending','recipient-ni','transitive'], objectTags:mailableObjectTags, preposition:'to' },
      { id:'morau', japanese:'もらいます', dictionary:'もらう', reading:'もらいます', base:'receive', baseThird:'receives', tags:['transfer','receiving','source-ni','transitive'], objectTags:portableObjectTags, preposition:'from' },
      { id:'kureru', japanese:'くれます', dictionary:'くれる', reading:'くれます', base:'give', baseThird:'gives', tags:['transfer','giving','speaker-benefit','recipient-ni','transitive'], objectTags:portableObjectTags, preposition:'to', fixedRecipient:true },
    ]
    const givingVerb=seededPick(givingVerbs,seed,190)
    const speaker=humans.find(word=>word.japanese==='私')
    // くれる's subject can't be any first-person pronoun — giving something to
    // yourself doesn't make sense — not just the specific word 私.
    const firstPersonWords=new Set(['私','私自身','俺','僕','我々','私たち'])
    const subject=pick(givingVerb?.fixedRecipient ? humans.filter(word=>!firstPersonWords.has(word.japanese)) : humans,191,'subject')
    const recipient=givingVerb?.fixedRecipient ? speaker : pick(namedRecipients(humans).filter(word=>word.id!==subject?.id),192)
    if (!givingVerb || !subject || !recipient) return null
    const sendableWords = new Set(['手紙','はがき','小包','荷物','箱','書類','資料','メール'])
    const eligible=inanimate.filter(word=>[...tagSet(word)].some(tag=>givingVerb.objectTags.has(tag))
      && !workplaceDocumentWords.has(word.japanese)
      && (givingVerb.id !== 'okuru-gift' || sendableWords.has(word.japanese)))
    const object=pick(eligible,193,'object')
    if (!object) return null
    const subjectEnglish=englishPhrase(subject,'subject'),verbEnglish=subjectUsesBaseVerb(subjectEnglish)?givingVerb.base:givingVerb.baseThird
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(recipient,'recipient'),literalPart('に'),wordPart(object,'object'),literalPart('を'),{text:givingVerb.japanese,reading:givingVerb.reading,slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${verbEnglish} ${englishPhrase(object,'object')} ${givingVerb.preposition} ${relatedPersonEnglish('recipient',recipient,subject)}.`,{subject,recipient,object},{verb:verbSlot(`verb-${givingVerb.id}`,givingVerb.japanese,givingVerb.dictionary,givingVerb.reading,givingVerb.base,[...givingVerb.tags])},['Object matches the chosen verb\'s own transfer-object tags.','Recipient is a different person from the subject.'])
  }
  if (patternId === 'n5-20') {
    const subject=pick(humans,201,'subject')
    const portable=vocabulary.filter(word=>categoryMatch(word,possessableCategories) && [...tagSet(word)].some(tag=>portableObjectTags.has(tag)) && ![...tagSet(word)].some(tag=>disallowedPhysicalObjectTags.has(tag)))
    const object=pick(portable,203,'object')
    const destination=object && categoryMatch(object,['Food','Drink'])
      ? pick(places.filter(word=>![...tagSet(word)].some(tag=>geographicOriginTags.has(tag))),202)
      : pick(places,202)
    if (!subject || !destination || !object) return null
    const subjectEnglish=englishPhrase(subject,'subject'),takes=subjectUsesBaseVerb(subjectEnglish)?'take':'takes'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(destination,'destination'),literalPart('へ','え'),wordPart(object,'object'),literalPart('を'),{text:'持って行きます',reading:'もっていきます',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${takes} ${englishPhrase(object,'object')} to ${englishPhrase(destination,'destination')}.`,{subject,destination,object},{verb:verbSlot('verb-motte-iku','持って行きます','持って行く','もっていきます','take',['movement','carrying','portable-object'])},['Object has a portable semantic tag.','Destination is valid for movement.'])
  }
  if (patternId === 'n5-21') {
    const subject=pick(humans,211,'subject')
    const animalSubject=subject ? [...tagSet(subject)].some(tag=>animalSubjectTags.includes(tag)) : false
    const objects=validInanimatePool(vocabulary,possessableCategories).filter(word=>{
      const tags=tagSet(word)
      return isPhysicalObject(word)
        && !tags.has('rare')
        && word.japanese !== '番組'
        && !['電車','列車','新幹線'].includes(word.japanese)
        && !tags.has('train')
        && !tags.has('railway')
        && (!animalSubject || [...tags].some(tag=>animalHoshiiTags.has(tag)))
        // 餌 is animal feed, not a natural possession request for a human.
        && (animalSubject || word.japanese !== '餌')
    })
    const object=pick(objects,212,'object')
    if (!subject || !object) return null
    const subjectEnglish=englishPhrase(subject,'subject'),wants=subjectUsesBaseVerb(subjectEnglish)?'want':'wants'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('が'),{text:'ほしいです',reading:'ほしいです',slot:'predicate'}]
    const predicate={id:'predicate-hoshii',surface:'ほしいです',dictionaryForm:'ほしい',reading:'ほしいです',english:'want',pos:'i_adjective' as const,jlpt:'N5' as const,tags:['desire','possessable-object']}
    return finish(furigana,`${englishPhrase(subject,'subject').replace(/^./,character=>character.toUpperCase())} ${wants} ${englishPhrase(object,'object')}.`,{subject,object},{predicate},['Object is tangible and reasonably possessable.'])
  }
  if (patternId === 'n5-22') {
    // 階段/廊下/玄関 etc. are sub-building structural parts, not places on their
    // own scale — pairing one with a broad area like 近所 skips the building
    // that would actually contain it and breaks the route's spatial logic.
    const walkablePlaces=places.filter(word=>![...tagSet(word)].some(tag=>walkingIncompatibleTags.has(tag)) && !subBuildingStructureWords.has(word.japanese) && !['山','売り場'].includes(word.japanese))
    const subject=pick(humans,221,'subject'),origin=pick(walkablePlaces,222,'origin')
    const destination=pick(walkablePlaces.filter(word=>word.japanese!==origin?.japanese),223,'destination')
    if (!subject || !origin || !destination) return null
    const subjectEnglish=englishPhrase(subject,'subject'),walks=subjectUsesBaseVerb(subjectEnglish)?'walk':'walks'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(origin,'origin'),literalPart('から'),wordPart(destination,'destination'),literalPart('まで'),{text:'歩きます',reading:'あるきます',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${walks} from ${originEnglish(origin)} to ${englishPhrase(destination,'destination')}.`,{subject,origin,destination},{verb:verbSlot('verb-aruku-route','歩きます','歩く','あるきます','walk',['movement','origin','endpoint'])},['Origin and destination are different valid places.','歩く is a movement verb.'])
  }
  if (patternId === 'n5-24') {
    const directVerbs=verbs.filter(verb=>['taberu-basic','nomu-basic','yomu-basic','miru-basic'].includes(verb.id))
    const verb=options.verbId ? directVerbs.find(candidate=>candidate.id===options.verbId) : seededPick(directVerbs,options.slotSeeds?.verb??seed,241)
    const result=verb ? fillVerbSlots(verb,vocabulary,seed,242,options) : null
    if (!verb||!result) return null
    const negative=appendForm(n4VerbForms(verb).masuStem,'ません')
    const subject=result.filled.subject!,object=result.filled.object!
    const subjectEnglish=englishPhrase(subject,'subject')
    const englishVerb=translatedVerb(verb,{subject,object},subjectUsesBaseVerb(subjectEnglish))
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('しか'),{text:negative.japanese,reading:negative.reading,slot:'verb'}]
    const verbSlotData={...verbSlot(`verb-${verb.id}-shika-nai`,negative.japanese,verb.japanese,negative.reading,verb.english,['only','negative-polite','shika-nai']),conjugation:'negative-polite'}
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} only ${englishVerb} ${englishPhrase(object,'object')}.`,{subject,object},{verb:verbSlotData},['Verb selected first and supplied the object rule.','しか is paired with a negative polite verb.'])
  }
  if (patternId === 'n5-30') {
    // 痛い is deliberately excluded from n5-17's generic adjective pattern
    // (see its own comment) because a bare-subject "太郎は痛いです" doesn't
    // work the way "太郎は忙しいです" does — 痛い needs the body part that
    // hurts named explicitly, is-a-topic + body-part-が-adjective, the
    // standard health-complaint frame every beginner course teaches. This
    // gives 手/足/頭/顔/耳/口/首/肩/腰/おなか/目 a real home for the first time.
    // 尻尾 (tail) carries 'body-part' too but is animal-only — everything else
    // tagged body-part is a real human body part, including おなか (stomach),
    // which lacks the 'human' tag other entries have but is exactly the word
    // this pattern most needs (おなかが痛い is the textbook example).
    const bodyParts = bodyPartPool(vocabulary)
    const subject = pick(humans, 1501, 'subject')
    const bodyPart = pick(bodyParts, 1502, 'object')
    if (!subject || !bodyPart) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    // A possessive ("X's ___") needs the bare noun, not englishPhrase's
    // indefinite article — "a customer's a face hurts" doubles the article.
    // 胸's dictionary entry leads with "breast", but "chest hurts" is what a
    // beginner sentence actually means here.
    const bodyPartEnglish = bodyPart.japanese === '胸' ? 'chest' : primaryEnglishGloss(bodyPart.preferredTranslation || bodyPart.english)
    // 痛い conjugates as a plain i-adjective, same as n5-17's toggle — 痛いです/
    // 痛くないです/痛かったです/痛くなかったです cover "hurts/doesn't hurt/hurt/
    // didn't hurt" without needing a separate grammar point for tense.
    const suffixes = ['いです。','くないです。','かったです。','くなかったです。']
    let endingIndex = options.slotSeeds?.ending !== undefined ? Math.abs(options.slotSeeds.ending) % suffixes.length : 0
    const surfaceFor = (index: number) => `痛${suffixes[index]}`
    if (options.avoidWords?.ending && surfaceFor(endingIndex) === options.avoidWords.ending) {
      endingIndex = (endingIndex + 1) % suffixes.length
    }
    const surface = surfaceFor(endingIndex)
    const reading = `いた${suffixes[endingIndex]}`
    const englishBySuffix = [
      `${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)}'s ${bodyPartEnglish} hurts.`,
      `${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)}'s ${bodyPartEnglish} does not hurt.`,
      `${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)}'s ${bodyPartEnglish} hurt.`,
      `${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)}'s ${bodyPartEnglish} did not hurt.`,
    ]
    const english = englishBySuffix[endingIndex]!
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(bodyPart,'object'),literalPart('が'),{text:surface,reading,slot:'adjective'}]
    const adjectiveSlot={id:`adjective-itai-${endingIndex}`,surface,dictionaryForm:'痛い',reading,english,pos:'i_adjective' as const,jlpt:'N5' as const,tags:['adjective','body-complaint']}
    const endingSlot={id:`itai-ending-${endingIndex}`,surface:suffixes[endingIndex]!,dictionaryForm:'痛い',reading:suffixes[endingIndex]!,english,pos:'i_adjective' as const,jlpt:'N5' as const,tags:['ending']}
    return finish(furigana,english,{subject,object:bodyPart},{adjective:adjectiveSlot,ending:endingSlot},['痛い needs a body part named explicitly, not a bare subject.'])
  }
  if (patternId === 'n5-33') {
    // A counted quantity: 私は本を三冊読みます. The counter is picked from the
    // object, not chosen freely — 本 takes 冊 and お茶 takes 杯, and using the
    // wrong one is as wrong as a bad particle.
    const frame = COUNTED_FRAMES[Math.abs(seed + 1601) % COUNTED_FRAMES.length]!
    const candidates = vocabulary.filter(word => frame.words.has(word.japanese))
    const subject = pick(humans, 1602, 'subject')
    const object = pick(candidates, 1603, 'object')
    if (!subject || !object) return null
    const forms = COUNTER_FORMS[frame.counter]!
    let countIndex = Math.abs(options.slotSeeds?.ending ?? seed + 1604) % forms.length
    const surfaceFor = (index: number) => forms[index]![0]
    if (options.avoidWords?.ending && surfaceFor(countIndex) === options.avoidWords.ending) {
      countIndex = (countIndex + 1) % forms.length
    }
    const [countSurface, countReading] = forms[countIndex]!
    const subjectEnglish = englishPhrase(subject,'subject')
    const objectGloss = primaryEnglishGloss(object.preferredTranslation || object.english)
    const plural = countIndex === 0 ? objectGloss : pluralize(objectGloss)
    // 一杯 is "one cup of tea", not "one tea"; the measure word itself is what
    // pluralises.
    const quantity = frame.measureOf
      ? `${COUNTER_ENGLISH[countIndex]} ${countIndex === 0 ? frame.measureOf : pluralize(frame.measureOf)} of ${objectGloss}`
      : `${COUNTER_ENGLISH[countIndex]} ${plural}`
    const verbEnglish = subjectUsesBaseVerb(subjectEnglish) ? frame.verb.english : frame.verb.englishThird
    const english = `${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${verbEnglish} ${quantity}.`
    const furigana = [
      wordPart(subject,'subject'),literalPart('は','わ'),
      wordPart(object,'object'),literalPart('を'),
      {text:countSurface,reading:countReading,slot:'count'},
      {text:frame.verb.japanese,reading:frame.verb.reading,slot:'verb'},
    ]
    const countSlot = {id:`count-${frame.counter}-${countIndex}`,surface:countSurface,dictionaryForm:countSurface,reading:countReading,english:quantity,pos:'noun' as const,jlpt:'N5' as const,tags:['counter',frame.counter]}
    const endingSlot = {id:`count-ending-${countIndex}`,surface:countSurface,dictionaryForm:countSurface,reading:countReading,english:quantity,pos:'noun' as const,jlpt:'N5' as const,tags:['ending']}
    return finish(furigana,english,{subject,object},{count:countSlot,ending:endingSlot},[`${frame.counter} is the counter ${object.japanese} takes.`])
  }
  if (patternId === 'n5-38') {
    let weatherIndex = Math.abs(options.slotSeeds?.ending ?? seed + 1650) % WEATHER_FRAMES.length
    if (options.avoidWords?.ending && WEATHER_FRAMES[weatherIndex]!.japanese === options.avoidWords.ending) {
      weatherIndex = (weatherIndex + 1) % WEATHER_FRAMES.length
    }
    const weather = WEATHER_FRAMES[weatherIndex]!
    const weatherPart = {text:weather.japanese,reading:weather.reading,slot:'weather'}
    const weatherSlot = {id:`weather-${weather.japanese}-${weather.shape}`,surface:weather.japanese,dictionaryForm:weather.japanese,reading:weather.reading,english:weather.english,pos:'noun' as const,jlpt:'N5' as const,tags:['weather',weather.shape]}
    const endingSlot = {id:`weather-ending-${weatherIndex}`,surface:weather.japanese,dictionaryForm:weather.japanese,reading:weather.reading,english:weather.english,pos:'noun' as const,jlpt:'N5' as const,tags:['ending']}
    const extra = {weather:weatherSlot,ending:endingSlot}
    const time = WEATHER_TIMES[Math.abs(seed + 1651) % WEATHER_TIMES.length]!
    const timePart = {text:time.japanese,reading:time.reading,slot:'time'}

    if (weather.shape === 'state') {
      // 今日は雨です — the Japanese predicate is a noun, the English an
      // adjective with a dummy "it" that Japanese never uses.
      const furigana=[timePart,literalPart('は','わ'),weatherPart,literalPart('です')]
      return finish(furigana,`It is ${weather.english} ${time.english}.`,{},extra,['A weather noun predicates directly with です.'])
    }
    if (weather.shape === 'falls') {
      const furigana=[timePart,literalPart('は','わ'),weatherPart,literalPart('が'),{text:'降ります',reading:'ふります',slot:'verb'}]
      return finish(furigana,`It ${weather.english} ${time.english}.`,{},extra,['降る is the verb rain and snow take.'])
    }
    if (weather.shape === 'strong') {
      const furigana=[timePart,literalPart('は','わ'),weatherPart,literalPart('が'),{text:'強いです',reading:'つよいです',slot:'adjective'}]
      return finish(furigana,`The ${weather.english} is strong ${time.english}.`,{},extra,['強い describes wind and thunder, not the day itself.'])
    }
    if (weather.shape === 'quality') {
      const good = Math.abs(seed + 1652) % 2 === 0
      const furigana=[timePart,literalPart('は','わ'),weatherPart,literalPart('が'),{text:good?'いいです':'悪いです',reading:good?'いいです':'わるいです',slot:'adjective'}]
      return finish(furigana,`The ${weather.english} is ${good?'good':'bad'} ${time.english}.`,{},extra,['天気 takes a quality adjective, not a weather noun.'])
    }
    const furigana=[timePart,literalPart('は','わ'),weatherPart,literalPart('が'),{text:'きれいです',reading:'きれいです',slot:'adjective'}]
    const isPlural = isPluralPhrase(weather.english)
    return finish(furigana,`The ${weather.english} ${isPlural?'are':'is'} beautiful ${time.english}.`,{},extra,['きれい describes something seen, not the weather itself.'])
  }
  if (patternId === 'n5-37') {
    // Question sentences. か marks the whole clause, and the question word sits
    // where the answer would go — which is a different position for each one.
    let questionIndex = Math.abs(options.slotSeeds?.ending ?? seed + 1640) % QUESTION_FRAMES.length
    if (options.avoidWords?.ending && QUESTION_FRAMES[questionIndex]!.japanese === options.avoidWords.ending) {
      questionIndex = (questionIndex + 1) % QUESTION_FRAMES.length
    }
    const question = QUESTION_FRAMES[questionIndex]!
    const questionPart = {text:question.japanese,reading:question.reading,slot:'question'}
    const questionSlot = {id:`question-${question.japanese}`,surface:question.japanese,dictionaryForm:question.japanese,reading:question.reading,english:question.shape,pos:'noun' as const,jlpt:'N5' as const,tags:['question','interrogative']}
    const endingSlot = {id:`question-ending-${questionIndex}`,surface:question.japanese,dictionaryForm:question.japanese,reading:question.reading,english:question.shape,pos:'noun' as const,jlpt:'N5' as const,tags:['ending']}
    const extra = {question:questionSlot,ending:endingSlot}

    if (question.shape === 'price') {
      const item = pick(vocabulary.filter(word => PRICED_OBJECTS.has(word.japanese)), 1641, 'object')
      if (!item) return null
      const itemEnglish = definite(primaryEnglishGloss(item.preferredTranslation || item.english))
      const furigana=[wordPart(item,'object'),literalPart('は','わ'),questionPart,literalPart('ですか')]
      return finish(furigana,`How much ${isPluralPhrase(itemEnglish)?'are':'is'} ${itemEnglish}?`,{object:item},extra,['いくら asks a price and takes the copula.'])
    }

    const subject = pick(humans, 1642, 'subject')
    if (!subject) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    // English questions need do-support, which Japanese does not: 「行きますか」
    // is one word where "does ... go" is three.
    const does = subjectEnglish==='I' ? 'do' : subjectUsesBaseVerb(subjectEnglish) ? 'do' : 'does'

    if (question.shape === 'destination') {
      const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),questionPart,literalPart('に'),{text:'行きますか',reading:'いきますか',slot:'verb'}]
      return finish(furigana,`Where ${does} ${subjectEnglish} go?`,{subject},extra,['どこ stands where the destination would go.'])
    }
    if (question.shape === 'object') {
      const frame = TIMED_ACTION_FRAMES[Math.abs(seed + 1643) % TIMED_ACTION_FRAMES.length]!
      const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),questionPart,literalPart('を'),{text:`${frame.present.japanese}か`,reading:`${frame.present.reading}か`,slot:'verb'}]
      return finish(furigana,`What ${does} ${subjectEnglish} ${frame.english.base}?`,{subject},extra,['何 stands where the object would go.'])
    }
    // reason: the question word fronts the clause and nothing is removed.
    const frame = TIMED_ACTION_FRAMES[Math.abs(seed + 1644) % TIMED_ACTION_FRAMES.length]!
    const object = pick(vocabulary.filter(word => frame.words.has(word.japanese)), 1645, 'object')
    if (!object) return null
    const furigana=[questionPart,wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('を'),{text:`${frame.present.japanese}か`,reading:`${frame.present.reading}か`,slot:'verb'}]
    return finish(furigana,`Why ${does} ${subjectEnglish} ${frame.english.base} ${englishPhrase(object,'object')}?`,{subject,object},extra,['どうして fronts the clause and removes nothing.'])
  }
  if (patternId === 'n5-36') {
    // Reference の Position に Subject が あります/います — the existence frame
    // built on a positional noun. います for animals, あります for things.
    let positionIndex = Math.abs(seed + 1630) % POSITION_NOUNS.length
    if (options.avoidWords?.ending && POSITION_NOUNS[positionIndex]!.japanese === options.avoidWords.ending) {
      positionIndex = (positionIndex + 1) % POSITION_NOUNS.length
    }
    const chosen = POSITION_NOUNS[positionIndex]!
    const reference = pick(vocabulary.filter(word => POSITION_REFERENCE_SETS[chosen.references].has(word.japanese)), 1631, 'location')
    const subject = pick(vocabulary.filter(word => POSITION_SUBJECTS.has(word.japanese)), 1632, 'subject')
    if (!reference || !subject) return null
    const animate = [...tagSet(subject)].some(tag => animalSubjectTags.includes(tag))
    const verb = animate ? {japanese:'います',reading:'います'} : {japanese:'あります',reading:'あります'}
    const subjectEnglish = objectEnglish(primaryEnglishGloss(subject.preferredTranslation || subject.english))
    const referenceEnglish = definite(primaryEnglishGloss(reference.preferredTranslation || reference.english))
    const furigana = [
      wordPart(reference,'location'),literalPart('の'),
      {text:chosen.japanese,reading:chosen.reading,slot:'position'},
      literalPart('に'),
      wordPart(subject,'subject'),literalPart('が'),
      {text:verb.japanese,reading:verb.reading,slot:'verb'},
    ]
    // 眼鏡 glosses as "glasses" — plural, so the existence verb has to agree.
    const english = `There ${isPluralPhrase(subjectEnglish) ? 'are' : 'is'} ${subjectEnglish} ${chosen.english} ${referenceEnglish}.`
    const positionSlot = {id:`position-${chosen.japanese}`,surface:chosen.japanese,dictionaryForm:chosen.japanese,reading:chosen.reading,english:chosen.english,pos:'noun' as const,jlpt:'N5' as const,tags:['position','relative-location']}
    const endingSlot = {id:`position-ending-${positionIndex}`,surface:chosen.japanese,dictionaryForm:chosen.japanese,reading:chosen.reading,english:chosen.english,pos:'noun' as const,jlpt:'N5' as const,tags:['ending']}
    return finish(furigana,english,{location:reference,subject},{position:positionSlot,ending:endingSlot},['A positional noun attaches to its reference with の.',`${verb.japanese} is the ${animate?'animate':'inanimate'} existence verb.`])
  }
  if (patternId === 'n5-35') {
    // Time Subject は Object を Verb — the time word picks the tense. These are
    // all relative to now, so none of them takes に.
    const frame = TIMED_ACTION_FRAMES[Math.abs(seed + 1620) % TIMED_ACTION_FRAMES.length]!
    const candidates = vocabulary.filter(word => frame.words.has(word.japanese))
    const subject = pick(humans, 1621, 'subject')
    const object = pick(candidates, 1622, 'object')
    if (!subject || !object) return null
    let timeIndex = Math.abs(options.slotSeeds?.ending ?? seed + 1623) % TIME_ADVERBIALS.length
    if (options.avoidWords?.ending && TIME_ADVERBIALS[timeIndex]!.japanese === options.avoidWords.ending) {
      timeIndex = (timeIndex + 1) % TIME_ADVERBIALS.length
    }
    const time = TIME_ADVERBIALS[timeIndex]!
    const verb = time.tense === 'past' ? frame.past : frame.present
    const subjectEnglish = englishPhrase(subject,'subject')
    const objectEnglish = englishPhrase(object,'object')
    const verbEnglish = time.tense === 'past'
      ? frame.english.past
      : time.tense === 'future'
        ? `will ${frame.english.base}`
        : subjectUsesBaseVerb(subjectEnglish) ? frame.english.base : frame.english.third
    const furigana = [
      {text:time.japanese,reading:time.reading,slot:'time'},
      wordPart(subject,'subject'),literalPart('は','わ'),
      wordPart(object,'object'),literalPart('を'),
      {text:verb.japanese,reading:verb.reading,slot:'verb'},
    ]
    const english = `${time.english.charAt(0).toUpperCase()+time.english.slice(1)} ${subjectEnglish} ${verbEnglish} ${objectEnglish}.`
    const timeSlot = {id:`time-${time.japanese}`,surface:time.japanese,dictionaryForm:time.japanese,reading:time.reading,english:time.english,pos:'noun' as const,jlpt:'N5' as const,tags:['time',time.tense]}
    const endingSlot = {id:`time-ending-${timeIndex}`,surface:time.japanese,dictionaryForm:time.japanese,reading:time.reading,english:time.english,pos:'noun' as const,jlpt:'N5' as const,tags:['ending']}
    return finish(furigana,english,{subject,object},{time:timeSlot,ending:endingSlot},[`${time.japanese} is relative to now, so it takes no に.`,`${time.japanese} forces the ${time.tense} form.`])
  }
  if (patternId === 'n5-34') {
    // Place に Person が N人 います — the people counter, which is the one
    // counter series a learner meets before any object counter.
    // Directions (東, 西) are in the place pool but "at the east" is not where
    // people stand; this frame wants somewhere you can be inside or at.
    const countablePlaces = places.filter(word => ![...tagSet(word)].some(tag => ['direction','compass'].includes(tag)))
    // A pronoun cannot be counted — "there is one we" — and neither can the
    // speaker's own family terms, which are already definite.
    const countablePeople = humans.filter(word => {
      const tags = tagSet(word)
      if (tags.has('pronoun') || tags.has('first-person')) return false
      if (countableExemptPeople.has(word.japanese)) return false
      // A group noun is not counted with 人: 夫婦 takes 組, and 両親 already
      // means both of them, so 両親が三人 is wrong however it is glossed.
      return !isPluralPhrase(primaryEnglishGloss(word.preferredTranslation || word.english))
    })
    const place = pick(countablePlaces, 1610, 'place')
    const person = pick(countablePeople, 1611, 'subject')
    if (!place || !person) return null
    const forms = COUNTER_FORMS.nin!
    let countIndex = Math.abs(options.slotSeeds?.ending ?? seed + 1612) % forms.length
    if (options.avoidWords?.ending && forms[countIndex]![0] === options.avoidWords.ending) {
      countIndex = (countIndex + 1) % forms.length
    }
    const [countSurface, countReading] = forms[countIndex]!
    const personGloss = primaryEnglishGloss(person.preferredTranslation || person.english)
    // The count already says how many, so the English noun is bare and plural
    // rather than taking an article: "two students are", not "two a students".
    const counted = countIndex === 0 ? personGloss : pluralizePerson(personGloss)
    const furigana = [
      wordPart(place,'place'),literalPart('に'),
      wordPart(person,'subject'),literalPart('が'),
      {text:countSurface,reading:countReading,slot:'count'},
      {text:'います',reading:'います',slot:'verb'},
    ]
    const english = `There ${countIndex === 0 ? 'is' : 'are'} ${COUNTER_ENGLISH[countIndex]} ${counted} ${englishPhrase(place,'location')}.`
    const countSlot = {id:`count-nin-${countIndex}`,surface:countSurface,dictionaryForm:countSurface,reading:countReading,english:`${COUNTER_ENGLISH[countIndex]} people`,pos:'noun' as const,jlpt:'N5' as const,tags:['counter','nin']}
    const endingSlot = {id:`count-nin-ending-${countIndex}`,surface:countSurface,dictionaryForm:countSurface,reading:countReading,english:`${COUNTER_ENGLISH[countIndex]} people`,pos:'noun' as const,jlpt:'N5' as const,tags:['ending']}
    return finish(furigana,english,{place,subject:person},{count:countSlot,ending:endingSlot},['人 is the counter for people.','います is the animate existence verb.'])
  }
  if (patternId === 'n5-31') {
    // 乗る never existed at all — every vehicle word (自転車, 飛行機, 自動車,
    // 電車, 救急車, 消防車, ...) had no verb whose object/destination category
    // fit them. "Xに乗ります" (ride/board X) is the standard, extremely common
    // N5 frame that actually matches how vehicle nouns are used.
    // Vehicles used to arrive in the Objects bucket; they now have a category
    // of their own, so this accepts both rather than silently emptying out and
    // leaving the pattern to fall back to its catalog example.
    const vehicles = vocabulary.filter(word => categoryMatch(word,['Vehicle','Object']) && word.tags.includes('vehicle'))
    const subject = pick(humans, 1511, 'subject')
    const vehicle = pick(vehicles, 1512, 'destination')
    if (!subject || !vehicle) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const rides = subjectUsesBaseVerb(subjectEnglish) ? 'ride' : 'rides'
    const vehicleEnglish = englishPhrase(vehicle,'object')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(vehicle,'destination'),literalPart('に'),{text:'乗ります',reading:'のります',slot:'verb'}]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${rides} ${vehicleEnglish}.`,{subject,destination:vehicle},{verb:verbSlot('verb-noru','乗ります','乗る','のります','ride',['movement','vehicle','transitive'])},['Vehicle is a valid Vehicle-category word.'])
  }
  const subject=pick(humans,231,'subject')
  if (!subject) return null
  const subjectEnglish=englishPhrase(subject,'subject'),go=subjectUsesBaseVerb(subjectEnglish)?'go':'goes'
  const furigana=[wordPart(subject,'subject'),literalPart('も'),{text:'行きます',reading:'いきます',slot:'verb'}]
  return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${go} too.`,{subject},{verb:verbSlot('verb-iku-mo','行きます','行く','いきます','go',['movement','additive-topic','context-dependent'])},['も marks an additional subject.','This template assumes prior discourse context.'])
}

const additionalN4PatternIds = new Set(Array.from({length:21},(_,index)=>`n4-${String(index+11).padStart(2,'0')}`))

function additionalN4Sentence(seed: number,patternId: string,options: CategorySentenceOptions={}): GeneratedPreviewSentence | null {
  if (!additionalN4PatternIds.has(patternId)) return null
  const vocabulary=generatorWords()
  const humans=validHumanPool(vocabulary)
  const places=validPlacePool(vocabulary)
  const pick=requiredWordPicker(seed,options.requiredWord,options)
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
  const movementDestination=(word: WordRecord)=> {
    const destination = destinationEnglish(word)
    if (word.japanese === '家') return 'home'
    // 店内 is naturally "into the store," never "to the inside the store."
    if (word.japanese === '店内' || destination.includes('inside the store')) return 'into the store'
    if (destination.startsWith('inside ')) return `into ${destination.slice('inside '.length)}`
    return `to ${destination}`
  }
  const studyLocationEnglish=(word: WordRecord)=>({家:'at home',学校:'at school',大学:'at university',高校:'at high school'}[word.japanese]??englishPhrase(word,'location'))
  const directActionVerbs=verbs.filter(verb=>['taberu-basic','nomu-basic','yomu-basic','miru-basic'].includes(verb.id))
  const pickDirectVerb=(salt: number) => options.verbId
    ? directActionVerbs.find(candidate=>candidate.id===options.verbId)
    : seededPick(directActionVerbs,seed,salt)
  const actionPair=(salt: number) => {
    const firstVerb=pickDirectVerb(salt)
    // The furigana tags these two objects 'firstObject'/'mainObject', not
    // fillVerbSlots' generic 'object' — remap so a rotation request for
    // either one reaches the right call.
    const firstOptions={...options,slotSeeds:{object:options.slotSeeds?.firstObject},avoidWords:{object:options.avoidWords?.firstObject}}
    const mainOptions={...options,slotSeeds:{object:options.slotSeeds?.mainObject},avoidWords:{object:options.avoidWords?.mainObject}}
    const firstResult=firstVerb ? fillVerbSlots(firstVerb,vocabulary,seed,salt+1,firstOptions) : null
    const mainVerb=pick(directActionVerbs.filter(verb=>verb.id!==firstVerb?.id),salt+2)
    if (!firstVerb||!firstResult||!mainVerb) return null

    let mainResult: ReturnType<typeof fillVerbSlots> = null
    for (let attempt=0;attempt<8;attempt+=1) {
      const candidate=fillVerbSlots(mainVerb,vocabulary,seed+attempt,salt+3+attempt,mainOptions)
      if (candidate && candidate.filled.object?.id!==firstResult.filled.object?.id) {
        mainResult=candidate
        break
      }
    }
    const subject=pick(humans,salt+20,'subject')
    if (!mainResult||!subject) return null
    firstResult.filled.subject=subject
    mainResult.filled.subject=subject
    return { firstVerb, firstResult, mainVerb, mainResult, subject }
  }

  if (patternId==='n4-11') {
    const studyPlaces=new Set(['図書館','学校','大学','教室','家','カフェ'])
    const studySubjectTags=new Set(normalizeTags(['student','teacher','child','teenager','boy','girl','son','daughter','pupil','classmate']))
    const place=pick(places.filter(word=>studyPlaces.has(word.japanese)),411,'place')
    const ageMismatchTags=place?.japanese==='大学'?new Set(normalizeTags(['baby','child','boy','girl'])):place?.japanese==='高校'?new Set(normalizeTags(['baby','child'])):new Set<string>()
    const subject=pick(humans.filter(word=>{
      const tags=tagSet(word)
      return [...tags].some(tag=>studySubjectTags.has(tag))&&![...tags].some(tag=>ageMismatchTags.has(tag))
    }),412,'subject')
    if (!place||!subject) return null
    const subjectEnglish=englishPhrase(subject,'subject')
    const studies=subjectEnglish==='I'?'am studying':subjectUsesBaseVerb(subjectEnglish)?'are studying':'is studying'
    const furigana=[wordPart(place,'place'),literalPart('で'),wordPart(subject,'subject'),literalPart('が'),literalPart('勉強しています','べんきょうしています','verb')]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${studies} ${studyLocationEnglish(place)}.`,{place,subject},{verb:grammarSlot('verb-benkyou-progressive','勉強しています','勉強する','べんきょうしています','study',['ongoing','study','location-compatible'])},['Place supports studying.','Subject is compatible with the activity.'])
  }
  if (patternId==='n4-12') {
    const pastTimeWords=new Set(['昨日','昨夜','先週','先月','去年','一昨日','七時','八時'])
    const noParticleTimes=new Set(['昨日','昨夜','先週','先月','去年','一昨日'])
    const time=pick(vocabulary.filter(word=>word.categories.includes('Time')&&pastTimeWords.has(word.japanese)),421,'time')
    const subject=pick(humans,422,'subject')
    if (!time||!subject) return null
    const useNi=!noParticleTimes.has(time.japanese)
    const subjectEnglish=englishPhrase(subject,'subject')
    const furigana=[wordPart(time,'time'),...(useNi?[literalPart('に')]:[]),wordPart(subject,'subject'),literalPart('が'),literalPart('来ました','きました','verb')]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} came ${englishPhrase(time,'time')}.`,{time,subject},{verb:grammarSlot('verb-kuru-past','来ました','来る','きました','come',['completed-event','past'])},[useNi?'Specific clock time accepts に.':'Relative time correctly omits に.'])
  }
  if (patternId==='n4-13') {
    const activityVerb=pickDirectVerb(431)
    if (!activityVerb) return null
    const activity=fillVerbSlots(activityVerb,vocabulary,seed,432,options)
    const destinations=places.filter(word=>[...tagSet(word)].some(tag=>['school','university','library','office','store','park','station','home','house'].includes(tag)))
    const destination=pick(destinations,433,'destination')
    if (!activity||!destination) return null
    const selectedObject=activity.filled.object!
    const subject=activity.filled.subject!
    const replacementFoods=exact(['ご飯','パン','魚','肉','果物','卵','ラーメン','寿司'])
    const object=selectedObject.japanese==='食べ物'?(pick(replacementFoods,434)??selectedObject):selectedObject
    const te=n4VerbForms(activityVerb).te
    const objectEnglish=object.japanese==='ご飯'?'a meal':object.japanese==='食べ物'?'food':englishPhrase(object,'object')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('を'),literalPart(`${te.japanese}から`,`${te.reading}から`,'firstVerb'),wordPart(destination,'destination'),literalPart('へ','え'),literalPart('行きます','いきます','mainVerb')]
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
    const destination=pick(places.filter(word=>[...tagSet(word)].some(tag=>purpose.placeTags.includes(tag))),442,'destination')
    if (!destination) return null
    const purposeSurface=`${purpose.stem}に行きます`,purposeReading=`${purpose.reading}にいきます`
    const furigana=[wordPart(destination,'destination'),literalPart('へ','え'),literalPart(purposeSurface,purposeReading,'purposeVerb')]
    return finish(furigana,`I go ${movementDestination(destination)} to ${purpose.english}.`,{destination},{purposeVerb:grammarSlot(`purpose-${purpose.id}`,purposeSurface,purpose.dictionary,purposeReading,purpose.english,['purpose','movement'])},['Purpose is an activity.','Destination supports that activity.'])
  }
  if (patternId==='n4-15') {
    const pluralBenefactors=new Set(['人々','我々','私たち','両親','家族'])
    // Tag-based exclusion alone doesn't reliably catch every 私/俺/僕 word
    // record (their tag data doesn't consistently carry speaker/first-person/
    // pronoun) — matching by literal word text too, the same way n5-19
    // excludes くれる's speaker-benefit subject, is what actually keeps
    // "I lend myself a dictionary" from generating.
    const firstPersonWords=new Set(['私','私自身','俺','僕','我々','私たち'])
    const benefactor=pick(humans.filter(word=>!pluralBenefactors.has(word.japanese)&&!firstPersonWords.has(word.japanese)&&![...tagSet(word)].some(tag=>['speaker','first-person','second-person','pronoun'].includes(tag))),451,'subject')
    const object=pick(exact(['本','記事','新聞','辞書','小説']),452,'object')
    if (!benefactor||!object) return null
    const subjectEnglish=englishPhrase(benefactor,'subject')
    const lends=subjectUsesBaseVerb(subjectEnglish)?'lend':'lends'
    const furigana=[wordPart(benefactor,'subject'),literalPart('が'),wordPart(object,'object'),literalPart('を'),literalPart('貸してくれます','かしてくれます','verb')]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${lends} me ${englishPhrase(object,'object')}.`,{subject:benefactor,object},{verb:grammarSlot('verb-kashite-kureru','貸してくれます','貸す','かしてくれます','lend',['benefactive','speaker-benefit','te-kureru'])},['Action benefits the speaker.','Object can reasonably be lent.'])
  }
  if (patternId==='n4-16') {
    const helpers=humans.filter(word=>[...tagSet(word)].some(tag=>['teacher','parent','friend','student','classmate'].includes(tag)))
    const helper=pick(helpers,461,'helper'),object=pick(exact(['日本語','英語','中国語','外国語']),462,'object')
    if (!helper||!object) return null
    const furigana=[wordPart(helper,'helper'),literalPart('に'),wordPart(object,'object'),literalPart('を'),literalPart('教えてもらいます','おしえてもらいます','verb')]
    const languageEnglish={日本語:'Japanese',英語:'English',中国語:'Chinese',外国語:'a foreign language'}[object.japanese]??primaryEnglishGloss(object.preferredTranslation||object.english)
    const helperEnglish=companionKinshipTerms[helper.japanese]?`my ${companionKinshipTerms[helper.japanese]}`:englishPhrase(helper,'recipient')
    return finish(furigana,`I have ${helperEnglish} teach me ${languageEnglish}.`,{helper,object},{verb:grammarSlot('verb-oshiete-morau','教えてもらいます','教える','おしえてもらいます','have teach',['assistance','te-morau'])},['Helper is a person suited to teaching or assistance.'])
  }
  if (patternId==='n4-17') {
    const firstPersonRecipients=new Set(['私','俺','我々'])
    const subject=pick(exact(['私','俺']),471,'subject'),recipient=pick(humans.filter(word=>word.id!==subject?.id&&!firstPersonRecipients.has(word.japanese)),472,'recipient'),object=pick(exact(['本','記事','新聞','辞書','小説']),473,'object')
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
    const subject=pick(humans,501,'subject'),object=pick(exact(['漢字','本','記事','新聞','小説','手紙']),502,'object')
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
    const result=verb ? fillVerbSlots(verb,vocabulary,seed,542,options) : null
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
    const notRequired=subjectUsesBaseVerb(subjectEnglish)?'do not have to':'does not have to'
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${notRequired} ${base} ${englishPhrase(object,'object')}.`,{subject,object},{verb:grammarSlot(`verb-${verb.id}-nakute`,negative.japanese,verb.japanese,negative.reading,verb.english,['not-required','nakute-mo-ii'])},['Verb selected first and supplied the object rule.','なくてもいい expresses that the action is not required.'])
  }
  // ---- Abstract-noun topics (n4-26 … n4-28) ----
  // Ideas, feelings and situations had no frame at all: every Object slot in
  // the engine wants something physical. These three take an abstract noun as
  // the thing discussed, judged or explained, which is how such nouns actually
  // appear in Japanese.
  if (patternId==='n4-26' || patternId==='n4-27' || patternId==='n4-28') {
    const topic=pick(abstractTopicPool(vocabulary),seed+560,'topic')
    if (!topic) return null
    const topicEnglish=abstractTopicEnglish(primaryEnglishGloss(topic.preferredTranslation||topic.english))

    if (patternId==='n4-27') {
      // 〜は大切です — a judgement about the topic, with no subject at all, so
      // it is the one frame here that does not need a person.
      // A plural gloss needs a plural copula — 道順 glosses as "directions",
      // and "the directions is important" is broken English.
      const plural=isPluralPhrase(topicEnglish)
      const endings=[
        {japanese:'大切です',reading:'たいせつです',english:plural?'are important':'is important'},
        {japanese:'大切ではありません',reading:'たいせつではありません',english:plural?'are not important':'is not important'},
        {japanese:'大切でした',reading:'たいせつでした',english:plural?'were important':'was important'},
        {japanese:'必要です',reading:'ひつようです',english:plural?'are necessary':'is necessary'},
      ]
      let endingIndex=Math.abs(options.slotSeeds?.ending ?? seed+561)%endings.length
      if (options.avoidWords?.ending && endings[endingIndex]!.japanese===options.avoidWords.ending) {
        endingIndex=(endingIndex+1)%endings.length
      }
      const ending=endings[endingIndex]!
      const furigana=[wordPart(topic,'topic'),literalPart('は','わ'),literalPart(ending.japanese,ending.reading,'ending')]
      const english=`${topicEnglish.charAt(0).toUpperCase()+topicEnglish.slice(1)} ${ending.english}.`
      return finish(furigana,english,{topic},{ending:grammarSlot(`abstract-judgement-${endingIndex}`,ending.japanese,'大切だ',ending.reading,ending.english,['judgement','na-adjective','ending'],'na_adjective')},['Topic is an abstraction, which is what this judgement frame takes.'])
    }

    const subject=pick(humans,562,'subject')
    if (!subject) return null
    const subjectEnglish=englishPhrase(subject,'subject')

    if (patternId==='n4-26') {
      // 〜について話します — the standard N4 frame for "about X".
      const talks=subjectUsesBaseVerb(subjectEnglish)?'talk':'talks'
      const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(topic,'topic'),literalPart('について'),literalPart('話します','はなします','verb')]
      return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${talks} about ${topicEnglish}.`,{subject,topic},{verb:grammarSlot('verb-hanasu-nitsuite','話します','話す','はなします','talk',['communication','nitsuite'])},['について takes a topic of discussion, not a physical object.'])
    }
    // n4-28: 〜を説明します — explaining an abstraction.
    const explains=subjectUsesBaseVerb(subjectEnglish)?'explain':'explains'
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(topic,'topic'),literalPart('を'),literalPart('説明します','せつめいします','verb')]
    return finish(furigana,`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${explains} ${topicEnglish}.`,{subject,topic},{verb:grammarSlot('verb-setsumei','説明します','説明する','せつめいします','explain',['communication','transitive'])},['説明する takes an idea or situation as its object.'])
  }
  if (patternId==='n4-29') {
    // Subject は Adjective です — a plain description of a person. な- and
    // い-adjectives take different negative and past forms, so the ending is
    // built from the entry rather than shared.
    const subject=pick(humans,571,'subject')
    if (!subject) return null
    const adjectiveIndex=Math.abs(seed+572)%personAdjectives.length
    const adjective=personAdjectives[adjectiveIndex]!
    const forms=adjective.na
      ? [
        {japanese:`${adjective.japanese}です`,reading:`${adjective.reading}です`,english:'is'},
        {japanese:`${adjective.japanese}ではありません`,reading:`${adjective.reading}ではありません`,english:'is not'},
        {japanese:`${adjective.japanese}でした`,reading:`${adjective.reading}でした`,english:'was'},
      ]
      : [
        {japanese:`${adjective.japanese}です`,reading:`${adjective.reading}です`,english:'is'},
        {japanese:`${adjective.japanese.slice(0,-1)}くないです`,reading:`${adjective.reading.slice(0,-1)}くないです`,english:'is not'},
        {japanese:`${adjective.japanese.slice(0,-1)}かったです`,reading:`${adjective.reading.slice(0,-1)}かったです`,english:'was'},
      ]
    let endingIndex=Math.abs(options.slotSeeds?.ending ?? seed+573)%forms.length
    if (options.avoidWords?.ending && forms[endingIndex]!.japanese===options.avoidWords.ending) {
      endingIndex=(endingIndex+1)%forms.length
    }
    const form=forms[endingIndex]!
    const subjectEnglish=englishPhrase(subject,'subject')
    // "I am", "you are", "a doctor is" — the copula has to agree with whichever
    // subject the pool produced.
    const copulaPresent=subjectEnglish==='I'?'am':subjectUsesBaseVerb(subjectEnglish)?'are':'is'
    const copulaPast=subjectUsesBaseVerb(subjectEnglish)&&subjectEnglish!=='I'?'were':'was'
    const copula=form.english==='was'?copulaPast:form.english==='is not'?`${copulaPresent} not`:copulaPresent
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart(form.japanese,form.reading,'ending')]
    const english=`${subjectEnglish.charAt(0).toUpperCase()+subjectEnglish.slice(1)} ${copula} ${adjective.english}.`
    return finish(furigana,english,{subject},{ending:grammarSlot(`person-adjective-${adjectiveIndex}-${endingIndex}`,form.japanese,adjective.japanese,form.reading,adjective.english,['description',adjective.na?'na-adjective':'i-adjective','ending'],adjective.na?'na_adjective':'i_adjective')},['Adjective describes a person, which is what this frame takes.'])
  }
  if (patternId==='n4-30') {
    // Topic は [Degree] Adjective です — a judgement about an idea, optionally
    // graded. This is the frame the degree words need: they modify an
    // adjective, so a pattern without one has nothing for them to attach to.
    const topic=pick(abstractTopicPool(vocabulary),seed+580,'topic')
    if (!topic) return null
    const adjective=abstractJudgementAdjectives[Math.abs(seed+581)%abstractJudgementAdjectives.length]!
    const stem=`${adjective.japanese}${adjective.suffix ?? ''}`
    const forms=adjective.na
      ? [
        {japanese:`${stem}です`,reading:`${adjective.reading}です`,english:'is'},
        {japanese:`${stem}ではありません`,reading:`${adjective.reading}ではありません`,english:'is not'},
        {japanese:`${stem}でした`,reading:`${adjective.reading}でした`,english:'was'},
      ]
      : [
        {japanese:`${stem}です`,reading:`${adjective.reading}です`,english:'is'},
        {japanese:`${stem.slice(0,-1)}くないです`,reading:`${adjective.reading.slice(0,-1)}くないです`,english:'is not'},
        {japanese:`${stem.slice(0,-1)}かったです`,reading:`${adjective.reading.slice(0,-1)}かったです`,english:'was'},
      ]
    let endingIndex=Math.abs(options.slotSeeds?.ending ?? seed+582)%forms.length
    if (options.avoidWords?.ending && forms[endingIndex]!.japanese===options.avoidWords.ending) {
      endingIndex=(endingIndex+1)%forms.length
    }
    const form=forms[endingIndex]!
    // Grade only some of the time, so the pattern still teaches the plain
    // predicate, and never on the variety adjectives.
    // Never on a negative: the adverb scopes over the whole predicate there, so
    // わずかに客観的ではありません glosses as "is not slightly objective", which
    // says something quite different from the Japanese.
    const degree=adjective.noDegree||form.english==='is not'||Math.abs(seed+583)%3===0
      ? null
      : degreeAdverbs[Math.abs(seed+584)%degreeAdverbs.length]!
    const topicEnglish=abstractTopicEnglish(primaryEnglishGloss(topic.preferredTranslation||topic.english))
    const plural=isPluralPhrase(topicEnglish)
    const copula=form.english==='was'?(plural?'were':'was'):form.english==='is not'?(plural?'are not':'is not'):(plural?'are':'is')
    const furigana=[
      wordPart(topic,'topic'),literalPart('は','わ'),
      ...(degree?[literalPart(degree.japanese,degree.reading,'adverb')]:[]),
      literalPart(form.japanese,form.reading,'ending'),
    ]
    const english=`${topicEnglish.charAt(0).toUpperCase()+topicEnglish.slice(1)} ${copula} ${degree?`${degree.english} `:''}${adjective.english}.`
    const extra: GeneratedPreviewSentence['slots']={ending:grammarSlot(`abstract-adjective-${adjective.japanese}-${endingIndex}`,form.japanese,stem,form.reading,adjective.english,['judgement',adjective.na?'na-adjective':'i-adjective','ending'],adjective.na?'na_adjective':'i_adjective')}
    if (degree) extra.adverb=grammarSlot(`degree-${degree.japanese}`,degree.japanese,degree.japanese,degree.reading,degree.english,['degree','adverb'],'na_adjective')
    return finish(furigana,english,{topic},extra,['Degree adverbs modify the adjective, not the verb.'])
  }
  if (patternId==='n4-31') {
    // A は B と 同じです — the comparison words need a second thing to relate to,
    // and the pair has to be one worth comparing, so both come from the curated
    // concept pairs rather than from the topic pool at large.
    const byJapanese=new Map(vocabulary.map(word=>[word.japanese,word]))
    const available=conceptPairs.filter(pair=>byJapanese.has(pair.first)&&byJapanese.has(pair.second))
    if (!available.length) return null
    const pair=available[Math.abs(seed+587)%available.length]!
    const first=byJapanese.get(pair.first)!,second=byJapanese.get(pair.second)!
    const comparison=comparisonAdjectives.find(entry=>entry.japanese===pair.comparison)!
    const endings=[
      {japanese:`${comparison.japanese}です`,reading:`${comparison.reading}です`,english:'is'},
      {japanese:`${comparison.japanese}ではありません`,reading:`${comparison.reading}ではありません`,english:'is not'},
    ]
    let endingIndex=Math.abs(options.slotSeeds?.ending ?? seed+588)%endings.length
    if (options.avoidWords?.ending && endings[endingIndex]!.japanese===options.avoidWords.ending) {
      endingIndex=(endingIndex+1)%endings.length
    }
    const ending=endings[endingIndex]!
    const firstEnglish=abstractTopicEnglish(primaryEnglishGloss(first.preferredTranslation||first.english))
    const secondEnglish=abstractTopicEnglish(primaryEnglishGloss(second.preferredTranslation||second.english))
    const copula=(isPluralPhrase(firstEnglish)?'are':'is')+(endingIndex===1?' not':'')
    const furigana=[wordPart(first,'topic'),literalPart('は','わ'),wordPart(second,'comparison'),literalPart('と'),literalPart(ending.japanese,ending.reading,'ending')]
    const english=`${firstEnglish.charAt(0).toUpperCase()+firstEnglish.slice(1)} ${copula} ${comparison.english} ${secondEnglish}.`
    return finish(furigana,english,{topic:first,comparison:second},{ending:grammarSlot(`comparison-${comparison.japanese}-${endingIndex}`,ending.japanese,comparison.japanese,ending.reading,comparison.english,['comparison','na-adjective','ending'],'na_adjective')},['Both nouns come from a curated pair, so the comparison is meaningful.'])
  }
  return null
}

const n3PatternIds = new Set(Array.from({length:10},(_,index)=>`n3-${String(index+1).padStart(2,'0')}`))
const n3PatternMeanings: Record<string,string> = {
  'n3-01':'make an effort or habit','n3-02':'decide to do','n3-03':'change in ability or habit','n3-04':'completion or regret','n3-05':'do in preparation',
  'n3-06':'conditional if','n3-07':'conditional when or if','n3-08':'although or despite','n3-09':'because or since','n3-10':'in order to',
}

function generateN3CategorySentence(seed: number,patternId: string,options: CategorySentenceOptions={}): GeneratedPreviewSentence | null {
  if (!n3PatternIds.has(patternId)) return null
  const vocabulary=generatorWords()
  const humans=validHumanPool(vocabulary)
  const places=validPlacePool(vocabulary)
  const pick=requiredWordPicker(seed,options.requiredWord,options)
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
    const subject=pick(firstPerson.length?firstPerson:humans,601,'subject')
    if (!subject) return null
    const subjectEnglish=englishPhrase(subject,'subject'),make=subjectUsesBaseVerb(subjectEnglish)?'make':'makes'
    const habits: Array<{furigana: GeneratedPreviewSentence['furigana'];filled: Record<string,WordRecord>;extra: GeneratedPreviewSentence['slots'];english: string;rule: string}>=[]
    const readingObject=pick(readable.filter(word=>word.japanese!=='辞書'),602,'object')
    if (readingObject) habits.push({
      furigana:[wordPart(subject,'subject'),literalPart('は','わ'),literalPart('毎日','まいにち','time'),wordPart(readingObject,'object'),literalPart('を'),literalPart('読むようにします','よむようにします','verb')],
      filled:{subject,object:readingObject},extra:{time:grammarSlot('time-mainichi','毎日','毎日','まいにち','every day',['frequency','daily'],'noun'),verb:grammarSlot('verb-yomu-younisuru','読むようにします','読む','よむようにします','make a point of reading',['habit','youni-suru'])},
      english:`${capitalize(subjectEnglish)} ${make} a point of reading ${englishPhrase(readingObject,'object')} every day.`,rule:'Readable objects are paired with 読む.',
    })
    const language=pick(languages,603,'object')
    if (language) habits.push({
      furigana:[wordPart(subject,'subject'),literalPart('は','わ'),literalPart('毎日','まいにち','time'),wordPart(language,'object'),literalPart('を'),literalPart('勉強するようにします','べんきょうするようにします','verb')],
      filled:{subject,object:language},extra:{time:grammarSlot('time-mainichi-study','毎日','毎日','まいにち','every day',['frequency','daily'],'noun'),verb:grammarSlot('verb-benkyou-younisuru','勉強するようにします','勉強する','べんきょうするようにします','make a point of studying',['habit','learning','youni-suru'])},
      english:`${capitalize(subjectEnglish)} ${make} a point of studying ${{日本語:'Japanese',英語:'English',中国語:'Chinese',外国語:'a foreign language'}[language.japanese]??primaryEnglishGloss(language.preferredTranslation||language.english)} every day.`,rule:'Language vocabulary is paired with studying.',
    })
    const habit=pick(habits,604)
    return habit?finish(habit.furigana,habit.english,habit.filled,habit.extra,[habit.rule,'ようにする expresses a deliberate habit or effort.']):null
  }

  if (patternId==='n3-02') {
    const subject=pick(firstPerson.length?firstPerson:humans,611,'subject')
    const destinationPool=places.filter(word=>['日本','東京','大阪','学校','大学','図書館','公園','駅','病院'].includes(word.japanese))
    const destination=pick(destinationPool,612,'destination')
    if (!subject||!destination) return null
    const subjectEnglish=englishPhrase(subject,'subject'),have=subjectUsesBaseVerb(subjectEnglish)?'have':'has'
    const destinationEnglish={学校:'school',大学:'university'}[destination.japanese]??englishPhrase(destination,'destination')
    const movement=destination.japanese==='家'?'go home':`go to ${destinationEnglish}`
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(destination,'destination'),literalPart('へ','え'),literalPart('行くことにします','いくことにします','verb')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${have} decided to ${movement}.`,{subject,destination},{verb:grammarSlot('verb-iku-kotonisuru','行くことにします','行く','いくことにします','decide to go',['decision','movement','kotoni-suru'])},['Destination is valid for 行く.','ことにする expresses the subject’s decision.'])
  }

  if (patternId==='n3-03') {
    const learnerSubjects=exact(['私','学生','生徒','子供','少年','少女','男の子','女の子']).filter(word=>word.categories.includes('Person'))
    const subject=pick(learnerSubjects.length?learnerSubjects:humans,621,'subject'),object=pick(readable.filter(word=>word.japanese!=='辞書'),622,'object')
    if (!subject||!object) return null
    const subjectEnglish=englishPhrase(subject,'subject'),becomes=subjectUsesBaseVerb(subjectEnglish)?'become':'becomes'
    const abilityObjectEnglish={漢字:'kanji',本:'books',記事:'articles',新聞:'newspapers',小説:'novels',辞書:'dictionaries'}[object.japanese]??primaryEnglishGloss(object.preferredTranslation||object.english)
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('が'),literalPart('読めるようになります','よめるようになります','verb')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${becomes} able to read ${abilityObjectEnglish}.`,{subject,object},{verb:grammarSlot('verb-yomeru-youninaru','読めるようになります','読める','よめるようになります','become able to read',['ability-change','potential','youni-naru'])},['Object is readable.','Ability statements use a general class of readable things, not one specific item.','Uses the correct potential form 読める before ようになる.'])
  }

  if (patternId==='n3-04') {
    const subject=pick(firstPerson.length?firstPerson:humans,631,'subject')
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
    const subject=pick(firstPerson.length?firstPerson:humans,641,'subject')
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
    const rain=pick(exact(['雨']),651,'weather'),park=pick(exact(['公園']),652,'destination')
    if (rain&&park) variants.push({furigana:[wordPart(rain,'weather'),literalPart('が'),literalPart('降れば','ふれば','condition'),wordPart(park,'destination'),literalPart('へ','え'),literalPart('行きません','いきません','result')],filled:{weather:rain,destination:park},english:'If it rains, I will not go to the park.',condition:'雨が降れば',conditionReading:'あめがふれば',result:'公園へ行きません',resultReading:'こうえんへいきません',rule:'Rain logically changes the outdoor plan.'})
    const time=pick(exact(['時間']),653,'time'),readingObject=pick(exact(['本','新聞','小説','記事']),654,'object')
    if (time&&readingObject) variants.push({furigana:[wordPart(time,'time'),literalPart('が'),literalPart('あれば','あれば','condition'),wordPart(readingObject,'object'),literalPart('を'),literalPart('読みます','よみます','result')],filled:{time,object:readingObject},english:`If I have time, I will read ${englishPhrase(readingObject,'object')}.`,condition:'時間があれば',conditionReading:'じかんがあれば',result:`${readingObject.japanese}を読みます`,resultReading:`${kanaReading(readingObject.reading,readingObject.japanese)}をよみます`,rule:'The result is an activity that requires available time.'})
    const variant=pick(variants,655)
    if (!variant) return null
    return finish(variant.furigana,variant.english,variant.filled,{condition:grammarSlot('condition-ba',variant.condition,variant.condition,variant.conditionReading,'if condition',['conditional','ba-form'],'noun'),result:grammarSlot('result-ba',variant.result,variant.result,variant.resultReading,'result',['logical-result'],'noun')},[variant.rule,'Uses a valid ば-form condition.'])
  }

  if (patternId==='n3-07') {
    type TaraConditional={furigana: GeneratedPreviewSentence['furigana'];filled: Record<string,WordRecord>;english: string;condition: string;conditionReading: string;result: string;resultReading: string;rule: string}
    const variants: TaraConditional[]=[]
    const time=pick(exact(['時間']),661,'time'),readingObject=pick(exact(['本','新聞','小説','記事']),662,'object')
    if (time&&readingObject) variants.push({furigana:[wordPart(time,'time'),literalPart('が'),literalPart('あったら','あったら','condition'),wordPart(readingObject,'object'),literalPart('を'),literalPart('読みます','よみます','result')],filled:{time,object:readingObject},english:`If I have time, I will read ${englishPhrase(readingObject,'object')}.`,condition:'時間があったら',conditionReading:'じかんがあったら',result:`${readingObject.japanese}を読みます`,resultReading:`${kanaReading(readingObject.reading,readingObject.japanese)}をよみます`,rule:'The result depends on having enough time.'})
    const rain=pick(exact(['雨']),663,'weather'),umbrella=pick(exact(['傘']),664,'object')
    if (rain&&umbrella) variants.push({furigana:[wordPart(rain,'weather'),literalPart('が'),literalPart('降ったら','ふったら','condition'),wordPart(umbrella,'object'),literalPart('を'),literalPart('使います','つかいます','result')],filled:{weather:rain,object:umbrella},english:'If it rains, I will use an umbrella.',condition:'雨が降ったら',conditionReading:'あめがふったら',result:'傘を使います',resultReading:'かさをつかいます',rule:'An umbrella is appropriate when it rains.'})
    const variant=pick(variants,665)
    if (!variant) return null
    return finish(variant.furigana,variant.english,variant.filled,{condition:grammarSlot('condition-tara',variant.condition,variant.condition,variant.conditionReading,'if or when condition',['conditional','tara-form'],'noun'),result:grammarSlot('result-tara',variant.result,variant.result,variant.resultReading,'result',['logical-result'],'noun')},[variant.rule,'Uses a valid たら-form condition.'])
  }

  if (patternId==='n3-08') {
    type Contrast={furigana: GeneratedPreviewSentence['furigana'];filled: Record<string,WordRecord>;english: string;clause: string;clauseReading: string;result: string;resultReading: string;rule: string}
    const variants: Contrast[]=[]
    const studyObject=pick(exact(['漢字','単語']),671,'object')
    if (studyObject) variants.push({furigana:[wordPart(studyObject,'object'),literalPart('を'),literalPart('勉強した','べんきょうした','clause'),literalPart('のに'),literalPart('忘れました','わすれました','result')],filled:{object:studyObject},english:`Although I studied ${{漢字:'kanji',単語:'the words'}[studyObject.japanese]??primaryEnglishGloss(studyObject.preferredTranslation||studyObject.english)}, I forgot them.`,clause:`${studyObject.japanese}を勉強した`,clauseReading:`${kanaReading(studyObject.reading,studyObject.japanese)}をべんきょうした`,result:'忘れました',resultReading:'わすれました',rule:'Forgetting contrasts naturally with having studied.'})
    const umbrella=pick(exact(['傘']),672,'object'),rain=pick(exact(['雨']),673,'weather')
    if (umbrella&&rain) variants.push({furigana:[wordPart(umbrella,'object'),literalPart('を'),literalPart('持って行った','もっていった','clause'),literalPart('のに'),wordPart(rain,'weather'),literalPart('が'),literalPart('降りませんでした','ふりませんでした','result')],filled:{object:umbrella,weather:rain},english:'Although I took an umbrella, it did not rain.',clause:'傘を持って行った',clauseReading:'かさをもっていった',result:'雨が降りませんでした',resultReading:'あめがふりませんでした',rule:'The unused precaution creates a natural contrast.'})
    const variant=pick(variants,674)
    if (!variant) return null
    return finish(variant.furigana,variant.english,variant.filled,{clause:grammarSlot('clause-noni',variant.clause,variant.clause,variant.clauseReading,'although clause',['contrast','noni'],'noun'),result:grammarSlot('result-noni',variant.result,variant.result,variant.resultReading,'unexpected result',['unexpected-result'],'noun')},[variant.rule,'The result genuinely contrasts with the first clause.'])
  }

  if (patternId==='n3-09') {
    type Reason={furigana: GeneratedPreviewSentence['furigana'];filled: Record<string,WordRecord>;english: string;clause: string;clauseReading: string;result: string;resultReading: string;rule: string}
    const variants: Reason[]=[]
    const rain=pick(exact(['雨']),681,'weather'),home=pick(exact(['家']),682,'location')
    if (rain&&home) variants.push({furigana:[wordPart(rain,'weather'),literalPart('が'),literalPart('降っている','ふっている','reason'),literalPart('ので'),wordPart(home,'location'),literalPart('に'),literalPart('います','います','result')],filled:{weather:rain,location:home},english:'Because it is raining, I stay home.',clause:'雨が降っている',clauseReading:'あめがふっている',result:'家にいます',resultReading:'いえにいます',rule:'Staying home is a reasonable result of rain.'})
    const illness=pick(exact(['病気']),683,'state'),hospital=pick(exact(['病院']),684,'destination')
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
  { id:'hitsuyou', japanese:'必要', reading:'ひつよう', english:'necessity' },
  { id:'saigo', japanese:'最後', reading:'さいご', english:'the end' },
  { id:'saisho', japanese:'最初', reading:'さいしょ', english:'the beginning' },
  { id:'naiyou', japanese:'内容', reading:'ないよう', english:'content' },
  { id:'tochuu', japanese:'途中', reading:'とちゅう', english:'the way there' },
  { id:'mawari', japanese:'周り', reading:'まわり', english:'the surroundings' },
  { id:'chuushin', japanese:'中心', reading:'ちゅうしん', english:'the center' },
  { id:'eikyou', japanese:'影響', reading:'えいきょう', english:'influence' },
  { id:'kouka', japanese:'効果', reading:'こうか', english:'effect' },
  { id:'renraku', japanese:'連絡', reading:'れんらく', english:'contact' },
  { id:'yakusoku', japanese:'約束', reading:'やくそく', english:'promise' },
  { id:'kanousei', japanese:'可能性', reading:'かのうせい', english:'possibility' },
  { id:'shuukan', japanese:'習慣', reading:'しゅうかん', english:'habit' },
  { id:'bunka', japanese:'文化', reading:'ぶんか', english:'culture' },
  { id:'shakai', japanese:'社会', reading:'しゃかい', english:'society' },
  { id:'sekai', japanese:'世界', reading:'せかい', english:'the world' },
  { id:'shizen', japanese:'自然', reading:'しぜん', english:'nature' },
  { id:'kankyou', japanese:'環境', reading:'かんきょう', english:'environment' },
  { id:'mirai', japanese:'未来', reading:'みらい', english:'the future' },
  { id:'kako', japanese:'過去', reading:'かこ', english:'the past' },
  { id:'rekishi', japanese:'歴史', reading:'れきし', english:'history' },
  { id:'kyouiku', japanese:'教育', reading:'きょういく', english:'education' },
  { id:'keizai', japanese:'経済', reading:'けいざい', english:'the economy' },
  { id:'seiji', japanese:'政治', reading:'せいじ', english:'politics' },
  { id:'houritsu', japanese:'法律', reading:'ほうりつ', english:'the law' },
  { id:'kiken-noun', japanese:'危険', reading:'きけん', english:'danger' },
  { id:'jiko', japanese:'事故', reading:'じこ', english:'accident' },
  { id:'sensou', japanese:'戦争', reading:'せんそう', english:'war' },
  { id:'heiwa', japanese:'平和', reading:'へいわ', english:'peace' },
  { id:'jinkou', japanese:'人口', reading:'じんこう', english:'population' },
  { id:'chiiki', japanese:'地域', reading:'ちいき', english:'the region' },
  { id:'seikatsu', japanese:'生活', reading:'せいかつ', english:'daily life' },
  { id:'ryokou', japanese:'旅行', reading:'りょこう', english:'travel' },
  { id:'kankou', japanese:'観光', reading:'かんこう', english:'sightseeing' },
  { id:'yoyaku', japanese:'予約', reading:'よやく', english:'reservation' },
  { id:'annai', japanese:'案内', reading:'あんない', english:'guidance' },
  { id:'ryoukin', japanese:'料金', reading:'りょうきん', english:'fee' },
  { id:'hiyou', japanese:'費用', reading:'ひよう', english:'cost' },
  { id:'shouhin', japanese:'商品', reading:'しょうひん', english:'product' },
  { id:'zairyou', japanese:'材料', reading:'ざいりょう', english:'material' },
  { id:'kikai-machine', japanese:'機械', reading:'きかい', english:'machine' },
  { id:'setsubi', japanese:'設備', reading:'せつび', english:'equipment' },
  { id:'gijutsu', japanese:'技術', reading:'ぎじゅつ', english:'technology' },
  { id:'nouryoku', japanese:'能力', reading:'のうりょく', english:'ability' },
  { id:'sonzai', japanese:'存在', reading:'そんざい', english:'existence' },
  { id:'jouken', japanese:'条件', reading:'じょうけん', english:'condition' },
  { id:'tokuchou', japanese:'特徴', reading:'とくちょう', english:'characteristic' },
  { id:'houkou', japanese:'方向', reading:'ほうこう', english:'direction' },
  { id:'kijun', japanese:'基準', reading:'きじゅん', english:'standard' },
  { id:'kihon', japanese:'基本', reading:'きほん', english:'the basics' },
  { id:'zentai', japanese:'全体', reading:'ぜんたい', english:'the whole' },
  { id:'shurui', japanese:'種類', reading:'しゅるい', english:'type' },
  { id:'heikin', japanese:'平均', reading:'へいきん', english:'average' },
  { id:'teido', japanese:'程度', reading:'ていど', english:'degree' },
  { id:'yakuwari', japanese:'役割', reading:'やくわり', english:'role' },
  { id:'kyouryoku', japanese:'協力', reading:'きょうりょく', english:'cooperation' },
  { id:'ninki', japanese:'人気', reading:'にんき', english:'popularity' },
  { id:'miryoku', japanese:'魅力', reading:'みりょく', english:'charm' },
  { id:'yousu', japanese:'様子', reading:'ようす', english:'the appearance' },
  { id:'taido', japanese:'態度', reading:'たいど', english:'attitude' },
  { id:'koudou', japanese:'行動', reading:'こうどう', english:'behavior' },
  { id:'katsudou', japanese:'活動', reading:'かつどう', english:'activity' },
  { id:'kaizen', japanese:'改善', reading:'かいぜん', english:'improvement' },
  { id:'kufuu', japanese:'工夫', reading:'くふう', english:'ingenuity' },
  { id:'chousen', japanese:'挑戦', reading:'ちょうせん', english:'a challenge' },
  { id:'kyousou', japanese:'競争', reading:'きょうそう', english:'competition' },
  { id:'shouri', japanese:'勝利', reading:'しょうり', english:'victory' },
  { id:'haiboku', japanese:'敗北', reading:'はいぼく', english:'defeat' },
  { id:'genjitsu', japanese:'現実', reading:'げんじつ', english:'reality' },
  { id:'shinjitsu', japanese:'真実', reading:'しんじつ', english:'the truth' },
  { id:'uso', japanese:'嘘', reading:'うそ', english:'a lie' },
  { id:'joudan', japanese:'冗談', reading:'じょうだん', english:'a joke' },
  { id:'himitsu', japanese:'秘密', reading:'ひみつ', english:'a secret' },
  { id:'uwasa', japanese:'噂', reading:'うわさ', english:'a rumor' },
  { id:'shouko', japanese:'証拠', reading:'しょうこ', english:'evidence' },
  { id:'kouhei', japanese:'公平', reading:'こうへい', english:'fairness' },
  { id:'byoudou', japanese:'平等', reading:'びょうどう', english:'equality' },
  { id:'kojin', japanese:'個人', reading:'こじん', english:'the individual' },
  { id:'shuudan', japanese:'集団', reading:'しゅうだん', english:'the group' },
  { id:'koufuku', japanese:'幸福', reading:'こうふく', english:'happiness' },
  { id:'jishin-confidence', japanese:'自信', reading:'じしん', english:'confidence' },
  { id:'bouken', japanese:'冒険', reading:'ぼうけん', english:'adventure' },
  { id:'shien', japanese:'支援', reading:'しえん', english:'support' },
  { id:'enjo', japanese:'援助', reading:'えんじょ', english:'assistance' },
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
  'n3-32', 'n3-33', 'n3-34', 'n3-35', 'n3-36', 'n3-37', 'n3-38', 'n3-39', 'n3-40', 'n3-41',
  'n2-22', 'n2-23', 'n2-24', 'n2-25', 'n2-26', 'n2-27', 'n2-28', 'n2-29',
  'n2-30', 'n2-31', 'n2-32', 'n2-33', 'n2-34', 'n2-35', 'n2-36', 'n2-37',
])

function advancedPatternLevel(patternId: string): 'N4' | 'N3' | 'N2' | 'N1' {
  if (patternId.startsWith('n1-')) return 'N1'
  if (patternId.startsWith('n2-')) return 'N2'
  if (patternId.startsWith('n3-')) return 'N3'
  return 'N4'
}

function generateAdvancedCategorySentence(seed: number, patternId: string, options: CategorySentenceOptions = {}): GeneratedPreviewSentence | null {
  if (!advancedPatternIds.has(patternId)) return null
  const level = advancedPatternLevel(patternId)
  const vocabulary = generatorWords()
  const humans = validHumanPool(vocabulary)
  // A pick tagged with a slot name can be re-seeded on its own, which is what
  // lets the hero rotator vary one word and hold the rest of the sentence
  // still. Untagged picks always follow the sentence seed.
  const pick = <T>(pool: T[], salt: number, slot?: string) =>
    pool.length ? seededPick(pool, slot ? options.slotSeeds?.[slot] ?? seed : seed, salt) : null
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
    'iku-e','hanasu-companion','nomu-basic','taberu-basic','miru-basic','okiru-time',
    'tsukuru-basic','kaku-basic','asobu-companion','kaeru-destination','arau-basic',
  ].includes(verb.id))
  // 飲む/食べる/見る/作る/書く/洗う are all transitive and read as an incomplete
  // sentence without their object ("cannot afford to watch." / "forced to make.").
  // 起きる is directionally backwards for prevention/compulsion patterns — a reason
  // forces someone to wake up early, it doesn't prevent them from waking at all.
  // Only genuinely bare-usable activity verbs are left for those templates.
  const bareActionVerbPool = smallVerbPool.filter(verb => ['iku-e','hanasu-companion','asobu-companion','kaeru-destination'].includes(verb.id))
  // ざるを得ない forces the action — 遊ぶ (play) is a leisure activity a reason
  // like work/duty prevents, never one it forces, so it's excluded here even
  // though it's a fine bare verb for the "prevented from" direction above.
  const compulsionVerbPool = bareActionVerbPool.filter(verb => verb.id !== 'asobu-companion')

  if (patternId === 'n2-09') {
    type Variant = { furigana: GeneratedPreviewSentence['furigana']; filled: Record<string,WordRecord>; english: string; note: string; extra: GeneratedPreviewSentence['slots'] }
    const variants: Variant[] = []
    const readable = exact(['漢字','本','新聞','小説','記事'])
    const readingTarget = pick(readable, 801)
    const effort = pick([
      { surface:'勉強します', reading:'べんきょうします', english:'study' },
      { surface:'練習します', reading:'れんしゅうします', english:'practice' },
      { surface:'努力します', reading:'どりょくします', english:'make an effort' },
    ], 802)
    if (readingTarget && effort) variants.push({
      furigana:[wordPart(readingTarget,'object'),literalPart('が'),literalPart('読める','よめる','ability'),literalPart('ように、'),literalPart('毎日','まいにち','time'),{text:effort.surface,reading:effort.reading,slot:'verb'}],
      filled:{object:readingTarget},english:`I ${effort.english} every day so that I can read ${englishPhrase(readingTarget,'object')}.`,
      note:'ように pairs a potential verb with the effort that achieves it.',
      extra:{verb:grammarSlot(`n2-09-effort-${effort.english}`,effort.surface,effort.surface,effort.reading,effort.english,['effort'])},
    })
    const prevention = pick([
      { trigger:'忘れ',triggerReading:'わすれ',action:'メモします',actionReading:'めもします',english:['forget','take notes']},
      { trigger:'遅刻し',triggerReading:'ちこくし',action:'早く家を出ます',actionReading:'はやくいえをでます',english:['be late','leave home early']},
      { trigger:'風邪をひか',triggerReading:'かぜをひか',action:'気をつけます',actionReading:'きをつけます',english:['catch a cold','am careful']},
    ], 803)
    if (prevention) variants.push({
      furigana:[{text:prevention.trigger,reading:prevention.triggerReading,slot:'verb'},literalPart('ないように、'),literalPart(prevention.action,prevention.actionReading,'result')],
      filled:{},english:`I ${prevention.english[1]} so that I will not ${prevention.english[0]}.`,
      note:'ように pairs a negative verb with a deliberate preventive action.',
      extra:{verb:grammarSlot(`n2-09-prevention-${prevention.trigger}`,prevention.trigger,prevention.trigger,prevention.triggerReading,prevention.english[0],['prevention'])},
    })
    const variant = pick(variants, 804)
    return variant ? finish(variant.furigana, capitalize(variant.english), variant.filled, variant.extra, variant.note) : null
  }

  if (patternId === 'n1-01') {
    // Rule/promise/work/responsibility/duty are external obligations that
    // plausibly force someone to go somewhere, but "forces me to talk" needs a
    // reason that is itself about communication (testifying, confessing...),
    // which none of these bare nouns supply — so 話す is only paired with
    // reasons that are themselves about speaking.
    const reasonPool = [
      { surface:'ルールなので、', reading:'るーるなので、', english:'Since it is the rule', compatibleVerbIds:['iku-e'] },
      { surface:'規則なので、', reading:'きそくなので、', english:'Since it is a regulation', compatibleVerbIds:['iku-e'] },
      { surface:'約束なので、', reading:'やくそくなので、', english:'Since it is a promise', compatibleVerbIds:['iku-e','kaeru-destination'] },
      { surface:'仕事なので、', reading:'しごとなので、', english:'Since it is work', compatibleVerbIds:['iku-e'] },
      { surface:'責任なので、', reading:'せきにんなので、', english:'Since it is a responsibility', compatibleVerbIds:['iku-e'] },
      { surface:'義務なので、', reading:'ぎむなので、', english:'Since it is a duty', compatibleVerbIds:['iku-e'] },
      { surface:'契約なので、', reading:'けいやくなので、', english:'Since it is a contract', compatibleVerbIds:['iku-e'] },
      { surface:'予定なので、', reading:'よていなので、', english:'Since it is the schedule', compatibleVerbIds:['iku-e','kaeru-destination'] },
      { surface:'命令なので、', reading:'めいれいなので、', english:'Since it is an order', compatibleVerbIds:['iku-e','kaeru-destination'] },
      { surface:'台風なので、', reading:'たいふうなので、', english:'Since there is a typhoon', compatibleVerbIds:['kaeru-destination'] },
      { surface:'緊急事態なので、', reading:'きんきゅうじたいなので、', english:'Since it is an emergency', compatibleVerbIds:['kaeru-destination'] },
      { surface:'証言なので、', reading:'しょうげんなので、', english:'Since it is testimony', compatibleVerbIds:['hanasu-companion'] },
      { surface:'面接なので、', reading:'めんせつなので、', english:'Since it is an interview', compatibleVerbIds:['hanasu-companion'] },
      { surface:'説明が必要なので、', reading:'せつめいがひつようなので、', english:'Since an explanation is needed', compatibleVerbIds:['hanasu-companion'] },
    ]
    let reasonPickPool = reasonPool
    if (options.avoidWords?.reason) {
      const avoided = reasonPickPool.filter(candidate => candidate.surface !== options.avoidWords!.reason)
      if (avoided.length) reasonPickPool = avoided
    }
    const reason = seededPick(reasonPickPool, options.slotSeeds?.reason ?? seed, 813)
    const verb = reason ? pick(compulsionVerbPool.filter(candidate => reason.compatibleVerbIds.includes(candidate.id)), 811) : null
    const subject = pick(humans, 812, 'subject')
    if (!verb || !subject || !reason) return null
    const aStem = n4VerbForms(verb).aStem
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[literalPart(reason.surface,reason.reading,'reason'),wordPart(subject,'subject'),literalPart('は','わ'),{text:aStem.japanese,reading:aStem.reading,slot:'verb'},literalPart('ざるを'),literalPart('得ません。','えません。','modal')]
    return finish(furigana,`${reason.english}, ${subjectEnglish} ${subjectUsesBaseVerb(subjectEnglish)?'have':'has'} no choice but to ${verb.english}.`,{subject},{
      verb:grammarSlot(`verb-${verb.id}-zaruoenai`,`${aStem.japanese}ざるを得ません`,verb.japanese,`${aStem.reading}ざるをえません`,`have no choice but to ${verb.english}`,['obligation','zaru-o-enai']),
      reason:grammarSlot(`reason-${reasonPool.indexOf(reason)}`,reason.surface,reason.surface,reason.reading,reason.english,['reason']),
    },'ざるを得ない follows a reason the subject cannot resist.')
  }

  if (patternId === 'n1-02') {
    const subject = pick([
      { surface:'成功', reading:'せいこう', english:'success' },
      { surface:'合格', reading:'ごうかく', english:'passing the exam' },
      { surface:'勝利', reading:'しょうり', english:'victory' },
      { surface:'発展', reading:'はってん', english:'development' },
      { surface:'成長', reading:'せいちょう', english:'growth' },
    ], 821, 'subject')
    // All causes here must plausibly produce success/passing/victory/growth —
    // 信頼 (trust) is relational, not something success is "the result of".
    const cause = pick([
      { surface:'努力', reading:'どりょく', english:'effort' },
      { surface:'準備', reading:'じゅんび', english:'preparation' },
      { surface:'練習', reading:'れんしゅう', english:'practice' },
      { surface:'経験', reading:'けいけん', english:'experience' },
    ], 822, 'cause')
    const tail = pick([{ surface:'結果', reading:'けっか', english:'result' }, { surface:'成果', reading:'せいか', english:'fruit' }], 823, 'object')
    if (!subject || !cause || !tail) return null
    const furigana=[{text:subject.surface,reading:subject.reading,slot:'subject'},literalPart('は','わ'),{text:cause.surface,reading:cause.reading,slot:'cause'},literalPart('の'),{text:tail.surface,reading:tail.reading,slot:'object'},literalPart('にほかならない。')]
    return finish(furigana,`${capitalize(subject.english)} is nothing other than the ${tail.english} of ${cause.english}.`,{
    },{
      subject:grammarSlot(`n1-02-subject-${subject.surface}`,subject.surface,subject.surface,subject.reading,subject.english,['abstract']),
      cause:grammarSlot(`n1-02-cause-${cause.surface}`,cause.surface,cause.surface,cause.reading,cause.english,['abstract']),
      object:grammarSlot(`n1-02-object-${tail.surface}`,tail.surface,tail.surface,tail.reading,tail.english,['abstract']),
    },'にほかならない equates a result with its single true cause.')
  }

  if (patternId === 'n2-01') {
    type Variant = { furigana: GeneratedPreviewSentence['furigana']; filled: Record<string,WordRecord>; english: string; extra: GeneratedPreviewSentence['slots'] }
    const variants: Variant[] = []
    const dislikable = vocabulary.filter(word => categoryMatch(word,['Food']) && matchingTags(word,edibleTags).length>0)
    const dislikeObject = pick(dislikable, 831)
    if (dislikeObject) variants.push({
      furigana:[wordPart(dislikeObject,'object'),literalPart('が'),literalPart('嫌い','きらい','predicate'),literalPart('な'),literalPart('わけではありません。')],
      filled:{object:dislikeObject},english:`It is not that I dislike ${englishPhrase(dislikeObject,'object')}.`,extra:{},
    })
    // 話す without a listener or topic is incomplete in this standalone pattern.
    const habitVerb = pick(smallVerbPool.filter(verb => verb.id !== 'hanasu-companion'), 832)
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
        extra:{verb:grammarSlot(`verb-${habitVerb.id}-wakedewanai`,`${te.japanese}いるわけではありません`,habitVerb.japanese,`${te.reading}いるわけではありません`,englishPhraseText,['habit','wake-dewa-nai']),time:grammarSlot(`n2-01-frequency-${frequency.id}`,frequency.japanese,frequency.japanese,frequency.reading,frequency.preposed??frequency.postposed!,['frequency'])},
      })
    }
    const variant = pick(variants, 834)
    return variant ? finish(variant.furigana, capitalize(variant.english), variant.filled, variant.extra, 'わけではない softens an assumed generalization.') : null
  }

  if (patternId === 'n2-02') {
    // Bare 約束 and 責任 need context (which appointment? what responsibility?),
    // so do not turn them into a generic reason for an unrelated refusal.
    const reason = pick(exact(['試験','仕事','会議','予定','計画']), 841)
    // 話す needs a topic or listener to make sense as something a reason blocks —
    // "there's a promise, so I can't afford to talk" doesn't say about what or
    // to whom. It only reads naturally when the reason is itself inherently
    // about an exchange or shared attention: an exam's silence, or a meeting
    // that occupies the room you'd otherwise be talking in.
    const declinableReasonToVerbIds: Record<string,string[]> = {
      '試験':['iku-e','hanasu-companion','asobu-companion','kaeru-destination'],
      '仕事':['iku-e','asobu-companion','kaeru-destination'],
      '会議':['iku-e','asobu-companion','kaeru-destination'],
      '予定':['iku-e','asobu-companion','kaeru-destination'],
      '計画':['iku-e','asobu-companion','kaeru-destination'],
    }
    const allowedVerbIds = reason ? declinableReasonToVerbIds[reason.japanese] ?? [] : []
    const declinedVerb = pick(bareActionVerbPool.filter(candidate => allowedVerbIds.includes(candidate.id)), 842)
    if (!reason || !declinedVerb) return null
    const furigana=[wordPart(reason,'reason'),literalPart('が'),literalPart('あるので、'),{text:declinedVerb.japanese,reading:declinedVerb.reading,slot:'verb'},literalPart('わけにはいきません。')]
    return finish(furigana,`There is ${englishPhrase(reason,'object')}, so I cannot afford to ${declinedVerb.english}.`,{reason},{},'わけにはいかない marks an option the situation forbids.')
  }

  if (patternId === 'n3-13') {
    const verb = pick(verbs.filter(candidate=>['kau-basic','tsukuru-basic','kaku-basic','taberu-basic','nomu-basic','yomu-basic','miru-basic'].includes(candidate.id)), 851, 'verb')
    const result = verb ? fillVerbSlots(verb,vocabulary,seed,852,options) : null
    if (!verb || !result) return null
    const ta = n4VerbForms(verb).ta
    const subject=result.filled.subject!,object=result.filled.object!
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('を'),{text:ta.japanese,reading:ta.reading,slot:'verb'},literalPart('ばかりです。')]
    return finish(furigana,`${capitalize(subjectEnglish)} just ${simplePast(verb.english)} ${englishPhrase(object,'object')}.`,{subject,object},{verb:grammarSlot(`verb-${verb.id}-tabakari`,`${ta.japanese}ばかりです`,verb.japanese,`${ta.reading}ばかりです`,`just ${verb.english}`,['just-completed','ta-bakari'])},'たばかり marks an action that finished a moment ago.')
  }

  if (patternId === 'n2-10') {
    const verb = pick(smallVerbPool, 861, 'verb')
    const subject = pick(humans, 862, 'subject')
    const aspect = pick(['about-to','ongoing','just-did'] as const, 863)
    if (!verb || !subject || !aspect) return null
    const forms = n4VerbForms(verb)
    const subjectEnglish = englishPhrase(subject,'subject')
    const wasSupposedTo = subjectEnglish === 'I' ? 'was' : subjectUsesBaseVerb(subjectEnglish) ? 'were' : 'was'
    // ところだ's negative (ところではない) reads as a different idiom ("this is
    // no time for X"), not a clean negation, so only tense toggles here —
    // ところです ⟷ ところでした, narrating the same about-to/mid-way/just-done
    // moment from the present or from the past.
    let endingIndex = options.slotSeeds?.ending !== undefined ? Math.abs(options.slotSeeds.ending) % 2 : 0
    if (aspect === 'about-to') {
      const suffixes=['ところです。','ところでした。']
      const verbPrefix=verb.japanese, verbReading=verb.reading
      const surfaceFor=(index: number)=>`${verbPrefix}${suffixes[index]}`
      if (options.avoidWords?.ending && surfaceFor(endingIndex) === options.avoidWords.ending) endingIndex=(endingIndex+1)%2
      const suffix=suffixes[endingIndex]!
      const surface=surfaceFor(endingIndex),reading=`${verbReading}${suffix}`
      const english = endingIndex === 0
        ? `${capitalize(subjectEnglish)} ${copulaFor(subjectEnglish)} just about to ${verb.english}.`
        : `${capitalize(subjectEnglish)} ${wasSupposedTo} just about to ${verb.english}.`
      const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart('今から','いまから','time'),{text:surface,reading,slot:'verb'}]
      return finish(furigana,english,{subject},{
        verb:grammarSlot(`verb-${verb.id}-tokoro-aboutto-${endingIndex}`,surface,verb.japanese,reading,english,['about-to','tokoro']),
        ending:grammarSlot(`tokoro-ending-${endingIndex}`,suffix,suffix,suffix,english,['ending']),
      },'ところだ with a dictionary-form verb means about to do something.')
    }
    if (aspect === 'ongoing') {
      const suffixes=['いるところです。','いるところでした。']
      const surfaceFor=(index: number)=>`${forms.te.japanese}${suffixes[index]}`
      if (options.avoidWords?.ending && surfaceFor(endingIndex) === options.avoidWords.ending) endingIndex=(endingIndex+1)%2
      const suffix=suffixes[endingIndex]!
      const surface=surfaceFor(endingIndex),reading=`${forms.te.reading}${suffix}`
      const english = endingIndex === 0
        ? `${capitalize(subjectEnglish)} ${copulaFor(subjectEnglish)} in the middle of ${presentParticiple(verb.english)}.`
        : `${capitalize(subjectEnglish)} ${wasSupposedTo} in the middle of ${presentParticiple(verb.english)}.`
      const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart('今','いま','time'),{text:surface,reading,slot:'verb'}]
      return finish(furigana,english,{subject},{
        verb:grammarSlot(`verb-${verb.id}-tokoro-ongoing-${endingIndex}`,surface,verb.japanese,reading,english,['ongoing','tokoro']),
        ending:grammarSlot(`tokoro-ending-${endingIndex}`,suffix,suffix,suffix,english,['ending']),
      },'ところだ with ている means currently in the middle of doing something.')
    }
    const suffixes=['ところです。','ところでした。']
    const surfaceFor=(index: number)=>`${forms.ta.japanese}${suffixes[index]}`
    if (options.avoidWords?.ending && surfaceFor(endingIndex) === options.avoidWords.ending) endingIndex=(endingIndex+1)%2
    const suffix=suffixes[endingIndex]!
    const surface=surfaceFor(endingIndex),reading=`${forms.ta.reading}${suffix}`
    const english = endingIndex === 0
      ? `${capitalize(subjectEnglish)} just ${simplePast(verb.english)}.`
      : `${capitalize(subjectEnglish)} had just ${pastParticiple(verb.english)}.`
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart('今','いま','time'),{text:surface,reading,slot:'verb'}]
    return finish(furigana,english,{subject},{
      verb:grammarSlot(`verb-${verb.id}-tokoro-justdid-${endingIndex}`,surface,verb.japanese,reading,english,['just-did','tokoro']),
      ending:grammarSlot(`tokoro-ending-${endingIndex}`,suffix,suffix,suffix,english,['ending']),
    },'ところだ with a past-form verb means an action just finished.')
  }

  if (patternId === 'n3-11') {
    const scene = pick([
      { activity:'話して', activityReading:'はなして', result:'メモを取ります', resultReading:'めもをとります', companionVerb:['talks','talk'], resultBase:'take notes', resultThird:'takes notes' },
      { activity:'テレビを見て', activityReading:'てれびをみて', result:'家事をします', resultReading:'かじをします', companionVerb:['watches television','watch television'], resultBase:'do housework', resultThird:'does housework' },
      { activity:'寝て', activityReading:'ねて', result:'宿題をします', resultReading:'しゅくだいをします', companionVerb:['sleeps','sleep'], resultBase:'do homework', resultThird:'does homework' },
    ], 873)
    // 家事 (housework) is a household member's job — a guest or customer would
    // not be the one doing it while someone else watches television.
    const subjectPool = scene?.result.includes('家事')
      ? humans.filter(word => ![...tagSet(word)].some(tag=>nonHouseholdSubjectTags.has(tag)))
      : humans
    const subject = pick(subjectPool.length ? subjectPool : humans, 871, 'subject')
    const companion = pick(humans.filter(word => word.id !== subject?.id), 872, 'companion')
    if (!subject || !companion || !scene) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const companionEnglish = englishPhrase(companion,'subject')
    const companionUsesBase = subjectUsesBaseVerb(companionEnglish)
    const resultVerb = subjectEnglish==='I' || subjectUsesBaseVerb(subjectEnglish) ? scene.resultBase : scene.resultThird
    const furigana=[wordPart(companion,'companion'),literalPart('が'),literalPart(scene.activity,scene.activityReading,'reason'),literalPart('いる'),literalPart('間に','あいだに'),wordPart(subject,'subject'),literalPart('は','わ'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,capitalize(`while ${companionEnglish} ${companionUsesBase ? scene.companionVerb[1] : scene.companionVerb[0]}, ${subjectEnglish} ${resultVerb}.`),{subject,companion},{},'間に marks a bounded window during which the main action happens.')
  }

  if (patternId === 'n3-12') {
    // "While still young/healthy" is a life-stage observation about a single
    // person — a specific occupation (店員, 駅員...) has no bearing on it, and
    // a collective noun like 家族/両親 isn't an individual with one life stage
    // ("the family is young" describes how recently it was formed, not youth).
    const genericSubjects = humans.filter(word => !tagSet(word).has('occupation') && !['家族','両親','人々'].includes(word.japanese))
    const subject = pick(genericSubjects.length ? genericSubjects : humans, 881, 'subject')
    const scene = pick([
      { condition:'若い', conditionReading:'わかい', result:'たくさん勉強します', resultReading:'たくさんべんきょうします', english:'young', resultBase:'study a lot', resultThird:'studies a lot' },
      { condition:'元気な', conditionReading:'げんきな', result:'旅行します', resultReading:'りょこうします', english:'healthy', resultBase:'travel', resultThird:'travels' },
    ], 882)
    if (!subject || !scene) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const beVerb = subjectEnglish==='I' ? 'am' : subjectUsesBaseVerb(subjectEnglish) ? 'are' : 'is'
    const secondMention = subjectPronoun(subjectEnglish)
    const resultVerb = subjectUsesBaseVerb(secondMention) ? scene.resultBase : scene.resultThird
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart(scene.condition,scene.conditionReading,'condition'),literalPart('うちに、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,`While ${subjectEnglish} ${beVerb} still ${scene.english}, ${secondMention} ${resultVerb}.`,{subject},{},'うちに marks a window that closes, so the action must happen before it does.')
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
    const subject = pick(humans, 893, 'subject')
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
    // A customer or a lost child becoming generally "skilled" gives neither a
    // natural learner nor a skill. Keep this practice-result frame focused on
    // ordinary learners.
    const subject = pick(humans.filter(word=>['子供','学生','生徒','友人'].includes(word.japanese)), 901, 'subject')
    const scene = pick([
      { cause:'先生', causeReading:'せんせい', causeEnglish:'the teacher', result:'合格しました', resultReading:'ごうかくしました', resultEnglish:'passed' },
      { cause:'努力', causeReading:'どりょく', causeEnglish:'the effort', result:'成功しました', resultReading:'せいこうしました', resultEnglish:'succeeded' },
      { cause:'練習', causeReading:'れんしゅう', causeEnglish:'practice', result:'日本語が上手になりました', resultReading:'にほんごがじょうずになりました', resultEnglish:'became good at Japanese' },
    ], 902)
    if (!subject || !scene) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[literalPart(scene.cause,scene.causeReading,'cause'),literalPart('のおかげで、'),wordPart(subject,'subject'),literalPart('は','わ'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,`Thanks to ${scene.causeEnglish}, ${subjectEnglish} ${scene.resultEnglish}.`,{subject},{},'おかげで credits a cause for a positive result.')
  }

  if (patternId === 'n3-17') {
    const subject = pick(humans, 911, 'subject')
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
    const subject = pick(humans, 921, 'subject')
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
    const subject = pick(humans, 932, 'subject')
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

  if (patternId === 'n2-11' || patternId === 'n2-16') {
    const verb = pick(smallVerbPool, 941, 'verb')
    const subject = pick(humans, 942, 'subject')
    if (!verb || !subject) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    // べきだ/べきではない are the affirmative/negative halves of one grammar
    // point (a recommendation for or against doing something) — n2-16 used
    // to be a hand-duplicated copy of this same pattern that only ever
    // produced the negative half. Folding it in here lets the ending toggle
    // between them the same way the generic verb dispatcher toggles masu/nai,
    // while n2-16 stays as a pattern id (defaulting to the negative half) so
    // nothing that already refers to it by name breaks.
    const bekiVariants = [
      { suffix:'べきです。', english:`${capitalize(subjectEnglish)} should ${verb.english}.`, tags:['obligation','bekida'] },
      { suffix:'べきではありません。', english:`${capitalize(subjectEnglish)} should not ${verb.english}.`, tags:['obligation','bekidewanai'] },
    ]
    let endingIndex = options.slotSeeds?.ending !== undefined
      ? Math.abs(options.slotSeeds.ending) % bekiVariants.length
      : (patternId === 'n2-16' ? 1 : 0)
    const surfaceFor = (index: number) => `${verb.japanese}${bekiVariants[index]!.suffix}`
    if (options.avoidWords?.ending && surfaceFor(endingIndex) === options.avoidWords.ending) {
      endingIndex = (endingIndex + 1) % bekiVariants.length
    }
    const chosen = bekiVariants[endingIndex]!
    const surface = surfaceFor(endingIndex)
    const reading = `${verb.reading}${chosen.suffix}`
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),{text:surface,reading,slot:'verb'}]
    return finish(furigana,chosen.english,{subject},{
      verb:grammarSlot(`verb-${verb.id}-beki-${endingIndex}`,surface,verb.japanese,reading,chosen.english,chosen.tags),
      ending:grammarSlot(`beki-ending-${endingIndex}`,chosen.suffix,chosen.suffix,chosen.suffix,chosen.english,['ending']),
    },'べきだ/べきではない attaches to the dictionary form and expresses a recommendation for or against doing something.')
  }

  if (patternId === 'n1-03') {
    type Variant = { furigana: GeneratedPreviewSentence['furigana']; filled: Record<string,WordRecord>; english: string }
    const variants: Variant[] = []
    const studyObject = pick(exact(['漢字','単語','文法','発音','歴史','数学']), 951)
    if (studyObject) variants.push({
      furigana:[wordPart(studyObject,'object'),literalPart('を'),literalPart('勉強した','べんきょうした','clause'),literalPart('ものの、'),literalPart('忘れました','わすれました','result')],
      filled:{object:studyObject},english:`Although I studied ${englishPhrase(studyObject,'object')}, I forgot ${studyObject.japanese === '漢字' || studyObject.japanese === '単語' ? 'them' : 'it'}.`,
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
    const causePool = [
      { cause:'無理をする', causeReading:'むりをする', english:'overdoing it' },
      { cause:'油断する', causeReading:'ゆだんする', english:'carelessness' },
      { cause:'遅刻する', causeReading:'ちこくする', english:'being late' },
    ]
    const resultPool = [
      { result:'病気になり', resultReading:'びょうきになり', english:'result in illness' },
      { result:'事故になり', resultReading:'じこになり', english:'result in an accident' },
      { result:'信用を失い', resultReading:'しんようをうしない', english:'result in losing trust' },
    ]
    let causePickPool = causePool
    if (options.avoidWords?.reason) { const avoided = causePickPool.filter(c => c.cause !== options.avoidWords!.reason); if (avoided.length) causePickPool = avoided }
    const cause = seededPick(causePickPool, options.slotSeeds?.reason ?? seed, 961)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 962)
    if (!cause || !result) return null
    const furigana=[{text:cause.cause,reading:cause.causeReading,slot:'reason'},literalPart('と、'),{text:result.result,reading:result.resultReading,slot:'result'},literalPart('かねません。')]
    return finish(furigana,`${capitalize(cause.english)} might ${result.english}.`,{},{
      reason:grammarSlot(`n1-04-cause-${causePool.indexOf(cause)}`,cause.cause,cause.cause,cause.causeReading,cause.english,['warning']),
      result:grammarSlot(`n1-04-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['warning']),
    },'かねない attaches to the masu-stem and warns of a possible negative outcome.')
  }

  if (patternId === 'n2-12') {
    const scenePool = [
      { cause:'年を取る', causeReading:'としをとる', result:'体が弱くなります', resultReading:'からだがよわくなります', english:'As you get older, your body weakens.' },
      { cause:'練習する', causeReading:'れんしゅうする', result:'上手になります', resultReading:'じょうずになります', english:'As you practice, you get better.' },
      { cause:'勉強する', causeReading:'べんきょうする', result:'漢字が読めるようになります', resultReading:'かんじがよめるようになります', english:'As you study, you become able to read kanji.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.reason) {
      const avoided = scenePickPool.filter(c => c.cause !== options.avoidWords!.reason)
      if (avoided.length) scenePickPool = avoided
    }
    const scene = seededPick(scenePickPool, options.slotSeeds?.reason ?? seed, 971)
    if (!scene) return null
    const furigana=[{text:scene.cause,reading:scene.causeReading,slot:'reason'},literalPart('につれて、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{reason:grammarSlot(`n2-12-scene-${scenePool.indexOf(scene)}`,scene.cause,scene.cause,scene.causeReading,scene.english,['progression'])},'につれて links two changes that progress together.')
  }

  if (patternId === 'n2-13') {
    const subject = pick(humans, 981, 'subject')
    const readingTarget = pick(vocabulary.filter(word => categoryMatch(word,['Object','Book','Document','Media']) && matchingTags(word,readableTags).length>0), 982)
    if (!subject || !readingTarget) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(readingTarget,'object'),literalPart('さえ'),literalPart('読めません。','よめません。')]
    return finish(furigana,`${capitalize(subjectEnglish)} cannot even read ${englishPhrase(readingTarget,'object')}.`,{subject,object:readingTarget},{},'さえ singles out an extreme example to emphasize a broader claim.')
  }

  if (patternId === 'n2-14') {
    const scene = pick([
      { subject:'この人', subjectReading:'このひと', subjectEnglish:'This person', predicate:'専門家', predicateReading:'せんもんか', predicateEnglish:'the expert' },
      { subject:'この方法', subjectReading:'このほうほう', subjectEnglish:'This method', predicate:'答え', predicateReading:'こたえ', predicateEnglish:'the answer' },
      { subject:'今', subjectReading:'いま', subjectEnglish:'Now', predicate:'大切な時', predicateReading:'たいせつなとき', predicateEnglish:'the important moment' },
    ], 992)
    if (!scene) return null
    // The predicate noun stays fixed to its scene (they are hand-picked pairs,
    // not a real word pool), but です itself is a plain copula and conjugates
    // exactly like any other — です/でした/ではありません/ではありませんでした.
    // "Now, precisely, is/was X" reads fine, but the subject-headed sentences
    // ("This person, precisely, is/was X") need "That" once tense shifts them
    // out of the present, same as English does for any fronted demonstrative.
    const pastSubject = scene.subjectEnglish === 'Now' ? 'That' : scene.subjectEnglish
    const copulaVariants = [
      { suffix:'です。', english:`${scene.subjectEnglish}, precisely, is ${scene.predicateEnglish}.` },
      { suffix:'でした。', english:`${pastSubject}, precisely, was ${scene.predicateEnglish}.` },
      { suffix:'ではありません。', english:`${scene.subjectEnglish}, precisely, is not ${scene.predicateEnglish}.` },
      { suffix:'ではありませんでした。', english:`${pastSubject}, precisely, was not ${scene.predicateEnglish}.` },
    ]
    let endingIndex = options.slotSeeds?.ending !== undefined ? Math.abs(options.slotSeeds.ending) % copulaVariants.length : 0
    const surfaceFor = (index: number) => `${scene.predicate}${copulaVariants[index]!.suffix}`
    if (options.avoidWords?.ending && surfaceFor(endingIndex) === options.avoidWords.ending) {
      endingIndex = (endingIndex + 1) % copulaVariants.length
    }
    const chosen = copulaVariants[endingIndex]!
    const surface = surfaceFor(endingIndex)
    const reading = `${scene.predicateReading}${chosen.suffix}`
    const furigana=[literalPart(scene.subject,scene.subjectReading,'subject'),literalPart('こそ、'),{text:surface,reading,slot:'verb'}]
    return finish(furigana,chosen.english,{},{
      verb:grammarSlot(`n2-14-predicate-${endingIndex}`,surface,scene.predicate,reading,chosen.english,['copula']),
      ending:grammarSlot(`n2-14-ending-${endingIndex}`,chosen.suffix,chosen.suffix,chosen.suffix,chosen.english,['ending']),
    },'こそ emphasizes a contextually singled-out item: this one, not the alternatives.')
  }

  if (patternId === 'n2-15') {
    const languageEnglish: Record<string,string> = { 日本語:'Japanese', 英語:'English', 中国語:'Chinese', 外国語:'a foreign language' }
    const subject = pick(humans, 1001, 'subject')
    const languages = exact(['日本語','英語','中国語','外国語'])
    const first = pick(languages, 1002)
    const second = pick(languages.filter(word => word.id !== first?.id), 1003)
    if (!subject || !first || !second) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(first,'object'),literalPart('ばかりか、'),wordPart(second,'result'),literalPart('も'),literalPart('話せます。','はなせます。')]
    return finish(furigana,`${capitalize(subjectEnglish)} can speak not only ${languageEnglish[first.japanese]} but also ${languageEnglish[second.japanese]}.`,{subject,object:first},{},'ばかりか adds a second, often more surprising, item on top of the first.')
  }

  if (patternId === 'n1-11') {
    // A long-distance trip makes the following need for money, preparation, or
    // time meaningful; ordinary trips to a station or library do not.
    const destination = pick(validPlacePool(vocabulary).filter(word => ['日本','東京','大阪'].includes(word.japanese)), 1011)
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
    const scenePool = [
      { basis:'天気', basisReading:'てんき', result:'予定が変わります', resultReading:'よていがかわります', english:"Plans change according to the weather." },
      { basis:'成績', basisReading:'せいせき', result:'評価が決まります', resultReading:'ひょうかがきまります', english:"Evaluation is decided according to the grades." },
      { basis:'状況', basisReading:'じょうきょう', result:'対応が変わります', resultReading:'たいおうがかわります', english:"The response changes according to the situation." },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.reason) { const avoided = scenePickPool.filter(c => c.basis !== options.avoidWords!.reason); if (avoided.length) scenePickPool = avoided }
    const scene = seededPick(scenePickPool, options.slotSeeds?.reason ?? seed, 1021)
    if (!scene) return null
    const furigana=[{text:scene.basis,reading:scene.basisReading,slot:'reason'},literalPart('に応じて、','におうじて、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{reason:grammarSlot(`n1-12-scene-${scenePool.indexOf(scene)}`,scene.basis,scene.basis,scene.basisReading,scene.english,['basis'])},'に応じて marks a basis that a result varies with.')
  }

  if (patternId === 'n1-13') {
    const scenePool = [
      { clause:'高いものがいい', clauseReading:'たかいものがいい', english:'Expensive things are not necessarily good.' },
      { clause:'有名な店の料理がおいしい', clauseReading:'ゆうめいなみせのりょうりがおいしい', english:'The food at a famous restaurant is not necessarily delicious.' },
      { clause:'頭がいい人が成功する', clauseReading:'あたまがいいひとがせいこうする', english:'Smart people do not necessarily succeed.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.reason) { const avoided = scenePickPool.filter(c => c.clause !== options.avoidWords!.reason); if (avoided.length) scenePickPool = avoided }
    const scene = seededPick(scenePickPool, options.slotSeeds?.reason ?? seed, 1031)
    if (!scene) return null
    const furigana=[{text:scene.clause,reading:scene.clauseReading,slot:'reason'},literalPart('とは','とわ'),literalPart('限りません。','かぎりません。')]
    return finish(furigana,scene.english,{},{reason:grammarSlot(`n1-13-scene-${scenePool.indexOf(scene)}`,scene.clause,scene.clause,scene.clauseReading,scene.english,['generalization'])},'とは限らない denies that a general rule always holds.')
  }

  if (patternId === 'n2-04') {
    const verb = pick(smallVerbPool, 1041, 'verb')
    if (!verb) return null
    const furigana=[{text:verb.japanese,reading:verb.reading,slot:'verb'},literalPart('ことはありません。')]
    return finish(furigana,`There is no need to ${verb.english}.`,{},{verb:grammarSlot(`verb-${verb.id}-kotohanai`,`${verb.japanese}ことはありません`,verb.japanese,`${verb.reading}ことはありません`,`no need to ${verb.english}`,['no-need','koto-ha-nai'])},'ことはない attaches to the dictionary form and reassures that something is unnecessary.')
  }

  if (patternId === 'n1-05') {
    const causePool = [
      { cause:'参加しない', causeReading:'さんかしない', english:'you participate' },
      { cause:'試してみない', causeReading:'ためしてみない', english:'you try it' },
      { cause:'練習しない', causeReading:'れんしゅうしない', english:'you practice' },
    ]
    const resultPool = [
      { result:'始まりません', resultReading:'はじまりません', english:'it will not start' },
      { result:'わかりません', resultReading:'わかりません', english:'you will not know' },
      { result:'上手になりません', resultReading:'じょうずになりません', english:'you will not improve' },
    ]
    let causePickPool = causePool
    if (options.avoidWords?.reason) { const avoided = causePickPool.filter(c => c.cause !== options.avoidWords!.reason); if (avoided.length) causePickPool = avoided }
    const cause = seededPick(causePickPool, options.slotSeeds?.reason ?? seed, 1051)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1052)
    if (!cause || !result) return null
    const furigana=[{text:cause.cause,reading:cause.causeReading,slot:'reason'},literalPart('ことには、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,`Unless ${cause.english}, ${result.english}.`,{},{
      reason:grammarSlot(`n1-05-cause-${causePool.indexOf(cause)}`,cause.cause,cause.cause,cause.causeReading,cause.english,['precondition']),
      result:grammarSlot(`n1-05-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['precondition']),
    },'ないことには states that nothing else can happen until this precondition is met.')
  }

  if (patternId === 'n1-06') {
    const scenePool = [
      { start:'子供', startReading:'こども', end:'大人', endReading:'おとな', result:'みんながその規則を知っています', resultReading:'みんながそのきそくをしっています', english:'From children to adults, everyone knows the rule.' },
      { start:'朝', startReading:'あさ', end:'夜', endReading:'よる', result:'休みなく働きます', resultReading:'やすみなくはたらきます', english:'From morning to night, they work without rest.' },
      { start:'初心者', startReading:'しょしんしゃ', end:'上級者', endReading:'じょうきゅうしゃ', result:'誰でも日本語の勉強を楽しめます', resultReading:'だれでもにほんごのべんきょうをたのしめます', english:'From beginners to advanced learners, anyone can enjoy studying Japanese.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.reason) { const avoided = scenePickPool.filter(c => c.start !== options.avoidWords!.reason); if (avoided.length) scenePickPool = avoided }
    const scene = seededPick(scenePickPool, options.slotSeeds?.reason ?? seed, 1061)
    if (!scene) return null
    const furigana=[{text:scene.start,reading:scene.startReading,slot:'reason'},literalPart('から'),literalPart(scene.end,scene.endReading,'object'),literalPart('に至るまで、','にいたるまで、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{reason:grammarSlot(`n1-06-scene-${scenePool.indexOf(scene)}`,scene.start,scene.start,scene.startReading,scene.english,['range'])},'に至るまで stretches a range out to an extreme endpoint.')
  }

  if (patternId === 'n1-07') {
    const scenePool = [
      { place:'日本', placeReading:'にほん', noun:'文化', nounReading:'ぶんか', english:'culture unique to Japan' },
      { place:'京都', placeReading:'きょうと', noun:'魅力', nounReading:'みりょく', english:'charm unique to Kyoto' },
      { place:'この店', placeReading:'このみせ', noun:'味', nounReading:'あじ', english:'a flavor unique to this restaurant' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.subject) { const avoided = scenePickPool.filter(c => c.place !== options.avoidWords!.subject); if (avoided.length) scenePickPool = avoided }
    const scene = seededPick(scenePickPool, options.slotSeeds?.subject ?? seed, 1071)
    if (!scene) return null
    const furigana=[{text:scene.place,reading:scene.placeReading,slot:'subject'},literalPart('ならではの'),literalPart(scene.noun,scene.nounReading,'object'),literalPart('です。')]
    return finish(furigana,capitalize(`this is ${scene.english}.`),{},{subject:grammarSlot(`n1-07-scene-${scenePool.indexOf(scene)}`,scene.place,scene.place,scene.placeReading,scene.english,['uniqueness'])},'ならでは marks something only possible because of that specific place or thing.')
  }

  if (patternId === 'n1-08') {
    const basisPool = [
      { basis:'現実', basisReading:'げんじつ', english:'reality' },
      { basis:'事実', basisReading:'じじつ', english:'the facts' },
      { basis:'規則', basisReading:'きそく', english:'the rules' },
    ]
    const resultPool = [
      { result:'考えます', resultReading:'かんがえます', english:'think' },
      { result:'判断します', resultReading:'はんだんします', english:'judge' },
      { result:'行動します', resultReading:'こうどうします', english:'act' },
    ]
    let basisPickPool = basisPool
    if (options.avoidWords?.reason) { const avoided = basisPickPool.filter(c => c.basis !== options.avoidWords!.reason); if (avoided.length) basisPickPool = avoided }
    const basis = seededPick(basisPickPool, options.slotSeeds?.reason ?? seed, 1081)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1082)
    if (!basis || !result) return null
    const furigana=[{text:basis.basis,reading:basis.basisReading,slot:'reason'},literalPart('に即して、','にそくして、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,`${capitalize(result.english)} in accordance with ${basis.english}.`,{},{
      reason:grammarSlot(`n1-08-basis-${basisPool.indexOf(basis)}`,basis.basis,basis.basis,basis.basisReading,basis.english,['basis']),
      result:grammarSlot(`n1-08-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['basis']),
    },'に即して means acting strictly on the basis of something concrete, not personal opinion.')
  }

  if (patternId === 'n1-09') {
    const topicPool = [
      { topic:'問題', topicReading:'もんだい', english:'the issue' },
      { topic:'予算', topicReading:'よさん', english:'the budget' },
      { topic:'契約', topicReading:'けいやく', english:'the contract' },
    ]
    const resultPool = [
      { result:'議論します', resultReading:'ぎろんします', english:'discuss' },
      { result:'対立します', resultReading:'たいりつします', english:'clash over' },
      { result:'交渉します', resultReading:'こうしょうします', english:'negotiate concerning' },
    ]
    let topicPickPool = topicPool
    if (options.avoidWords?.object) { const avoided = topicPickPool.filter(c => c.topic !== options.avoidWords!.object); if (avoided.length) topicPickPool = avoided }
    const topic = seededPick(topicPickPool, options.slotSeeds?.object ?? seed, 1091)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1092)
    if (!topic || !result) return null
    const furigana=[{text:topic.topic,reading:topic.topicReading,slot:'object'},literalPart('をめぐって、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,capitalize(`they ${result.english} ${topic.english}.`),{},{
      object:grammarSlot(`n1-09-topic-${topicPool.indexOf(topic)}`,topic.topic,topic.topic,topic.topicReading,topic.english,['contested-topic']),
      result:grammarSlot(`n1-09-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['contested-topic']),
    },'をめぐって marks the contested topic that an action revolves around.')
  }

  if (patternId === 'n1-10') {
    const eventPool = [
      { event:'出発', eventReading:'しゅっぱつ', english:'departure' },
      { event:'卒業', eventReading:'そつぎょう', english:'graduation' },
      { event:'開会', eventReading:'かいかい', english:'the opening' },
    ]
    const resultPool = [
      { result:'挨拶します', resultReading:'あいさつします', english:'give a greeting' },
      { result:'感謝します', resultReading:'かんしゃします', english:'express gratitude' },
      { result:'演説します', resultReading:'えんぜつします', english:'give a speech' },
    ]
    let eventPickPool = eventPool
    if (options.avoidWords?.reason) { const avoided = eventPickPool.filter(c => c.event !== options.avoidWords!.reason); if (avoided.length) eventPickPool = avoided }
    const event = seededPick(eventPickPool, options.slotSeeds?.reason ?? seed, 1101)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1102)
    if (!event || !result) return null
    const furigana=[{text:event.event,reading:event.eventReading,slot:'reason'},literalPart('に際して、','にさいして、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,capitalize(`they ${result.english} on the occasion of ${event.english}.`),{},{
      reason:grammarSlot(`n1-10-event-${eventPool.indexOf(event)}`,event.event,event.event,event.eventReading,event.english,['occasion']),
      result:grammarSlot(`n1-10-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['occasion']),
    },'に際して marks a formal occasion that prompts the following action.')
  }

  if (patternId === 'n2-03') {
    const scenePool = [
      { clause:'転勤する', clauseReading:'てんきんする', english:'It has been decided that I will be transferred.' },
      { clause:'引っ越す', clauseReading:'ひっこす', english:'It has been decided that I will move.' },
      { clause:'結婚する', clauseReading:'けっこんする', english:'It has been decided that we will get married.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.verb) {
      const avoided = scenePickPool.filter(c => c.clause !== options.avoidWords!.verb)
      if (avoided.length) scenePickPool = avoided
    }
    const scene = seededPick(scenePickPool, options.slotSeeds?.verb ?? seed, 1111)
    if (!scene) return null
    const furigana=[{text:scene.clause,reading:scene.clauseReading,slot:'verb'},literalPart('ことになりました。')]
    return finish(furigana,scene.english,{},{verb:grammarSlot(`n2-03-scene-${scenePool.indexOf(scene)}`,scene.clause,scene.clause,scene.clauseReading,scene.english,['decision'])},'ことになる announces a decision or arrangement, often one made by someone else.')
  }

  if (patternId === 'n2-05') {
    // Was a hand-authored 3-pair scene list (専門家/犯人/天才 exist nowhere
    // else in the vocabulary) — に違いない just asserts confident certainty
    // about who someone is, which any subject+occupation pairing expresses
    // equally well, so both halves now draw from real, independently
    // rotatable pools instead of 3 fixed sentences.
    // "The family must be a police officer" mismatches a plural/group subject
    // against a singular occupation predicate — exclude group nouns the same
    // way pluralBenefactors does elsewhere for the same reason.
    const firstPersonWords = new Set(['私','私自身','俺','僕','我々','私たち'])
    const groupSubjects = new Set(['人々','我々','私たち','両親','家族'])
    const subject = pick(humans.filter(word => !firstPersonWords.has(word.japanese) && !groupSubjects.has(word.japanese)), 1121, 'subject')
    const predicate = pick(humans.filter(word => tagSet(word).has('occupation') && word.id !== subject?.id), 1122, 'object')
    if (!subject || !predicate) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const predicateEnglish = englishPhrase(predicate,'object')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(predicate,'object'),literalPart('に違いない。','にちがいない。')]
    return finish(furigana,`${capitalize(subjectEnglish)} must be ${predicateEnglish}.`,{subject,object:predicate},{},'に違いない expresses strong certainty based on evidence, not just guessing.')
  }

  if (patternId === 'n2-06') {
    const verb = pick(smallVerbPool, 1131, 'verb')
    const subject = pick(humans, 1132, 'subject')
    if (!verb || !subject) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const copula = copulaFor(subjectEnglish)
    // はずだ's four forms (nonpast/past × affirmative/negative) are all
    // standard, unremarkable conjugations of one expectation-based grammar
    // point — unlike べき's dictionary-form negative, the natural negative
    // here is はずがない ("there's no way that..."), not はずではない, so the
    // suffix genuinely changes shape by polarity, not just by adding ではない.
    const hazuVariants = [
      { suffix:'はずです。', english:`${capitalize(subjectEnglish)} ${copula} supposed to ${verb.english}.` },
      { suffix:'はずがありません。', english:`There is no way ${subjectEnglish} ${subjectUsesBaseVerb(subjectEnglish) ? verb.english : verb.englishThird}.` },
      { suffix:'はずでした。', english:`${capitalize(subjectEnglish)} ${subjectEnglish === 'I' ? 'was' : subjectUsesBaseVerb(subjectEnglish) ? 'were' : 'was'} supposed to ${verb.english}.` },
      { suffix:'はずがありませんでした。', english:`There was no way ${subjectEnglish} ${simplePast(verb.english)}.` },
    ]
    let endingIndex = options.slotSeeds?.ending !== undefined ? Math.abs(options.slotSeeds.ending) % hazuVariants.length : 0
    const surfaceFor = (index: number) => `${verb.japanese}${hazuVariants[index]!.suffix}`
    if (options.avoidWords?.ending && surfaceFor(endingIndex) === options.avoidWords.ending) {
      endingIndex = (endingIndex + 1) % hazuVariants.length
    }
    const chosen = hazuVariants[endingIndex]!
    const surface = surfaceFor(endingIndex)
    const reading = `${verb.reading}${chosen.suffix}`
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),{text:surface,reading,slot:'verb'}]
    return finish(furigana,chosen.english,{subject},{
      verb:grammarSlot(`verb-${verb.id}-hazu-${endingIndex}`,surface,verb.japanese,reading,chosen.english,['expectation','hazuda']),
      ending:grammarSlot(`hazu-ending-${endingIndex}`,chosen.suffix,chosen.suffix,chosen.suffix,chosen.english,['ending']),
    },'はずだ expresses a confident expectation based on what the speaker already knows.')
  }

  if (patternId === 'n2-07') {
    const scenePool = [
      { topic:'方法', topicReading:'ほうほう', predicate:'単純な', predicateReading:'たんじゅんな', english:'A method is simple.' },
      { topic:'規則', topicReading:'きそく', predicate:'必要な', predicateReading:'ひつような', english:'Rules are necessary.' },
      { topic:'計画', topicReading:'けいかく', predicate:'大切な', predicateReading:'たいせつな', english:'A plan is important.' },
      { topic:'問題', topicReading:'もんだい', predicate:'複雑な', predicateReading:'ふくざつな', english:'A problem is a complex thing.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.subject) {
      const avoided = scenePickPool.filter(c => c.topic !== options.avoidWords!.subject)
      if (avoided.length) scenePickPool = avoided
    }
    const scene = seededPick(scenePickPool, options.slotSeeds?.subject ?? seed, 1141)
    if (!scene) return null
    const furigana=[{text:scene.topic,reading:scene.topicReading,slot:'subject'},literalPart('は','わ'),literalPart(scene.predicate,scene.predicateReading,'object'),literalPart('ものだ。')]
    return finish(furigana,scene.english,{},{subject:grammarSlot(`n2-07-scene-${scenePool.indexOf(scene)}`,scene.topic,scene.topic,scene.topicReading,scene.english,['truism'])},'ものだ states something as a natural or generally accepted truth.')
  }

  if (patternId === 'n2-08') {
    const scenePool = [
      { thing:'声', thingReading:'こえ', compare:'鳥', compareReading:'とり', english:'a voice like a bird', plural:false },
      { thing:'心', thingReading:'こころ', compare:'天使', compareReading:'てんし', english:'a heart like an angel', plural:false },
      { thing:'目', thingReading:'め', compare:'宝石', compareReading:'ほうせき', english:'eyes like jewels', plural:true },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.object) {
      const avoided = scenePickPool.filter(c => c.compare !== options.avoidWords!.object)
      if (avoided.length) scenePickPool = avoided
    }
    const scene = seededPick(scenePickPool, options.slotSeeds?.object ?? seed, 1151)
    if (!scene) return null
    const furigana=[{text:scene.compare,reading:scene.compareReading,slot:'object'},literalPart('のような'),literalPart(scene.thing,scene.thingReading,'subject'),literalPart('だ。')]
    return finish(furigana,capitalize(`${scene.plural?'these are':'this is'} ${scene.english}.`),{},{object:grammarSlot(`n2-08-scene-${scenePool.indexOf(scene)}`,scene.compare,scene.compare,scene.compareReading,scene.english,['simile'])},'のような compares one noun to another to describe its quality.')
  }

  if (patternId === 'n2-17') {
    const object = pick(vocabulary.filter(word => categoryMatch(word,['Food']) && matchingTags(word,edibleTags).length>0), 1171)
    if (!object) return null
    const furigana=[wordPart(object,'object'),literalPart('が'),literalPart('嫌い','きらい','predicate'),literalPart('という'),literalPart('わけではありません。')]
    return finish(furigana,`It is not that I dislike ${englishPhrase(object,'object')}.`,{object},{},'というわけではない softens a claim, denying that it is a blanket truth.')
  }

  if (patternId === 'n2-18') {
    const verb = pick(smallVerbPool, 1181, 'verb')
    if (!verb) return null
    const masuStem = n4VerbForms(verb).masuStem
    const furigana=[{text:masuStem.japanese,reading:masuStem.reading,slot:'verb'},literalPart('かねます。')]
    return finish(furigana,`I cannot readily ${verb.english}.`,{},{verb:grammarSlot(`verb-${verb.id}-kanemasu`,`${masuStem.japanese}かねます`,verb.japanese,`${masuStem.reading}かねます`,`cannot readily ${verb.english}`,['polite-refusal','kaneru'])},'かねる is a formal, polite way to say something is difficult or impossible to do.')
  }

  // と思う/らしい/そうだ/ようだ (n3-20..23) all wrap the exact same shape — an
  // embedded plain-form clause — and used to hand-author 3-6 fixed clauses
  // each. Restricting the composed clause to i-adjectives sidesteps the one
  // real complication (な-adjectives/nouns need だ before らしい drops it but
  // と思う/そうだ keep it) entirely, since an i-adjective attaches the same
  // bare way to all four markers — so one real subject+adjective pool now
  // serves all four instead of ~15 fixed sentences total.
  if (patternId === 'n3-20' || patternId === 'n3-21' || patternId === 'n3-22' || patternId === 'n3-23') {
    const clauseSubject = pick(humans, 1191, 'subject')
    const clauseAdjective = pick(adjectiveRules.filter(rule => rule.japanese.endsWith('い') && !['kirei','kirai','itai'].includes(rule.id) && (rule.categories as SentenceCategory[]).includes('Person')), 1192)
    if (!clauseSubject || !clauseAdjective) return null
    const subjectEnglish = englishPhrase(clauseSubject,'subject')
    const copula = subjectEnglish === 'I' ? 'am' : subjectUsesBaseVerb(subjectEnglish) ? 'are' : 'is'
    const clauseSlot = grammarSlot(`clause-adjective-${clauseAdjective.id}`,clauseAdjective.japanese,clauseAdjective.japanese,clauseAdjective.reading,clauseAdjective.english,['embedded-clause'])
    const furigana=[wordPart(clauseSubject,'subject'),literalPart('は','わ'),{text:clauseAdjective.japanese,reading:clauseAdjective.reading,slot:'predicate'}]
    if (patternId === 'n3-20') {
      return finish([...furigana,literalPart('と思います。','とおもいます。')],`I think ${subjectEnglish} ${copula} ${clauseAdjective.english}.`,{subject:clauseSubject},{predicate:clauseSlot},'と思う reports the speaker\'s own opinion or judgment.')
    }
    if (patternId === 'n3-21') {
      return finish([...furigana,literalPart('らしいです。')],`Apparently ${subjectEnglish} ${copula} ${clauseAdjective.english}.`,{subject:clauseSubject},{predicate:clauseSlot},'らしい reports something the speaker heard or read from an outside source.')
    }
    if (patternId === 'n3-22') {
      return finish([...furigana,literalPart('そうです。')],`I heard ${subjectEnglish} ${copula} ${clauseAdjective.english}.`,{subject:clauseSubject},{predicate:clauseSlot},'そうだ after a plain-form clause reports something the speaker heard, without personal judgment.')
    }
    return finish([...furigana,literalPart('ようです。')],`${capitalize(subjectEnglish)} ${copula==='am'?'seem':subjectUsesBaseVerb(subjectEnglish)?'seem':'seems'} ${clauseAdjective.english}.`,{subject:clauseSubject},{predicate:clauseSlot},'ようだ expresses the speaker\'s own impression, usually from what they can see or sense.')
  }

  if (patternId === 'n3-24') {
    // Was 3 fixed {a,b,adjective} triples — reuses n3-25's real subject/other/
    // adjective pools (person-to-person comparison) instead of inventing a
    // parallel fixed set, giving both compared parties and the trait their
    // own rotatable slot.
    const subject = pick(humans, 1231, 'subject')
    const other = pick(humans.filter(word => word.id !== subject?.id), 1232, 'object')
    const adjective = pick(adjectiveRules.filter(rule => rule.japanese.endsWith('い') && !['kirei','kirai','suki','kirai','itai'].includes(rule.id) && (rule.categories as SentenceCategory[]).includes('Person')), 1233)
    if (!subject || !other || !adjective) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const otherEnglish = englishPhrase(other,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(other,'object'),literalPart('より'),{text:adjective.japanese,reading:adjective.reading,slot:'predicate'},literalPart('です。')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${copulaFor(subjectEnglish)} ${comparativeForm(adjective.english)} than ${otherEnglish}.`,{subject,object:other},{predicate:grammarSlot(`n3-24-adjective-${adjective.id}`,adjective.japanese,adjective.japanese,adjective.reading,adjective.english,['comparison'])},'より marks the thing being compared against — "more than B."')
  }

  if (patternId === 'n3-25') {
    const subject = pick(humans, 1241, 'subject')
    const other = pick(humans.filter(word => word.id !== subject?.id), 1242, 'object')
    // かっこいい is excluded: いい/良い negate irregularly (よくありません, not
    // かっこいくありません), unlike every other い-adjective here.
    // 好き/嫌い are excluded too: they are experiencer adjectives ("X likes/dislikes
    // Y"), not plain descriptive traits, so "A はBほど嫌いではない" reads as an
    // ambiguous dangling comparison rather than "A is not as disliked as B."
    // 痛い needs an experiencer or body-part frame ("my head hurts"), not a bare
    // person-to-person comparison — a person isn't directly describable as "painful."
    const adjective = pick(adjectiveRules.filter(rule => !['kakkoii','kirai','suki','itai'].includes(rule.id) && (rule.categories as SentenceCategory[]).includes('Person')), 1243)
    if (!subject || !other || !adjective) return null
    // きれい and 嫌い both end in い but are na-adjectives — the classic
    // exception that trips up the naive "ends in い" i-adjective heuristic.
    const isIAdjective = adjective.japanese.endsWith('い') && !['kirei','kirai'].includes(adjective.id)
    const trait = isIAdjective
      ? { surface:`${adjective.japanese.slice(0,-1)}くありません`, reading:`${adjective.reading.slice(0,-1)}くありません` }
      : { surface:`${adjective.japanese}ではありません`, reading:`${adjective.reading}ではありません` }
    const subjectEnglish = englishPhrase(subject,'subject')
    // 'other' is the second subject of an implied clause ("as SHE is"), not an
    // object of the sentence — subject-case pronouns (she/he/they), not
    // object-case (her/him/them), and it needs its own copula to read as a
    // full comparison rather than a dangling noun phrase.
    const otherEnglish = englishPhrase(other,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(other,'object'),literalPart('ほど'),literalPart(trait.surface,trait.reading,'predicate')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${copulaFor(subjectEnglish)} not as ${adjective.english} as ${otherEnglish} ${copulaFor(otherEnglish)}.`,{subject,object:other},{},'ほど with a negative predicate sets an upper bound: not reaching that level.')
  }

  if (patternId === 'n3-26') {
    const subject = pick(humans, 1251, 'subject')
    const drink = pick(vocabulary.filter(word => categoryMatch(word,['Food','Drink']) && matchingTags(word,drinkableTags).length>0), 1252)
    if (!subject || !drink) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(drink,'object'),literalPart('だけ'),literalPart('飲みます。','のみます。')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${subjectUsesBaseVerb(subjectEnglish)?'drink':'drinks'} only ${englishPhrase(drink,'object')}.`,{subject,object:drink},{},'だけ restricts the preceding word to being the only one that applies.')
  }

  if (patternId === 'n3-27') {
    // パスポート removed: none of these destinations are unambiguously "abroad",
    // so "if you're going to the park/station/school, you need a passport"
    // never lands right no matter which one gets picked.
    const destination = pick(validPlacePool(vocabulary).filter(word => ['日本','東京','大阪','学校','大学','図書館','公園','駅','病院'].includes(word.japanese)), 1261)
    const advice = pick([
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
    const scenePool = [
      { cause:'春になる', causeReading:'はるになる', result:'桜が咲きます', resultReading:'さくらがさきます', english:'Whenever spring comes, the cherry blossoms bloom.' },
      { cause:'ボタンを押す', causeReading:'ぼたんをおす', result:'ドアが開きます', resultReading:'どあがあきます', english:'Whenever you press the button, the door opens.' },
      { cause:'夜になる', causeReading:'よるになる', result:'星が見えます', resultReading:'ほしがみえます', english:'Whenever night falls, the stars become visible.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.reason) {
      const avoided = scenePickPool.filter(c => c.cause !== options.avoidWords!.reason)
      if (avoided.length) scenePickPool = avoided
    }
    const scene = seededPick(scenePickPool, options.slotSeeds?.reason ?? seed, 1271)
    if (!scene) return null
    const furigana=[literalPart(scene.cause,scene.causeReading,'reason'),literalPart('と、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{reason:grammarSlot(`n3-28-scene-${scenePool.indexOf(scene)}`,scene.cause,scene.cause,scene.causeReading,scene.english,['reason'])},'と links a condition to an automatic, always-true result.')
  }

  if (patternId === 'n3-29') {
    const foods = [
      { surface:'寿司', reading:'すし', english:'sushi' }, { surface:'天ぷら', reading:'てんぷら', english:'tempura' },
      { surface:'ラーメン', reading:'ラーメン', english:'ramen' }, { surface:'うどん', reading:'うどん', english:'udon' },
      { surface:'そば', reading:'そば', english:'soba' }, { surface:'ケーキ', reading:'ケーキ', english:'cake' },
    ]
    const firstIdx = Math.abs((options.slotSeeds?.object ?? seed) + 1281) % foods.length
    const first = foods[firstIdx]!
    const second = foods[(firstIdx + 1 + (Math.abs((options.slotSeeds?.result ?? seed) + 1282) % (foods.length - 1))) % foods.length]!
    const furigana=[{text:first.surface,reading:first.reading,slot:'object'},literalPart('とか'),{text:second.surface,reading:second.reading,slot:'result'},literalPart('とか'),literalPart('が'),literalPart('好きです。','すきです。')]
    return finish(furigana,`I like things like ${first.english} and ${second.english}.`,{},{
      object:grammarSlot(`n3-29-first-${firstIdx}`,first.surface,first.surface,first.reading,first.english,['food']),
      result:grammarSlot(`n3-29-second-${second.surface}`,second.surface,second.surface,second.reading,second.english,['food']),
    },'とか lists a few informal examples out of a larger set.')
  }

  if (patternId === 'n3-30') {
    const fruits = [
      { surface:'りんご', reading:'りんご', english:'apples' }, { surface:'バナナ', reading:'バナナ', english:'bananas' },
      { surface:'みかん', reading:'みかん', english:'oranges' }, { surface:'ぶどう', reading:'ぶどう', english:'grapes' },
      { surface:'いちご', reading:'いちご', english:'strawberries' },
    ]
    const subject = pick(humans, 1293, 'subject')
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
    // Coffee (caffeine), like alcohol, needs an adult subject — a child trying
    // coffee reads the same as a child trying alcohol.
    const subjectPool = object?.japanese === 'コーヒー'
      ? humans.filter(word => ![...tagSet(word)].some(tag=>minorSubjectTags.has(tag)))
      : humans
    const subject = pick(subjectPool.length ? subjectPool : humans, 1303)
    if (!pair || !verb || !object || !subject) return null
    const te = n4VerbForms(verb).te
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('を'),{text:te.japanese,reading:te.reading,slot:'verb'},literalPart('みます。')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${subjectUsesBaseVerb(subjectEnglish)?'try':'tries'} ${pair.english} ${englishPhrase(object,'object')}.`,{subject,object},{},'てみる means to try doing something to see how it goes.')
  }

  if (patternId === 'n2-19') {
    const scenePool = [
      { clause:'雨', clauseReading:'あめ', result:'試合は続きました', resultReading:'しあいはつづきました', english:'Despite the rain, the match continued.' },
      { clause:'努力', clauseReading:'どりょく', result:'失敗しました', resultReading:'しっぱいしました', english:'Despite the effort, it ended in failure.' },
      { clause:'反対', clauseReading:'はんたい', result:'計画は進みました', resultReading:'けいかくはすすみました', english:'Despite the opposition, the plan moved forward.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.reason) {
      const avoided = scenePickPool.filter(c => c.clause !== options.avoidWords!.reason)
      if (avoided.length) scenePickPool = avoided
    }
    const scene = seededPick(scenePickPool, options.slotSeeds?.reason ?? seed, 1311)
    if (!scene) return null
    const furigana=[{text:scene.clause,reading:scene.clauseReading,slot:'reason'},literalPart('にもかかわらず、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{reason:grammarSlot(`n2-19-scene-${scenePool.indexOf(scene)}`,scene.clause,scene.clause,scene.clauseReading,scene.english,['contrast'])},'にもかかわらず marks a strong, formal contrast — the result defies the expectation.')
  }

  if (patternId === 'n2-20') {
    // Third-person subjects only: くせに carries a blaming tone that fits describing
    // someone else, and it keeps the fixed English predicates ("is bad at it", "wants
    // to teach") in agreement without per-person conjugation.
    const scenePool = [
      { trait:'下手な', traitReading:'へたな', result:'教えたがります', resultReading:'おしえたがります', copula:'is', predicate:'bad at it', clause:'wants to teach', clauseBase:'want to teach' },
      { trait:'知らない', traitReading:'しらない', result:'説明します', resultReading:'せつめいします', copula:"doesn't", predicate:'know it', clause:'explains anyway', clauseBase:'explain anyway' },
      { trait:'子供の', traitReading:'こどもの', result:'偉そうです', resultReading:'えらそうです', copula:'is', predicate:'just a child', clause:'acts important', clauseBase:'act important' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.reason) {
      const avoided = scenePickPool.filter(c => c.trait !== options.avoidWords!.reason)
      if (avoided.length) scenePickPool = avoided
    }
    const scene = seededPick(scenePickPool, options.slotSeeds?.reason ?? seed, 1322)
    const eligibleSubjects = humans.filter(word => {
      if (['私','俺','僕','私自身','我々','私たち','あなた','君'].includes(word.japanese) || isPluralPhrase(englishPhrase(word,'subject'))) return false
      // くせに's blaming tone clashes with a respectful/honorific way of referring
      // to someone (お客様's 様 alone signals deference incompatible with contempt).
      if (word.japanese.endsWith('様') || tagSet(word).has('customer')) return false
      // Matching by tag alone is unreliable here — 妻/夫 have picked up a
      // 'family'-adjacent tag from imported data that also satisfied 'son'/
      // 'daughter', wrongly letting "even though my wife is just a child" through.
      // An explicit word list sidesteps whatever tag noise a given word carries.
      // The generic word 子供/子ども itself is excluded even though it is a
      // "child word" — "a child is just a child" is tautological. A specific
      // person who happens to be a child (息子, 女の子...) is what the contrast needs.
      if (scene?.trait === '子供の' && ['子供','子ども'].includes(word.japanese)) return false
      return scene?.trait !== '子供の' || childWords.has(word.japanese)
    })
    const subject = pick(eligibleSubjects, 1321, 'subject')
    if (!subject || !scene) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),{text:scene.trait,reading:scene.traitReading,slot:'reason'},literalPart('くせに、'),literalPart(scene.result,scene.resultReading,'result')]
    const secondMention = subjectPronoun(subjectEnglish)
    const clause = subjectUsesBaseVerb(secondMention) ? scene.clauseBase : scene.clause
    return finish(furigana,`Even though ${subjectEnglish} ${scene.copula} ${scene.predicate}, ${secondMention} ${clause}.`,{subject},{reason:grammarSlot(`n2-20-scene-${scenePool.indexOf(scene)}`,scene.trait,scene.trait,scene.traitReading,scene.predicate,['trait'])},'くせに adds a critical, blaming tone to a contrast — "even though, and shouldn\'t."')
  }

  if (patternId === 'n2-21') {
    const scenePool = [
      { expectation:'上手', expectationReading:'じょうず', reality:'下手', realityReading:'へた', english:'Far from being skilled, he is bad at it.' },
      { expectation:'安い', expectationReading:'やすい', reality:'高い', realityReading:'たかい', english:'Far from being cheap, it is expensive.' },
      { expectation:'簡単', expectationReading:'かんたん', reality:'難しい', realityReading:'むずかしい', english:'Far from being easy, it is difficult.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.reason) {
      const avoided = scenePickPool.filter(c => c.expectation !== options.avoidWords!.reason)
      if (avoided.length) scenePickPool = avoided
    }
    const scene = seededPick(scenePickPool, options.slotSeeds?.reason ?? seed, 1331)
    if (!scene) return null
    const furigana=[{text:scene.expectation,reading:scene.expectationReading,slot:'reason'},literalPart('どころか、'),literalPart(scene.reality,scene.realityReading,'result'),literalPart('です。')]
    return finish(furigana,scene.english,{},{reason:grammarSlot(`n2-21-scene-${scenePool.indexOf(scene)}`,scene.expectation,scene.expectation,scene.expectationReading,scene.english,['contrast'])},'どころか rejects an expectation and asserts the opposite extreme.')
  }

  if (patternId === 'n3-32') {
    // "was" only agrees with third-person singular, so both sides of this
    // sentence are drawn from a pool restricted to that (matches the n2-20 くせに fix below).
    const thirdPersonSingular = humans.filter(word => !subjectUsesBaseVerb(englishPhrase(word,'subject')))
    const subject = pick(thirdPersonSingular, 1341, 'subject')
    const companion = pick(thirdPersonSingular.filter(word => word.id !== subject?.id), 1342, 'companion')
    const scene = pick([
      { activity:'寝て', activityReading:'ねて', result:'家事をしていました', resultReading:'かじをしていました', companionVerb:'slept', resultEnglish:'was doing housework' },
      { activity:'話して', activityReading:'はなして', result:'ずっと聞いていました', resultReading:'ずっときいていました', companionVerb:'was talking', resultEnglish:'listened' },
      { activity:'勉強して', activityReading:'べんきょうして', result:'テレビを見ていました', resultReading:'てれびをみていました', companionVerb:'studied', resultEnglish:'was watching television' },
    ], 1343)
    if (!subject || !companion || !scene) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const companionEnglish = englishPhrase(companion,'subject')
    const furigana=[wordPart(companion,'companion'),literalPart('が'),literalPart(scene.activity,scene.activityReading,'reason'),literalPart('いる'),literalPart('間、','あいだ、'),wordPart(subject,'subject'),literalPart('は','わ'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,capitalize(`for the whole time ${companionEnglish} ${scene.companionVerb}, ${subjectEnglish} ${scene.resultEnglish}.`),{subject,companion},{},'間 (without に) spans the entire duration of the background action, unlike 間に which picks one moment within it.')
  }

  if (patternId === 'n3-33') {
    const verb = pick(verbs.filter(candidate=>['taberu-basic','nomu-basic','yomu-basic','miru-basic'].includes(candidate.id)), 1351, 'verb')
    const result = verb ? fillVerbSlots(verb,vocabulary,seed,1352,options) : null
    if (!verb || !result) return null
    const aStem = n4VerbForms(verb).aStem
    const subject=result.filled.subject!,object=result.filled.object!
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('を'),{text:aStem.japanese,reading:aStem.reading,slot:'verb'},literalPart('なくなりました。')]
    // translatedVerb carries the object-sensitive readings (見る is "look at" for
    // a picture, "watch" for a film); verb.english alone would lose them.
    const verbEnglish = translatedVerb(verb,result.filled,subjectUsesBaseVerb(subjectEnglish))
    return finish(furigana,`${capitalize(subjectEnglish)} no longer ${verbEnglish} ${englishPhrase(object,'object')}.`,{subject,object},{verb:grammarSlot(`verb-${verb.id}-nakunaru`,`${aStem.japanese}なくなりました`,verb.japanese,`${aStem.reading}なくなりました`,`no longer ${verb.english}`,['cessation','nakunaru'])},'なくなる attaches to the nai-stem and marks that an action or state has stopped happening.')
  }

  if (patternId === 'n3-34') {
    const scenePool = [
      { clause:'泣きたい', clauseReading:'なきたい', predicate:'嬉しいです', predicateReading:'うれしいです', english:'I am happy enough to cry.' },
      { clause:'死にたい', clauseReading:'しにたい', predicate:'疲れました', predicateReading:'つかれました', english:'I am tired enough to feel like dying.' },
      { clause:'涙が出る', clauseReading:'なみだがでる', predicate:'感動しました', predicateReading:'かんどうしました', english:'I was moved to the point of tears.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.reason) {
      const avoided = scenePickPool.filter(c => c.clause !== options.avoidWords!.reason)
      if (avoided.length) scenePickPool = avoided
    }
    const scene = seededPick(scenePickPool, options.slotSeeds?.reason ?? seed, 1361)
    if (!scene) return null
    const furigana=[literalPart(scene.clause,scene.clauseReading,'reason'),literalPart('くらい'),literalPart(scene.predicate,scene.predicateReading,'result')]
    return finish(furigana,scene.english,{},{reason:grammarSlot(`n3-34-scene-${scenePool.indexOf(scene)}`,scene.clause,scene.clause,scene.clauseReading,scene.english,['degree'])},'くらい after an extreme example sets the degree of the feeling being described.')
  }

  if (patternId === 'n3-35') {
    const subject = pick(humans, 1371, 'subject')
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
    const causePool = [
      { cause:'嬉しさの', causeReading:'うれしさの', english:'so happy' },
      { cause:'驚きの', causeReading:'おどろきの', english:'so surprised' },
      { cause:'悲しさの', causeReading:'かなしさの', english:'so sad' },
    ]
    const resultPool = [
      { result:'泣いてしまいました', resultReading:'ないてしまいました', english:'ended up crying' },
      { result:'声も出ませんでした', resultReading:'こえもでませんでした', english:'could not even speak' },
      { result:'眠れませんでした', resultReading:'ねむれませんでした', english:'could not sleep' },
    ]
    let causePickPool = causePool
    if (options.avoidWords?.reason) { const avoided = causePickPool.filter(c => c.cause !== options.avoidWords!.reason); if (avoided.length) causePickPool = avoided }
    const cause = seededPick(causePickPool, options.slotSeeds?.reason ?? seed, 1381)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1382)
    if (!cause || !result) return null
    const furigana=[{text:cause.cause,reading:cause.causeReading,slot:'reason'},literalPart('あまり、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,`I was ${cause.english} that I ${result.english}.`,{},{
      reason:grammarSlot(`n3-36-cause-${causePool.indexOf(cause)}`,cause.cause,cause.cause,cause.causeReading,cause.english,['degree']),
      result:grammarSlot(`n3-36-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['degree']),
    },'あまり links an extreme feeling to a result caused entirely by its intensity.')
  }

  if (patternId === 'n3-37') {
    const subject = pick(humans, 1391, 'subject')
    const quote = pick([
      { surface:'頑張って', reading:'がんばって', english:'"Do your best"' },
      { surface:'ありがとう', reading:'ありがとう', english:'"Thank you"' },
      { surface:'気をつけて', reading:'きをつけて', english:'"Be careful"' },
      { surface:'おめでとう', reading:'おめでとう', english:'"Congratulations"' },
      { surface:'ごめんなさい', reading:'ごめんなさい', english:'"I\'m sorry"' },
      { surface:'また明日', reading:'またあした', english:'"See you tomorrow"' },
    ], 1392)
    if (!subject || !quote) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),literalPart('「'),literalPart(quote.surface,quote.reading,'object'),literalPart('」と'),literalPart('言いました。','いいました。')]
    return finish(furigana,`${capitalize(subjectEnglish)} said ${quote.english}.`,{subject},{},'「quote」と言う reports someone\'s exact words.')
  }

  if (patternId === 'n3-38') {
    const scenePool = [
      { subject:'このケーキ', subjectReading:'このけーき', stem:'美味し', stemReading:'おいし', english:'This cake looks delicious.' },
      { subject:'あの映画', subjectReading:'あのえいが', stem:'面白', stemReading:'おもしろ', english:'That movie looks interesting.' },
      { subject:'この問題', subjectReading:'このもんだい', stem:'難し', stemReading:'むずかし', english:'This problem looks difficult.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.subject) {
      const avoided = scenePickPool.filter(c => c.subject !== options.avoidWords!.subject)
      if (avoided.length) scenePickPool = avoided
    }
    const scene = seededPick(scenePickPool, options.slotSeeds?.subject ?? seed, 1401)
    if (!scene) return null
    const furigana=[{text:scene.subject,reading:scene.subjectReading,slot:'subject'},literalPart('は','わ'),literalPart(scene.stem,scene.stemReading,'predicate'),literalPart('そうです。')]
    return finish(furigana,scene.english,{},{subject:grammarSlot(`n3-38-scene-${scenePool.indexOf(scene)}`,scene.subject,scene.subject,scene.subjectReading,scene.english,['appearance'])},'い-adjective stem + そう describes an appearance-based guess, unlike the hearsay そうだ that follows a full plain-form clause.')
  }

  if (patternId === 'n3-39') {
    const verb = pick(smallVerbPool, 1411, 'verb')
    if (!verb) return null
    const aStem = n4VerbForms(verb).aStem
    const furigana=[{text:aStem.japanese,reading:aStem.reading,slot:'verb'},literalPart('ないでください。')]
    return finish(furigana,`Please do not ${verb.english}.`,{},{verb:grammarSlot(`verb-${verb.id}-naidekudasai`,`${aStem.japanese}ないでください`,verb.japanese,`${aStem.reading}ないでください`,`please do not ${verb.english}`,['polite-request','naide-kudasai'])},'ないでください politely asks someone not to do something.')
  }

  if (patternId === 'n3-40') {
    // てくる: a state or action that has continued up to the present moment —
    // uses the same real subject/object/verb pool machinery as n3-13/n3-33
    // rather than a fixed scene, so all three halves are independently
    // rotatable.
    const verb = pick(verbs.filter(candidate=>['taberu-basic','nomu-basic','yomu-basic','hanasu-companion'].includes(candidate.id)), 1601, 'verb')
    const result = verb ? fillVerbSlots(verb,vocabulary,seed,1602,options) : null
    if (!verb || !result) return null
    const te = n4VerbForms(verb).te
    const subject=result.filled.subject!,object=result.filled.object
    const subjectEnglish = englishPhrase(subject,'subject')
    const objectEnglish = object ? englishPhrase(object,'object') : ''
    const furigana=object
      ? [literalPart('ずっと','ずっと','time'),wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('を'),{text:te.japanese,reading:te.reading,slot:'verb'},literalPart('きました。')]
      : [literalPart('ずっと','ずっと','time'),wordPart(subject,'subject'),literalPart('は','わ'),{text:te.japanese,reading:te.reading,slot:'verb'},literalPart('きました。')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${subjectUsesBaseVerb(subjectEnglish)?'have':'has'} been ${presentParticiple(verb.english)}${objectEnglish?` ${objectEnglish}`:''} all along.`,object?{subject,object}:{subject},{verb:grammarSlot(`verb-${verb.id}-tekuru`,`${te.japanese}きました`,verb.japanese,`${te.reading}きました`,`have been ${presentParticiple(verb.english)}`,['continuation-to-now','te-kuru'])},'て以来 marks a starting point, but て + くる marks the whole span up to now as an unbroken continuation.')
  }

  if (patternId === 'n3-41') {
    // ていく: the mirror image — a state or action that will keep continuing
    // from now into the future.
    const verb = pick(verbs.filter(candidate=>['taberu-basic','nomu-basic','yomu-basic','hanasu-companion'].includes(candidate.id)), 1611, 'verb')
    const result = verb ? fillVerbSlots(verb,vocabulary,seed,1612,options) : null
    if (!verb || !result) return null
    const te = n4VerbForms(verb).te
    const subject=result.filled.subject!,object=result.filled.object
    const subjectEnglish = englishPhrase(subject,'subject')
    const objectEnglish = object ? englishPhrase(object,'object') : ''
    const furigana=object
      ? [literalPart('これからも','これからも','time'),wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('を'),{text:te.japanese,reading:te.reading,slot:'verb'},literalPart('いきます。')]
      : [literalPart('これからも','これからも','time'),wordPart(subject,'subject'),literalPart('は','わ'),{text:te.japanese,reading:te.reading,slot:'verb'},literalPart('いきます。')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${subjectUsesBaseVerb(subjectEnglish)?'will':'will'} keep ${presentParticiple(verb.english)}${objectEnglish?` ${objectEnglish}`:''} from now on.`,object?{subject,object}:{subject},{verb:grammarSlot(`verb-${verb.id}-teiku`,`${te.japanese}いきます`,verb.japanese,`${te.reading}いきます`,`will keep ${presentParticiple(verb.english)}`,['continuation-into-future','te-iku'])},'て + いく marks a state or action moving forward, continuing from this point into the future.')
  }

  if (patternId === 'n2-22') {
    // Decoupled from a correlated {clause,result} pair into two independent
    // pools — とたん just needs two events in immediate succession, not a
    // logically matched pair, so any combination reads naturally and both
    // halves are now genuinely (and separately, and animated-ly) rotatable
    // instead of one tracked half dragging an untracked one along silently.
    const clausePool = [
      { clause:'家を出た', clauseReading:'いえをでた', english:'I left the house' },
      { clause:'ドアを開けた', clauseReading:'どあをあけた', english:'I opened the door' },
      { clause:'席に座った', clauseReading:'せきにすわった', english:'I sat down' },
    ]
    const resultPool = [
      { result:'雨が降り出しました', resultReading:'あめがふりだしました', english:'it started to rain' },
      { result:'猫が飛び出しました', resultReading:'ねこがとびだしました', english:'the cat jumped out' },
      { result:'電話が鳴りました', resultReading:'でんわがなりました', english:'the phone rang' },
    ]
    let clausePickPool = clausePool
    if (options.avoidWords?.reason) { const avoided = clausePickPool.filter(c => c.clause !== options.avoidWords!.reason); if (avoided.length) clausePickPool = avoided }
    const clause = seededPick(clausePickPool, options.slotSeeds?.reason ?? seed, 1421)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1422)
    if (!clause || !result) return null
    const furigana=[{text:clause.clause,reading:clause.clauseReading,slot:'reason'},literalPart('とたん、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,`The moment ${clause.english}, ${result.english}.`,{},{
      reason:grammarSlot(`n2-22-clause-${clausePool.indexOf(clause)}`,clause.clause,clause.clause,clause.clauseReading,clause.english,['instant']),
      result:grammarSlot(`n2-22-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['instant']),
    },'とたん marks a second event that happens the instant the first one finishes, often catching the speaker off guard.')
  }

  if (patternId === 'n2-23') {
    const clausePool = [
      { clause:'着き', clauseReading:'つき', english:'I arrive' },
      { clause:'準備ができ', clauseReading:'じゅんびができ', english:'preparations are ready' },
      { clause:'分かり', clauseReading:'わかり', english:'I find out' },
    ]
    const resultPool = [
      { result:'連絡します', resultReading:'れんらくします', english:'I will contact you' },
      { result:'始めます', resultReading:'はじめます', english:'we will begin' },
      { result:'お知らせします', resultReading:'おしらせします', english:'I will let you know' },
    ]
    let clausePickPool = clausePool
    if (options.avoidWords?.reason) { const avoided = clausePickPool.filter(c => c.clause !== options.avoidWords!.reason); if (avoided.length) clausePickPool = avoided }
    const clause = seededPick(clausePickPool, options.slotSeeds?.reason ?? seed, 1431)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1432)
    if (!clause || !result) return null
    const furigana=[{text:clause.clause,reading:clause.clauseReading,slot:'reason'},literalPart('次第、','しだい、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,`As soon as ${clause.english}, ${result.english}.`,{},{
      reason:grammarSlot(`n2-23-clause-${clausePool.indexOf(clause)}`,clause.clause,clause.clause,clause.clauseReading,clause.english,['immediate']),
      result:grammarSlot(`n2-23-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['immediate']),
    },'次第 attaches to the masu-stem and means the result follows immediately once the first event happens.')
  }

  if (patternId === 'n2-24') {
    const clausePool = [
      { clause:'日本に来て', clauseReading:'にほんにきて', english:'I came to Japan' },
      { clause:'引っ越して', clauseReading:'ひっこして', english:'I moved' },
      { clause:'卒業して', clauseReading:'そつぎょうして', english:'graduating' },
    ]
    const resultPool = [
      { result:'ずっと忙しいです', resultReading:'ずっといそがしいです', english:'I have been busy the whole time' },
      { result:'会っていません', resultReading:'あっていません', english:'I have not seen them' },
      { result:'連絡していません', resultReading:'れんらくしていません', english:'I have not been in touch' },
    ]
    let clausePickPool = clausePool
    if (options.avoidWords?.reason) { const avoided = clausePickPool.filter(c => c.clause !== options.avoidWords!.reason); if (avoided.length) clausePickPool = avoided }
    const clause = seededPick(clausePickPool, options.slotSeeds?.reason ?? seed, 1441)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1442)
    if (!clause || !result) return null
    const furigana=[{text:clause.clause,reading:clause.clauseReading,slot:'reason'},literalPart('以来、','いらい、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,`Ever since ${clause.english}, ${result.english}.`,{},{
      reason:grammarSlot(`n2-24-clause-${clausePool.indexOf(clause)}`,clause.clause,clause.clause,clause.clauseReading,clause.english,['since']),
      result:grammarSlot(`n2-24-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['since']),
    },'て以来 marks a starting point for a state or situation that has continued ever since.')
  }

  if (patternId === 'n2-25') {
    const clausePool = [
      { clause:'よく考えた', clauseReading:'よくかんがえた', english:'thinking it over carefully' },
      { clause:'相談した', clauseReading:'そうだんした', english:'consulting with others' },
      { clause:'確認した', clauseReading:'かくにんした', english:'confirming' },
    ]
    const resultPool = [
      { result:'決めます', resultReading:'きめます', english:'I will decide' },
      { result:'返事します', resultReading:'へんじします', english:'I will reply' },
      { result:'送ります', resultReading:'おくります', english:'I will send it' },
    ]
    let clausePickPool = clausePool
    if (options.avoidWords?.reason) { const avoided = clausePickPool.filter(c => c.clause !== options.avoidWords!.reason); if (avoided.length) clausePickPool = avoided }
    const clause = seededPick(clausePickPool, options.slotSeeds?.reason ?? seed, 1451)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1452)
    if (!clause || !result) return null
    const furigana=[{text:clause.clause,reading:clause.clauseReading,slot:'reason'},literalPart('うえで、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,`After ${clause.english}, ${result.english}.`,{},{
      reason:grammarSlot(`n2-25-clause-${clausePool.indexOf(clause)}`,clause.clause,clause.clause,clause.clauseReading,clause.english,['basis']),
      result:grammarSlot(`n2-25-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['basis']),
    },'うえで means the first action is completed as a deliberate basis before the second happens.')
  }

  if (patternId === 'n2-26') {
    const clausePool = [
      { clause:'食事をしている', clauseReading:'しょくじをしている', english:'right in the middle of eating' },
      { clause:'会議をしている', clauseReading:'かいぎをしている', english:'right in the middle of the meeting' },
      { clause:'勉強をしている', clauseReading:'べんきょうをしている', english:'right in the middle of studying' },
    ]
    const resultPool = [
      { result:'電話が鳴りました', resultReading:'でんわがなりました', english:'the phone rang' },
      { result:'地震がありました', resultReading:'じしんがありました', english:'there was an earthquake' },
      { result:'友達が来ました', resultReading:'ともだちがきました', english:'a friend came' },
    ]
    let clausePickPool = clausePool
    if (options.avoidWords?.reason) { const avoided = clausePickPool.filter(c => c.clause !== options.avoidWords!.reason); if (avoided.length) clausePickPool = avoided }
    const clause = seededPick(clausePickPool, options.slotSeeds?.reason ?? seed, 1461)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1462)
    if (!clause || !result) return null
    const furigana=[{text:clause.clause,reading:clause.clauseReading,slot:'reason'},literalPart('最中に、','さいちゅうに、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,`${capitalize(clause.english)}, ${result.english}.`,{},{
      reason:grammarSlot(`n2-26-clause-${clausePool.indexOf(clause)}`,clause.clause,clause.clause,clause.clauseReading,clause.english,['interruption']),
      result:grammarSlot(`n2-26-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['interruption']),
    },'最中に interrupts an action at its peak, right when it is most fully underway.')
  }

  if (patternId === 'n2-27') {
    const clausePool = [
      { clause:'道が混んでいた', clauseReading:'みちがこんでいた', english:'the road was congested' },
      { clause:'急いでいた', clauseReading:'いそいでいた', english:'I was in a hurry' },
      { clause:'眠かった', clauseReading:'ねむかった', english:'I was sleepy' },
    ]
    const resultPool = [
      { result:'遅れました', resultReading:'おくれました', english:'I was late' },
      { result:'忘れ物をしました', resultReading:'わすれものをしました', english:'I forgot something' },
      { result:'寝坊しました', resultReading:'ねぼうしました', english:'I overslept' },
    ]
    let clausePickPool = clausePool
    if (options.avoidWords?.reason) { const avoided = clausePickPool.filter(c => c.clause !== options.avoidWords!.reason); if (avoided.length) clausePickPool = avoided }
    const clause = seededPick(clausePickPool, options.slotSeeds?.reason ?? seed, 1471)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1472)
    if (!clause || !result) return null
    const furigana=[{text:clause.clause,reading:clause.clauseReading,slot:'reason'},literalPart('ものだから、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,`Because ${clause.english}, ${result.english}.`,{},{
      reason:grammarSlot(`n2-27-clause-${clausePool.indexOf(clause)}`,clause.clause,clause.clause,clause.clauseReading,clause.english,['excuse']),
      result:grammarSlot(`n2-27-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['excuse']),
    },'ものだから offers a reason with an excuse-making, self-justifying tone.')
  }

  if (patternId === 'n2-28') {
    const scenePool = [
      { clause:'台風が来る', clauseReading:'たいふうがくる', english:'There is a risk that a typhoon will come.' },
      { clause:'事故が起きる', clauseReading:'じこがおきる', english:'There is a risk that an accident will occur.' },
      { clause:'値段が上がる', clauseReading:'ねだんがあがる', english:'There is a risk that the price will rise.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.reason) { const avoided = scenePickPool.filter(c => c.clause !== options.avoidWords!.reason); if (avoided.length) scenePickPool = avoided }
    const scene = seededPick(scenePickPool, options.slotSeeds?.reason ?? seed, 1481)
    if (!scene) return null
    const furigana=[{text:scene.clause,reading:scene.clauseReading,slot:'reason'},literalPart('おそれがあります。')]
    return finish(furigana,scene.english,{},{reason:grammarSlot(`n2-28-scene-${scenePool.indexOf(scene)}`,scene.clause,scene.clause,scene.clauseReading,scene.english,['risk'])},'おそれがある is a formal way to warn about a possible negative outcome.')
  }

  if (patternId === 'n2-29') {
    const scenePool = [
      { clause:'顔色が悪い', clauseReading:'かおいろがわるい', result:'体調が悪いと分かりました', resultReading:'たいちょうがわるいとわかりました', english:"Judging from his poor complexion, I could tell he wasn't feeling well." },
      { clause:'足跡がある', clauseReading:'あしあとがある', result:'誰かが来たと分かりました', resultReading:'だれかがきたとわかりました', english:'Judging from the footprints, I could tell someone had come.' },
      { clause:'電気がついている', clauseReading:'でんきがついている', result:'誰かがいると分かりました', resultReading:'だれかがいるとわかりました', english:'Judging from the light being on, I could tell someone was there.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.reason) { const avoided = scenePickPool.filter(c => c.clause !== options.avoidWords!.reason); if (avoided.length) scenePickPool = avoided }
    const scene = seededPick(scenePickPool, options.slotSeeds?.reason ?? seed, 1491)
    if (!scene) return null
    const furigana=[{text:scene.clause,reading:scene.clauseReading,slot:'reason'},literalPart('ことから、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{reason:grammarSlot(`n2-29-scene-${scenePool.indexOf(scene)}`,scene.clause,scene.clause,scene.clauseReading,scene.english,['evidence'])},'ことから draws a conclusion from an observable piece of evidence.')
  }

  if (patternId === 'n2-30') {
    const clausePool = [
      { clause:'安い', clauseReading:'やすい', english:'it is cheap' },
      { clause:'難しい', clauseReading:'むずかしい', english:'it is difficult' },
      { clause:'小さい', clauseReading:'ちいさい', english:'it is small' },
    ]
    const resultPool = [
      { result:'品質は良いです', resultReading:'ひんしつはいいです', english:'the quality is good' },
      { result:'挑戦する価値があります', resultReading:'ちょうせんするかちがあります', english:'it is worth attempting' },
      { result:'とても丈夫です', resultReading:'とてもじょうぶです', english:'it is very sturdy' },
    ]
    let clausePickPool = clausePool
    if (options.avoidWords?.reason) { const avoided = clausePickPool.filter(c => c.clause !== options.avoidWords!.reason); if (avoided.length) clausePickPool = avoided }
    const clause = seededPick(clausePickPool, options.slotSeeds?.reason ?? seed, 1501)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1502)
    if (!clause || !result) return null
    const furigana=[{text:clause.clause,reading:clause.clauseReading,slot:'reason'},literalPart('とはいえ、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,`Though ${clause.english}, ${result.english}.`,{},{
      reason:grammarSlot(`n2-30-clause-${clausePool.indexOf(clause)}`,clause.clause,clause.clause,clause.clauseReading,clause.english,['concession']),
      result:grammarSlot(`n2-30-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['concession']),
    },'とはいえ concedes a point formally before pointing out that it does not change the outcome.')
  }

  if (patternId === 'n2-31') {
    const clausePool = [
      { clause:'狭い', clauseReading:'せまい', english:'it is small' },
      { clause:'安い', clauseReading:'やすい', english:'it is cheap' },
      { clause:'若い', clauseReading:'わかい', english:'young' },
    ]
    const resultPool = [
      { result:'楽しい家です', resultReading:'たのしいいえです', english:'it is a fun house' },
      { result:'質の良い店です', resultReading:'しつのよいみせです', english:'it is a good-quality shop' },
      { result:'とても頼りになります', resultReading:'とてもたよりになります', english:'they are very reliable' },
    ]
    let clausePickPool = clausePool
    if (options.avoidWords?.reason) { const avoided = clausePickPool.filter(c => c.clause !== options.avoidWords!.reason); if (avoided.length) clausePickPool = avoided }
    const clause = seededPick(clausePickPool, options.slotSeeds?.reason ?? seed, 1511)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1512)
    if (!clause || !result) return null
    const furigana=[{text:clause.clause,reading:clause.clauseReading,slot:'reason'},literalPart('ながらも、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,`Although ${clause.english}, ${result.english}.`,{},{
      reason:grammarSlot(`n2-31-clause-${clausePool.indexOf(clause)}`,clause.clause,clause.clause,clause.clauseReading,clause.english,['concession']),
      result:grammarSlot(`n2-31-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['concession']),
    },'ながら(も) after an adjective concedes a quality while asserting something that seems to contradict it.')
  }

  if (patternId === 'n2-32') {
    const clausePool = [
      { clause:'生きている', clauseReading:'いきている', english:'I am alive' },
      { clause:'時間がある', clauseReading:'じかんがある', english:'I have time' },
      { clause:'ルールを守る', clauseReading:'るーるをまもる', english:'you follow the rules' },
    ]
    const resultPool = [
      { result:'頑張ります', resultReading:'がんばります', english:'I will keep trying' },
      { result:'手伝います', resultReading:'てつだいます', english:'I will help' },
      { result:'自由に遊べます', resultReading:'じゆうにあそべます', english:'you can play freely' },
    ]
    let clausePickPool = clausePool
    if (options.avoidWords?.reason) { const avoided = clausePickPool.filter(c => c.clause !== options.avoidWords!.reason); if (avoided.length) clausePickPool = avoided }
    const clause = seededPick(clausePickPool, options.slotSeeds?.reason ?? seed, 1521)
    let resultPickPool = resultPool
    if (options.avoidWords?.result) { const avoided = resultPickPool.filter(c => c.result !== options.avoidWords!.result); if (avoided.length) resultPickPool = avoided }
    const result = seededPick(resultPickPool, options.slotSeeds?.result ?? seed, 1522)
    if (!clause || !result) return null
    const furigana=[{text:clause.clause,reading:clause.clauseReading,slot:'reason'},literalPart('限り、','かぎり、'),{text:result.result,reading:result.resultReading,slot:'result'}]
    return finish(furigana,`As long as ${clause.english}, ${result.english}.`,{},{
      reason:grammarSlot(`n2-32-clause-${clausePool.indexOf(clause)}`,clause.clause,clause.clause,clause.clauseReading,clause.english,['boundary']),
      result:grammarSlot(`n2-32-result-${resultPool.indexOf(result)}`,result.result,result.result,result.resultReading,result.english,['boundary']),
    },'限り sets an upper boundary: the result holds only within that condition.')
  }

  if (patternId === 'n2-33') {
    const scenePool = [
      { a:'今年', aReading:'ことし', b:'去年', bReading:'きょねん', predicate:'暑いです', predicateReading:'あついです', english:'Compared with last year, this year is hot.' },
      { a:'この町', aReading:'このまち', b:'あの町', bReading:'あのまち', predicate:'静かです', predicateReading:'しずかです', english:'Compared with that town, this town is quiet.' },
      { a:'今回', aReading:'こんかい', b:'前回', bReading:'ぜんかい', predicate:'簡単でした', predicateReading:'かんたんでした', english:'Compared with last time, this time was easy.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.subject) { const avoided = scenePickPool.filter(c => c.a !== options.avoidWords!.subject); if (avoided.length) scenePickPool = avoided }
    const scene = seededPick(scenePickPool, options.slotSeeds?.subject ?? seed, 1531)
    if (!scene) return null
    const furigana=[{text:scene.a,reading:scene.aReading,slot:'subject'},literalPart('は','わ'),literalPart(scene.b,scene.bReading,'object'),literalPart('に比べて、','にくらべて、'),literalPart(scene.predicate,scene.predicateReading,'result')]
    return finish(furigana,scene.english,{},{subject:grammarSlot(`n2-33-scene-${scenePool.indexOf(scene)}`,scene.a,scene.a,scene.aReading,scene.english,['comparison'])},'に比べて sets up an explicit comparison baseline for the statement that follows.')
  }

  if (patternId === 'n2-34') {
    const scenePool = [
      { topic:'その意見', topicReading:'そのいけん', result:'反対しました', resultReading:'はんたいしました', english:'They objected in response to that opinion.' },
      { topic:'新しい方針', topicReading:'あたらしいほうしん', result:'賛成しました', resultReading:'さんせいしました', english:'They agreed in response to the new policy.' },
      { topic:'その質問', topicReading:'そのしつもん', result:'丁寧に答えました', resultReading:'ていねいにこたえました', english:'They answered that question carefully.' },
    ]
    let scenePickPool = scenePool
    if (options.avoidWords?.object) { const avoided = scenePickPool.filter(c => c.topic !== options.avoidWords!.object); if (avoided.length) scenePickPool = avoided }
    const scene = seededPick(scenePickPool, options.slotSeeds?.object ?? seed, 1541)
    if (!scene) return null
    const furigana=[{text:scene.topic,reading:scene.topicReading,slot:'object'},literalPart('に対して、','にたいして、'),literalPart(scene.result,scene.resultReading,'result')]
    return finish(furigana,scene.english,{},{object:grammarSlot(`n2-34-scene-${scenePool.indexOf(scene)}`,scene.topic,scene.topic,scene.topicReading,scene.english,['target'])},'に対して marks the specific target that a reaction or attitude is directed at.')
  }

  if (patternId === 'n2-35') {
    const subject = pick(humans, 1551, 'subject')
    const object = pick(exact(['名前','漢字','日本語','英語','住所','電話番号','答え','理由','意味']), 1552)
    if (!subject || !object) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const objectEnglish = object.japanese === '答え' ? 'the answer' : englishPhrase(object,'object')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),wordPart(object,'object'),literalPart('すら'),literalPart('知りません。','しりません。')]
    return finish(furigana,`${capitalize(subjectEnglish)} ${subjectUsesBaseVerb(subjectEnglish)?"don't":"doesn't"} even know ${objectEnglish}.`,{subject,object},{},'すら is a formal, literary equivalent of さえ, singling out an extreme example.')
  }

  if (patternId === 'n2-36') {
    // Subject and verb were bundled as correlated {subject,verb} pairs, which
    // would have changed both texts together on a "subject" rotation and
    // failed the single-segment-change check the sweep enforces — decoupled
    // to a real subject pool + an independently-seeded verb choice instead,
    // so each is genuinely its own rotatable slot.
    const subject = pick(humans, 1561, 'subject')
    const verbPool = [
      { verb:'来る', verbReading:'くる', base:'is coming', plural:'are coming' },
      { verb:'知っている', verbReading:'しっている', base:'knows', plural:'know' },
      { verb:'間違える', verbReading:'まちがえる', base:'makes a mistake', plural:'make a mistake' },
      { verb:'忘れる', verbReading:'わすれる', base:'forgets', plural:'forget' },
      { verb:'嘘をつく', verbReading:'うそをつく', base:'lies', plural:'lie' },
    ]
    let verbPickPool = verbPool
    if (options.avoidWords?.verb) { const avoided = verbPickPool.filter(c => c.verb !== options.avoidWords!.verb); if (avoided.length) verbPickPool = avoided }
    const verbChoice = seededPick(verbPickPool, options.slotSeeds?.verb ?? seed, 1562)
    if (!subject || !verbChoice) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const gloss = subjectUsesBaseVerb(subjectEnglish) ? verbChoice.plural : verbChoice.base
    const furigana=[wordPart(subject,'subject'),literalPart('が'),{text:verbChoice.verb,reading:verbChoice.verbReading,slot:'verb'},literalPart('はずがありません。')]
    return finish(furigana,`There is no way ${subjectEnglish} ${gloss}.`,{subject},{verb:grammarSlot(`n2-36-verb-${verbPool.indexOf(verbChoice)}`,verbChoice.verb,verbChoice.verb,verbChoice.verbReading,gloss,['impossibility'])},'はずがない firmly rules out a possibility as logically impossible.')
  }

  if (patternId === 'n2-37') {
    // Same decoupling as n2-36 — subject from a real pool, verb from an
    // independently-seeded small pool, instead of correlated {subject,clause}
    // pairs that would break the single-segment invariant on rotation.
    const subject = pick(humans, 1571, 'subject')
    const clausePool = [
      { clause:'ドアを開けよう', clauseReading:'どあをあけよう', gloss:'open the door' },
      { clause:'記録を破ろう', clauseReading:'きろくをやぶろう', gloss:'break the record' },
      { clause:'逃げよう', clauseReading:'にげよう', gloss:'run away' },
      { clause:'説明しよう', clauseReading:'せつめいしよう', gloss:'explain' },
    ]
    let clausePickPool = clausePool
    if (options.avoidWords?.verb) { const avoided = clausePickPool.filter(c => c.clause !== options.avoidWords!.verb); if (avoided.length) clausePickPool = avoided }
    const clauseChoice = seededPick(clausePickPool, options.slotSeeds?.verb ?? seed, 1572)
    if (!subject || !clauseChoice) return null
    const subjectEnglish = englishPhrase(subject,'subject')
    const furigana=[wordPart(subject,'subject'),literalPart('は','わ'),{text:clauseChoice.clause,reading:clauseChoice.clauseReading,slot:'verb'},literalPart('としました。')]
    return finish(furigana,`${capitalize(subjectEnglish)} tried to ${clauseChoice.gloss}.`,{subject},{verb:grammarSlot(`n2-37-verb-${clausePool.indexOf(clauseChoice)}`,clauseChoice.clause,clauseChoice.clause,clauseChoice.clauseReading,clauseChoice.gloss,['attempt'])},'volitional + とする means to attempt or be on the verge of doing something.')
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
  options: CategorySentenceOptions = {},
) {
  const withoutAvoided = (pool: WordRecord[], slot: string) => {
    const avoid = options.avoidWords?.[slot]
    if (!avoid) return pool
    const filtered = pool.filter(word => word.japanese !== avoid)
    return filtered.length ? filtered : pool
  }
  if (patternId === 'n4-05' && verb.id === 'okiru-time') {
    const timeRule=verb.slots.time
    const candidates=vocabulary.filter(word=>{
      const tags=tagSet(word)
      return categoryMatch(word,timeRule.categories)
        && [...tags].some(tag=>obligationWakeTimeTags.has(tag))
        && !niIncompatibleTimeWords.has(word.japanese)
        && ![...tags].some(tag=>niIncompatibleTimeTags.has(tag))
    })
    const timePool=withoutAvoided(candidates,'time')
    if (!timePool.length) return false
    result.filled.time=seededPick(timePool,options.slotSeeds?.time??seed,95)
    result.slotTagMatches.time=matchingTags(result.filled.time,timeRule.tags)
  }
  if (patternId === 'n4-06' && verb.id === 'taberu-location') {
    const locationRule=verb.slots.location
    const candidates=vocabulary.filter(word=>{
      const tags=tagSet(word)
      return categoryMatch(word,locationRule.categories) && [...tags].some(tag=>permissionEatingLocationTags.has(tag))
    })
    const locationPool=withoutAvoided(candidates,'location')
    if (!locationPool.length) return false
    result.filled.location=seededPick(locationPool,options.slotSeeds?.location??seed,96)
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
  const subjectPool=withoutAvoided(candidates,'subject')
  if (!subjectPool.length) return false
  result.filled.subject=seededPick(subjectPool,options.slotSeeds?.subject??seed,97)
  result.slotTagMatches.subject=matchingTags(result.filled.subject,subjectRule.tags)
  return true
}

function generateN4Nagara(seed: number,vocabulary: WordRecord[],options: CategorySentenceOptions={}): GeneratedPreviewSentence | null {
  const activityVerb=seededPick(verbs.filter(verb=>['taberu-basic','nomu-basic'].includes(verb.id)),seed,71)
  const mainVerb=seededPick(verbs.filter(verb=>['yomu-basic','miru-basic'].includes(verb.id)),seed,72)
  // 'subject' is shared between both verb fills, so its slot-seed/avoid-word
  // request has to reach both calls; 'object' and 'activityObject' are each
  // owned by one call, so only that one needs the raw options passed through.
  const mainOptions={...options,slotSeeds:{subject:options.slotSeeds?.subject,object:options.slotSeeds?.object},avoidWords:{subject:options.avoidWords?.subject,object:options.avoidWords?.object}}
  const activityOptions={...options,slotSeeds:{subject:options.slotSeeds?.subject,object:options.slotSeeds?.activityObject},avoidWords:{subject:options.avoidWords?.subject,object:options.avoidWords?.activityObject}}
  const mainResult=fillVerbSlots(mainVerb,vocabulary,seed,73,mainOptions)
  const activityResult=fillVerbSlots(activityVerb,vocabulary,seed,83,activityOptions)
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
  const vocabulary=generatorWords()
  if (patternId === 'n4-09') return generateN4Nagara(seed,vocabulary,options)
  // いる/ある (existence) fundamentally don't take these aspectual templates —
  // an inanimate "subject" (really the thing located) has no desire (～たい),
  // and none of ～ている/～た/～なければならない/～てもいい/... read coherently
  // for "there is an X" either. They're kept in `verbs` only for the plain
  // existence patterns (n5-27) that build their own dedicated template.
  let verbPool=verbs.filter(verb=>verb.id!=='yomu-adverb' && verb.id!=='iru-existence' && verb.id!=='aru-existence' && !contextNeedyBareVerbIds.has(verb.id))
  const incompatibleVerbs: Record<string,Set<string>> = {
    'n4-03':new Set(['kirau-basic']),
    // たことがある reports a notable experience the listener might not expect.
    // Everyone has been tired, laughed, cried, and got angry, so claiming any of
    // them as an experience reads as a joke rather than a sentence.
    'n4-08':new Set(['okiru-time','neru-time','nemuru-time','yasumu-time','shiru-basic','kirau-basic',
      'tsukareru-basic','warau-basic','naku-basic','okoru-basic','odoroku-basic','neru-basic','tatsu-basic']),
    // 出発する/驚く are instantaneous — you don't gradually "begin departing" or
    // "begin being surprised" the way you begin an ongoing activity like eating
    // or reading. 断る needs an object (a request, invitation...) that this
    // bare-verb template can't supply, so "begins declining" reads incomplete.
    // 見つける (find), 亡くなる (pass away), and 成功する (succeed) are punctual
    // achievements too — the object/subject reaches the result at one moment,
    // it doesn't gradually "begin" finding, passing away, or succeeding.
    // 到着する (arrive), 失敗する (fail, same reasoning as 成功する above),
    // 決める (decide), 生まれる (be born), 別れる (break up), 消す/つける
    // (flip a switch off/on), 出会う (a chance encounter), and 感動する (an
    // involuntary emotional reaction, like 驚く) are all single-moment events
    // with no natural gradual or repeated-attempt reading either.
    // Deliberately NOT included despite being punctual: 開ける/閉める, 落とす,
    // 壊す, 拾う, 怒る, 知る — each of these has a genuinely natural gradual or
    // repeated-attempt sense in real Japanese ("開け始めた", "怒り始めた",
    // "知り始めた" are all attested, unlike "出発し始めた").
    'n4-10':new Set([
      'okiru-time','tatsu-basic','shuppatsu-suru','odoroku-basic','kotowaru-basic',
      'mitsukeru-basic','wasureru-basic','nakunaru-basic','seikou-suru','touchaku-suru','shippai-suru','kimeru-basic',
      'umareru-basic','wakareru-companion','kesu-basic','tsukeru-basic','deau-companion','kandou-suru',
    ]),
    // 疑う (doubt) is an involuntary mental state — nobody intentionally "wants
    // to" feel suspicious the way ～たい implies deliberate desire.
    'n4-01':new Set(['utagau-basic','nakunaru-basic']),
    // Permission and an ongoing-state frame are the wrong default treatment
    // for death in a standalone learner sentence. n4-06/n4-07 now toggle
    // between the same sentence's affirmative and negative half (see below),
    // so both share the union of what's unnatural in either polarity.
    'n4-02':new Set(['nakunaru-basic']),
    'n4-06':new Set(['nakunaru-basic','okiru-time']),
    'n4-07':new Set(['nakunaru-basic','okiru-time']),
  }
  const excluded=incompatibleVerbs[patternId]
  if (excluded) verbPool=verbPool.filter(verb=>!excluded.has(verb.id))
  if (options.verbId) verbPool=verbPool.filter(verb=>verb.id===options.verbId)
  if (!verbPool.length) return null
  // The verb is chosen here, outside fillVerbSlots, so a 'verb' slot-seed or
  // avoid-word request has to be applied at this pick too — same fix as the
  // base N5 dispatcher above.
  let verbSelectPool=verbPool
  if (options.avoidWords?.verb) {
    const avoided=verbSelectPool.filter(candidate=>candidate.japanese!==options.avoidWords!.verb)
    if (avoided.length) verbSelectPool=avoided
  }
  // A verb-rotation request (slotSeeds.verb set) picks from the WHOLE pool
  // above — but unlike the base N5 dispatcher, this pool isn't already
  // scoped to one sentencePattern (n4-01..10 span every verb, not one
  // template), so a replacement verb usually carries a different slot shape
  // (destination vs. object vs. bare) and changes more than the verb segment,
  // failing the sweep's single-slot check almost every time. Recovering the
  // sentencePattern of the verb this seed would otherwise reproduce (i.e.
  // the one still on screen) and restricting the rotation candidates to that
  // same shape is what the base dispatcher gets for free from its per-
  // pattern verb pool.
  if (options.slotSeeds?.verb !== undefined) {
    const currentVerb = seededPick(verbPool, seed, 62)
    const samePattern = verbSelectPool.filter(candidate => candidate.sentencePattern === currentVerb.sentencePattern)
    if (samePattern.length) verbSelectPool = samePattern
  }
  const verb=seededPick(verbSelectPool,options.slotSeeds?.verb??seed,62)
  const result=fillVerbSlots(verb,vocabulary,seed,63,options)
  if (!result) return null
  const subjectEnglish=englishPhrase(result.filled.subject!,'subject')
  const plural=subjectUsesBaseVerb(subjectEnglish)
  const base=translatedVerb(verb,result.filled,true)
  const copula=subjectEnglish==='I'?'am':plural?'are':'is'
  const copulaPast=subjectEnglish==='I'?'was':plural?'were':'was'
  const n4Forms=n4VerbForms(verb)
  // Several of these grammar points conjugate exactly like a normal verb or
  // い-adjective (たい, ている, 始める) or have a genuine, commonly-taught
  // negative/past counterpart (なければならない, たことがある) — those get a
  // real ending toggle here. n4-03/n4-04 (ました/ません) deliberately don't:
  // they exist specifically to drill one fixed polite tense each, and the
  // base N5 verb dispatcher already rotates through all 8 tense/polarity/
  // register combinations on its own patterns, so toggling these too would
  // just blur what each pattern is meant to isolate.
  type EndingVariant = { form: VerbForm; english: string }
  let endingVariants: EndingVariant[] | null = null
  if (patternId === 'n4-01') {
    endingVariants = ['たいです','たくないです','たかったです','たくなかったです'].map((suffix,i) => ({
      form: appendForm(n4Forms.masuStem, suffix),
      english: [`${plural?'want':'wants'} to ${base}`,`${plural?'do':'does'} not want to ${base}`,`wanted to ${base}`,`did not want to ${base}`][i]!,
    }))
  } else if (patternId === 'n4-02' && !['起きる','行く','置く','忘れる'].includes(verb.japanese)) {
    // These four keep their single fixed English gloss (awake/gone/placed/
    // forgotten) from n4EnglishVerb below — a generic "is/was Xing" formula
    // doesn't fit a resulting-state verb the way it fits an ongoing action.
    endingVariants = ['います','いません','いました','いませんでした'].map((suffix,i) => ({
      form: appendForm(n4Forms.te, suffix),
      english: [`${copula} ${presentParticiple(base)}`,`${copula} not ${presentParticiple(base)}`,`${copulaPast} ${presentParticiple(base)}`,`${copulaPast} not ${presentParticiple(base)}`][i]!,
    }))
  } else if (patternId === 'n4-05') {
    endingVariants = ['なければなりません','なければなりませんでした'].map((suffix,i) => ({
      form: appendForm(n4Forms.aStem, suffix),
      english: [`must ${base}`,`had to ${base}`][i]!,
    }))
  } else if (patternId === 'n4-06' || patternId === 'n4-07') {
    // n4-07 used to be its own hand-duplicated pattern for just the negative
    // half of this same permission/prohibition construction — merged here so
    // the ending toggles between them, same as the べきです/べきではない merge.
    endingVariants = [
      { form: appendForm(n4Forms.te,'もいいです'), english: `may ${base}` },
      { form: appendForm(n4Forms.te,'はいけません'), english: `must not ${base}` },
    ]
  } else if (patternId === 'n4-08') {
    endingVariants = [
      { form: appendForm(n4Forms.ta,'ことがあります'), english: `${plural?'have':'has'} ${pastParticiple(base)}` },
      { form: appendForm(n4Forms.ta,'ことがありません'), english: `${plural?'have':'has'} never ${pastParticiple(base)}` },
    ]
  } else if (patternId === 'n4-10' && verb.id !== 'nemuru-time') {
    // 寝始める keeps its single hand-picked form below (寝る's stem replaces
    // 眠る's for naturalness) rather than joining the general toggle.
    const stem = { japanese:`${n4Forms.masuStem.japanese}始め`, reading:`${n4Forms.masuStem.reading}はじめ` }
    endingVariants = ['ます','ません','ました','ませんでした'].map((suffix,i) => ({
      form: appendForm(stem, suffix),
      english: [`${plural?'begin':'begins'} ${presentParticiple(base)}`,`${plural?'do':'does'} not begin ${presentParticiple(base)}`,`began ${presentParticiple(base)}`,`did not begin ${presentParticiple(base)}`][i]!,
    }))
  }
  let endingIndex = 0
  let form: VerbForm | null
  let englishOverride: string | undefined
  if (endingVariants) {
    endingIndex = options.slotSeeds?.ending !== undefined ? Math.abs(options.slotSeeds.ending) % endingVariants.length : (patternId === 'n4-07' ? 1 : 0)
    if (options.avoidWords?.ending && endingVariants[endingIndex]!.form.japanese === options.avoidWords.ending) {
      endingIndex = (endingIndex + 1) % endingVariants.length
    }
    form = endingVariants[endingIndex]!.form
    englishOverride = endingVariants[endingIndex]!.english
  } else {
    form = n4SurfaceForm(patternId,verb)
  }
  if (!form) return null
  if (!alignN4CrossSlotContext(patternId,verb,vocabulary,result,seed,options)) return null
  // The eating-prohibition idiom (must not eat AT a place, no specific food
  // named) only applies to the negative half now that n4-06/n4-07 are one
  // toggleable pattern — "may eat sushi at a restaurant" (the affirmative
  // half) still wants its object.
  const objectlessEatingProhibition=(patternId==='n4-06'||patternId==='n4-07') && verb.id==='taberu-location' && endingIndex===1
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
  if (endingVariants) {
    slots.ending={id:`ending-${patternId}-${endingIndex}`,surface:form.japanese,dictionaryForm:verb.japanese,reading:form.reading,english:englishOverride!,pos:'verb',jlpt:'N5',tags:['ending'],conjugation:patternId}
  }
  let english=objectlessEatingProhibition
    ? `${englishPhrase(result.filled.subject!,'subject')} must not eat ${englishPhrase(result.filled.location!,'location')}.`
    : renderTranslation(verb.translationTemplate,verb,result.filled,englishOverride ?? n4EnglishVerb(patternId,verb,result.filled))
  english=english.charAt(0).toUpperCase()+english.slice(1)
  if (patternId === 'n4-08') english=english.replace(/\.$/,' before.')
  return {
    frameId:patternId,level:'N4',japanese:furigana.map(part=>part.text).join(''),reading:furigana.map(part=>part.reading||part.text).join(''),english,slots,furigana,
    grammar:[{pattern:patternId,meaning:n4PatternMeanings[patternId]!,jlpt:'N4'}],
    validation:[`Verb selected first: ${verb.japanese}.`,`Verb supplied base frame: ${verb.sentencePattern.toUpperCase()}.`,`Slots matched the verb's category and semantic-tag rules.`,objectlessEatingProhibition?'Omitted the food object so the prohibition applies to eating at the location.':`Applied executable N4 grammar: ${patternId.toUpperCase()}.`],
  }
}

export function generateCategorySentence(seed: number, requestedPatternId?: string, level: 'N5'|'N4'|'N3'|'N2'|'N1'='N5',options: CategorySentenceOptions={}): GeneratedPreviewSentence | null {
  if (requestedPatternId && advancedPatternIds.has(requestedPatternId)) return generateAdvancedCategorySentence(seed,requestedPatternId,options)
  if (level==='N2'||level==='N1') return null
  if (level==='N3'||requestedPatternId?.startsWith('n3-')) return requestedPatternId?enforceRequiredWord(generateN3CategorySentence(seed,requestedPatternId,options),options):null
  if (requestedPatternId && additionalN4PatternIds.has(requestedPatternId)) return enforceRequiredWord(additionalN4Sentence(seed,requestedPatternId,options),options)
  if (level === 'N4' || requestedPatternId?.startsWith('n4-')) return enforceRequiredWord(generateN4CategorySentence(seed,requestedPatternId,options),options)
  if (requestedPatternId && additionalN5PatternIds.has(requestedPatternId)) return enforceRequiredWord(additionalN5Sentence(seed,requestedPatternId,options),options)
  // A requested pattern limits the eligible records, but the executable unit is
  // still the verb: once chosen, its own pattern and slot rules drive the rest.
  let verbPool = requestedPatternId ? verbs.filter(verb => verb.sentencePattern === requestedPatternId && !contextNeedyBareVerbIds.has(verb.id)) : verbs.filter(verb=>!contextNeedyBareVerbIds.has(verb.id))
  // A required word can be the verb itself rather than one of its slot fillers.
  // Narrowing the verb pool satisfies the requirement here, so the slot filler
  // below must not also demand it — hence `slotOptions` drops requiredWord.
  const requiredWordIsVerb = Boolean(options.requiredWord) && verbPool.some(verb => verb.japanese === options.requiredWord)
  if (requiredWordIsVerb) verbPool = verbPool.filter(verb => verb.japanese === options.requiredWord)
  const slotOptions = requiredWordIsVerb ? { ...options, requiredWord: undefined } : options
  if (!verbPool.length) return null
  // The verb itself is chosen here, outside fillVerbSlots, so a slot-seed or
  // avoid-word request for 'verb' has to be applied at this pick too — without
  // it, re-seeding options.slotSeeds.verb has no effect and rotation can never
  // change the verb, only the words filling its slots.
  let verbSelectPool = verbPool
  if (options.avoidWords?.verb) {
    const avoided = verbSelectPool.filter(candidate => candidate.japanese !== options.avoidWords!.verb)
    if (avoided.length) verbSelectPool = avoided
  }
  const verb = options.verbId
    ? verbPool.find(candidate => candidate.id === options.verbId)
    : seededPick(verbSelectPool, options.slotSeeds?.verb ?? seed, 1)
  if (!verb) return null
  const vocabulary = generatorWords()
  const result = fillVerbSlots(verb,vocabulary,seed,2,slotOptions)
  if (!result) return null
  const { filled,slotTagMatches } = result
  // Every declared slot is mandatory, so a plain subject+object sentence is
  // always exactly that — no time, no manner, nothing optional. This is the
  // single biggest source of "random person + random action" flatness at the
  // most common sentence shape. Adding a bare relative-time adjunct roughly
  // 40% of the time (毎日, 今日, 明日, ...) gives real variety without
  // touching every verb record: the decision is seeded off the sentence's own
  // seed at a salt no other slot uses, so it's stable across an entire
  // rotation sweep — a sentence either has the adjunct for its whole sweep or
  // never does, which is what keeps the single-slot-neighbor invariant intact
  // (see isSingleSlotNeighbor) instead of the segment layout shifting
  // mid-sweep. Scoped to n5-01 (subject+object+verb) for now, the highest-
  // volume shape and the easiest one to extend safely.
  if (verb.sentencePattern === 'n5-01' && Math.abs(seed + 7001) % 5 < 2) {
    let adjunctTimePool = vocabulary.filter(word => word.categories.includes('Time') && niIncompatibleTimeWords.has(word.japanese))
    if (options.avoidWords?.time) {
      const avoided = adjunctTimePool.filter(word => word.japanese !== options.avoidWords!.time)
      if (avoided.length) adjunctTimePool = avoided
    }
    const time = adjunctTimePool.length ? seededPick(adjunctTimePool, options.slotSeeds?.time ?? seed, 7002) : null
    if (time) { filled.time = time; slotTagMatches.time = [] }
  }
  // The ending toggles the SAME verb through 8 forms — tense × polarity ×
  // register (polite/plain) — while subject, object, and verb choice stay
  // identical, so this always yields a genuine one-segment change (です ⟷
  // ではありません is the copula's version of this same swap). Two forms can
  // share an English gloss (食べます/食べる are both just "eats") — that's a
  // real, valid rotation of register alone, not a no-op; only the Japanese
  // text has to differ. An explicit 'ending' request always wins; otherwise
  // default to index 0 (polite affirmative non-past) so every caller that
  // doesn't ask for this stays byte-identical to before.
  const verbForms=n4VerbForms(verb)
  // ある looks like a regular godan-る verb everywhere else (て-form あって,
  // た-form あった are both regular), but its plain negative is a suppletive
  // irregular ない/なかった — not the regular あ-stem+ない that produces the
  // ungrammatical あらない/あらなかった.
  const isAru = verb.id === 'aru-existence'
  const endingVariants=[
    { form:conjugate(verb), tense:'nonpast', polarity:'affirmative' as const },
    { form:appendForm(verbForms.masuStem,'ません'), tense:'nonpast', polarity:'negative' as const },
    { form:appendForm(verbForms.masuStem,'ました'), tense:'past', polarity:'affirmative' as const },
    { form:appendForm(verbForms.masuStem,'ませんでした'), tense:'past', polarity:'negative' as const },
    { form:{japanese:verb.japanese,reading:verb.reading}, tense:'nonpast', polarity:'affirmative' as const },
    { form:isAru ? {japanese:'ない',reading:'ない'} : appendForm(verbForms.aStem,'ない'), tense:'nonpast', polarity:'negative' as const },
    { form:verbForms.ta, tense:'past', polarity:'affirmative' as const },
    { form:isAru ? {japanese:'なかった',reading:'なかった'} : appendForm(verbForms.aStem,'なかった'), tense:'past', polarity:'negative' as const },
  ]
  let endingIndex = options.slotSeeds?.ending !== undefined ? Math.abs(options.slotSeeds.ending) % endingVariants.length : 0
  if (options.avoidWords?.ending && endingVariants[endingIndex]!.form.japanese === options.avoidWords.ending) {
    // Step to the next distinct form deterministically rather than re-rolling —
    // guarantees a change on the first retry instead of hoping a second random
    // index misses the one we're avoiding.
    endingIndex = (endingIndex + 1) % endingVariants.length
  }
  const chosenEnding = endingVariants[endingIndex]!
  const polite = chosenEnding.form
  const isNegativeEnding = chosenEnding.polarity === 'negative'
  const isPastEnding = chosenEnding.tense === 'past'
  const furigana = baseFurigana(verb,filled,polite)
  if (!furigana) return null
  const japanese=furigana.map(part=>part.text).join('')
  const reading=furigana.map(part=>part.reading || part.text).join('')
  const slots: GeneratedPreviewSentence['slots'] = Object.fromEntries(Object.entries(filled).map(([name,word]) => [name,{ id:word.id, surface:word.japanese, dictionaryForm:word.japanese, reading:word.reading, english:word.preferredTranslation, pos:name==='subject'||name==='companion'?'pronoun':name==='time'||name==='adverb'?'time_expression':name==='destination'||name==='location'?'place_expression':'noun', jlpt:word.jlpt ?? 'N5', tags:[`category:${word.categories.join('|')}`,...word.tags,...slotTagMatches[name].map(tag=>`matched:${tag}`)] }]))
  const conjugationLabel=`${chosenEnding.tense}-${chosenEnding.polarity}`
  slots.verb = { id:`verb-${verb.id}`, surface:polite.japanese, dictionaryForm:verb.japanese, reading:polite.reading, english:verb.english, pos:'verb', jlpt:'N5', tags:[...verb.tags,`pattern:${verb.sentencePattern}`,`forms:${verb.supportedGrammarForms.join('|')}`], conjugation:conjugationLabel }
  // A distinct 'ending' key (alongside 'verb') is what makes the hero rotator
  // try toggling the ending in addition to swapping the verb word —
  // Object.keys(sentence.slots) is what it reads to decide which slots are
  // worth a rotation attempt. The furigana segment itself is still keyed
  // 'verb', so the resulting text change is correctly reported against that
  // segment either way.
  slots.ending = { id:`ending-${conjugationLabel}`, surface:polite.japanese, dictionaryForm:verb.japanese, reading:polite.reading, english:conjugationLabel, pos:'verb', jlpt:'N5', tags:['ending'], conjugation:conjugationLabel }
  const semanticChecks = Object.entries(slotTagMatches).filter(([,tags])=>tags.length).map(([slot,tags])=>`${slot}: ${tags.join(', ')}`)
  const subjectEnglish=englishPhrase(filled.subject,'subject')
  // Two verb families render as a copula in English rather than an action verb:
  // いる/ある give the bare word "are"/"is" (see translatedVerb), and 感動する
  // and friends store a "be X" phrase so modal frames can say "must be moved".
  // Both need "is/are not[ X]"/"was/were[ not][ X]", not "does not are"/
  // "does not be moved".
  const baseVerbEnglish=translatedVerb(verb,filled,true)
  const copula=subjectEnglish==='I'?'am':subjectUsesBaseVerb(subjectEnglish)?'are':'is'
  // "I" is the one subject where past "be" is "was", not "were", despite
  // otherwise pairing with base-form present tense ("I eat", but "I was").
  const copulaPast=subjectEnglish==='I'?'was':subjectUsesBaseVerb(subjectEnglish)?'were':'was'
  const bareCopulaPhrase=/^be\b(.*)$/.exec(baseVerbEnglish)
  const isBareCopula=['is','are','am'].includes(baseVerbEnglish)
  const verbOverride = isPastEnding
    ? (isNegativeEnding
      ? (isBareCopula ? `${copulaPast} not` : bareCopulaPhrase ? `${copulaPast} not${bareCopulaPhrase[1]}` : `did not ${baseVerbEnglish}`)
      : (isBareCopula ? copulaPast : simplePast(baseVerbEnglish)))
    : (isNegativeEnding
      ? (isBareCopula ? `${copula} not` : bareCopulaPhrase ? `${copula} not${bareCopulaPhrase[1]}` : `${subjectUsesBaseVerb(subjectEnglish)?'do':'does'} not ${baseVerbEnglish}`)
      : undefined)
  const renderedEnglish=renderTranslation(verb.translationTemplate,verb,filled,verbOverride)
  // Only n5-01 adds an optional fronted time adjunct. In time-governed frames
  // such as Subject は Time に 起きる, {Time} is already in the template.
  const timeAdjunctEnglish=verb.sentencePattern === 'n5-01' && filled.time
    ? frontedTimeAdjunctEnglish[filled.time.japanese] ?? englishPhrase(filled.time,'time')
    : null
  const english=timeAdjunctEnglish
    ? `${timeAdjunctEnglish.charAt(0).toUpperCase()}${timeAdjunctEnglish.slice(1)}, ${renderedEnglish.charAt(0).toLowerCase()}${renderedEnglish.slice(1)}`
    : renderedEnglish.charAt(0).toUpperCase()+renderedEnglish.slice(1)
  return { frameId:verb.sentencePattern, level:'N5', japanese, reading, english, slots, furigana, grammar:[{pattern:verb.sentencePattern,meaning:'Verb-selected category and tag pattern',jlpt:'N5'}], validation:[`Verb selected first: ${verb.japanese}.`,`Verb selected pattern: ${verb.sentencePattern.toUpperCase()}.`,`Slots matched allowed categories${semanticChecks.length ? ` and semantic tags (${semanticChecks.join('; ')})` : ''}.`,`Supported forms: ${verb.supportedGrammarForms.join(', ')}.`] }
}

/**
 * Patterns worth trying when building an example sentence for one specific
 * word. Ordered cheapest-first: the base verb path honours `requiredWord`
 * directly, while the rest are scanned because their generators pick their own
 * slot fillers. Advanced (N2/N1) patterns are excluded — they use fixed curated
 * phrasing rather than open vocabulary slots, so they can't feature an
 * arbitrary word.
 */
const WORD_EXAMPLE_PATTERN_IDS = [
  ...additionalN5PatternIds,
  ...Object.keys(n4PatternMeanings),
  ...additionalN4PatternIds,
]

// Low on purpose: now that `requiredWord` reaches each generator's slot picker,
// a pattern that can host the word succeeds on the first attempt or two. Extra
// attempts mostly add cost to words that fit nowhere, which is the slow case.
const SEEDS_PER_PATTERN = 3

/**
 * Builds one example sentence that actually contains `word`, using the same
 * generator — and therefore the same word-compatibility rules — as ordinary
 * practice sentences. Returns null when no pattern can accommodate the word,
 * which is the correct answer for particles, interjections, and words whose
 * category has no matching slot anywhere.
 */
export function generateSentenceForWord(word: string, seed = 1): GeneratedPreviewSentence | null {
  // Scanning every pattern for a word that clears no slot's category/tag gate
  // costs seconds and can only ever fail, so rule that out with a lookup.
  if (!slotEligibleWords().has(word)) return null

  const direct = (() => {
    for (let attempt = 0; attempt < SEEDS_PER_PATTERN; attempt += 1) {
      const sentence = generateCategorySentence(seed + attempt, undefined, 'N5', { requiredWord: word })
      if (sentence) return sentence
    }
    return null
  })()
  if (direct) return direct

  for (const patternId of WORD_EXAMPLE_PATTERN_IDS) {
    for (let attempt = 0; attempt < SEEDS_PER_PATTERN; attempt += 1) {
      const candidateSeed = seed + attempt * 37
      const level = patternId.startsWith('n4-') ? 'N4' : 'N5'
      const sentence = generateCategorySentence(candidateSeed, patternId, level, { requiredWord: word })
      if (sentence) return sentence
    }
  }
  return null
}
