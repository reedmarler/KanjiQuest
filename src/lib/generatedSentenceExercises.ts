import type { SentenceExercise } from '../data/sentenceExercises'
import { generateCategorySentence } from './categorySentenceEngine'
import type { GeneratedPreviewSentence } from './sentenceGeneratorPreview'
import { shuffle } from './quiz'
import type { JlptLevel } from './types'

export const GENERATED_BUILDER_SESSION_SIZE = 15
export const WIRED_BUILDER_LEVELS: readonly JlptLevel[] = ['N5', 'N4', 'N3']

const CATEGORY_BUILDER_PATTERNS: Record<Extract<JlptLevel, 'N5' | 'N4' | 'N3'>, Array<string | undefined>> = {
  N5: [undefined],
  N4: [undefined],
  N3: ['n3-08', 'n3-09', 'n3-10'],
}

function sentenceSeed() {
  return Math.floor((Date.now() + Math.random() * 1_000_000_000) % 1_000_000_000)
}

function builderSegments(sentence: GeneratedPreviewSentence) {
  const segments: Array<{ text: string; reading: string; meaning: string }> = []

  for (const part of sentence.furigana) {
    const reading = part.reading || part.text
    if (part.slot || segments.length === 0) {
      segments.push({
        text: part.text,
        reading,
        meaning: part.slot ? sentence.slots[part.slot]?.english ?? '' : '',
      })
      continue
    }

    const previous = segments.at(-1)!
    previous.text += part.text
    if (!/^[はをがにでへともからまで]$/.test(part.text)) {
      previous.reading += reading
    }
  }

  if (segments.length && !/[。！？!?]$/.test(segments.at(-1)!.text)) {
    segments.at(-1)!.text += '。'
    segments.at(-1)!.reading += '。'
  }

  return segments
}

function generatedExercise(level: JlptLevel, seed: number): SentenceExercise {
  const requestedPatternId =
    level === 'N5' || level === 'N4'
      ? CATEGORY_BUILDER_PATTERNS[level][0]
      : CATEGORY_BUILDER_PATTERNS.N3[seed % CATEGORY_BUILDER_PATTERNS.N3.length]
  const sentence = generateCategorySentence(seed, requestedPatternId, level as 'N5' | 'N4' | 'N3')
  if (!sentence) {
    throw new Error(`Could not generate ${level} sentence-builder exercise`)
  }
  const segments = builderSegments(sentence)
  const english = sentence.english.charAt(0).toUpperCase() + sentence.english.slice(1)

  return {
    id: `sent-generated-${level.toLowerCase()}-${sentence.frameId}-${seed}`,
    type: 'sentence-builder',
    segments: segments.map((segment) => segment.text),
    segmentReadings: segments.map((segment) => segment.reading),
    segmentMeanings: segments.map((segment) => segment.meaning),
    english,
    jlpt: level,
  }
}

export function buildGeneratedBuilderExercises(
  levels: readonly JlptLevel[],
  count = GENERATED_BUILDER_SESSION_SIZE,
  batch = 0,
): SentenceExercise[] {
  const wiredLevels = levels.filter((level) => WIRED_BUILDER_LEVELS.includes(level))
  if (!wiredLevels.length) return []

  const exercises: SentenceExercise[] = []
  const seenJapanese = new Set<string>()
  const attemptLimit = count * 8
  // Seeds advance by 37 per attempt, so shifting a whole attempt window per batch
  // keeps consecutive batches off each other's seeds even within the same second.
  const baseSeed = sentenceSeed() + batch * attemptLimit * 37

  for (let attempt = 0; attempt < attemptLimit && exercises.length < count; attempt += 1) {
    const level = wiredLevels[attempt % wiredLevels.length]!
    const seed = baseSeed + attempt * 37

    try {
      const exercise = generatedExercise(level, seed)
      const japanese = exercise.segments?.join('') ?? ''
      if (!japanese || seenJapanese.has(japanese)) continue
      seenJapanese.add(japanese)
      exercises.push(exercise)
    } catch {
      // A pattern with an incomplete data pool should not prevent the session from starting.
    }
  }

  return shuffle(exercises)
}

export function getGeneratedBuilderExerciseById(id: string): SentenceExercise | undefined {
  const match = /^sent-generated-(n[1-5])-(?:[^-]+-\d+-)?(\d+)$/.exec(id)
  if (!match) return undefined

  const level = match[1].toUpperCase() as JlptLevel
  if (!WIRED_BUILDER_LEVELS.includes(level)) return undefined

  try {
    return generatedExercise(level, Number(match[2]))
  } catch {
    return undefined
  }
}
