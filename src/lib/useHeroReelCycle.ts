import { useLayoutEffect, useRef, useState } from 'react'
import {
  heroSlotNeedsResize,
  heroSwapBlockChars,
} from '../lib/heroSlotResize'
import {
  HERO_SWAP_MS,
  heroPostSwapMs,
  heroPreSwapMs,
  heroSlotStyleVars,
  type HeroResizeTiming,
} from '../lib/heroTimings'

export type HeroReelPhase =
  | 'settled'
  | 'hold'
  | 'highlight'
  | 'expand'
  | 'swap'
  | 'shrink'
  | 'unhighlight'
  | 'postSwap'

interface UseHeroReelCycleOptions {
  stepKey: string
  needsChange: boolean
  skipPreSwapSpacing?: boolean
  prevSlotChars: number
  targetSlotChars: number
  resizeTiming?: HeroResizeTiming
  alreadyHighlighted?: boolean
  skipUnhighlight?: boolean
  /** Pause on the incoming frame before highlight begins (new sentences) */
  holdBeforeCycleMs?: number
  onSettled?: () => void
}

/** Shared phase clock — must stay aligned with HeroWordReel */
export function useHeroReelCycle({
  stepKey,
  needsChange,
  skipPreSwapSpacing = false,
  prevSlotChars,
  targetSlotChars,
  resizeTiming,
  alreadyHighlighted = false,
  skipUnhighlight = false,
  holdBeforeCycleMs = 0,
  onSettled,
}: UseHeroReelCycleOptions) {
  const animIdRef = useRef(0)
  const settledKeyRef = useRef('')
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  const [settledKey, setSettledKey] = useState('')
  const [phase, setPhase] = useState<HeroReelPhase>('settled')

  const isSettled = !needsChange || settledKey === stepKey
  const inHold = phase === 'hold'
  const inCycle = needsChange && settledKey !== stepKey && !inHold
  const charResize =
    !skipPreSwapSpacing && heroSlotNeedsResize(prevSlotChars, targetSlotChars)
  const growing =
    !skipPreSwapSpacing &&
    (resizeTiming
      ? resizeTiming.needsPreGrow
      : charResize && targetSlotChars > prevSlotChars)
  const shrinking =
    !skipPreSwapSpacing &&
    (resizeTiming
      ? resizeTiming.needsPostShrink
      : charResize && targetSlotChars < prevSlotChars)
  const inHighlight = phase === 'highlight'
  const inExpand = phase === 'expand'
  const inSwap = phase === 'swap'
  const inShrink =
    (phase === 'shrink' || phase === 'postSwap') && shrinking
  const inUnhighlight =
    (phase === 'unhighlight' || phase === 'postSwap') && !skipUnhighlight
  const allowResize = growing || shrinking || (!resizeTiming && charResize)
  const swapBlockChars = heroSwapBlockChars(prevSlotChars, targetSlotChars)
  const inPostGrow =
    growing && (phase === 'postSwap' || phase === 'shrink' || phase === 'unhighlight')

  function beginCyclePhase() {
    if (alreadyHighlighted) return 'swap' as const
    return 'highlight' as const
  }

  useLayoutEffect(() => {
    if (!needsChange) {
      settledKeyRef.current = stepKey
      setSettledKey(stepKey)
      setPhase('settled')
      onSettledRef.current?.()
      return
    }

    if (settledKeyRef.current === stepKey) return

    const animId = ++animIdRef.current
    const holdMs = holdBeforeCycleMs

    const preSwapMs = heroPreSwapMs(
      skipPreSwapSpacing,
      growing,
      alreadyHighlighted,
    )
    const postSwapMs = heroPostSwapMs(
      skipPreSwapSpacing,
      shrinking,
      growing,
      skipUnhighlight,
    )
    const swapAt = holdMs + preSwapMs
    const postAt = swapAt + HERO_SWAP_MS
    const doneAt = postAt + postSwapMs

    setPhase(holdMs > 0 ? 'hold' : beginCyclePhase())

    const timers: number[] = []

    if (holdMs > 0) {
      timers.push(
        window.setTimeout(() => {
          if (animId !== animIdRef.current) return
          setPhase(beginCyclePhase())
        }, holdMs),
      )
    }

    timers.push(
      window.setTimeout(() => {
        if (animId !== animIdRef.current) return
        setPhase('swap')
      }, swapAt),
    )

    if (shrinking || growing || !skipUnhighlight) {
      timers.push(
        window.setTimeout(() => {
          if (animId !== animIdRef.current) return
          setPhase(
            shrinking && !skipUnhighlight
              ? 'postSwap'
              : shrinking
                ? 'shrink'
                : growing
                  ? 'postSwap'
                  : 'unhighlight',
          )
        }, postAt),
      )
    }

    timers.push(
      window.setTimeout(() => {
        if (animId !== animIdRef.current) return
        settledKeyRef.current = stepKey
        setSettledKey(stepKey)
        setPhase('settled')
        onSettledRef.current?.()
      }, doneAt),
    )

    return () => {
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [
    stepKey,
    needsChange,
    growing,
    shrinking,
    alreadyHighlighted,
    skipUnhighlight,
    skipPreSwapSpacing,
    holdBeforeCycleMs,
    prevSlotChars,
    targetSlotChars,
    resizeTiming?.needsPreGrow,
    resizeTiming?.needsPostShrink,
  ])

  return {
    phase,
    settledKey,
    isSettled,
    inHold,
    inCycle,
    inHighlight,
    inExpand,
    inSwap,
    inShrink,
    inUnhighlight,
    growing,
    shrinking,
    allowResize,
    swapBlockChars,
    inPostGrow,
  }
}

export { heroSlotStyleVars }
