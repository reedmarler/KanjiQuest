import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { charLength, type HeroSentenceFrame } from '../data/heroSentences'
import { getSegmentReading } from '../lib/heroSentenceGloss'
import { getHeroEnglish } from '../lib/heroSentenceGloss'
import { diffEnglishWordSwap, isStrictSingleWordEnglishDiff } from '../lib/heroEnglishDiff'
import { buildHeroSteps } from '../lib/heroSequence'
import type { HeroSegment } from '../lib/posSentenceEngine'
import type { CardProgress, JlptLevel } from '../lib/types'
import type { WrongPool } from '../lib/wrongPool'
import { HeroText } from './HeroText'

type HeroDisplayMode = 'sentence' | 'word'
type StreamPhase = 'rest' | 'highlight' | 'swap'

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const
const SPEED_STORAGE_KEY = 'kanji-quest-hero-playback-rate'

function newSequenceSeed() {
  return Math.floor(Math.random() * 1_000_000_000)
}

export interface RotatingHeroSentenceProps {
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  displayMode: HeroDisplayMode
  furiganaOn: boolean
  delayedFurigana: boolean
  jlptLevel: JlptLevel
}

function savedPlaybackRate() {
  if (typeof window === 'undefined') return 1
  const stored = Number(window.localStorage.getItem(SPEED_STORAGE_KEY))
  return PLAYBACK_RATES.includes(stored as typeof PLAYBACK_RATES[number]) ? stored : 1
}

function frameWidths(frame: HeroSentenceFrame, frames: HeroSentenceFrame[]) {
  const widths = new Map<string, number>()
  for (const candidate of frames) {
    if (candidate.generatedPatternId !== frame.generatedPatternId) continue
    for (const segment of candidate.segments ?? []) {
      if (!segment.swappable) continue
      widths.set(segment.key, Math.max(widths.get(segment.key) ?? 0, charLength(segment.text)))
    }
  }
  return widths
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
  delayedFurigana,
  jlptLevel,
}: RotatingHeroSentenceProps) {
  const [sequenceSeed, setSequenceSeed] = useState(newSequenceSeed)
  const steps = useMemo(
    () => buildHeroSteps(wrongPool, progress, jlptLevel, sequenceSeed),
    [wrongPool, progress, jlptLevel, sequenceSeed],
  )
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<StreamPhase>('rest')
  const [paused, setPaused] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(savedPlaybackRate)

  useEffect(() => {
    setSequenceSeed(newSequenceSeed())
    setIndex(0)
    setPhase('rest')
  }, [jlptLevel])

  useEffect(() => {
    window.localStorage.setItem(SPEED_STORAGE_KEY, String(playbackRate))
  }, [playbackRate])

  const step = steps[index % Math.max(steps.length, 1)]
  const nextStep = steps[(index + 1) % Math.max(steps.length, 1)]
  const frame = step?.frame
  const nextFrame = nextStep?.frame
  const widths = useMemo(
    () => frame ? frameWidths(frame, steps.map((item) => item.frame)) : new Map<string, number>(),
    [frame, steps],
  )

  useEffect(() => {
    if (displayMode !== 'sentence' || steps.length < 2 || paused) return

    const duration = (
      phase === 'rest' ? 1350
      : phase === 'highlight' ? 1150
      : 1350
    ) / playbackRate

    const timer = window.setTimeout(() => {
      if (phase === 'rest') setPhase('highlight')
      else if (phase === 'highlight') setPhase('swap')
      else {
        if (index + 1 >= steps.length) {
          setSequenceSeed(newSequenceSeed())
          setIndex(0)
        } else {
          setIndex((current) => current + 1)
        }
        setPhase('rest')
      }
    }, duration)

    return () => window.clearTimeout(timer)
  }, [displayMode, index, paused, phase, playbackRate, steps.length])

  if (!frame || !nextFrame) return <div className="hero-sentence-loading" aria-hidden="true" />

  const isFrameChange = nextStep.templateRefresh
  const activeKey = isFrameChange ? null : nextStep.changed[0] ?? null
  const english = getHeroEnglish(frame)
  const nextEnglish = getHeroEnglish(nextFrame)
  const englishWordDiff = !isFrameChange
    ? diffEnglishWordSwap(english, nextEnglish, true)
    : null
  const canSwapEnglishWord = Boolean(englishWordDiff && isStrictSingleWordEnglishDiff(englishWordDiff))
  const nextByKey = new Map((nextFrame.segments ?? []).map((segment) => [segment.key, segment]))
  const speedIndex = PLAYBACK_RATES.indexOf(playbackRate as typeof PLAYBACK_RATES[number])

  function renderSegments(targetFrame: HeroSentenceFrame, isIncoming = false) {
    return (targetFrame.segments ?? []).map((segment) => {
      const isActive = segment.key === activeKey
      const nextSegment = nextByKey.get(segment.key)
      const width = segment.swappable
        ? Math.max(widths.get(segment.key) ?? 0, charLength(segment.text), charLength(nextSegment?.text ?? ''))
        : undefined
      const swapping = phase === 'swap' && isActive && nextSegment && !isIncoming

      return (
        <span
          key={segment.key}
          className={[
            'hero-database-segment',
            segment.swappable ? 'is-swappable' : '',
            isActive && phase === 'highlight' ? 'is-highlighted' : '',
            swapping ? 'is-swapping' : '',
          ].filter(Boolean).join(' ')}
          style={width ? ({ '--hero-database-slot-width': `${width}em` } as CSSProperties) : undefined}
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

  function renderEnglish() {
    if (!english) return null
    if (phase !== 'swap' || english === nextEnglish) return english

    if (canSwapEnglishWord && englishWordDiff) {
      return (
        <>
          {englishWordDiff.before}
          <span className="hero-database-english-slot">
            <span className="hero-database-english-word is-outgoing">{englishWordDiff.prevWord}</span>
            <span className="hero-database-english-word is-incoming">{englishWordDiff.nextWord}</span>
          </span>
          {englishWordDiff.after}
        </>
      )
    }

    return (
      <span className="hero-database-english-blur">
        <span className="is-outgoing">{english}</span>
        <span className="is-incoming">{nextEnglish}</span>
      </span>
    )
  }

  return (
    <div
      className="hero-sentence-block hero-database-block"
      style={{
        '--hero-database-highlight-duration': `${1150 / playbackRate}ms`,
        '--hero-database-swap-duration': `${1350 / playbackRate}ms`,
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

      <p className="hero-database-english" aria-live="polite">{renderEnglish()}</p>

      <div className="hero-playback-controls" aria-label="Sentence speed controls">
        <button type="button" aria-label="Slow down sentence" disabled={speedIndex === 0} onClick={() => setPlaybackRate(PLAYBACK_RATES[speedIndex - 1]!)}>−</button>
        <button type="button" className="hero-playback-rate" aria-label={`Sentence speed ${playbackRate} times`} onClick={() => setPlaybackRate(1)}>{playbackRate}×</button>
        <button type="button" aria-label="Speed up sentence" disabled={speedIndex === PLAYBACK_RATES.length - 1} onClick={() => setPlaybackRate(PLAYBACK_RATES[speedIndex + 1]!)}>+</button>
        <button type="button" className={paused ? 'is-paused' : ''} onClick={() => setPaused((value) => !value)}>{paused ? 'Play' : 'Pause'}</button>
      </div>
    </div>
  )
}
