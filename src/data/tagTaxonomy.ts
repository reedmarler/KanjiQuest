import type { CategoryWordRecord, SentenceCategory } from '../lib/categorySentenceEngine'
import { IMPORTED_TAGS_BY_CATEGORY } from './vocabularyMetadata.generated'
import { getVocabularyMetadata } from './vocabularySenseOverrides'

export const TAG_GROUPS = [
  { name:'People & Living Things', tags:['Person','Man','Woman','Boy','Girl','Baby','Child','Teenager','Adult','Elderly','Family','Mother','Father','Brother','Sister','Grandparent','Grandchild','Relative','Friend','Classmate','Coworker','Neighbor','Customer','Boss','Employee','Occupation','Teacher','Student','Doctor','Nurse','Police','Firefighter','Lawyer','Engineer','Programmer','Artist','Writer','Musician','Chef','Farmer','Cashier','Driver','Athlete','Animal','Pet','Dog','Cat','Bird','Fish','Horse','Cow','Pig','Chicken','Rabbit','Bear','Lion','Tiger','Elephant','Monkey','Snake','Insect','Plant','Tree','Flower','Grass','Bush','FruitTree','VegetablePlant','Crop','Human','Living','Animate','Male','Female','Wild','Domestic'] },
  { name:'Places', tags:['Country','City','Town','Village','Neighborhood','Building','House','Apartment','School','University','Office','Store','Restaurant','Cafe','Hospital','Hotel','Library','Museum','Temple','Shrine','Church','Bank','Station','Airport','Room','Kitchen','Bathroom','Bedroom','LivingRoom','Classroom','OfficeRoom','Nature','Park','Forest','Mountain','River','Lake','Beach','Ocean','Island','Transportation','Platform','ParkingLot','Road','Bridge','Intersection','Indoor','Outdoor','Destination','Origin','Location','Public','Private'] },
  { name:'Objects', tags:['Book','Document','Paper','Notebook','Magazine','Newspaper','Electronics','Computer','Laptop','Phone','Tablet','Camera','TV','GameConsole','Furniture','Chair','Table','Desk','Bed','Sofa','Shelf','Cabinet','Tool','Knife','Hammer','Screwdriver','Scissors','Pen','Pencil','Brush','Vehicle','Car','Bus','Train','Bicycle','Motorcycle','Airplane','Ship','Container','Bottle','Cup','Glass','Box','Bag','Wallet','Clothing','Shirt','Pants','Shoes','Hat','Coat','Dress','Gloves','Accessory','Watch','Ring','Necklace','Glasses','Backpack','OfficeSupply','Kitchenware','Toy','Machine','Instrument','Weapon','BodyPart','Blood','Anatomy','Portable','Heavy','Light','Fragile','Electronic','Mechanical'] },
  { name:'Food & Drink', tags:['Fruit','Vegetable','Meat','Seafood','Fish','Rice','Bread','Noodles','Soup','Dessert','Snack','Candy','IceCream','Drink','Water','Tea','Coffee','Juice','Soda','Alcohol','Ingredient','Spice','Sauce','Oil','Sugar','Salt','Breakfast','Lunch','Dinner','Healthy','Unhealthy','Sweet','Salty','Spicy','Sour','Bitter','Hot','Cold','Edible','Drinkable','Perishable'] },
  { name:'Actions', tags:['Movement','Walking','Running','Driving','Flying','Swimming','Communication','Speaking','Listening','Reading','Writing','Calling','Texting','Learning','Studying','Teaching','Practicing','Remembering','Work','Working','Meeting','Planning','Building','Household','Cooking','Cleaning','Laundry','Shopping','Exercise','Sports','Gaming','Music','Drawing','Travel','Buying','Selling','Giving','Receiving','Helping','Searching','Waiting','Sleeping','Eating','Drinking','Thinking','Feeling','Choosing','Using','Creating','Destroying','Verb','SuruVerb','MotionVerb','MentalVerb','CommunicationVerb','PerceptionVerb','Transitive','Intransitive','Ichidan','Godan','Irregular'] },
  { name:'Descriptors', tags:['Color','Size','Shape','Weight','Length','Height','Width','Temperature','Hot','Cold','Warm','Cool','Speed','Fast','Slow','Quality','Good','Bad','Beautiful','Ugly','Clean','Dirty','Emotion','Happy','Sad','Angry','Afraid','Excited','Calm','Tired','Hungry','Busy','Age','Old','New','Young','Quantity','Many','Few','Some','All','None','Difficulty','Easy','Hard','Importance','Necessary','Optional','Positive','Negative','iAdjective','naAdjective','Adverb'] },
  { name:'Time & Numbers', tags:['Time','Morning','Afternoon','Evening','Night','Today','Yesterday','Tomorrow','Past','Present','Future','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Spring','Summer','Autumn','Winter','Year','Month','Week','Day','Hour','Minute','Second','Number','Counter','Measurement','Money','Currency','Percent','Frequency','Daily','Weekly','Monthly','Yearly','Duration','Deadline','Schedule','Age','Date'] },
  { name:'Function Words', tags:['Particle','Pronoun','Conjunction','Interjection','AuxiliaryVerb','Expression','TopicMarker','SubjectMarker','ObjectMarker','DirectionMarker','LocationMarker','QuotationMarker','PossessionMarker','QuestionWord','Demonstrative','PoliteExpression','Greeting','Farewell','Apology','Thanks','Agreement','Disagreement','Confirmation','Formal','Casual'] },
] as const

