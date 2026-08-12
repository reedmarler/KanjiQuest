import type { StudyCard } from './types'
import type { SentenceCategory } from './categorySentenceEngine'
import { normalizeTags } from '../data/tagTaxonomy'
import type { ImportedVocabularyCategory } from '../data/vocabularyMetadata.generated'
import { getVocabularyMetadata } from '../data/vocabularySenseOverrides'

export interface VocabularyClassification {
  category: SentenceCategory
  tags: string[]
  confidence: 'high' | 'medium' | 'fallback'
}

const importedCategoryMap: Record<ImportedVocabularyCategory,SentenceCategory> = {
  'People & Living Things':'Person',
  'Places':'Place',
  'Objects':'Object',
  'Food & Drink':'Food',
  'Actions':'Activity',
  'Descriptors':'Adverb',
  'Time & Numbers':'Time',
  'Function Words':'Language',
}

const tests: Array<{ category: SentenceCategory; pattern: RegExp; tags?: string[] }> = [
  { category:'Person', pattern:/\b(person|people|man|woman|boy|girl|child|baby|student|teacher|doctor|nurse|friend|mother|father|parent|brother|sister|son|daughter|husband|wife|family|employee|worker|customer|guest|president|manager|police|officer|member|citizen|human|he|she|boyfriend|girlfriend)\b/, tags:['person'] },
  { category:'Animal', pattern:/\b(animal|dog|cat|bird|fish|horse|cow|pig|rabbit|mouse|monkey|insect|bug|butterfly|bee|snake|frog|chicken|duck|pet)\b/, tags:['animal'] },
  { category:'Plant', pattern:/\b(plant|tree|flower|grass|leaf|leaves|forest|wood|bamboo|seed)\b/, tags:['plant'] },
  { category:'Drink', pattern:/\b(drink|beverage|water|tea|coffee|juice|milk|beer|wine|alcohol|sake)\b/, tags:['drink'] },
  { category:'Food', pattern:/\b(food|meal|breakfast|lunch|dinner|rice|bread|noodle|ramen|soba|udon|meat|beef|pork|chicken|fish|seafood|sushi|egg|fruit|apple|orange|banana|vegetable|potato|tomato|cake|candy|sweet|dessert|snack|ingredient|salt|sugar|spice|soup|ice cream|icecream|yogurt|yoghurt|chocolate|pudding)\b/, tags:[] },
  { category:'Medicine', pattern:/\b(medicine|medication|drug|pill|tablet|prescription|treatment|remedy)\b/, tags:['health'] },
  { category:'Vehicle', pattern:/\b(vehicle|car|automobile|bus|train|subway|bicycle|bike|motorcycle|taxi|truck|airplane|plane|ship|boat)\b/, tags:['vehicle'] },
  { category:'Building', pattern:/\b(building|house|home|school|university|office|store|shop|restaurant|hospital|station|airport|hotel|library|bank|factory|temple|shrine|church|museum|theater|theatre)\b/, tags:['building'] },
  { category:'Room', pattern:/\b(room|classroom|bedroom|kitchen|bathroom|toilet|hall|entrance|lobby)\b/, tags:['room'] },
  { category:'Place', pattern:/\b(place|country|city|town|village|park|garden|beach|mountain|river|sea|ocean|lake|road|street|intersection|area|region|world|japan|tokyo|outside|indoors|outdoors)\b/, tags:[] },
  { category:'Clothing', pattern:/\b(clothes|clothing|shirt|coat|jacket|dress|skirt|pants|trousers|shoe|shoes|sock|socks|hat|cap|glove|uniform|kimono|sweater|accessory)\b/, tags:['clothing'] },
  { category:'Furniture', pattern:/\b(furniture|chair|table|desk|bed|sofa|shelf|cabinet|drawer)\b/, tags:['furniture'] },
  { category:'Technology', pattern:/\b(technology|computer|phone|telephone|smartphone|internet|website|software|machine|electronic|camera|radio|television|tv)\b/, tags:['electronics'] },
  { category:'Tool', pattern:/\b(tool|knife|scissors|hammer|key|pen|pencil|brush|instrument|equipment|weapon|gun|sword)\b/, tags:['tool'] },
  { category:'Book', pattern:/\b(book|novel|dictionary|textbook|magazine|comic)\b/, tags:['book'] },
  { category:'Document', pattern:/\b(document|paper|letter|newspaper|report|form|ticket|passport|card|certificate|record|map|menu)\b/, tags:['document'] },
  { category:'Media', pattern:/\b(movie|film|music|song|video|anime|program|show|news|media|photograph|photo|picture)\b/, tags:[] },
  { category:'Time', pattern:/\b(time|day|week|month|year|morning|afternoon|evening|night|today|tomorrow|yesterday|hour|minute|second|holiday|season|spring|summer|autumn|fall|winter|now|later|early|late)\b/, tags:[] },
  { category:'Weather', pattern:/\b(weather|rain|snow|wind|cloud|sunny|cloudy|storm|typhoon|temperature|hot weather|cold weather)\b/, tags:[] },
  { category:'Emotion', pattern:/\b(emotion|feeling|happy|sad|angry|excited|calm|tired|hungry|busy|healthy|sick|afraid|scared|lonely|glad|worried|pain|love|hate|dislike)\b/, tags:[] },
  { category:'Activity', pattern:/\b(activity|movement|reading|writing|cooking|cleaning|shopping|studying|study|working|work|sleeping|playing|traveling|travel|exercise|practice|game)\b/, tags:[] },
  { category:'Event', pattern:/\b(event|festival|party|meeting|ceremony|wedding|funeral|concert|competition|exam|test|accident|war|holiday)\b/, tags:[] },
  { category:'Money', pattern:/\b(money|yen|dollar|currency|price|cost|fee|cash|payment|salary|income|banking)\b/, tags:['currency'] },
  { category:'Number', pattern:/\b(number|amount|quantity|count|counter|first|second|third|half|double|hundred|thousand|million|length|weight|volume|meter|kilogram|degree|percent)\b/, tags:['number'] },
  { category:'Language', pattern:/\b(language|japanese|english|word|vocabulary|grammar|sentence|meaning|name|kanji|hiragana|katakana|character|pronunciation|translation)\b/, tags:[] },
]

