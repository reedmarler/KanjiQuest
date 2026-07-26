import { generateCategorySentence, getVerbUsageRecords } from './categorySentenceEngine'
import type { GeneratedPreviewSentence } from './sentenceGeneratorPreview'
import type { DrillExercise, DrillJlptLevel } from './drillExercises'
import { complexityForPattern } from './generationComplexity'

type GeneratedSentence = NonNullable<ReturnType<typeof generateCategorySentence>>

interface Choice {
  text: string
  reading?: string
}

interface GrammarSpec {
  id: string
  frameId: string
  level: DrillJlptLevel
  target: { type: 'literal'; text: string; occurrence?: number } | { type: 'slot'; slot: string; suffix: string; alternatives: string[] }
  pattern: string
  meaning: string
  choices?: Choice[]
}

interface VocabSpec {
  id: string
  frameId: string
  level: DrillJlptLevel
  /** Unused by N3/N2/N1 patterns — they pick their own vocabulary internally
   * rather than reading generation options, so this is only meaningful for the
   * base N5/N4 verb-pool patterns. */
  verbId: string
  slot: string
  meaning: string
  /** Verb choices are vocabulary too; every option keeps the same polite ending. */
  verbOptions?: string[]
}

const particleChoices: Choice[] = ['に', 'へ', 'で', 'と'].map((text) => ({ text, reading: text }))
const routeChoices: Choice[] = ['から', 'まで', 'に', 'へ'].map((text) => ({ text, reading: text }))
const connectorChoices: Choice[] = ['から', 'ので', 'のに', 'ために'].map((text) => ({ text, reading: text }))
const timeConnectorChoices: Choice[] = ['間に', 'うちに', 'つつ', 'まま'].map((text) => ({ text, reading: text }))

