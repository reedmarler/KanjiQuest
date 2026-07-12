import type { CardProgress, JlptLevel, StudyCard } from './types'
import { isDue } from './srs'
import { shuffle } from './quiz'
import { getWrongPoolIds, type WrongPool } from './wrongPool'
import { prioritizeStrugglingCards } from './sentenceLab'

const FOUNDATION_LEVELS: JlptLevel[] = ['N5', 'N4']
const FOUNDATION_RATIO = 0.35
const WRONG_RATIO = 0.25
const SESSION_SIZE = 20

function isFoundation(card: StudyCard): boolean {
  return !!card.jlpt && FOUNDATION_LEVELS.includes(card.jlpt)
}

function pickDueAndNew(
  pool: StudyCard[],
  progress: Record<string, CardProgress>,
  limit: number,
): StudyCard[] {
  const due = pool.filter((c) => {
    const p = progress[c.id]
    return !p || isDue(p)
  })
  const unseen = pool.filter((c) => !progress[c.id])
  return shuffle([...due, ...unseen]).slice(0, limit)
}

/** Mix N5/N4 foundation + wrong-pool cards; skip easy cards until due. */
export function buildSession(
  cards: StudyCard[],
  allCards: StudyCard[],
  progress: Record<string, CardProgress>,
  wrongPool: WrongPool = {},
): StudyCard[] {
  const isFullReview = cards.length === allCards.length
  const foundationSlots = Math.round(SESSION_SIZE * FOUNDATION_RATIO)
  const wrongSlots = Math.min(
    Math.round(SESSION_SIZE * WRONG_RATIO),
    getWrongPoolIds(wrongPool).filter((id) => !id.startsWith('sent-')).length,
  )
  const mainSlots = SESSION_SIZE - foundationSlots - wrongSlots

  const scopedFoundation = isFullReview
    ? allCards.filter(isFoundation)
    : cards.filter(isFoundation)

  const foundation = pickDueAndNew(scopedFoundation, progress, foundationSlots)
  const usedIds = new Set(foundation.map((c) => c.id))

  const wrongIds = getWrongPoolIds(wrongPool)
    .filter((id) => !id.startsWith('sent-'))
    .slice(0, wrongSlots)
  const wrongCards = wrongIds
    .map((id) => allCards.find((c) => c.id === id))
    .filter((c): c is StudyCard => !!c && (isFullReview || cards.some((x) => x.id === c!.id)))
  wrongCards.forEach((c) => usedIds.add(c.id))

  const mainPool = cards.filter((c) => !usedIds.has(c.id))
  const main = prioritizeStrugglingCards(mainPool, progress, wrongPool, mainSlots)

  return shuffle([...foundation, ...wrongCards, ...main]).slice(0, SESSION_SIZE)
}