// Liquids are drunk; the solid tags win when a word carries both, so ice cream
// and yogurt stay eatable.
const drinkTags = ['drink','drinkable','beverage','water','tea','coffee','juice','soda','alcohol','milk','dairy']
const solidFoodTags = ['dessert','snack','candy','ice-cream','yogurt','cheese','butter','fruit','vegetable','meat','seafood','fish','rice','bread','noodles','egg','protein','staple-food','meal','grain']

/**
 * Splits a coarse imported category using the word's own tags.
 *
 * The imported taxonomy has only eight buckets, but the generator distinguishes
 * 27 categories, so everything imported collapsed into Person/Place/Object/
 * Food/Activity/Adverb/Time/Language and *fourteen* categories held zero words.
 * Verb slots that ask for those categories then had nothing to draw from, and a
 * slot with no candidates makes its whole verb ungeneratable: 書く, 洗う, 着る,
 * 脱ぐ, 履く, かぶる, 消す, 点ける, 調べる, 建てる, 育てる, 伝える, 直す, 止める,
 * 座る and 出る had never produced a sentence between them.
 *
 * The tags needed to undo the collapse are already on the words — the imported
 * taxonomy tags 服 as `clothing` and 車 as `vehicle`, it just files both under
 * "Objects". So this reads the tag back out and restores the finer category,
 * which is the same move the Food/Drink bucket already needed so that milk is
 * never eaten.
 *
 * Ordered most specific first; the first matching rule wins. Both places that
 * widen an imported category into a SentenceCategory route through here so the
 * two cannot drift apart.
 */