const grammarSpecs: GrammarSpec[] = [
  { id: 'masu', frameId: 'n5-01', level: 'N5', target: { type: 'slot', slot: 'verb', suffix: 'ます', alternatives: ['ました', 'ません', 'ませんでした'] }, pattern: 'ます', meaning: 'polite non-past' },
  { id: 'destination-ni', frameId: 'n5-02', level: 'N5', target: { type: 'literal', text: 'に' }, pattern: 'に', meaning: 'destination marker', choices: particleChoices },
  { id: 'action-place', frameId: 'n5-03', level: 'N5', target: { type: 'literal', text: 'で' }, pattern: 'で', meaning: 'place where an action happens', choices: particleChoices },
  { id: 'companion-to', frameId: 'n5-04', level: 'N5', target: { type: 'literal', text: 'と' }, pattern: 'と', meaning: 'with / together with', choices: particleChoices },
  { id: 'time-ni', frameId: 'n5-05', level: 'N5', target: { type: 'literal', text: 'に' }, pattern: 'に', meaning: 'specific time marker', choices: particleChoices },
  { id: 'destination-e', frameId: 'n5-10', level: 'N5', target: { type: 'literal', text: 'へ' }, pattern: 'へ', meaning: 'direction marker', choices: particleChoices },
  { id: 'origin-kara', frameId: 'n5-15', level: 'N5', target: { type: 'literal', text: 'から' }, pattern: 'から', meaning: 'from / origin marker', choices: routeChoices },
  { id: 'endpoint-made', frameId: 'n5-16', level: 'N5', target: { type: 'literal', text: 'まで' }, pattern: 'まで', meaning: 'until / endpoint marker', choices: routeChoices },
  { id: 'route-kara', frameId: 'n5-22', level: 'N5', target: { type: 'literal', text: 'から' }, pattern: 'から〜まで', meaning: 'from a place', choices: routeChoices },
  { id: 'route-made', frameId: 'n5-22', level: 'N5', target: { type: 'literal', text: 'まで' }, pattern: 'から〜まで', meaning: 'to an endpoint', choices: routeChoices },
  { id: 'only-negative', frameId: 'n5-24', level: 'N5', target: { type: 'slot', slot: 'verb', suffix: 'ません', alternatives: ['ます', 'ました', 'ませんでした'] }, pattern: 'しか〜ない', meaning: 'only / nothing but' },
  { id: 'want', frameId: 'n4-01', level: 'N4', target: { type: 'slot', slot: 'verb', suffix: 'たいです', alternatives: ['ます', 'ました', 'ません'] }, pattern: 'たい', meaning: 'want to do' },
  { id: 'ongoing', frameId: 'n4-02', level: 'N4', target: { type: 'slot', slot: 'verb', suffix: 'ています', alternatives: ['ます', 'ました', 'ません'] }, pattern: 'ている', meaning: 'happening now' },
  { id: 'obligation', frameId: 'n4-05', level: 'N4', target: { type: 'slot', slot: 'verb', suffix: 'なければなりません', alternatives: ['なくてもいいです', 'ません', 'ました'] }, pattern: 'なければならない', meaning: 'must do' },
  { id: 'permission', frameId: 'n4-06', level: 'N4', target: { type: 'slot', slot: 'verb', suffix: 'てもいいです', alternatives: ['てはいけません', 'ています', 'てから'] }, pattern: 'てもいい', meaning: 'may / is allowed to' },
  { id: 'prohibition', frameId: 'n4-07', level: 'N4', target: { type: 'slot', slot: 'verb', suffix: 'てはいけません', alternatives: ['てもいいです', 'ています', 'てから'] }, pattern: 'てはいけない', meaning: 'must not' },
  { id: 'while', frameId: 'n4-09', level: 'N4', target: { type: 'slot', slot: 'secondaryVerb', suffix: 'ながら', alternatives: ['ます', 'ました', 'ません'] }, pattern: 'ながら', meaning: 'while doing' },
  { id: 'sequence', frameId: 'n4-13', level: 'N4', target: { type: 'slot', slot: 'firstVerb', suffix: 'から', alternatives: ['もいいです', 'はいけません', 'います'] }, pattern: 'てから', meaning: 'after doing' },
  { id: 'reason-kara', frameId: 'n4-18', level: 'N4', target: { type: 'literal', text: 'から' }, pattern: 'から', meaning: 'because / since', choices: connectorChoices },
  { id: 'ability', frameId: 'n4-24', level: 'N4', target: { type: 'literal', text: 'ことができます' }, pattern: 'ことができる', meaning: 'can do', choices: [{ text: 'ことがあります' }, { text: 'ことにします' }, { text: 'ことではありません' }] },
  { id: 'not-required', frameId: 'n4-25', level: 'N4', target: { type: 'slot', slot: 'verb', suffix: 'なくてもいいです', alternatives: ['なければなりません', 'ません', 'ました'] }, pattern: 'なくてもいい', meaning: 'does not have to' },
  { id: 'contrast-noni', frameId: 'n3-08', level: 'N3', target: { type: 'literal', text: 'のに' }, pattern: 'のに', meaning: 'although / despite', choices: connectorChoices },
  { id: 'reason-node', frameId: 'n3-09', level: 'N3', target: { type: 'literal', text: 'ので' }, pattern: 'ので', meaning: 'because / since', choices: connectorChoices },
  { id: 'purpose-tameni', frameId: 'n3-10', level: 'N3', target: { type: 'literal', text: 'ために' }, pattern: 'ために', meaning: 'in order to', choices: connectorChoices },

  // Complexity Level 2 — grammar covering two interacting verbs/clauses.
  { id: 'while-bounded', frameId: 'n3-11', level: 'N3', target: { type: 'literal', text: '間に' }, pattern: '間に', meaning: 'while (bounded window)', choices: timeConnectorChoices },
  { id: 'formal-while', frameId: 'n3-19', level: 'N3', target: { type: 'literal', text: 'つつ、' }, pattern: 'つつ', meaning: 'while (formal)', choices: [{ text: 'ながら、' }, { text: 'ものの、' }, { text: 'けれど、' }] },
  { id: 'more-than', frameId: 'n3-24', level: 'N3', target: { type: 'literal', text: 'より' }, pattern: 'より', meaning: 'more than (comparison)', choices: [{ text: 'ほど' }, { text: 'くらい' }, { text: 'だけ' }] },
  { id: 'not-as-much', frameId: 'n3-25', level: 'N3', target: { type: 'literal', text: 'ほど' }, pattern: 'ほど', meaning: 'not as much as', choices: [{ text: 'より' }, { text: 'くらい' }, { text: 'だけ' }] },
  { id: 'during-span', frameId: 'n3-32', level: 'N3', target: { type: 'literal', text: '間、' }, pattern: '間', meaning: 'during (the whole span)', choices: [{ text: '間に、' }, { text: 'うちに、' }, { text: 'つつ、' }] },

  // Complexity Level 3 — chained / aspectual verb forms.
  { id: 'finish-doing', frameId: 'n3-14', level: 'N3', target: { type: 'literal', text: '終わりました。' }, pattern: '終わる', meaning: 'finish doing', choices: [{ text: '続けています。' }, { text: '始めます。' }, { text: 'てみます。' }] },
  { id: 'continue-doing', frameId: 'n3-15', level: 'N3', target: { type: 'literal', text: '続けています。' }, pattern: '続ける', meaning: 'continue doing', choices: [{ text: '終わりました。' }, { text: '始めます。' }, { text: 'てみます。' }] },
  { id: 'try-doing', frameId: 'n3-31', level: 'N3', target: { type: 'literal', text: 'みます。' }, pattern: 'てみる', meaning: 'try doing', choices: [{ text: '終わります。' }, { text: '続けます。' }, { text: '始めます。' }] },
  { id: 'effort-habit', frameId: 'n3-01', level: 'N3', target: { type: 'slot', slot: 'verb', suffix: 'ようにします', alternatives: ['ようになります', 'ことにします', 'てみます'] }, pattern: 'ようにする', meaning: 'make an effort or habit' },
  { id: 'decide-to', frameId: 'n3-02', level: 'N3', target: { type: 'slot', slot: 'verb', suffix: 'ことにします', alternatives: ['ようにします', 'ようになります', 'てみます'] }, pattern: 'ことにする', meaning: 'decide to do' },

  // Complexity Level 4 — logical relationships between clauses.
  { id: 'thanks-to', frameId: 'n3-16', level: 'N3', target: { type: 'literal', text: 'のおかげで、' }, pattern: 'おかげで', meaning: 'thanks to', choices: [{ text: 'のせいで、' }, { text: 'にもかかわらず、' }, { text: 'のわりに、' }] },
  { id: 'because-of-blame', frameId: 'n3-17', level: 'N3', target: { type: 'literal', text: 'のせいで、' }, pattern: 'せいで', meaning: 'because of (blame)', choices: [{ text: 'のおかげで、' }, { text: 'にしては、' }, { text: 'のわりに、' }] },
  { id: 'despite', frameId: 'n2-19', level: 'N2', target: { type: 'literal', text: 'にもかかわらず、' }, pattern: 'にもかかわらず', meaning: 'despite', choices: [{ text: 'のおかげで、' }, { text: 'ものの、' }, { text: 'とすれば、' }] },
  { id: 'the-moment', frameId: 'n2-22', level: 'N2', target: { type: 'literal', text: 'とたん、' }, pattern: 'たとたん', meaning: 'the moment that', choices: [{ text: 'うえで、' }, { text: '最中に、' }, { text: '次第、' }] },
  { id: 'formal-though', frameId: 'n2-30', level: 'N2', target: { type: 'literal', text: 'とはいえ、' }, pattern: 'とはいえ', meaning: 'though (formal contrast)', choices: [{ text: 'ものだから、' }, { text: 'ことから、' }, { text: 'に対して、' }] },

  // Complexity Level 5 — advanced discourse grammar over a whole proposition.
  { id: 'nothing-other-than', frameId: 'n1-02', level: 'N1', target: { type: 'literal', text: 'にほかならない。' }, pattern: 'にほかならない', meaning: 'nothing other than', choices: [{ text: 'というものだ。' }, { text: 'にすぎない。' }, { text: 'どころではない。' }] },
  { id: 'no-choice', frameId: 'n1-01', level: 'N1', target: { type: 'literal', text: 'ざるを' }, pattern: 'ざるを得ない', meaning: 'have no choice but to', choices: [{ text: 'てもいいを' }, { text: 'てはいけないを' }, { text: 'なくてもいいを' }] },
  { id: 'not-necessarily', frameId: 'n1-13', level: 'N1', target: { type: 'literal', text: '限りません。' }, pattern: 'とは限らない', meaning: 'not necessarily', choices: [{ text: 'に決まっています。' }, { text: 'に違いありません。' }, { text: 'わけです。' }] },
  { id: 'general-truth', frameId: 'n2-07', level: 'N2', target: { type: 'literal', text: 'ものだ。' }, pattern: 'ものだ', meaning: 'general truth or recollection', choices: [{ text: 'はずだ。' }, { text: 'に違いない。' }, { text: 'ところだ。' }] },
  { id: 'softened-denial', frameId: 'n2-17', level: 'N2', target: { type: 'literal', text: 'わけではありません。' }, pattern: 'というわけではない', meaning: 'it is not that (softened)', choices: [{ text: 'わけにはいきません。' }, { text: 'に違いありません。' }, { text: 'ものではありません。' }] },
]

