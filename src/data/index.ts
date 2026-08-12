import { hiraganaCards, katakanaCards } from './kana'
import { vocabularyCards } from './vocabulary'
import { vocabBulkCards } from './vocabBulk'
import { vocabBulkHeroCards } from './vocabBulkHero'
import { vocabBulkListCards } from './vocabBulkList'
import { vocabTop1000Cards } from './vocabTop1000'
import { vocabCoreExpansionCards } from './vocabCoreExpansion'
import { vocabAdverbCards } from './vocabAdverbs'
import { vocabVerbCards } from './vocabVerbs'
import { vocabAdjectiveCards } from './vocabAdjectives'
import { vocabCategoryFillCards } from './vocabCategoryFill'
import { vocabFocusCards } from './vocabFocusSets'
import { userAddedVocabCards } from './userAddedVocab'
import { kanjiCards } from './kanji'
import { readingCards } from './readings'
import { readingEnglish } from './readingEnglish'
import { additionalVocabularySenseCards } from './vocabularySenseOverrides'
import { grammarCards } from './grammar'
import { toHiragana, toRomaji } from 'wanakana'
import type { StudyCard } from '../lib/types'

const readingCardsWithEnglish: StudyCard[] = readingCards.map((card) => ({
  ...card,
  english: readingEnglish[card.id],
}))

/**
 * Decks were imported from separate sources that overlap heavily, so 予定 and
 * 約束 each arrive as four cards with four ids and four near-identical glosses.
 * Everything downstream reads `allCards` — the browse counts, quiz sessions,
 * and the generator's own word pool — so a word repeated four times is four
 * chances to be asked the same question and four copies of one record in the
 * generator.
 *
 * Rank decides which copy survives, not deck order:
 *
 *   0  hand-authored and reviewed — vocabulary.ts, the curated part-of-speech
 *      decks, sense splits, user additions. Best glosses ("hot (object/liquid)"
 *      rather than a bare "hot"), so these win outright.
 *   1  bulk imports.
 *   2  study-only decks. `isStudyOnlyDeck` in categorySentenceEngine refuses
 *      these by id prefix, so keeping one over its canonical twin would quietly
 *      drop the word out of sentence generation entirely.
 */
const REVIEWED_DECK = /^(vocab-(n[1-5]|verb|adj|adverb|sense)-|user-)/
const STUDY_ONLY_DECK = /^vocab-(core-expansion|focus)-/

function deckRank(id: string) {
  if (REVIEWED_DECK.test(id)) return 0
  return STUDY_ONLY_DECK.test(id) ? 2 : 1
}

/**
 * Readings are romaji in the hand-authored decks and kana in the imported ones,
 * so both are pushed through kana and back to settle on one spelling: "yotei"
 * and よてい are one word, and so are つづく and "tsuzuku" (romaji cannot say
 * whether ず or づ was meant, but the round trip picks the same one twice).
 *
 * The long-vowel mark expands to the vowel it repeats — にゅーす and "nyuusu"
 * are the same word — rather than being dropped, which would also have merged
 * おばさん with おばあさん.
 *
 * The reading stays in the key because it is the only thing separating a
 * genuine sense split — 表（omote）"surface" from 表（hyou）"table", 開く
 * (aku) from 開く (hiraku) — from a repeat.
 */
function senseKey(card: StudyCard) {
  const reading = toRomaji(toHiragana((card.reading ?? '').trim().toLowerCase())).replace(/([aeiou])-/g, '$1$1')
  return `${card.front.trim()}|${reading}`
}

function dedupeVocab(cards: StudyCard[]): StudyCard[] {
  const winners = new Map<string, StudyCard>()
  for (const card of cards) {
    if (card.type !== 'vocab') continue
    const key = senseKey(card)
    const held = winners.get(key)
    if (!held || deckRank(card.id) < deckRank(held.id)) winners.set(key, card)
  }
  const kept = new Set(winners.values())
  return cards.filter((card) => card.type !== 'vocab' || kept.has(card))
}

const everyCard: StudyCard[] = [
  ...hiraganaCards,
  ...katakanaCards,
  ...vocabularyCards,
  ...vocabBulkCards,
  ...vocabBulkHeroCards,
  ...vocabBulkListCards,
  ...vocabTop1000Cards,
  ...vocabCoreExpansionCards,
  ...vocabAdverbCards,
  ...vocabVerbCards,
  ...vocabAdjectiveCards,
  ...vocabCategoryFillCards,
  ...vocabFocusCards,
  ...additionalVocabularySenseCards,
  ...userAddedVocabCards,
  ...grammarCards,
  ...kanjiCards,
  ...readingCardsWithEnglish,
]

export const allCards: StudyCard[] = dedupeVocab(everyCard)

export function getCardById(id: string): StudyCard | undefined {
  return allCards.find((c) => c.id === id)
}
