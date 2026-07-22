import { useCallback, useMemo, useState } from 'react'
import { allCards } from './data'
import { buildSentenceSession } from './lib/sentenceLab'
import { buildGeneratedBuilderExercises, WIRED_BUILDER_LEVELS } from './lib/generatedSentenceExercises'
import { recordFillGapSeen } from './lib/sentenceRecent'
import { isLearned } from './lib/srs'
import { loadProgress } from './lib/storage'
import {
  loadWrongPool,
  recordCorrect,
  recordWrong,
  saveWrongPool,
} from './lib/wrongPool'
import type { CardProgress, JlptLevel } from './lib/types'
import type { SentenceExercise } from './data/sentenceExercises'
import type { FillGapLevelFilter } from './lib/fillGapLevels'
import { Dashboard } from './components/Dashboard'
import { FillGapView } from './components/FillGapView'
import { SentenceBuilderView } from './components/SentenceBuilderView'
import { SentencePractice } from './components/SentencePractice'
import { SessionComplete } from './components/SessionComplete'
import { VocabList } from './components/VocabList'
import { ContentStudio } from './components/ContentStudio'
import { GrammarPractice } from './components/GrammarPractice'
import { VocabPractice } from './components/VocabPractice'
import './App.css'

type View =
  | 'dashboard'
  | 'sentence-practice'
  | 'vocab-list'
  | 'vocab-practice'
  | 'study'
  | 'complete'
  | 'content-studio'
  | 'grammar'

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
  const [builderLevels, setBuilderLevels] = useState<JlptLevel[]>(['N5'])
  const [infiniteBuilderMode, setInfiniteBuilderMode] = useState(false)

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

  const startStudy = (items: SessionItem[], returnTo: View = 'dashboard') => {
    if (items.length === 0) return
    setSession(items)
    setCurrentIndex(0)
    setSessionCorrect(0)
    setExitView(returnTo)
    setView('study')
  }

  const startSentenceMode = useCallback((type: 'fill-gap' | 'sentence-builder', fillGapFilter?: FillGapLevelFilter) => {
    const items = buildSentenceSession(type, wrongPool, fillGapFilter, builderLevels)
    startStudy(items, 'sentence-practice')
  }, [builderLevels, wrongPool])

  const toggleBuilderLevel = useCallback((level: JlptLevel) => {
    if (!WIRED_BUILDER_LEVELS.includes(level)) return

    setBuilderLevels((current) => {
      if (!current.includes(level)) return [...current, level]
      if (current.length === 1) return current
      return current.filter((item) => item !== level)
    })
  }, [])

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

  if (view === 'vocab-practice') {
    return (
      <div className="app">
        <VocabPractice onBack={() => setView('dashboard')} />
      </div>
    )
  }

  if (view === 'content-studio') return <ContentStudio onBack={() => setView('dashboard')} />

  if (view === 'grammar') {
    return (
      <div className="app">
        <GrammarPractice onBack={() => setView('dashboard')} />
      </div>
    )
  }

  if (view === 'sentence-practice') {
    return (
      <div className="app">
        <SentencePractice
          onStartFillGap={(filter) => startSentenceMode('fill-gap', filter)}
          onStartBuilder={() => startSentenceMode('sentence-builder')}
          onBack={() => setView('dashboard')}
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
            onSkip={advanceOrComplete}
            onExit={() => setView(exitView)}
            selectedLevels={builderLevels}
            enabledLevels={WIRED_BUILDER_LEVELS}
            onToggleLevel={toggleBuilderLevel}
            infiniteMode={infiniteBuilderMode}
            onToggleInfiniteMode={() => setInfiniteBuilderMode((enabled) => !enabled)}
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
        onOpenSentencePractice={() => setView('sentence-practice')}
        onOpenGrammar={() => setView('grammar')}
        onOpenVocabList={() => setView('vocab-list')}
        onOpenVocabPractice={() => setView('vocab-practice')}
        onOpenContentStudio={() => setView('content-studio')}
        wrongPool={wrongPool}
        progress={progress}
      />
    </div>
  )
}

export default App
