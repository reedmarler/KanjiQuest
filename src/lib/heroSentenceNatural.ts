import type { HeroSentenceFrame, HeroTemplate } from '../data/heroSentences'
import { charLength, isPosFrame } from '../data/heroSentences'
import { hasAnyHeroCollocation } from './heroCollocations'
import { heroObjectPhrase } from './heroVocabPhrases'
import { wordFitsPredicate } from './heroWordVerbFit'

/** Words that must never appear in hero slots */
const BLOCKED_WORDS = new Set([
  '汽', '友', '飲む', '付き合う', '気を付けて', '怖い', '慎重', '異文化', '渡航',
])

/** Per-predicate deny lists (English head words / phrases) */
const PREDICATE_DENY: Partial<Record<string, RegExp>> = {
  '好きです': /experience|reservation|ticket|train|map|sightseeing|date|dates|shopping|anniversary|parents|sweetheart|politics|philosophy|society|economy|religion|architecture|industry|technology|research|education|international|exchange|compromise|tendency|contradiction|responsibility|emotion|comparison|concentration|failure|competition|objectivity|discussion|condition|concept|essence|theory|structure|insight|civilization|maintain|expansion|reduction|grasp|introduction|adaptation|tolerance|nostalgia|dependence/,
  '欲しいです': /experience|memories|sightseeing|culture|history|date|dates|shopping|anniversary|parents|sweetheart|train|map/,
  '面白いです': /date|dates|shopping|anniversary|parents|sweetheart|ticket|reservation|train/,
  '楽しいです': /japanese|date|dates|culture|history|ticket|reservation|train|map|memories|experience/,
  '見ます': /baseball|pictures|photos/,
  '見たいです': /baseball|pictures|photos/,
  '買います': /reservation|train|car|sweetheart|parents|culture|history|experience|memories|sightseeing/,
  '買いたいです': /reservation|train|car|sweetheart|parents|culture|history|experience|memories|sightseeing/,
  '使います': /reservation|ticket|map|culture|history|experience|memories|sweetheart|parents/,
  'します': /experience|memories|culture|history|reservation|ticket|train|map|sweetheart|parents|anniversary/,
  '知りたいです': /date|dates|shopping|memories|experience|anniversary|sweetheart|parents|ticket|reservation/,
  'できます': /history|culture|experience|memories|date|dates/,
  '会います': /culture|history|experience|memories|ticket|reservation|train|map|sightseeing/,
  '待ちます': /culture|history|experience|memories|ticket|reservation|train|map|sightseeing/,
}

const ALLOWED_IMPRESSION_WORDS = new Set(['映画', '漫画', '本', '歴史', '旅行', 'テニス', 'ゴルフ', '買い物', '散歩'])

import { segmentsToJapanese } from './posSentenceEngine'

export function frameToJapanese(frame: HeroSentenceFrame): string {
  if (isPosFrame(frame) && frame.segments) {
    return segmentsToJapanese(frame.segments)
  }

  const parts = [
    frame.prefix,
    frame.subject,
    frame.subject ? frame.topicParticle : '',
    frame.modifier,
    frame.word + frame.objectParticle,
    frame.bridge,
    frame.predicate,
  ].filter(Boolean)
  return parts.join('')
}

const ORPHAN_TOPIC_AFTER_PREFIX_RE = /^は|^も$/

/** Reject frames whose Japanese would begin with a stranded particle */
export function frameJapaneseIsValid(frame: HeroSentenceFrame): boolean {
  const jp = frameToJapanese(frame)
  if (!jp || jp.length < 2) return false
  if (!frame.word) return false
  if (!frame.subject && frame.topicParticle) return false
  if (frame.subject && frame.objectParticle === 'は') return false

  const afterPrefix = frame.prefix ? jp.slice(frame.prefix.length) : jp
  if (!frame.subject && ORPHAN_TOPIC_AFTER_PREFIX_RE.test(afterPrefix)) return false

  return true
}

export function wordLengthMatches(word: string, template: HeroTemplate): boolean {
  return charLength(word) === template.wordLength
}

export function wordIsCurated(word: string): boolean {
  return hasAnyHeroCollocation(word)
}

export function wordPassesPredicateDeny(word: string, template: HeroTemplate): boolean {
  const phrase = heroObjectPhrase(word)
  if (!phrase) return false
  const predicate = template.predicate
  const deny = PREDICATE_DENY[predicate]
  if (!deny) return true
  return !deny.test(phrase.toLowerCase())
}

export function wordAllowedForTemplate(word: string, template: HeroTemplate): boolean {
  if (BLOCKED_WORDS.has(word)) return false
  if (!wordLengthMatches(word, template)) return false
  if (!wordIsCurated(word)) return false
  if (!wordPassesPredicateDeny(word, template)) return false

  if (template.predicate === '面白いです' || template.predicate === '楽しいです') {
    const isSeedWord = (template.words as readonly string[]).includes(word)
    if (isSeedWord && !ALLOWED_IMPRESSION_WORDS.has(word) && !template.topicComment) return false
  }

  if (template.predicate === 'します' && template.objectParticle === 'を') {
    if (!['野球', '散歩', '買い物', 'ゴルフ', 'テニス'].includes(word)) return false
  }

  if (template.predicate === '使います' && !['車', '電車'].includes(word)) return false

  if (template.predicate === '会います' || template.predicate === '待ちます') {
    if (!['友達', '先生', '恋人', '両親'].includes(word)) return false
  }

  if (template.predicate === 'します' && template.modifier === '公園で') {
    return word === '散歩'
  }

  if (template.predicate === '経験があります') {
    return ['旅行', '留学', '仕事', '研究'].includes(word)
  }

  if (template.predicate === '電話しました') {
    return ['友達', '先生', '恋人', '両親'].includes(word)
  }

  if (template.predicate === '楽しかったです') {
    return ['京都', '海', '公園', '温泉', '大阪'].includes(word)
      || (template.words as readonly string[]).includes(word)
  }

  return true
}

export function frameIsNatural(frame: HeroSentenceFrame, template: HeroTemplate): boolean {
  const effectiveTemplate = { ...template, predicate: frame.predicate }
  if (!wordAllowedForTemplate(frame.word, effectiveTemplate)) return false
  if (!wordFitsPredicate(frame.word, frame.predicate, frame.objectParticle, frame.modifier)) {
    return false
  }
  return true
}
