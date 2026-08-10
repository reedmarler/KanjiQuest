import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { CardProgress, JlptLevel } from '../lib/types'
import type { WrongPool } from '../lib/wrongPool'
import type { AchievementMetrics } from '../lib/achievementProgress'
import type { QuestProgress } from '../lib/questProgress'
import { buildAchievements } from '../data/achievements'
import { complexityDetails, GENERATION_COMPLEXITIES, heroJlptForComplexity, type GenerationComplexity } from '../lib/generationComplexity'
import { HERO_STORY_DEFINITIONS, HERO_STORY_LEVELS, getHeroStoriesForLevel } from '../data/heroStories'
import {
  HERO_PLAYBACK_RATES,
  HERO_SPEED_STORAGE_KEY,
  type HeroPlaybackRate,
} from '../lib/heroPlayback'
import {
  canSpeakJapanese,
  speakJapanese,
  stopSpeaking,
  watchSpeechSupport,
} from '../lib/speech'

const HERO_SPEECH_STORAGE_KEY = 'kanji-quest-hero-speech-v1'
const HERO_SPEECH_RATE_STORAGE_KEY = 'kanji-quest-hero-speech-rate-v1'
const HERO_SPEECH_VOLUME_STORAGE_KEY = 'kanji-quest-hero-speech-volume-v1'
const HERO_SETTINGS_EXPANDED_STORAGE_KEY = 'kanji-quest-hero-settings-expanded-v1'
/** Voice speeds, slowest to fastest. 1x is the engine's natural pace. */
const HERO_SPEECH_RATES = [
  0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.25, 1.5, 1.75, 2, 2.5, 3,
] as const
type HeroSpeechRate = typeof HERO_SPEECH_RATES[number]

// One full rest/highlight/swap cycle in RotatingHeroSentence at 1x.
const HERO_SENTENCE_CYCLE_MS = 2250 + 1917 + 2750
const COMBINING_SMALL_KANA = new Set([
  'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゃ', 'ゅ', 'ょ', 'ゎ',
  'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ャ', 'ュ', 'ョ', 'ヮ',
])

function minimumSpeechRateForSentence(text: string, playbackRate: HeroPlaybackRate): HeroSpeechRate {
  const spokenCharacters = Array.from(text).filter((character) => /[\p{L}\p{N}ー]/u.test(character))
  const moraCount = spokenCharacters.reduce(
    (total, character) => total + (COMBINING_SMALL_KANA.has(character) ? 0 : 1),
    0,
  )
  const pauseCount = (text.match(/[、。！？,.!?]/g) ?? []).length
  // Roughly 5.25 mora per second at 1x, with room for voice startup and pauses.
  const estimatedReadingMs = 300 + (moraCount * 190) + (pauseCount * 220)
  const availableMs = HERO_SENTENCE_CYCLE_MS / playbackRate
  const requiredRate = estimatedReadingMs / availableMs

  return HERO_SPEECH_RATES.find((rate) => rate >= requiredRate)
    ?? HERO_SPEECH_RATES[HERO_SPEECH_RATES.length - 1]
}

/** Voice volume steps, muted to full, in 10% increments. */
const HERO_SPEECH_VOLUMES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] as const
type HeroSpeechVolume = typeof HERO_SPEECH_VOLUMES[number]
type StoryPlaybackMode = 'repeat' | 'shuffle'

const COMPLEXITY_DISPLAY: Record<GenerationComplexity, { level: string; name: string }> = {
  1: { level: 'L1', name: 'Basics' },
  2: { level: 'L2', name: 'Pairs' },
  3: { level: 'L3', name: 'Chains' },
  4: { level: 'L4', name: 'Logic' },
  5: { level: 'L5', name: 'Expert' },
}

const STORY_LEVEL_DISPLAY: Array<{ level: JlptLevel; name: string }> = [
  { level: 'N5', name: 'Intro' },
  { level: 'N4', name: 'Elementary' },
  { level: 'N3', name: 'Intermediate' },
  { level: 'N2', name: 'Upper' },
  { level: 'N1', name: 'Advanced' },
]

function speechVolumeIcon(volume: number): string {
  if (volume === 0) return '\uD83D\uDD07'
  if (volume < 0.5) return '\uD83D\uDD09'
  return '\uD83D\uDD0A'
}

