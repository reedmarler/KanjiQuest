import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { charLength, type HeroSentenceFrame } from '../data/heroSentences'
import { buildHeroStorySteps } from '../data/heroStories'
import { getSegmentReading } from '../lib/heroSentenceGloss'
import { getHeroEnglish } from '../lib/heroSentenceGloss'
import { buildHeroSteps } from '../lib/heroSequence'
import type { HeroPlaybackRate } from '../lib/heroPlayback'
import type { HeroSegment } from '../lib/posSentenceEngine'
import type { CardProgress, JlptLevel } from '../lib/types'
import type { WrongPool } from '../lib/wrongPool'
import { HeroText } from './HeroText'

type HeroDisplayMode = 'sentence' | 'word'
type StreamPhase = 'rest' | 'highlight' | 'swap'

// These are divided by playbackRate below, so raising them raises how long
// everything takes at 1x. Scaled by 1/0.6 from the original 1350/1150/1650
// so that HERO_PLAYBACK_RATES' new "1x" takes exactly as long as the old
// 0.6x step used to (the old 1x speed, reduced 40%) — every other step on
// the new ladder is a plain multiple of this same baseline.
const HERO_REST_MS = 2250
const HERO_HIGHLIGHT_MS = 1917
const HERO_SWAP_MS = 2750

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
  storyId?: string | null
  storyLevel?: JlptLevel
  paused: boolean
  playbackRate: HeroPlaybackRate
  onRotate?: () => void
}

function SegmentText({ segment, furiganaOn, delayedFurigana }: {
  segment: HeroSegment
  furiganaOn: boolean
  delayedFurigana: boolean
}) {
  return (
    <HeroText
      text={segment.text}
      reading={segment.reading ?? getSegmentReading(segment.text)}
      showFurigana={furiganaOn}
      delayedFuriganaMs={delayedFurigana ? 700 : undefined}
      reveal="base"
    />
  )
}

