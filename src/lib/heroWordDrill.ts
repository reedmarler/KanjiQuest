import { getCardById } from '../data'
import { kanjiKanaMap } from '../data/kanjiKana'
import { vocabBulkKanaMap } from '../data/vocabBulkKana'
import { vocabKanaMap } from '../data/vocabKana'
import { buildHeroStudyPool } from './heroStudyPool'
import { cardAtJlptLevel, cardsAtJlptLevel } from './heroJlpt'
import { getKanjiWordForm } from './kanjiWordForm'
import type { CardProgress, JlptLevel } from './types'
import type { WrongPool } from './wrongPool'

export interface HeroWordDrillItem {
  cardId: string
  word: string
  reading?: string
  meaning: string
}

const KANJI_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]/
const KANA_RE = /[\u3040-\u309F\u30A0-\u30FF]/
const KANA_ONLY_RE = /^[\u3040-\u309F\u30A0-\u30FFー・]+$/

function kanaReading(reading: string | undefined): string | undefined {
  if (!reading || !KANA_ONLY_RE.test(reading)) return undefined
  return reading
}

function meaningFromBack(back: string): string {
  const head = back.split('/')[0].trim()
  if (!head) return back
  return head.charAt(0).toUpperCase() + head.slice(1)
}

function isDrillWord(word: string): boolean {
  if (!word || word.length > 10) return false
  if (/[。、！？\s]/.test(word)) return false
  return KANJI_RE.test(word) || KANA_RE.test(word)
}

function cardToDrillItem(id: string): HeroWordDrillItem | null {
  const card = getCardById(id)
  if (!card || (card.type !== 'vocab' && card.type !== 'kanji')) return null

  let word = card.front
  let reading: string | undefined

  if (card.type === 'kanji') {
    const form = getKanjiWordForm(card)
    if (form) {
      word = form.word
      reading = kanaReading(form.kana)
    } else {
      reading = kanaReading(kanjiKanaMap[card.id])
    }
  } else {
    reading = kanaReading(
      vocabKanaMap[card.id] ?? vocabBulkKanaMap[card.id],
    )
  }

  if (!isDrillWord(word)) return null

  return {
    cardId: id,
    word,
    reading,
    meaning: meaningFromBack(card.back),
  }
}

export function buildHeroWordDrill(
  wrongPool: WrongPool,
  progress: Record<string, CardProgress> = {},
  level: JlptLevel,
): HeroWordDrillItem[] {
  const studyPool = buildHeroStudyPool(wrongPool, progress, level)
  const items: HeroWordDrillItem[] = []
  const seen = new Set<string>()

  const add = (id: string) => {
    if (!cardAtJlptLevel(id, level)) return
    const item = cardToDrillItem(id)
    if (!item || seen.has(item.word)) return
    seen.add(item.word)
    items.push(item)
  }

  const studyPriority = new Set(studyPool.cardIds)

  for (const id of studyPool.cardIds) add(id)

  for (const id of cardsAtJlptLevel(level)) {
    if (studyPriority.has(id)) continue
    add(id)
    if (items.length >= 96) break
  }

  return items
}
