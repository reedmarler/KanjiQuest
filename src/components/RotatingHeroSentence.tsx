import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  charLength,
  HERO_CHAR_WIDTH_EM,
  isPosFrame,
  type HeroSentenceFrame,
  type HeroSlot,
} from '../data/heroSentences'
import { frameToJapanese } from '../lib/heroSentenceNatural'
import {
  HERO_DELAYED_FURIGANA_MS,
  HERO_HIGHLIGHT_MS,
  HERO_SENTENCE_REST_MS,
  HERO_SWAP_MS,
  HERO_WORD_DRILL_MS,
  heroHoldBeforeCycleMs,
  heroStepCycleMs,
} from '../lib/heroTimings'
import {
  HERO_SLOT_ORDER,
  heroEnglishNeedsResize,
  heroSlotNeedsResize,
} from '../lib/heroSlotResize'
import { buildHeroSteps } from '../lib/heroSequence'
import {
  highlightToneForSlot,
  plainSuffixForSlot,
  shouldHighlightSlot,
} from '../lib/heroHighlightTone'
import {
  getHeroEnglish,
  getHeroFrameReading,
  getHeroSlotReading,
  getSegmentReading,
} from '../lib/heroSentenceGloss'
import { buildHeroEnglishTrack, heroEnglishStepKey } from '../lib/heroEnglishTrack'
import { buildHeroWordDrill } from '../lib/heroWordDrill'
import type { CardProgress, JlptLevel } from '../lib/types'
import type { WrongPool } from '../lib/wrongPool'
import { HeroEnglishBlurLine } from './HeroEnglishBlurLine'
import { HeroEnglishWordReel } from './HeroEnglishWordReel'
import { HeroText } from './HeroText'
import { HeroWordReel } from './HeroWordReel'

type HeroDisplayMode = 'sentence' | 'word'
const HERO_JAPANESE_LETTER_SPACING_EM = 0.02

function posChangingSegmentKeys(
  frame: HeroSentenceFrame,
  prevFrame: HeroSentenceFrame,
): string[] {
  const prevSegs = prevFrame.segments ?? []
  const prevMap = new Map(prevSegs.map((s) => [s.key, s.text]))
  return (frame.segments ?? [])
    .filter((s) => s.swappable && prevMap.get(s.key) !== s.text)
    .map((s) => s.key)
}

function posSentenceVisualOffsetEm(
  frame: HeroSentenceFrame,
  stableWidths: Map<string, number>,
  activeSlot: string | null,
): number {
  const segments = frame.segments ?? []
  if (segments.length === 0) return 0

  const segmentWidth = (segment: NonNullable<HeroSentenceFrame['segments']>[number]) =>
    segment.swappable
      ? (stableWidths.get(segment.key) ?? charLength(segment.text)) * HERO_CHAR_WIDTH_EM
      : charLength(segment.text) * (
          HERO_CHAR_WIDTH_EM + HERO_JAPANESE_LETTER_SPACING_EM
        )
  const widths = segments.map(segmentWidth)
  const totalWidth = widths.reduce((sum, width) => sum + width, 0)
  const activeIndex = activeSlot
    ? segments.findIndex((segment) => segment.key === activeSlot)
    : -1
  const activeSegment = activeIndex >= 0 ? segments[activeIndex] : undefined
  const activeLeftWidth = widths.slice(0, Math.max(0, activeIndex)).reduce((a, b) => a + b, 0)
  const activeRightWidth = activeIndex >= 0
    ? widths.slice(activeIndex + 1).reduce((a, b) => a + b, 0)
    : 0
  const shorterSide = activeLeftWidth >= activeRightWidth ? 'right' : 'left'
  const activeGap = activeSegment
    ? Math.max(
        0,
        widths[activeIndex] - charLength(activeSegment.text) * HERO_CHAR_WIDTH_EM,
      )
    : 0

  let cursor = 0
  let visibleLeft = Number.POSITIVE_INFINITY
  let visibleRight = Number.NEGATIVE_INFINITY

  segments.forEach((segment, segmentIndex) => {
    const boxWidth = widths[segmentIndex]
    const textWidth = charLength(segment.text) * (
      HERO_CHAR_WIDTH_EM + HERO_JAPANESE_LETTER_SPACING_EM
    )
    const leftWidth = widths.slice(0, segmentIndex).reduce((a, b) => a + b, 0)
    const rightWidth = widths.slice(segmentIndex + 1).reduce((a, b) => a + b, 0)
    const anchoredLeft = !segment.swappable || leftWidth >= rightWidth
    const contentInset = anchoredLeft ? 0 : boxWidth - textWidth
    const onShorterSide = activeIndex >= 0 && (
      shorterSide === 'right' ? segmentIndex > activeIndex : segmentIndex < activeIndex
    )
    const spacingOffset = onShorterSide
      ? shorterSide === 'right' ? -activeGap : activeGap
      : 0
    const contentLeft = cursor + contentInset + spacingOffset

    visibleLeft = Math.min(visibleLeft, contentLeft)
    visibleRight = Math.max(visibleRight, contentLeft + textWidth)
    cursor += boxWidth
  })

  const visibleCenter = (visibleLeft + visibleRight) / 2
  const independentReelBoundaries = Math.max(
    0,
    segments.filter((segment) => segment.swappable).length - 1,
  )
  const reelBoundaryCompensation = independentReelBoundaries
    * HERO_JAPANESE_LETTER_SPACING_EM
    * 0.75
  return visibleCenter - totalWidth / 2 + reelBoundaryCompensation
}