function savedSpeechRate(): HeroSpeechRate {
  const stored = Number(window.localStorage.getItem(HERO_SPEECH_RATE_STORAGE_KEY))
  return HERO_SPEECH_RATES.find((rate) => rate === stored) ?? 1
}

function savedSpeechVolume(): HeroSpeechVolume {
  const stored = Number(window.localStorage.getItem(HERO_SPEECH_VOLUME_STORAGE_KEY))
  return HERO_SPEECH_VOLUMES.find((volume) => volume === stored) ?? 1
}

const RotatingHeroSentence = lazy(() => import('./RotatingHeroSentence').then((module) => ({ default: module.RotatingHeroSentence })))

function ProgressRunnerVideo() {
  const loopStartSeconds = 3
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { willReadFrequently: true })
    if (!video || !canvas || !context) return
    const runnerCanvas = canvas
    const runnerContext = context

    const cachedFrames: HTMLCanvasElement[] = []
    let playbackIndex = 0
    let loopRestartIndex = 0
    let playbackTick = 0
    let captureComplete = false

    function keyBlackToAlpha(frame: ImageData) {
      const data = frame.data
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] ?? 0
        const g = data[i + 1] ?? 0
        const b = data[i + 2] ?? 0
        if (r < 34 && g < 34 && b < 38) {
          data[i + 3] = 0
        } else if (r < 64 && g < 64 && b < 70) {
          data[i + 3] = Math.round(((Math.max(r, g, b) - 34) / 30) * 255)
        }
      }
      return frame
    }

    function frameDifference(a: HTMLCanvasElement, b: HTMLCanvasElement) {
      const sampleSize = 20
      const sampleA = document.createElement('canvas')
      const sampleB = document.createElement('canvas')
      sampleA.width = sampleSize
      sampleA.height = sampleSize
      sampleB.width = sampleSize
      sampleB.height = sampleSize
      const ctxA = sampleA.getContext('2d')
      const ctxB = sampleB.getContext('2d')
      if (!ctxA || !ctxB) return Number.POSITIVE_INFINITY

      ctxA.drawImage(a, 0, 0, sampleSize, sampleSize)
      ctxB.drawImage(b, 0, 0, sampleSize, sampleSize)
      const dataA = ctxA.getImageData(0, 0, sampleSize, sampleSize).data
      const dataB = ctxB.getImageData(0, 0, sampleSize, sampleSize).data
      let diff = 0
      for (let i = 0; i < dataA.length; i += 4) {
        diff += Math.abs((dataA[i] ?? 0) - (dataB[i] ?? 0))
          + Math.abs((dataA[i + 1] ?? 0) - (dataB[i + 1] ?? 0))
          + Math.abs((dataA[i + 2] ?? 0) - (dataB[i + 2] ?? 0))
          + Math.abs((dataA[i + 3] ?? 0) - (dataB[i + 3] ?? 0))
      }
      return diff
    }

    function findBestRestartFrame() {
      const lastFrame = cachedFrames[cachedFrames.length - 1]
      if (!lastFrame || cachedFrames.length < 8) return 0

      let bestIndex = 0
      let bestScore = Number.POSITIVE_INFINITY
      const latestCandidate = Math.max(0, cachedFrames.length - 6)
      for (let i = 0; i < latestCandidate; i += 1) {
        const candidate = cachedFrames[i]
        if (!candidate) continue
        const score = frameDifference(lastFrame, candidate)
        if (score < bestScore) {
          bestScore = score
          bestIndex = i
        }
      }
      return bestIndex
    }

    function paintCachedFrame() {
      const frame = cachedFrames[playbackIndex]
      if (!frame) return

      runnerContext.clearRect(0, 0, runnerCanvas.width, runnerCanvas.height)
      runnerContext.drawImage(frame, 0, 0, runnerCanvas.width, runnerCanvas.height)

      playbackTick += 1
      playbackIndex += 1
      if (playbackIndex >= cachedFrames.length) playbackIndex = loopRestartIndex
    }

    function drawFrame() {
      if (!video || !canvas || !context) return

      if (captureComplete) {
        paintCachedFrame()
        animationRef.current = window.requestAnimationFrame(drawFrame)
        return
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const width = video.videoWidth || canvas.width
        const height = video.videoHeight || canvas.height
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }

        context.clearRect(0, 0, canvas.width, canvas.height)
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const frame = keyBlackToAlpha(context.getImageData(0, 0, canvas.width, canvas.height))
        context.putImageData(frame, 0, 0)

        const cachedFrame = document.createElement('canvas')
        cachedFrame.width = canvas.width
        cachedFrame.height = canvas.height
        cachedFrame.getContext('2d')?.putImageData(frame, 0, 0)
        cachedFrames.push(cachedFrame)

        if (video.duration && video.currentTime >= video.duration - 0.04) {
          video.pause()
          captureComplete = cachedFrames.length > 1
          loopRestartIndex = findBestRestartFrame()
          playbackIndex = loopRestartIndex
        }
      }

      animationRef.current = window.requestAnimationFrame(drawFrame)
    }

    const startAtLoopPoint = () => {
      if (video.duration > loopStartSeconds) video.currentTime = loopStartSeconds
      void video.play()
    }

    video.addEventListener('loadedmetadata', startAtLoopPoint)
    animationRef.current = window.requestAnimationFrame(drawFrame)

    return () => {
      video.removeEventListener('loadedmetadata', startAtLoopPoint)
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current)
    }
  }, [loopStartSeconds])

  return (
    <>
      <video ref={videoRef} src="/running-ninja.mp4" muted playsInline preload="auto" />
      <canvas ref={canvasRef} />
    </>
  )
}

