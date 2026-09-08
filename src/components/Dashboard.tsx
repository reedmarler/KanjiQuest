import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { CardProgress, JlptLevel } from '../lib/types'
import type { WrongPool } from '../lib/wrongPool'
import { isQuestComplete, type QuestProgress } from '../lib/questProgress'
import { QUESTS } from '../data/questCampaign'
import { GENERATION_COMPLEXITIES, heroJlptForComplexity, type GenerationComplexity } from '../lib/generationComplexity'
import { HERO_STORY_DEFINITIONS, HERO_STORY_LEVELS, getHeroStoriesForLevel } from '../data/heroStories'
import {
  HERO_PLAYBACK_RATES,
  type HeroPlaybackRate,
} from '../lib/heroPlayback'
import {
  SPEECH_SPEEDS,
  canSpeakJapanese,
  speakJapanese,
  stopSpeaking,
  watchSpeechSupport,
} from '../lib/speech'
import { FavoriteWordsPanel } from './FavoriteWordsPanel'

const HERO_SPEECH_STORAGE_KEY = 'kanji-quest-hero-speech-v1'
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
type HeroSettingsMode = 'none' | 'picking' | 'story' | 'grammar' | 'star'

// What the top-right toggle says once a specific mode is running, and what it
// switches off. Off, and while a mode is still being picked, it just reads
// 'Mode' — the toggle is always on screen now, so it no longer defaults to
// Story the moment it is switched on.
const HERO_MODE_LABELS: Record<Exclude<HeroSettingsMode, 'none'>, string> = {
  picking: 'Mode',
  story: 'Story',
  grammar: 'Grammar',
  star: 'Star',
}

/*
 * Each of these holds the sentence still and works one part of speech, except
 * Particles: which particle a noun takes is decided by the predicate — 山に登る
 * but 高校で飲む — so swapping it inside a fixed sentence produces Japanese
 * that is simply wrong. That one contrasts across sentences instead, each step
 * reaching for a particle the last one did not use.
 */
const HERO_SWAP_FOCUS_OPTIONS: ReadonlyArray<{ focus: HeroSwapFocus | null; label: string; disabledReason?: string }> = [
  { focus: 'noun', label: 'Nouns' },
  { focus: 'particle', label: 'Particles' },
  { focus: 'verb', label: 'Verbs' },
  { focus: 'auxiliary', label: 'Auxiliary Verbs' },
  { focus: 'adjective', label: 'Adjectives' },
  { focus: 'adverb', label: 'Adverbs' },
]