export const UNIVERSAL_TAGS = ['N5','N4','N3','N2','N1','Common','VeryCommon','Rare','Casual','Polite','Formal','DailyLife','School','Business','Travel','Technology','Health','Shopping','Family','Abstract','Concrete','Loanword','NativeJapanese','SinoJapanese'] as const

export type TagGroupName = typeof TAG_GROUPS[number]['name']

const aliases: Record<string,string> = {
  friends:'friend', families:'family', people:'person', persons:'person', men:'man', women:'woman', boys:'boy', girls:'girl', children:'child', kids:'child',
  teachers:'teacher', students:'student', doctors:'doctor', nurses:'nurse', animals:'animal', pets:'pet', dogs:'dog', cats:'cat', birds:'bird', fishes:'fish', insects:'insect',
  fruits:'fruit', vegetables:'vegetable', veggies:'vegetable', desserts:'dessert', candies:'candy', sweets:'sweet', snacks:'snack', drinks:'drink', beverages:'drink',
  buildings:'building', houses:'house', apartments:'apartment', schools:'school', offices:'office', stores:'store', restaurants:'restaurant', stations:'station', rooms:'room',
  books:'book', documents:'document', computers:'computer', phones:'phone', vehicles:'vehicle', cars:'car', tools:'tool', clothes:'clothing', garments:'clothing',
  verbs:'verb', adjectives:'i-adjective', adverbs:'adverb', particles:'particle', pronouns:'pronoun', expressions:'expression', counters:'counter',
  iadjective:'i-adjective', naadjective:'na-adjective', suruverb:'suru-verb', motionverb:'motion-verb', communicationverb:'communication-verb', perceptionverb:'perception-verb', mentalverb:'mental-verb', auxiliaryverb:'auxiliary-verb',
}

const CUSTOM_TAGS_KEY = 'kanji-quest-custom-tag-groups-v2'
const WORD_TAG_GROUP_KEY = 'kanji-quest-word-tag-groups-v2'

function cleanTag(value: string) {
  return value.trim().replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase().replace(/[_\s]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')
}

const removedTags = new Set(['can-be-subject','can-be-object','can-be-location','can-be-destination','can-be-recipient'])

const tagLabels = new Map<string,string>()
for (const tag of [...TAG_GROUPS.flatMap(group=>[...group.tags]),...Object.values(IMPORTED_TAGS_BY_CATEGORY).flatMap(tags=>[...tags]),...UNIVERSAL_TAGS]) tagLabels.set(cleanTag(tag),tag)

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { const stored=window.localStorage.getItem(key); return stored ? JSON.parse(stored) as T : fallback } catch { return fallback }
}

export function normalizeTag(value: string) {
  const cleaned=cleanTag(value)
  if (!cleaned) return ''
  return aliases[cleaned] ?? (cleaned.endsWith('s') && tagLabels.has(cleaned.slice(0,-1)) ? cleaned.slice(0,-1) : cleaned)
}

export function normalizeTags(tags: string[]) {
  return [...new Set(tags.map(normalizeTag).filter(tag=>tag && !removedTags.has(tag)))]
}