function DashboardHeroSentence({
  wrongPool,
  progress,
  furiganaOn,
  englishOn,
  jlptLevel,
  storyId,
  storyLevel,
  storyRolloverId,
  onStoryRollover,
  paused,
  playbackRate,
  onRotate,
  rewindSignal,
  advanceSignal,
  onCanRewindChange,
  onSentenceChange,
}: {
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  furiganaOn: boolean
  englishOn: boolean
  jlptLevel: ReturnType<typeof heroJlptForComplexity>
  storyId: string | null
  storyLevel: JlptLevel
  storyRolloverId: string | null
  onStoryRollover: (storyId: string) => void
  paused: boolean
  playbackRate: HeroPlaybackRate
  onRotate?: () => void
  rewindSignal: number
  advanceSignal: number
  onCanRewindChange: (canRewind: boolean) => void
  onSentenceChange: (speechText: string) => void
}) {
  return (
    <Suspense
      fallback={(
        <div className="hero-sentence-block hero-database-block hero-sentence-loading" aria-hidden="true" />
      )}
    >
      <RotatingHeroSentence
        wrongPool={wrongPool}
        progress={progress}
        displayMode="sentence"
        furiganaOn={furiganaOn}
        englishOn={englishOn}
        delayedFurigana={false}
        jlptLevel={jlptLevel}
        storyId={storyId}
        storyLevel={storyLevel}
        storyRolloverId={storyRolloverId}
        onStoryRollover={onStoryRollover}
        paused={paused}
        playbackRate={playbackRate}
        onRotate={onRotate}
        rewindSignal={rewindSignal}
        advanceSignal={advanceSignal}
        onCanRewindChange={onCanRewindChange}
        onSentenceChange={onSentenceChange}
      />
    </Suspense>
  )
}

const HERO_ROTATIONS_PER_SPEED_BUMP = 150

function savedPlaybackRate(): HeroPlaybackRate {
  if (typeof window === 'undefined') return 1
  const stored = Number(window.localStorage.getItem(HERO_SPEED_STORAGE_KEY))
  return HERO_PLAYBACK_RATES.includes(stored as HeroPlaybackRate) ? stored as HeroPlaybackRate : 1
}

interface DashboardProps {
  learnedCount: number
  totalCards: number
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  onOpenQuests: () => void
  onOpenAchievements: () => void
  onOpenStudyTools: () => void
  onOpenAdditionalTools: () => void
  achievementMetrics: AchievementMetrics
  questProgress: QuestProgress
  favoriteSentenceCount: number
}