const COMPLEXITY_DISPLAY: Record<GenerationComplexity, { level: string; name: string; description: string }> = {
  1: { level: 'L1', name: 'Intro', description: 'Foundation grammar: basic particles, ～ます, adjective predicates.' },
  2: { level: 'L2', name: 'Elementary', description: 'Everyday grammar: ～たい, ～ている, ～てから, plain past.' },
  3: { level: 'L3', name: 'Intermediate', description: 'Connected grammar: conditionals, ～ようになる, quotation, comparison.' },
  4: { level: 'L4', name: 'Upper', description: 'Formal and written grammar: ～わけ, ～ざるを得ない, ～に違いない.' },
  5: { level: 'L5', name: 'Advanced', description: 'Advanced discourse: ～にほかならない, ～とは限らない, literary connectives.' },
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

import { HERO_FOCUS_LEVELS, focusAvailableAt, type HeroSwapFocus } from '../lib/heroSequence'
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

interface DashboardProps {
  learnedCount: number
  totalCards: number
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  onOpenQuests: () => void
  onOpenStudyTools: () => void
  onOpenFavoriteWords: () => void
  onOpenAchievements: () => void
  onContinueStudy: () => void
  mobileContinueTitle: string
  mobileContinueDetail: string
  questProgress: QuestProgress
}

export function Dashboard({
  learnedCount,
  totalCards,
  onOpenQuests,
  onOpenStudyTools,
  onOpenFavoriteWords,
  onOpenAchievements,
  onContinueStudy,
  mobileContinueTitle,
  mobileContinueDetail,
  questProgress,
  wrongPool,
  progress,
}: DashboardProps) {
  const [furiganaOn, setFuriganaOn] = useState(true)
  const [englishOn, setEnglishOn] = useState(true)
  const [complexity, setComplexity] = useState<GenerationComplexity>(1)
  const [settingsMode, setSettingsMode] = useState<HeroSettingsMode>('none')
  const [modePickerOpen, setModePickerOpen] = useState(false)
  const [swapPickerOpen, setSwapPickerOpen] = useState(false)
  // Which part of speech the grammar drill rotates. Null keeps the ordinary
  // sweep, where every slot gets one turn.
  const [swapFocus, setSwapFocus] = useState<HeroSwapFocus | null>(null)
  const storyMode = settingsMode === 'story'
  const grammarMode = settingsMode === 'grammar'
  const [storyId, setStoryId] = useState(HERO_STORY_DEFINITIONS[0]?.id ?? '')
  const [storyLevel, setStoryLevel] = useState<JlptLevel>(HERO_STORY_LEVELS[0] ?? 'N5')
  const [storyPlaybackMode, setStoryPlaybackMode] = useState<StoryPlaybackMode>('repeat')
  const storiesAtLevel = useMemo(() => getHeroStoriesForLevel(storyLevel), [storyLevel])
  // The compact mode toggle is always visible. Off is 'none'; on with no
  // mode chosen yet is 'picking', which surfaces the mode choices below the
  // sentence controls rather than guessing which mode the learner wants.
  const modeToggleOn = settingsMode !== 'none'
  // Entering Grammar mode should start a drill, not leave the ordinary sweep
  // running under a Grammar label. Likewise, raising the complexity can take
  // the level out from under a chosen drill; fall back to the first focus the
  // new level can serve instead of silently dropping out of focused practice.
  useEffect(() => {
    const level = heroJlptForComplexity(complexity)
    setSwapFocus((current) => {
      if (current && focusAvailableAt(current, level)) return current
      if (!grammarMode) return current
      return HERO_SWAP_FOCUS_OPTIONS.find((option) => option.focus && focusAvailableAt(option.focus, level))?.focus ?? null
    })
  }, [complexity, grammarMode])

  /*
   * A focus with no pattern to run on at this level would build an empty
   * stream, and an empty stream is a blank hero — so it is closed off here
   * rather than offered and broken. `npm run audit:hero-focus` is what decides
   * which those are, and fails if this stops matching the generator.
   */
  const heroLevel = heroJlptForComplexity(complexity)
  const focusOptions = HERO_SWAP_FOCUS_OPTIONS.map((option) => {
    if (!option.focus) return option
    if (focusAvailableAt(option.focus, heroLevel)) return option
    const levels = HERO_FOCUS_LEVELS[option.focus].join(', ')
    return { ...option, focus: null, disabledReason: `${option.label} has no patterns at ${heroLevel} — this drill runs at ${levels}` }
  })
  const storyRolloverId = useMemo(() => {
    if (!storyMode || storyPlaybackMode === 'repeat' || storiesAtLevel.length < 2) return storyId
    const alternatives = storiesAtLevel.filter((story) => story.id !== storyId)
    return alternatives[Math.floor(Math.random() * alternatives.length)]?.id ?? storyId
  }, [storyId, storyMode, storyPlaybackMode, storiesAtLevel])

  function selectSettingsMode(mode: Exclude<HeroSettingsMode, 'none'>) {
    const next = settingsMode === mode ? 'none' : mode
    setSettingsMode(next)
    setModePickerOpen(next === 'picking')
    setSwapPickerOpen(next === 'grammar')
  }

  // The compact mode toggle only switches the drill on or off; it never picks
  // a specific mode itself, so turning it on waits for a choice from the mode
  // buttons it reveals below the sentence controls.
  function toggleModeOn() {
    const next = settingsMode === 'none' ? 'picking' : 'none'
    setSettingsMode(next)
    setModePickerOpen(next === 'picking')
    setSwapPickerOpen(false)
  }

  function toggleModePicker() {
    setModePickerOpen((current) => !current)
  }

  function toggleSwapPicker() {
    setSettingsMode('grammar')
    setModePickerOpen(false)
    setSwapPickerOpen((current) => !current || !grammarMode)
  }

  const [paused, setPaused] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<HeroPlaybackRate>(1)
  const [rewindSignal, setRewindSignal] = useState(0)
  const [advanceSignal, setAdvanceSignal] = useState(0)
  const [canRewindSentence, setCanRewindSentence] = useState(false)
  const [speechOn, setSpeechOn] = useState(() => window.localStorage.getItem(HERO_SPEECH_STORAGE_KEY) === 'true')
  const [speechSupported, setSpeechSupported] = useState(canSpeakJapanese)
  const [spokenSentence, setSpokenSentence] = useState('')
  const [speechRate, setSpeechRate] = useState<HeroSpeechRate>(1)
  const [speechVolume, setSpeechVolume] = useState<HeroSpeechVolume>(0.5)
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const importFileRef = useRef<HTMLInputElement | null>(null)
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
  const questPct = QUESTS.length > 0 ? Math.round((questsCleared / QUESTS.length) * 100) : 0
  const wrongCount = Object.keys(wrongPool).length
  const furiganaActive = furiganaOn
  const currentLevelLabel = COMPLEXITY_DISPLAY[complexity].level
  const dailyGoalPct = Math.min(100, Math.round((Math.min(learnedCount, 10) / 10) * 100))

  useEffect(() => {
    if (storiesAtLevel.some((story) => story.id === storyId)) return
    setStoryId(storiesAtLevel[0]?.id ?? '')
  }, [storiesAtLevel, storyId])

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
  }

  function changeSpeechVolume(volume: HeroSpeechVolume) {
    setSpeechVolume(volume)
  }

  function resetSliders() {
    setPlaybackRate(1)
    changeSpeechRate(1)
    changeSpeechVolume(0.5)
  }

  function toggleSettingsExpanded() {
    setSettingsExpanded((expanded) => !expanded)
  }

  function closeProfileMenu() {
    setProfileMenuOpen(false)
  }

  function openLearningSettings() {
    setSettingsExpanded(true)
    closeProfileMenu()
  }

  function openAchievements() {
    closeProfileMenu()
    onOpenAchievements()
  }

  function openStudyToolsFromMenu() {
    closeProfileMenu()
    onOpenStudyTools()
  }

  function openQuestsFromMenu() {
    closeProfileMenu()
    onOpenQuests()
  }

  function kanjiQuestStorageSnapshot() {
    const snapshot: Record<string, string> = {}
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key) continue
      if (!key.startsWith('kanji-quest') && !key.startsWith('kq-beginner')) continue
      const value = window.localStorage.getItem(key)
      if (value !== null) snapshot[key] = value
    }
    return snapshot
  }

  function exportProgress() {
    const payload = {
      app: 'Kanji Quest',
      version: '0.0.0',
      exportedAt: new Date().toISOString(),
      localStorage: kanjiQuestStorageSnapshot(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `kanji-quest-progress-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function requestImportProgress() {
    importFileRef.current?.click()
  }

  async function importProgress(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    const parsed: unknown = JSON.parse(text)
    if (
      !parsed
      || typeof parsed !== 'object'
      || !('localStorage' in parsed)
      || !parsed.localStorage
      || typeof parsed.localStorage !== 'object'
    ) {
      window.alert('That file does not look like a Kanji Quest progress export.')
      return
    }
    const entries = Object.entries(parsed.localStorage as Record<string, unknown>)
      .filter(([key, value]) => (key.startsWith('kanji-quest') || key.startsWith('kq-beginner')) && typeof value === 'string')
    if (entries.length === 0) {
      window.alert('No Kanji Quest progress data was found in that file.')
      return
    }
    const confirmed = window.confirm(`Import ${entries.length} saved Kanji Quest entries and reload the app?`)
    if (!confirmed) return
    entries.forEach(([key, value]) => window.localStorage.setItem(key, value as string))
    window.location.reload()
  }

  function resetLocalProgress() {
    const confirmed = window.confirm('Reset all local Kanji Quest progress on this device? This cannot be undone unless you exported a backup.')
    if (!confirmed) return
    Object.keys(kanjiQuestStorageSnapshot()).forEach((key) => window.localStorage.removeItem(key))
    window.location.reload()
  }

  useEffect(() => {
    if (!profileMenuOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeProfileMenu()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [profileMenuOpen])

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
    speakJapanese(spokenSentence, {
      rate: engineSpeechRate(effectiveSpeechRateRef.current),
      // Always render at natural speed and let the audio element handle the
      // slider. Otherwise each of the 13 steps is a separate render of the
      // same sentence, and none of them matches a pre-recorded clip — so a
      // sentence would be bought again every time the slider moved.
      synthesisRate: SPEECH_SPEEDS.natural,
      volume: speechVolumeRef.current,
      onEnd,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechOn, spokenSentence, storyMode])

  // Leaving the dashboard mid-sentence should not keep talking.
  useEffect(() => stopSpeaking, [])

  const speedIndex = HERO_PLAYBACK_RATES.indexOf(playbackRate)
  const speechRateIndex = HERO_SPEECH_RATES.indexOf(speechRate)
  const speechVolumeIndex = HERO_SPEECH_VOLUMES.indexOf(speechVolume)

  return (
    <div className="dashboard">
      <button
        type="button"
        className={`dashboard-profile-placeholder${profileMenuOpen ? ' is-active' : ''}`}
        onClick={() => setProfileMenuOpen(true)}
        aria-label="Open user menu"
        aria-expanded={profileMenuOpen}
        aria-controls="dashboard-profile-menu"
        title="User menu"
      >
        <span aria-hidden="true">U</span>
      </button>
      {profileMenuOpen && (
        <div className="dashboard-profile-layer">
          <button
            type="button"
            className="dashboard-profile-scrim"
            aria-label="Close user menu"
            onClick={closeProfileMenu}
          />
          <aside className="dashboard-profile-menu" id="dashboard-profile-menu" aria-label="User menu">
            <header className="dashboard-profile-header">
              <span className="dashboard-profile-avatar" aria-hidden="true">R</span>
              <div>
                <small>Local profile</small>
                <h2>Reed</h2>
                <p>{learnedCount} learned · {questsCleared}/{QUESTS.length} quests</p>
              </div>
              <button type="button" className="dashboard-profile-close" onClick={closeProfileMenu} aria-label="Close user menu">
                <span aria-hidden="true">&times;</span>
              </button>
            </header>

            <div className="dashboard-profile-today">
              <span>
                <small>Daily goal</small>
                <b>{Math.min(learnedCount, 10)}/10</b>
              </span>
              <i style={{ '--progress-pct': `${dailyGoalPct}%` } as CSSProperties} />
            </div>

            <section className="dashboard-profile-section" aria-label="Profile shortcuts">
              <button type="button" onClick={openLearningSettings}>
                <span>Profile</span>
                <small>Local account and display settings</small>
              </button>
              <button type="button" onClick={openLearningSettings}>
                <span>Learning settings</span>
                <small>{currentLevelLabel} · Furigana {furiganaOn ? 'on' : 'off'} · English {englishOn ? 'on' : 'off'}</small>
              </button>
              <button type="button" onClick={openStudyToolsFromMenu}>
                <span>Daily goal</span>
                <small>10 cards · {dailyGoalPct}% today</small>
              </button>
              <button type="button" onClick={openQuestsFromMenu}>
                <span>Progress history</span>
                <small>{progressPct}% cards · {questPct}% quest path</small>
              </button>
              <button type="button" onClick={openAchievements}>
                <span>Achievements</span>
                <small>Milestones and records</small>
              </button>
            </section>

            <section className="dashboard-profile-section dashboard-profile-preferences" aria-label="Study preferences">
              <span className="dashboard-profile-section-label">Study preferences</span>
              <button type="button" onClick={openLearningSettings}>
                <span>Sentence difficulty</span>
                <small>{currentLevelLabel} {COMPLEXITY_DISPLAY[complexity].name}</small>
              </button>
              <button type="button" onClick={toggleFurigana}>
                <span>Furigana default</span>
                <small>{furiganaOn ? 'On' : 'Off'}</small>
              </button>
              <button type="button" onClick={toggleEnglish}>
                <span>English default</span>
                <small>{englishOn ? 'On' : 'Off'}</small>
              </button>
              <button type="button" onClick={toggleSpeech} disabled={!speechSupported}>
                <span>Voice settings</span>
                <small>{speechSupported ? `${speechOn ? 'On' : 'Off'} · ${effectiveSpeechRate}x · ${Math.round(speechVolume * 100)}%` : 'No Japanese voice installed'}</small>
              </button>
            </section>

            <section className="dashboard-profile-section dashboard-profile-data" aria-label="Data and account">
              <span className="dashboard-profile-section-label">Data and account</span>
              <button type="button" onClick={exportProgress}>
                <span>Export progress</span>
                <small>Download a local backup</small>
              </button>
              <button type="button" onClick={requestImportProgress}>
                <span>Import progress</span>
                <small>Restore from a backup file</small>
              </button>
              <button type="button" disabled>
                <span>Sign in / sync</span>
                <small>Local-only for now</small>
              </button>
              <button type="button" className="is-danger" onClick={resetLocalProgress}>
                <span>Reset local progress</span>
                <small>Clear this device</small>
              </button>
            </section>

            <footer className="dashboard-profile-footer">
              <span>Kanji Quest v0.0.0</span>
              <a href="mailto:feedback@kanji.quest">Feedback</a>
              <span>About Kanji Quest</span>
            </footer>

            <input
              ref={importFileRef}
              className="dashboard-profile-file"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                void importProgress(event.currentTarget.files?.[0])
                event.currentTarget.value = ''
              }}
            />
          </aside>
        </div>
      )}
      <button
        type="button"
        className={`dashboard-page-settings control-icon-button control-settings-button${settingsExpanded ? ' is-active' : ''}`}
        onClick={toggleSettingsExpanded}
        aria-expanded={settingsExpanded}
        aria-controls="hero-voice-settings hero-content-settings"
        aria-label={settingsExpanded ? 'Hide settings' : 'Show settings'}
        title={settingsExpanded ? 'Hide settings' : 'Show settings'}
      >
        <span aria-hidden="true">&#9881;</span>
      </button>
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
              className={`control-chip control-chip-compact app-display-toggle${furiganaActive ? ' is-active' : ''}`}
              onClick={toggleFurigana}
              aria-pressed={furiganaActive}
              aria-label="Toggle furigana"
              title="Furigana"
            >
              &#12405;&#12426;
            </button>
            <button
              type="button"
              className={`control-chip control-chip-compact app-display-toggle${englishOn ? ' is-active' : ''}`}
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
                className={`control-chip control-chip-compact app-display-toggle hero-mode-control-toggle${modeToggleOn ? ' is-active' : ''}${grammarMode ? ' is-grammar' : ''}`}
                onClick={toggleModeOn}
                role="switch"
                aria-checked={modeToggleOn}
                aria-label={modeToggleOn ? `Turn off ${HERO_MODE_LABELS[settingsMode as Exclude<HeroSettingsMode, 'none'>]} mode` : 'Turn on a sentence mode'}
                title={modeToggleOn ? `Turn off ${HERO_MODE_LABELS[settingsMode as Exclude<HeroSettingsMode, 'none'>]} mode` : 'Turn on a sentence mode'}
              >
                {modeToggleOn ? HERO_MODE_LABELS[settingsMode as Exclude<HeroSettingsMode, 'none'>] : 'Mode'}
              </button>
            </div>
          </div>
        </div>

        {modeToggleOn && (
          <div className={`control-story-panel hero-mode-controls-panel${modeToggleOn ? ' is-active' : ''}`}>
            <div className="control-story-heading">
              <span>
                <b>Mode</b>
                {settingsMode !== 'picking' && (
                  <small>{HERO_MODE_LABELS[settingsMode as Exclude<HeroSettingsMode, 'none'>]}</small>
                )}
              </span>
            </div>

            <div className="hero-mode-panel-slot">
              <div className="hero-mode-menu-actions">
                <button
                  type="button"
                  className={`hero-mode-menu-button${modePickerOpen ? ' is-active' : ''}`}
                  onClick={toggleModePicker}
                  aria-expanded={modePickerOpen}
                >
                  Pick a mode
                </button>
                <button
                  type="button"
                  className={`hero-mode-menu-button${grammarMode && swapPickerOpen ? ' is-active' : ''}`}
                  onClick={toggleSwapPicker}
                  aria-expanded={grammarMode && swapPickerOpen}
                >
                  Swap
                </button>
              </div>

              {modePickerOpen && (
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
              )}

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
                            onClick={() => setStoryLevel(level)}
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

              {grammarMode && swapPickerOpen && (
                <div className="hero-swap-mode-grid" role="group" aria-label="Grammar focus">
                  {focusOptions.map(({ focus, label, disabledReason }) => (
                    <button
                      key={label}
                      type="button"
                      className={`hero-swap-mode-panel${focus && swapFocus === focus ? ' is-active' : ''}`}
                      aria-pressed={focus ? swapFocus === focus : undefined}
                      onClick={focus ? () => setSwapFocus((current) => (current === focus ? null : focus)) : undefined}
                      disabled={!focus}
                      title={focus ? undefined : disabledReason}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {settingsMode === 'star' && (
                <FavoriteWordsPanel onManage={onOpenFavoriteWords} />
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

      <section className="dashboard-next-panel" aria-label="Study progress">
        <button type="button" className="dashboard-next-card" onClick={onContinueStudy}>
          <span className="dashboard-next-mark" aria-hidden="true" lang="ja">続</span>
          <span className="dashboard-next-copy">
            <small>Next up</small>
            <b>{mobileContinueTitle}</b>
            <em>{mobileContinueDetail}</em>
          </span>
          <span className="dashboard-next-arrow" aria-hidden="true">&#8250;</span>
        </button>

        <div className="dashboard-progress-track" aria-label="Current progress">
          <div className="dashboard-progress-stat" style={{ '--progress-pct': `${progressPct}%` } as CSSProperties}>
            <span>
              <b>{progressPct}%</b>
              <small>Cards</small>
            </span>
            <i />
          </div>
          <div className="dashboard-progress-stat" style={{ '--progress-pct': `${questPct}%` } as CSSProperties}>
            <span>
              <b>{questsCleared}/{QUESTS.length}</b>
              <small>Quests</small>
            </span>
            <i />
          </div>
          <div className="dashboard-progress-stat" style={{ '--progress-pct': `${wrongCount > 0 ? 100 : 0}%` } as CSSProperties}>
            <span>
              <b>{wrongCount}</b>
              <small>Review</small>
            </span>
            <i />
          </div>
        </div>

        <div className="dashboard-next-actions">
          <button type="button" onClick={onOpenStudyTools}>Study</button>
          <button type="button" onClick={onOpenQuests}>Quest</button>
        </div>
      </section>
    </div>
  )
}
