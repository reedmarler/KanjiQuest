import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { charLength, HERO_CHAR_WIDTH_EM, type HeroSentenceFrame, type HeroStep } from '../data/heroSentences'
import { buildHeroStorySteps } from '../data/heroStories'
import { getSegmentReading, spokenSegmentText } from '../lib/heroSentenceGloss'
import { getHeroEnglish } from '../lib/heroSentenceGloss'
import { buildHeroSteps, type HeroSwapFocus } from '../lib/heroSequence'
import { heroSwapBlockChars } from '../lib/heroSlotResize'
import type { HeroPlaybackRate } from '../lib/heroPlayback'
import type { CardProgress, JlptLevel } from '../lib/types'
import type { WrongPool } from '../lib/wrongPool'
import { useFavoriteWords } from '../lib/favoriteWords'
import { getFuriganaRuns } from './FuriganaText'

type HeroDisplayMode = 'sentence' | 'word'
type StreamPhase = 'rest' | 'highlight' | 'swap'

// These are divided by playbackRate below, so raising them raises how long
// everything takes at 1x. Scaled by 1/0.7 from the prior 2250/1917/2750
// baseline so labeled 1x is 30% slower, with every other step a plain
// multiple of that same redefined baseline.
const HERO_REST_MS = 3214
const HERO_HIGHLIGHT_MS = 2739
const HERO_SWAP_MS = 3929
const STARTER_STEP_COUNT = 2

function newSequenceSeed() {
  return Math.floor(Math.random() * 1_000_000_000)
}

/** A stable successor lets the end of one stream animate directly into the next. */
function nextSequenceSeed(seed: number) {
  return (seed * 1_664_525 + 1_013_904_223) >>> 0
}

export interface RotatingHeroSentenceProps {
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  displayMode: HeroDisplayMode
  furiganaOn: boolean
  englishOn: boolean
  delayedFurigana: boolean
  jlptLevel: JlptLevel
  /** Grammar-focus drill: hold the sentence and rotate one part of speech. */
  swapFocus?: HeroSwapFocus | null
  storyId?: string | null
  storyLevel?: JlptLevel
  storyRolloverId?: string | null
  onStoryRollover?: (storyId: string) => void
  paused: boolean
  playbackRate: HeroPlaybackRate
  onRotate?: () => void
  rewindSignal?: number
  advanceSignal?: number
  onCanRewindChange?: (canRewind: boolean) => void
  /** Fires with the verified spoken reading of the sentence on screen. */
  onSentenceChange?: (speechText: string) => void
  /**
   * When false, the rest/highlight/swap timer still animates for visual
   * polish but stops short of calling advanceSentence — the caller is
   * expected to drive advancement itself (via `advanceSignal`). Story mode
   * uses this so the voice can finish reading a beat at its own pace
   * instead of the sentence rotating on a fixed clock underneath it.
   * Defaults to true, matching the old always-auto-advance behavior.
   */
  autoAdvance?: boolean
}

type HeroHistoryEntry = {
  sequenceSeed: number
  activeLevel: JlptLevel
  index: number
}

type PreparedStream = {
  key: string
  steps: HeroStep[]
}

