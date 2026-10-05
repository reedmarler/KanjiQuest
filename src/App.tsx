import { Children, cloneElement, isValidElement, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Gauge, Pause, Play, RotateCcw, Volume2 } from 'lucide-react'
import { CARD_TOTAL } from './data/cardStats'
import { GENERATION_COMPLEXITIES } from './lib/generationComplexity'
import { isLearned } from './lib/srs'
import { loadProgress, recordReview } from './lib/storage'
import { useSwipeNav } from './lib/useSwipeNav'
import { completeQuest, completeQuestStep, loadQuestProgress, type QuestStep } from './lib/questProgress'
import { loadAchievementMetrics, recordQuestScene } from './lib/achievementProgress'
import { getQuestById } from './data/questCampaign'
import {
  favoriteFromExercise,
  favoriteFromDrillExercise,
  isDrillExerciseFavorite,
  isExerciseFavorite,
  loadFavoriteSentences,
  saveFavoriteSentences,
  type FavoriteSentence,
} from './lib/favoriteSentences'
import {
  loadWrongPool,
  recordCorrect,
  recordWrong,
  saveWrongPool,
} from './lib/wrongPool'
import type { CardProgress } from './lib/types'
import type { GenerationComplexity } from './lib/generationComplexity'
import type { SentenceExercise } from './data/sentenceExercises'
import type { DrillExercise } from './lib/drillExercises'
import { Dashboard, HERO_SPEECH_STORAGE_KEY } from './components/Dashboard'
import { AppHeaderControls } from './components/AppHeaderControls'
import { UserProfileMenu } from './components/UserProfileMenu'
import type { DailyGoalId } from './lib/dailyGoals'
import { DEFAULT_PROFILE_PHOTO, displayProfilePhoto, useUserProfile } from './lib/userProfile'
import { speakJapanese, stopSpeaking } from './lib/speech'
import {
  APP_ENGLISH_DEFAULT_KEY,
  APP_FURIGANA_DEFAULT_KEY,
  loadBooleanPreference,
  saveBooleanPreference,
} from './lib/displayPreferences'
import { SessionComplete } from './components/SessionComplete'
import type { LibraryTab } from './components/LibraryPanel'
import { getBeginnerDeck, type BeginnerScript } from './data/beginnerMnemonics'
import './App.css'

const ContentStudio = lazy(() => import('./components/ContentStudio').then((module) => ({ default: module.ContentStudio })))
const GrammarPractice = lazy(() => import('./components/GrammarPractice').then((module) => ({ default: module.GrammarPractice })))
const KanjiLab = lazy(() => import('./components/KanjiLab').then((module) => ({ default: module.KanjiLab })))
const LibraryPanel = lazy(() => import('./components/LibraryPanel').then((module) => ({ default: module.LibraryPanel })))
const SentenceBuilderView = lazy(() => import('./components/SentenceBuilderView').then((module) => ({ default: module.SentenceBuilderView })))
const SentenceTesting = lazy(() => import('./components/SentenceTesting').then((module) => ({ default: module.SentenceTesting })))
const VoiceTest = lazy(() => import('./components/VoiceTest').then((module) => ({ default: module.VoiceTest })))
const FocusedVocabPractice = lazy(() => import('./components/FocusedVocabPractice').then((module) => ({ default: module.FocusedVocabPractice })))
const CounterPractice = lazy(() => import('./components/CounterPractice').then((module) => ({ default: module.CounterPractice })))
const HomePage = lazy(() => import('./components/HomePage').then((module) => ({ default: module.HomePage })))
const MapView = lazy(() => import('./components/MapView').then((module) => ({ default: module.MapView })))
const ShrineTrial = lazy(() => import('./components/ShrineTrial').then((module) => ({ default: module.ShrineTrial })))
const QuestScene = lazy(() => import('./components/QuestScene').then((module) => ({ default: module.QuestScene })))
const QuestCheckpoint = lazy(() => import('./components/QuestCheckpoint').then((module) => ({ default: module.QuestCheckpoint })))
const FavoriteWordsPage = lazy(() => import('./components/FavoriteWordsPage').then((module) => ({ default: module.FavoriteWordsPage })))
const AchievementsPanel = lazy(() => import('./components/AchievementsPanel').then((module) => ({ default: module.AchievementsPanel })))
const BeginnerLearner = lazy(() => import('./components/BeginnerLearner').then((module) => ({ default: module.BeginnerLearner })))
const KanaChart = lazy(() => import('./components/KanaChart').then((module) => ({ default: module.KanaChart })))
const BeginnerSpeedRun = lazy(() => import('./components/BeginnerSpeedRun').then((module) => ({ default: module.BeginnerSpeedRun })))
const PicturePractice = lazy(() => import('./components/PicturePractice').then((module) => ({ default: module.PicturePractice })))
const ProfilePage = lazy(() => import('./components/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const SettingsPage = lazy(() => import('./components/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const DailyGoalsPage = lazy(() => import('./components/DailyGoalsPage').then((module) => ({ default: module.DailyGoalsPage })))
const BackupSyncPage = lazy(() => import('./components/BackupSyncPage').then((module) => ({ default: module.BackupSyncPage })))

/*
 * Copies of two tools, kept in Additional so they can be modernised before
 * anything changes in the versions people study with. Same markup and class
 * names to start with, no shared code, so a rewrite in the lab cannot reach
 * the live screen.
 */
const SentenceBuilderLab = lazy(() => import('./components/labs/SentenceBuilderLab').then((module) => ({ default: module.SentenceBuilderLab })))
const GrammarPracticeLab = lazy(() => import('./components/labs/GrammarPracticeLab').then((module) => ({ default: module.GrammarPracticeLab })))

type View =
  | 'dashboard'
  | 'library'
  | 'vocab-practice'
  | 'counter-practice'
  | 'study'
  | 'study-loading'
  | 'complete'
  | 'content-studio'
  | 'grammar'
  | 'kanji'
  | 'sentence-testing'
  | 'voice-test'
  | 'home'
  | 'ink-road'
  | 'shrine-trial'
  | 'quest-scene'
  | 'quest-checkpoint'
  | 'achievements'
  | 'study-tools'
  | 'additional-tools'
  | 'intro'
  | 'favorite-words'
  | 'beginner-zone'
  | 'hiragana-chart'
  | 'katakana-chart'
  | 'hiragana-quiz'
  | 'katakana-quiz'
  | 'beginner-learner'
  | 'beginner-speed-run'
  | 'picture-practice'
  | 'grammar-lab'
  | 'profile'
  | 'settings'
  | 'daily-goals'
  | 'backup-sync'

type PrimaryNavTab = 'hero' | 'home' | 'study' | 'beginner' | 'intro'

/** The five primary tabs, in bottom-nav order, for left/right swipe navigation. */
const HUB_TABS: readonly View[] = ['dashboard', 'home', 'study-tools', 'beginner-zone', 'intro']

function primaryNavTabForView(view: View): PrimaryNavTab | null {
  if (view === 'dashboard' || view === 'profile' || view === 'settings' || view === 'daily-goals' || view === 'backup-sync') return 'hero'
  if (view === 'home' || view === 'ink-road' || view === 'shrine-trial' || view === 'quest-scene' || view === 'quest-checkpoint') return 'home'
  if (view === 'study-tools' || view === 'kanji' || view === 'vocab-practice' || view === 'counter-practice' || view === 'grammar' || view === 'study' || view === 'study-loading' || view === 'complete') return 'study'
  if (view === 'beginner-zone' || view === 'hiragana-chart' || view === 'katakana-chart' || view === 'hiragana-quiz' || view === 'katakana-quiz' || view === 'beginner-learner' || view === 'beginner-speed-run' || view === 'picture-practice') return 'beginner'
  if (view === 'intro') return 'intro'
  return null
}

function MobileBottomNav({
  currentView,
  onHero,
  onHome,
  onStudy,
  onBeginner,
  onIntro,
}: {
  currentView: View
  onHero: () => void
  onHome: () => void
  onStudy: () => void
  onBeginner: () => void
  onIntro: () => void
}) {
  const activeTab = primaryNavTabForView(currentView)
  const items: Array<{ tab: PrimaryNavTab; label: string; mark: string; onClick: () => void }> = [
    { tab: 'hero', label: 'Hero', mark: '英', onClick: onHero },
    { tab: 'home', label: 'Home', mark: '家', onClick: onHome },
    { tab: 'study', label: 'Study', mark: '学', onClick: onStudy },
    { tab: 'beginner', label: 'Beginner', mark: 'あ', onClick: onBeginner },
    { tab: 'intro', label: 'Intro', mark: '入', onClick: onIntro },
  ]

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary">
      {items.map((item) => (
        <button
          key={item.tab}
          type="button"
          className={activeTab === item.tab ? 'is-active' : ''}
          onClick={item.onClick}
          aria-current={activeTab === item.tab ? 'page' : undefined}
        >
          <span aria-hidden="true" lang="ja">{item.mark}</span>
          <b>{item.label}</b>
        </button>
      ))}
    </nav>
  )
}

type BeginnerZoneProps = {
  initialScript: Extract<BeginnerScript, 'hiragana' | 'katakana'>
  intro?: boolean
  onOpenIntroScript?: (script: Extract<BeginnerScript, 'hiragana' | 'katakana'>) => void
  onOpenChart?: (script: Extract<BeginnerScript, 'hiragana' | 'katakana'>) => void
  onOpenQuiz?: (script: Extract<BeginnerScript, 'hiragana' | 'katakana'>) => void
  onOpenKana?: (script: Extract<BeginnerScript, 'hiragana' | 'katakana'>, rowIndex: number, charIndex: number) => void
  onOpenKanji: () => void
  onOpenPictures?: () => void
  onOpenSpeedRun?: () => void
}

const BEGINNER_ZONE_VOWEL_ROWS: Record<string, number> = { a: 0, i: 1, u: 2, e: 3, o: 4 }
const BEGINNER_ZONE_ROW_OVERRIDES: Record<string, number> = { を: 2, ヲ: 2, ん: 4, ン: 4 }

function getBeginnerZoneVowelIndex(char: string, romaji: string): number {
  return BEGINNER_ZONE_ROW_OVERRIDES[char]
    ?? BEGINNER_ZONE_VOWEL_ROWS[romaji.charAt(romaji.length - 1)]
    ?? 4
}

type BeginnerIntroScriptId = 'hiragana' | 'katakana' | 'kanji'

const BEGINNER_INTRO_REVEAL_CONTENT = {
  hiragana: {
    label: 'Hiragana',
    mark: 'あ',
    romaji: 'a',
    heading: 'Example:',
    words: [
      { kana: 'あめ', readingParts: ['a', 'me'], romaji: 'Rain' },
    ],
  },
  katakana: {
    label: 'Katakana',
    mark: 'ア',
    romaji: 'a',
    heading: 'Example:',
    words: [
      { kana: 'アメリカ', readingParts: ['a', 'me', 'ri', 'ka'], romaji: 'America' },
    ],
  },
  kanji: {
    label: 'Kanji',
    mark: '山',
    romaji: 'Yama',
    heading: 'Another Example:',
    words: [
      { kana: '猫', spokenKana: 'ねこ', readingParts: ['neko'], romaji: 'Cat' },
    ],
  },
} as const

function renderBeginnerIntroExampleWord(word: {
  kana?: string
  spokenKana?: string
  reading?: string
  readingParts?: readonly string[]
  romaji: string
  note?: readonly string[]
}, interactive = true, showAudio = true): ReactNode {
  const audioControl = word.kana && showAudio && (interactive ? (
    <button
      type="button"
      className="beginner-intro-example-speaker"
      onClick={() => speakJapanese(word.spokenKana ?? word.kana ?? '', { beginnerRecordingKind: 'word' })}
      aria-label={`Play ${word.kana}`}
    >
      <Volume2 aria-hidden="true" />
    </button>
  ) : (
    <span className="beginner-intro-example-speaker" aria-hidden="true">
      <Volume2 />
    </span>
  ))

  return (
    <span key={word.romaji} className={word.kana ? undefined : 'is-english-only'}>
      {word.kana && (
        <>
          {word.readingParts ? (
            <span className="beginner-intro-segmented-ruby">
              {Array.from(word.kana).map((character, index) => (
                <ruby key={`${character}-${index}`}>
                  <i lang="ja">{character}</i>
                  <rt>{word.readingParts?.[index]}</rt>
                </ruby>
              ))}
              {audioControl}
            </span>
          ) : word.reading ? (
            <ruby>
              <i lang="ja">{word.kana}</i>
              <rt>{word.reading}</rt>
            </ruby>
          ) : (
            <i lang="ja">{word.kana}</i>
          )}
          <em>-</em>
        </>
      )}
      <small>
        <span className="beginner-intro-example-meaning">{word.romaji}</span>
      </small>
      {word.note && (
        <span className="beginner-intro-example-note">
          {word.note.map((line) => <span key={line}>{line}</span>)}
        </span>
      )}
    </span>
  )
}

const BEGINNER_INTRO_SCRIPTS: Array<{
  id: BeginnerIntroScriptId
  label: string
  mark: string
  descriptor: string
}> = [
  { id: 'hiragana', label: 'Hiragana', mark: 'あ', descriptor: 'simple + curly' },
  { id: 'katakana', label: 'Katakana', mark: 'ア', descriptor: 'sharp + straight' },
  { id: 'kanji', label: 'Kanji', mark: '山', descriptor: 'words + ideas' },
]

const BEGINNER_INTRO_STEPS = [
  {
    id: 'welcome',
    eyebrow: '',
    title: 'Want to learn Japanese?',
    body: '',
  },
  {
    id: 'simple',
    eyebrow: '',
    title: 'Japanese uses three writing systems.',
    body: '',
  },
  {
    id: 'systems',
    eyebrow: '',
    title: 'Hiragana is used for native Japanese words. There are 46 hiragana characters.',
    body: '',
  },
  {
    id: 'katakana-reveal',
    eyebrow: '',
    title: 'Katakana is used for foreign words. It is blocky and angular. It also has 46 characters.',
    body: '',
  },
  {
    id: 'kanji-reveal',
    eyebrow: '',
    title: 'Kanji are information dense Chinese characters used to write Japanese. Most hold the meaning of an entire word. There are thousands.',
    body: '',
  },
  {
    id: 'together',
    eyebrow: 'THE FULL PICTURE',
    title: 'Three systems, one language',
    body: 'Hiragana, Katakana, and Kanji work together in everyday Japanese. You do not need to learn them all at once. We\'ll start with Hiragana.',
  },
] as const

type IntroAnimationSpeed = 0.5 | 1 | 1.25 | 1.5 | 2 | 2.5 | 3

const INTRO_ANIMATION_TIME_BASE = 2
const INTRO_OPENING_DEFAULT_ANIMATION_SPEED: IntroAnimationSpeed = 1
const INTRO_FOLLOWUP_DEFAULT_ANIMATION_SPEED: IntroAnimationSpeed = 2
const INTRO_ANIMATION_SPEEDS: IntroAnimationSpeed[] = [0.5, 1, 1.25, 1.5, 2, 2.5, 3]
const INTRO_OPENING_MOVE_CSS_MS = 1274
const INTRO_SPEECH_RESIZE_MS = 560
const INTRO_SPEECH_HIRAGANA_REVEAL_CSS_MS = 2600 * 0.9879
const INTRO_SPEECH_KATAKANA_KANJI_REVEAL_CSS_MS = 4414 * 0.7464
const INTRO_FINAL_RETRACT_CSS_MS = 1800
const INTRO_STANDARD_SPEECH_STEP_INDEX = 2
const INTRO_FINAL_SPEECH_TITLE = 'Here is an example of all three together.'

function defaultIntroAnimationSpeedForStep(step: number): IntroAnimationSpeed {
  return step <= 1 ? INTRO_OPENING_DEFAULT_ANIMATION_SPEED : INTRO_FOLLOWUP_DEFAULT_ANIMATION_SPEED
}

function introSpeechUnblurDelay(step: number, speed: IntroAnimationSpeed) {
  if (step === 2) {
    return (INTRO_SPEECH_HIRAGANA_REVEAL_CSS_MS * INTRO_ANIMATION_TIME_BASE) / speed
  }

  if (step === 3 || step === 4) {
    return (INTRO_SPEECH_KATAKANA_KANJI_REVEAL_CSS_MS * INTRO_ANIMATION_TIME_BASE) / speed
  }

  return INTRO_SPEECH_RESIZE_MS / speed
}

function renderIntroDisplayText(value: string) {
  if (value === 'Want to learn Japanese?') {
    return value
  }

  if (value === 'Japanese uses three writing systems.') {
    return (
      <>
        Japanese uses three
        <br />
        writing systems.
      </>
    )
  }

  if (value.startsWith('Hiragana is')) {
    const [beforeCount, afterCount] = value.slice('Hiragana'.length).split('46')
    return (
      <>
        <span className="beginner-intro-title-highlight">Hiragana</span>
        {beforeCount}
        <span className="beginner-intro-count-highlight">46</span>
        {afterCount}
      </>
    )
  }

  if (value.startsWith('Katakana is')) {
    return (
      <>
        <span className="beginner-intro-title-highlight">Katakana</span>
        {value.slice('Katakana'.length)}
      </>
    )
  }

  if (value.startsWith('Kanji are')) {
    return (
      <>
        <span className="beginner-intro-title-highlight">Kanji</span>
        {value.slice('Kanji'.length)}
      </>
    )
  }

  return value
}

function IntroBlurSwapText({
  text,
  animate = true,
  durationMs = 1400,
  animationSpeed = INTRO_FOLLOWUP_DEFAULT_ANIMATION_SPEED,
}: {
  text: string
  animate?: boolean
  durationMs?: number
  animationSpeed?: IntroAnimationSpeed
}) {
  const displayedTextRef = useRef(text)
  const [displayedText, setDisplayedText] = useState(text)
  const [isBlurring, setIsBlurring] = useState(false)
  const halfDurationMs = durationMs / 2 / animationSpeed

  useEffect(() => {
    if (text === displayedTextRef.current) return

    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      displayedTextRef.current = text
      setDisplayedText(text)
      setIsBlurring(false)
      return
    }

    setIsBlurring(true)
    const swapTimer = window.setTimeout(() => {
      displayedTextRef.current = text
      setDisplayedText(text)
      setIsBlurring(false)
    }, halfDurationMs)

    return () => window.clearTimeout(swapTimer)
  }, [animate, halfDurationMs, text])

  return (
    <span
      className={`beginner-intro-blur-text ${isBlurring ? 'is-blurring' : 'is-clear'}`}
      style={{ '--intro-blur-duration': `${halfDurationMs}ms` } as CSSProperties}
    >
      {renderIntroDisplayText(displayedText)}
    </span>
  )
}