const vocabSpecs: VocabSpec[] = [
  { id: 'eat-object', frameId: 'n5-01', level: 'N5', verbId: 'taberu-basic', slot: 'object', meaning: 'food word' },
  { id: 'drink-object', frameId: 'n5-01', level: 'N5', verbId: 'nomu-basic', slot: 'object', meaning: 'drink word' },
  { id: 'read-object', frameId: 'n5-01', level: 'N5', verbId: 'yomu-basic', slot: 'object', meaning: 'readable word' },
  { id: 'watch-object', frameId: 'n5-01', level: 'N5', verbId: 'miru-basic', slot: 'object', meaning: 'watchable word' },
  { id: 'ni-destination', frameId: 'n5-02', level: 'N5', verbId: 'iku-ni', slot: 'destination', meaning: 'destination word' },
  { id: 'eating-place', frameId: 'n5-03', level: 'N5', verbId: 'taberu-location', slot: 'location', meaning: 'location word' },
  { id: 'companion', frameId: 'n5-04', level: 'N5', verbId: 'hanasu-companion', slot: 'companion', meaning: 'person word' },
  { id: 'time', frameId: 'n5-05', level: 'N5', verbId: 'okiru-time', slot: 'time', meaning: 'time word' },
  { id: 'adverb', frameId: 'n5-09', level: 'N5', verbId: 'yomu-adverb', slot: 'adverb', meaning: 'adverb' },
  { id: 'e-destination', frameId: 'n5-10', level: 'N5', verbId: 'iku-e', slot: 'destination', meaning: 'destination word' },
  { id: 'n4-eat', frameId: 'n4-01', level: 'N4', verbId: 'taberu-basic', slot: 'object', meaning: 'food word' },
  { id: 'n4-read', frameId: 'n4-02', level: 'N4', verbId: 'yomu-basic', slot: 'object', meaning: 'readable word' },
  { id: 'n4-watch', frameId: 'n4-06', level: 'N4', verbId: 'miru-basic', slot: 'object', meaning: 'watchable word' },
  { id: 'n4-travel', frameId: 'n4-07', level: 'N4', verbId: 'iku-e', slot: 'destination', meaning: 'destination word' },
  { id: 'n4-time', frameId: 'n4-05', level: 'N4', verbId: 'okiru-time', slot: 'time', meaning: 'time word' },
  { id: 'eat-subject', frameId: 'n5-01', level: 'N5', verbId: 'taberu-basic', slot: 'subject', meaning: 'person word' },
  { id: 'drink-subject', frameId: 'n5-01', level: 'N5', verbId: 'nomu-basic', slot: 'subject', meaning: 'person word' },
  { id: 'read-subject', frameId: 'n5-01', level: 'N5', verbId: 'yomu-basic', slot: 'subject', meaning: 'person word' },
  { id: 'travel-subject', frameId: 'n5-10', level: 'N5', verbId: 'iku-e', slot: 'subject', meaning: 'person word' },
  { id: 'talk-subject', frameId: 'n5-04', level: 'N5', verbId: 'hanasu-companion', slot: 'subject', meaning: 'person word' },
  { id: 'n4-eat-subject', frameId: 'n4-01', level: 'N4', verbId: 'taberu-basic', slot: 'subject', meaning: 'person word' },
  { id: 'n4-read-subject', frameId: 'n4-02', level: 'N4', verbId: 'yomu-basic', slot: 'subject', meaning: 'person word' },
  { id: 'verb-eat', frameId: 'n5-01', level: 'N5', verbId: 'taberu-basic', slot: 'verb', meaning: 'verb word', verbOptions: ['taberu-basic', 'nomu-basic', 'yomu-basic', 'miru-basic'] },
  { id: 'verb-drink', frameId: 'n5-01', level: 'N5', verbId: 'nomu-basic', slot: 'verb', meaning: 'verb word', verbOptions: ['taberu-basic', 'nomu-basic', 'yomu-basic', 'miru-basic'] },
  { id: 'verb-read', frameId: 'n5-01', level: 'N5', verbId: 'yomu-basic', slot: 'verb', meaning: 'verb word', verbOptions: ['taberu-basic', 'nomu-basic', 'yomu-basic', 'miru-basic'] },
  { id: 'verb-watch', frameId: 'n5-01', level: 'N5', verbId: 'miru-basic', slot: 'verb', meaning: 'verb word', verbOptions: ['taberu-basic', 'nomu-basic', 'yomu-basic', 'miru-basic'] },

  // Complexity Level 2 — n3-25 (ほど) always fills both subject and object from
  // the person pool, regardless of which verb-pool option is passed in.
  { id: 'hodo-subject', frameId: 'n3-25', level: 'N3', verbId: 'taberu-basic', slot: 'subject', meaning: 'person word' },
  { id: 'hodo-object', frameId: 'n3-25', level: 'N3', verbId: 'taberu-basic', slot: 'object', meaning: 'person word' },

  // Complexity Level 3 — n3-01 (ようにする) always fills subject (person) and,
  // in its reading-habit variant, object (readable thing).
  { id: 'younisuru-subject', frameId: 'n3-01', level: 'N3', verbId: 'taberu-basic', slot: 'subject', meaning: 'person word' },
  { id: 'younisuru-object', frameId: 'n3-01', level: 'N3', verbId: 'taberu-basic', slot: 'object', meaning: 'readable word' },

  // Complexity Level 4 — n3-16 (おかげで) always fills subject from the person pool.
  { id: 'okagede-subject', frameId: 'n3-16', level: 'N3', verbId: 'taberu-basic', slot: 'subject', meaning: 'person word' },

  // Complexity Level 5 — n1-01 (ざるを得ない) and n2-02 (わけにはいかない) both
  // always fill subject/reason from the person and reason pools respectively.
  { id: 'zaruoenai-subject', frameId: 'n1-01', level: 'N1', verbId: 'taberu-basic', slot: 'subject', meaning: 'person word' },
  { id: 'wakenihaikanai-reason', frameId: 'n2-02', level: 'N2', verbId: 'taberu-basic', slot: 'reason', meaning: 'reason word' },
]

