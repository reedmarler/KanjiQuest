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
import { GENERATED_VOCAB_EXAMPLES } from '../data/vocabExamples.generated'
import { posFillsAreValid } from './posSentenceVet'
import { sentenceIsViable } from './sentenceViability'
import { getHeroEnglish, getSegmentReading } from './heroSentenceGloss'
import { isVerbEndingId } from './verbEndings'
import type { HeroSentenceFrame } from '../data/heroSentences'

/**
 * Same safe, standalone templates the dashboard's hero sentence rotator
 * uses, plus a mix of adjective statement shapes: plain/です (25, 80, 81),
 * "finds N adjective" (27, 28), and "〜と思う" ("I think...", 151/152).
 * Mixing these in (rather than forcing every adjective through one fixed
 * pattern) keeps example sentences from feeling repetitive. id 3
 * ([N] は [N] が [I-Adj]) stays excluded: it pairs two unrelated nouns and
 * produces nonsense like "The train — my teacher is early".
 */
const ROTATOR_SAFE_TEMPLATE_IDS = new Set([
  1, 2, 11, 20, 21, 22, 23, 24,
  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
  25, 27, 28, 80, 81, 151, 152,
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

export interface VocabExampleSegment {
  text: string
  reading?: string
}

export interface VocabExampleSentence {
  japanese: string
  reading: string
  english: string
  segments: VocabExampleSegment[]
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

  // categorySentenceEngine is the richer model — it enforces the per-word
  // semantic compatibility rules (what can be eaten, who can flee where, which
  // adjective describes what) that this module's POS templates have no notion
  // of, so its sentences are preferred wherever it can produce one. Generating
  // them at render time is far too slow in bulk, so they are precomputed into
  // GENERATED_VOCAB_EXAMPLES and looked up here. The POS-template builder still
  // covers the words the engine has no rules for yet; as vocabulary gains
  // curated category/tag data, more words move to the shared engine on the next
  // `npm run generate:vocab-examples`.
  const generated = GENERATED_VOCAB_EXAMPLES[card.front]
  const result = generated ? { ...generated } : buildExample(card) ?? buildGuaranteedExample(card)
  cache.set(card.id, result ?? null)
  return result
}

/**
 * Every focused-vocabulary card should have readable context. Some fixed
 * expressions and nouns do not fit the rotator's semantic slots yet; for
 * those, use a natural meta-language sentence instead of fabricating an
 * unsafe collocation (for example, "use thunder" or "eat a receipt").
 */
function buildGuaranteedExample(card: StudyCard): VocabExampleSentence {
  const wordReading = card.reading || card.front

  if (card.front === '冷凍庫') {
    return {
      japanese: '冷凍庫に肉を入れます。',
      reading: 'れいとうこににくをいれます。',
      english: 'I put meat in the freezer.',
      segments: [
        { text: card.front, reading: wordReading },
        { text: 'に肉を入れます。', reading: 'ににくをいれます。' },
      ],
    }
  }

  const variants: Array<() => VocabExampleSentence> = [
    () => ({
      japanese: `「${card.front}」をノートに書きます。`,
      reading: `「${wordReading}」をノートにかきます。`,
      english: `I write “${card.front}” in my notebook.`,
      segments: [{ text: '「' }, { text: card.front, reading: wordReading }, { text: '」をノートに書きます。', reading: '」をノートにかきます。' }],
    }),
    () => ({
      japanese: `「${card.front}」の意味を辞書で調べます。`,
      reading: `「${wordReading}」のいみをじしょでしらべます。`,
      english: `I look up the meaning of “${card.front}.”`,
      segments: [{ text: '「' }, { text: card.front, reading: wordReading }, { text: '」の意味を辞書で調べます。', reading: '」のいみをじしょでしらべます。' }],
    }),
    () => ({
      japanese: `先生に「${card.front}」の意味を聞きます。`,
      reading: `せんせいに「${wordReading}」のいみをききます。`,
      english: `I ask my teacher what “${card.front}” means.`,
      segments: [{ text: '先生に「', reading: 'せんせいに「' }, { text: card.front, reading: wordReading }, { text: '」の意味を聞きます。', reading: '」のいみをききます。' }],
    }),
    () => ({
      japanese: `今日、「${card.front}」を覚えます。`,
      reading: `きょう、「${wordReading}」をおぼえます。`,
      english: `I’ll memorize “${card.front}” today.`,
      segments: [{ text: '今日、「', reading: 'きょう、「' }, { text: card.front, reading: wordReading }, { text: '」を覚えます。', reading: '」をおぼえます。' }],
    }),
    () => ({
      japanese: `「${card.front}」を声に出して読みます。`,
      reading: `「${wordReading}」をこえにだしてよみます。`,
      english: `I read “${card.front}” aloud.`,
      segments: [{ text: '「' }, { text: card.front, reading: wordReading }, { text: '」を声に出して読みます。', reading: '」をこえにだしてよみます。' }],
    }),
  ]

  return variants[seedFor(card.id) % variants.length]!()
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

      const resolvedSegments = segments.map((segment) => ({
        text: segment.text,
        reading: segment.reading ?? getSegmentReading(segment.text),
      }))
      const reading = resolvedSegments.map((segment) => segment.reading).join('')
      return { japanese, reading, english, segments: resolvedSegments }
    }
  }

  return undefined
}
