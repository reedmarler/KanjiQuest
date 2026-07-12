import type { HeroSentenceFrame, HeroSlot, HeroStep } from '../data/heroSentences'
import { isPosFrame } from '../data/heroSentences'
import { shouldHighlightSlot } from './heroHighlightTone'

export interface SlotHighlightCarry {
  alreadyHighlighted: boolean
  skipUnhighlight: boolean
}

function segmentText(frame: HeroSentenceFrame, key: string): string {
  if (isPosFrame(frame)) {
    return frame.segments?.find((s) => s.key === key)?.text ?? ''
  }
  return frame[key as HeroSlot] ?? ''
}

/** Keep highlight when the same slot swaps again on the next step */
export function slotHighlightCarry(
  slot: HeroSlot | string,
  steps: HeroStep[],
  index: number,
  frame: HeroSentenceFrame,
  prevFrame: HeroSentenceFrame,
): SlotHighlightCarry {
  if (!shouldHighlightSlot(slot)) {
    return { alreadyHighlighted: false, skipUnhighlight: false }
  }

  const swappingNow = segmentText(frame, slot) !== segmentText(prevFrame, slot)

  if (!swappingNow) {
    return { alreadyHighlighted: false, skipUnhighlight: false }
  }

  const next = steps.length > 1 ? steps[(index + 1) % steps.length] : null
  const swapsAgainSoon = Boolean(
    next?.changed.includes(slot) && segmentText(next.frame, slot) !== segmentText(frame, slot),
  )

  let continuedFromPrev = false
  if (index > 0) {
    const previous = steps[(index - 1 + steps.length) % steps.length]
    continuedFromPrev =
      previous.changed.includes(slot)
      && segmentText(previous.frame, slot) === segmentText(prevFrame, slot)
      && segmentText(prevFrame, slot) !== segmentText(frame, slot)
  }

  return {
    alreadyHighlighted: continuedFromPrev,
    skipUnhighlight: swapsAgainSoon,
  }
}
