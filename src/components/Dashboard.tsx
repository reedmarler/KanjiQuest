import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { CardProgress, JlptLevel } from '../lib/types'
import type { WrongPool } from '../lib/wrongPool'
import { isQuestComplete, type QuestProgress } from '../lib/questProgress'
import { QUESTS } from '../data/questCampaign'
import { GENERATION_COMPLEXITIES, heroJlptForComplexity, type GenerationComplexity } from '../lib/generationComplexity'
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
const HERO_SPEECH_RATE_STORAGE_KEY = 'kanji-quest-hero-speech-rate-v2'
const HERO_SPEECH_VOLUME_STORAGE_KEY = 'kanji-quest-hero-speech-volume-v1'
/** Voice speeds, slowest to fastest. Labeled 1x is 30% slower than the engine's natural pace. */
const HERO_SPEECH_RATES = [
  0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.25, 1.5, 1.75, 2, 2.5, 3,
] as const
type HeroSpeechRate = typeof HERO_SPEECH_RATES[number]
/** Maps a labeled voice slider step onto the speech engine rate. */
const HERO_SPEECH_RATE_SCALE = 0.7

// One full rest/highlight/swap cycle in RotatingHeroSentence at labeled 1x.
const HERO_SENTENCE_CYCLE_MS = 3214 + 2739 + 3929
const COMBINING_SMALL_KANA = new Set([
  'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゃ', 'ゅ', 'ょ', 'ゎ',
  'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ャ', 'ュ', 'ョ', 'ヮ',
])

function engineSpeechRate(labeledRate: HeroSpeechRate): number {
  return labeledRate * HERO_SPEECH_RATE_SCALE
}

function minimumSpeechRateForSentence(text: string, playbackRate: HeroPlaybackRate): HeroSpeechRate {
  const spokenCharacters = Array.from(text).filter((character) => /[\p{L}\p{N}ー]/u.test(character))
  const moraCount = spokenCharacters.reduce(
    (total, character) => total + (COMBINING_SMALL_KANA.has(character) ? 0 : 1),
    0,
  )
  const pauseCount = (text.match(/[、。！？,.!?]/g) ?? []).length
  // Roughly 5.25 mora per second at engine 1x, with room for voice startup and pauses.
  const estimatedReadingMs = 300 + (moraCount * 190) + (pauseCount * 220)
  const availableMs = HERO_SENTENCE_CYCLE_MS / playbackRate
  // Labeled rates are scaled down before they hit the engine, so the slider
  // step that clears the cycle is correspondingly higher.
  const requiredRate = estimatedReadingMs / (availableMs * HERO_SPEECH_RATE_SCALE)

  return HERO_SPEECH_RATES.find((rate) => rate >= requiredRate)
    ?? HERO_SPEECH_RATES[HERO_SPEECH_RATES.length - 1]
}

/** Voice volume steps, muted to full, in 10% increments. */
const HERO_SPEECH_VOLUMES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] as const
type HeroSpeechVolume = typeof HERO_SPEECH_VOLUMES[number]
type StoryPlaybackMode = 'repeat' | 'shuffle'
type HeroSettingsMode = 'none' | 'story' | 'grammar' | 'star'

// Particles has no focus yet: swapping は for を changes the grammatical role
// rather than the word, so the drill needs wrong-but-plausible forms that the
// generator deliberately never produces. The button stays visible and inert
// rather than silently doing nothing when pressed.
// What the top-right toggle says and switches off. It follows whichever mode
// is running rather than always offering Story, so there is one place to leave
// the mode you are actually in. With no mode active it offers Story, which is
// where it started.
const HERO_MODE_LABELS: Record<Exclude<HeroSettingsMode, 'none'>, string> = {
  story: 'Story',
  grammar: 'Grammar',
  star: 'Star',
}

