import { kanjiCards } from '../data/kanji'
import { getKanjiDetail } from '../data/kanjiDetails'
import { getContextKanaReading, getKanaReading } from './kanaReading'
import { getKanjiDisplayText, getKanjiWordForm } from './kanjiWordForm'
import { shuffle } from './quiz'
import type { StudyCard, JlptLevel } from './types'
import type { JlptFilter, KanjiLabMode } from './kanjiTypes'
import { isDue } from './srs'
import type { CardProgress } from './types'

const QUIZ_MODES: KanjiLabMode[] = ['recognize', 'read', 'recall', 'breakdown', 'context']
const SESSION_SIZE = 15
const CONFIDENT_SLOT_RATIO = 0.25

export interface KanjiQuizState {
  prompt: string
  correct: string
  options: string[]
  showChar: boolean
  sentence?: string
  highlight?: string
}

export function buildKanjiQuiz(card: StudyCard, mode: KanjiLabMode, pool: StudyCard[]): KanjiQuizState {
  const wordForm = getKanjiWordForm(card)
  const displayText = getKanjiDisplayText(card)
  const detail = getKanjiDetail(card)

  if (mode === 'recognize' || mode === 'breakdown') {
    return {
      prompt: 'What does this kanji mean?',
      correct: card.back.split('/')[0].trim(),
      options: buildMeaningOptions(card.back, pool, card.id),
      showChar: true,
    }
  }
  if (mode === 'read') {
    return {
      prompt: 'How do you read this kanji?',
      correct: getKanaReading(card),
      options: buildReadingOptions(card, pool),
      showChar: true,
    }
  }
  if (mode === 'recall') {
    return {
      prompt: `Which ${wordForm ? 'word' : 'kanji'} means "${card.back.split('/')[0].trim()}"?`,
      correct: displayText,
      options: buildKanjiCharOptions(displayText, pool, card.id),
      showChar: false,
    }
  }
  if (mode === 'context') {
    const highlight = card.front.length === 1 ? card.front : [...card.front][0]
    const sentence = detail.contextSentence ?? wordForm?.word ?? detail.compounds[0]?.word ?? card.front
    return {
      prompt: 'context',
      sentence,
      highlight,
      correct: getContextKanaReading(card),
      options: buildContextReadingOptions(card, pool),
      showChar: false,
    }
  }
  return { prompt: '', correct: '', options: [], showChar: true }
}

export function filterKanjiByJlpt(level: JlptFilter): StudyCard[] {
  if (level === 'All') return kanjiCards
  return kanjiCards.filter((c) => c.jlpt === level)
}

export function buildKanjiLabSession(
  mode: KanjiLabMode,
  level: JlptFilter,
  progress: Record<string, CardProgress>,
  confidentIds: Set<string> = new Set(),
): { cards: StudyCard[]; modes: KanjiLabMode[] } {
  const pool = filterKanjiByJlpt(level)
  const drilling = pool.filter((c) => !confidentIds.has(c.id))
  const confidentDue = pool.filter((c) => {
    if (!confidentIds.has(c.id)) return false
    const p = progress[c.id]
    return !p || isDue(p)
  })

  let cards: StudyCard[]

  if (drilling.length > 0) {
    const confidentSlots = Math.min(
      Math.round(SESSION_SIZE * CONFIDENT_SLOT_RATIO),
      confidentDue.length,
    )
    const drillSlots = SESSION_SIZE - confidentSlots
    const drillCards = shuffle(drilling).slice(0, drillSlots)
    const used = new Set(drillCards.map((c) => c.id))
    const confidentCards = shuffle(confidentDue.filter((c) => !used.has(c.id))).slice(0, confidentSlots)
    cards = shuffle([...drillCards, ...confidentCards])

    if (cards.length < SESSION_SIZE) {
      const extras = shuffle(
        drilling.filter((c) => !used.has(c.id) && !cards.some((x) => x.id === c.id)),
      ).slice(0, SESSION_SIZE - cards.length)
      cards = shuffle([...cards, ...extras])
    }
  } else {
    const due = pool.filter((c) => {
      const p = progress[c.id]
      return !p || isDue(p)
    })
    const unseen = pool.filter((c) => !progress[c.id])
    cards = shuffle([...due, ...unseen]).slice(0, SESSION_SIZE)
  }

  if (mode === 'mixed') {
    return {
      cards,
      modes: cards.map(() => QUIZ_MODES[Math.floor(Math.random() * QUIZ_MODES.length)]),
    }
  }

  return { cards, modes: cards.map(() => mode) }
}

export function buildMeaningOptions(
  correct: string,
  pool: StudyCard[],
  cardId: string,
): string[] {
  const answer = correct.split('/')[0].trim()
  const seen = new Set<string>([answer])
  const distractors = shuffle(
    pool
      .filter((c) => c.id !== cardId)
      .map((c) => c.back.split('/')[0].trim())
      .filter((m) => m && m !== answer && !seen.has(m) && (seen.add(m), true)),
  ).slice(0, 3)
  return shuffle([answer, ...distractors])
}

export function buildReadingOptions(card: StudyCard, pool: StudyCard[]): string[] {
  const correct = getKanaReading(card)
  const seen = new Set<string>([correct])
  const distractors = shuffle(
    pool
      .filter((c) => c.id !== card.id)
      .map(getKanaReading)
      .filter((r) => r && r !== correct && !seen.has(r) && (seen.add(r), true)),
  ).slice(0, 3)
  return shuffle([correct, ...distractors])
}

export function buildKanjiCharOptions(
  correct: string,
  pool: StudyCard[],
  cardId: string,
): string[] {
  const seen = new Set<string>([correct])
  const distractors = shuffle(
    pool
      .filter((c) => c.id !== cardId)
      .map((c) => getKanjiDisplayText(c))
      .filter((w) => w && w !== correct && !seen.has(w) && (seen.add(w), true)),
  ).slice(0, 3)
  return shuffle([correct, ...distractors])
}

export function buildContextReadingOptions(card: StudyCard, pool: StudyCard[]): string[] {
  const correct = getContextKanaReading(card)
  const seen = new Set<string>([correct])
  const distractors = shuffle(
    pool
      .filter((c) => c.id !== card.id)
      .map(getContextKanaReading)
      .filter((r) => r && r !== correct && !seen.has(r) && (seen.add(r), true)),
  ).slice(0, 3)
  return shuffle([correct, ...distractors])
}

export function kanjiProgressByLevel(
  progress: Record<string, CardProgress>,
  learnedFn: (p: CardProgress) => boolean,
): Record<JlptLevel | 'All', { total: number; learned: number }> {
  const levels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
  const result = {} as Record<JlptLevel | 'All', { total: number; learned: number }>

  let allTotal = 0
  let allLearned = 0

  for (const level of levels) {
    const cards = kanjiCards.filter((c) => c.jlpt === level)
    const learned = cards.filter((c) => {
      const p = progress[c.id]
      return p && learnedFn(p)
    }).length
    result[level] = { total: cards.length, learned }
    allTotal += cards.length
    allLearned += learned
  }

  result.All = { total: allTotal, learned: allLearned }
  return result
}