function join(parts: GeneratedPreviewSentence['furigana']) {
  return {
    text: parts.map((part) => part.text).join(''),
    reading: parts.map((part) => part.reading).join(''),
  }
}

function rotate<T>(items: T[], offset: number) {
  const start = offset % items.length
  return [...items.slice(start), ...items.slice(0, start)]
}

function uniqueChoices(answer: Choice, distractors: Choice[], offset: number) {
  const choices = [answer, ...distractors].filter(
    (choice, index, all) => all.findIndex((other) => other.text === choice.text) === index,
  )
  return choices.length >= 4 ? rotate(choices.slice(0, 4), offset) : []
}

function exerciseFromRange(
  id: string,
  sentence: GeneratedSentence,
  start: number,
  end: number,
  answer: Choice,
  choices: Choice[],
  pattern: string,
  meaning: string,
  complexity = 1,
): DrillExercise | null {
  if (choices.length !== 4) return null
  const before = join(sentence.furigana.slice(0, start))
  const after = join(sentence.furigana.slice(end + 1))
  return {
    id,
    jlpt: sentence.level as DrillJlptLevel,
    complexity: complexity as DrillExercise['complexity'],
    prompt: `${before.text}___${after.text}`,
    promptReading: `${before.reading}___${after.reading}`,
    promptFurigana: {
      before: sentence.furigana.slice(0, start),
      after: sentence.furigana.slice(end + 1),
    },
    answer: answer.text,
    answerReading: answer.reading,
    options: choices.map((choice) => choice.text),
    optionReadings: choices.map((choice) => choice.reading),
    english: sentence.english,
    pattern,
    meaning,
  }
}