export function formatTagLabel(tag: string) {
  return tagLabels.get(normalizeTag(tag)) ?? tag.split('-').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ')
}

export function getTagGroupTags(groupName: TagGroupName) {
  const base=TAG_GROUPS.find(group=>group.name===groupName)?.tags ?? []
  const imported=IMPORTED_TAGS_BY_CATEGORY[groupName] ?? []
  const custom=loadJson<Partial<Record<TagGroupName,string[]>>>(CUSTOM_TAGS_KEY,{})[groupName] ?? []
  return normalizeTags([...base,...imported,...custom])
}

export function getUniversalTags() { return normalizeTags([...UNIVERSAL_TAGS]) }

export function addTagToGroup(groupName: TagGroupName, tag: string) {
  if (typeof window === 'undefined') return ''
  const normalized=normalizeTag(tag)
  if (!normalized) return ''
  const custom=loadJson<Partial<Record<TagGroupName,string[]>>>(CUSTOM_TAGS_KEY,{})
  custom[groupName]=normalizeTags([...(custom[groupName] ?? []),normalized])
  window.localStorage.setItem(CUSTOM_TAGS_KEY,JSON.stringify(custom))
  if (!tagLabels.has(normalized)) tagLabels.set(normalized,formatTagLabel(normalized))
  return normalized
}

const legacyCategoryToGroup: Record<SentenceCategory,TagGroupName> = {
  Person:'People & Living Things',Animal:'People & Living Things',Plant:'People & Living Things',
  Place:'Places',Building:'Places',Room:'Places',
  Object:'Objects',Tool:'Objects',Technology:'Objects',Vehicle:'Objects',Clothing:'Objects',Furniture:'Objects',Book:'Objects',Document:'Objects',Media:'Objects',
  Food:'Food & Drink',Drink:'Food & Drink',Medicine:'Food & Drink',
  Activity:'Actions',Event:'Actions',
  Emotion:'Descriptors',Weather:'Descriptors',Adverb:'Descriptors',
  Time:'Time & Numbers',Number:'Time & Numbers',Money:'Time & Numbers',
  Language:'Function Words',
}

export function inferTagGroup(word: CategoryWordRecord): TagGroupName {
  if (word.tags.some(tag=>['body-part','blood','anatomy'].includes(normalizeTag(tag)))) return 'Objects'
  if (word.tags.includes('verb') || /^to\s+/i.test(word.english)) return 'Actions'
  if (word.tags.some(tag=>['adjective','i-adjective','na-adjective','adverb'].includes(tag))) return 'Descriptors'
  if (word.tags.some(tag=>['particle','pronoun','conjunction','interjection','auxiliary-verb','expression'].includes(tag))) return 'Function Words'
  return legacyCategoryToGroup[word.categories[0]]
}

export function getWordTagGroup(word: CategoryWordRecord): TagGroupName {
  const saved=loadJson<Record<string,TagGroupName>>(WORD_TAG_GROUP_KEY,{})[word.id]
  if (TAG_GROUPS.some(group=>group.name===saved)) return saved
  const imported=getVocabularyMetadata(word.japanese,word.reading)
  if (imported?.tags.some(tag=>['body-part','blood','anatomy'].includes(normalizeTag(tag)))) return 'Objects'
  return imported ? imported.category : inferTagGroup(word)
}

export function saveWordTagGroup(wordId: string, groupName: TagGroupName) {
  if (typeof window === 'undefined') return
  const groups=loadJson<Record<string,TagGroupName>>(WORD_TAG_GROUP_KEY,{})
  groups[wordId]=groupName
  window.localStorage.setItem(WORD_TAG_GROUP_KEY,JSON.stringify(groups))
}

export function suggestedTagsForWord(word: CategoryWordRecord, groupName: TagGroupName) {
  const meaning=word.english.toLowerCase()
  const categoryTags=getTagGroupTags(groupName)
  const universal=getUniversalTags()
  const available=[...categoryTags,...universal]
  const existing=word.tags.filter(tag=>available.includes(normalizeTag(tag)))
  const direct=available.filter(tag=>meaning.includes(formatTagLabel(tag).replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase()))
  const defaults=categoryTags.slice(0,6)
  return normalizeTags([...existing,...direct,...defaults,...universal.filter(tag=>word.tags.includes(tag))]).slice(0,18)
}
