import { useCallback, useMemo, useState } from 'react'
import { allCards } from './data'
import { buildSentenceSession } from './lib/sentenceLab'
import { buildGeneratedBuilderExercises, WIRED_BUILDER_LEVELS } from './lib/generatedSentenceExercises'
import { recordFillGapSeen } from './lib/sentenceRecent'
import { isLearned } from './lib/srs'
import { loadProgress } from './lib/storage'
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
import type { FillGapLevelFilter } from './lib/fillGapLevels'
import { Dashboard } from './components/Dashboard'
import { FillGapView } from './components/FillGapView'
import { SentenceBuilderView } from './components/SentenceBuilderView'
import { SessionComplete } from './components/SessionComplete'
import { VocabList } from './components/VocabList'
import { ContentStudio } from './components/ContentStudio'
import { GrammarPractice } from './components/GrammarPractice'
import { VocabPractice } from './components/VocabPractice'
import { FavoriteSentences } from './components/FavoriteSentences'
import { SentenceTesting } from './components/SentenceTesting'
import './App.css'

type View =
  | 'dashboard'
  | 'vocab-list'
  | 'vocab-practice'
  | 'study'
  | 'complete'
  | 'content-studio'
  | 'grammar'
  | 'favorites'
  | 'sentence-testing'

type SessionItem =
  | { kind: 'fill-gap'; exercise: SentenceExercise }
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

  const learnedCount = useMemo(
    () => allCards.filter((c) => {
      const p = progress[c.id]
      return p && isLearned(p)
    }).length,
    [progress],
  )

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

  const startSentenceMode = useCallback((type: 'fill-gap' | 'sentence-builder', fillGapFilter?: FillGapLevelFilter, returnTo: View = 'dashboard') => {
    const items = buildSentenceSession(type, wrongPool, fillGapFilter, builderLevels)
    startStudy(items, returnTo)
  }, [builderLevels, wrongPool])

  const applyBuilderLevels = useCallback((nextLevels: readonly GenerationComplexity[]) => {
    const next = WIRED_BUILDER_LEVELS.filter((level) => nextLevels.includes(level))
    if (!next.length) return

    setBuilderLevels([...next])
    if (session[currentIndex]?.kind === 'sentence-builder') {
      const nextExercises = buildGeneratedBuilderExercises(next)
      if (nextExercises.length) {
        setSession(nextExercises.map((exercise) => ({ kind: 'sentence-builder' as const, exercise })))
        setCurrentIndex(0)
        setSessionCorrect(0)
      }
    }
  }, [currentIndex, session])

  const advanceOrComplete = () => {
    if (currentIndex + 1 >= session.length) {
      const finalItem = session[currentIndex]
      if (infiniteBuilderMode && finalItem?.kind === 'sentence-builder') {
        const nextExercises = buildGeneratedBuilderExercises(builderLevels, 1, session.length)
        if (nextExercises.length) {
          setSession((items) => [...items, ...nextExercises.map((exercise) => ({ kind: 'sentence-builder' as const, exercise }))])
          setCurrentIndex((index) => index + 1)
          return
        }
      }
      setView('complete')
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  const handleSentenceResult = (correct: boolean) => {
    const item = session[currentIndex]
    if (item.kind === 'fill-gap' || item.kind === 'sentence-builder') {
      recordSentenceResult(item.exercise.id, correct)
      if (item.kind === 'fill-gap') recordFillGapSeen(item.exercise.id)
    }
    advanceOrComplete()
  }

  if (view === 'vocab-list') {
    return (
      <div className="app">
        <VocabList onBack={() => setView('dashboard')} />
      </div>
    )
  }

  const goToPreviousSentence = () => {
    setCurrentIndex((index) => Math.max(0, index - 1))
  }

  if (view === 'favorites') {
    return (
      <div className="app">
        <FavoriteSentences
          favorites={favoriteSentences}
          onBack={() => setView('dashboard')}
          onRemove={(favorite) => {
            setFavoriteSentences((current) => {
              const next = current.filter((item) => item.japanese !== favorite.japanese)
              saveFavoriteSentences(next)
              return next
            })
          }}
        />
      </div>
    )
  }

  if (view === 'vocab-practice') {
    return (
      <div className="app">
        <VocabPractice
          onBack={() => setView('dashboard')}
          isFavorite={(exercise) => isDrillExerciseFavorite(favoriteSentences, exercise)}
          onToggleFavorite={toggleDrillFavorite}
        />
      </div>
    )
  }

  if (view === 'content-studio') return <ContentStudio onBack={() => setView('dashboard')} />

  if (view === 'sentence-testing') {
    return (
      <div className="app">
        <SentenceTesting onBack={() => setView('dashboard')} />
      </div>
    )
  }

  if (view === 'grammar') {
    return (
      <div className="app">
        <GrammarPractice
          onBack={() => setView('dashboard')}
          isFavorite={(exercise) => isDrillExerciseFavorite(favoriteSentences, exercise)}
          onToggleFavorite={toggleDrillFavorite}
        />
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
    if (item.kind === 'fill-gap') {
      return (
        <div className="app">
          <FillGapView
            key={item.exercise.id}
            exercise={item.exercise}
            current={currentIndex}
            total={session.length}
            onResult={handleSentenceResult}
            onExit={() => setView(exitView)}
            isFavorite={isExerciseFavorite(favoriteSentences, item.exercise)}
            onToggleFavorite={() => toggleFavoriteSentence(item.exercise)}
          />
        </div>
      )
    }

    if (item.kind === 'sentence-builder') {
      return (
        <div className="app">
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
            enabledLevels={WIRED_BUILDER_LEVELS}
            onApplyLevels={applyBuilderLevels}
            infiniteMode={infiniteBuilderMode}
            onToggleInfiniteMode={() => setInfiniteBuilderMode((enabled) => !enabled)}
            isFavorite={isExerciseFavorite(favoriteSentences, item.exercise)}
            onToggleFavorite={() => toggleFavoriteSentence(item.exercise)}
          />
        </div>
      )
    }

    return null
  }

  return (
    <div className="app">
      <Dashboard
        learnedCount={learnedCount}
        totalCards={allCards.length}
        onOpenSentencePractice={() => startSentenceMode('sentence-builder')}
        onOpenGrammar={() => setView('grammar')}
        onOpenVocabList={() => setView('vocab-list')}
        onOpenVocabPractice={() => setView('vocab-practice')}
        onOpenContentStudio={() => setView('content-studio')}
        onOpenFavoriteSentences={() => setView('favorites')}
        onOpenSentenceTesting={() => setView('sentence-testing')}
        wrongPool={wrongPool}
        progress={progress}
      />
    </div>
  )
}

export default App
