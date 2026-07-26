import { readingCards } from '../data/readings'
import { readingEnglish } from '../data/readingEnglish'
import { readingSentenceKana } from '../data/readingSentenceKana'
import { sentenceExercises } from '../data/sentenceExercises'
import type { AnswerGloss } from './answerGloss'

export interface SentenceGlossData {
  english: string
  segments: string[]
  readings: string[]
  meanings: string[]
}

function buildExerciseGlossMap(): Record<string, SentenceGlossData> {
  const map: Record<string, SentenceGlossData> = {}

  for (const ex of sentenceExercises) {
    if (ex.segments && ex.segmentReadings && ex.segmentMeanings) {
      const sentence = ex.segments.join('')
      map[sentence] = {
        english: ex.english,
        segments: ex.segments,
        readings: ex.segmentReadings,
        meanings: ex.segmentMeanings,
      }
    }
  }

  return map
}

function buildReadingSentenceMap(): Record<string, AnswerGloss> {
  const map: Record<string, AnswerGloss> = {}

  for (const card of readingCards) {
    if (!card.sentence) continue
    const english = readingEnglish[card.id]
    const reading = readingSentenceKana[card.id]
    if (!english || !reading) continue

    map[card.sentence] = {
      english,
      text: card.sentence,
      reading,
      meaning: english,
    }
  }

  return map
}

const exerciseGlossMap = buildExerciseGlossMap()
const readingSentenceMap = buildReadingSentenceMap()

export function getSentenceGloss(sentence: string): AnswerGloss | null {
  const exercise = exerciseGlossMap[sentence]
  if (exercise) {
    return {
      english: exercise.english,
      segments: exercise.segments,
      readings: exercise.readings,
      meanings: exercise.meanings,
    }
  }

  return readingSentenceMap[sentence] ?? null
}
