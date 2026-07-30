import type { StudyCard } from './types'
import { HERO_WORD_POS_INDEX } from '../data/heroPosVocabulary'
import {
  POS_SLOT_TO_CATEGORY,
  swappableSlotsInTemplate,
  type PosSlotKey,
} from '../data/heroPosTemplates'
import {
  compileSegments,
  fillTemplate,
  HERO_POS_TEMPLATES_ALL,
  segmentsToJapanese,
  type PosFills,
} from './posSentenceEngine'
import { posFillsAreValid } from './posSentenceVet'
import { sentenceIsViable } from './sentenceViability'
import { getHeroEnglish, getSegmentReading } from './heroSentenceGloss'
import { isVerbEndingId } from './verbEndings'
import type { HeroSentenceFrame } from '../data/heroSentences'

/** Same safe, standalone templates the dashboard's hero sentence rotator uses. */
const ROTATOR_SAFE_TEMPLATE_IDS = new Set([
  1, 2, 11, 20, 21, 22, 23, 24,
  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
  // Simple subject+adjective statements — verified separately from the
  // verb templates above. id 3 ([N] は [N] が [I-Adj]) is deliberately
  // excluded: it pairs two unrelated nouns and produces nonsense like
  // "The train — my teacher is early".
  25, 27, 28, 80, 81,
])

const SAFE_TEMPLATES = HERO_POS_TEMPLATES_ALL.filter((template) => ROTATOR_SAFE_TEMPLATE_IDS.has(template.id))

const ATTEMPTS_PER_TEMPLATE = 6

/**
 * Interrogatives get POS-tagged as ordinary pronouns/adverbs/nouns by the
 * tagger, but slotting them into a declarative template produces nonsense
 * ("どこ drinks tea") since there's no English gloss or sentence logic for
 * question words in this generator. Safer to just skip them.
 */
const QUESTION_WORDS = new Set([
  'どこ', 'どちら', 'どっち', 'どの', 'どんな', 'どう', 'どうして', 'なぜ',
  'いつ', 'だれ', '誰', 'どなた', '何', 'なに', 'なん', 'いくつ', 'いくら',
  'どれ', 'どのくらい', 'どのぐらい',
  // Grammar suffixes (desiderative "-tai", comparison "mitai") mistagged as
  // ordinary nouns by the tagger — not real standalone vocabulary.
  'たい', 'みたい',
])

/** Grammar words / negation forms mistagged as adjectives by the tagger — not real descriptive adjectives. */
const NON_ADJ_WORDS = new Set(['ない', '無い', 'くらい', 'ぐらい', 'いい', 'よい'])

function isUsableAdjective(word: string, category: string): boolean {
  if (NON_ADJ_WORDS.has(word)) return false
  if (word.endsWith('です') || word.endsWith('だ')) return false
  if (category === 'i_adj' && !word.endsWith('い')) return false
  return true
}

export interface VocabExampleSentence {
  japanese: string
  reading: string
  english: string
}

const cache = new Map<string, VocabExampleSentence | null>()

function templatesForSlot(slot: PosSlotKey) {
  return SAFE_TEMPLATES.filter((template) => swappableSlotsInTemplate(template).includes(slot))
}

function seedFor(id: string): number {
  let seed = 0
  for (let index = 0; index < id.length; index += 1) seed = (seed * 31 + id.charCodeAt(index)) >>> 0
  return seed
}

function frameFromFills(templateId: number, fills: PosFills): HeroSentenceFrame {
  const template = SAFE_TEMPLATES.find((candidate) => candidate.id === templateId)!
  return {
    templateId,
    fills,
    segments: compileSegments(template, fills),
    generatedPatternId: `vocab-example-${templateId}`,
    prefix: '',
    subject: '',
    topicParticle: '',
    modifier: '',
    word: '',
    objectParticle: '',
    bridge: '',
    predicate: '',
  }
}

/**
 * Builds one example sentence that naturally uses the given vocab word, by
 * forcing it into a matching slot (noun/verb/adjective/etc.) of one of the
 * dashboard's vetted sentence templates, then reusing the same grammar
 * validator and English gloss the hero sentence rotator already relies on.
 * Returns undefined when the word's part of speech isn't one we can safely
 * slot into a template (particles, fixed expressions, etc.).
 */
export function getVocabExampleSentence(card: StudyCard): VocabExampleSentence | undefined {
  const cached = cache.get(card.id)
  if (cached !== undefined) return cached ?? undefined

  const result = buildExample(card)
  cache.set(card.id, result ?? null)
  return result
}

function buildExample(card: StudyCard): VocabExampleSentence | undefined {
  const word = card.front
  if (QUESTION_WORDS.has(word)) return undefined
  const category = HERO_WORD_POS_INDEX[word]
  if (!category || category === 'particle' || category === 'auxiliary' || category === 'other') return undefined
  if ((category === 'i_adj' || category === 'na_adj') && !isUsableAdjective(word, category)) return undefined

  const slot = (Object.keys(POS_SLOT_TO_CATEGORY) as PosSlotKey[]).find((key) => POS_SLOT_TO_CATEGORY[key] === category)
  if (!slot) return undefined

  const candidateTemplates = templatesForSlot(slot)
  if (!candidateTemplates.length) return undefined

  const seed = seedFor(card.id)

  for (let templateOffset = 0; templateOffset < candidateTemplates.length; templateOffset += 1) {
    const template = candidateTemplates[(seed + templateOffset) % candidateTemplates.length]!

    for (let attempt = 0; attempt < ATTEMPTS_PER_TEMPLATE; attempt += 1) {
      const baseFills = fillTemplate(template, seed + templateOffset * 97 + attempt * 13)
      const fills: PosFills = { ...baseFills, [slot]: word }
      if (!posFillsAreValid(template, fills)) continue

      // Only accept sentences whose tense/ending goes through the verb-ending
      // gloss path — other template shapes can compile valid Japanese but
      // fall through to English phrasing that doesn't mark tense correctly.
      // Adjective-only templates have no verb slot at all, so they're exempt.
      const hasVerbSlot = swappableSlotsInTemplate(template).includes('V')
      if (hasVerbSlot && !isVerbEndingId(fills.VEnd)) continue

      const segments = compileSegments(template, fills)
      const japanese = segmentsToJapanese(segments)
      if (!sentenceIsViable(japanese, template, fills)) continue

      const frame = frameFromFills(template.id, fills)
      const english = getHeroEnglish(frame)
      if (!english) continue

      const reading = segments.map((segment) => segment.reading ?? getSegmentReading(segment.text)).join('')
      return { japanese, reading, english }
    }
  }

  return undefined
}
