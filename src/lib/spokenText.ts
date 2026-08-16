/**
 * What the voice should say for a study card.
 *
 * One resolution shared by the app and by scripts/generate-audio.ts. It has to
 * be shared: pre-rendered clips are keyed by a hash of the spoken text alone,
 * so if the two ever disagree the app asks for a clip that was never rendered
 * and silently drops to the browser voice.
 *
 * The order matters. A card's own `reading` is romaji on roughly half the
 * vocabulary ("jikan" for 時間), and a hosted engine reads romaji as English —
 * so the curated kana maps come first, the card's reading is used only when it
 * is genuinely Japanese, and the written form is the last resort. Kanji is
 * last because it leaves the engine to guess between readings, which is the
 * problem `reading` was meant to solve in the first place.
 */
import { getStudyCardKana } from './studyGloss'
import type { StudyCard } from './types'

const LATIN = /[A-Za-z]/
const JAPANESE = /[぀-ゟ゠-ヿ一-鿿㐀-䶿]/

/**
 * The text to speak, or '' when the card has nothing Japanese to say — some
 * grammar cards are English labels ("Plain form: dictionary form"), and
 * narrating those in a Japanese voice helps nobody. SpeakButtons renders
 * nothing for empty text, and the generator skips it rather than paying to
 * synthesize it.
 */
export function spokenTextForCard(card: StudyCard): string {
  const kana = getStudyCardKana(card)?.trim()
  if (kana && !LATIN.test(kana)) return kana

  const reading = card.reading?.trim()
  if (reading && !LATIN.test(reading) && JAPANESE.test(reading)) return reading

  // Latin anywhere in the written form disqualifies it. Some grammar cards
  // are labels rather than words ("Plain form: 〜ない"), and speaking one
  // narrates "Plain form" in English before reaching the Japanese.
  const front = card.front?.trim() ?? ''
  return JAPANESE.test(front) && !LATIN.test(front) ? front : ''
}