/** One small, staged animation: rest → highlight the outgoing slot → swap → settle. */
export function RotatingHeroSentence({
  wrongPool,
  progress,
  displayMode,
  furiganaOn,
  englishOn,
  jlptLevel,
  swapFocus,
  storyId,
  storyLevel,
  storyRolloverId,
  onStoryRollover,
  paused,
  playbackRate,
  onRotate,
  rewindSignal = 0,
  advanceSignal = 0,
  onCanRewindChange,
  onSentenceChange,
  autoAdvance = true,
}: RotatingHeroSentenceProps) {
  const [sequenceSeed, setSequenceSeed] = useState(newSequenceSeed)
  // Starred words steer sentence selection only while the learner has asked
  // for it; an empty set leaves the stream exactly as it was.
  const { words: favouriteWords, prioritize: prioritizeFavourites } = useFavoriteWords()
  const favouriteWordSet = useMemo(
    () => new Set(prioritizeFavourites ? favouriteWords.map((word) => word.japanese) : []),
    [favouriteWords, prioritizeFavourites],
  )
  const effectiveStoryLevel = storyLevel ?? 'N5'
  // The level actually driving the visible stream. Changing the dashboard's
  // difficulty picker updates `jlptLevel` immediately, but we deliberately
  // keep rotating the current stream until the next scheduled swap rather
  // than cutting away mid-sentence — see the pending-level handling below.
  const [activeLevel, setActiveLevel] = useState(jlptLevel)
  const [history, setHistory] = useState<HeroHistoryEntry[]>([])
  const lastRewindSignalRef = useRef(rewindSignal)
  const lastAdvanceSignalRef = useRef(advanceSignal)
  const streamKey = `${storyId ?? 'database'}:${effectiveStoryLevel}:${activeLevel}:${sequenceSeed}:${swapFocus ?? 'sweep'}`
  // Build just enough of the database stream to render the current sentence
  // and its successor. The complete queue is prepared after the browser has
  // had a chance to paint those first two sentences.
  const starterSteps = useMemo(
    () => storyId
      ? buildHeroStorySteps(storyId, effectiveStoryLevel)
      : buildHeroSteps(wrongPool, progress, activeLevel, sequenceSeed, STARTER_STEP_COUNT, swapFocus ?? undefined, favouriteWordSet),
    [wrongPool, progress, activeLevel, sequenceSeed, storyId, effectiveStoryLevel, swapFocus, favouriteWordSet],
  )
  const [preparedStream, setPreparedStream] = useState<PreparedStream | null>(null)
  const steps = preparedStream?.key === streamKey ? preparedStream.steps : starterSteps
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<StreamPhase>('rest')

  useEffect(() => {
    if (storyId) return

    let cancelled = false
    let timer: number | undefined
    // requestAnimationFrame guarantees the tiny starter stream gets painted
    // before the longer, quality-filtered queue uses the main thread.
    const paintFrame = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        const completeSteps = buildHeroSteps(wrongPool, progress, activeLevel, sequenceSeed, undefined, swapFocus ?? undefined, favouriteWordSet)
        if (!cancelled) setPreparedStream({ key: streamKey, steps: completeSteps })
      }, 0)
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(paintFrame)
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [wrongPool, progress, activeLevel, sequenceSeed, storyId, streamKey, swapFocus, favouriteWordSet])

  useEffect(() => {
    onCanRewindChange?.(history.length > 0)
  }, [history.length, onCanRewindChange])

  useEffect(() => {
    setSequenceSeed(newSequenceSeed())
    setIndex(0)
    setPhase('rest')
    setHistory([])
  }, [storyId, effectiveStoryLevel])

  useEffect(() => {
    if (rewindSignal === lastRewindSignalRef.current) return
    lastRewindSignalRef.current = rewindSignal
    setHistory((items) => {
      const previous = items[items.length - 1]
      if (!previous) return items
      setSequenceSeed(previous.sequenceSeed)
      setActiveLevel(previous.activeLevel)
      setIndex(previous.index)
      setPhase('rest')
      return items.slice(0, -1)
    })
  }, [rewindSignal])

  const safeLength = Math.max(steps.length, 1)
  const step = steps[index % safeLength]
  const isStreamRollover = index + 1 >= steps.length
  const rolloverSeed = nextSequenceSeed(sequenceSeed)
  const effectiveStoryRolloverId = storyRolloverId ?? storyId
  const rolloverSteps = useMemo(
    () => storyId
      ? buildHeroStorySteps(effectiveStoryRolloverId ?? storyId, effectiveStoryLevel)
      : buildHeroSteps(wrongPool, progress, activeLevel, rolloverSeed, STARTER_STEP_COUNT, swapFocus ?? undefined, favouriteWordSet),
    [wrongPool, progress, activeLevel, rolloverSeed, storyId, effectiveStoryLevel, effectiveStoryRolloverId, swapFocus, favouriteWordSet],
  )

  // A level change previews on its own seed as soon as it's requested, so the
  // very next scheduled swap can rotate straight into it — but the currently
  // visible sentence (driven by `steps`/`activeLevel`) never gets cut short.
  const levelIsPending = !storyId && jlptLevel !== activeLevel
  // jlptLevel is a deliberate cache key, not a dependency of the computation
  // itself: a fresh random seed should be drawn each time the requested level
  // changes, even though newSequenceSeed() doesn't read jlptLevel's value.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pendingSeed = useMemo(() => newSequenceSeed(), [jlptLevel])
  const pendingSteps = useMemo(
    () => levelIsPending ? buildHeroSteps(wrongPool, progress, jlptLevel, pendingSeed, STARTER_STEP_COUNT, swapFocus ?? undefined, favouriteWordSet) : null,
    [levelIsPending, wrongPool, progress, jlptLevel, pendingSeed, swapFocus],
  )

  const advanceSentence = useCallback(() => {
    setHistory((items) => [
      ...items.slice(-4),
      { sequenceSeed, activeLevel, index },
    ])
    if (pendingSteps) {
      setActiveLevel(jlptLevel)
      setSequenceSeed(pendingSeed)
      setIndex(0)
    } else if (isStreamRollover) {
      if (storyId && effectiveStoryRolloverId && effectiveStoryRolloverId !== storyId) {
        onStoryRollover?.(effectiveStoryRolloverId)
      }
      setSequenceSeed(rolloverSeed)
      setIndex(0)
    } else {
      setIndex((current) => current + 1)
    }
    setPhase('rest')
    onRotate?.()
  }, [activeLevel, effectiveStoryRolloverId, index, isStreamRollover, jlptLevel, onRotate, onStoryRollover, pendingSeed, pendingSteps, rolloverSeed, sequenceSeed, storyId])

  useEffect(() => {
    if (advanceSignal === lastAdvanceSignalRef.current) return
    lastAdvanceSignalRef.current = advanceSignal
    advanceSentence()
  }, [advanceSignal, advanceSentence])

  const nextStep = pendingSteps?.[0]
    ?? (isStreamRollover ? rolloverSteps[0] : steps[(index + 1) % safeLength])
  const frame = step?.frame
  const nextFrame = nextStep?.frame

  // Read the generator's verified kana aloud instead of asking each browser
  // voice to guess ambiguous kanji readings such as 七時 (しちじ).
  const visibleSpeechText = (frame?.segments ?? [])
    .map((segment) => spokenSegmentText(segment))
    .join('')
  useEffect(() => {
    if (visibleSpeechText) onSentenceChange?.(visibleSpeechText)
  }, [visibleSpeechText, onSentenceChange])

  useEffect(() => {
    if (displayMode !== 'sentence' || steps.length < 2 || paused) return

    const duration = (
      phase === 'rest' ? HERO_REST_MS
      : phase === 'highlight' ? HERO_HIGHLIGHT_MS
      : HERO_SWAP_MS
    ) / playbackRate

    const timer = window.setTimeout(() => {
      if (phase === 'rest') setPhase('highlight')
      else if (phase === 'highlight') setPhase('swap')
      // Once settled in 'swap', a caller with autoAdvance off (Story mode
      // reading aloud) is expected to advance via `advanceSignal` itself —
      // staying put here is what lets the voice finish at its own pace.
      else if (autoAdvance) advanceSentence()
    }, duration)

    return () => window.clearTimeout(timer)
  }, [advanceSentence, autoAdvance, displayMode, paused, phase, playbackRate, steps.length])

  // Keep the dashboard header at its final height even if a rare generator
  // pass has not produced its first pair of usable sentences yet.
  if (!frame || !nextFrame) {
    return <div className="hero-sentence-block hero-database-block hero-sentence-loading" aria-hidden="true" />
  }

  const isFrameChange = isStreamRollover || nextStep.templateRefresh
  const english = getHeroEnglish(frame)
  const nextEnglish = getHeroEnglish(nextFrame)
  const englishIsSwapping = phase === 'swap' && english !== nextEnglish

  // Longer sentences risk wrapping to a cramped 3rd line on narrow phones —
  // taking the longer of the outgoing/incoming frame keeps this stable
  // across a swap instead of resizing mid-transition.
  const frameCharCount = (targetFrame: HeroSentenceFrame) =>
    (targetFrame.segments ?? []).reduce((sum, segment) => sum + charLength(segment.text), 0)
  const heroCharCount = Math.max(frameCharCount(frame), frameCharCount(nextFrame))

  // A rotation step changes exactly one slot, so the line can hold still and
  // roll just that word. Anything else — a new pattern, a stream rollover, or a
  // step that moved more than one segment — falls back to the whole-line fade.
  const rotationKey = !isFrameChange && nextStep.changed.length === 1 ? nextStep.changed[0]! : null

  function renderSegmentRuns(text: string, reading: string | undefined) {
    return getFuriganaRuns(text, reading ?? getSegmentReading(text)).map((run, index) => (
      <span
        key={`${run.text}-${index}`}
        className={`hero-database-full-run${run.reading ? ' has-reading' : ''}`}
      >
        {furiganaOn && run.reading && <span className="hero-database-full-reading" aria-hidden="true">{run.reading}</span>}
        <span className="hero-database-full-text">{run.text}</span>
      </span>
    ))
  }

  /**
   * One-slot rotation: every segment stays put and the changed word rolls.
   *
   * `.hero-database-segment.is-swappable` has a CSS `width` transition, but a
   * transition only animates between two explicit values — leaving width on
   * its content-driven default snaps instantly the moment the DOM swaps in
   * different text. Setting `--hero-database-slot-width` explicitly, sized to
   * fit both the outgoing and incoming word while they're overlaid, gives the
   * transition real start/end values so the segment eases into its new width
   * (and any resulting line-wrap) instead of jumping.
   */
  function renderRotatingSentence(targetFrame: HeroSentenceFrame, incoming: HeroSentenceFrame, changedKey: string) {
    const incomingByKey = new Map((incoming.segments ?? []).map((segment) => [segment.key, segment]))
    return (
      <span className="hero-database-full-sentence">
        {(targetFrame.segments ?? []).map((segment) => {
          const isChanging = segment.key === changedKey
          const next = incomingByKey.get(segment.key)
          const highlighted = isChanging && (phase === 'highlight' || phase === 'swap')
          const isSwapping = isChanging && phase === 'swap' && Boolean(next)
          // Reserving the combined width only during the swap phase crammed a
          // big length change (a short ending growing into a long one, or the
          // reverse) into one short window — the box visibly snapped instead
          // of gliding. Starting the reservation at the highlight phase gives
          // a large delta the full highlight+swap duration to grow or shrink,
          // instead of only the swap phase's slice of it.
          const reservesSwapWidth = isChanging && (phase === 'highlight' || phase === 'swap') && Boolean(next)
          const slotChars = reservesSwapWidth
            ? heroSwapBlockChars(charLength(segment.text), charLength(next!.text))
            : charLength(segment.text)
          const style = segment.swappable
            ? ({ '--hero-database-slot-width': `${slotChars * HERO_CHAR_WIDTH_EM}em` } as CSSProperties)
            : undefined
          return (
            <span
              key={segment.key}
              className={`hero-database-segment${segment.swappable ? ' is-swappable' : ''}${highlighted ? ' is-highlighted' : ''}`}
              style={style}
            >
              {isSwapping ? (
                <span className="hero-database-swap-stack">
                  <span className="hero-database-word is-outgoing">{renderSegmentRuns(segment.text, segment.reading)}</span>
                  <span className="hero-database-word is-incoming">{renderSegmentRuns(next!.text, next!.reading)}</span>
                </span>
              ) : (
                <span className="hero-database-segment-content">{renderSegmentRuns(segment.text, segment.reading)}</span>
              )}
            </span>
          )
        })}
      </span>
    )
  }

  function renderFullSentence(targetFrame: HeroSentenceFrame) {
    const segments = targetFrame.segments ?? []
    const text = segments.map((segment) => segment.text).join('')
    const reading = segments.map((segment) => segment.reading ?? getSegmentReading(segment.text)).join('')
    const runs = getFuriganaRuns(text, reading)

    return (
      <span className="hero-database-full-sentence">
        {runs.map((run, index) => (
          <span
            key={`${run.text}-${index}`}
            className={`hero-database-full-run${run.reading ? ' has-reading' : ''}`}
          >
            {furiganaOn && run.reading && <span className="hero-database-full-reading" aria-hidden="true">{run.reading}</span>}
            <span className="hero-database-full-text">{run.text}</span>
          </span>
        ))}
      </span>
    )
  }

  return (
    <div
      className={`hero-sentence-block hero-database-block${storyId ? ' hero-story-block' : ''}`}
      style={{
        '--hero-database-highlight-duration': `${HERO_HIGHLIGHT_MS / playbackRate}ms`,
        // The changing segment now reserves its swapped-in width starting at
        // the highlight phase (see reservesSwapWidth above), not just during
        // the swap phase — so the width transition needs the combined
        // highlight+swap duration to actually finish by the time the swap
        // animation does, instead of racing ahead and sitting idle.
        '--hero-database-space-duration': `${(HERO_HIGHLIGHT_MS + HERO_SWAP_MS) / playbackRate}ms`,
        '--hero-database-swap-duration': `${HERO_SWAP_MS / playbackRate}ms`,
        '--hero-database-char-count': heroCharCount,
      } as CSSProperties}
    >
      <p className={`hero-sentence-line hero-database-line${phase === 'swap' && isFrameChange ? ' is-frame-swapping' : ''}`} aria-live="polite">
        {rotationKey ? renderRotatingSentence(frame, nextFrame, rotationKey)
          : phase === 'swap' ? (
            <span className="hero-database-full-sentence-stack">
              <span className="hero-database-full-sentence-frame is-outgoing">{renderFullSentence(frame)}</span>
              <span className="hero-database-full-sentence-frame is-incoming">{renderFullSentence(nextFrame)}</span>
            </span>
          ) : renderFullSentence(frame)}
      </p>

      {englishOn && (
        <p className={`hero-database-english${englishIsSwapping ? ' is-swapping' : ''}`} aria-live="polite">
          <span className="hero-database-english-stack">
            {englishIsSwapping ? (
              <>
                <span className="hero-database-english-text is-outgoing">{english}</span>
                <span className="hero-database-english-text is-incoming">{nextEnglish}</span>
              </>
            ) : (
              <span className="hero-database-english-text">{english}</span>
            )}
          </span>
        </p>
      )}

    </div>
  )
}