function literalIndex(sentence: GeneratedSentence, text: string, occurrence = 0) {
  let seen = 0
  return sentence.furigana.findIndex((part) => {
    if (part.text !== text) return false
    if (seen === occurrence) return true
    seen += 1
    return false
  })
}

function grammarExercise(sentence: GeneratedSentence, spec: GrammarSpec, order: number) {
  const target = spec.target
  if (target.type === 'literal') {
    const index = literalIndex(sentence, target.text, target.occurrence)
    if (index < 0 || !spec.choices) return null
    const part = sentence.furigana[index]!
    const answer = { text: part.text, reading: part.reading }
    return exerciseFromRange(
      `generated-grammar-${spec.id}-${order}-${sentence.japanese}`,
      sentence,
      index,
      index,
      answer,
      uniqueChoices(answer, spec.choices, order),
      spec.pattern,
      spec.meaning,
      complexityForPattern(spec.frameId),
    )
  }

  const index = sentence.furigana.findIndex((part) => part.slot === target.slot)
  if (index < 0) return null
  const part = sentence.furigana[index]!
  if (!part.text.endsWith(target.suffix) || !part.reading.endsWith(target.suffix)) return null
  const stem = part.text.slice(0, -target.suffix.length)
  const readingStem = part.reading.slice(0, -target.suffix.length)
  const answer = { text: part.text, reading: part.reading }
  const distractors = target.alternatives.map((ending) => ({ text: `${stem}${ending}`, reading: `${readingStem}${ending}` }))
  return exerciseFromRange(
    `generated-grammar-${spec.id}-${order}-${sentence.japanese}`,
    sentence,
    index,
    index,
    answer,
    uniqueChoices(answer, distractors, order),
    spec.pattern,
    spec.meaning,
    complexityForPattern(spec.frameId),
  )
}

