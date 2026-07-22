import { grammarBuilderExercises } from './grammarBuilderExercises'

export interface GrammarPracticeExercise {
  id: string
  jlpt: 'N5' | 'N4'
  prompt: string
  /** Hiragana reading for `prompt`, split on the same ___ marker. */
  promptReading?: string
  answer: string
  answerReading?: string
  options: string[]
  /** Parallel to `options` — undefined entries have no kanji to gloss. */
  optionReadings: (string | undefined)[]
  english: string
  pattern: string
  meaning: string
}

type GrammarFocus = {
  segmentIndex: number
  pattern: string
  meaning: string
  /** The text displayed in the sentence instead of the answer; include ___ for the blank. */
  replacement?: string
  /** Hiragana reading for the stem kept in `replacement` (without the ___). */
  replacementReading?: string
  /** The exact grammar piece the learner chooses. */
  answer?: string
  /** Purposeful alternatives for this grammar pattern. */
  options?: string[]
}

const politeVerbEndings = ['ます。', 'ました。', 'ません。', 'ませんでした。']
const plainVerbEndings = ['む。', 'まない。', 'んだ。', 'まなかった。']
const connectorChoices = ['から、', 'ので、', 'けど、', 'そして、']

const focusById: Record<string, GrammarFocus> = {
  masu: { segmentIndex: 4, pattern: '〜ます', meaning: 'polite non-past', replacement: '食べ___', replacementReading: 'たべ', answer: 'ます。', options: politeVerbEndings },
  mashita: { segmentIndex: 3, pattern: '〜ました', meaning: 'polite past', replacement: '食べ___', replacementReading: 'たべ', answer: 'ました。', options: politeVerbEndings },
  masen: { segmentIndex: 4, pattern: '〜ません', meaning: 'polite negative', replacement: '食べ___', replacementReading: 'たべ', answer: 'ません。', options: politeVerbEndings },
  'masen-deshita': { segmentIndex: 3, pattern: '〜ませんでした', meaning: 'polite negative past', replacement: '行き___', replacementReading: 'いき', answer: 'ませんでした。', options: politeVerbEndings },
  plain: { segmentIndex: 5, pattern: 'dictionary form', meaning: 'plain non-past', replacement: '飲___', replacementReading: 'の', answer: 'む。', options: plainVerbEndings },
  'plain-negative': { segmentIndex: 3, pattern: '〜ない', meaning: 'plain negative', replacement: 'し___', replacementReading: 'し', answer: 'ない。', options: ['ない。', 'た。', 'ます。', 'ません。'] },
  'plain-past': { segmentIndex: 3, pattern: '〜た', meaning: 'plain past', replacement: '会っ___', replacementReading: 'あっ', answer: 'た。', options: ['た。', 'ない。', 'ます。', 'ません。'] },
  'plain-negative-past': { segmentIndex: 3, pattern: '〜なかった', meaning: 'plain negative past', replacement: '見___', replacementReading: 'み', answer: 'なかった。', options: ['なかった。', 'ない。', 'た。', 'ます。'] },
  arimasu: { segmentIndex: 6, pattern: '〜があります', meaning: 'there is / are (things)' },
  imasu: { segmentIndex: 3, pattern: '〜がいます', meaning: 'there is / are (people or animals)' },
  'ni-arimasu': { segmentIndex: 6, pattern: '〜にあります', meaning: 'is located at' },
  goro: { segmentIndex: 1, pattern: '〜ごろ', meaning: 'around a time' },
  suki: { segmentIndex: 4, pattern: '〜が好きです', meaning: 'like' },
  hoshii: { segmentIndex: 4, pattern: '〜がほしいです', meaning: 'want a thing' },
  tai: { segmentIndex: 4, pattern: '〜たいです', meaning: 'want to do', replacement: '飲み___', replacementReading: 'のみ', answer: 'たいです。', options: ['たいです。', 'ます。', 'ません。', 'ました。'] },
  dekiru: { segmentIndex: 5, pattern: '〜ことができます', meaning: 'can do' },
  shika: { segmentIndex: 3, pattern: '〜しか〜ない', meaning: 'only' },
  must: { segmentIndex: 4, pattern: '〜なければなりません', meaning: 'must / have to' },
  'not-have-to': { segmentIndex: 2, pattern: '〜なくてもいいです', meaning: 'do not have to' },
  may: { segmentIndex: 4, pattern: '〜てもいいですか', meaning: 'may I?' },
  comparison: { segmentIndex: 3, pattern: '〜より…のほうが', meaning: 'more than' },
  ichiban: { segmentIndex: 2, pattern: '一番', meaning: 'most' },
  give: { segmentIndex: 6, pattern: '〜をあげます', meaning: 'give' },
  receive: { segmentIndex: 6, pattern: '〜をもらいます', meaning: 'receive' },
  because: { segmentIndex: 1, pattern: '〜から', meaning: 'because', answer: 'から、', options: connectorChoices },
  but: { segmentIndex: 1, pattern: '〜けど', meaning: 'but / though', answer: 'けど、', options: connectorChoices },
  possessive: { segmentIndex: 3, pattern: '〜の', meaning: 'possession' },
  demonstrative: { segmentIndex: 0, pattern: 'この', meaning: 'this (before a noun)' },
  counter: { segmentIndex: 2, pattern: '〜つ', meaning: 'general object counter' },
  please: { segmentIndex: 4, pattern: '〜てください', meaning: 'please do' },
  'dont-please': { segmentIndex: 4, pattern: '〜ないでください', meaning: 'please do not' },
  lets: { segmentIndex: 2, pattern: '〜ましょう', meaning: "let's" },
  invitation: { segmentIndex: 1, pattern: '〜ませんか', meaning: "won't you?" },
  potential: { segmentIndex: 4, pattern: 'potential form', meaning: 'can do' },
  'to-omoimasu': { segmentIndex: 4, pattern: '〜と思います', meaning: 'I think' },
  'to-iimasu': { segmentIndex: 3, pattern: '〜と言います', meaning: 'say / call' },
  tsumori: { segmentIndex: 5, pattern: '〜つもりです', meaning: 'intend to' },
  yotei: { segmentIndex: 4, pattern: '〜予定です', meaning: 'plan to' },
  experience: { segmentIndex: 4, pattern: '〜たことがあります', meaning: 'have done before' },
  tari: { segmentIndex: 4, pattern: '〜たり〜たりする', meaning: 'do things like…' },
  nagara: { segmentIndex: 4, pattern: '〜ながら', meaning: 'while doing' },
  'mae-ni': { segmentIndex: 1, pattern: '〜前に', meaning: 'before' },
  'ato-de': { segmentIndex: 3, pattern: '〜あとで', meaning: 'after' },
  node: { segmentIndex: 3, pattern: '〜ので', meaning: 'because', answer: 'ので、', options: connectorChoices },
  'you-ni': { segmentIndex: 1, pattern: '〜ように', meaning: 'so that' },
  sugiru: { segmentIndex: 3, pattern: '〜すぎる', meaning: 'too much' },
  hajimeru: { segmentIndex: 2, pattern: '〜始める', meaning: 'begin to do' },
  owaru: { segmentIndex: 2, pattern: '〜終わる', meaning: 'finish doing' },
  tsuzukeru: { segmentIndex: 4, pattern: '〜続ける', meaning: 'continue doing' },
}

