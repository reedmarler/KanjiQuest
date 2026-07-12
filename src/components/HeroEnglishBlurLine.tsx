import { heroEnglishSlotWidthUnits } from '../lib/heroEnglishSlotWidth'
import type { HeroResizeTiming } from '../lib/heroTimings'
import { HeroWordReel } from './HeroWordReel'

interface HeroEnglishBlurLineProps {
  text: string
  prevText: string
  stepKey: string
  skipPreSwapSpacing?: boolean
  resizeTiming?: HeroResizeTiming
  skipUnhighlight?: boolean
  holdBeforeCycleMs?: number
}

/** Full-line English — vertical reel in sync with Japanese full-sentence swap */
export function HeroEnglishBlurLine({
  text,
  prevText,
  stepKey,
  skipPreSwapSpacing = false,
  skipUnhighlight = false,
  holdBeforeCycleMs = 0,
}: HeroEnglishBlurLineProps) {
  const needsChange = text !== prevText
  const prevSlotChars = heroEnglishSlotWidthUnits(prevText)
  const targetSlotChars = heroEnglishSlotWidthUnits(text)

  return (
    <span className="hero-english-line is-reel-swap">
      <span className="hero-english-full-sentence">
        <span className="hero-full-sentence-mount">
          <HeroWordReel
            text={text}
            prevText={prevText}
            spin={needsChange}
            highlight={needsChange}
            prevSlotChars={prevSlotChars}
            targetSlotChars={targetSlotChars}
            stepKey={stepKey}
            skipPreSwapSpacing={skipPreSwapSpacing}
            skipUnhighlight={skipUnhighlight}
            holdBeforeCycleMs={holdBeforeCycleMs}
            naturalWidth
            englishWidth
            showFurigana={false}
          />
        </span>
      </span>
    </span>
  )
}
