import { classifyVocabularyCard } from './vocabularyClassifier'
import type { StudyCard } from './types'

export const WORD_CATEGORY_ORDER = ['Verbs', 'Adjectives', 'Adverbs', 'Nouns', 'Other'] as const
export type WordCategory = typeof WORD_CATEGORY_ORDER[number]

/**
 * Which browse section a vocabulary word belongs in.
 *
 * The imported workbook records part of speech directly — `iAdjective`,
 * `naAdjective`, `Adverb` — for the 177 words it files under Descriptors, and
 * those tags are read here in preference to anything derived. Reading the
 * English gloss instead used to strand な-adjectives in Nouns whenever their
 * translation missed a hand-written keyword list, which is where 好き, 可能,
 * 素敵, 残念 and about a hundred others had been sitting.
 *
 * Verbs are the exception: the workbook has no `Verb` tag (only `SuruVerb`,
 * which marks a *noun* that accepts する — 勉強 is still a noun), so verbs are
 * still identified by their dictionary-form gloss, which was already exact.
 *
 * Words with no imported metadata — 38% of the deck — fall through to the same
 * gloss heuristics as before. This is a browsing aid, not a claim about
 * grammar.
 */
const ADJECTIVE_TAGS = ['i-adjective', 'na-adjective']
const FUNCTION_WORD_TAGS = ['particle', 'pronoun', 'conjunction', 'interjection', 'auxiliary-verb', 'expression', 'counter', 'question-word', 'demonstrative']

const FUNCTION_WORD_PATTERN = /\b(particle|conjunction|copula|auxiliary|suffix|prefix|interjection|pronoun|expression|counter|case)\b/
const ADVERB_PATTERN = /\b(quickly|slowly|already|always|often|sometimes|usually|really|very|together|again|still|soon|perhaps|probably|almost|especially|suddenly|finally|immediately|gradually|completely|entirely|frequently|occasionally|constantly|mostly|nearly|barely|extremely)\b/
const NA_ADJECTIVE_HINT_PATTERN = /\b(quiet|noisy|healthy|convenient|inconvenient|important|necessary|unnecessary|free|famous|kind|unkind|dangerous|safe|strange|simple|complex|various|serious|clear|energetic|lively|lonely|handsome|polite|rude|honest|calm|fair|equal|special|normal|strict|gentle|brave|foolish|wise|selfish|sincere)\b/
const PRONOUN_PATTERN = /^(i|me|you|he|him|she|her|we|us|they|them|this|that|these|those|what|who|where|when|why|how|which)\b/

// These words gloss with an adverbial English meaning ("together", "usually",
// "always") but are themselves nouns or な-adjectives whose adverbial form
// (一緒に, 常に...) is a separate word — the base form belongs in Nouns.
const ADVERB_LOOKING_NOUNS = new Set(['同棲', '一緒', '共', '常', '普段', '普通'])
// に対する/に関する are fixed grammatical constructions ("regarding", "toward")
// built on する, not ordinary dictionary-form verbs — they never conjugate the
// way a real する-verb does (no に対します, no に対して alone as the verb).
const NON_VERB_OVERRIDES = new Set(['に対する', 'に関する'])

function isVerbGloss(meaning: string, front: string) {
  return /^to\s+\w/.test(meaning) || front.endsWith('する')
}

export function classifyPartOfSpeech(card: StudyCard): WordCategory {
  const meaning = (card.back || card.english || '').toLowerCase()

  // Hand-built decks state their own part of speech; nothing below can improve
  // on that.
  if (card.id.startsWith('vocab-adverb-')) return 'Adverbs'
  if (card.id.startsWith('vocab-verb-')) return 'Verbs'
  if (card.id.startsWith('vocab-adj-')) return 'Adjectives'
  if (ADVERB_LOOKING_NOUNS.has(card.front)) return 'Nouns'
  if (NON_VERB_OVERRIDES.has(card.front)) return 'Other'

  const tags = classifyVocabularyCard(card).tags
  // A word tagged both — 実際, 確か, 当然, 突然, 一生懸命 — is a な-adjective
  // that also works adverbially. The dictionary form is the adjective.
  if (ADJECTIVE_TAGS.some((tag) => tags.includes(tag))) return 'Adjectives'
  if (tags.includes('adverb')) return 'Adverbs'
  if (isVerbGloss(meaning, card.front)) return 'Verbs'
  if (FUNCTION_WORD_TAGS.some((tag) => tags.includes(tag))) return 'Other'

  if (FUNCTION_WORD_PATTERN.test(meaning) || PRONOUN_PATTERN.test(meaning)) return 'Other'
  if (card.front.endsWith('い') && card.front.length > 1 && !['きれい', '嫌い', 'わがまま'].includes(card.front)) return 'Adjectives'
  // 大きな/小さな — prenominal adjectives the workbook left untagged. Safe to
  // read off the ending here because the demonstratives that share it
  // (そんな, こんな) are already claimed by their own tag above.
  if (card.front.endsWith('な') && card.front.length > 2) return 'Adjectives'
  if (NA_ADJECTIVE_HINT_PATTERN.test(meaning)) return 'Adjectives'
  if (ADVERB_PATTERN.test(meaning)) return 'Adverbs'
  return 'Nouns'
}