const sourceExercises = grammarBuilderExercises.map((exercise) => {
  const shortId = exercise.id.replace('sent-grammar-', '')
  const focus = focusById[shortId]
  if (!focus || !exercise.segments || !exercise.jlpt) {
    throw new Error(`Grammar practice setup is missing ${exercise.id}`)
  }

  return { exercise, focus }
})

function rotate<T>(items: T[], offset: number): T[] {
  return [...items.slice(offset), ...items.slice(0, offset)]
}

/** Trailing 。 gives away that an option ends the sentence, so answer choices never show it. */
function stripTrailingPeriod(text: string): string {
  return text.replace(/。+$/u, '')
}

/** Grammar choice drills made from every curated grammar sentence in Sentence Builder. */
export const grammarPracticeExercises: GrammarPracticeExercise[] = sourceExercises.map(({ exercise, focus }, index) => {
  const segments = exercise.segments ?? []
  const readings = exercise.segmentReadings ?? segments
  const answer = stripTrailingPeriod(focus.answer ?? segments[focus.segmentIndex])
  // Pure-kana answers (from focus.answer overrides) never need a reading.
  const answerReading = focus.answer ? undefined : stripTrailingPeriod(readings[focus.segmentIndex])

  const alternativeEntries = rotate(sourceExercises, index + 3)
    .map(({ exercise: candidate, focus: candidateFocus }) => {
      const candidateSegments = candidate.segments ?? []
      const candidateReadings = candidate.segmentReadings ?? candidateSegments
      const text = candidateSegments[candidateFocus.segmentIndex]
      const reading = candidateReadings[candidateFocus.segmentIndex]
      return {
        text: text ? stripTrailingPeriod(text) : '',
        reading: reading ? stripTrailingPeriod(reading) : reading,
      }
    })
    .filter((entry, entryIndex, entries) =>
      entry.text && entry.text !== answer && entries.findIndex((other) => other.text === entry.text) === entryIndex,
    )
    .slice(0, 3)

  const optionEntries = focus.options
    ? rotate(
        focus.options.map((option) => ({ text: stripTrailingPeriod(option), reading: undefined as string | undefined })),
        index % focus.options.length,
      )
    : rotate([{ text: answer, reading: answerReading }, ...alternativeEntries], index % 4)

  const options = optionEntries.map((entry) => entry.text)
  const optionReadings = optionEntries.map((entry) => entry.reading)

  const prompt = segments
    .map((segment, segmentIndex) => (segmentIndex === focus.segmentIndex ? focus.replacement ?? '___' : segment))
    .join('')
  const promptReading = segments
    .map((segment, segmentIndex) => {
      if (segmentIndex !== focus.segmentIndex) return readings[segmentIndex] ?? segment
      return focus.replacement ? `${focus.replacementReading ?? ''}___` : '___'
    })
    .join('')

  return {
    id: exercise.id,
    jlpt: exercise.jlpt as 'N5' | 'N4',
    prompt,
    promptReading,
    answer,
    answerReading,
    options,
    optionReadings,
    english: exercise.english,
    pattern: focus.pattern,
    meaning: focus.meaning,
  }
})
