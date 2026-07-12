import type { HeroSentenceFrame, HeroSlot } from '../data/heroSentences'

/** Any char-count change animates width smoothly — no snap for ±1 */
export const HERO_SLOT_CLOSE_CHARS = 0

/** English partial swaps — grow on any wider incoming phrase */
export const HERO_ENGLISH_CLOSE_CHARS = 0

export const HERO_SLOT_ORDER: HeroSlot[] = [
  'prefix',
  'subject',
  'topicParticle',
  'modifier',
  'word',
  'objectParticle',
  'bridge',
  'predicate',
]

export function heroSlotNeedsResize(
  prevChars: number,
  targetChars: number,
): boolean {
  if (prevChars === targetChars) return false
  return Math.abs(targetChars - prevChars) > HERO_SLOT_CLOSE_CHARS
}

export function heroEnglishNeedsResize(
  prevChars: number,
  targetChars: number,
): boolean {
  if (prevChars === targetChars) return false
  return Math.abs(targetChars - prevChars) > HERO_ENGLISH_CLOSE_CHARS
}

export function heroEnglishResizeTiming(
  prevChars: number,
  targetChars: number,
  skipPreSwapSpacing = false,
): { needsPreGrow: boolean; needsPostShrink: boolean } {
  if (skipPreSwapSpacing || !heroEnglishNeedsResize(prevChars, targetChars)) {
    return { needsPreGrow: false, needsPostShrink: false }
  }

  return {
    needsPreGrow: targetChars > prevChars,
    needsPostShrink: targetChars < prevChars,
  }
}

/** Width that fits both strings for the duration of a swap cycle */
export function heroSwapBlockChars(
  prevChars: number,
  targetChars: number,
): number {
  return Math.max(prevChars, targetChars)
}

/** Multiple highlighted swaps that run through the last word in the sentence */
export function highlightedSwapReachesEnd(
  highlightedChangingSlots: HeroSlot[],
  frame: HeroSentenceFrame,
): boolean {
  if (highlightedChangingSlots.length < 2) return false

  const changing = new Set(highlightedChangingSlots)

  let rightmostFilled: HeroSlot | null = null
  for (let i = HERO_SLOT_ORDER.length - 1; i >= 0; i--) {
    const slot = HERO_SLOT_ORDER[i]
    if (frame[slot]) {
      rightmostFilled = slot
      break
    }
  }
  if (!rightmostFilled) return false

  for (let i = HERO_SLOT_ORDER.length - 1; i >= 0; i--) {
    const slot = HERO_SLOT_ORDER[i]
    if (changing.has(slot)) {
      return slot === rightmostFilled
    }
  }

  return false
}