export function Dashboard({
  learnedCount,
  totalCards,
  onOpenQuests,
  onOpenAchievements,
  onOpenStudyTools,
  onOpenAdditionalTools,
  achievementMetrics,
  questProgress,
  favoriteSentenceCount,
  wrongPool,
  progress,
}: DashboardProps) {
  const [furiganaOn, setFuriganaOn] = useState(true)
  const [englishOn, setEnglishOn] = useState(true)
  const [complexity, setComplexity] = useState<GenerationComplexity>(1)
  const [storyMode, setStoryMode] = useState(false)
  const [storyId, setStoryId] = useState(HERO_STORY_DEFINITIONS[0]?.id ?? '')
  const [storyLevel, setStoryLevel] = useState<JlptLevel>(HERO_STORY_LEVELS[0] ?? 'N5')
  const [storyPlaybackMode, setStoryPlaybackMode] = useState<StoryPlaybackMode>('repeat')
  const [storyQuickSelectOpen, setStoryQuickSelectOpen] = useState(false)
  const storyQuickSelectRef = useRef<HTMLDivElement | null>(null)
  const storiesAtLevel = useMemo(() => getHeroStoriesForLevel(storyLevel), [storyLevel])
  const selectedStoryTitle = storiesAtLevel.find((story) => story.id === storyId)?.shortTitle ?? 'Guided reading'
  const storyRolloverId = useMemo(() => {
    if (!storyMode || storyPlaybackMode === 'repeat' || storiesAtLevel.length < 2) return storyId
    const alternatives = storiesAtLevel.filter((story) => story.id !== storyId)
    return alternatives[Math.floor(Math.random() * alternatives.length)]?.id ?? storyId
  }, [storyId, storyMode, storyPlaybackMode, storiesAtLevel])
  const [paused, setPaused] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<HeroPlaybackRate>(savedPlaybackRate)
  const [rewindSignal, setRewindSignal] = useState(0)
  const [advanceSignal, setAdvanceSignal] = useState(0)
  const [canRewindSentence, setCanRewindSentence] = useState(false)
  const [speechOn, setSpeechOn] = useState(() => window.localStorage.getItem(HERO_SPEECH_STORAGE_KEY) === 'true')
  const [speechSupported, setSpeechSupported] = useState(canSpeakJapanese)
  const [spokenSentence, setSpokenSentence] = useState('')
  const [speechRate, setSpeechRate] = useState<HeroSpeechRate>(savedSpeechRate)
  const [speechVolume, setSpeechVolume] = useState<HeroSpeechVolume>(savedSpeechVolume)
  const [settingsExpanded, setSettingsExpanded] = useState(
    () => window.localStorage.getItem(HERO_SETTINGS_EXPANDED_STORAGE_KEY) === 'true',
  )
  // Lets the speak-on-new-sentence effect read current settings without taking
  // them as dependencies, so slider changes do not restart active speech.
  const speechVolumeRef = useRef(speechVolume)
  speechVolumeRef.current = speechVolume
  const minimumSpeechRate = minimumSpeechRateForSentence(spokenSentence, playbackRate)
  const effectiveSpeechRate = Math.max(speechRate, minimumSpeechRate) as HeroSpeechRate
  const effectiveSpeechRateRef = useRef(effectiveSpeechRate)
  effectiveSpeechRateRef.current = effectiveSpeechRate
  const speechRateIsAutomatic = effectiveSpeechRate > speechRate

  const progressPct = totalCards > 0 ? Math.round((learnedCount / totalCards) * 100) : 0
  const achievements = buildAchievements({ learnedCards: learnedCount, favoriteSentences: favoriteSentenceCount, questProgress, metrics: achievementMetrics })
  const unlockedAchievements = achievements.filter((achievement) => achievement.progress >= achievement.target).length
  const furiganaActive = furiganaOn

  useEffect(() => {
    if (storiesAtLevel.some((story) => story.id === storyId)) return
    setStoryId(storiesAtLevel[0]?.id ?? '')
  }, [storiesAtLevel, storyId])

  useEffect(() => {
    if (!storyQuickSelectOpen) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!storyQuickSelectRef.current?.contains(event.target as Node)) {
        setStoryQuickSelectOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStoryQuickSelectOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [storyQuickSelectOpen])

  function toggleFurigana() {
    setFuriganaOn((on) => !on)
  }

  function toggleEnglish() {
    setEnglishOn((on) => !on)
  }

  function toggleSpeech() {
    setSpeechOn((on) => {
      const next = !on
      window.localStorage.setItem(HERO_SPEECH_STORAGE_KEY, String(next))
      // Turning it off should silence the sentence already being read, not just
      // stop the next one.
      if (!next) stopSpeaking()
      return next
    })
  }

  function changeSpeechRate(rate: HeroSpeechRate) {
    setSpeechRate(rate)
    window.localStorage.setItem(HERO_SPEECH_RATE_STORAGE_KEY, String(rate))
  }

  function changeSpeechVolume(volume: HeroSpeechVolume) {
    setSpeechVolume(volume)
    window.localStorage.setItem(HERO_SPEECH_VOLUME_STORAGE_KEY, String(volume))
  }

  function toggleSettingsExpanded() {
    setSettingsExpanded((expanded) => {
      const next = !expanded
      window.localStorage.setItem(HERO_SETTINGS_EXPANDED_STORAGE_KEY, String(next))
      return next
    })
  }

  // Voices arrive asynchronously, so a Japanese voice can appear after first
  // paint; this keeps the button from staying disabled when one exists.
  useEffect(() => watchSpeechSupport(setSpeechSupported), [])

  // Keep the physical voice slider in sync when sentence timing requires a
  // faster reading. Automatic safety bumps do not replace the saved preference.
  useEffect(() => {
    if (!speechRateIsAutomatic) return
    setSpeechRate(effectiveSpeechRate)
  }, [effectiveSpeechRate, speechRateIsAutomatic])

  // Rate and volume are read through refs so adjusting either setting does not
  // restart the sentence currently being spoken.
  useEffect(() => {
    if (!speechOn || !spokenSentence) return
    speakJapanese(spokenSentence, effectiveSpeechRateRef.current, speechVolumeRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechOn, spokenSentence])

  // Leaving the dashboard mid-sentence should not keep talking.
  useEffect(() => stopSpeaking, [])

  useEffect(() => {
    window.localStorage.setItem(HERO_SPEED_STORAGE_KEY, String(playbackRate))
  }, [playbackRate])

  const speedIndex = HERO_PLAYBACK_RATES.indexOf(playbackRate)
  const speechRateIndex = HERO_SPEECH_RATES.indexOf(speechRate)
  const speechVolumeIndex = HERO_SPEECH_VOLUMES.indexOf(speechVolume)

  const rotationCountRef = useRef(0)
  const handleRotate = useCallback(() => {
    rotationCountRef.current += 1
    if (rotationCountRef.current < HERO_ROTATIONS_PER_SPEED_BUMP) return
    rotationCountRef.current = 0
    setPlaybackRate((current) => {
      const currentIndex = HERO_PLAYBACK_RATES.indexOf(current)
      const nextRate = HERO_PLAYBACK_RATES[currentIndex + 1]
      return nextRate ?? current
    })
  }, [])

  return (
    <div className="dashboard">
      <div className="control-story-topbar">
        {storyMode && (
          <div className="control-story-quick-select" ref={storyQuickSelectRef}>
            <button
              type="button"
              className={`control-story-name-button${storyQuickSelectOpen ? ' is-open' : ''}`}
              onClick={() => setStoryQuickSelectOpen((open) => !open)}
              aria-label={`Choose story. Current story: ${selectedStoryTitle}`}
              aria-haspopup="menu"
              aria-expanded={storyQuickSelectOpen}
              aria-controls="story-quick-select-menu"
              title="Quick-select story"
            >
              <span className="control-story-name-mark" aria-hidden="true">&#29289;</span>
              <span className="control-story-name-text">{selectedStoryTitle}</span>
              <span className="control-story-name-chevron" aria-hidden="true">&#9662;</span>
            </button>
            {storyQuickSelectOpen && (
              <div
                className="control-story-quick-menu"
                id="story-quick-select-menu"
                role="menu"
                aria-label={`${storyLevel} stories`}
              >
                {storiesAtLevel.map((story) => (
                  <button
                    key={story.id}
                    type="button"
                    className={story.id === storyId ? 'is-active' : ''}
                    role="menuitemradio"
                    aria-checked={story.id === storyId}
                    onClick={() => {
                      setStoryId(story.id)
                      setStoryQuickSelectOpen(false)
                    }}
                  >
                    <span>{story.title}</span>
                    {story.id === storyId && <span aria-hidden="true">&#10003;</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className={`control-story-toggle control-story-top-toggle${storyMode ? ' is-active' : ''}`}
          onClick={() => setStoryMode((enabled) => {
            if (enabled) setStoryQuickSelectOpen(false)
            return !enabled
          })}
          role="switch"
          aria-checked={storyMode}
          aria-label={storyMode ? 'Return to normal sentences' : 'Enable Story mode'}
          title={storyMode ? 'Return to normal sentences' : 'Enable Story mode'}
        >
          <span className="control-toggle-track" aria-hidden="true"><span /></span>
          <span>Story</span>
        </button>
      </div>

      <header className="hero hero-compact">
        <h1>Kanji Quest</h1>
        <DashboardHeroSentence
          wrongPool={wrongPool}
          progress={progress}
          furiganaOn={furiganaOn}
          englishOn={englishOn}
          jlptLevel={heroJlptForComplexity(complexity)}
          storyId={storyMode ? storyId : null}
          storyLevel={storyLevel}
          storyRolloverId={storyMode ? storyRolloverId : null}
          onStoryRollover={setStoryId}
          paused={paused}
          playbackRate={playbackRate}
          onRotate={handleRotate}
          rewindSignal={rewindSignal}
          advanceSignal={advanceSignal}
          onCanRewindChange={setCanRewindSentence}
          onSentenceChange={setSpokenSentence}
        />
      </header>

      <section className="hero-controls" aria-label="Sentence controls">
        <div className="hero-controls-row hero-controls-primary">
          <div className="control-group control-group-primary-options" role="group" aria-label="Display options">
            <button
              type="button"
              className={`control-chip control-chip-compact${furiganaActive ? ' is-active' : ''}`}
              onClick={toggleFurigana}
              aria-pressed={furiganaActive}
              aria-label="Toggle furigana"
              title="Furigana"
            >
              &#12405;&#12426;
            </button>
            <button
              type="button"
              className={`control-chip control-chip-compact${englishOn ? ' is-active' : ''}`}
              onClick={toggleEnglish}
              aria-pressed={englishOn}
              aria-label="Toggle English translation"
              title="English"
            >
              EN
            </button>
          </div>

          <div className="control-transport" role="group" aria-label="Sentence navigation">
              <button
                type="button"
                className="control-icon-button control-nav-button"
                onClick={() => setRewindSignal((value) => value + 1)}
                disabled={!canRewindSentence}
                aria-label="Go back to previous sentence"
                title="Previous sentence"
              >
                <span className="control-nav-chevron" aria-hidden="true">&#8249;</span>
              </button>
              <button
                type="button"
                className={`control-play${paused ? ' is-paused' : ''}`}
                onClick={() => setPaused((value) => !value)}
                aria-pressed={paused}
              >
                <span className="control-play-icon" aria-hidden="true">{paused ? '\u25B6' : '\u275A\u275A'}</span>
                <span className="control-play-label">{paused ? 'Play' : 'Pause'}</span>
              </button>
              <button
                type="button"
                className="control-icon-button control-nav-button"
                onClick={() => setAdvanceSignal((value) => value + 1)}
                aria-label="Go to next sentence"
                title="Next sentence"
              >
                <span className="control-nav-chevron" aria-hidden="true">&#8250;</span>
              </button>
          </div>

          <div className="control-group control-group-audio" role="group" aria-label="Display and audio options">
            <div className="control-audio-buttons">
              <button
                type="button"
                className={`control-icon-button control-speaker-button${speechOn ? ' is-active' : ''}`}
                onClick={toggleSpeech}
                aria-pressed={speechOn}
                disabled={!speechSupported}
                aria-label={speechOn ? 'Stop reading sentences aloud' : 'Read each new sentence aloud'}
                title={speechSupported
                  ? (speechOn ? 'Stop reading sentences aloud' : 'Read each new sentence aloud')
                  : 'No Japanese voice is installed on this device'}
              >
                <span className="control-chip-jp" aria-hidden="true">{speechOn ? '\uD83D\uDD0A' : '\uD83D\uDD08'}</span>
              </button>
              <button
                type="button"
                className={`control-icon-button control-settings-button${settingsExpanded ? ' is-active' : ''}`}
                onClick={toggleSettingsExpanded}
                aria-expanded={settingsExpanded}
                aria-controls="hero-voice-settings hero-content-settings"
                aria-label={settingsExpanded ? 'Hide settings' : 'Show settings'}
                title={settingsExpanded ? 'Hide settings' : 'Show settings'}
              >
                <span aria-hidden="true">&#9881;</span>
              </button>
            </div>
          </div>
        </div>

        {settingsExpanded && (
          <div className="hero-settings-layout" id="hero-content-settings">
              <div className={`control-group control-group-levels${storyMode ? ' is-disabled' : ''}`} aria-disabled={storyMode}>
                <span className="control-group-label" id="hero-level-label">Sentence difficulty</span>
                <div className="control-segmented control-segmented-difficulty" role="group" aria-labelledby="hero-level-label">
                  {GENERATION_COMPLEXITIES.map((level) => (
                    <button
                      key={level}
                      type="button"
                      data-difficulty={level}
                      className={`control-segment${complexity === level ? ' is-active' : ''}`}
                      onClick={() => setComplexity(level)}
                      aria-pressed={complexity === level}
                      aria-label={`${COMPLEXITY_DISPLAY[level].level} ${complexityDetails[level].label}: ${complexityDetails[level].description}`}
                      title={complexityDetails[level].description}
                      disabled={storyMode}
                    >
                      <span className="control-level-code">{COMPLEXITY_DISPLAY[level].level}</span>
                      <span className="control-level-name">{COMPLEXITY_DISPLAY[level].name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`control-story-panel${storyMode ? ' is-active' : ''}`}>
                <div className="control-story-heading">
                  <span>
                    <b><span aria-hidden="true">&#29289;</span> Story mode</b>
                    {storyMode && <small>{selectedStoryTitle}</small>}
                  </span>
                  <div className="control-story-actions">
                    <button
                      type="button"
                      className={`control-story-toggle${storyMode ? ' is-active' : ''}`}
                      onClick={() => setStoryMode((enabled) => {
                        if (enabled) setStoryQuickSelectOpen(false)
                        return !enabled
                      })}
                      role="switch"
                      aria-checked={storyMode}
                      aria-label={storyMode ? 'Disable Story mode' : 'Enable Story mode'}
                    >
                      <span className="control-toggle-track" aria-hidden="true"><span /></span>
                      <span>{storyMode ? 'On' : 'Off'}</span>
                    </button>
                    <button
                      type="button"
                      className={`control-story-action${storyPlaybackMode === 'repeat' ? ' is-active' : ''}`}
                      onClick={() => setStoryPlaybackMode('repeat')}
                      aria-pressed={storyPlaybackMode === 'repeat'}
                      aria-label="Repeat selected story"
                      title="Repeat selected story"
                      disabled={!storyMode}
                    >
                      <span aria-hidden="true">&#8734;</span>
                    </button>
                    <button
                      type="button"
                      className={`control-story-action${storyPlaybackMode === 'shuffle' ? ' is-active' : ''}`}
                      onClick={() => setStoryPlaybackMode('shuffle')}
                      aria-pressed={storyPlaybackMode === 'shuffle'}
                      aria-label="Shuffle stories"
                      title="Shuffle stories"
                      disabled={!storyMode}
                    >
                      <span aria-hidden="true">&#10536;</span>
                    </button>
                  </div>
                </div>

                <div className={`control-story-options${storyMode ? '' : ' is-disabled'}`} aria-disabled={!storyMode}>
                    <div className="control-story-setting">
                      <span>Story difficulty</span>
                      <div className="control-segmented control-segmented-story" role="group" aria-label="Story difficulty">
                        {STORY_LEVEL_DISPLAY.map(({ level, name }) => {
                          const hasStories = getHeroStoriesForLevel(level).length > 0
                          return (
                            <button
                              key={level}
                              type="button"
                              data-story-level={level}
                              className={`control-segment${level === storyLevel ? ' is-active' : ''}${hasStories ? '' : ' is-unavailable'}`}
                              aria-pressed={level === storyLevel}
                              aria-label={`${level} ${name}${hasStories ? '' : ': coming soon'}`}
                              title={hasStories ? `${level} ${name}` : `${level} ${name} coming soon`}
                              onClick={() => {
                                setStoryLevel(level)
                                setStoryQuickSelectOpen(false)
                              }}
                              disabled={!storyMode || !hasStories}
                            >
                              <span className="control-level-code">{level}</span>
                              <span className="control-level-name">{name}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <label className="control-story-setting">
                      <span>Story</span>
                      <select
                        className="control-select"
                        value={storyId}
                        onChange={(event) => setStoryId(event.target.value)}
                        aria-label="Choose story"
                        disabled={!storyMode}
                      >
                        {storiesAtLevel.map((story) => (
                          <option key={story.id} value={story.id}>{story.shortTitle}</option>
                        ))}
                      </select>
                    </label>
                  </div>
              </div>

            <div className="voice-settings-panel" id="hero-voice-settings" aria-label="Playback settings">
                <label className="voice-setting">
                  <span>Sentence speed</span>
                  <input
                    type="range"
                    min="0"
                    max={HERO_PLAYBACK_RATES.length - 1}
                    step="1"
                    value={speedIndex}
                    onChange={(event) => setPlaybackRate(HERO_PLAYBACK_RATES[Number(event.target.value)]!)}
                  />
                  <output>{playbackRate}x</output>
                </label>
                {speechSupported && (
                  <>
                    <label className="voice-setting">
                      <span>Voice speed</span>
                      <input
                        type="range"
                        min="0"
                        max={HERO_SPEECH_RATES.length - 1}
                        step="1"
                        value={speechRateIndex}
                        onChange={(event) => changeSpeechRate(HERO_SPEECH_RATES[Number(event.target.value)]!)}
                      />
                      <output aria-label={`${effectiveSpeechRate} times speed`}>{effectiveSpeechRate}x</output>
                    </label>
                    <label className="voice-setting">
                      <span>{speechVolumeIcon(speechVolume)} Volume</span>
                      <input
                        type="range"
                        min="0"
                        max={HERO_SPEECH_VOLUMES.length - 1}
                        step="1"
                        value={speechVolumeIndex}
                        onChange={(event) => changeSpeechVolume(HERO_SPEECH_VOLUMES[Number(event.target.value)]!)}
                      />
                      <output>{Math.round(speechVolume * 100)}%</output>
                    </label>
                  </>
                )}
            </div>
          </div>
        )}
      </section>

      {false && (
        <section className="progress-section progress-compact">
          <div className="progress-header">
            <span>Progress</span>
            <span>{progressPct}%</span>
          </div>
          <div
            className="progress-bar progress-bar-quest"
            style={{ '--progress-pct': `${progressPct}%` } as CSSProperties}
          >
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            <span className="progress-samurai" aria-hidden="true">
              <ProgressRunnerVideo />
            </span>
            <span className="progress-fuji" aria-hidden="true">
              <span className="fuji-snow" />
            </span>
          </div>
        </section>
      )}

      <div className="dashboard-action-grid">
        <button type="button" className="dashboard-quest-button" onClick={onOpenQuests}>
          <span className="dashboard-quest-mark" aria-hidden="true">&#20365;</span>
          <span><small>STUDY PATH</small><b>Quests</b><em>Follow your guided story</em></span>
        </button>

        <button type="button" className="dashboard-tool-button study-tools-panel" onClick={onOpenStudyTools}>
          <span className="study-tools-mark" aria-hidden="true">&#25991;</span>
          <span className="five-minute-study-heading">
            <span className="study-tools-copy">
              <small>STUDY MODES</small>
              <b>Study tools</b>
              <em>Pick a focused drill</em>
            </span>
          </span>
        </button>

        <button type="button" className="dashboard-achievement-button" onClick={onOpenAchievements}>
          <span className="dashboard-achievement-mark" aria-hidden="true">&#35465;</span>
          <span><small>STUDY RECORD</small><b>Achievements</b><em>{unlockedAchievements} / {achievements.length} unlocked</em></span>
        </button>

        <button type="button" className="dashboard-tool-button dashboard-additional" onClick={onOpenAdditionalTools}>
          <span className="dashboard-additional-mark-main" aria-hidden="true">&#20182;</span>
          <span className="dashboard-additional-heading">
            <small>STUDY LIBRARY</small>
            <b>Additional</b>
            <em>Manage saved content</em>
          </span>
        </button>
      </div>
    </div>
  )
}