interface LevelTransitionState {
  fromFrame: HeroSentenceFrame
  fromFullSentence: string
  fromFullSentenceReading: string
  fromEnglish: string
  toLevel: JlptLevel
}

interface DisplaySnapshot {
  frame: HeroSentenceFrame
  fullSentence: string
  fullReading: string
  english: string
}

export interface RotatingHeroSentenceProps {
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  displayMode: HeroDisplayMode
  furiganaOn: boolean
  delayedFurigana: boolean
  jlptLevel: JlptLevel
}

export function RotatingHeroSentence({
  wrongPool,
  progress,
  displayMode,
  furiganaOn,
  delayedFurigana,
  jlptLevel,
}: RotatingHeroSentenceProps) {
  const [activeLevel, setActiveLevel] = useState(jlptLevel)
  const pendingLevelRef = useRef<JlptLevel | null>(null)

  const steps = useMemo(
    () => buildHeroSteps(wrongPool, progress, activeLevel),
    [wrongPool, progress, activeLevel],
  )
  const wordDrill = useMemo(
    () => buildHeroWordDrill(wrongPool, progress, activeLevel),
    [wrongPool, progress, activeLevel],
  )

  const [index, setIndex] = useState(0)
  const [wordIndex, setWordIndex] = useState(0)
  const [levelTransition, setLevelTransition] = useState<LevelTransitionState | null>(null)
  const [spacingSwapIndex, setSpacingSwapIndex] = useState(-1)

  const step = steps[index % steps.length]
  const prevStep = index === 0 ? step : steps[(index - 1 + steps.length) % steps.length]
  const frame = step.frame
  const prevFrame = prevStep.frame

  const displaySnapshotRef = useRef<DisplaySnapshot>({
    frame,
    fullSentence: frameToJapanese(frame),
    fullReading: getHeroFrameReading(frame) ?? '',
    english: getHeroEnglish(frame),
  })

  const isLevelTransition = levelTransition !== null
  const effectivePrevFrame = isLevelTransition ? levelTransition.fromFrame : prevFrame
  const effectivePrevFullSentence = isLevelTransition
    ? levelTransition.fromFullSentence
    : frameToJapanese(prevFrame)
  const effectivePrevFullSentenceReading = isLevelTransition
    ? levelTransition.fromFullSentenceReading
    : getHeroFrameReading(prevFrame)

  const wordItem = wordDrill[wordIndex % wordDrill.length]
  const prevWordItem = wordDrill[
    (wordIndex - 1 + wordDrill.length) % wordDrill.length
  ]

  const english = useMemo(() => {
    if (displayMode === 'word') return wordItem.meaning
    return getHeroEnglish(frame)
  }, [displayMode, frame, wordItem.meaning])

  const changingSlots = useMemo(() => {
    if (isPosFrame(frame)) {
      return posChangingSegmentKeys(frame, effectivePrevFrame)
    }
    if (isLevelTransition) {
      return HERO_SLOT_ORDER.filter((slot) => frame[slot] !== effectivePrevFrame[slot])
    }
    return step.changed.filter((slot) => frame[slot as HeroSlot] !== prevFrame[slot as HeroSlot])
  }, [isLevelTransition, step.changed, frame, prevFrame, effectivePrevFrame])

  const fullSentence = useMemo(() => frameToJapanese(frame), [frame])
  const prevFullSentence = effectivePrevFullSentence
  const fullSentenceReading = useMemo(() => getHeroFrameReading(frame), [frame])
  const prevFullSentenceReading = effectivePrevFullSentenceReading

  const useFullSentenceReel = useMemo(() => {
    if (isLevelTransition) return true
    if (isPosFrame(frame)) {
      // New sentence — one unified reel, never a burst of per-slot pops
      if (step.templateRefresh) return true
      return false
    }
    if (step.templateRefresh) return true
    return changingSlots.some(
      (slot) => slot === 'subject' || slot === 'prefix' || slot === 'bridge',
    )
  }, [isLevelTransition, step.templateRefresh, changingSlots, frame])

  /** Exactly one swappable slot reels on neighbor steps; null when full-line swap */
  const activeSwapSlot = useMemo(() => {
    if (useFullSentenceReel || changingSlots.length === 0) return null
    return changingSlots[0]!
  }, [useFullSentenceReel, changingSlots])

  /** The prior slot's final offset must remain frozen throughout the next highlight. */
  const previousActiveSwapSlot = useMemo(() => {
    if (
      index <= 1
      || isLevelTransition
      || !isPosFrame(effectivePrevFrame)
      || prevStep.templateRefresh
    ) return null

    const beforePrevStep = steps[(index - 2 + steps.length) % steps.length]
    return posChangingSegmentKeys(effectivePrevFrame, beforePrevStep.frame)[0] ?? null
  }, [index, isLevelTransition, effectivePrevFrame, prevStep.templateRefresh, steps])

  const stableWidthsForFrame = useCallback((targetFrame: HeroSentenceFrame) => {
    const widths = new Map<string, number>()
    if (!isPosFrame(targetFrame)) return widths

    const patternId = targetFrame.generatedPatternId
    const relatedFrames = steps
      .map((candidate) => candidate.frame)
      .filter((candidate) =>
        isPosFrame(candidate) && candidate.generatedPatternId === patternId,
      )

    for (const candidate of [...relatedFrames, targetFrame]) {
      for (const segment of candidate.segments ?? []) {
        if (!segment.swappable) continue
        widths.set(
          segment.key,
          Math.max(widths.get(segment.key) ?? 0, charLength(segment.text)),
        )
      }
    }

    return widths
  }, [steps])

  /** Every slot keeps one pattern-wide width; a swap never moves its neighbors. */
  const stableSegmentWidths = useMemo(() => {
    const widths = stableWidthsForFrame(frame)
    for (const candidate of [effectivePrevFrame]) {
      for (const segment of candidate.segments ?? []) {
        if (!segment.swappable) continue
        widths.set(
          segment.key,
          Math.max(widths.get(segment.key) ?? 0, charLength(segment.text)),
        )
      }
    }

    return widths
  }, [stableWidthsForFrame, frame, effectivePrevFrame])

  /** Keep a visible rhythm: highlight, swap, unhighlight, then the next highlight. */
  const skipCycleUnhighlight = false

  /** Only level transitions skip per-slot spacing — every slot still reels */
  const fullLineSkipSpacing = isLevelTransition

  const highlightedChangingSlots = useMemo(() => {
    if (activeSwapSlot) return [activeSwapSlot]
    if (useFullSentenceReel && changingSlots.length > 0) return changingSlots
    return []
  }, [activeSwapSlot, useFullSentenceReel, changingSlots])
  const hasHighlightedChange = highlightedChangingSlots.length > 0

  const hasSentenceTransition = isLevelTransition
    ? true
    : useFullSentenceReel
      ? fullSentence !== prevFullSentence
      : hasHighlightedChange || english !== getHeroEnglish(effectivePrevFrame)

  const englishStepKey = useMemo(
    () => heroEnglishStepKey(useFullSentenceReel, highlightedChangingSlots),
    [useFullSentenceReel, highlightedChangingSlots],
  )

  const englishTrack = useMemo(() => {
    if (isLevelTransition && levelTransition) {
      return {
        mode: 'blur' as const,
        text: getHeroEnglish(frame),
        prevText: levelTransition.fromEnglish,
        stepKey: 'level',
      }
    }

    return buildHeroEnglishTrack(
      frame,
      effectivePrevFrame,
      useFullSentenceReel,
      activeSwapSlot ? [activeSwapSlot] : changingSlots,
      highlightedChangingSlots,
      englishStepKey,
      hasSentenceTransition,
    )
  }, [
    isLevelTransition,
    levelTransition,
    frame,
    effectivePrevFrame,
    useFullSentenceReel,
    activeSwapSlot,
    changingSlots,
    highlightedChangingSlots,
    englishStepKey,
    hasSentenceTransition,
  ])

  const skipPreSwapSpacing = useMemo(
    () => fullLineSkipSpacing && useFullSentenceReel,
    [fullLineSkipSpacing, useFullSentenceReel],
  )

  const stepResizePlan = useMemo(() => {
    let needsPreGrow = false
    let needsPostShrink = false

    if (!skipPreSwapSpacing) {
      if (useFullSentenceReel) {
        const prevChars = charLength(prevFullSentence)
        const targetChars = charLength(fullSentence)
        if (heroSlotNeedsResize(prevChars, targetChars)) {
          if (targetChars > prevChars) needsPreGrow = true
          if (targetChars < prevChars) needsPostShrink = true
        }
      } else {
        for (const slot of highlightedChangingSlots) {
          const prevText = isPosFrame(effectivePrevFrame)
            ? effectivePrevFrame.segments?.find((s) => s.key === slot)?.text ?? ''
            : effectivePrevFrame[slot as HeroSlot]
          const targetText = isPosFrame(frame)
            ? frame.segments?.find((s) => s.key === slot)?.text ?? ''
            : frame[slot as HeroSlot]
          const prevChars = charLength(prevText)
          const targetChars = charLength(targetText)
          if (!heroSlotNeedsResize(prevChars, targetChars)) continue
          if (targetChars > prevChars) needsPreGrow = true
          if (targetChars < prevChars) needsPostShrink = true
        }

        if (englishTrack.mode === 'partial') {
          const { prevSlotChars, targetSlotChars } = englishTrack.reel
          if (heroEnglishNeedsResize(prevSlotChars, targetSlotChars)) {
            if (targetSlotChars > prevSlotChars) needsPreGrow = true
            if (targetSlotChars < prevSlotChars) needsPostShrink = true
          }
        }
      }
    }

    return { needsPreGrow, needsPostShrink }
  }, [
    skipPreSwapSpacing,
    useFullSentenceReel,
    fullSentence,
    prevFullSentence,
    highlightedChangingSlots,
    frame,
    effectivePrevFrame,
    englishTrack,
  ])

  const holdBeforeCycle = useMemo(
    () => heroHoldBeforeCycleMs(step.templateRefresh || isLevelTransition),
    [step.templateRefresh, isLevelTransition],
  )

  useEffect(() => {
    setSpacingSwapIndex(-1)
    if (useFullSentenceReel || !isPosFrame(frame) || !activeSwapSlot) return

    const timer = window.setTimeout(() => {
      setSpacingSwapIndex(index)
    }, holdBeforeCycle + HERO_HIGHLIGHT_MS)

    return () => window.clearTimeout(timer)
  }, [index, frame, useFullSentenceReel, activeSwapSlot, holdBeforeCycle])

  /** Always wait for the full highlight → swap → unhighlight cycle */
  const stepInterval = useMemo(
    () =>
      holdBeforeCycle +
      heroStepCycleMs(
        useFullSentenceReel ? fullLineSkipSpacing : false,
        stepResizePlan.needsPreGrow,
        stepResizePlan.needsPostShrink,
        { alreadyHighlighted: false, skipUnhighlight: skipCycleUnhighlight },
      ) +
      HERO_SENTENCE_REST_MS,
    [
      holdBeforeCycle,
      useFullSentenceReel,
      fullLineSkipSpacing,
      stepResizePlan.needsPreGrow,
      stepResizePlan.needsPostShrink,
      skipCycleUnhighlight,
    ],
  )

  const [shownEnglish, setShownEnglish] = useState(english)
  const [wordEnglishRevealed, setWordEnglishRevealed] = useState(true)
  const wordRevealTimerRef = useRef(0)
  const stepAdvanceTimerRef = useRef(0)
  const stepIntervalForIndexRef = useRef(stepInterval)
  const partialStaticRef = useRef({ index: -1, before: '', after: '' })

  useEffect(() => {
    stepIntervalForIndexRef.current = stepInterval
  }, [index, stepInterval])

  const sentenceFurigana = displayMode === 'sentence' && furiganaOn
  const wordDrillTextProps = {
    showFurigana: delayedFurigana,
    delayedFuriganaMs: delayedFurigana ? HERO_DELAYED_FURIGANA_MS : undefined,
  }

  const scheduleWordEnglishReveal = useCallback(() => {
    window.clearTimeout(wordRevealTimerRef.current)

    if (!delayedFurigana) {
      setWordEnglishRevealed(true)
      return
    }

    setWordEnglishRevealed(false)
    wordRevealTimerRef.current = window.setTimeout(() => {
      setWordEnglishRevealed(true)
    }, HERO_DELAYED_FURIGANA_MS)
  }, [delayedFurigana])

  useEffect(() => {
    if (jlptLevel === activeLevel) {
      pendingLevelRef.current = null
      return
    }
    pendingLevelRef.current = jlptLevel
  }, [jlptLevel, activeLevel])

  useEffect(() => {
    if (levelTransition) return

    displaySnapshotRef.current = {
      frame,
      fullSentence,
      fullReading: fullSentenceReading ?? '',
      english: displayMode === 'word' ? wordItem.meaning : getHeroEnglish(frame),
    }
  }, [
    levelTransition,
    frame,
    fullSentence,
    fullSentenceReading,
    displayMode,
    wordItem.meaning,
    index,
  ])

  useEffect(() => {
    if (!levelTransition) return

    const delay = stepInterval
    const id = window.setTimeout(() => {
      setLevelTransition(null)
    }, delay)

    return () => window.clearTimeout(id)
  }, [levelTransition, stepInterval])

  useEffect(() => {
    setWordIndex(0)
  }, [wordDrill])

  useEffect(() => {
    if (displayMode === 'sentence') {
      setShownEnglish(getHeroEnglish(frame))
      setWordEnglishRevealed(true)
    }
  }, [displayMode, frame])

  useEffect(() => {
    if (displayMode !== 'word') return

    setShownEnglish(wordItem.meaning)
    window.clearTimeout(wordRevealTimerRef.current)

    if (!delayedFurigana) {
      setWordEnglishRevealed(true)
      return
    }

    setWordEnglishRevealed(false)
  }, [displayMode, wordIndex, wordItem.meaning, delayedFurigana])

  useEffect(() => {
    if (displayMode !== 'word') return
    if (wordItem.word !== prevWordItem.word) return
    scheduleWordEnglishReveal()
  }, [
    displayMode,
    wordIndex,
    wordItem.word,
    prevWordItem.word,
    scheduleWordEnglishReveal,
  ])

  useEffect(() => {
    return () => window.clearTimeout(wordRevealTimerRef.current)
  }, [])

  useEffect(() => {
    if (displayMode !== 'sentence') return
    if (hasSentenceTransition) return
    setShownEnglish(english)
  }, [displayMode, hasSentenceTransition, english])

  useEffect(() => {
    if (displayMode !== 'sentence' || steps.length <= 1 || levelTransition) return

    window.clearTimeout(stepAdvanceTimerRef.current)
    const delay = stepIntervalForIndexRef.current
    stepAdvanceTimerRef.current = window.setTimeout(() => {
      const pending = pendingLevelRef.current
      if (pending && pending !== activeLevel) {
        const snap = displaySnapshotRef.current
        setLevelTransition({
          fromFrame: snap.frame,
          fromFullSentence: snap.fullSentence,
          fromFullSentenceReading: snap.fullReading,
          fromEnglish: snap.english,
          toLevel: pending,
        })
        setActiveLevel(pending)
        pendingLevelRef.current = null
        setIndex(0)
        setWordIndex(0)
        return
      }

      // Keep a monotonic index so wrapping retains the actual final frame as
      // the previous sentence. Resetting to zero made the first frame compare
      // with itself and bypassed the full-sentence reel.
      setIndex((i) => i + 1)
    }, delay)

    return () => window.clearTimeout(stepAdvanceTimerRef.current)
  }, [
    displayMode,
    index,
    steps.length,
    levelTransition,
    activeLevel,
  ])

  useEffect(() => {
    if (displayMode !== 'word' || wordDrill.length <= 1) return

    const id = window.setTimeout(() => {
      setWordIndex((i) => (i + 1) % wordDrill.length)
    }, HERO_WORD_DRILL_MS)

    return () => window.clearTimeout(id)
  }, [displayMode, wordIndex, wordDrill.length])

  function renderSlotContent(slot: HeroSlot, text: string, prevText: string) {
    const textChanged = text !== prevText
    const reading = getHeroSlotReading(slot, frame)
    const prevReading = getHeroSlotReading(slot, effectivePrevFrame)
    const plainSuffix = plainSuffixForSlot(slot, text)
    const prevPlainSuffix = plainSuffixForSlot(slot, prevText)
    const shouldSwap =
      activeSwapSlot === slot
      && textChanged
      && shouldHighlightSlot(slot)

    if (!shouldSwap) {
      return (
        <HeroText
          text={text}
          reading={reading}
          plainSuffix={plainSuffix}
          showFurigana={sentenceFurigana}
        />
      )
    }

    const highlightTone = highlightToneForSlot(slot)

    return (
      <HeroWordReel
        text={text}
        reading={reading}
        prevText={prevText}
        prevReading={prevReading}
        spin
        highlight
        highlightTone={highlightTone}
        plainSuffix={plainSuffix}
        prevPlainSuffix={prevPlainSuffix}
        prevSlotChars={charLength(prevText)}
        targetSlotChars={charLength(text)}
        stepKey={`${index}-${slot}`}
        skipPreSwapSpacing={skipPreSwapSpacing}
        skipUnhighlight={skipCycleUnhighlight}
        holdBeforeCycleMs={holdBeforeCycle}
        showFurigana={sentenceFurigana}
      />
    )
  }

  function renderSegment(
    seg: NonNullable<HeroSentenceFrame['segments']>[number],
    segIndex: number,
  ) {
    const prevSegs = effectivePrevFrame.segments ?? []
    const prevSeg = prevSegs[segIndex]
    const prevText = prevSeg?.text ?? seg.text
    const text = seg.text
    const reading = seg.reading ?? getSegmentReading(text)
    const prevReading = prevSeg?.reading ?? getSegmentReading(prevText)
    const plainSuffix = plainSuffixForSlot(seg.key, text)
    const prevPlainSuffix = plainSuffixForSlot(seg.key, prevText)
    const textChanged = text !== prevText
    const stableSlotChars = stableSegmentWidths.get(seg.key)
      ?? Math.max(charLength(prevText), charLength(text))

    if (!seg.swappable) {
      return (
        <HeroText
          text={text}
          reading={reading}
          plainSuffix={plainSuffix}
          showFurigana={sentenceFurigana}
        />
      )
    }

    const shouldSwap =
      activeSwapSlot === seg.key
      && textChanged
      && shouldHighlightSlot(seg.key)
    const highlightTone = highlightToneForSlot(seg.key)

    return (
      <HeroWordReel
        text={text}
        reading={reading}
        prevText={prevText}
        prevReading={prevReading}
        spin={shouldSwap}
        highlight={shouldSwap}
        highlightTone={highlightTone}
        plainSuffix={plainSuffix}
        prevPlainSuffix={prevPlainSuffix}
        prevSlotChars={stableSlotChars}
        targetSlotChars={stableSlotChars}
        stepKey={`${index}-${seg.key}`}
        skipPreSwapSpacing={skipPreSwapSpacing}
        skipUnhighlight={skipCycleUnhighlight}
        holdBeforeCycleMs={holdBeforeCycle}
        showFurigana={sentenceFurigana}
      />
    )
  }

  function renderPosSentenceLine() {
    const segments = frame.segments ?? []
    const segmentWidth = (
      segment: NonNullable<HeroSentenceFrame['segments']>[number],
    ) => segment.swappable
      ? stableSegmentWidths.get(segment.key) ?? charLength(segment.text)
      : charLength(segment.text)
    const buildSpacingOffsets = (
      spacingFrame: HeroSentenceFrame,
      slot: string | null,
    ) => {
      const offsets = new Map<string, number>()
      const spacingSegments = spacingFrame.segments ?? []
      const activeIndex = slot
        ? spacingSegments.findIndex((segment) => segment.key === slot)
        : -1
      if (activeIndex < 0) return offsets

      const activeSegment = spacingSegments[activeIndex]
      const leftWidth = spacingSegments
        .slice(0, activeIndex)
        .reduce((sum, segment) => sum + segmentWidth(segment), 0)
      const rightWidth = spacingSegments
        .slice(activeIndex + 1)
        .reduce((sum, segment) => sum + segmentWidth(segment), 0)
      const stableChars = activeSegment.swappable
        ? stableSegmentWidths.get(activeSegment.key) ?? charLength(activeSegment.text)
        : charLength(activeSegment.text)
      const gapEm = Math.max(0, stableChars - charLength(activeSegment.text)) * HERO_CHAR_WIDTH_EM
      const shorterSide = leftWidth >= rightWidth ? 'right' : 'left'

      spacingSegments.forEach((segment, segmentIndex) => {
        const isShorterSide = shorterSide === 'right'
          ? segmentIndex > activeIndex
          : segmentIndex < activeIndex
        if (!isShorterSide) return
        offsets.set(segment.key, shorterSide === 'right' ? -gapEm : gapEm)
      })

      return offsets
    }
    const previousSpacingOffsets = isPosFrame(effectivePrevFrame)
      ? buildSpacingOffsets(effectivePrevFrame, previousActiveSwapSlot)
      : new Map<string, number>()
    const targetSpacingOffsets = buildSpacingOffsets(frame, activeSwapSlot)
    const spacingSwapStarted = spacingSwapIndex === index
    const sentenceStyle = {
      '--hero-short-side-delay': '0ms',
      '--hero-short-side-duration': `${HERO_SWAP_MS}ms`,
    } as CSSProperties
    const renderSegmentNode = (
      seg: NonNullable<HeroSentenceFrame['segments']>[number],
      segIndex: number,
    ) => {
      const stableChars = seg.swappable ? stableSegmentWidths.get(seg.key) : undefined
      const leftWidth = segments
        .slice(0, segIndex)
        .reduce((sum, segment) => sum + segmentWidth(segment), 0)
      const rightWidth = segments
        .slice(segIndex + 1)
        .reduce((sum, segment) => sum + segmentWidth(segment), 0)
      const anchorClass = seg.swappable
        ? leftWidth >= rightWidth
          ? 'is-anchored-left'
          : 'is-anchored-right'
        : ''
      const shortSideOffset = spacingSwapStarted
        ? targetSpacingOffsets.get(seg.key) ?? 0
        : previousSpacingOffsets.get(seg.key) ?? 0
      const isShorterSideSegment = shortSideOffset !== 0
      const style = {
        ...(stableChars ? { width: `${stableChars * HERO_CHAR_WIDTH_EM}em` } : {}),
        transform: `translateX(${shortSideOffset}em)`,
      } as CSSProperties

      return (
        <span
          key={`hero-seg-${segIndex}`}
          className={`hero-segment hero-segment-${seg.key} ${anchorClass}${isShorterSideSegment ? ' is-short-side-adjusting' : ''}`.trim()}
          style={style}
        >
          {renderSegment(seg, segIndex)}
        </span>
      )
    }

    return (
      <span className="hero-slot-pos-sentence" style={sentenceStyle}>
        {segments.map(renderSegmentNode)}
      </span>
    )
  }

  function renderSlot(slot: HeroSlot) {
    const text = frame[slot]
    const prevText = effectivePrevFrame[slot]

    if (slot === 'modifier' && !text && !prevText) {
      return <span key="hero-slot-modifier" className="hero-slot-modifier" aria-hidden />
    }

    if ((slot === 'prefix' || slot === 'bridge') && !text && !prevText) {
      return (
        <span key={`hero-slot-${slot}`} className={`hero-slot-${slot}`} aria-hidden />
      )
    }

    if ((slot === 'subject' || slot === 'topicParticle') && !text && !prevText) {
      return (
        <span key={`hero-slot-${slot}`} className={`hero-slot-${slot}`} aria-hidden />
      )
    }

    return (
      <span key={`hero-slot-${slot}`} className={`hero-slot-${slot}`}>
        {renderSlotContent(slot, text, prevText)}
      </span>
    )
  }

  function renderFullSentenceLine() {
    const textChanged = fullSentence !== prevFullSentence
    const transitionKey = isLevelTransition ? `level-${levelTransition?.toLevel}` : `${index}-full`
    const previousPosition = isPosFrame(effectivePrevFrame)
      ? posSentenceVisualOffsetEm(
          effectivePrevFrame,
          stableWidthsForFrame(effectivePrevFrame),
          previousActiveSwapSlot,
        )
      : 0
    const targetPosition = isPosFrame(frame)
      ? posSentenceVisualOffsetEm(frame, stableWidthsForFrame(frame), null)
      : 0
    const positionStyle = {
      '--hero-full-position-from': `${previousPosition}em`,
      '--hero-full-position-to': `${targetPosition}em`,
      '--hero-full-position-delay': `${holdBeforeCycle + HERO_HIGHLIGHT_MS}ms`,
      '--hero-full-position-duration': `${HERO_SWAP_MS}ms`,
    } as CSSProperties

    return (
      <span className="hero-slot-full-sentence">
        <span
          className={`hero-full-sentence-mount${textChanged ? ' is-position-handoff' : ''}`}
          style={positionStyle}
        >
          <HeroWordReel
            text={fullSentence}
            reading={fullSentenceReading}
            prevText={prevFullSentence}
            prevReading={prevFullSentenceReading}
            spin={textChanged}
            highlight={textChanged}
            prevSlotChars={charLength(prevFullSentence)}
            targetSlotChars={charLength(fullSentence)}
            stepKey={transitionKey}
            skipPreSwapSpacing={skipPreSwapSpacing}
            holdBeforeCycleMs={holdBeforeCycle}
            naturalWidth
            showFurigana={sentenceFurigana}
          />
        </span>
      </span>
    )
  }

  function renderWordLine() {
    const wordChanged = wordItem.word !== prevWordItem.word

    return (
      <span className="hero-slot-word">
        <HeroWordReel
          text={wordItem.word}
          reading={wordItem.reading}
          prevText={prevWordItem.word}
          prevReading={prevWordItem.reading}
          spin={wordChanged}
          highlight={false}
          prevSlotChars={charLength(prevWordItem.word)}
          targetSlotChars={charLength(wordItem.word)}
          stepKey={`word-${wordIndex}`}
          skipPreSwapSpacing
          quickSwap
          onSettled={scheduleWordEnglishReveal}
          {...wordDrillTextProps}
        />
      </span>
    )
  }

  const sentenceLineClass = [
    'hero-sentence-line',
    useFullSentenceReel ? 'is-full-sentence' : '',
    isLevelTransition ? 'is-level-transition' : '',
    displayMode === 'word' ? 'is-word-mode' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const currentEnglish = getHeroEnglish(frame)
  const prevEnglish = getHeroEnglish(effectivePrevFrame)
  const englishChanges = currentEnglish !== prevEnglish

  function renderEnglishLine() {
    if (displayMode === 'word') {
      return (
        <span className="hero-english-line-center">
          <span
            className={[
              'hero-english-line',
              delayedFurigana
                ? wordEnglishRevealed
                  ? 'is-word-revealed'
                  : 'is-word-pending'
                : 'is-clear',
            ].join(' ')}
          >
            <span className="hero-english-text">{shownEnglish}</span>
          </span>
        </span>
      )
    }

    if (!englishChanges && !hasSentenceTransition) {
      return (
        <span className="hero-english-line-center">
          <span className="hero-english-line is-clear">
            <span className="hero-english-text">{currentEnglish}</span>
          </span>
        </span>
      )
    }

    if (englishTrack.mode === 'partial') {
      const slot = englishTrack.reel.slotKey as HeroSlot

      if (partialStaticRef.current.index !== index) {
        partialStaticRef.current = {
          index,
          before: englishTrack.before,
          after: englishTrack.after,
        }
      }
      const { before: staticBefore, after: staticAfter } = partialStaticRef.current

      return (
        <span className="hero-english-line-center">
          <span className="hero-english-line is-partial-swap">
            <span className="hero-english-line-inner">
              <span className="hero-english-static">{staticBefore}</span>
              <HeroEnglishWordReel
                text={englishTrack.reel.text}
                prevText={englishTrack.reel.prevText}
                stepKey={`${index}-${slot}`}
                skipPreSwapSpacing={skipPreSwapSpacing}
                prevSlotChars={englishTrack.reel.prevSlotChars}
                targetSlotChars={englishTrack.reel.targetSlotChars}
                alsoSwap={englishTrack.reel.alsoSwap}
                resizeTiming={stepResizePlan}
                highlightTone={highlightToneForSlot(slot)}
                skipUnhighlight={skipCycleUnhighlight}
                holdBeforeCycleMs={holdBeforeCycle}
              />
              <span className="hero-english-static">{staticAfter}</span>
            </span>
          </span>
        </span>
      )
    }

    const blurStepKey = isLevelTransition
      ? `level-${levelTransition?.toLevel}`
      : `${index}-${englishTrack.mode === 'blur' ? englishTrack.stepKey : 'full'}`

    return (
      <span className="hero-english-line-center">
        <HeroEnglishBlurLine
          text={currentEnglish}
          prevText={prevEnglish}
          stepKey={blurStepKey}
          skipPreSwapSpacing={skipPreSwapSpacing}
          resizeTiming={stepResizePlan}
          skipUnhighlight={skipCycleUnhighlight}
          holdBeforeCycleMs={holdBeforeCycle}
        />
      </span>
    )
  }

  return (
    <div className="hero-sentence-block">
      <p
        className={sentenceLineClass}
        aria-live="polite"
      >
        {displayMode === 'sentence'
          ? useFullSentenceReel
            ? renderFullSentenceLine()
            : isPosFrame(frame)
              ? renderPosSentenceLine()
              : HERO_SLOT_ORDER.map(renderSlot)
          : renderWordLine()}
      </p>
      <div className="hero-english-row">
        <div
          className="hero-english-mount"
          aria-live="polite"
          aria-label={currentEnglish}
        >
          {renderEnglishLine()}
        </div>
      </div>
    </div>
  )
}
