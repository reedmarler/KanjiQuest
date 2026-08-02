import type { GeneratedPreviewSentence } from './sentenceGeneratorPreview'

const RECENT_WINDOW = 8

function slotValue(sentence: GeneratedPreviewSentence, name: string) {
  return sentence.slots[name]?.dictionaryForm || sentence.slots[name]?.surface || ''
}

function signature(sentence: GeneratedPreviewSentence) {
  return `${sentence.frameId}|${sentence.japanese}`
}

function structure(sentence: GeneratedPreviewSentence) {
  return sentence.grammar.map(item => item.pattern).join('|') || sentence.frameId
}

function semanticCombination(sentence: GeneratedPreviewSentence) {
  return [
    sentence.frameId,
    slotValue(sentence, 'subject'),
    slotValue(sentence, 'verb'),
    slotValue(sentence, 'object'),
    slotValue(sentence, 'destination') || slotValue(sentence, 'location'),
  ].filter(Boolean).join('|')
}

/**
 * A verb in the same grammar frame carries the same ending/form.  Tracking
 * this pair separately prevents a stream from showing 読みます, then another
 * 読みます with a new object, when 読みたいです or 読んでいます is available.
 */
export function verbFormSignature(sentence: GeneratedPreviewSentence) {
  const verb = slotValue(sentence, 'verb')
  return verb ? `${verb}|${sentence.frameId}` : ''
}

function reusableWords(sentence: GeneratedPreviewSentence) {
  return ['subject', 'companion', 'recipient', 'object', 'destination', 'location', 'verb']
    .map(name => slotValue(sentence, name))
    .filter(Boolean)
}

/**
 * Scores a candidate against one generated stream. Exact duplicates are
 * rejected in practice; repeated grammar, word roles, and semantic pairings
 * remain possible but become progressively less likely.
 */
export class SentenceDiversityTracker {
  private readonly signatures = new Map<string, number>()
  private readonly structures = new Map<string, number>()
  private readonly combinations = new Map<string, number>()
  private readonly verbForms = new Map<string, number>()
  private readonly words = new Map<string, number>()
  private readonly recent: GeneratedPreviewSentence[] = []

  score(sentence: GeneratedPreviewSentence) {
    const exact = this.signatures.get(signature(sentence)) ?? 0
    if (exact) return 10_000 + exact * 1_000

    let score = (this.structures.get(structure(sentence)) ?? 0) * 14
    score += (this.combinations.get(semanticCombination(sentence)) ?? 0) * 28
    const form = verbFormSignature(sentence)
    if (form) score += (this.verbForms.get(form) ?? 0) * 24

    for (const word of reusableWords(sentence)) score += (this.words.get(word) ?? 0) * 3

    for (const previous of this.recent) {
      if (structure(previous) === structure(sentence)) score += 12
      if (slotValue(previous, 'subject') && slotValue(previous, 'subject') === slotValue(sentence, 'subject')) score += 9
      if (slotValue(previous, 'verb') && slotValue(previous, 'verb') === slotValue(sentence, 'verb')) score += 8
      if (form && form === verbFormSignature(previous)) score += 22
      if (slotValue(previous, 'object') && slotValue(previous, 'object') === slotValue(sentence, 'object')) score += 7
      if (semanticCombination(previous) === semanticCombination(sentence)) score += 30
    }
    return score
  }

  add(sentence: GeneratedPreviewSentence) {
    const increment = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1)
    increment(this.signatures, signature(sentence))
    increment(this.structures, structure(sentence))
    increment(this.combinations, semanticCombination(sentence))
    const form = verbFormSignature(sentence)
    if (form) increment(this.verbForms, form)
    for (const word of reusableWords(sentence)) increment(this.words, word)
    this.recent.push(sentence)
    if (this.recent.length > RECENT_WINDOW) this.recent.shift()
  }
}

export function selectMostDiverse(candidates: GeneratedPreviewSentence[], tracker: SentenceDiversityTracker) {
  if (!candidates.length) return null
  return candidates.reduce((best, candidate) => tracker.score(candidate) < tracker.score(best) ? candidate : best)
}
