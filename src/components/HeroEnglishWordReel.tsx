import type { HeroResizeTiming } from '../lib/heroTimings'
import type { HeroHighlightTone } from '../lib/heroHighlightTone'
import { HeroWordReel } from './HeroWordReel'

interface HeroEnglishWordReelProps {
  text: string
  prevText: string
  stepKey: string
  skipPreSwapSpacing?: boolean
  prevSlotChars: number
  targetSlotChars: number
  alsoSwap?: boolean
  resizeTiming?: HeroResizeTiming
  highlightTone?: HeroHighlightTone
  skipUnhighlight?: boolean
  alreadyHighlighted?: boolean
  holdBeforeCycleMs?: number
}

/** Inline English slot — same reel + blue highlight as Japanese kanji slots */
export function HeroEnglishWordReel({
  text,
  prevText,
  stepKey,
  skipPreSwapSpacing = false,
  prevSlotChars,
  targetSlotChars,
  alsoSwap = false,
  highlightTone = 'rayquaza',
  skipUnhighlight = false,
  alreadyHighlighted = false,
  holdBeforeCycleMs = 0,
}: HeroEnglishWordReelProps) {
  const needsChange = text !== prevText

  return (
    <span className="hero-english-slot">
      <HeroWordReel
        text={text}
        prevText={prevText}
        spin={needsChange}
        highlight
        highlightTone={highlightTone}
        prevSlotChars={prevSlotChars}
        targetSlotChars={targetSlotChars}
        stepKey={stepKey}
        skipPreSwapSpacing={skipPreSwapSpacing}
        skipUnhighlight={skipUnhighlight}
        alreadyHighlighted={alreadyHighlighted}
        holdBeforeCycleMs={holdBeforeCycleMs}
        englishWidth
        alsoSwap={alsoSwap}
        showFurigana={false}
      />
    </span>
  )
}
