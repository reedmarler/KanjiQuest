import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { charLength, HERO_CHAR_WIDTH_EM } from '../data/heroSentences'
import { heroEnglishWidthEmFromUnits } from '../lib/heroEnglishSlotWidth'
import {
  heroSlotNeedsResize,
  heroSwapBlockChars,
} from '../lib/heroSlotResize'
import {
  HERO_SWAP_MS,
  HERO_WORD_DRILL_SWAP_MS,
  heroPostSwapMs,
  heroPreSwapMs,
  heroSlotStyleVars,
  type HeroResizeTiming,
} from '../lib/heroTimings'
import type { HeroHighlightTone } from '../lib/heroHighlightTone'
import {
  heroReelPendingCycle,
  heroReelShowsPreviousText,
  heroReelTrackShowsOutgoing,
} from '../lib/heroReelDisplay'
import { HeroText } from './HeroText'

type Phase = 'settled' | 'hold' | 'highlight' | 'expand' | 'swap' | 'shrink' | 'unhighlight' | 'postSwap'

interface HeroWordReelProps {
  text: string
  reading?: string
  prevText: string
  prevReading?: string
  spin: boolean
  highlight: boolean
  highlightTone?: HeroHighlightTone
  plainSuffix?: string
  prevPlainSuffix?: string
  prevSlotChars: number
  targetSlotChars: number
  stepKey: string
  skipPreSwapSpacing?: boolean
  showFurigana?: boolean
  delayedFuriganaMs?: number
  /** Short swap for kanji drill — skips highlight / unhighlight phases */
  quickSwap?: boolean
  /** Size to rendered text, not char-count × em — for full-sentence reels */
  naturalWidth?: boolean
  resizeTiming?: HeroResizeTiming
  /** Skip slow unhighlight when the same slot swaps again next */
  skipUnhighlight?: boolean
  /** Slot is still highlighted from the previous consecutive swap */
  alreadyHighlighted?: boolean
  /** Pause on the incoming frame before highlight begins */
  holdBeforeCycleMs?: number
  /** Use English width units instead of kanji char width */
  englishWidth?: boolean
  /** は↔も — inline insert/remove "also" */
  alsoSwap?: boolean
  onSettled?: () => void
}

function slotWidthEm(chars: number, englishWidth = false): string {
  if (chars <= 0) return '0'
  if (englishWidth) return heroEnglishWidthEmFromUnits(chars)
  return `${chars * HERO_CHAR_WIDTH_EM}em`
}

function displayWord(text: string): string {
  return text.trim()
}

function widerKanjiText(a: string, b: string): string {
  return charLength(a) >= charLength(b) ? a : b
}