// `unless` guards a refinement against words that are *about* the finer
// category without belonging to it. 獣医 ("veterinarian") is tagged `animal`
// because that is what it treats, and without the guard it became an Animal —
// a vet that barks.
const CATEGORY_REFINEMENTS: Array<{ from: SentenceCategory; to: SentenceCategory; tags: string[]; unless?: string[] }> = [
  // "People & Living Things" is people, animals and plants in one bucket. This
  // split is also a correctness fix, not just a coverage one: it is why 犬 kept
  // arriving as a Person and needing to be filtered back out by hand.
  { from:'Person', to:'Animal', tags:['animal','pet','dog','cat','bird','fish','insect','horse','cow','pig','chicken','rabbit'], unless:['person','occupation','human','doctor','nurse','teacher','student','family','friend'] },
  { from:'Person', to:'Plant', tags:['plant','tree','flower','grass','bush','crop'], unless:['person','occupation','human','farmer'] },
  // 薬 arrives in the Food & Drink bucket, which is both why the Medicine
  // category was empty and why medicine was one tag away from being eaten.
  { from:'Food', to:'Medicine', tags:['medicine'] },
  { from:'Drink', to:'Medicine', tags:['medicine'] },
  // "Objects" is the largest bucket and hides the most categories.
  { from:'Object', to:'Medicine', tags:['medicine'] },
  { from:'Object', to:'Clothing', tags:['clothing','shirt','pants','shoes','hat','coat','dress','gloves','wearable'] },
  { from:'Object', to:'Book', tags:['book','magazine','comic','textbook'] },
  { from:'Object', to:'Document', tags:['document','notebook','newspaper','paper'] },
  { from:'Object', to:'Vehicle', tags:['vehicle','car','bus','train','bicycle','motorcycle','airplane','ship'] },
  { from:'Object', to:'Technology', tags:['technology','electronics','computer','laptop','phone','tablet','camera'] },
  { from:'Object', to:'Furniture', tags:['furniture','chair','table','desk','bed','sofa','shelf','cabinet'] },
  { from:'Object', to:'Tool', tags:['tool','knife','scissors','hammer','instrument'] },
  // The imported taxonomy has no bucket for occurrences, so 祭り, 会議, 試合,
  // 地震 and 葬式 all arrived as Objects and the Event category held nothing at
  // all — an event was a thing you could put in a bag. Listed after the
  // concrete-object refinements so a physical item that merely mentions an
  // event keeps its object category.
  { from:'Object', to:'Event', tags:['event','festival','party','meeting','ceremony','wedding','funeral','concert','competition','exam','test','accident'] },
  // "Places" covers open places, whole buildings and rooms inside them, which
  // 入る/住む/座る care about distinguishing.
  { from:'Place', to:'Room', tags:['room','kitchen','bathroom','bedroom','classroom','living-room'] },
  { from:'Place', to:'Building', tags:['building','house','apartment','school','university','office','store','restaurant','cafe','hospital','hotel','library','museum','temple','shrine','church','bank','station','airport'] },
  // "Time & Numbers" is three things: times, counts and money.
  { from:'Time', to:'Money', tags:['money','currency'] },
  { from:'Time', to:'Number', tags:['number','counter','percent','measurement'] },
]

export function refineCoarseCategory(category: SentenceCategory, tags: string[]): SentenceCategory {
  const match = CATEGORY_REFINEMENTS.find(rule => rule.from === category
    && tags.some(tag => rule.tags.includes(tag))
    && !rule.unless?.some(tag => tags.includes(tag)))
  return match ? match.to : category
}

const grammarPattern = /(^|\b)(particle|conjunction|copula|auxiliary|suffix|prefix|interjection|pronoun|expression|counter|case|polite after verb|assertion|conj\.|disc\.)($|\b)/
const adverbPattern = /\b(adverb|quickly|slowly|already|always|often|sometimes|usually|really|very|together|again|still|soon|perhaps|probably|almost|especially|suddenly|finally|immediately)\b/

function functionWordTags(meaning: string, japanese: string) {
  const tags: string[] = []
  if (/\bpronoun\b/.test(meaning) || /^(i|me|you|he|him|she|her|we|us|they|them)\b/.test(meaning)) tags.push('pronoun')
  if (/\b(conjunction|conj\.)\b/.test(meaning)) tags.push('conjunction')
  if (/\binterjection\b/.test(meaning)) tags.push('interjection')
  if (/\b(auxiliary|copula|polite after verb)\b/.test(meaning)) tags.push('auxiliary-verb')
  if (/\b(particle|case)\b/.test(meaning) || ['は','が','を','に','で','へ','と','も','の','から','まで','や','か','ね','よ'].includes(japanese)) tags.push('particle')
  if (/^(what|who|where|when|why|how|which)\b/.test(meaning)) tags.push('question-word')
  if (/^(this|that|these|those|here|there)\b/.test(meaning)) tags.push('demonstrative')
  if (japanese === 'は') tags.push('topic-marker')
  if (japanese === 'が') tags.push('subject-marker')
  if (japanese === 'を') tags.push('object-marker')
  if (japanese === 'へ') tags.push('direction-marker')
  if (japanese === 'で') tags.push('location-marker')
  if (japanese === 'と') tags.push('quotation-marker')
  if (japanese === 'の') tags.push('possession-marker')
  if (!tags.length) tags.push('expression')
  return tags
}

