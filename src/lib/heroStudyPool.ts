import { allCards, getCardById } from '../data'
import type { HeroTemplate } from '../data/heroSentences'
import { charLength, isTopicCommentTemplate } from '../data/heroSentences'
import { frameIsValid } from './heroSentenceValidate'
import { cardAtJlptLevel, heroWordsAtJlptLevel, wordAllowedAtHeroLevel } from './heroJlpt'
import { isCuratedHeroWord } from './heroVocabPhrases'
import { wordFitsTemplate } from './heroWordFit'
import { getKanjiWordForm } from './kanjiWordForm'
import { isDue } from './srs'
import type { CardProgress, JlptLevel } from './types'
import { getWrongPoolIds, type WrongPool } from './wrongPool'

export interface HeroStudyPool {
  cardIds: string[]
}

function cardToHeroWord(id: string): string | null {
  const card = getCardById(id)
  if (!card) return null
  if (card.type === 'vocab') return card.front
  if (card.type === 'kanji') {
    const form = getKanjiWordForm(card)
    return form?.word ?? card.front
  }
  return null
}

function isStudyCardType(id: string): boolean {
  const card = getCardById(id)
  return card?.type === 'vocab' || card?.type === 'kanji'
}

/** Prioritized card ids from mistakes, due reviews, and struggling cards across decks. */
export function buildHeroStudyPool(
  wrongPool: WrongPool,
  progress: Record<string, CardProgress>,
  level: JlptLevel,
): HeroStudyPool {
  const ids: string[] = []
  const seen = new Set<string>()

  const add = (id: string) => {
    if (seen.has(id) || !isStudyCardType(id) || !cardAtJlptLevel(id, level)) return
    const word = cardToHeroWord(id)
    if (!word || !isCuratedHeroWord(word)) return
    seen.add(id)
    ids.push(id)
  }

  for (const id of getWrongPoolIds(wrongPool, 35)) {
    if (!id.startsWith('sent-')) add(id)
  }

  for (const card of allCards) {
    if (card.jlpt !== level) continue
    if (card.type !== 'vocab' && card.type !== 'kanji') continue
    add(card.id)
  }

  const dueCards = allCards
    .filter((c) => c.type === 'vocab' || c.type === 'kanji')
    .filter((c) => c.jlpt === level)
    .filter((c) => {
      const p = progress[c.id]
      return !p || isDue(p)
    })
    .sort((a, b) => {
      const pa = progress[a.id]
      const pb = progress[b.id]
      const struggleA = (pa?.incorrect ?? 0) - (pa?.correct ?? 0)
      const struggleB = (pb?.incorrect ?? 0) - (pb?.correct ?? 0)
      return struggleB - struggleA
    })

  for (const card of dueCards.slice(0, 40)) add(card.id)

  const struggling = allCards
    .filter((c) => c.type === 'vocab' || c.type === 'kanji')
    .filter((c) => c.jlpt === level)
    .filter((c) => {
      const p = progress[c.id]
      return p && p.incorrect > p.correct
    })
    .sort((a, b) => (progress[b.id]?.incorrect ?? 0) - (progress[a.id]?.incorrect ?? 0))

  for (const card of struggling.slice(0, 25)) add(card.id)

  for (const card of allCards) {
    if (card.type !== 'vocab' && card.type !== 'kanji') continue
    if (card.jlpt !== level) continue
    if (!progress[card.id]) add(card.id)
  }

  return { cardIds: ids }
}

function buildFrame(
  template: HeroTemplate,
  word: string,
  subject = '私',
  topicParticle = 'は',
) {
  if (isTopicCommentTemplate(template)) {
    return {
      prefix: template.prefix ?? '',
      subject: '',
      topicParticle: '',
      modifier: template.modifier ?? '',
      word,
      objectParticle: template.objectParticle,
      bridge: template.bridge ?? '',
      predicate: template.predicate,
    }
  }

  return {
    prefix: template.prefix ?? '',
    subject,
    topicParticle,
    modifier: template.modifier ?? '',
    word,
    objectParticle: template.objectParticle,
    bridge: template.bridge ?? '',
    predicate: template.predicate,
  }
}

export function buildTemplateWordPool(
  template: HeroTemplate,
  studyPool: HeroStudyPool,
  level: JlptLevel,
): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  const studyIds = studyPool.cardIds

  const tryAdd = (word: string, front = false) => {
    if (seen.has(word)) return
    if (!wordAllowedAtHeroLevel(word, level, studyIds)) return
    if (charLength(word) !== template.wordLength) return
    const frame = buildFrame(template, word)
    if (!wordFitsTemplate(word, template, frame)) return
    if (!frameIsValid(frame, template)) return
    seen.add(word)
    if (front) result.unshift(word)
    else result.push(word)
  }

  for (const id of studyIds) {
    const word = cardToHeroWord(id)
    if (!word) continue
    tryAdd(word, true)
  }

  for (const word of template.words) {
    tryAdd(word)
  }

  for (const word of heroWordsAtJlptLevel(level)) {
    tryAdd(word)
  }

  if (result.length > 0) return result

  return template.words.filter((word) => {
    if (!wordAllowedAtHeroLevel(word, level, studyIds)) return false
    if (charLength(word) !== template.wordLength) return false
    const frame = buildFrame(template, word)
    return frameIsValid(frame, template)
  })
}

export { cardToHeroWord }