export function HeroWordReel({
  text,
  reading,
  prevText,
  prevReading,
  spin,
  highlight,
  highlightTone = 'rayquaza',
  plainSuffix = '',
  prevPlainSuffix = '',
  prevSlotChars,
  targetSlotChars,
  stepKey,
  skipPreSwapSpacing = false,
  showFurigana = true,
  delayedFuriganaMs,
  quickSwap = false,
  naturalWidth = false,
  resizeTiming,
  skipUnhighlight = false,
  alreadyHighlighted = false,
  holdBeforeCycleMs = 0,
  englishWidth = false,
  alsoSwap = false,
  onSettled,
}: HeroWordReelProps) {
  const animIdRef = useRef(0)
  const shrinkAnimRef = useRef(0)
  const settledKeyRef = useRef('')
  const cycleToneRef = useRef(highlightTone)
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  const [settledKey, setSettledKey] = useState('')
  const [phase, setPhase] = useState<Phase>('settled')
  const [widthChars, setWidthChars] = useState(() =>
    spin && text !== prevText ? prevSlotChars : targetSlotChars,
  )
  const [swapping, setSwapping] = useState(false)
  const [heldHighlight, setHeldHighlight] = useState(false)

  const needsChange = spin && text !== prevText
  const isSettled = !needsChange || settledKey === stepKey
  const inHold = phase === 'hold'
  const inCycle = needsChange && settledKey !== stepKey && !inHold
  const charResize = heroSlotNeedsResize(prevSlotChars, targetSlotChars)
  const allowResize = !skipPreSwapSpacing && (
    resizeTiming
      ? resizeTiming.needsPreGrow || resizeTiming.needsPostShrink
      : charResize
  )
  const growing = !skipPreSwapSpacing && (
    resizeTiming ? resizeTiming.needsPreGrow : charResize && targetSlotChars > prevSlotChars
  )
  const shrinking = !skipPreSwapSpacing && (
    resizeTiming ? resizeTiming.needsPostShrink : charResize && targetSlotChars < prevSlotChars
  )
  const swapBlockChars = heroSwapBlockChars(prevSlotChars, targetSlotChars)
  const inHighlight = phase === 'highlight'
  const inExpand = phase === 'expand'
  const inSwap = phase === 'swap'
  const inShrink = (phase === 'shrink' || phase === 'postSwap') && shrinking
  const inUnhighlight = (phase === 'unhighlight' || phase === 'postSwap') && !skipUnhighlight

  const toneActive =
    highlight &&
    (inHighlight ||
      inExpand ||
      inSwap ||
      inShrink ||
      inUnhighlight ||
      heldHighlight)
  const activeTone = inCycle || inShrink || inUnhighlight
    ? cycleToneRef.current
    : highlightTone
  const toneClass = toneActive ? `hero-highlight-tone-${activeTone}` : ''

  useLayoutEffect(() => {
    if (!needsChange) {
      cycleToneRef.current = highlightTone
      settledKeyRef.current = stepKey
      setSettledKey(stepKey)
      setPhase('settled')
      setWidthChars(targetSlotChars)
      setSwapping(false)
      onSettledRef.current?.()
      return
    }

    if (settledKeyRef.current === stepKey) return

    cycleToneRef.current = highlightTone
    if (alreadyHighlighted) {
      setHeldHighlight(true)
    } else {
      setHeldHighlight(false)
    }
    const animId = ++animIdRef.current

    if (quickSwap) {
      setWidthChars(targetSlotChars)
      setPhase('swap')
      setSwapping(false)

      const doneAt = HERO_WORD_DRILL_SWAP_MS
      const timers: number[] = []

      timers.push(
        window.setTimeout(() => {
          if (animId !== animIdRef.current) return
          settledKeyRef.current = stepKey
          setSettledKey(stepKey)
          setPhase('settled')
          setWidthChars(targetSlotChars)
          setSwapping(false)
          onSettledRef.current?.()
        }, doneAt),
      )

      return () => {
        timers.forEach((id) => window.clearTimeout(id))
      }
    }

    setWidthChars(allowResize ? prevSlotChars : targetSlotChars)

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

    const beginCycle = () => {
      if (alreadyHighlighted) {
        setPhase('swap')
        setSwapping(false)
      } else {
        setPhase('highlight')
        setSwapping(false)
      }
    }

    setSwapping(false)
    if (holdMs > 0) {
      setPhase('hold')
    } else {
      beginCycle()
    }

    const timers: number[] = []

    if (holdMs > 0) {
      timers.push(
        window.setTimeout(() => {
          if (animId !== animIdRef.current) return
          beginCycle()
        }, holdMs),
      )
    }

    timers.push(
      window.setTimeout(() => {
        if (animId !== animIdRef.current) return
        setPhase('swap')
        if (allowResize && (growing || shrinking)) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (animId !== animIdRef.current) return
              setWidthChars(targetSlotChars)
            })
          })
        } else if (skipPreSwapSpacing && !naturalWidth && !growing) {
          setWidthChars(targetSlotChars)
        }
      }, swapAt),
    )

    if (shrinking || !skipUnhighlight) {
      timers.push(
        window.setTimeout(() => {
          if (animId !== animIdRef.current) return
          setPhase(
            shrinking && !skipUnhighlight
              ? 'postSwap'
              : shrinking
                ? 'shrink'
                : 'unhighlight',
          )
          setSwapping(false)
        }, postAt),
      )
    }

    timers.push(
      window.setTimeout(() => {
        if (animId !== animIdRef.current) return
        settledKeyRef.current = stepKey
        setSettledKey(stepKey)
        setPhase('settled')
        setWidthChars(targetSlotChars)
        setSwapping(false)
        setHeldHighlight(skipUnhighlight)
        onSettledRef.current?.()
      }, doneAt),
    )

    return () => {
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [
    stepKey,
    needsChange,
    highlightTone,
    growing,
    shrinking,
    allowResize,
    swapBlockChars,
    skipPreSwapSpacing,
    prevSlotChars,
    targetSlotChars,
    quickSwap,
    naturalWidth,
    resizeTiming?.needsPreGrow,
    resizeTiming?.needsPostShrink,
    skipUnhighlight,
    alreadyHighlighted,
    holdBeforeCycleMs,
  ])

  useLayoutEffect(() => {
    if (!inSwap) {
      setSwapping(false)
      return
    }

    const frame = requestAnimationFrame(() => {
      void document.body.offsetHeight
      setSwapping(true)
    })

    return () => cancelAnimationFrame(frame)
  }, [inSwap, stepKey])

  /** Width changes happen with the swap, never during the pre-swap highlight. */
  useLayoutEffect(() => {
    if (!needsChange || isSettled || !allowResize || !shrinking) return
    if (phase !== 'shrink' && phase !== 'postSwap') return

    const animId = ++shrinkAnimRef.current
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (animId !== shrinkAnimRef.current) return
        setWidthChars(targetSlotChars)
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [phase, needsChange, isSettled, allowResize, shrinking, targetSlotChars, stepKey])

  const pendingCycle = heroReelPendingCycle(
    needsChange,
    isSettled,
    settledKey,
    stepKey,
    phase,
  )
  const swapRollStarted = swapping
  const showPrevious = heroReelShowsPreviousText({
    needsChange,
    isSettled,
    inHold,
    inHighlight,
    inCycle,
    inSwap,
    swapContentRevealed: swapRollStarted,
    pendingCycle,
  })
  const showOutgoingCell = heroReelTrackShowsOutgoing({
    needsChange,
    isSettled,
    inHold,
    inHighlight,
    inCycle,
    inSwap,
    inShrink,
    inUnhighlight,
    pendingCycle,
    swapRollStarted,
  })

  const spacerText =
    !needsChange || isSettled
      ? text
      : inSwap && swapRollStarted
        ? text
        : showPrevious
          ? prevText
          : allowResize && inCycle
            ? widerKanjiText(prevText, text)
            : text
  const spacerReading =
    !needsChange || isSettled
      ? (reading ?? text)
      : inSwap
        ? (reading ?? text)
        : showPrevious
          ? (prevReading ?? prevText)
          : (reading ?? text)

  const displayWidthChars =
    !needsChange || isSettled
      ? targetSlotChars
      : allowResize && (growing || shrinking)
        ? widthChars
        : showPrevious
          ? prevSlotChars
          : widthChars

  const resizeGrowing = allowResize && growing && inSwap
  const resizeShrinking =
    allowResize && shrinking && (inShrink || phase === 'postSwap')
  const resizeDuringSwap = allowResize && (growing || shrinking) && inSwap

  const slotStyle = {
    width: slotWidthEm(displayWidthChars, englishWidth),
    ...heroSlotStyleVars(),
    ...(quickSwap
      ? { '--hero-swap-duration': `${HERO_WORD_DRILL_SWAP_MS}ms` }
      : {}),
  } as CSSProperties

  const resizeDuringSwapLegacy = allowResize && (growing || shrinking) && inSwap

  const isEmptyAlsoSlot =
    alsoSwap && !displayWord(text) && !displayWord(prevText)

  const trackClass = [
    'hero-reel-track',
    inSwap
      ? swapping
        ? 'is-rolling'
        : 'is-roll-ready'
      : showOutgoingCell || inShrink || inUnhighlight
        ? 'is-at-out'
        : 'is-at-in',
  ].join(' ')

  const viewportClass = [
    'hero-reel-viewport',
    naturalWidth ? 'is-natural-width' : '',
    englishWidth ? 'is-english-width' : '',
    alsoSwap ? 'is-also-swap' : '',
    isEmptyAlsoSlot ? 'is-empty-slot' : '',
    inCycle || inShrink || inUnhighlight ? 'is-cycling' : '',
    resizeGrowing || resizeShrinking || resizeDuringSwap || resizeDuringSwapLegacy
      ? 'is-resizing'
      : '',
    resizeGrowing ? 'is-resizing-grow' : '',
    resizeShrinking ? 'is-resizing-shrink' : '',
    resizeDuringSwap || resizeDuringSwapLegacy ? 'is-resizing-during-swap' : '',
    inSwap ? 'is-swapping' : '',
    toneActive ? 'is-highlighted' : '',
    toneClass,
  ]
    .filter(Boolean)
    .join(' ')

  if (isSettled && !text && !alsoSwap) return null

  function outgoingReveal() {
    if (!highlight) return undefined
    if (inHighlight) return 'in' as const
    if (inExpand || inSwap || inShrink || inUnhighlight) return 'held' as const
    return undefined
  }

  function incomingReveal() {
    if (!highlight) return undefined
    if (alreadyHighlighted || heldHighlight) {
      if (inExpand || inSwap || inShrink || inUnhighlight) return 'held' as const
      return undefined
    }
    if (inSwap || inShrink || inUnhighlight) return 'in' as const
    return undefined
  }

  const textProps = {
    plainSuffix,
    showFurigana,
    delayedFuriganaMs,
    furiganaRevealReady: !delayedFuriganaMs || !inCycle,
  }
  const prevTextProps = {
    plainSuffix: prevPlainSuffix || plainSuffix,
    showFurigana,
    delayedFuriganaMs,
    furiganaRevealReady: !delayedFuriganaMs || !inCycle,
  }

  const cycleTextProps = textProps
  const cyclePrevTextProps = prevTextProps
  const cycleReading = reading
  const cyclePrevReading = prevReading
  const cycleSpacerReading = spacerReading ?? reading

  return (
    <span className={viewportClass} style={slotStyle}>
      <span className="hero-reel-spacer" aria-hidden>
        <HeroText text={spacerText} reading={cycleSpacerReading} {...cycleTextProps} />
      </span>
      <span className="hero-reel-clip">
        <span className={trackClass}>
          <span className="hero-reel-cell hero-reel-cell-in">
            {isSettled && heldHighlight && highlight ? (
              <HeroText
                text={text}
                reading={cycleReading}
                reveal="held"
                {...cycleTextProps}
              />
            ) : (
              <HeroText
                text={text}
                reading={cycleReading}
                reveal={incomingReveal()}
                unhighlight={inUnhighlight}
                {...cycleTextProps}
              />
            )}
          </span>
          <span className="hero-reel-cell hero-reel-cell-out">
            {showOutgoingCell ? (
              <HeroText
                text={prevText}
                reading={cyclePrevReading}
                reveal={outgoingReveal()}
                {...cyclePrevTextProps}
              />
            ) : (
              <span className="hero-reel-cell-fill" aria-hidden>&#8203;</span>
            )}
          </span>
        </span>
      </span>
    </span>
  )
}