function verbPropertyTags(meaning: string, japanese: string) {
  const tags = ['verb']
  if (/\b(go|come|walk|run|enter|leave|return|move|travel|arrive|depart|climb|fall|stand|sit)\b/.test(meaning)) tags.push('motion-verb','movement')
  if (/\b(say|speak|talk|listen|hear|ask|call|tell|teach|answer|explain|read|write)\b/.test(meaning)) tags.push('communication-verb','communication')
  if (/\b(eat|consume|taste)\b/.test(meaning)) tags.push('eating')
  if (/\bdrink\b/.test(meaning)) tags.push('drinking')
  if (/\bgive\b/.test(meaning)) tags.push('giving')
  if (/\breceive\b/.test(meaning)) tags.push('receiving')
  if (/\bbuy\b/.test(meaning)) tags.push('buying')
  if (/\bsell\b/.test(meaning)) tags.push('selling')
  if (/\b(make|create|produce)\b/.test(meaning)) tags.push('creating')
  if (/\bbuild\b/.test(meaning)) tags.push('building')
  if (/\bcook\b/.test(meaning)) tags.push('cooking')
  if (/\b(see|watch|look|hear|listen|feel|smell|notice|understand|know)\b/.test(meaning)) tags.push('perception-verb')
  if (/\b(think|understand|know|choose|remember|forget|like|love|hate|worry|hope|wish|fear)\b/.test(meaning)) tags.push('mental-verb')
  if (japanese.endsWith('する')) tags.push('suru-verb')
  else if (japanese === '来る' || japanese === 'くる') tags.push('irregular')
  else if (japanese.endsWith('る')) tags.push('ichidan')
  else tags.push('godan')
  return tags
}

function semanticTags(category: SentenceCategory, meaning: string) {
  const tags: string[] = []
  if (category === 'Food') {
    if (/\b(apple|orange|banana|fruit)\b/.test(meaning)) tags.push('fruit')
    if (/\b(vegetable|potato|tomato)\b/.test(meaning)) tags.push('vegetable')
    if (/\b(meat|beef|pork|chicken)\b/.test(meaning)) tags.push('meat')
    if (/\b(fish|seafood|sushi)\b/.test(meaning)) tags.push('seafood')
    if (/\b(rice)\b/.test(meaning)) tags.push('rice','grain')
    if (/\b(bread)\b/.test(meaning)) tags.push('bread','grain')
    if (/\b(noodle|ramen|soba|udon)\b/.test(meaning)) tags.push('noodles')
    if (/\b(cake|dessert)\b/.test(meaning)) tags.push('dessert')
    if (/\b(candy|sweet)\b/.test(meaning)) tags.push('candy')
    if (/\b(snack)\b/.test(meaning)) tags.push('snack')
    if (/\b(ingredient)\b/.test(meaning)) tags.push('ingredient')
    if (/\b(spice|salt|pepper)\b/.test(meaning)) tags.push('spice')
  }
  if (category === 'Drink') {
    if (/\btea\b/.test(meaning)) tags.push('tea')
    if (/\bcoffee\b/.test(meaning)) tags.push('coffee')
    if (/\b(beer|wine|alcohol|sake)\b/.test(meaning)) tags.push('alcohol')
    tags.push('drink')
  }
  if (category === 'Person') {
    if (/\bfamily|mother|father|parent|brother|sister|son|daughter|husband|wife\b/.test(meaning)) tags.push('family')
    if (/\bfriend|boyfriend|girlfriend\b/.test(meaning)) tags.push('friend')
    if (/\bteacher|doctor|nurse|employee|worker|manager|officer\b/.test(meaning)) tags.push('occupation')
  }
  if (category === 'Animal') {
    if (/\bbird\b/.test(meaning)) tags.push('bird')
    if (/\bfish\b/.test(meaning)) tags.push('fish')
    if (/\binsect|bug|bee|butterfly\b/.test(meaning)) tags.push('insect')
    if (/\bpet|dog|cat\b/.test(meaning)) tags.push('pet')
  }
  if (category === 'Plant') {
    if (/\btree\b/.test(meaning)) tags.push('tree')
    if (/\bflower\b/.test(meaning)) tags.push('flower')
  }
  if (category === 'Place' || category === 'Building' || category === 'Room') {
    for (const tag of ['country','city','building','room','school','office','store','restaurant','hospital','station','airport','park','nature','beach','mountain']) if (meaning.includes(tag)) tags.push(tag)
  }
  if (category === 'Time') for (const tag of ['day','week','month','year','morning','afternoon','evening','night','holiday','season']) if (meaning.includes(tag)) tags.push(tag)
  if (category === 'Emotion') for (const tag of ['happy','sad','angry','excited','calm','tired','hungry','busy','healthy','sick']) if (meaning.includes(tag)) tags.push(tag)
  if (category === 'Activity') {
    const activityTags: Array<[RegExp,string]> = [[/\b(move|movement|walk|run)\b/,'movement'],[/\bread(ing)?\b/,'reading'],[/\bwrit(e|ing)\b/,'writing'],[/\bcook(ing)?\b/,'cooking'],[/\bclean(ing)?\b/,'cleaning'],[/\bshop(ping)?\b/,'shopping'],[/\bstud(y|ying)\b/,'studying'],[/\bwork(ing)?\b/,'working'],[/\bsleep(ing)?\b/,'sleeping'],[/\bplay(ing)?\b/,'playing'],[/\btravel(ing)?\b/,'traveling']]
    for (const [pattern,tag] of activityTags) if (pattern.test(meaning)) tags.push(tag)
  }
  return tags
}

