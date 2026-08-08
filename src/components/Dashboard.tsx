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
import { canSpeakJapanese, speakJapanese, stopSpeaking, watchSpeechSupport } from '../lib/speech'

const HERO_SPEECH_STORAGE_KEY = 'kanji-quest-hero-speech-v1'
const HERO_SPEECH_RATE_STORAGE_KEY = 'kanji-quest-hero-speech-rate-v1'
const HERO_SPEECH_VOLUME_STORAGE_KEY = 'kanji-quest-hero-speech-volume-v1'
/** Voice speeds, slowest to fastest. 1× is the engine's natural pace. */
const HERO_SPEECH_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const
type HeroSpeechRate = typeof HERO_SPEECH_RATES[number]

/** Volume levels the button cycles through, muted to full. */
const HERO_SPEECH_VOLUMES = [0, 0.5, 1] as const
type HeroSpeechVolume = typeof HERO_SPEECH_VOLUMES[number]
const HERO_SPEECH_VOLUME_ICONS: Record<HeroSpeechVolume, string> = { 0: '🔇', 0.5: '🔉', 1: '🔊' }

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
  paused,
  playbackRate,
  onRotate,
  rewindSignal,
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
  paused: boolean
  playbackRate: HeroPlaybackRate
  onRotate?: () => void
  rewindSignal: number
  onCanRewindChange: (canRewind: boolean) => void
  onSentenceChange: (japanese: string) => void
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
        paused={paused}
        playbackRate={playbackRate}
        onRotate={onRotate}
        rewindSignal={rewindSignal}
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
  onOpenSentencePractice: () => void
  onOpenGrammar: () => void
  onOpenVocabList: () => void
  onOpenVocabPractice: () => void
  onOpenKanji: () => void
  onOpenQuests: () => void
  onOpenAchievements: () => void
  achievementMetrics: AchievementMetrics
  questProgress: QuestProgress
  favoriteSentenceCount: number
  onOpenContentStudio: () => void
  onOpenWordCategories: () => void
  onOpenSentenceTesting: () => void
}

