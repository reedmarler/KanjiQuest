import { lazy, Suspense, useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { CARD_TOTAL } from './data/cardStats'
import { GENERATION_COMPLEXITIES } from './lib/generationComplexity'
import { isLearned } from './lib/srs'
import { loadProgress } from './lib/storage'
import { completeQuestStep, loadQuestProgress, type QuestStep } from './lib/questProgress'
import { loadAchievementMetrics, recordBossBattle, recordQuestScene } from './lib/achievementProgress'
import { getQuestById } from './data/questCampaign'
import { buildRelicLoadout } from './lib/relics'
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
import { Dashboard } from './components/Dashboard'
import { AppBackButton } from './components/AppBackButton'
import { SessionComplete } from './components/SessionComplete'
import type { LibraryTab } from './components/LibraryPanel'
import type { BeginnerScript } from './data/beginnerMnemonics'
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
  | 'beginner-learner'
  | 'beginner-speed-run'
  | 'picture-practice'
  | 'grammar-lab'

type SessionItem =
  | { kind: 'sentence-builder'; exercise: SentenceExercise }

function App() {
  const [view, setView] = useState<View>('dashboard')
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
  const [shrineRegionId, setShrineRegionId] = useState('tsuzuri')
  const [speedRunReturnView, setSpeedRunReturnView] = useState<'dashboard' | 'beginner-zone' | 'study-tools'>('dashboard')
  const [pictureReturnView, setPictureReturnView] = useState<'dashboard' | 'beginner-zone' | 'study-tools'>('dashboard')
  /*
   * Whether the sentence session on screen is the lab copy. The lab runs on
   * the same session machinery as the real builder — same exercises, same
   * navigation — so what it is testing is the screen, not a second pipeline
   * behind it.
   */
  const [sentenceLab, setSentenceLab] = useState(false)

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

  if (view === 'library') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Study Library" />}>
          <LibraryPanel
            initialTab={libraryTab}
            onBack={() => setView('dashboard')}
          />
        </Suspense>
      </div>
    )
  }

  if (view === 'kanji') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Kanji Lab" />}>
          <KanjiLab
            questId={activeQuestId}
            onBack={() => setView(practiceReturnView)}
            onDashboard={() => setView('dashboard')}
            onQuestComplete={activeQuestId
              ? () => {
                  finishQuestStep('kanji')
                  setPracticeReturnView('quests')
                  setView('grammar')
                }
              : undefined}
          />
        </Suspense>
      </div>
    )
  }

  if (view === 'vocab-practice') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Vocab" />}>
          <FocusedVocabPractice
            initialTopicId={questVocabTopicId}
            questTitle={activeQuest?.title}
            onBack={() => setView(practiceReturnView)}
            onDashboard={() => setView('dashboard')}
            onQuestComplete={activeQuestId && questVocabTopicId
              ? () => {
                  finishQuestStep('vocab')
                  setPracticeReturnView('quests')
                  setView('kanji')
                }
              : undefined}
          />
        </Suspense>
      </div>
    )
  }

  if (view === 'counter-practice') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Counters" />}>
          <CounterPractice onBack={() => setView('study-tools')} onDashboard={() => setView('dashboard')} />
        </Suspense>
      </div>
    )
  }

  if (view === 'content-studio') {
    return (
      <Suspense fallback={<RouteLoading label="Content Studio" />}>
        <ContentStudio onBack={() => setView('dashboard')} />
      </Suspense>
    )
  }

  if (view === 'ink-road') {
    return (
      <div className="app ink-road-page">
        <Suspense fallback={<RouteLoading label="The Ink Road" />}>
          <MapView
            onBack={() => setView('quests')}
            onStudy={() => setView('beginner-zone')}
            onShrine={(regionId) => { setShrineRegionId(regionId); setView('shrine-trial') }}
          />
        </Suspense>
      </div>
    )
  }

  if (view === 'shrine-trial') {
    return (
      <div className="app ink-road-page">
        <Suspense fallback={<RouteLoading label="The Shrine" />}>
          <ShrineTrial
            regionId={shrineRegionId}
            onBack={() => setView('ink-road')}
            onDone={() => setView('ink-road')}
          />
        </Suspense>
      </div>
    )
  }

  if (view === 'quests') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Quests" />}>
          <QuestHub
            onBack={() => setView('dashboard')}
            onOpenInkRoad={() => setView('ink-road')}
            progress={questProgress}
            onOpenVocab={(topicId, questId) => {
              setQuestVocabTopicId(topicId)
              setActiveQuestId(questId)
              setPracticeReturnView('quests')
              setView('vocab-practice')
            }}
            onOpenKanji={(questId) => {
              setActiveQuestId(questId)
              setPracticeReturnView('quests')
              setView('kanji')
            }}
            onOpenGrammar={(questId) => {
              setActiveQuestId(questId)
              setPracticeReturnView('quests')
              setView('grammar')
            }}
            onOpenScene={(questId) => {
              setActiveQuestId(questId)
              setView('quest-scene')
            }}
            onOpenCheckpoint={(questId) => {
              setActiveQuestId(questId)
              setView('quest-checkpoint')
            }}
          />
        </Suspense>
      </div>
    )
  }

  if (view === 'achievements') {
    return (
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
      </div>
    )
  }

  if (view === 'study-tools') {
    return (
      <div className="app study-tools-page">
        <ToolMenuPage
          title="Study tools"
          eyebrow="STUDY MODES"
          description="Choose a focused drill."
          onBack={() => setView('dashboard')}
          tools={[
            { mark: '漢', title: 'Kanji', detail: 'Study kanji readings and forms.', accent: 'kyogre', onClick: () => {
              setActiveQuestId(undefined)
              setPracticeReturnView('study-tools')
              setView('kanji')
            } },
            { mark: '語彙', title: 'Vocab', detail: 'Drill focused word groups.', accent: 'gold', onClick: () => {
              setQuestVocabTopicId(undefined)
              setActiveQuestId(undefined)
              setPracticeReturnView('study-tools')
              setView('vocab-practice')
            } },
            { mark: '数', title: 'Numbers', detail: 'Drill counting words and counters.', accent: 'amber', onClick: () => {
              setActiveQuestId(undefined)
              setPracticeReturnView('study-tools')
              setView('counter-practice')
            } },
            { mark: '⚡', title: 'Speed Run', detail: 'A kana flashes, then vanishes — name it before it fades.', accent: 'rayquaza', onClick: () => {
              setSpeedRunReturnView('study-tools')
              setView('beginner-speed-run')
            } },
            { mark: '絵', title: 'Picture Mode', detail: 'Match a picture to the word that names it.', accent: 'sakura', onClick: () => {
              setPictureReturnView('study-tools')
              setView('picture-practice')
            } },
            { mark: '文', title: 'Sentences', detail: 'Build Japanese sentence order.', accent: 'sakura', onClick: () => startSentenceMode('study-tools') },
            { mark: '文法', title: 'Grammar', detail: 'Practice patterns and particles.', accent: 'rayquaza', onClick: () => {
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
      </div>
    )
  }

  if (view === 'beginner-zone') {
    return (
      <div className="app beginner-zone-page">
        <ToolMenuPage
          title="Beginner Zone"
          description="Learn Japanese through memorable character pictures."
          onBack={() => setView('dashboard')}
          tools={[
            { mark: 'あ', title: 'Hiragana', detail: 'Learn the 46 rounded characters.', accent: 'sakura', onClick: () => {
              setBeginnerScript('hiragana')
              setBeginnerInitialRowIndex(0)
              setBeginnerInitialCharIndex(0)
              setView('beginner-learner')
            } },
            { mark: 'ア', title: 'Katakana', detail: 'Learn the script used for foreign words.', accent: 'kyogre', onClick: () => {
              setBeginnerScript('katakana')
              setBeginnerInitialRowIndex(0)
              setBeginnerInitialCharIndex(0)
              setView('beginner-learner')
            } },
            { mark: '一', title: 'First Kanji', detail: 'Learn 30 memorable starter kanji.', accent: 'gold', onClick: () => {
              setBeginnerScript('kanji')
              setBeginnerInitialRowIndex(0)
              setBeginnerInitialCharIndex(0)
              setView('beginner-learner')
            } },
            { mark: '表', title: 'Hiragana Chart', detail: 'See every row at a glance, jump straight to one.', accent: 'sakura', onClick: () => setView('hiragana-chart') },
            { mark: '表', title: 'Katakana Chart', detail: 'See every row at a glance, jump straight to one.', accent: 'kyogre', onClick: () => setView('katakana-chart') },
            { mark: '絵', title: 'Picture Mode', detail: 'Match a picture to the word that names it.', accent: 'rayquaza', onClick: () => {
              setPictureReturnView('beginner-zone')
              setView('picture-practice')
            } },
          ]}
          footerAction={{
            prompt: 'Too easy?',
            label: 'Check out Study Tools',
            onClick: () => setView('study-tools'),
          }}
        />
      </div>
    )
  }

  if (view === 'hiragana-chart' || view === 'katakana-chart') {
    const chartScript = view === 'hiragana-chart' ? 'hiragana' : 'katakana'
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label={view === 'hiragana-chart' ? 'Hiragana Chart' : 'Katakana Chart'} />}>
          <KanaChart
            script={chartScript}
            onBack={() => setView('beginner-zone')}
            onSelectCharacter={(rowIndex, charIndex) => {
              setBeginnerScript(chartScript)
              setBeginnerInitialRowIndex(rowIndex)
              setBeginnerInitialCharIndex(charIndex)
              setView('beginner-learner')
            }}
          />
        </Suspense>
      </div>
    )
  }

  if (view === 'beginner-learner') {
    // Only hiragana and katakana have a chart to return to.
    const chartView = beginnerScript === 'hiragana' ? 'hiragana-chart' : beginnerScript === 'katakana' ? 'katakana-chart' : null
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Beginner Zone" />}>
          <BeginnerLearner
            script={beginnerScript}
            initialRowIndex={beginnerInitialRowIndex}
            initialCharIndex={beginnerInitialCharIndex}
            onBack={() => setView('beginner-zone')}
            onOpenChart={chartView ? () => setView(chartView) : undefined}
          />
        </Suspense>
      </div>
    )
  }

  if (view === 'beginner-speed-run') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Speed Run" />}>
          <BeginnerSpeedRun onBack={() => setView(speedRunReturnView)} onDashboard={() => setView('dashboard')} />
        </Suspense>
      </div>
    )
  }

  if (view === 'picture-practice') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Picture Mode" />}>
          <PicturePractice onBack={() => setView(pictureReturnView)} onDashboard={() => setView('dashboard')} />
        </Suspense>
      </div>
    )
  }

  if (view === 'favorite-words') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Favorite Words" />}>
          <FavoriteWordsPage onBack={() => setView('dashboard')} />
        </Suspense>
      </div>
    )
  }

  if (view === 'additional-tools') {
    return (
      <div className="app additional-tools-page">
        <ToolMenuPage
          title="Additional"
          eyebrow="STUDY LIBRARY"
          description="Manage saved content and practice tools."
          onBack={() => setView('dashboard')}
          tools={[
            { mark: '語', title: 'Vocab List', detail: 'Browse every word by level.', accent: 'sakura', onClick: () => {
              setLibraryTab('vocab')
              setView('library')
            } },
            { mark: '動', title: 'Word Categories', detail: 'Browse verbs, adjectives, nouns, and more.', accent: 'rayquaza', onClick: () => {
              setLibraryTab('categories')
              setView('library')
            } },
            { mark: '誉', title: 'Achievements', detail: 'Every quest, story, and hard-won reading.', accent: 'amber', onClick: () => setView('achievements') },
            { mark: '編', title: 'Content Studio', detail: 'Add and organize your own content.', accent: 'gold', onClick: () => setView('content-studio') },
            { mark: '験', title: 'Sentence Testing', detail: 'Generate sentences by complexity level.', accent: 'kyogre', onClick: () => setView('sentence-testing') },
            { mark: '声', title: 'Voice Test', detail: 'Compare provider voices before building audio.', accent: 'sakura', onClick: () => setView('voice-test') },
            /* Copies to redesign in. Changes here reach nothing people study with. */
            { mark: '文', title: 'Sentences (lab)', detail: 'A copy of the sentence builder to rework.', accent: 'rayquaza', onClick: () => startSentenceMode('additional-tools', true) },
            { mark: '文法', title: 'Grammar (lab)', detail: 'A copy of grammar practice to rework.', accent: 'amber', onClick: () => setView('grammar-lab') },
          ]}
        />
      </div>
    )
  }

  if (view === 'grammar-lab') {
    return (
      <div className="app tool-lab">
        <Suspense fallback={<RouteLoading label="Grammar (lab)" />}>
          <GrammarPracticeLab
            onBack={() => setView('additional-tools')}
            onDashboard={() => setView('dashboard')}
            isFavorite={(exercise) => isDrillExerciseFavorite(favoriteSentences, exercise)}
            onToggleFavorite={toggleDrillFavorite}
          />
        </Suspense>
      </div>
    )
  }

  if (view === 'quest-scene') {
    return (
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
      </div>
    )
  }

  if (view === 'quest-checkpoint') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Quest Checkpoint" />}>
          <QuestCheckpoint
            questId={activeQuestId}
            onBack={() => setView('quests')}
            onDashboard={() => setView('dashboard')}
            loadout={buildRelicLoadout(questProgress)}
            onBattleResult={({ won, perfect }) => {
              if (activeQuestId) setAchievementMetrics((current) => recordBossBattle(current, activeQuestId, won, perfect))
            }}
            onComplete={() => {
              finishQuestStep('checkpoint')
              setView('quests')
            }}
          />
        </Suspense>
      </div>
    )
  }

  if (view === 'sentence-testing') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Sentence Testing" />}>
          <SentenceTesting onBack={() => setView('dashboard')} />
        </Suspense>
      </div>
    )
  }

  if (view === 'voice-test') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Voice Test" />}>
          <VoiceTest onBack={() => setView('additional-tools')} />
        </Suspense>
      </div>
    )
  }

  if (view === 'grammar') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Grammar" />}>
          <GrammarPractice
            onBack={() => setView(practiceReturnView)}
            onDashboard={() => setView('dashboard')}
            isFavorite={(exercise) => isDrillExerciseFavorite(favoriteSentences, exercise)}
            onToggleFavorite={toggleDrillFavorite}
            questId={activeQuestId}
            onQuestComplete={activeQuestId ? () => {
              finishQuestStep('grammar')
              setView('quest-scene')
            } : undefined}
          />
        </Suspense>
      </div>
    )
  }

  if (view === 'study-loading') {
    return (
      <div className="app">
        <RouteLoading label="Sentence Practice" />
      </div>
    )
  }

  if (view === 'complete') {
    return (
      <div className="app">
        <SessionComplete
          reviewed={session.length}
          correct={sessionCorrect}
          onHome={() => setView(exitView === 'study' ? 'dashboard' : exitView)}
        />
      </div>
    )
  }

  const item = session[currentIndex]
  if (view === 'study' && item) {
    if (item.kind === 'sentence-builder') {
      const Builder = sentenceLab ? SentenceBuilderLab : SentenceBuilderView
      return (
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
            />
          </Suspense>
        </div>
      )
    }

    return null
  }

  return (
    <div className="app">
      <Dashboard
        learnedCount={learnedCount}
        totalCards={CARD_TOTAL}
        onOpenQuests={() => setView('quests')}
        onOpenBeginnerZone={() => setView('beginner-zone')}
        onOpenAdditionalTools={() => setView('additional-tools')}
        onOpenStudyTools={() => setView('study-tools')}
        onOpenPicturePractice={() => {
          setPictureReturnView('dashboard')
          setView('picture-practice')
        }}
        onOpenSpeedRun={() => {
          setSpeedRunReturnView('dashboard')
          setView('beginner-speed-run')
        }}
        onOpenFavoriteWords={() => setView('favorite-words')}
        questProgress={questProgress}
        wrongPool={wrongPool}
        progress={progress}
      />
    </div>
  )
}

type ToolMenuAccent = 'sakura' | 'rayquaza' | 'gold' | 'kyogre' | 'amber'

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
  onBack,
  footerAction,
}: {
  title: string
  eyebrow?: string
  description: string
  tools: ToolMenuItem[]
  onBack: () => void
  footerAction?: {
    prompt: string
    label: string
    onClick: () => void
  }
}) {
  return (
    <main className="tool-menu-page">
      <AppBackButton onClick={onBack} />
      <section className="tool-menu-heading">
        {eyebrow && <small>{eyebrow}</small>}
        <h1>{title}</h1>
        <p>{description}</p>
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
