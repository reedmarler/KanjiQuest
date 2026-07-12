import type { HeroSentenceFrame, HeroTemplate } from '../data/heroSentences'
import { getHeroEnglish } from './heroSentenceGloss'
import { predicateMatchesFrameTense, frameTenseRequirement } from './heroGrammarCoherence'
import { frameIsNatural, frameJapaneseIsValid } from './heroSentenceNatural'
import { wordFitsTemplate } from './heroWordFit'

const INVALID_ENGLISH = [
  / — /,
  /\babout about\b/i,
  /\bthe the\b/i,
  /\bis are\b/i,
  /\bare is\b/i,
  /goes to restaurant\./,
  /likes concise\./,
  /uses books\./,
  /\bI also is\b/,
  /\bI is\b/,
  /likes experience\./,
  /likes a ticket\./,
  /likes a map\./,
  /likes a date\./,
  /wants a date\./,
  /finds japanese fun\./,
  /finds a date fun\./,
  /buys a reservation\./,
  /goes to a date\./,
  /watches baseball\./,
  /watches pictures\./,
  /\band (She|He|My teacher|My friend) /,
  /\bwatched (novels?|literature|history books?|magazines?|the newspaper|books?|philosophy|economics)\b/i,
  /\bread (movies?|dramas?|anime|television|photos?)\b/i,
  /\blooked at (novels?|literature|magazines?|the newspaper)\b/i,
  /\b(I|He|She) (do|does) \w+\./,
  /can do cooking\./,
  /not great at a date\./,
  /good at a date\./,
  /likes politics\./,
  /likes the economy\./,
  /likes philosophy\./,
  /likes society\./,
  /likes international/,
  /likes research\./,
  /likes education\./,
]

export function heroEnglishIsValid(english: string): boolean {
  if (!english || english.length < 8) return false
  return !INVALID_ENGLISH.some((pattern) => pattern.test(english))
}

export function frameIsValid(frame: HeroSentenceFrame, template: HeroTemplate): boolean {
  if (!frameJapaneseIsValid(frame)) return false
  if (!wordFitsTemplate(frame.word, template, frame)) return false
  if (!frameIsNatural(frame, template)) return false
  if (!predicateMatchesFrameTense(frame.predicate, frameTenseRequirement(frame))) return false
  return heroEnglishIsValid(getHeroEnglish(frame))
}
