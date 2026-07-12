import type { HeroSentenceFrame, HeroSlot } from '../data/heroSentences'
import { isPosFrame } from '../data/heroSentences'
import {
  buildForcedSlotEnglishDiff,
  diffEnglishWordSwap,
  englishAlsoSlotText,
  englishPartialSwapAllowed,
  englishSwapSpanChars,
  formatPartialEnglishParts,
  isEnglishAlsoDiff,
  isStrictSingleWordEnglishDiff,
  resolveEnglishPartialSwap,
  type EnglishWordDiff,
} from './heroEnglishDiff'
import { getHeroEnglish } from './heroSentenceGloss'
import { shouldHighlightSlot } from './heroHighlightTone'
import { sanitizeHeroEnglishGloss } from './heroEnglishNormalize'
import { diffEnglishForSegmentSlot } from './posEnglishDiff'

function slotDisplayText(frame: HeroSentenceFrame, key: string): string {
  if (isPosFrame(frame)) {
    return frame.segments?.find((s) => s.key === key)?.text ?? ''
  }
  return frame[key as HeroSlot] ?? ''
}

export interface EnglishReelProps {
  text: string
  prevText: string
  slotKey: string
  prevSlotChars: number
  targetSlotChars: number
  naturalWidth?: boolean
  /** は↔も — inline insert/remove "also", not a full-line change */
  alsoSwap?: boolean
}

export type HeroEnglishTrack =
  | { mode: 'static'; text: string }
  | {
      mode: 'partial'
      before: string
      reel: EnglishReelProps
      after: string
      stepKey: string
    }
  | { mode: 'blur'; text: string; prevText: string; stepKey: string }

function assembledPartialLine(
  diff: EnglishWordDiff,
  useNext: boolean,
): string {
  const word = useNext ? diff.nextWord : diff.prevWord
  const { before, after } = formatPartialEnglishParts(diff)
  const slotText = englishAlsoSlotText(word)
  return before + slotText + after
}

function buildPartialFromDiff(
  diff: EnglishWordDiff,
  minimalSlot: string,
  stepKey: string,
  english: string,
  prevEnglish: string,
): Extract<HeroEnglishTrack, { mode: 'partial' }> | null {
  if (assembledPartialLine(diff, true) !== english) return null
  if (assembledPartialLine(diff, false) !== prevEnglish) return null

  const { prevSlotChars, targetSlotChars } = englishSwapSpanChars(diff)
  const { before, after } = formatPartialEnglishParts(diff)
  return {
    mode: 'partial',
    before,
    after,
    stepKey,
    reel: {
      text: englishAlsoSlotText(diff.nextWord),
      prevText: englishAlsoSlotText(diff.prevWord),
      slotKey: minimalSlot,
      prevSlotChars,
      targetSlotChars,
      naturalWidth: true,
      alsoSwap: isEnglishAlsoDiff(diff),
    },
  }
}

function resolvePartialDiff(
  prevEnglish: string,
  english: string,
  slot: string,
  frame: HeroSentenceFrame,
  prevFrame: HeroSentenceFrame,
): EnglishWordDiff | null {
  if (isPosFrame(frame) && isPosFrame(prevFrame)) {
    const segmentDiff = diffEnglishForSegmentSlot(
      slot,
      frame,
      prevFrame,
      prevEnglish,
      english,
    )
    if (englishPartialSwapAllowed(prevEnglish, english, segmentDiff, slot)) {
      return segmentDiff
    }
  }

  const diff = resolveEnglishPartialSwap(
    prevEnglish,
    english,
    slot as HeroSlot,
    frame,
    prevFrame,
  )
  if (diff) return diff

  const relaxed = diffEnglishWordSwap(prevEnglish, english, true)
  return englishPartialSwapAllowed(prevEnglish, english, relaxed, slot)
    ? relaxed
    : null
}

function pickEnglishAnchorSlot(
  highlightedChangingSlots: string[],
  actualChanging: string[],
): string | null {
  if (highlightedChangingSlots.length === 1) return highlightedChangingSlots[0]!
  if (actualChanging.length === 1) return actualChanging[0]!
  return null
}

function tryPartialEnglishTrack(
  frame: HeroSentenceFrame,
  prevFrame: HeroSentenceFrame,
  changingSlots: string[],
  highlightedChangingSlots: string[],
  stepKey: string,
  english: string,
  prevEnglish: string,
): Extract<HeroEnglishTrack, { mode: 'partial' }> | null {
  const actualChanging = changingSlots.filter(
    (slot) => slotDisplayText(frame, slot) !== slotDisplayText(prevFrame, slot),
  )
  const anchorSlot = pickEnglishAnchorSlot(highlightedChangingSlots, actualChanging)
  const multipleJpSlots =
    highlightedChangingSlots.length > 1 || actualChanging.length > 1

  // Multiple Japanese slots: only inline-blur when English changes a single word
  if (multipleJpSlots) {
    const strict = diffEnglishWordSwap(prevEnglish, english, false)
      ?? diffEnglishWordSwap(prevEnglish, english, true)
    if (
      strict
      && isStrictSingleWordEnglishDiff(strict)
      && englishPartialSwapAllowed(prevEnglish, english, strict, anchorSlot ?? 'N')
    ) {
      const partial = buildPartialFromDiff(
        strict,
        anchorSlot ?? highlightedChangingSlots[0] ?? 'N',
        stepKey,
        english,
        prevEnglish,
      )
      if (partial) return partial
    }
    return null
  }

  if (!anchorSlot || !shouldHighlightSlot(anchorSlot)) return null

  const diff =
    resolvePartialDiff(
      prevEnglish,
      english,
      anchorSlot,
      frame,
      prevFrame,
    ) ??
    buildForcedSlotEnglishDiff(
      anchorSlot as HeroSlot,
      frame,
      prevFrame,
      prevEnglish,
      english,
    )
  if (!diff) return null

  return buildPartialFromDiff(
    diff,
    anchorSlot,
    stepKey,
    english,
    prevEnglish,
  )
}

/** Inline blur for one English span; full-line blur only when multiple words change */
export function buildHeroEnglishTrack(
  frame: HeroSentenceFrame,
  prevFrame: HeroSentenceFrame,
  useFullSentenceReel: boolean,
  changingSlots: string[],
  highlightedChangingSlots: string[],
  stepKey: string,
  hasTransition: boolean,
): HeroEnglishTrack {
  const english = sanitizeHeroEnglishGloss(getHeroEnglish(frame))
  const prevEnglish = sanitizeHeroEnglishGloss(getHeroEnglish(prevFrame))

  if (!hasTransition) {
    return { mode: 'static', text: english }
  }

  if (english === prevEnglish) {
    return { mode: 'static', text: english }
  }

  if (!useFullSentenceReel) {
    const partial = tryPartialEnglishTrack(
      frame,
      prevFrame,
      changingSlots,
      highlightedChangingSlots,
      stepKey,
      english,
      prevEnglish,
    )
    if (partial) return partial
  }

  return { mode: 'blur', text: english, prevText: prevEnglish, stepKey }
}

/** Slot key shared with the active Japanese reel */
export function heroEnglishStepKey(
  useFullSentenceReel: boolean,
  highlightedChangingSlots: string[],
): string {
  if (useFullSentenceReel) return 'full'
  if (highlightedChangingSlots.length === 1) {
    return highlightedChangingSlots[0]
  }
  return 'full'
}
