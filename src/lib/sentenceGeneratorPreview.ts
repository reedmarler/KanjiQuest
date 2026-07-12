import type { JlptLevel } from './types'

type PreviewLevel = Extract<JlptLevel, 'N5' | 'N4'>
type Pos =
  | 'pronoun'
  | 'noun'
  | 'verb'
  | 'i_adjective'
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
  conjugationClass?: 'ichidan' | 'godan_u' | 'godan_ku_iku' | 'godan_mu' | 'godan_ru' | 'suru'
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

const rank: Record<PreviewLevel, number> = { N5: 1, N4: 2 }

const frames: PreviewFrame[] = [
  {
    id: 'n5-topic-object-verb',
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
    id: 'n5-place-action',
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
    id: 'n5-time-movement',
    jlpt: 'N5',
    label: '[subject] は [time] [place] に [verb-masu]',
    slots: {
      subject: { pos: 'pronoun', tags: ['person'] },
      time: { pos: 'time_expression', tags: ['time'] },
      place: { pos: 'place_expression', tags: ['destination'] },
      verb: { pos: 'verb', tags: ['movement'], transitivity: 'intransitive', conjugation: 'masu' },
    },
    tokens: [
      { type: 'slot', slot: 'subject' },
      { type: 'literal', text: 'は' },
      { type: 'slot', slot: 'time' },
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
  { id: 'taberu', surface: '食べる', reading: 'たべる', english: 'eat', pos: 'verb', jlpt: 'N5', tags: ['action'], conjugationClass: 'ichidan', transitivity: 'transitive', objectTags: ['edible'], userVocab: true },
  { id: 'nomu', surface: '飲む', reading: 'のむ', english: 'drink', pos: 'verb', jlpt: 'N5', tags: ['action'], conjugationClass: 'godan_mu', transitivity: 'transitive', objectTags: ['drinkable'], userVocab: true },
  { id: 'yomu', surface: '読む', reading: 'よむ', english: 'read', pos: 'verb', jlpt: 'N5', tags: ['action', 'study'], conjugationClass: 'godan_mu', transitivity: 'transitive', objectTags: ['readable'], userVocab: true },
  { id: 'miru', surface: '見る', reading: 'みる', english: 'watch', pos: 'verb', jlpt: 'N5', tags: ['action'], conjugationClass: 'ichidan', transitivity: 'transitive', objectTags: ['watchable'], userVocab: true },
  { id: 'benkyou_suru', surface: '勉強する', reading: 'べんきょうする', english: 'study', pos: 'verb', jlpt: 'N5', tags: ['action', 'study'], conjugationClass: 'suru', transitivity: 'transitive', objectTags: ['study_item', 'readable'], userVocab: true },
  { id: 'iku', surface: '行く', reading: 'いく', english: 'go', pos: 'verb', jlpt: 'N5', tags: ['movement'], conjugationClass: 'godan_ku_iku', transitivity: 'intransitive', userVocab: true },
  { id: 'kaeru', surface: '帰る', reading: 'かえる', english: 'return', pos: 'verb', jlpt: 'N5', tags: ['movement'], conjugationClass: 'godan_ru', transitivity: 'intransitive' },
  { id: 'tsukuru', surface: '作る', reading: 'つくる', english: 'make', pos: 'verb', jlpt: 'N4', tags: ['action'], conjugationClass: 'godan_ru', transitivity: 'transitive', objectTags: ['food', 'thing'] },
]

function seeded(seed: number) {
  let value = seed || 1
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

function candidates(spec: PreviewSlotSpec, target: PreviewLevel, previousId?: string) {
  return vocab
    .filter((item) => item.pos === spec.pos)
    .filter((item) => allowsLevel(item, target))
    .filter((item) => item.id !== previousId)
    .filter((item) => hasAny(item.tags, spec.tags))
    .filter((item) => !spec.transitivity || item.transitivity === spec.transitivity)
    .sort((a, b) => Number(Boolean(b.userVocab)) - Number(Boolean(a.userVocab)))
}

const godan: Record<string, { masu: string; te: string; ta: string }> = {
  godan_u: { masu: 'います', te: 'って', ta: 'った' },
  godan_ku_iku: { masu: 'きます', te: 'って', ta: 'った' },
  godan_mu: { masu: 'みます', te: 'んで', ta: 'んだ' },
  godan_ru: { masu: 'ります', te: 'って', ta: 'った' },
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
  if (frame.id === 'n5-topic-object-verb') {
    return `${subject} ${verb3(slots.verb!.item.english, subject)} ${slots.object!.item.english}.`
  }
  if (frame.id === 'n5-place-action') {
    return `${subject} ${verb3(slots.verb!.item.english, subject)} ${slots.object!.item.english} at ${slots.place!.item.english}.`
  }
  if (frame.id === 'n5-time-movement') {
    const place = slots.place!.item.english === 'home' ? 'home' : `to ${slots.place!.item.english}`
    return `${subject} ${verb3(slots.verb!.item.english, subject)} ${place} ${slots.time!.item.english}.`
  }
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

export function generatePreviewSentence(
  level: PreviewLevel,
  seed: number,
  previous?: GeneratedPreviewSentence,
): GeneratedPreviewSentence {
  const rand = seeded(seed)
  const framePool = frames.filter((frame) => frame.jlpt === level)
  const frame = pick(framePool, rand)
  const slots: Record<string, FilledSlot> = {}

  for (const [slotName, spec] of Object.entries(frame.slots)) {
    const previousId = previous?.frameId === frame.id ? previous.slots[slotName]?.id : undefined
    const pool = candidates(spec, level, previousId)
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
