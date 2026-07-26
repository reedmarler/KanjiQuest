import type { SentenceExercise } from '../data/sentenceExercises'
import { generateCategorySentence } from './categorySentenceEngine'
import { generatePreviewSentence, type GeneratedPreviewSentence } from './sentenceGeneratorPreview'
import { shuffle } from './quiz'
import { GENERATION_COMPLEXITIES, patternsForComplexity, type GenerationComplexity } from './generationComplexity'

export const GENERATED_BUILDER_SESSION_SIZE = 15
export const WIRED_BUILDER_LEVELS: readonly GenerationComplexity[] = GENERATION_COMPLEXITIES

function sentenceSeed() {
  return Math.floor((Date.now() + Math.random() * 1_000_000_000) % 1_000_000_000)
}

// A bare particle (は/を/から/くらい/…) reads naturally glued onto the tile
// before it. A full grammar ending — にほかならない, ものだ, どころか — is its
// own idea and deserves its own tile, even though it also has no slot. Short
// length plus not looking like a complete predicate is a good enough proxy:
// real endings are either long or finish in a predicate-final form (だ/です/
// ます/ない and their conjugations).
function isGluableParticle(text: string) {
  return text.length <= 3 && !/(?:だ|です|ます|ました|ません|でした|ない)。?$/.test(text)
}

function builderSegments(sentence: GeneratedPreviewSentence) {
  const segments: Array<{ text: string; reading: string; meaning: string }> = []

  for (const part of sentence.furigana) {
    const reading = part.reading || part.text
    if (part.slot || segments.length === 0 || !isGluableParticle(part.text)) {
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

function generatedExercise(complexity: GenerationComplexity, seed: number): SentenceExercise {
  const patterns = patternsForComplexity(complexity)
  const pattern = patterns[seed % patterns.length]
  if (!pattern) throw new Error(`Could not find a Level ${complexity} template`)
  const sentence = pattern.jlpt === 'N1' || pattern.jlpt === 'N2'
    ? generatePreviewSentence(pattern.jlpt, seed, undefined, pattern.id, true)
    : generateCategorySentence(seed, pattern.id, pattern.jlpt)
  if (!sentence) {
    throw new Error(`Could not generate Level ${complexity} sentence-builder exercise`)
  }
  const segments = builderSegments(sentence)
  const english = sentence.english.charAt(0).toUpperCase() + sentence.english.slice(1)

  return {
    id: `sent-generated-l${complexity}-${sentence.frameId}-${seed}`,
    type: 'sentence-builder',
    segments: segments.map((segment) => segment.text),
    segmentReadings: segments.map((segment) => segment.reading),
    segmentMeanings: segments.map((segment) => segment.meaning),
    english,
    jlpt: pattern.jlpt,
  }
}

export function buildGeneratedBuilderExercises(
  levels: readonly GenerationComplexity[],
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
  const match = /^sent-generated-l([1-5])-(?:[^-]+-\d+-)?(\d+)$/.exec(id)
  if (!match) return undefined

  const level = Number(match[1]) as GenerationComplexity
  if (!WIRED_BUILDER_LEVELS.includes(level)) return undefined

  try {
    return generatedExercise(level, Number(match[2]))
  } catch {
    return undefined
  }
}
