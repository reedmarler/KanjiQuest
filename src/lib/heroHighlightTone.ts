import type { HeroSlot } from '../data/heroSentences'
import { heroReadingForDisplay } from './heroSentenceGloss'

export const HERO_HIGHLIGHT_TONES = ['kyogre', 'groudon', 'rayquaza'] as const

export type HeroHighlightTone = (typeof HERO_HIGHLIGHT_TONES)[number]

/** Scaffold / pronouns — never highlight or swap */
const STATIC_SLOTS = new Set<string>(['subject', 'prefix', 'bridge', 'P'])

/** Blue — verbs */
const VERB_SLOTS = new Set<string>(['predicate', 'V', 'V2'])

/** Green — nouns */
const NOUN_SLOTS = new Set<string>(['word', 'N', 'N2', 'N3'])

/** Red — adjectives, adverbs, and other modifiers */
const ADJ_ADV_SLOTS = new Set<string>(['modifier', 'Adv', 'IAdj', 'NaAdj', 'Adj'])

/** Particles — never highlighted */
const PARTICLE_SLOTS = new Set<string>(['topicParticle', 'objectParticle'])

export function shouldHighlightSlot(slot: HeroSlot | string): boolean {
  if (slot.startsWith('lit-')) return false
  if (STATIC_SLOTS.has(slot)) return false
  if (PARTICLE_SLOTS.has(slot)) return false
  return true
}

export function highlightToneForSlot(slot: HeroSlot | string): HeroHighlightTone {
  if (VERB_SLOTS.has(slot)) return 'kyogre'
  if (NOUN_SLOTS.has(slot)) return 'rayquaza'
  if (ADJ_ADV_SLOTS.has(slot)) return 'groudon'
  return 'rayquaza'
}

/** Only です stays uncolored on predicates — ます is part of the highlighted verb */
export function plainSuffixForSlot(slot: HeroSlot | string, text: string): string {
  if (slot !== 'predicate' && slot !== 'V' && slot !== 'V2') return ''
  if (!text) return ''
  if (text.endsWith('です')) return 'です'
  return ''
}

export function splitHighlightedText(
  text: string,
  reading: string | undefined,
  plainSuffix: string,
): { stem: string; suffix: string; stemReading?: string } {
  if (!plainSuffix || !text.endsWith(plainSuffix)) {
    return { stem: text, suffix: '', stemReading: reading }
  }

  const stem = text.slice(0, -plainSuffix.length)
  const displayReading = heroReadingForDisplay(text, reading) ?? ''
  const stemReading = displayReading.endsWith(plainSuffix)
    ? displayReading.slice(0, -plainSuffix.length)
    : displayReading.slice(0, Math.max(0, displayReading.length - plainSuffix.length))

  return { stem, suffix: plainSuffix, stemReading }
}