/** One small, staged animation: rest → highlight the outgoing slot → swap → settle. */
export function RotatingHeroSentence({
  wrongPool,
  progress,
  displayMode,
  furiganaOn,
  englishOn,
  delayedFurigana,
  jlptLevel,
  storyId,
  storyLevel,
  paused,
  playbackRate,
  onRotate,
}: RotatingHeroSentenceProps) {
  const [sequenceSeed, setSequenceSeed] = useState(newSequenceSeed)
  const effectiveStoryLevel = storyLevel ?? 'N5'
  // The level actually driving the visible stream. Changing the dashboard's
  // difficulty picker updates `jlptLevel` immediately, but we deliberately
  // keep rotating the current stream until the next scheduled swap rather
  // than cutting away mid-sentence — see the pending-level handling below.
  const [activeLevel, setActiveLevel] = useState(jlptLevel)
  const steps = useMemo(
    () => storyId ? buildHeroStorySteps(storyId, effectiveStoryLevel) : buildHeroSteps(wrongPool, progress, activeLevel, sequenceSeed),
    [wrongPool, progress, activeLevel, sequenceSeed, storyId, effectiveStoryLevel],
  )
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<StreamPhase>('rest')

  useEffect(() => {
    setSequenceSeed(newSequenceSeed())
    setIndex(0)
    setPhase('rest')
  }, [storyId, effectiveStoryLevel])

  const safeLength = Math.max(steps.length, 1)
  const step = steps[index % safeLength]
  const isStreamRollover = index + 1 >= steps.length
  const rolloverSeed = nextSequenceSeed(sequenceSeed)
  const rolloverSteps = useMemo(
    () => storyId ? buildHeroStorySteps(storyId, effectiveStoryLevel) : buildHeroSteps(wrongPool, progress, activeLevel, rolloverSeed),
    [wrongPool, progress, activeLevel, rolloverSeed, storyId, effectiveStoryLevel],
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
    () => levelIsPending ? buildHeroSteps(wrongPool, progress, jlptLevel, pendingSeed) : null,
    [levelIsPending, wrongPool, progress, jlptLevel, pendingSeed],
  )

  const nextStep = pendingSteps?.[0]
    ?? (isStreamRollover ? rolloverSteps[0] : steps[(index + 1) % safeLength])
  const frame = step?.frame
  const nextFrame = nextStep?.frame

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
      else {
        if (pendingSteps) {
          // The incoming frame already came from pendingSteps[0], so adopting
          // that same level/seed here does not create a second visual jump.
          setActiveLevel(jlptLevel)
          setSequenceSeed(pendingSeed)
          setIndex(0)
        } else if (isStreamRollover) {
          setSequenceSeed(rolloverSeed)
          setIndex(0)
        } else {
          setIndex((current) => current + 1)
        }
        setPhase('rest')
        onRotate?.()
      }
    }, duration)

    return () => window.clearTimeout(timer)
  }, [displayMode, index, isStreamRollover, jlptLevel, onRotate, paused, pendingSeed, pendingSteps, phase, playbackRate, rolloverSeed, steps.length])

  if (!frame || !nextFrame) return <div className="hero-sentence-loading" aria-hidden="true" />

  const isFrameChange = isStreamRollover || nextStep.templateRefresh
  const activeKey = isFrameChange ? null : nextStep.changed[0] ?? null
  const english = getHeroEnglish(frame)
  const nextEnglish = getHeroEnglish(nextFrame)
  const englishIsSwapping = phase === 'swap' && english !== nextEnglish
  const nextByKey = new Map((nextFrame.segments ?? []).map((segment) => [segment.key, segment]))

  function renderSegments(targetFrame: HeroSentenceFrame, isIncoming = false) {
    return (targetFrame.segments ?? []).map((segment) => {
      const isActive = segment.key === activeKey
      const nextSegment = nextByKey.get(segment.key)
      const swapping = phase === 'swap' && isActive && nextSegment && !isIncoming
      const currentWidth = charLength(segment.text)
      const reservedWidth = isActive && phase !== 'rest' && nextSegment
        ? Math.max(currentWidth, charLength(nextSegment.text))
        : currentWidth

      return (
        <span
          key={segment.key}
          className={[
            'hero-database-segment',
            segment.swappable ? 'is-swappable' : '',
            isActive && phase === 'highlight' ? 'is-highlighted' : '',
            swapping ? 'is-swapping' : '',
          ].filter(Boolean).join(' ')}
          style={segment.swappable
            ? ({ '--hero-database-slot-width': `${reservedWidth}em` } as CSSProperties)
            : undefined}
        >
          {swapping ? (
            <span className="hero-database-swap-stack">
              <span className="hero-database-word is-outgoing"><SegmentText segment={segment} furiganaOn={furiganaOn} delayedFurigana={delayedFurigana} /></span>
              <span className="hero-database-word is-incoming"><SegmentText segment={nextSegment} furiganaOn={furiganaOn} delayedFurigana={delayedFurigana} /></span>
            </span>
          ) : (
            <span className="hero-database-segment-content"><SegmentText segment={segment} furiganaOn={furiganaOn} delayedFurigana={delayedFurigana} /></span>
          )}
        </span>
      )
    })
  }

  return (
    <div
      className={`hero-sentence-block hero-database-block${storyId ? ' hero-story-block' : ''}`}
      style={{
        '--hero-database-highlight-duration': `${HERO_HIGHLIGHT_MS / playbackRate}ms`,
        '--hero-database-space-duration': `${HERO_HIGHLIGHT_MS / playbackRate}ms`,
        '--hero-database-swap-duration': `${HERO_SWAP_MS / playbackRate}ms`,
      } as CSSProperties}
    >
      <p className={`hero-sentence-line hero-database-line${phase === 'swap' && isFrameChange ? ' is-frame-swapping' : ''}`} aria-live="polite">
        {phase === 'swap' && isFrameChange ? (
          <span className="hero-database-frame-stack">
            <span className="hero-database-frame is-outgoing">{renderSegments(frame)}</span>
            <span className="hero-database-frame is-incoming">{renderSegments(nextFrame, true)}</span>
          </span>
        ) : renderSegments(frame)}
      </p>

      {englishOn && (
        <p className={`hero-database-english${englishIsSwapping ? ' is-swapping' : ''}`} aria-live="polite">
          {englishIsSwapping ? (
            <span className="hero-database-english-stack">
              <span className="hero-database-english-text is-outgoing">{english}</span>
              <span className="hero-database-english-text is-incoming">{nextEnglish}</span>
            </span>
          ) : (
            <span className="hero-database-english-text">{english}</span>
          )}
        </p>
      )}

    </div>
  )
}
