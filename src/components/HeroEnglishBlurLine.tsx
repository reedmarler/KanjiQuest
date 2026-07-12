import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import {
  heroEnglishSlotWidthEm,
  heroEnglishSlotWidthUnits,
} from '../lib/heroEnglishSlotWidth'
import {
  HERO_SWAP_MS,
  heroPreSwapMs,
  heroSlotStyleVars,
  type HeroResizeTiming,
} from '../lib/heroTimings'

interface HeroEnglishBlurLineProps {
  text: string
  prevText: string
  stepKey: string
  skipPreSwapSpacing?: boolean
  resizeTiming?: HeroResizeTiming
  skipUnhighlight?: boolean
  holdBeforeCycleMs?: number
}

type BlurPhase = 'clear' | 'blur'

export function HeroEnglishBlurLine({
  text,
  prevText,
  stepKey,
  skipPreSwapSpacing = false,
  holdBeforeCycleMs = 0,
}: HeroEnglishBlurLineProps) {
  const needsChange = text !== prevText
  const prevSlotChars = heroEnglishSlotWidthUnits(prevText)
  const targetSlotChars = heroEnglishSlotWidthUnits(text)
  const animIdRef = useRef(0)
  const settledKeyRef = useRef('')
  const [shownText, setShownText] = useState(needsChange ? prevText : text)
  const [widthText, setWidthText] = useState(needsChange ? prevText : text)
  const [phase, setPhase] = useState<BlurPhase>('clear')

  useLayoutEffect(() => {
    if (!needsChange) {
      settledKeyRef.current = stepKey
      setShownText(text)
      setWidthText(text)
      setPhase('clear')
      return
    }

    if (settledKeyRef.current === stepKey) return

    const animId = ++animIdRef.current
    const preSwapMs = heroPreSwapMs(
      skipPreSwapSpacing,
      targetSlotChars > prevSlotChars,
      false,
    )
    const swapAt = holdBeforeCycleMs + preSwapMs
    const revealAt = swapAt + HERO_SWAP_MS
    const timers: number[] = []

    setShownText(prevText)
    setWidthText(prevText)
    setPhase('clear')

    timers.push(
      window.setTimeout(() => {
        if (animId !== animIdRef.current) return
        setPhase('blur')
        setWidthText(text)
      }, swapAt),
    )

    timers.push(
      window.setTimeout(() => {
        if (animId !== animIdRef.current) return
        setShownText(text)
      }, Math.max(swapAt, revealAt - 120)),
    )

    timers.push(
      window.setTimeout(() => {
        if (animId !== animIdRef.current) return
        settledKeyRef.current = stepKey
        setShownText(text)
        setWidthText(text)
        setPhase('clear')
      }, revealAt),
    )

    return () => {
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [
    stepKey,
    needsChange,
    text,
    prevText,
    prevSlotChars,
    targetSlotChars,
    skipPreSwapSpacing,
    holdBeforeCycleMs,
  ])

  const style = {
    minWidth: heroEnglishSlotWidthEm(widthText),
    ...heroSlotStyleVars(),
  } as CSSProperties

  return (
    <span className="hero-english-line is-blur-swap is-centered">
      <span
        className={[
          'hero-english-blur-wrap',
          phase === 'blur' ? 'is-blurring' : 'is-clear',
          needsChange ? 'is-cycling-width is-resizing-during-swap' : '',
        ].filter(Boolean).join(' ')}
        style={style}
      >
        <span className="hero-english-blur-spacer" aria-hidden>{widthText}</span>
        <span className="hero-english-blur-surface">
          <span className="hero-english-text">{shownText}</span>
        </span>
      </span>
    </span>
  )
}
