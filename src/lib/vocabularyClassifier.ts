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
  { category:'Food', pattern:/\b(food|meal|breakfast|lunch|dinner|rice|bread|noodle|ramen|soba|udon|meat|beef|pork|chicken|fish|seafood|sushi|egg|fruit|apple|orange|banana|vegetable|potato|tomato|cake|candy|sweet|dessert|snack|ingredient|salt|sugar|spice|soup)\b/, tags:[] },
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
    const category=tags.some(tag=>['body-part','blood','anatomy'].includes(tag)) ? 'Object' : importedCategoryMap[imported.category]
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
  return finish('Object',['noun'],'fallback')
}
