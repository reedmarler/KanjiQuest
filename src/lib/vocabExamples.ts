import type { StudyCard } from './types'
import { vocabBulkKanaMap } from '../data/vocabBulkKana'
import { vocabKanaMap } from '../data/vocabKana'
import { getSentenceGloss } from './sentenceGloss'

const KANJI_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]/
const KANA_RE = /[\u3040-\u309F\u30A0-\u30FF]/

export interface VocabExample {
  sentence: string
  english: string
}

function findHighlight(front: string, sentence: string): { target: string; idx: number } | null {
  if (sentence.includes(front)) {
    return { target: front, idx: sentence.indexOf(front) }
  }
  for (let len = front.length; len >= 1; len--) {
    const sub = front.slice(0, len)
    if (!(KANJI_RE.test(sub) || KANA_RE.test(sub))) continue
    const idx = sentence.indexOf(sub)
    if (idx !== -1) return { target: sub, idx }
  }
  return null
}

function getVocabKana(card: StudyCard): string | undefined {
  return vocabKanaMap[card.id] ?? vocabBulkKanaMap[card.id]
}

function parseHintExample(hint: string): VocabExample | null {
  const eq = hint.indexOf(' = ')
  if (eq === -1) return null
  const sentence = hint.slice(0, eq).trim()
  const english = hint.slice(eq + 3).trim()
  if (!sentence || !english) return null
  return { sentence, english }
}

function buildTemplateExample(card: StudyCard): VocabExample | null {
  const front = card.front
  const meaning = card.back.split('/')[0].trim()

  if (front.endsWith('する')) {
    return { sentence: `毎日${front}。`, english: `I ${meaning} every day.` }
  }
  if (front.endsWith('る')) {
    return { sentence: `よく${front}。`, english: `I often ${meaning}.` }
  }
  if (front.endsWith('い') || front.endsWith('しい')) {
    return { sentence: `とても${front}。`, english: `It's very ${meaning.toLowerCase()}.` }
  }
  if (front.endsWith('です')) {
    return { sentence: front, english: meaning + '.' }
  }
  if (front.endsWith('に')) {
    return { sentence: `${front}行きたい。`, english: `I want to go ${meaning}.` }
  }
  return { sentence: `${front}が好きです。`, english: `I like ${meaning.toLowerCase()}.` }
}

export function getVocabExample(card: StudyCard): VocabExample | null {
  if (card.hint) {
    const fromHint = parseHintExample(card.hint)
    if (fromHint) return fromHint
  }
  return buildTemplateExample(card)
}

export function vocabExampleGloss(card: StudyCard, example: VocabExample) {
  const known = getSentenceGloss(example.sentence)
  if (known?.segments?.length) {
    return {
      segments: known.segments,
      readings: known.readings,
      meanings: known.meanings,
    }
  }

  const highlight = findHighlight(card.front, example.sentence)
  const reading = getVocabKana(card)

  if (!highlight || !reading) {
    return {
      segments: [example.sentence],
      readings: [undefined],
      meanings: [undefined],
    }
  }

  const { target, idx } = highlight
  return {
    segments: [
      example.sentence.slice(0, idx),
      target,
      example.sentence.slice(idx + target.length),
    ],
    readings: [undefined, reading, undefined],
    meanings: [undefined, undefined, undefined],
  }
}
