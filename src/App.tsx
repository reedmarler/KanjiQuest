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
const QuestScene = lazy(() => import('./components/QuestScene').then((module) => ({ default: module.QuestScene })))
const QuestCheckpoint = lazy(() => import('./components/QuestCheckpoint').then((module) => ({ default: module.QuestCheckpoint })))
const FavoriteWordsPage = lazy(() => import('./components/FavoriteWordsPage').then((module) => ({ default: module.FavoriteWordsPage })))
const AchievementsPanel = lazy(() => import('./components/AchievementsPanel').then((module) => ({ default: module.AchievementsPanel })))
const BeginnerLearner = lazy(() => import('./components/BeginnerLearner').then((module) => ({ default: module.BeginnerLearner })))
const BeginnerSpeedRun = lazy(() => import('./components/BeginnerSpeedRun').then((module) => ({ default: module.BeginnerSpeedRun })))

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
  | 'quest-scene'
  | 'quest-checkpoint'
  | 'achievements'
  | 'study-tools'
  | 'additional-tools'
  | 'favorite-words'
  | 'beginner-zone'
  | 'beginner-learner'
  | 'beginner-speed-run'

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

  const startSentenceMode = useCallback((returnTo: View = 'dashboard') => {
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
            onBack={() => setView('dashboard')}
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
          <CounterPractice onBack={() => setView('study-tools')} />
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

  if (view === 'quests') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Quests" />}>
          <QuestHub
            onBack={() => setView('dashboard')}
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
      <div className="app">
        <ToolMenuPage
          title="Study tools"
          eyebrow="STUDY MODES"
          description="Choose a focused drill."
          onBack={() => setView('dashboard')}
          tools={[
            { mark: '文', title: 'Sentences', detail: 'Build Japanese sentence order.', accent: 'sakura', onClick: () => startSentenceMode('study-tools') },
            { mark: '文法', title: 'Grammar', detail: 'Practice patterns and particles.', accent: 'rayquaza', onClick: () => {
              setActiveQuestId(undefined)
              setPracticeReturnView('study-tools')
              setView('grammar')
            } },
            { mark: '語彙', title: 'Vocab', detail: 'Drill focused word groups.', accent: 'gold', onClick: () => {
              setQuestVocabTopicId(undefined)
              setActiveQuestId(undefined)
              setPracticeReturnView('study-tools')
              setView('vocab-practice')
            } },
            { mark: '漢', title: 'Kanji', detail: 'Study kanji readings and forms.', accent: 'kyogre', onClick: () => {
              setActiveQuestId(undefined)
              setPracticeReturnView('study-tools')
              setView('kanji')
            } },
            { mark: '数', title: 'Numbers', detail: 'Drill counting words and counters.', accent: 'amber', onClick: () => {
              setActiveQuestId(undefined)
              setPracticeReturnView('study-tools')
              setView('counter-practice')
            } },
          ]}
        />
      </div>
    )
  }

  if (view === 'beginner-zone') {
    return (
      <div className="app">
        <ToolMenuPage
          title="Beginner zone"
          eyebrow="START HERE"
          description="Never read Japanese before? Learn every character by the picture it hides."
          onBack={() => setView('dashboard')}
          tools={[
            { mark: 'あ', title: 'Hiragana', detail: 'The 46 rounded characters, five at a time.', accent: 'sakura', onClick: () => {
              setBeginnerScript('hiragana')
              setView('beginner-learner')
            } },
            { mark: 'ア', title: 'Katakana', detail: 'The angular script for foreign words and names.', accent: 'kyogre', onClick: () => {
              setBeginnerScript('katakana')
              setView('beginner-learner')
            } },
            { mark: '一', title: 'First Kanji', detail: 'Thirty starter kanji you can actually picture.', accent: 'gold', onClick: () => {
              setBeginnerScript('kanji')
              setView('beginner-learner')
            } },
            { mark: '⚡', title: 'Speed Run', detail: 'A kana flashes, then vanishes — name it before it fades.', accent: 'rayquaza', onClick: () => {
              setView('beginner-speed-run')
            } },
          ]}
        />
      </div>
    )
  }

  if (view === 'beginner-learner') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Beginner zone" />}>
          <BeginnerLearner script={beginnerScript} onBack={() => setView('beginner-zone')} />
        </Suspense>
      </div>
    )
  }

  if (view === 'beginner-speed-run') {
    return (
      <div className="app">
        <Suspense fallback={<RouteLoading label="Speed Run" />}>
          <BeginnerSpeedRun onBack={() => setView('beginner-zone')} />
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
      <div className="app">
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
          ]}
        />
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
            onDashboard={activeQuestId ? () => setView('dashboard') : undefined}
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
      return (
        <div className="app">
          <Suspense fallback={<RouteLoading label="Sentence Builder" />}>
            <SentenceBuilderView
              key={item.exercise.id}
              exercise={item.exercise}
              current={currentIndex}
              total={session.length}
              onResult={handleSentenceResult}
              onPrevious={goToPreviousSentence}
              onSkip={advanceOrComplete}
              onExit={() => setView(exitView)}
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
        onOpenStudyTools={() => setView('study-tools')}
        onOpenAdditionalTools={() => setView('additional-tools')}
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
}: {
  title: string
  eyebrow: string
  description: string
  tools: ToolMenuItem[]
  onBack: () => void
}) {
  return (
    <main className="tool-menu-page">
      <button type="button" className="back-button" onClick={onBack} aria-label="Back">
        <svg className="back-button-icon" viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="15 5 8 12 15 19" />
        </svg>
        <span>Back</span>
      </button>
      <section className="tool-menu-heading">
        <small>{eyebrow}</small>
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
