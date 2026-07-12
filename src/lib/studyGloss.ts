import { getKanjiDetail } from '../data/kanjiDetails'
import { vocabBulkKanaMap } from '../data/vocabBulkKana'
import { vocabKanaMap } from '../data/vocabKana'
import type { AnswerGloss } from './answerGloss'
import { getContextKanaReading, getKanaReading } from './kanaReading'
import { getKanjiWordForm } from './kanjiWordForm'
import { getKanjiSentenceEnglish } from './kanjiSentenceEnglish'
import { getSentenceGloss } from './sentenceGloss'
import { renderSentence } from './quiz'
import { getVocabExample, vocabExampleGloss } from './vocabExamples'
import type { StudyCard } from './types'

const KANJI_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]/

export function getStudyCardKana(card: StudyCard): string | undefined {
  if (card.type === 'kanji') {
    const kana = getKanaReading(card)
    return kana || undefined
  }

  if (card.type === 'vocab') {
    return vocabKanaMap[card.id] ?? vocabBulkKanaMap[card.id]
  }

  return undefined
}

export function getStudyCardMeaning(card: StudyCard): string {
  return card.back.split('/')[0].trim()
}

export function getFlashcardAnswerGloss(card: StudyCard): AnswerGloss {
  const meaning = getStudyCardMeaning(card)

  if (card.type === 'vocab') {
    const example = getVocabExample(card)
    if (example) {
      return {
        english: meaning,
        sentenceEnglish: example.english,
        ...vocabExampleGloss(card, example),
      }
    }
    return {
      english: meaning,
      text: card.front,
      reading: getStudyCardKana(card),
    }
  }

  const wordForm = getKanjiWordForm(card)
  if (wordForm) {
    return {
      english: meaning,
      text: wordForm.word,
      reading: wordForm.kana,
    }
  }

  return {
    english: meaning,
    text: card.front,
    reading: getStudyCardKana(card),
  }
}

export function getReadingAnswerGloss(card: StudyCard): AnswerGloss | null {
  if (!card.sentence) return null
  return getSentenceGloss(card.sentence)
}

function kanjiHighlight(card: StudyCard): string {
  if (card.front.length === 1) return card.front
  const first = [...card.front].find((ch) => KANJI_RE.test(ch))
  return first ?? card.front
}

function buildKanjiExampleSentence(card: StudyCard): string | null {
  const detail = getKanjiDetail(card)
  if (detail.contextSentence) return detail.contextSentence

  const wordForm = getKanjiWordForm(card)
  if (wordForm) {
    const w = wordForm.word
    if (w.endsWith('しい')) return `ちょっと${w}。`
    if (w.endsWith('い')) return `とても${w}。`
    if (w.endsWith('る')) return `よく${w}。`
    return `${w}です。`
  }

  if (card.front.length > 1) {
    return `${card.front}です。`
  }

  const compound = detail.compounds[0]
  if (compound?.word) {
    return `${compound.word}。`
  }

  return null
}

function glossForSentence(card: StudyCard, sentence: string): AnswerGloss | null {
  const known = getSentenceGloss(sentence)
  if (known) {
    return {
      segments: known.segments,
      readings: known.readings,
      meanings: known.meanings,
      text: known.text,
      reading: known.reading,
      meaning: known.meaning,
    }
  }

  const detail = getKanjiDetail(card)
  const highlight = kanjiHighlight(card)
  if (!sentence.includes(highlight)) return null

  const parts = renderSentence(sentence, highlight)
  const reading = detail.contextReading ?? getContextKanaReading(card)

  return {
    segments: [parts.before, parts.target, parts.after],
    readings: [undefined, reading, undefined],
    meanings: [undefined, undefined, undefined],
  }
}

export function getKanjiExampleGloss(card: StudyCard): AnswerGloss | null {
  const sentence = buildKanjiExampleSentence(card)
  if (!sentence) return null
  return glossForSentence(card, sentence)
}

export function getKanjiQuizAnswerGloss(
  card: StudyCard,
  mode: string,
  contextSentence?: string,
): AnswerGloss {
  const meaning = getStudyCardMeaning(card)
  const sentence = mode === 'context' && contextSentence
    ? contextSentence
    : buildKanjiExampleSentence(card)

  if (sentence) {
    const example = glossForSentence(card, sentence)
    if (example) {
      const known = getSentenceGloss(sentence)
      const sentenceEnglish = getKanjiSentenceEnglish(card, sentence) ?? known?.english
      return { english: meaning, sentenceEnglish, ...example }
    }
  }

  return { english: meaning }
}