export function classifyVocabularyCard(card: StudyCard): VocabularyClassification {
  const meaning = (card.back || card.english || '').toLowerCase().replace(/[/;,()]/g, ' ')
  const jlptTag = card.jlpt?.toLowerCase()
  const rank = Number(card.hint?.match(/^#(\d+)/)?.[1] ?? Number.NaN)
  const universal = [jlptTag ?? '', Number.isFinite(rank) && rank <= 100 ? 'very-common' : Number.isFinite(rank) && rank <= 1000 ? 'common' : '', /^[ァ-ヶー・]+$/.test(card.front) ? 'loanword' : '']
  const imported = getVocabularyMetadata(card.front,card.reading)
  if (imported) {
    const tags=normalizeTags([...imported.tags,...universal])
    const bodyPart=tags.some(tag=>['body-part','blood','anatomy'].includes(tag))
    // The imported taxonomy has one bucket for food and drink, but 食べる and
    // 飲む do not share objects. Tags decide which half of the bucket a word is
    // in, so that milk is never eaten.
    const drink=tags.some(tag=>drinkTags.includes(tag)) && !tags.some(tag=>solidFoodTags.includes(tag))
    const category=bodyPart ? 'Object' : drink && importedCategoryMap[imported.category] === 'Food' ? 'Drink' : refineCoarseCategory(importedCategoryMap[imported.category],tags)
    return { category, tags, confidence:'high' }
  }
  const finish = (category: SentenceCategory, tags: string[], confidence: VocabularyClassification['confidence']): VocabularyClassification => {
    if (['Person','Animal','Plant','Place','Building','Room','Object','Tool','Technology','Vehicle','Clothing','Furniture','Book','Document','Media','Food','Drink','Medicine'].includes(category)) tags.push('concrete')
    if (['Activity','Adverb','Emotion','Language'].includes(category)) tags.push('abstract')
    for (const topic of ['school','business','travel','technology','health','shopping','family']) if (meaning.includes(topic)) tags.push(topic)
    return { category, tags:normalizeTags([...tags,...universal]), confidence }
  }
  if (/^(i|me|you|he|him|she|her|we|us|they|them|this|that|these|those|what|who|where|when|why|how|which)\b/.test(meaning)) return finish('Language',functionWordTags(meaning,card.front),'high')
  if (/^to\s+/.test(meaning)) return finish('Activity',verbPropertyTags(meaning,card.front),'high')
  if (grammarPattern.test(meaning) || (!meaning && card.front.length <= 4)) return finish('Language',functionWordTags(meaning,card.front),'medium')
  if (adverbPattern.test(meaning)) return finish('Adverb',['adverb'],'high')
  for (const rule of tests) {
    if (!rule.pattern.test(meaning)) continue
    return finish(rule.category,[...(rule.tags ?? []),...semanticTags(rule.category,meaning)],'high')
  }
  const adjectiveLike = card.front.endsWith('い') || /\b(new|old|big|small|large|long|short|high|low|fast|slow|heavy|light|good|bad|beautiful|difficult|easy|strong|weak|bright|dark|expensive|cheap|delicious)\b/.test(meaning)
  if (adjectiveLike) return finish('Object',[card.front.endsWith('い')?'i-adjective':'na-adjective'],'medium')
  // Nothing matched, so the word may well be a grammar fragment rather than a
  // noun — 例えば and など land here. `unclassified` keeps these out of the slots
  // that expect a real object until a reviewer gives them proper tags.
  return finish('Object',['noun','unclassified'],'fallback')
}