function BeginnerZone({
  initialScript,
  intro = false,
  onOpenChart,
  onOpenQuiz,
  onOpenKana,
  onOpenKanji,
  onOpenPictures,
  onOpenSpeedRun,
}: BeginnerZoneProps) {
  const [script, setScript] = useState<Extract<BeginnerScript, 'hiragana' | 'katakana'>>(initialScript)
  const [introStep, setIntroStep] = useState(0)
  const [introOpeningPreview, setIntroOpeningPreview] = useState(false)
  const [introOpeningShrinking, setIntroOpeningShrinking] = useState(false)
  const [introOpeningShrinkDone, setIntroOpeningShrinkDone] = useState(false)
  const [introTransitioning, setIntroTransitioning] = useState(false)
  const [introSequenceComplete, setIntroSequenceComplete] = useState(false)
  const [introPaused, setIntroPaused] = useState(false)
  const [introAnimationSpeed, setIntroAnimationSpeed] = useState<IntroAnimationSpeed>(INTRO_OPENING_DEFAULT_ANIMATION_SPEED)
  const [introSpeedCustomized, setIntroSpeedCustomized] = useState(false)
  const [introSpeedMenuOpen, setIntroSpeedMenuOpen] = useState(false)
  const [introSpeechDisplayStep, setIntroSpeechDisplayStep] = useState(0)
  const [introSpeechCopyBlurred, setIntroSpeechCopyBlurred] = useState(false)
  const introTransitionTimerRef = useRef<number | null>(null)
  const introOpeningTimerRef = useRef<number | null>(null)
  const introOpeningFinishTimerRef = useRef<number | null>(null)
  const introSpeechTimerRef = useRef<number | null>(null)
  const introSpeechFrameRef = useRef<number | null>(null)
  const introSpeechDisplayStepRef = useRef(0)
  const introSpeechContentRef = useRef<HTMLDivElement>(null)
  const introSpeechMeasureRef = useRef<HTMLDivElement>(null)
  const introConnectorSvgRef = useRef<SVGSVGElement>(null)
  const introSpeechWidthMeasureRef = useRef<HTMLDivElement>(null)
  const chartScrollRef = useRef<HTMLDivElement>(null)
  const [introSpeechSize, setIntroSpeechSize] = useState<{ width: number; height: number } | null>(null)
  const deck = getBeginnerDeck(script)
  const columns = deck.rows.map((row, rowIndex) => ({ row, rowIndex })).reverse()
  const vowels = ['a', 'i', 'u', 'e', 'o']
  const actions = [
    { mark: '聞', label: 'Quiz', tone: 'green', onClick: () => onOpenQuiz?.('hiragana') },
    { mark: '書', label: 'Quiz', tone: 'amber', onClick: () => onOpenQuiz?.('katakana') },
    { mark: '一', label: 'Kanji', tone: 'violet', onClick: onOpenKanji },
    { mark: '絵', label: 'Pics', tone: 'teal', onClick: onOpenPictures },
    { mark: '⚡', label: 'Speed', tone: 'gold', onClick: onOpenSpeedRun },
  ]

  useLayoutEffect(() => {
    const chart = chartScrollRef.current
    if (!chart) return

    chart.style.scrollBehavior = 'auto'
    chart.scrollLeft = chart.scrollWidth
    const frame = window.requestAnimationFrame(() => {
      chart.scrollLeft = chart.scrollWidth
      chart.style.removeProperty('scroll-behavior')
    })

    return () => window.cancelAnimationFrame(frame)
  }, [script])

  useEffect(() => () => {
    if (introTransitionTimerRef.current !== null) window.clearTimeout(introTransitionTimerRef.current)
    if (introOpeningTimerRef.current !== null) window.clearTimeout(introOpeningTimerRef.current)
    if (introOpeningFinishTimerRef.current !== null) window.clearTimeout(introOpeningFinishTimerRef.current)
    if (introSpeechTimerRef.current !== null) window.clearTimeout(introSpeechTimerRef.current)
    if (introSpeechFrameRef.current !== null) window.cancelAnimationFrame(introSpeechFrameRef.current)
  }, [])

  function goToIntroStep(nextStep: number) {
    if (introTransitionTimerRef.current !== null) window.clearTimeout(introTransitionTimerRef.current)
    if (introOpeningTimerRef.current !== null) window.clearTimeout(introOpeningTimerRef.current)
    if (introOpeningFinishTimerRef.current !== null) window.clearTimeout(introOpeningFinishTimerRef.current)
    if (introSpeechTimerRef.current !== null) window.clearTimeout(introSpeechTimerRef.current)
    if (introSpeechFrameRef.current !== null) window.cancelAnimationFrame(introSpeechFrameRef.current)
    introTransitionTimerRef.current = null
    introOpeningTimerRef.current = null
    introOpeningFinishTimerRef.current = null
    introSpeechTimerRef.current = null
    introSpeechFrameRef.current = null
    setIntroTransitioning(false)
    setIntroSequenceComplete(false)
    setIntroPaused(false)
    setIntroOpeningPreview(false)
    setIntroOpeningShrinking(false)
    setIntroOpeningShrinkDone(false)
    introSpeechDisplayStepRef.current = nextStep
    setIntroSpeechDisplayStep(nextStep)
    setIntroSpeechCopyBlurred(false)
    if (!introSpeedCustomized) setIntroAnimationSpeed(defaultIntroAnimationSpeedForStep(nextStep))
    setIntroStep(nextStep)
  }

  function advanceIntro() {
    if (introTransitioning || introSequenceComplete || introOpeningPreview || (introOpeningShrinking && !introOpeningShrinkDone)) return
    if (introStep === 0) {
      if (!introSpeedCustomized) setIntroAnimationSpeed(defaultIntroAnimationSpeedForStep(1))
      setIntroOpeningPreview(true)
      setIntroOpeningShrinkDone(false)
      setIntroStep(1)
      setIntroOpeningShrinking(true)
      return
    }
    if (introStep < 4) {
      setIntroOpeningShrinking(false)
      setIntroOpeningShrinkDone(false)
      const nextStep = introStep === 2 ? 3 : introStep + 1
      if (!introSpeedCustomized) setIntroAnimationSpeed(defaultIntroAnimationSpeedForStep(nextStep))
      if (introStep === 2) {
        setIntroStep(3)
        return
      }
      setIntroStep(nextStep)
      return
    }
    if (introStep >= 5) return

    setIntroTransitioning(true)
    introTransitionTimerRef.current = window.setTimeout(() => {
      setIntroSequenceComplete(true)
      setIntroTransitioning(false)
      introTransitionTimerRef.current = null
    }, INTRO_FINAL_RETRACT_CSS_MS / introAnimationSpeed)
  }

  const finishIntroOpeningShrink = useCallback(() => {
    if (!introOpeningShrinking) return
    setIntroOpeningPreview(false)
    setIntroOpeningShrinkDone(true)
  }, [introOpeningShrinking])

  useEffect(() => {
    if (!introOpeningShrinking) return undefined

    introOpeningFinishTimerRef.current = window.setTimeout(() => {
      finishIntroOpeningShrink()
      introOpeningFinishTimerRef.current = null
    }, (INTRO_OPENING_MOVE_CSS_MS + 200) / introAnimationSpeed)

    return () => {
      if (introOpeningFinishTimerRef.current !== null) window.clearTimeout(introOpeningFinishTimerRef.current)
      introOpeningFinishTimerRef.current = null
    }
  }, [finishIntroOpeningShrink, introAnimationSpeed, introOpeningShrinking])

  // Draw the final example's connector lines from the real word positions so they stay
  // attached however the Japanese and English lines are centered.
  useLayoutEffect(() => {
    if (!introSequenceComplete) return undefined

    const layoutConnectors = () => {
      const svg = introConnectorSvgRef.current
      const copy = svg?.parentElement
      if (!svg || !copy) return
      const frame = svg.getBoundingClientRect()
      if (!frame.width || !frame.height) return
      const measure = (selector: string) => {
        const rect = copy.querySelector(selector)?.getBoundingClientRect()
        return rect ? { left: rect.left - frame.left, right: rect.right - frame.left } : null
      }
      const center = (box: { left: number; right: number } | null) => (box ? (box.left + box.right) / 2 : null)
      const kanji = center(measure('ruby.is-kanji > span'))
      const hiragana = center(measure('ruby.is-hiragana > span'))
      const katakanaFirst = measure('ruby.is-katakana-1 > span')
      const katakanaLast = measure('ruby.is-katakana-3 > span')
      const englishKanji = center(measure('.beginner-intro-wheel-center-meaning > .is-kanji'))
      const englishHiragana = center(measure('.beginner-intro-wheel-center-meaning > .is-hiragana'))
      const englishKatakana = center(measure('.beginner-intro-wheel-center-meaning > .is-katakana'))
      if (kanji === null || hiragana === null || !katakanaFirst || !katakanaLast
        || englishKanji === null || englishHiragana === null || englishKatakana === null) return

      const top = 1
      const bottom = frame.height - 4
      const underlineCenter = (katakanaFirst.left + katakanaLast.right) / 2
      const setPath = (selector: string, d: string) => svg.querySelector(selector)?.setAttribute('d', d)
      svg.setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`)
      setPath('.is-kanji.is-pointer', `M ${kanji} ${top} L ${englishKanji} ${bottom}`)
      setPath('.is-hiragana.is-pointer', `M ${hiragana} ${top} L ${englishHiragana} ${bottom}`)
      setPath('.is-katakana.is-pointer', `M ${underlineCenter} ${top} L ${englishKatakana} ${bottom}`)
    }

    layoutConnectors()
    void document.fonts?.ready.then(layoutConnectors)
    window.addEventListener('resize', layoutConnectors)
    return () => window.removeEventListener('resize', layoutConnectors)
  }, [introSequenceComplete])

  useLayoutEffect(() => {
    if (!intro) return undefined

    const content = introSpeechMeasureRef.current ?? introSpeechContentRef.current
    const widthProbe = introSpeechWidthMeasureRef.current ?? content
    if (!content || !widthProbe) return undefined
    const speech = content.parentElement
    if (!(speech instanceof HTMLElement)) return undefined
    const contentNode = content
    const widthProbeNode = widthProbe
    const speechNode = speech

    let frame = 0
    function measureSpeechSize() {
      const style = window.getComputedStyle(speechNode)
      const guide = speechNode.parentElement
      if (!guide) {
        frame = 0
        return
      }

      const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      const horizontalBorder = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
      const verticalBorder = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
      const availableOuterWidth = guide.getBoundingClientRect().right - speechNode.getBoundingClientRect().left
      const maxOuterWidth = Math.min(22 * parseFloat(window.getComputedStyle(document.documentElement).fontSize), availableOuterWidth)
      const maxContentWidth = Math.max(0, maxOuterWidth - horizontalPadding - horizontalBorder)

      widthProbeNode.style.width = 'max-content'
      widthProbeNode.style.maxWidth = 'none'
      const contentWidth = Math.min(widthProbeNode.getBoundingClientRect().width, maxContentWidth)
      contentNode.style.width = `${contentWidth}px`
      contentNode.style.maxWidth = 'none'
      const contentRect = contentNode.getBoundingClientRect()
      const nextSize = {
        width: Math.ceil(contentWidth + horizontalPadding + horizontalBorder),
        height: Math.ceil(contentRect.height + verticalPadding + verticalBorder),
      }

      setIntroSpeechSize((current) => (
        current && Math.abs(current.width - nextSize.width) < 1 && Math.abs(current.height - nextSize.height) < 1
          ? current
          : nextSize
      ))
      frame = 0
    }

    function scheduleSpeechSizeUpdate() {
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(measureSpeechSize)
    }

    measureSpeechSize()
    window.addEventListener('resize', scheduleSpeechSizeUpdate)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', scheduleSpeechSizeUpdate)
    }
  }, [intro, introOpeningPreview, introSpeechDisplayStep, introTransitioning])

  const displayIntroStep = introOpeningPreview && introStep === 0 ? 1 : introStep

  useEffect(() => {
    if (!intro || displayIntroStep === introSpeechDisplayStepRef.current) return undefined

    if (introSpeechTimerRef.current !== null) window.clearTimeout(introSpeechTimerRef.current)
    if (introSpeechFrameRef.current !== null) window.cancelAnimationFrame(introSpeechFrameRef.current)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      introSpeechDisplayStepRef.current = displayIntroStep
      setIntroSpeechDisplayStep(displayIntroStep)
      setIntroSpeechCopyBlurred(false)
      return undefined
    }

    setIntroSpeechCopyBlurred(true)
    introSpeechTimerRef.current = window.setTimeout(() => {
      introSpeechDisplayStepRef.current = displayIntroStep
      setIntroSpeechDisplayStep(displayIntroStep)
      introSpeechFrameRef.current = window.requestAnimationFrame(() => {
        setIntroSpeechCopyBlurred(false)
        introSpeechFrameRef.current = null
      })
      introSpeechTimerRef.current = null
    }, introSpeechUnblurDelay(displayIntroStep, introAnimationSpeed))

    return () => {
      if (introSpeechTimerRef.current !== null) window.clearTimeout(introSpeechTimerRef.current)
      if (introSpeechFrameRef.current !== null) window.cancelAnimationFrame(introSpeechFrameRef.current)
      introSpeechTimerRef.current = null
      introSpeechFrameRef.current = null
    }
  }, [displayIntroStep, intro, introAnimationSpeed])

  if (intro) {
    const step = BEGINNER_INTRO_STEPS[displayIntroStep]
    const speechDisplayStep = BEGINNER_INTRO_STEPS[introSpeechDisplayStep]
    const speechMeasureStep = introSpeechDisplayStep === 3
      ? BEGINNER_INTRO_STEPS[INTRO_STANDARD_SPEECH_STEP_INDEX]
      : speechDisplayStep
    const guideStep = introOpeningShrinking
      ? step
      : introSpeechDisplayStep === 3
      ? BEGINNER_INTRO_STEPS[INTRO_STANDARD_SPEECH_STEP_INDEX]
      : (introOpeningPreview && introStep === 0 && !introOpeningShrinking
          ? BEGINNER_INTRO_STEPS[0]
          : speechDisplayStep)
    const activeScriptIndex = -1
    const completedScripts = 0
    const isFinalStep = introSequenceComplete
    const speechTitle = isFinalStep ? INTRO_FINAL_SPEECH_TITLE : speechDisplayStep.title
    const speechMeasureTitle = isFinalStep ? INTRO_FINAL_SPEECH_TITLE : speechMeasureStep.title
    const revealScript = introStep >= 4 ? 'kanji' : introStep === 3 ? 'katakana' : 'hiragana'
    const activeRevealIndex = introStep >= 2 && introStep <= 4 ? introStep - 2 : -1
    const isRevealWheelVisible = introStep >= 1 && introStep <= 4

    return (
      <main
        className={`beginner-zone beginner-zone--intro${introPaused ? ' is-intro-paused' : ''}`}
        style={{ '--intro-time-unit': `${INTRO_ANIMATION_TIME_BASE / introAnimationSpeed}ms` } as CSSProperties}
      >
        <header className={`beginner-intro-guide is-${guideStep.id}`}>
          <div className="beginner-intro-mascot" aria-hidden="true">
            <img src={DEFAULT_PROFILE_PHOTO} alt="" />
          </div>
          <div
            className="beginner-intro-speech"
            aria-live="polite"
            style={introSpeechSize ? {
              '--intro-speech-width': `${introSpeechSize.width}px`,
              '--intro-speech-height': `${introSpeechSize.height}px`,
            } as CSSProperties : undefined}
          >
            <div
              className={`beginner-intro-speech-inner beginner-intro-speech-copy is-${speechDisplayStep.id}${isFinalStep ? ' is-final-message' : ''}${displayIntroStep >= 2 && displayIntroStep <= 4 ? ` is-script-delayed-reveal is-target-${revealScript}` : ''}`}
              ref={introSpeechContentRef}
            >
              <div className={`beginner-intro-speech-content${introSpeechCopyBlurred ? ' is-blurred' : ''}`}>
                {speechDisplayStep.eyebrow && <small>{speechDisplayStep.eyebrow}</small>}
                <h1>{renderIntroDisplayText(speechTitle)}</h1>
                {speechDisplayStep.body && <p>{speechDisplayStep.body}</p>}
              </div>
            </div>
            <div className={`beginner-intro-speech-inner beginner-intro-speech-measure is-${speechMeasureStep.id}`} ref={introSpeechMeasureRef} aria-hidden="true">
              {speechMeasureStep.eyebrow && <small>{speechMeasureStep.eyebrow}</small>}
              <h1>{renderIntroDisplayText(speechMeasureTitle)}</h1>
              {speechMeasureStep.body && <p>{speechMeasureStep.body}</p>}
            </div>
            <div className="beginner-intro-speech-inner beginner-intro-speech-measure is-systems" ref={introSpeechWidthMeasureRef} aria-hidden="true">
              <h1>{renderIntroDisplayText(BEGINNER_INTRO_STEPS[INTRO_STANDARD_SPEECH_STEP_INDEX].title)}</h1>
            </div>
          </div>
        </header>

        <section className={`beginner-intro-lesson is-${step.id}${introTransitioning ? ' is-transitioning' : ''}`} aria-label="The three Japanese writing systems">
          <div className={`beginner-intro-orbit has-${completedScripts}-docked`}>
            <div className={`beginner-intro-ring${completedScripts > 0 ? ' is-visible' : ''}`} aria-hidden="true" />
            {isRevealWheelVisible && (
              <div className={`beginner-intro-empty-wheel is-${revealScript}${introStep === 2 ? ' is-revealing' : ''}${introStep >= 3 && introStep <= 4 ? ' is-switching' : ''}${introSequenceComplete ? ' is-final-complete' : ''}${(introTransitioning || introSequenceComplete) && introStep === 4 ? ' is-final-retracting' : ''}`}>
                <div className="beginner-intro-wheel-assembly">
                  <div className="beginner-intro-circuit-lines" aria-hidden="true">
                    <i className="is-outer-one" />
                    <i className="is-outer-two" />
                    <i className="is-inner" />
                  </div>
                  <div className="beginner-intro-wheel-rotor">
                    {BEGINNER_INTRO_SCRIPTS.map((item, index) => {
                    const content = BEGINNER_INTRO_REVEAL_CONTENT[item.id]
                    const exampleWord = content.words[0]
                    const exampleAudio = 'spokenKana' in exampleWord ? exampleWord.spokenKana : exampleWord.kana
                    const isRevealSlot = index === activeRevealIndex
                    const isPreviousSlot = index === activeRevealIndex - 1
                    return (
                      <span
                        className={`beginner-intro-empty-slot is-wheel-slot is-slot-${item.id} is-script-${item.id}${isRevealSlot ? ' is-reveal-slot' : ''}${isPreviousSlot ? ' is-previous-slot' : ''}`}
                        key={item.id}
                        aria-hidden={!isRevealSlot}
                      >
                        <span className="beginner-intro-slot-stage">
                          {isRevealSlot || isPreviousSlot ? (
                            <>
                              <span className="beginner-intro-slot-progress">{item.id === 'kanji' ? '1/∞' : '1/46'}</span>
                              <span className="beginner-intro-slot-label">{content.label}</span>
                              <span key="slot-glyph" className="beginner-intro-slot-hiragana" lang="ja">
                                <small lang="en">{content.romaji}</small>
                                <span>{content.mark}</span>
                                {item.id === 'kanji' && <small lang="en" className="is-meaning">Mountain</small>}
                                {introStep >= 2 && (
                                  <button
                                    type="button"
                                    className="beginner-intro-kana-speaker"
                                    onClick={() => speakJapanese(item.id === 'kanji' ? 'やま' : content.mark, {
                                      rate: 0.5,
                                      beginnerRecordingKind: item.id === 'kanji' ? 'word' : 'kana',
                                    })}
                                    aria-label={`Play the sound for ${content.mark}`}
                                  >
                                    <Volume2 aria-hidden="true" />
                                  </button>
                                )}
                              </span>
                              <span className="beginner-intro-slot-words is-hiragana-examples">
                                <b>{content.heading}</b>
                                {content.words.map((word) => renderBeginnerIntroExampleWord(word, introStep >= 2))}
                              </span>
                              {introStep >= 2 && (
                                <button
                                  type="button"
                                  className="beginner-intro-example-hit-area"
                                  onClick={() => speakJapanese(exampleAudio, { beginnerRecordingKind: 'word' })}
                                  aria-label={`Play the example word ${exampleWord.kana}`}
                                />
                              )}
                            </>
                          ) : (
                            <span key="slot-glyph" className="beginner-intro-slot-hiragana is-seed-glyph" lang="ja"><span>{item.mark}</span></span>
                          )}
                        </span>
                      </span>
                    )
                    })}
                  </div>
                  <div className="beginner-intro-final-line-lights" aria-hidden="true">
                    <i className="is-kanji" />
                    <i className="is-hiragana" />
                    <i className="is-katakana is-first" />
                    <i className="is-katakana is-second" />
                    <i className="is-katakana is-third" />
                  </div>
                </div>
                <div className="beginner-intro-wheel-center-copy" aria-hidden="true">
                  <div className="beginner-intro-wheel-center-japanese" lang="ja">
                    <ruby className="is-kanji"><span>猫</span><rt lang="en">neko</rt></ruby>
                    <ruby className="is-hiragana"><span>の</span><rt lang="en">no</rt></ruby>
                    <ruby className="is-katakana is-katakana-1"><span>ミ</span><rt lang="en">mi</rt></ruby>
                    <ruby className="is-katakana is-katakana-2"><span>ル</span><rt lang="en">ru</rt></ruby>
                    <ruby className="is-katakana is-katakana-3"><span>ク</span><rt lang="en">ku</rt></ruby>
                  </div>
                  <svg className="beginner-intro-word-connectors" ref={introConnectorSvgRef} viewBox="0 0 240 78" preserveAspectRatio="none" aria-hidden="true">
                    <path className="is-kanji is-pointer" pathLength="1" d="M 56.5 1 L 76.5 72" />
                    <path className="is-hiragana is-pointer" pathLength="1" d="M 93.7 1 L 128.2 82" />
                    <path className="is-katakana is-first is-pointer" pathLength="1" d="M 165.2 1 L 196 72" />
                  </svg>
                  <div className="beginner-intro-wheel-center-meaning" lang="en">
                    <span className="is-kanji">Cat</span>
                    <span className="is-hiragana">'s</span>
                    <span className="is-katakana">milk</span>
                  </div>
                </div>
              </div>
            )}
            {BEGINNER_INTRO_SCRIPTS.map((item, index) => {
              const isFocused = !introTransitioning && index === activeScriptIndex
              const isDocked = index < completedScripts
              const dockAge = completedScripts - 1 - index
              const dockSlot = dockAge === 0 ? 'top' : dockAge === 1 ? 'right' : 'left'
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`beginner-intro-node is-${item.id}${isFocused ? ' is-focused' : ''}${isDocked ? ` is-docked is-slot-${dockSlot}` : ''}`}
                  onClick={() => isDocked && !introTransitioning && goToIntroStep(index + 3)}
                  disabled={!isDocked}
                  aria-label={isFocused ? `${item.label}, currently being introduced` : item.label}
                  aria-pressed={isFocused}
                >
                  <span className="beginner-intro-node-mark" lang="ja">
                    <span className="beginner-intro-node-glyph">{item.mark}</span>
                    {item.id === 'hiragana' && isFocused && (
                      <span className="beginner-intro-node-words">
                        <b>{BEGINNER_INTRO_REVEAL_CONTENT.hiragana.heading}</b>
                        {BEGINNER_INTRO_REVEAL_CONTENT.hiragana.words.map((word) => renderBeginnerIntroExampleWord(word, false, false))}
                      </span>
                    )}
                  </span>
                  <b>{item.label}</b>
                  <small>{item.descriptor}</small>
                </button>
              )
            })}
          </div>

        </section>

        <footer className={`beginner-intro-controls${introStep > 0 ? ' is-lowered' : ''}${introStep <= 1 ? ' is-opening' : ''}`}>
          <div>
            {isFinalStep ? (
              <button type="button" className="beginner-intro-replay" onClick={() => goToIntroStep(0)} aria-label="Replay introduction">
                <RotateCcw aria-hidden="true" />
              </button>
            ) : introStep >= 2 ? (
              <button type="button" className="beginner-intro-back" onClick={() => goToIntroStep(introStep - 1)} disabled={introTransitioning} aria-label="Previous introduction step">
                <ArrowLeft aria-hidden="true" />
              </button>
            ) : (
              <span className="beginner-intro-control-spacer" aria-hidden="true" />
            )}
            {isFinalStep ? (
              <span className="beginner-intro-control-spacer" aria-hidden="true" />
            ) : (
              <button
                type="button"
                className={`beginner-intro-next${introStep === 0 ? ' is-yes' : ''}${introOpeningShrinking ? ' is-shrinking' : ''}${introOpeningShrinkDone ? ' is-shrink-done' : ''}`}
                onClick={advanceIntro}
                disabled={introTransitioning}
              >
                <IntroBlurSwapText
                  text={introOpeningPreview || introStep > 0 ? 'Next' : 'Yes!'}
                  animate={displayIntroStep <= 1}
                  durationMs={introOpeningPreview && introStep <= 1 ? INTRO_OPENING_MOVE_CSS_MS : 1400}
                  animationSpeed={introAnimationSpeed}
                />
                <ArrowRight aria-hidden="true" />
              </button>
            )}
            {!isFinalStep ? (
              <div className="beginner-intro-playback-controls">
                <button
                  type="button"
                  className="beginner-intro-pause"
                  onClick={() => setIntroPaused((current) => !current)}
                  aria-label={introPaused ? 'Resume introduction animation' : 'Pause introduction animation'}
                  aria-pressed={introPaused}
                >
                  {introPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                </button>
                <div
                  className="beginner-intro-speed-picker"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIntroSpeedMenuOpen(false)
                  }}
                >
                  <button
                    type="button"
                    className="beginner-intro-speed"
                    onClick={() => setIntroSpeedMenuOpen((current) => !current)}
                    aria-label={`Animation speed, ${introAnimationSpeed} times`}
                    aria-expanded={introSpeedMenuOpen}
                    aria-haspopup="menu"
                  >
                    <Gauge aria-hidden="true" />
                    <span>{introAnimationSpeed}x</span>
                  </button>
                  {introSpeedMenuOpen && (
                    <div className="beginner-intro-speed-menu" role="menu" aria-label="Animation speed">
                      {INTRO_ANIMATION_SPEEDS.map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          role="menuitemradio"
                          aria-checked={speed === introAnimationSpeed}
                          className={speed === introAnimationSpeed ? 'is-active' : ''}
                          onClick={() => {
                            setIntroSpeedCustomized(true)
                            setIntroAnimationSpeed(speed)
                            setIntroSpeedMenuOpen(false)
                          }}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <span className="beginner-intro-control-spacer" aria-hidden="true" />
            )}
          </div>
        </footer>
      </main>
    )
  }
  return (
    <main className="beginner-zone beginner-zone--resources">
      <header className="beginner-zone-resources-header">
        <div>
          <small>BEGINNER ZONE</small>
          <h1>Resources</h1>
        </div>
      </header>

      <section className={`beginner-zone-chart beginner-zone-chart--${script}`} aria-label={`${deck.title} starter chart`}>
        <div className="beginner-zone-chart-top">
          <div className="beginner-zone-tabs" role="group" aria-label="Kana script">
            {(['hiragana', 'katakana'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={script === option ? 'is-active' : ''}
                onClick={() => setScript(option)}
                aria-pressed={script === option}
              >
                {option === 'hiragana' ? 'Hiragana' : 'Katakana'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="beginner-zone-expand"
            onClick={() => onOpenChart?.(script)}
            aria-label={`Open the full ${deck.title} chart`}
            title={`Open full ${deck.title} chart`}
          >
            <span aria-hidden="true">&#8599;</span>
          </button>
        </div>

        <div key={script} className="beginner-zone-kana-scroll" ref={chartScrollRef} aria-label={`Scrollable ${deck.title} chart`}>
          <div
            className="beginner-zone-kana-grid"
            style={{ gridTemplateColumns: `repeat(${columns.length}, var(--beginner-zone-kana-cell)) var(--beginner-zone-kana-label)` }}
          >
            {columns.map(({ row }) => <small key={row.id} className="beginner-zone-kana-col-label">{row.characters[0]?.romaji || row.label}</small>)}
            <span className="beginner-zone-kana-corner" aria-hidden="true" />
            {vowels.map((vowel, charIndex) => (
              <div className="beginner-zone-kana-row" key={vowel}>
                {columns.map(({ row, rowIndex }) => {
                  const characterEntry = row.characters
                    .map((character, characterIndex) => ({ character, characterIndex }))
                    .find(({ character }) => getBeginnerZoneVowelIndex(character.char, character.romaji) === charIndex)
                  if (!characterEntry) return <span key={row.id} className="beginner-zone-kana-empty" aria-hidden="true" />
                  const { character, characterIndex } = characterEntry
                  return (
                    <button
                      key={character.char}
                      type="button"
                      className={character.char.length > 1 ? 'is-contracted' : undefined}
                      onClick={() => onOpenKana?.(script, rowIndex, characterIndex)}
                      aria-label={`Practice ${character.char}, ${character.romaji}`}
                    >
                      <span lang="ja">{character.char}</span>
                    </button>
                  )
                })}
                <small className="beginner-zone-kana-row-label">{vowel}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="beginner-zone-actions" aria-label="Beginner activities">
        {actions.map((action) => (
          <button key={`${action.label}-${action.mark}`} type="button" onClick={action.onClick}>
            <span className={`beginner-zone-action-mark is-${action.tone}`} aria-hidden="true" lang="ja">{action.mark}</span>
            <small>{action.label}</small>
          </button>
        ))}
      </section>
    </main>
  )
}

function DesktopPrimaryNav({
  currentView,
  hideUser,
  profileOpen,
  settingsOpen,
  profileName: _profileName,
  profilePhoto,
  onProfile,
  onSettings,
  onHero,
  onHome,
  onStudy,
  onBeginner,
  onIntro,
}: {
  currentView: View
  hideUser: boolean
  profileOpen: boolean
  settingsOpen: boolean
  profileName: string
  profilePhoto: string | null
  onProfile: () => void
  onSettings: () => void
  onHero: () => void
  onHome: () => void
  onStudy: () => void
  onBeginner: () => void
  onIntro: () => void
}) {
  const activeTab = primaryNavTabForView(currentView)
  const hideCornerControls = currentView === 'intro'
  const items: Array<{ tab: PrimaryNavTab; label: string; mark: string; onClick: () => void }> = [
    { tab: 'hero', label: 'Hero', mark: '英', onClick: onHero },
    { tab: 'home', label: 'Home', mark: '家', onClick: onHome },
    { tab: 'study', label: 'Study', mark: '学', onClick: onStudy },
    { tab: 'beginner', label: 'Beginner', mark: 'あ', onClick: onBeginner },
    { tab: 'intro', label: 'Intro', mark: '入', onClick: onIntro },
  ]

  return (
    <div className="desktop-primary-nav-bar">
      <nav className="desktop-primary-nav" aria-label="Primary">
        <button
          type="button"
          className={`desktop-primary-nav-user${profileOpen ? ' is-active' : ''}${hideUser || hideCornerControls ? ' is-hidden' : ''}`}
          onClick={onProfile}
          aria-label="Open user menu"
          aria-expanded={profileOpen}
          aria-controls="dashboard-profile-menu"
          title="User menu"
          tabIndex={hideUser || hideCornerControls ? -1 : undefined}
        >
          <img src={displayProfilePhoto(profilePhoto)} alt="" />
        </button>
        <div className="desktop-primary-nav-links">
          {items.map((item) => (
            <button
              key={item.tab}
              type="button"
              className={activeTab === item.tab ? 'is-active' : ''}
              onClick={item.onClick}
              aria-current={activeTab === item.tab ? 'page' : undefined}
            >
              <span aria-hidden="true" lang="ja">{item.mark}</span>
              <b>{item.label}</b>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`desktop-primary-nav-settings${settingsOpen ? ' is-active' : ''}${hideCornerControls ? ' is-hidden' : ''}`}
          onClick={onSettings}
          aria-label={settingsOpen ? 'Hide settings' : 'Show settings'}
          aria-expanded={settingsOpen}
          title={settingsOpen ? 'Hide settings' : 'Show settings'}
          tabIndex={hideCornerControls ? -1 : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19.4 13a7.7 7.7 0 0 0 .1-1 7.7 7.7 0 0 0-.1-1l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.4 7.8a.5.5 0 0 0 .1.6l2 1.6a7.7 7.7 0 0 0-.1 1 7.7 7.7 0 0 0 .1 1l-2 1.6a.5.5 0 0 0 .1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1a7 7 0 0 0 1.7 1l.4 2.5a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0-.5-.4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6Zm-7.4 2.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"
            />
          </svg>
        </button>
      </nav>
    </div>
  )
}

type SessionItem =
  | { kind: 'sentence-builder'; exercise: SentenceExercise }

function canScrollVertically(element: Element) {
  const style = window.getComputedStyle(element)
  return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight
}

function getScrollableParent(element: Element | null) {
  let current = element
  while (current && current !== document.body && current !== document.documentElement) {
    if (canScrollVertically(current)) return current as HTMLElement
    current = current.parentElement
  }
  return document.scrollingElement as HTMLElement | null
}

function App() {
  const [view, setView] = useState<View>(() => window.location.hash === '#home' ? 'home' : 'dashboard')
  const [progress] = useState<Record<string, CardProgress>>(() => loadProgress())
  const [wrongPool, setWrongPool] = useState(() => loadWrongPool())
  const [session, setSession] = useState<SessionItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [exitView, setExitView] = useState<View>('dashboard')
  const [builderLevels, setBuilderLevels] = useState<GenerationComplexity[]>([1])
  const [infiniteBuilderMode, setInfiniteBuilderMode] = useState(false)
  const [favoriteSentences, setFavoriteSentences] = useState<FavoriteSentence[]>(() => loadFavoriteSentences())
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('vocab')
  const [questVocabTopicId, setQuestVocabTopicId] = useState<string | undefined>()
  const [activeQuestId, setActiveQuestId] = useState<string | undefined>()
  const [questProgress, setQuestProgress] = useState(loadQuestProgress)
  const [achievementMetrics, setAchievementMetrics] = useState(loadAchievementMetrics)
  const [practiceReturnView, setPracticeReturnView] = useState<View>('dashboard')
  const [beginnerScript, setBeginnerScript] = useState<BeginnerScript>('hiragana')
  const [beginnerZoneScript, setBeginnerZoneScript] = useState<Extract<BeginnerScript, 'hiragana' | 'katakana'>>('hiragana')
  // Which row (and which character within it) the learner opens on. Zero for
  // the normal Beginner Zone tiles; set to a specific character when a kana
  // chart links straight into one.
  const [beginnerInitialRowIndex, setBeginnerInitialRowIndex] = useState(0)
  const [beginnerInitialCharIndex, setBeginnerInitialCharIndex] = useState(0)
  // Where the learner's Back button goes: the hub normally, but the chart it
  // was opened from when a kana chart is what sent the learner there.
  const [beginnerLearnerReturnView, setBeginnerLearnerReturnView] = useState<'beginner-zone' | 'hiragana-chart' | 'katakana-chart'>('beginner-zone')
  const [beginnerQuizReturnView, setBeginnerQuizReturnView] = useState<'beginner-zone' | 'hiragana-chart' | 'katakana-chart'>('beginner-zone')
  const [shrineRegionId, setShrineRegionId] = useState('tsuzuri')
  const [speedRunReturnView, setSpeedRunReturnView] = useState<'dashboard' | 'beginner-zone' | 'study-tools'>('dashboard')
  const [pictureReturnView, setPictureReturnView] = useState<'dashboard' | 'beginner-zone' | 'study-tools' | 'home'>('dashboard')
  /*
   * Whether the sentence session on screen is the lab copy. The lab runs on
   * the same session machinery as the real builder — same exercises, same
   * navigation — so what it is testing is the screen, not a second pipeline
   * behind it.
   */
  const [sentenceLab, setSentenceLab] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const [furiganaOn, setFuriganaOn] = useState(() => loadBooleanPreference(APP_FURIGANA_DEFAULT_KEY, true))
  const [englishOn, setEnglishOn] = useState(() => loadBooleanPreference(APP_ENGLISH_DEFAULT_KEY, true))
  const [speechOn, setSpeechOn] = useState(() => window.localStorage.getItem(HERO_SPEECH_STORAGE_KEY) === 'true')
  const [complexity, setComplexity] = useState<GenerationComplexity>(1)

  useEffect(() => {
    let startY = 0

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) startY = event.touches[0]!.clientY
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return

      const currentY = event.touches[0]!.clientY
      const deltaY = currentY - startY
      if (deltaY === 0) return

      const scroller = getScrollableParent(event.target instanceof Element ? event.target : null)
      if (!scroller) return

      const atTop = scroller.scrollTop <= 0
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) event.preventDefault()
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])
  const [userProfile] = useUserProfile()

  useEffect(() => {
    saveBooleanPreference(APP_FURIGANA_DEFAULT_KEY, furiganaOn)
  }, [furiganaOn])

  useEffect(() => {
    saveBooleanPreference(APP_ENGLISH_DEFAULT_KEY, englishOn)
  }, [englishOn])

  useEffect(() => {
    window.localStorage.setItem(HERO_SPEECH_STORAGE_KEY, String(speechOn))
    if (!speechOn) stopSpeaking()
  }, [speechOn])

  const goToView = useCallback((next: View) => {
    setView(next)
    setProfileMenuOpen(false)
    if (next !== 'dashboard') setSettingsExpanded(false)
  }, [])

  const openDailyGoal = useCallback((id: DailyGoalId) => {
    setProfileMenuOpen(false)
    if (id === 'sentence') {
      setView('dashboard')
      return
    }
    if (id === 'kanji') {
      setActiveQuestId(undefined)
      setPracticeReturnView('daily-goals')
      setView('kanji')
      return
    }
    if (id === 'vocab') {
      setQuestVocabTopicId(undefined)
      setActiveQuestId(undefined)
      setPracticeReturnView('daily-goals')
      setView('vocab-practice')
      return
    }
    if (id === 'kana') {
      setView('hiragana-chart')
      return
    }
    setView('home')
  }, [])

  const toggleProfileMenu = useCallback(() => {
    setSettingsExpanded(false)
    setProfileMenuOpen((open) => !open)
  }, [])

  const toggleSettingsPanel = useCallback(() => {
    setProfileMenuOpen(false)
    if (view !== 'dashboard') {
      setView('dashboard')
      setSettingsExpanded(true)
      return
    }
    setSettingsExpanded((open) => !open)
  }, [view])

  // This is a single-page app, so route changes otherwise retain whatever
  // scroll offset the previous screen left behind. Run before paint so each
  // quest step opens at its intended top position, without a visible jump.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  const learnedCount = useMemo(
    () => Object.values(progress).filter((item) => isLearned(item)).length,
    [progress],
  )
  const activeQuest = getQuestById(activeQuestId)

  function openBeginnerQuiz(script: Extract<BeginnerScript, 'hiragana' | 'katakana'>, returnView: 'beginner-zone' | 'hiragana-chart' | 'katakana-chart') {
    setBeginnerQuizReturnView(returnView)
    setView(script === 'hiragana' ? 'hiragana-quiz' : 'katakana-quiz')
  }

  const finishQuestStep = useCallback((step: QuestStep) => {
    if (!activeQuestId) return
    setQuestProgress((current) => completeQuestStep(current, activeQuestId, step))
  }, [activeQuestId])

  const updateWrongPool = useCallback((pool: typeof wrongPool) => {
    setWrongPool(pool)
    saveWrongPool(pool)
  }, [])

  const recordSentenceResult = useCallback((id: string, correct: boolean) => {
    let pool = wrongPool
    if (correct) {
      pool = recordCorrect(id, pool)
      setSessionCorrect((n) => n + 1)
    } else {
      pool = recordWrong(id, pool)
    }
    updateWrongPool(pool)
    recordReview()
  }, [wrongPool, updateWrongPool])

  const toggleFavorite = useCallback((favorite: FavoriteSentence) => {
    setFavoriteSentences((current) => {
      const saved = current.some((item) => item.japanese === favorite.japanese)
      const next = saved
        ? current.filter((item) => item.japanese !== favorite.japanese)
        : [favorite, ...current]
      saveFavoriteSentences(next)
      return next
    })
  }, [])

  const toggleFavoriteSentence = useCallback((exercise: SentenceExercise) => {
    toggleFavorite(favoriteFromExercise(exercise))
  }, [toggleFavorite])

  const toggleDrillFavorite = useCallback((exercise: DrillExercise) => {
    toggleFavorite(favoriteFromDrillExercise(exercise))
  }, [toggleFavorite])

  const startStudy = (items: SessionItem[], returnTo: View = 'dashboard') => {
    if (items.length === 0) return
    setSession(items)
    setCurrentIndex(0)
    setSessionCorrect(0)
    setExitView(returnTo)
    setView('study')
  }

  const startSentenceMode = useCallback((returnTo: View = 'dashboard', lab = false) => {
    setSentenceLab(lab)
    setExitView(returnTo)
    setView('study-loading')
    void import('./lib/sentenceLab').then(({ buildSentenceSession }) => {
      const items = buildSentenceSession(wrongPool, builderLevels)
      startStudy(items, returnTo)
    })
  }, [builderLevels, wrongPool])

  const applyBuilderLevels = useCallback((nextLevels: readonly GenerationComplexity[]) => {
    const next = GENERATION_COMPLEXITIES.filter((level) => nextLevels.includes(level))
    if (!next.length) return

    setBuilderLevels([...next])
    if (session[currentIndex]?.kind === 'sentence-builder') {
      void import('./lib/generatedSentenceExercises').then(({ buildGeneratedBuilderExercises }) => {
        const nextExercises = buildGeneratedBuilderExercises(next)
        if (nextExercises.length) {
          setSession(nextExercises.map((exercise) => ({ kind: 'sentence-builder' as const, exercise })))
          setCurrentIndex(0)
          setSessionCorrect(0)
        }
      })
    }
  }, [currentIndex, session])

  const advanceOrComplete = () => {
    if (currentIndex + 1 >= session.length) {
      const finalItem = session[currentIndex]
      if (infiniteBuilderMode && finalItem?.kind === 'sentence-builder') {
        void import('./lib/generatedSentenceExercises').then(({ buildGeneratedBuilderExercises }) => {
          const nextExercises = buildGeneratedBuilderExercises(builderLevels, 1, session.length)
          if (nextExercises.length) {
            setSession((items) => [...items, ...nextExercises.map((exercise) => ({ kind: 'sentence-builder' as const, exercise }))])
            setCurrentIndex((index) => index + 1)
          } else {
            setView('complete')
          }
        })
        return
      }
      setView('complete')
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  const handleSentenceResult = (correct: boolean) => {
    const item = session[currentIndex]
    if (item.kind === 'sentence-builder') {
      recordSentenceResult(item.exercise.id, correct)
    }
    advanceOrComplete()
  }

  const goToPreviousSentence = () => {
    setCurrentIndex((index) => Math.max(0, index - 1))
  }

  const showHubChrome = view === 'dashboard'
    || view === 'home'
    || view === 'study-tools'
    || view === 'beginner-zone'
    || view === 'intro'

  // Swipe left/right across a hub screen to move to the next / previous tab,
  // the same order the bottom nav is in. Deeper screens keep the axis free.
  useSwipeNav(showHubChrome && !profileMenuOpen && !settingsExpanded, (direction) => {
    const index = HUB_TABS.indexOf(view)
    const next = index + direction
    if (index < 0 || next < 0 || next >= HUB_TABS.length) return
    goToView(HUB_TABS[next]!)
  })
  const hubChrome = showHubChrome && view !== 'intro'
    ? (
      <AppHeaderControls
        hideUser={profileMenuOpen}
        profileOpen={profileMenuOpen}
        settingsOpen={settingsExpanded}
        profileName={userProfile.name}
        profilePhoto={userProfile.photo}
        onProfile={toggleProfileMenu}
        onSettings={toggleSettingsPanel}
      />
    )
    : null
  const mobileNav = (
    <MobileBottomNav
      currentView={view}
      onHero={() => goToView('dashboard')}
      onHome={() => goToView('home')}
      onStudy={() => goToView('study-tools')}
      onBeginner={() => goToView('beginner-zone')}
      onIntro={() => goToView('intro')}
    />
  )
  const desktopNav = (
    <DesktopPrimaryNav
      currentView={view}
      hideUser={profileMenuOpen}
      profileOpen={profileMenuOpen}
      settingsOpen={settingsExpanded}
      profileName={userProfile.name}
      profilePhoto={userProfile.photo}
      onProfile={toggleProfileMenu}
      onSettings={toggleSettingsPanel}
      onHero={() => goToView('dashboard')}
      onHome={() => goToView('home')}
      onStudy={() => goToView('study-tools')}
      onBeginner={() => goToView('beginner-zone')}
      onIntro={() => goToView('intro')}
    />
  )
  const profileMenu = (
    <UserProfileMenu
      open={profileMenuOpen}
      onClose={() => setProfileMenuOpen(false)}
      furiganaOn={furiganaOn}
      englishOn={englishOn}
      onToggleFurigana={() => setFuriganaOn((value) => !value)}
      onToggleEnglish={() => setEnglishOn((value) => !value)}
      onOpenProfile={() => goToView('profile')}
      onOpenDailyGoals={() => goToView('daily-goals')}
      onOpenLearningSettings={() => goToView('settings')}
      onOpenHome={() => goToView('home')}
      onOpenAchievements={() => goToView('achievements')}
      onOpenMore={() => goToView('additional-tools')}
      onOpenBackupSync={() => goToView('backup-sync')}
    />
  )
  const withMobileNav = (content: ReactNode) => {
    const appShell = isValidElement(content)
      && typeof (content.props as { className?: unknown }).className === 'string'
      && (content.props as { className: string }).className.split(/\s+/).includes('app')
    const framed = appShell
      ? cloneElement(
          content as ReactElement<{ children?: ReactNode }>,
          undefined,
          hubChrome,
          ...Children.toArray((content as ReactElement<{ children?: ReactNode }>).props.children),
        )
      : (
        <>
          {hubChrome}
          {content}
        </>
      )

    return (
      <>
        {desktopNav}
        {framed}
        {mobileNav}
        {profileMenu}
      </>
    )
  }

  if (view === 'library') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Study Library" />}>
          <LibraryPanel
            initialTab={libraryTab}
            onBack={() => setView('dashboard')}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'kanji') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Kanji Lab" />}>
          <KanjiLab
            questId={activeQuestId}
            onBack={() => setView(practiceReturnView)}
            onDashboard={() => setView('dashboard')}
            furiganaDefault={furiganaOn}
            englishDefault={englishOn}
            onQuestComplete={activeQuestId
              ? () => {
                  finishQuestStep('kanji')
                  setPracticeReturnView('home')
                  setView('grammar')
                }
              : undefined}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'vocab-practice') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Vocab" />}>
          <FocusedVocabPractice
            initialTopicId={questVocabTopicId}
            questTitle={activeQuest?.title}
            onBack={() => setView(practiceReturnView)}
            onDashboard={() => setView('dashboard')}
            furiganaDefault={furiganaOn}
            englishDefault={englishOn}
            onQuestComplete={activeQuestId && questVocabTopicId
              ? () => {
                  finishQuestStep('vocab')
                  setPracticeReturnView('home')
                  setView('kanji')
                }
              : undefined}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'counter-practice') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Counters" />}>
          <CounterPractice
            onBack={() => setView('study-tools')}
            onDashboard={() => setView('dashboard')}
            furiganaDefault={furiganaOn}
            englishDefault={englishOn}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'content-studio') {
    return withMobileNav(
      <Suspense fallback={<RouteLoading label="Content Studio" />}>
        <ContentStudio onBack={() => setView('dashboard')} />
      </Suspense>,
    )
  }

  if (view === 'ink-road') {
    return withMobileNav(
      <div className="app ink-road-page">
        <Suspense fallback={<RouteLoading label="The Ink Road" />}>
          <MapView
            onBack={() => setView('home')}
            onStudy={() => setView('beginner-zone')}
            onShrine={(regionId) => { setShrineRegionId(regionId); setView('shrine-trial') }}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'shrine-trial') {
    return withMobileNav(
      <div className="app ink-road-page">
        <Suspense fallback={<RouteLoading label="The Shrine" />}>
          <ShrineTrial
            regionId={shrineRegionId}
            onBack={() => setView('ink-road')}
            onDone={() => setView('ink-road')}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'home') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Home" />}>
          <HomePage
            learnedCount={learnedCount}
            onBegin={() => setView('intro')}
            onContinue={() => setView(learnedCount > 0 ? 'study-tools' : 'beginner-zone')}
            onOpenStudy={() => setView('study-tools')}
            onOpenBeginner={() => setView('beginner-zone')}
            onOpenHero={() => setView('dashboard')}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'profile') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Profile" />}>
          <ProfilePage onBack={() => setView('dashboard')} />
        </Suspense>
      </div>,
    )
  }

  if (view === 'settings') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Settings" />}>
          <SettingsPage
            onBack={() => setView('dashboard')}
            furiganaOn={furiganaOn}
            englishOn={englishOn}
            onToggleFurigana={() => setFuriganaOn((value) => !value)}
            onToggleEnglish={() => setEnglishOn((value) => !value)}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'daily-goals') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Daily quests" />}>
          <DailyGoalsPage onBack={() => setView('dashboard')} onOpenGoal={openDailyGoal} />
        </Suspense>
      </div>,
    )
  }

  if (view === 'backup-sync') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Backup & Sync" />}>
          <BackupSyncPage onBack={() => setView('dashboard')} />
        </Suspense>
      </div>,
    )
  }

  if (view === 'achievements') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Achievements" />}>
          <AchievementsPanel
            onBack={() => setView('additional-tools')}
            learnedCards={learnedCount}
            favoriteSentences={favoriteSentences.length}
            questProgress={questProgress}
            metrics={achievementMetrics}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'study-tools') {
    return withMobileNav(
      <div className="app study-tools-page">
        <ToolMenuPage
          title="Study tools"
          eyebrow="STUDY MODES"
          tools={[
            { mark: '漢', title: 'Kanji', detail: 'Readings and forms.', accent: 'sumi', onClick: () => {
              setActiveQuestId(undefined)
              setPracticeReturnView('study-tools')
              setView('kanji')
            } },
            { mark: '語彙', title: 'Vocab', detail: 'Focused words.', accent: 'gold', onClick: () => {
              setQuestVocabTopicId(undefined)
              setActiveQuestId(undefined)
              setPracticeReturnView('study-tools')
              setView('vocab-practice')
            } },
            { mark: '数', title: 'Counters', detail: 'Counting patterns.', accent: 'amber', onClick: () => {
              setActiveQuestId(undefined)
              setPracticeReturnView('study-tools')
              setView('counter-practice')
            } },
            { mark: '⚡', title: 'Speed Run', detail: 'Fast kana recall.', accent: 'rayquaza', onClick: () => {
              setSpeedRunReturnView('study-tools')
              setView('beginner-speed-run')
            } },
            { mark: '絵', title: 'Pictures', detail: 'Image word matching.', accent: 'sakura', onClick: () => {
              setPictureReturnView('study-tools')
              setView('picture-practice')
            } },
            { mark: '文', title: 'Sentences', detail: 'Word order.', accent: 'sakura', onClick: () => startSentenceMode('study-tools') },
            { mark: '文法', title: 'Grammar', detail: 'Patterns and particles.', accent: 'rayquaza', onClick: () => {
              setActiveQuestId(undefined)
              setPracticeReturnView('study-tools')
              setView('grammar')
            } },
          ]}
          footerAction={{
            prompt: 'Too hard?',
            label: 'Check out the Beginner Zone',
            onClick: () => setView('beginner-zone'),
          }}
        />
      </div>,
    )
  }

  if (view === 'beginner-zone') {
    return withMobileNav(
      <div className="app beginner-zone-page">
        <BeginnerZone
          key={beginnerZoneScript}
          initialScript={beginnerZoneScript}
          onOpenChart={(script) => setView(script === 'hiragana' ? 'hiragana-chart' : 'katakana-chart')}
          onOpenQuiz={(script) => openBeginnerQuiz(script, 'beginner-zone')}
          onOpenKana={(script, rowIndex, charIndex) => {
            setBeginnerScript(script)
            setBeginnerInitialRowIndex(rowIndex)
            setBeginnerInitialCharIndex(charIndex)
            setBeginnerLearnerReturnView('beginner-zone')
            setView('beginner-learner')
          }}
          onOpenKanji={() => {
            setBeginnerScript('kanji')
            setBeginnerInitialRowIndex(0)
            setBeginnerInitialCharIndex(0)
            setBeginnerLearnerReturnView('beginner-zone')
            setView('beginner-learner')
          }}
          onOpenPictures={() => {
            setPictureReturnView('beginner-zone')
            setView('picture-practice')
          }}
          onOpenSpeedRun={() => {
            setSpeedRunReturnView('beginner-zone')
            setView('beginner-speed-run')
          }}
        />
      </div>,
    )
  }

  if (view === 'intro') {
    return withMobileNav(
      <div className="app beginner-zone-page">
        <BeginnerZone
          intro
          initialScript={beginnerZoneScript}
          onOpenIntroScript={(script) => {
            setBeginnerZoneScript(script)
            setView('beginner-zone')
          }}
          onOpenKanji={() => {
            setBeginnerScript('kanji')
            setBeginnerInitialRowIndex(0)
            setBeginnerInitialCharIndex(0)
            setBeginnerLearnerReturnView('beginner-zone')
            setView('beginner-learner')
          }}
        />
      </div>,
    )
  }

  if (view === 'hiragana-quiz' || view === 'katakana-quiz') {
    const quizScript = view === 'hiragana-quiz' ? 'hiragana' : 'katakana'
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label={view === 'hiragana-quiz' ? 'Hiragana Quiz' : 'Katakana Quiz'} />}>
          <BeginnerLearner
            script={quizScript}
            initialRowIndex={0}
            initialCharIndex={0}
            startWithQuiz
            onBack={() => setView(beginnerQuizReturnView)}
            onOpenChart={() => setView(quizScript === 'hiragana' ? 'hiragana-chart' : 'katakana-chart')}
            onDashboard={() => setView('dashboard')}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'hiragana-chart' || view === 'katakana-chart') {
    const chartScript = view === 'hiragana-chart' ? 'hiragana' : 'katakana'
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label={view === 'hiragana-chart' ? 'Hiragana Chart' : 'Katakana Chart'} />}>
          <KanaChart
            script={chartScript}
            onBack={() => setView('beginner-zone')}
            onDashboard={() => setView('dashboard')}
            onOpenQuiz={() => openBeginnerQuiz(chartScript, view)}
            onSwitchScript={() => setView(view === 'hiragana-chart' ? 'katakana-chart' : 'hiragana-chart')}
            onSelectCharacter={(rowIndex, charIndex) => {
              setBeginnerScript(chartScript)
              setBeginnerInitialRowIndex(rowIndex)
              setBeginnerInitialCharIndex(charIndex)
              setBeginnerLearnerReturnView(view)
              setView('beginner-learner')
            }}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'beginner-learner') {
    // Only hiragana and katakana have a chart to return to.
    const chartView = beginnerScript === 'hiragana' ? 'hiragana-chart' : beginnerScript === 'katakana' ? 'katakana-chart' : null
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Beginner Zone" />}>
          <BeginnerLearner
            // Mastery and the starting row/character are only read once, at
            // mount, from whichever script the learner opened with — keying
            // on script forces a fresh mount (instead of a prop update) so
            // switching hiragana/katakana mid-practice re-reads both for the
            // script just switched to, rather than carrying the old one's
            // stale values over.
            key={beginnerScript}
            script={beginnerScript}
            initialRowIndex={beginnerInitialRowIndex}
            initialCharIndex={beginnerInitialCharIndex}
            onBack={() => setView(beginnerLearnerReturnView)}
            onOpenChart={chartView ? () => setView(chartView) : undefined}
            onOpenQuiz={chartView ? () => openBeginnerQuiz(beginnerScript === 'hiragana' ? 'hiragana' : 'katakana', beginnerLearnerReturnView) : undefined}
            onSwitchScript={chartView ? (rowIndex, charIndex) => {
              const nextScript = beginnerScript === 'hiragana' ? 'katakana' : 'hiragana'
              const nextChartView = nextScript === 'hiragana' ? 'hiragana-chart' : 'katakana-chart'
              setBeginnerScript(nextScript)
              setBeginnerInitialRowIndex(rowIndex)
              setBeginnerInitialCharIndex(charIndex)
              setBeginnerLearnerReturnView((current) => (current === 'beginner-zone' ? current : nextChartView))
            } : undefined}
            onDashboard={() => setView('dashboard')}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'beginner-speed-run') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Speed Run" />}>
          <BeginnerSpeedRun onBack={() => setView(speedRunReturnView)} onDashboard={() => setView('dashboard')} />
        </Suspense>
      </div>,
    )
  }

  if (view === 'picture-practice') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Picture Mode" />}>
          <PicturePractice onBack={() => setView(pictureReturnView)} onDashboard={() => setView('dashboard')} />
        </Suspense>
      </div>,
    )
  }

  if (view === 'favorite-words') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Favorite Words" />}>
          <FavoriteWordsPage onBack={() => setView('dashboard')} />
        </Suspense>
      </div>,
    )
  }

  if (view === 'additional-tools') {
    return withMobileNav(
      <div className="app additional-tools-page">
        <ToolMenuPage
          title="More"
          tools={[
            { mark: '語', title: 'Vocab List', detail: 'Words by level.', accent: 'sakura', onClick: () => {
              setLibraryTab('vocab')
              setView('library')
            } },
            { mark: '動', title: 'Word Categories', detail: 'Grammar groups.', accent: 'rayquaza', onClick: () => {
              setLibraryTab('categories')
              setView('library')
            } },
            { mark: '誉', title: 'Achievements', detail: 'Milestones.', accent: 'amber', onClick: () => setView('achievements') },
            { mark: '編', title: 'Content Studio', detail: 'Custom content.', accent: 'gold', onClick: () => setView('content-studio') },
            { mark: '験', title: 'Sentence Testing', detail: 'Generator checks.', accent: 'kyogre', onClick: () => setView('sentence-testing') },
            { mark: '声', title: 'Voice Test', detail: 'Audio checks.', accent: 'sakura', onClick: () => setView('voice-test') },
            /* Copies to redesign in. Changes here reach nothing people study with. */
            { mark: '文', title: 'Sentences (lab)', detail: 'Draft tool.', accent: 'rayquaza', onClick: () => startSentenceMode('additional-tools', true) },
            { mark: '文法', title: 'Grammar (lab)', detail: 'Draft tool.', accent: 'amber', onClick: () => setView('grammar-lab') },
          ]}
        />
      </div>,
    )
  }

  if (view === 'grammar-lab') {
    return withMobileNav(
      <div className="app tool-lab">
        <Suspense fallback={<RouteLoading label="Grammar (lab)" />}>
          <GrammarPracticeLab
            onBack={() => setView('additional-tools')}
            onDashboard={() => setView('dashboard')}
            furiganaDefault={furiganaOn}
            isFavorite={(exercise) => isDrillExerciseFavorite(favoriteSentences, exercise)}
            onToggleFavorite={toggleDrillFavorite}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'quest-scene') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Quest Scene" />}>
          <QuestScene
            questId={activeQuestId}
            onBack={() => setView('home')}
            onDashboard={() => setView('dashboard')}
            onContinue={(furiganaFree) => {
              if (activeQuestId) setAchievementMetrics((current) => recordQuestScene(current, activeQuestId, furiganaFree))
              finishQuestStep('scene')
              setView('quest-checkpoint')
            }}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'quest-checkpoint') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Quest Checkpoint" />}>
          <QuestCheckpoint
            questId={activeQuestId}
            onBack={() => setView('home')}
            onComplete={() => {
              if (activeQuestId) setQuestProgress((current) => completeQuest(current, activeQuestId))
              setView('home')
            }}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'sentence-testing') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Sentence Testing" />}>
          <SentenceTesting onBack={() => setView('dashboard')} />
        </Suspense>
      </div>,
    )
  }

  if (view === 'voice-test') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Voice Test" />}>
          <VoiceTest onBack={() => setView('additional-tools')} />
        </Suspense>
      </div>,
    )
  }

  if (view === 'grammar') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Grammar" />}>
          <GrammarPractice
            onBack={() => setView(practiceReturnView)}
            onDashboard={() => setView('dashboard')}
            furiganaDefault={furiganaOn}
            isFavorite={(exercise) => isDrillExerciseFavorite(favoriteSentences, exercise)}
            onToggleFavorite={toggleDrillFavorite}
            questId={activeQuestId}
            onQuestComplete={activeQuestId ? () => {
              finishQuestStep('grammar')
              setView('quest-scene')
            } : undefined}
          />
        </Suspense>
      </div>,
    )
  }

  if (view === 'study-loading') {
    return withMobileNav(
      <div className="app">
        <RouteLoading label="Sentence Practice" />
      </div>,
    )
  }

  if (view === 'complete') {
    return withMobileNav(
      <div className="app">
        <SessionComplete
          reviewed={session.length}
          correct={sessionCorrect}
          onHome={() => setView(exitView === 'study' ? 'dashboard' : exitView)}
        />
      </div>,
    )
  }

  const item = session[currentIndex]
  if (view === 'study' && item) {
    if (item.kind === 'sentence-builder') {
      const Builder = sentenceLab ? SentenceBuilderLab : SentenceBuilderView
      return withMobileNav(
        <div className={sentenceLab ? 'app tool-lab' : 'app'}>
          <Suspense fallback={<RouteLoading label={sentenceLab ? 'Sentence Builder (lab)' : 'Sentence Builder'} />}>
            <Builder
              key={item.exercise.id}
              exercise={item.exercise}
              current={currentIndex}
              total={session.length}
              onResult={handleSentenceResult}
              onPrevious={goToPreviousSentence}
              onSkip={advanceOrComplete}
              onExit={() => setView(exitView)}
              onDashboard={() => setView('dashboard')}
              selectedLevels={builderLevels}
              enabledLevels={GENERATION_COMPLEXITIES}
              onApplyLevels={applyBuilderLevels}
              infiniteMode={infiniteBuilderMode}
              onToggleInfiniteMode={() => setInfiniteBuilderMode((enabled) => !enabled)}
              isFavorite={isExerciseFavorite(favoriteSentences, item.exercise)}
              onToggleFavorite={() => toggleFavoriteSentence(item.exercise)}
              furiganaDefault={furiganaOn}
            />
          </Suspense>
        </div>,
      )
    }

    return null
  }

  return withMobileNav(
    <div className="app">
      <Dashboard
        learnedCount={learnedCount}
        totalCards={CARD_TOTAL}
        onOpenFavoriteWords={() => setView('favorite-words')}
        onOpenAchievements={() => setView('achievements')}
        wrongPool={wrongPool}
        progress={progress}
        furiganaOn={furiganaOn}
        englishOn={englishOn}
        speechOn={speechOn}
        onToggleFurigana={() => setFuriganaOn((value) => !value)}
        onToggleEnglish={() => setEnglishOn((value) => !value)}
        onToggleSpeech={() => setSpeechOn((value) => !value)}
        settingsExpanded={settingsExpanded}
        onCloseSettings={() => setSettingsExpanded(false)}
        complexity={complexity}
        onComplexityChange={setComplexity}
      />
    </div>,
  )
}

type ToolMenuAccent = 'sakura' | 'rayquaza' | 'gold' | 'kyogre' | 'amber' | 'sumi'

type ToolMenuItem = {
  mark: string
  title: string
  detail: string
  onClick: () => void
  accent: ToolMenuAccent
}

function ToolMenuPage({
  title,
  eyebrow,
  description,
  tools,
  footerAction,
}: {
  title: string
  eyebrow?: string
  description?: string
  tools: ToolMenuItem[]
  footerAction?: {
    prompt: string
    label: string
    onClick: () => void
  }
}) {
  return (
    <main className="tool-menu-page">
      <section className="tool-menu-heading">
        {eyebrow && <small>{eyebrow}</small>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </section>
      <div className="tool-menu-grid">
        {tools.map((tool) => (
          <button key={tool.title} type="button" className={`tool-menu-card tool-menu-card--${tool.accent}`} onClick={tool.onClick}>
            <span className="tool-menu-mark" aria-hidden="true">{tool.mark}</span>
            <span>
              <b>{tool.title}</b>
              <small>{tool.detail}</small>
            </span>
          </button>
        ))}
      </div>
      {footerAction && (
        <div className="tool-menu-footer">
          <span>{footerAction.prompt}</span>
          <button type="button" onClick={footerAction.onClick}>
            {footerAction.label}
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      )}
    </main>
  )
}

function RouteLoading({ label }: { label: string }) {
  return (
    <div className="practice-loading" role="status" aria-live="polite">
      <section className="practice-loading-card">
        <span className="practice-loading-mark">学</span>
        <h1>{label}</h1>
        <p>Loading</p>
      </section>
    </div>
  )
}

export default App
