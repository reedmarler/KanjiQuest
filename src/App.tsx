import { Children, cloneElement, isValidElement, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from 'react'
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
import { displayProfilePhoto, useUserProfile } from './lib/userProfile'
import { stopSpeaking } from './lib/speech'
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
const QuestHub = lazy(() => import('./components/QuestHub').then((module) => ({ default: module.QuestHub })))
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
  | 'quests'
  | 'ink-road'
  | 'shrine-trial'
  | 'quest-scene'
  | 'quest-checkpoint'
  | 'achievements'
  | 'study-tools'
  | 'additional-tools'
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

type PrimaryNavTab = 'home' | 'quest' | 'study' | 'beginner' | 'more'

/** The five primary tabs, in bottom-nav order, for left/right swipe navigation. */
const HUB_TABS: readonly View[] = ['dashboard', 'quests', 'study-tools', 'beginner-zone', 'additional-tools']

function primaryNavTabForView(view: View): PrimaryNavTab {
  if (view === 'dashboard' || view === 'profile' || view === 'settings' || view === 'daily-goals' || view === 'backup-sync') return 'home'
  if (view === 'quests' || view === 'ink-road' || view === 'shrine-trial' || view === 'quest-scene' || view === 'quest-checkpoint') return 'quest'
  if (view === 'study-tools' || view === 'kanji' || view === 'vocab-practice' || view === 'counter-practice' || view === 'grammar' || view === 'study' || view === 'study-loading' || view === 'complete') return 'study'
  if (view === 'beginner-zone' || view === 'hiragana-chart' || view === 'katakana-chart' || view === 'hiragana-quiz' || view === 'katakana-quiz' || view === 'beginner-learner' || view === 'beginner-speed-run' || view === 'picture-practice') return 'beginner'
  return 'more'
}

function MobileBottomNav({
  currentView,
  onHome,
  onQuests,
  onStudy,
  onBeginner,
  onMore,
}: {
  currentView: View
  onHome: () => void
  onQuests: () => void
  onStudy: () => void
  onBeginner: () => void
  onMore: () => void
}) {
  const activeTab = primaryNavTabForView(currentView)
  const items: Array<{ tab: PrimaryNavTab; label: string; mark: string; onClick: () => void }> = [
    { tab: 'home', label: 'Home', mark: '家', onClick: onHome },
    { tab: 'quest', label: 'Quest', mark: '旅', onClick: onQuests },
    { tab: 'study', label: 'Study', mark: '学', onClick: onStudy },
    { tab: 'beginner', label: 'Beginner', mark: 'あ', onClick: onBeginner },
    { tab: 'more', label: 'More', mark: '他', onClick: onMore },
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
  onOpenChart: (script: Extract<BeginnerScript, 'hiragana' | 'katakana'>) => void
  onOpenQuiz: (script: Extract<BeginnerScript, 'hiragana' | 'katakana'>) => void
  onOpenKana: (script: Extract<BeginnerScript, 'hiragana' | 'katakana'>, rowIndex: number, charIndex: number) => void
  onOpenKanji: () => void
  onOpenPictures: () => void
  onOpenSpeedRun: () => void
}

const BEGINNER_ZONE_VOWEL_ROWS: Record<string, number> = { a: 0, i: 1, u: 2, e: 3, o: 4 }
const BEGINNER_ZONE_ROW_OVERRIDES: Record<string, number> = { を: 2, ヲ: 2, ん: 4, ン: 4 }

function getBeginnerZoneVowelIndex(char: string, romaji: string): number {
  return BEGINNER_ZONE_ROW_OVERRIDES[char]
    ?? BEGINNER_ZONE_VOWEL_ROWS[romaji.charAt(romaji.length - 1)]
    ?? 4
}

type BeginnerZoneWheelScript = {
  id: Extract<BeginnerScript, 'hiragana' | 'katakana'>
  tone: 'pink' | 'blue'
  mark: string
  label: string
  /** Degrees clockwise from the top of the wheel, at rest (wheelAngle 0). */
  baseAngle: number
}

// The two scripts sit opposite each other on the wheel (180deg apart) so a
// half turn always swaps which one is down at the selection slot.
const BEGINNER_ZONE_WHEEL_SCRIPTS: BeginnerZoneWheelScript[] = [
  { id: 'hiragana', tone: 'pink', mark: 'あ', label: 'Hiragana', baseAngle: 90 },
  { id: 'katakana', tone: 'blue', mark: 'ア', label: 'Katakana', baseAngle: 270 },
]

const BEGINNER_ZONE_WHEEL_RADIUS = 37
/** wheelAngle values where a script sits exactly at the bottom (180deg) selection slot. */
const BEGINNER_ZONE_WHEEL_SNAP_ANGLES: Record<Extract<BeginnerScript, 'hiragana' | 'katakana'>, number> = {
  hiragana: 90,
  katakana: 270,
}

function beginnerZoneWheelPoint(angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: 50 + BEGINNER_ZONE_WHEEL_RADIUS * Math.sin(rad),
    y: 50 - BEGINNER_ZONE_WHEEL_RADIUS * Math.cos(rad),
  }
}

function beginnerZoneAngularDistanceTo180(angleDeg: number): number {
  const diff = Math.abs(angleDeg - 180)
  return Math.min(diff, 360 - diff)
}

function beginnerZoneNearestSnapAngle(angleDeg: number): number {
  const normalized = ((angleDeg % 360) + 360) % 360
  const distTo90 = Math.min(Math.abs(normalized - 90), 360 - Math.abs(normalized - 90))
  const distTo270 = Math.min(Math.abs(normalized - 270), 360 - Math.abs(normalized - 270))
  return distTo90 <= distTo270 ? 90 : 270
}

function BeginnerZone({
  onOpenChart,
  onOpenQuiz,
  onOpenKana,
  onOpenKanji,
  onOpenPictures,
  onOpenSpeedRun,
}: BeginnerZoneProps) {
  const [page, setPage] = useState<'guide' | 'resources'>('guide')
  const [script, setScript] = useState<Extract<BeginnerScript, 'hiragana' | 'katakana'>>('hiragana')
  const [wheelAngle, setWheelAngle] = useState(BEGINNER_ZONE_WHEEL_SNAP_ANGLES.hiragana)
  const [isWheelDragging, setIsWheelDragging] = useState(false)
  const wheelRef = useRef<HTMLDivElement>(null)
  const wheelDragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startPointerAngle: number
    startWheelAngle: number
    captured: boolean
  } | null>(null)
  const chartScrollRef = useRef<HTMLDivElement>(null)
  const deck = getBeginnerDeck(script)
  const columns = deck.rows.map((row, rowIndex) => ({ row, rowIndex })).reverse()
  const vowels = ['a', 'i', 'u', 'e', 'o']
  const actions = [
    { mark: '聞', label: 'Quiz', tone: 'green', onClick: () => onOpenQuiz('hiragana') },
    { mark: '書', label: 'Quiz', tone: 'amber', onClick: () => onOpenQuiz('katakana') },
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
  }, [page, script])

  function wheelPointerAngle(clientX: number, clientY: number): number {
    const wheel = wheelRef.current
    if (!wheel) return 0
    const rect = wheel.getBoundingClientRect()
    const dx = clientX - (rect.left + rect.width / 2)
    const dy = clientY - (rect.top + rect.height / 2)
    return (Math.atan2(dx, -dy) * 180) / Math.PI
  }

  function handleWheelPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Capture is deferred to the first real move (see handleWheelPointerMove)
    // rather than grabbed here — capturing immediately retargets the
    // pointer's click away from whichever marker button was tapped, which
    // would silently break "tap a marker to select it."
    wheelDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPointerAngle: wheelPointerAngle(event.clientX, event.clientY),
      startWheelAngle: wheelAngle,
      captured: false,
    }
  }

  function handleWheelPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = wheelDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.captured) {
      const movedDistance = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY)
      if (movedDistance < 4) return
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.captured = true
      setIsWheelDragging(true)
    }
    const currentPointerAngle = wheelPointerAngle(event.clientX, event.clientY)
    setWheelAngle(drag.startWheelAngle + (currentPointerAngle - drag.startPointerAngle))
  }

  function handleWheelPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = wheelDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    wheelDragRef.current = null
    if (!drag.captured) return
    setIsWheelDragging(false)
    setWheelAngle((current) => beginnerZoneNearestSnapAngle(current))
  }

  if (page === 'guide') {
    const wheelNormalizedAngle = ((wheelAngle % 360) + 360) % 360
    const wheelScripts = BEGINNER_ZONE_WHEEL_SCRIPTS.map((item) => ({
      ...item,
      angle: (item.baseAngle + wheelNormalizedAngle) % 360,
    }))
    const wheelSelectedScript = wheelScripts.reduce((closest, item) =>
      beginnerZoneAngularDistanceTo180(item.angle) < beginnerZoneAngularDistanceTo180(closest.angle) ? item : closest
    ).id

    return (
      <main className="beginner-zone beginner-zone--intro">
        <button type="button" className="beginner-zone-wheel-kanji" onClick={onOpenKanji}>
          <span className="beginner-zone-wheel-mark" aria-hidden="true" lang="ja">字</span>
          <b>Kanji</b>
        </button>

        <div className="beginner-zone-wheel-area">
          <div
            ref={wheelRef}
            className={`beginner-zone-wheel${isWheelDragging ? ' is-dragging' : ''}`}
            onPointerDown={handleWheelPointerDown}
            onPointerMove={handleWheelPointerMove}
            onPointerUp={handleWheelPointerUp}
            onPointerCancel={handleWheelPointerUp}
          >
            <svg className="beginner-zone-wheel-ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r={BEGINNER_ZONE_WHEEL_RADIUS} />
            </svg>
            {wheelScripts.map((item) => {
              const point = beginnerZoneWheelPoint(item.angle)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`beginner-zone-wheel-node is-${item.tone}${item.id === wheelSelectedScript ? ' is-selected' : ''}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  onClick={() => setWheelAngle(BEGINNER_ZONE_WHEEL_SNAP_ANGLES[item.id])}
                  aria-pressed={item.id === wheelSelectedScript}
                >
                  <span className="beginner-zone-wheel-mark" aria-hidden="true" lang="ja">{item.mark}</span>
                  <b>{item.label}</b>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="beginner-zone-wheel-go"
            onClick={() => {
              setScript(wheelSelectedScript)
              setPage('resources')
            }}
          >
            Go
            <span aria-hidden="true">&#8594;</span>
          </button>
        </div>
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
        <button type="button" onClick={() => setPage('guide')}>
          <span aria-hidden="true">&#8592;</span>
          Guide
        </button>
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
            onClick={() => onOpenChart(script)}
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
                      onClick={() => onOpenKana(script, rowIndex, characterIndex)}
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
  onHome,
  onQuests,
  onStudy,
  onBeginner,
  onMore,
}: {
  currentView: View
  hideUser: boolean
  profileOpen: boolean
  settingsOpen: boolean
  profileName: string
  profilePhoto: string | null
  onProfile: () => void
  onSettings: () => void
  onHome: () => void
  onQuests: () => void
  onStudy: () => void
  onBeginner: () => void
  onMore: () => void
}) {
  const activeTab = primaryNavTabForView(currentView)
  const items: Array<{ tab: PrimaryNavTab; label: string; mark: string; onClick: () => void }> = [
    { tab: 'home', label: 'Home', mark: '家', onClick: onHome },
    { tab: 'quest', label: 'Quest', mark: '旅', onClick: onQuests },
    { tab: 'study', label: 'Study', mark: '学', onClick: onStudy },
    { tab: 'beginner', label: 'Beginner', mark: 'あ', onClick: onBeginner },
    { tab: 'more', label: 'More', mark: '他', onClick: onMore },
  ]

  return (
    <div className="desktop-primary-nav-bar">
      <nav className="desktop-primary-nav" aria-label="Primary">
        <button
          type="button"
          className={`desktop-primary-nav-user${profileOpen ? ' is-active' : ''}${hideUser ? ' is-hidden' : ''}`}
          onClick={onProfile}
          aria-label="Open user menu"
          aria-expanded={profileOpen}
          aria-controls="dashboard-profile-menu"
          title="User menu"
          tabIndex={hideUser ? -1 : undefined}
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
          className={`desktop-primary-nav-settings${settingsOpen ? ' is-active' : ''}`}
          onClick={onSettings}
          aria-label={settingsOpen ? 'Hide settings' : 'Show settings'}
          aria-expanded={settingsOpen}
          title={settingsOpen ? 'Hide settings' : 'Show settings'}
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

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [questLandingResetToken, setQuestLandingResetToken] = useState(0)
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
  const [pictureReturnView, setPictureReturnView] = useState<'dashboard' | 'beginner-zone' | 'study-tools' | 'quests'>('dashboard')
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

  const goToQuests = useCallback(() => {
    if (view === 'quests') {
      setQuestLandingResetToken((token) => token + 1)
    }
    goToView('quests')
  }, [goToView, view])

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
    setView('quests')
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

  const openContinueStudy = () => {
    setView('quests')
  }

  const showHubChrome = view === 'dashboard'
    || view === 'quests'
    || view === 'study-tools'
    || view === 'beginner-zone'
    || view === 'additional-tools'

  // Swipe left/right across a hub screen to move to the next / previous tab,
  // the same order the bottom nav is in. Deeper screens keep the axis free.
  useSwipeNav(showHubChrome && !profileMenuOpen && !settingsExpanded, (direction) => {
    const index = HUB_TABS.indexOf(view)
    const next = index + direction
    if (index < 0 || next < 0 || next >= HUB_TABS.length) return
    goToView(HUB_TABS[next]!)
  })
  const hubChrome = showHubChrome
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
      onHome={() => goToView('dashboard')}
      onQuests={goToQuests}
      onStudy={() => goToView('study-tools')}
      onBeginner={() => goToView('beginner-zone')}
      onMore={() => goToView('additional-tools')}
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
      onHome={() => goToView('dashboard')}
      onQuests={goToQuests}
      onStudy={() => goToView('study-tools')}
      onBeginner={() => goToView('beginner-zone')}
      onMore={() => goToView('additional-tools')}
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
      onOpenQuests={() => goToView('quests')}
      onOpenAchievements={() => goToView('achievements')}
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
                  setPracticeReturnView('quests')
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
                  setPracticeReturnView('quests')
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
            onBack={() => setView('quests')}
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

  if (view === 'quests') {
    return withMobileNav(
      <div className="app">
        <Suspense fallback={<RouteLoading label="Quests" />}>
          <QuestHub
            key={questLandingResetToken}
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
            onBack={() => setView('quests')}
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
            onBack={() => setView('quests')}
            onComplete={() => {
              if (activeQuestId) setQuestProgress((current) => completeQuest(current, activeQuestId))
              setView('quests')
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
        onContinueStudy={openContinueStudy}
        onOpenQuests={() => setView('quests')}
        onOpenStudyTools={() => setView('study-tools')}
        onOpenFavoriteWords={() => setView('favorite-words')}
        onOpenAchievements={() => setView('achievements')}
        questProgress={questProgress}
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