const HERO_SWAP_FOCUS_OPTIONS: ReadonlyArray<{ focus: HeroSwapFocus | null; label: string }> = [
  { focus: 'verb', label: 'Verbs' },
  { focus: 'noun', label: 'Nouns' },
  { focus: null, label: 'Particles' },
  { focus: 'adjective', label: 'Adjectives' },
]

// Labelled by JLPT level, because that is what this picker now selects: the
// hero stream draws from patternsForLevel, not from the complexity tiers.
// The old labels described the complexity axis — L2 "Pairs" meant two
// interacting verbs — and after the switch L2 was showing single-verb and
// copula sentences, promising a structure it no longer delivered. Complexity
// still labels Content Studio and the testing view, which do select on it.
const COMPLEXITY_DISPLAY: Record<GenerationComplexity, { level: string; name: string; description: string }> = {
  1: { level: 'N5', name: 'Intro', description: 'Foundation grammar: basic particles, ～ます, adjective predicates.' },
  2: { level: 'N4', name: 'Elementary', description: 'Everyday grammar: ～たい, ～ている, ～てから, plain past.' },
  3: { level: 'N3', name: 'Intermediate', description: 'Connected grammar: conditionals, ～ようになる, quotation, comparison.' },
  4: { level: 'N2', name: 'Upper', description: 'Formal and written grammar: ～わけ, ～ざるを得ない, ～に違いない.' },
  5: { level: 'N1', name: 'Advanced', description: 'Advanced discourse: ～にほかならない, ～とは限らない, literary connectives.' },
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

import type { HeroSwapFocus } from '../lib/heroSequence'
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
  swapFocus,
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
  autoAdvance,
}: {
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  furiganaOn: boolean
  englishOn: boolean
  jlptLevel: ReturnType<typeof heroJlptForComplexity>
  swapFocus: HeroSwapFocus | null
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
  autoAdvance: boolean
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
        swapFocus={swapFocus}
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
        autoAdvance={autoAdvance}
      />
    </Suspense>
  )
}

const HERO_ROTATIONS_PER_SPEED_BUMP = 300

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
  questProgress: QuestProgress
}