/** One generated Grammar batch. Each batch uses every grammar target once. */
export function createGeneratedGrammarDrillBatch(batch: number) {
  const exercises: DrillExercise[] = []
  grammarSpecs.forEach((spec, specIndex) => {
    const sentence = generateCategorySentence(24000 + batch * 997 + specIndex * 503, spec.frameId, spec.level)
    if (!sentence) return
    const exercise = grammarExercise(sentence, spec, batch * grammarSpecs.length + specIndex)
    if (exercise) exercises.push(exercise)
  })
  return exercises
}

/** Generated grammar questions keep vocabulary fixed and blank only the grammar-bearing form. */
export function createGeneratedGrammarDrills() {
  return Array.from({ length: 4 }, (_, batch) => createGeneratedGrammarDrillBatch(batch)).flat()
}

function vocabExercise(seed: number, spec: VocabSpec, order: number) {
  const answerSentence = generateCategorySentence(seed, spec.frameId, spec.level, {
    verbId: spec.verbId,
    slotSeeds: { [spec.slot]: seed + 1 },
  })
  if (!answerSentence) return null
  const targetIndex = answerSentence.furigana.findIndex((part) => part.slot === spec.slot)
  const answerPart = answerSentence.furigana[targetIndex]
  if (targetIndex < 0 || !answerPart) return null

  const answer = { text: answerPart.text, reading: answerPart.reading }
  if (spec.verbOptions) {
    const verbs = new Map(getVerbUsageRecords().map((verb) => [verb.id, verb]))
    const alternatives = spec.verbOptions
      .filter((verbId) => verbId !== spec.verbId)
      .flatMap((verbId) => {
        const verb = verbs.get(verbId)
        if (!verb) return []
        const root = verb.japanese.slice(0, -1)
        const readingRoot = verb.reading.slice(0, -1)
        const ending = verb.verbClass === 'ichidan' ? 'ます'
          : verb.verbClass === 'godan-mu' ? 'みます'
            : verb.verbClass === 'godan-su' ? 'します'
              : 'きます'
        return [{ text: `${root}${ending}`, reading: `${readingRoot}${ending}` }]
      })
    return exerciseFromRange(
      `generated-vocab-${spec.id}-${order}-${answerSentence.japanese}`,
      answerSentence,
      targetIndex,
      targetIndex,
      answer,
      uniqueChoices(answer, alternatives, order),
      answer.text,
      spec.meaning,
      complexityForPattern(spec.frameId),
    )
  }

  const candidates: Choice[] = []
  for (let attempt = 0; attempt < 10 && candidates.length < 3; attempt += 1) {
    const alternativeSeed = seed + 101 + attempt * 31
    // slotSeeds only steers the base N5/N4 engine — N3/N2/N1 patterns ignore
    // options entirely, so without also varying the seed itself, every
    // "alternative" here would just regenerate the identical answer sentence.
    const alternative = generateCategorySentence(alternativeSeed, spec.frameId, spec.level, {
      verbId: spec.verbId,
      slotSeeds: { [spec.slot]: alternativeSeed },
    })
    const part = alternative?.furigana.find((candidate) => candidate.slot === spec.slot)
    if (part && part.text !== answerPart.text && !candidates.some((choice) => choice.text === part.text)) {
      candidates.push({ text: part.text, reading: part.reading })
    }
  }

  return exerciseFromRange(
    `generated-vocab-${spec.id}-${order}-${answerSentence.japanese}`,
    answerSentence,
    targetIndex,
    targetIndex,
    answer,
    uniqueChoices(answer, candidates, order),
    answerPart.text,
    spec.meaning,
    complexityForPattern(spec.frameId),
  )
}

/** One generated Vocab batch. The caller can build batches incrementally without blocking the UI. */
export function createGeneratedVocabDrillBatch(batch: number) {
  const exercises: DrillExercise[] = []
  vocabSpecs.forEach((spec, specIndex) => {
    const exercise = vocabExercise(36000 + batch * 997 + specIndex * 641, spec, specIndex)
    if (exercise) exercises.push(exercise)
  })
  return exercises
}