export function Dashboard({
  learnedCount,
  totalCards,
  onOpenSentencePractice,
  onOpenGrammar,
  onOpenVocabList,
  onOpenVocabPractice,
  onOpenKanji,
  onOpenQuests,
  onOpenAchievements,
  achievementMetrics,
  questProgress,
  favoriteSentenceCount,
  onOpenContentStudio,
  onOpenWordCategories,
  onOpenSentenceTesting,
  wrongPool,
  progress,
}: DashboardProps) {
  const [furiganaOn, setFuriganaOn] = useState(true)
  const [englishOn, setEnglishOn] = useState(true)
  const [complexity, setComplexity] = useState<GenerationComplexity>(1)
  const [storyMode, setStoryMode] = useState(false)
  const [storyId, setStoryId] = useState(HERO_STORY_DEFINITIONS[0]?.id ?? '')
  const [storyLevel, setStoryLevel] = useState<JlptLevel>(HERO_STORY_LEVELS[0] ?? 'N5')
  const storiesAtLevel = useMemo(() => getHeroStoriesForLevel(storyLevel), [storyLevel])
  const [paused, setPaused] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<HeroPlaybackRate>(savedPlaybackRate)
  const [additionalOpen, setAdditionalOpen] = useState(false)
  const [rewindSignal, setRewindSignal] = useState(0)
  const [canRewindSentence, setCanRewindSentence] = useState(false)
  const [speechOn, setSpeechOn] = useState(() => window.localStorage.getItem(HERO_SPEECH_STORAGE_KEY) === 'true')
  const [speechSupported, setSpeechSupported] = useState(canSpeakJapanese)
  const [spokenSentence, setSpokenSentence] = useState('')
  const [speechRate, setSpeechRate] = useState<HeroSpeechRate>(savedSpeechRate)
  const [speechVolume, setSpeechVolume] = useState<HeroSpeechVolume>(savedSpeechVolume)
  // Lets the speak-on-new-sentence effect read the current rate/volume without
  // taking them as a dependency (see that effect for why).
  const speechRateRef = useRef(speechRate)
  speechRateRef.current = speechRate
  const speechVolumeRef = useRef(speechVolume)
  speechVolumeRef.current = speechVolume

  const progressPct = totalCards > 0 ? Math.round((learnedCount / totalCards) * 100) : 0
  const achievements = buildAchievements({ learnedCards: learnedCount, favoriteSentences: favoriteSentenceCount, questProgress, metrics: achievementMetrics })
  const unlockedAchievements = achievements.filter((achievement) => achievement.progress >= achievement.target).length
  const furiganaActive = furiganaOn

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

  /**
   * A rate change re-speaks the current sentence rather than waiting for the
   * next one, so the new speed is audible while the user is still adjusting it.
   */
  function changeSpeechRate(rate: HeroSpeechRate) {
    setSpeechRate(rate)
    window.localStorage.setItem(HERO_SPEECH_RATE_STORAGE_KEY, String(rate))
    if (speechOn && spokenSentence) speakJapanese(spokenSentence, rate, speechVolumeRef.current)
  }

  /**
   * Cycles muted → half → full, replaying the current sentence at the new
   * volume so the change is audible immediately, same as the rate control.
   */
  function cycleSpeechVolume() {
    const currentIndex = HERO_SPEECH_VOLUMES.indexOf(speechVolume)
    const volume = HERO_SPEECH_VOLUMES[(currentIndex + 1) % HERO_SPEECH_VOLUMES.length]!
    setSpeechVolume(volume)
    window.localStorage.setItem(HERO_SPEECH_VOLUME_STORAGE_KEY, String(volume))
    if (speechOn && spokenSentence) speakJapanese(spokenSentence, speechRateRef.current, volume)
  }

  // Voices arrive asynchronously, so a Japanese voice can appear after first
  // paint — this keeps the button from staying disabled when one exists.
  useEffect(() => watchSpeechSupport(setSpeechSupported), [])

  // Deliberately not depending on speechRate: changeSpeechRate already replays
  // at the new speed, and re-running here would restart the sentence a second
  // time on every adjustment.
  useEffect(() => {
    if (!speechOn || !spokenSentence) return
    speakJapanese(spokenSentence, speechRateRef.current, speechVolumeRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechOn, spokenSentence])

  // Leaving the dashboard mid-sentence should not keep talking.
  useEffect(() => stopSpeaking, [])

  useEffect(() => {
    window.localStorage.setItem(HERO_SPEED_STORAGE_KEY, String(playbackRate))
  }, [playbackRate])

  const speedIndex = HERO_PLAYBACK_RATES.indexOf(playbackRate)
  const speechRateIndex = HERO_SPEECH_RATES.indexOf(speechRate)

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
          paused={paused}
          playbackRate={playbackRate}
          onRotate={handleRotate}
          rewindSignal={rewindSignal}
          onCanRewindChange={setCanRewindSentence}
          onSentenceChange={setSpokenSentence}
        />
      </header>

      <section className="hero-controls" aria-label="Sentence controls">
        <div className="hero-controls-row">
          <div className="control-group" role="group" aria-label="Playback">
            <button
              type="button"
              className="control-icon-button"
              onClick={() => setRewindSignal((value) => value + 1)}
              disabled={!canRewindSentence}
              aria-label="Go back to previous sentence"
              title="Previous sentence"
            >
              ←
            </button>
            <button
              type="button"
              className={`control-play${paused ? ' is-paused' : ''}`}
              onClick={() => setPaused((value) => !value)}
              aria-pressed={paused}
            >
              <span className="control-play-icon" aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
              {paused ? 'Play' : 'Pause'}
            </button>
            <div className="control-stepper" role="group" aria-label="Sentence speed">
              <button
                type="button"
                aria-label="Slow down sentence"
                disabled={speedIndex === 0}
                onClick={() => setPlaybackRate(HERO_PLAYBACK_RATES[speedIndex - 1]!)}
              >
                −
              </button>
              <button
                type="button"
                className="control-stepper-value"
                aria-label={`Sentence speed ${playbackRate} times, tap to reset`}
                onClick={() => setPlaybackRate(1)}
              >
                {playbackRate}×
              </button>
              <button
                type="button"
                aria-label="Speed up sentence"
                disabled={speedIndex === HERO_PLAYBACK_RATES.length - 1}
                onClick={() => setPlaybackRate(HERO_PLAYBACK_RATES[speedIndex + 1]!)}
              >
                +
              </button>
            </div>
          </div>

          <div className="control-group" role="group" aria-label="Display">
            <button
              type="button"
              className={`control-chip${furiganaActive ? ' is-active' : ''}`}
              onClick={toggleFurigana}
              aria-pressed={furiganaActive}
            >
              <span className="control-chip-jp" aria-hidden="true">ふり</span>
              Furigana
            </button>
            <button
              type="button"
              className={`control-chip${englishOn ? ' is-active' : ''}`}
              onClick={toggleEnglish}
              aria-pressed={englishOn}
            >
              <span className="control-chip-jp" aria-hidden="true">EN</span>
              English
            </button>
            <button
              type="button"
              className={`control-chip${speechOn ? ' is-active' : ''}`}
              onClick={toggleSpeech}
              aria-pressed={speechOn}
              disabled={!speechSupported}
              title={speechSupported
                ? (speechOn ? 'Stop reading sentences aloud' : 'Read each new sentence aloud')
                : 'No Japanese voice is installed on this device'}
            >
              <span className="control-chip-jp" aria-hidden="true">{speechOn ? '🔊' : '🔈'}</span>
              Speak
            </button>
            {speechSupported && (
              <button
                type="button"
                className="control-chip"
                onClick={cycleSpeechVolume}
                aria-label={`Voice volume ${Math.round(speechVolume * 100)}%, tap to change`}
                title="Cycle voice volume"
              >
                <span className="control-chip-jp" aria-hidden="true">{HERO_SPEECH_VOLUME_ICONS[speechVolume]}</span>
                Volume
              </button>
            )}
            {speechSupported && (
              // Stays visible while speech is off so the speed can be set
              // before turning it on, rather than appearing only afterwards.
              <div className="control-stepper" role="group" aria-label="Voice speed">
                <button
                  type="button"
                  aria-label="Slow down the voice"
                  disabled={speechRateIndex === 0}
                  onClick={() => changeSpeechRate(HERO_SPEECH_RATES[speechRateIndex - 1]!)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="control-stepper-value"
                  aria-label={`Voice speed ${speechRate} times, tap to reset`}
                  onClick={() => changeSpeechRate(1)}
                >
                  {speechRate}×
                </button>
                <button
                  type="button"
                  aria-label="Speed up the voice"
                  disabled={speechRateIndex === HERO_SPEECH_RATES.length - 1}
                  onClick={() => changeSpeechRate(HERO_SPEECH_RATES[speechRateIndex + 1]!)}
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="hero-controls-row">
          <div className="control-group control-group-levels">
            <span className="control-group-label" id="hero-level-label">Level</span>
            <div className="control-segmented control-segmented-difficulty" role="group" aria-labelledby="hero-level-label">
              {GENERATION_COMPLEXITIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  data-difficulty={level}
                  className={`control-segment${complexity === level ? ' is-active' : ''}`}
                  onClick={() => setComplexity(level)}
                  aria-pressed={complexity === level}
                  aria-label={`Generation complexity level ${level}: ${complexityDetails[level].description}`}
                  title={complexityDetails[level].description}
                >
                  <span className="control-segment-bars" aria-hidden="true">
                    {GENERATION_COMPLEXITIES.map((bar) => (
                      <span key={bar} className={`control-segment-bar${bar <= level ? ' is-filled' : ''}`} />
                    ))}
                  </span>
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className={`control-group control-group-story${storyMode ? ' is-active' : ''}`}>
            <button
              type="button"
              className={`control-chip control-chip-story${storyMode ? ' is-active' : ''}`}
              onClick={() => setStoryMode((enabled) => !enabled)}
              aria-pressed={storyMode}
            >
              <span className="control-chip-jp" aria-hidden="true">物</span>
              Story
            </button>
            {HERO_STORY_LEVELS.length > 1 && (
              <div className="control-segmented control-segmented-story" role="group" aria-label="Story level">
                {HERO_STORY_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`control-segment${level === storyLevel ? ' is-active' : ''}`}
                    aria-pressed={level === storyLevel}
                    onClick={() => setStoryLevel(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}
            <select
              className="control-select"
              value={storyId}
              onChange={(event) => {
                setStoryId(event.target.value)
                setStoryMode(true)
              }}
              aria-label="Choose story"
            >
              {storiesAtLevel.map((story) => (
                <option key={story.id} value={story.id}>{story.shortTitle}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

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

      <div className="dashboard-journey-actions">
        <button type="button" className="dashboard-quest-button" onClick={onOpenQuests}>
          <span className="dashboard-quest-mark" aria-hidden="true">侍</span>
          <span><small>GUIDED LEARNING</small><b>Quests</b><em>Continue the yōkai road →</em></span>
        </button>
        <button type="button" className="dashboard-achievement-button" onClick={onOpenAchievements}>
          <span className="dashboard-achievement-mark" aria-hidden="true">誉</span>
          <span><small>ACHIEVEMENTS</small><b>{unlockedAchievements} / {achievements.length}</b><em>View your legend →</em></span>
        </button>
      </div>

      <section className="five-minute-study" aria-labelledby="five-minute-study-title">
        <div className="five-minute-study-heading">
          <div>
            <h2 id="five-minute-study-title">5-minute study</h2>
          </div>
          <p>Choose one quick focused session.</p>
        </div>
        <div className="practice-grid">
          <button type="button" className="practice-card" onClick={onOpenSentencePractice}>
            <span className="practice-emoji">文</span>
            <span className="practice-label">Sentences</span>
          </button>
          <button type="button" className="practice-card practice-card-grammar" onClick={onOpenGrammar}>
            <span className="practice-emoji">文法</span>
            <span className="practice-label">Grammar</span>
          </button>
          <button
            type="button"
            className="practice-card practice-card-vocab-practice"
            onClick={onOpenVocabPractice}
          >
            <span className="practice-emoji">語彙</span>
            <span className="practice-label">Vocab</span>
          </button>
          <button type="button" className="practice-card practice-card-kanji" onClick={onOpenKanji}>
            <span className="practice-emoji">漢</span>
            <span className="practice-label">Kanji</span>
          </button>
        </div>
      </section>

      <section className="dashboard-additional" aria-labelledby="dashboard-additional-title">
        <button
          type="button"
          className="dashboard-additional-toggle"
          onClick={() => setAdditionalOpen((open) => !open)}
          aria-expanded={additionalOpen}
        >
          <div className="dashboard-additional-heading">
            <h2 id="dashboard-additional-title">Additional</h2>
            <p>Browse, save, and shape your study library.</p>
          </div>
          <span className={`dashboard-additional-chevron${additionalOpen ? ' is-open' : ''}`} aria-hidden="true">▾</span>
        </button>
        {additionalOpen && (
          <div className="dashboard-additional-actions">
            <button type="button" onClick={onOpenVocabList}>
              <span className="dashboard-additional-mark" aria-hidden="true">語</span>
              <span><b>Vocab List</b><small>Browse every word by level</small></span>
            </button>
            <button type="button" onClick={onOpenWordCategories}>
              <span className="dashboard-additional-mark" aria-hidden="true">動</span>
              <span><b>Word Categories</b><small>Browse verbs, adjectives, nouns, and more</small></span>
            </button>
            <button type="button" onClick={onOpenContentStudio}>
              <span className="dashboard-additional-mark" aria-hidden="true">編</span>
              <span><b>Content Studio</b><small>Add and organize your own content</small></span>
            </button>
            <button type="button" onClick={onOpenSentenceTesting}>
              <span className="dashboard-additional-mark" aria-hidden="true">験</span>
              <span><b>Sentence Testing</b><small>Generate 15 sentences by complexity level</small></span>
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