export function Dashboard({
  learnedCount,
  totalCards,
  onOpenQuests,
  onOpenAchievements,
  onOpenStudyTools,
  onOpenAdditionalTools,
  questProgress,
  wrongPool,
  progress,
}: DashboardProps) {
  const [furiganaOn, setFuriganaOn] = useState(true)
  const [englishOn, setEnglishOn] = useState(true)
  const [complexity, setComplexity] = useState<GenerationComplexity>(1)
  const [settingsMode, setSettingsMode] = useState<HeroSettingsMode>('none')
  // Which part of speech the grammar drill rotates. Null keeps the ordinary
  // sweep, where every slot gets one turn.
  const [swapFocus, setSwapFocus] = useState<HeroSwapFocus | null>(null)
  const storyMode = settingsMode === 'story'
  const grammarMode = settingsMode === 'grammar'
  const [storyId, setStoryId] = useState(HERO_STORY_DEFINITIONS[0]?.id ?? '')
  const [storyLevel, setStoryLevel] = useState<JlptLevel>(HERO_STORY_LEVELS[0] ?? 'N5')
  const [storyPlaybackMode, setStoryPlaybackMode] = useState<StoryPlaybackMode>('repeat')
  const [storyQuickSelectOpen, setStoryQuickSelectOpen] = useState(false)
  const [focusQuickSelectOpen, setFocusQuickSelectOpen] = useState(false)
  const focusQuickSelectRef = useRef<HTMLDivElement | null>(null)
  const storyQuickSelectRef = useRef<HTMLDivElement | null>(null)
  const storiesAtLevel = useMemo(() => getHeroStoriesForLevel(storyLevel), [storyLevel])
  const selectedStoryTitle = storiesAtLevel.find((story) => story.id === storyId)?.shortTitle ?? 'Guided reading'
  // The top-right toggle follows the running mode so it can switch that mode
  // off; with none running it stays the Story entry point it has always been.
  const topToggleMode: Exclude<HeroSettingsMode, 'none'> = settingsMode === 'none' ? 'story' : settingsMode
  const activeFocusLabel = HERO_SWAP_FOCUS_OPTIONS.find((option) => option.focus === swapFocus)?.label ?? 'Choose focus'
  const storyRolloverId = useMemo(() => {
    if (!storyMode || storyPlaybackMode === 'repeat' || storiesAtLevel.length < 2) return storyId
    const alternatives = storiesAtLevel.filter((story) => story.id !== storyId)
    return alternatives[Math.floor(Math.random() * alternatives.length)]?.id ?? storyId
  }, [storyId, storyMode, storyPlaybackMode, storiesAtLevel])

  function selectSettingsMode(mode: Exclude<HeroSettingsMode, 'none'>) {
    setSettingsMode((current) => {
      const next = current === mode ? 'none' : mode
      if (next !== 'story') setStoryQuickSelectOpen(false)
      if (next !== 'grammar') setFocusQuickSelectOpen(false)
      return next
    })
  }
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
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  // Lets the speak-on-new-sentence effect read current settings without taking
  // them as dependencies, so slider changes do not restart active speech.
  const speechVolumeRef = useRef(speechVolume)
  speechVolumeRef.current = speechVolume
  // Read by the speech-end handler below so a beat that finishes reading
  // while paused doesn't force an advance the pause was meant to prevent.
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  // Story mode no longer rotates sentences on a fixed clock (see the
  // advanceSignal-on-speech-end effect below), so there is nothing for the
  // voice to race to finish before — it reads at the user's chosen rate.
  const minimumSpeechRate = storyMode ? speechRate : minimumSpeechRateForSentence(spokenSentence, playbackRate)
  const effectiveSpeechRate = Math.max(speechRate, minimumSpeechRate) as HeroSpeechRate
  const effectiveSpeechRateRef = useRef(effectiveSpeechRate)
  effectiveSpeechRateRef.current = effectiveSpeechRate
  const speechRateIsAutomatic = !storyMode && effectiveSpeechRate > speechRate

  // Surface where the player actually stands on the road rather than a
  // static tagline — the next guardian is the reason to tap through.
  const questsCleared = QUESTS.filter((quest) => isQuestComplete(questProgress, quest.id)).length
  const progressPct = totalCards > 0 ? Math.round((learnedCount / totalCards) * 100) : 0
  const furiganaActive = furiganaOn

  useEffect(() => {
    if (storiesAtLevel.some((story) => story.id === storyId)) return
    setStoryId(storiesAtLevel[0]?.id ?? '')
  }, [storiesAtLevel, storyId])

  useEffect(() => {
    if (!storyQuickSelectOpen && !focusQuickSelectOpen) return

    // One handler for both menus: whichever is open closes on an outside
    // pointer or Escape, and only one can be open at a time since the modes
    // are mutually exclusive.
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!storyQuickSelectRef.current?.contains(event.target as Node)) {
        setStoryQuickSelectOpen(false)
      }
      if (!focusQuickSelectRef.current?.contains(event.target as Node)) {
        setFocusQuickSelectOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setStoryQuickSelectOpen(false)
      setFocusQuickSelectOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [storyQuickSelectOpen, focusQuickSelectOpen])

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

  function resetSliders() {
    setPlaybackRate(1)
    changeSpeechRate(1)
    changeSpeechVolume(0.5)
  }

  function toggleSettingsExpanded() {
    setSettingsExpanded((expanded) => !expanded)
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
    // Story mode drives its own advance off this completion instead of the
    // rest/highlight/swap timer (autoAdvance={false} above), so the sentence
    // stays up exactly as long as the voice takes to read it. A beat that
    // finishes while paused should not force the story forward.
    const onEnd = storyMode
      ? () => { if (!pausedRef.current) setAdvanceSignal((value) => value + 1) }
      : undefined
    speakJapanese(spokenSentence, engineSpeechRate(effectiveSpeechRateRef.current), speechVolumeRef.current, onEnd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechOn, spokenSentence, storyMode])

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
        {grammarMode && (
          <div className="control-story-quick-select is-grammar" ref={focusQuickSelectRef}>
            <button
              type="button"
              className={`control-story-name-button${focusQuickSelectOpen ? ' is-open' : ''}`}
              onClick={() => setFocusQuickSelectOpen((open) => !open)}
              aria-label={`Choose grammar focus. Current focus: ${activeFocusLabel}`}
              aria-haspopup="menu"
              aria-expanded={focusQuickSelectOpen}
              aria-controls="focus-quick-select-menu"
              title="Quick-select grammar focus"
            >
              <span className="control-story-name-mark" aria-hidden="true">&#25991;</span>
              <span className="control-story-name-text">{activeFocusLabel}</span>
              <span className="control-story-name-chevron" aria-hidden="true">&#9662;</span>
            </button>
            {focusQuickSelectOpen && (
              <div
                className="control-story-quick-menu"
                id="focus-quick-select-menu"
                role="menu"
                aria-label="Grammar focus"
              >
                {HERO_SWAP_FOCUS_OPTIONS.map(({ focus, label }) => (
                  <button
                    key={label}
                    type="button"
                    className={focus && swapFocus === focus ? 'is-active' : ''}
                    role="menuitemradio"
                    aria-checked={focus ? swapFocus === focus : false}
                    disabled={!focus}
                    title={focus ? undefined : 'Particle swapping is not wired up yet'}
                    onClick={focus ? () => {
                      setSwapFocus((current) => (current === focus ? null : focus))
                      setFocusQuickSelectOpen(false)
                    } : undefined}
                  >
                    <span>{label}</span>
                    {focus && swapFocus === focus && <span aria-hidden="true">&#10003;</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className={`control-story-toggle control-story-top-toggle${settingsMode !== 'none' ? ' is-active' : ''}${grammarMode ? ' is-grammar' : ''}`}
          onClick={() => selectSettingsMode(topToggleMode)}
          role="switch"
          aria-checked={settingsMode !== 'none'}
          aria-label={settingsMode === 'none' ? 'Enable Story mode' : `Turn off ${HERO_MODE_LABELS[topToggleMode]} mode`}
          title={settingsMode === 'none' ? 'Enable Story mode' : `Turn off ${HERO_MODE_LABELS[topToggleMode]} mode`}
        >
          <span className="control-toggle-track" aria-hidden="true"><span /></span>
          <span>{HERO_MODE_LABELS[topToggleMode]}</span>
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
          swapFocus={grammarMode ? swapFocus : null}
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
          autoAdvance={!(storyMode && speechOn)}
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
                      aria-label={`${COMPLEXITY_DISPLAY[level].level} ${COMPLEXITY_DISPLAY[level].name}: ${COMPLEXITY_DISPLAY[level].description}`}
                      title={COMPLEXITY_DISPLAY[level].description}
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
                    <b>Mode</b>
                    {storyMode && <small>{selectedStoryTitle}</small>}
                  </span>
                  <div className="control-story-actions">
                    <div className="hero-mode-icons" role="group" aria-label="Sentence modes">
                      <button
                        type="button"
                        className={`hero-mode-icon${storyMode ? ' is-active' : ''}`}
                        onClick={() => selectSettingsMode('story')}
                        aria-pressed={storyMode}
                        aria-label="Story mode"
                        title="Story mode"
                      >
                        <span aria-hidden="true">&#29289;</span>
                      </button>
                      <button
                        type="button"
                        className={`hero-mode-icon${grammarMode ? ' is-active' : ''}`}
                        onClick={() => selectSettingsMode('grammar')}
                        aria-pressed={grammarMode}
                        aria-label="Grammar mode"
                        title="Grammar mode"
                      >
                        <span aria-hidden="true">&#25991;</span>
                      </button>
                      <button
                        type="button"
                        className={`hero-mode-icon${settingsMode === 'star' ? ' is-active' : ''}`}
                        onClick={() => selectSettingsMode('star')}
                        aria-pressed={settingsMode === 'star'}
                        aria-label="Star mode"
                        title="Star mode"
                      >
                        <span aria-hidden="true">&#9733;</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="hero-mode-panel-slot">
                  {storyMode && (
                    <div className="control-story-options">
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
                                disabled={!hasStories}
                              >
                                <span className="control-level-code">{level}</span>
                                <span className="control-level-name">{name}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="control-story-setting">
                        <span>Story</span>
                        <div className="control-story-picker">
                          <select
                            className="control-select"
                            value={storyId}
                            onChange={(event) => setStoryId(event.target.value)}
                            aria-label="Choose story"
                          >
                            {storiesAtLevel.map((story) => (
                              <option key={story.id} value={story.id}>{story.shortTitle}</option>
                            ))}
                          </select>
                          <div className="control-story-playback" role="group" aria-label="Story playback">
                            <button
                              type="button"
                              className={`control-story-action${storyPlaybackMode === 'repeat' ? ' is-active' : ''}`}
                              onClick={() => setStoryPlaybackMode('repeat')}
                              aria-pressed={storyPlaybackMode === 'repeat'}
                              aria-label="Repeat selected story"
                              title="Repeat selected story"
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
                            >
                              <span aria-hidden="true">&#10536;</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {grammarMode && (
                    <div className="hero-swap-mode-grid" role="group" aria-label="Grammar focus">
                      {HERO_SWAP_FOCUS_OPTIONS.map(({ focus, label }) => (
                        <button
                          key={label}
                          type="button"
                          className={`hero-swap-mode-panel${focus && swapFocus === focus ? ' is-active' : ''}`}
                          aria-pressed={focus ? swapFocus === focus : undefined}
                          // Selecting the focus already on screen turns the drill
                          // off, so the same button both enters and leaves it.
                          onClick={focus ? () => setSwapFocus((current) => (current === focus ? null : focus)) : undefined}
                          disabled={!focus}
                          title={focus ? undefined : 'Particle swapping is not wired up yet'}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {!storyMode && !grammarMode && (
                    <p className="hero-mode-panel-hint">Try a mode</p>
                  )}
                </div>
              </div>

            <div className="voice-settings-panel" id="hero-voice-settings" aria-label="Playback settings">
                <div className="voice-settings-header">
                  <span className="control-group-label">Playback</span>
                  <button
                    type="button"
                    className="voice-settings-reset"
                    onClick={resetSliders}
                    title="Reset sliders to 1x, 1x, 50%"
                  >
                    Reset
                  </button>
                </div>
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
        <div className="dashboard-action-primary">
          <button type="button" className="dashboard-quest-button" onClick={onOpenQuests}>
            <span className="dashboard-quest-mark" aria-hidden="true">&#20365;</span>
            <span className="dashboard-quest-copy">
              <b>Quests</b>
            </span>
            <span className="dashboard-quest-track" aria-hidden="true">
              <span style={{ width: `${(questsCleared / QUESTS.length) * 100}%` }} />
            </span>
          </button>

          <button type="button" className="dashboard-tool-button study-tools-panel" onClick={onOpenStudyTools}>
            <span className="study-tools-mark" aria-hidden="true">&#25991;</span>
            <span className="five-minute-study-heading">
              <span className="study-tools-copy">
                <b>Study tools</b>
              </span>
            </span>
          </button>
        </div>

        <div className="dashboard-action-secondary">
          <button type="button" className="dashboard-achievement-button" onClick={onOpenAchievements}>
            <span className="dashboard-achievement-mark" aria-hidden="true">&#35465;</span>
            <span>
              <b>Achievements</b>
            </span>
          </button>

          <button type="button" className="dashboard-additional" onClick={onOpenAdditionalTools}>
            <span className="dashboard-additional-mark-main" aria-hidden="true">&#20182;</span>
            <span className="dashboard-additional-heading">
              <b>Additional</b>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
