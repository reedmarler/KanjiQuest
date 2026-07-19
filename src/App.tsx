import { useCallback, useMemo, useState } from 'react'
import { allCards, deckInfo, getCardsByType } from './data'
import { buildKanjiLabSession } from './lib/kanjiLab'
import type { JlptFilter, KanjiLabMode } from './lib/kanjiTypes'
import {
  addConfidentKanji,
  isKanjiConfident,
  loadConfidentKanji,
} from './lib/confidentKanji'
import {
  buildMistakeSession,
  buildSentenceSession,
} from './lib/sentenceLab'
import { recordFillGapSeen } from './lib/sentenceRecent'
import { buildSession } from './lib/session'
import { isDue, isLearned, reviewCard, reviewKanjiConfident, reviewKanjiDrill } from './lib/srs'
import {
  getOrCreateProgress,
  loadProgress,
  loadStats,
  saveProgress,
  saveStats,
  updateStreak,
} from './lib/storage'
import {
  loadWrongPool,
  recordCorrect,
  recordWrong,
  saveWrongPool,
  wrongPoolSize,
} from './lib/wrongPool'
import type { AppStats, CardProgress, CardType, StudyCard } from './lib/types'
import type { SentenceExercise } from './data/sentenceExercises'
import type { FillGapLevelFilter } from './lib/fillGapLevels'
import { Dashboard } from './components/Dashboard'
import { FillGapView } from './components/FillGapView'
import { KanjiLab } from './components/KanjiLab'
import { KanjiLearnView } from './components/KanjiLearnView'
import { KanjiQuizView } from './components/KanjiQuizView'
import { ReadingView } from './components/ReadingView'
import { SentenceBuilderView } from './components/SentenceBuilderView'
import { SentenceGeneratorPreview } from './components/SentenceGeneratorPreview'
import { SentencePractice } from './components/SentencePractice'
import { SessionComplete } from './components/SessionComplete'
import { StudyView } from './components/StudyView'
import { VocabList } from './components/VocabList'
import { ContentStudio } from './components/ContentStudio'
import './App.css'

type View =
  | 'dashboard'
  | 'kanji-lab'
  | 'sentence-practice'
  | 'sentence-generator-preview'
  | 'vocab-list'
  | 'study'
  | 'complete'
  | 'content-studio'

type SessionItem =
  | { kind: 'card'; card: StudyCard; kanjiMode?: KanjiLabMode }
  | { kind: 'fill-gap'; exercise: SentenceExercise }
  | { kind: 'sentence-builder'; exercise: SentenceExercise }

function toSessionItems(
  cards: StudyCard[],
  kanjiModes: KanjiLabMode[],
): SessionItem[] {
  return cards.map((card, i) => ({
    kind: 'card' as const,
    card,
    kanjiMode: kanjiModes[i],
  }))
}

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [progress, setProgress] = useState<Record<string, CardProgress>>(() => loadProgress())
  const [stats, setStats] = useState<AppStats>(() => loadStats())
  const [wrongPool, setWrongPool] = useState(() => loadWrongPool())
  const [confidentKanji, setConfidentKanji] = useState(() => loadConfidentKanji())
  const [session, setSession] = useState<SessionItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [exitView, setExitView] = useState<View>('dashboard')

  const dueCount = useMemo(
    () => allCards.filter((c) => {
      const p = progress[c.id]
      return !p || isDue(p)
    }).length,
    [progress],
  )

  const learnedCount = useMemo(
    () => allCards.filter((c) => {
      const p = progress[c.id]
      return p && isLearned(p)
    }).length,
    [progress],
  )

  const mistakeCount = useMemo(() => wrongPoolSize(wrongPool), [wrongPool])

  const deckProgress = useMemo(() => {
    const result: Record<string, { learned: number; due: number }> = {}
    for (const deck of deckInfo) {
      const cards = getCardsByType(deck.type as CardType)
      result[deck.type] = {
        learned: cards.filter((c) => {
          const p = progress[c.id]
          return p && isLearned(p)
        }).length,
        due: cards.filter((c) => {
          const p = progress[c.id]
          return !p || isDue(p)
        }).length,
      }
    }
    return result
  }, [progress])

  const updateWrongPool = useCallback((pool: typeof wrongPool) => {
    setWrongPool(pool)
    saveWrongPool(pool)
  }, [])

  const recordReview = useCallback((card: StudyCard, quality: number) => {
    const existing = getOrCreateProgress(card.id, progress)
    const updated = reviewCard(existing, quality)
    const newProgress = { ...progress, [card.id]: updated }
    setProgress(newProgress)
    saveProgress(newProgress)

    let pool = wrongPool
    if (quality < 2) pool = recordWrong(card.id, pool)
    else pool = recordCorrect(card.id, pool)
    updateWrongPool(pool)

    const newStats = updateStreak({
      ...stats,
      totalReviews: stats.totalReviews + 1,
      cardsLearned: Object.values(newProgress).filter(isLearned).length,
    })
    setStats(newStats)
    saveStats(newStats)

    if (quality >= 2) setSessionCorrect((n) => n + 1)
  }, [progress, stats, wrongPool, updateWrongPool])

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
    setShowAnswer(false)
    setSessionCorrect(0)
    setExitView(returnTo)
    setView('study')
  }

  const startSession = useCallback((cards: StudyCard[]) => {
    const built = buildSession(cards, allCards, progress, wrongPool)
    startStudy(toSessionItems(built, []))
  }, [progress, wrongPool])

  const startKanjiLab = useCallback((mode: KanjiLabMode, level: JlptFilter) => {
    const { cards, modes } = buildKanjiLabSession(mode, level, progress, confidentKanji)
    startStudy(toSessionItems(cards, modes), 'kanji-lab')
  }, [progress, confidentKanji])

  const startSentenceMode = useCallback((type: 'fill-gap' | 'sentence-builder', fillGapFilter?: FillGapLevelFilter) => {
    const items = buildSentenceSession(type, wrongPool, fillGapFilter)
    startStudy(items, 'sentence-practice')
  }, [wrongPool])

  const startMistakeReview = useCallback(() => {
    const items = buildMistakeSession(wrongPool)
    startStudy(items)
  }, [wrongPool])

  const advanceOrComplete = () => {
    if (currentIndex + 1 >= session.length) {
      setView('complete')
    } else {
      setCurrentIndex((i) => i + 1)
      setShowAnswer(false)
    }
  }

  const handleRate = (quality: number) => {
    const item = session[currentIndex]
    if (item.kind === 'card') recordReview(item.card, quality)
    advanceOrComplete()
  }

  const recordKanjiQuizResult = useCallback((
    card: StudyCard,
    correct: boolean,
    markConfident: boolean,
  ) => {
    const existing = getOrCreateProgress(card.id, progress)
    const updated = markConfident
      ? reviewKanjiConfident(existing, correct)
      : reviewKanjiDrill(existing, correct)
    const newProgress = { ...progress, [card.id]: updated }
    setProgress(newProgress)
    saveProgress(newProgress)

    let pool = wrongPool
    if (!correct) pool = recordWrong(card.id, pool)
    else pool = recordCorrect(card.id, pool)
    updateWrongPool(pool)

    if (markConfident && correct) {
      setConfidentKanji((prev) => addConfidentKanji(card.id, prev))
    }

    const newStats = updateStreak({
      ...stats,
      totalReviews: stats.totalReviews + 1,
      cardsLearned: Object.values(newProgress).filter(isLearned).length,
    })
    setStats(newStats)
    saveStats(newStats)

    if (correct) setSessionCorrect((n) => n + 1)
  }, [progress, stats, wrongPool, updateWrongPool])

  const handleKanjiContinue = (correct: boolean) => {
    const item = session[currentIndex]
    if (item.kind === 'card') recordKanjiQuizResult(item.card, correct, false)
    advanceOrComplete()
  }

  const handleKanjiConfident = (correct: boolean) => {
    const item = session[currentIndex]
    if (item.kind === 'card') recordKanjiQuizResult(item.card, correct, true)
    advanceOrComplete()
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

  if (view === 'content-studio') return <ContentStudio onBack={() => setView('dashboard')} />

  if (view === 'kanji-lab') {
    return (
      <div className="app">
        <KanjiLab
          progress={progress}
          confidentKanji={confidentKanji}
          onStart={startKanjiLab}
          onBack={() => setView('dashboard')}
        />
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

  if (view === 'sentence-generator-preview') {
    return (
      <div className="app">
        <SentenceGeneratorPreview onBack={() => setView('dashboard')} />
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
          />
        </div>
      )
    }

    if (item.kind !== 'card') {
      return null
    }

    const { card, kanjiMode } = item

    if (kanjiMode === 'learn') {
      return (
        <div className="app">
          <KanjiLearnView
            key={card.id}
            card={card}
            current={currentIndex}
            total={session.length}
            onNext={handleRate}
            onExit={() => setView(exitView)}
          />
        </div>
      )
    }

    if (kanjiMode) {
      return (
        <div className="app">
          <KanjiQuizView
            key={`${card.id}-${kanjiMode}-${currentIndex}`}
            card={card}
            mode={kanjiMode}
            current={currentIndex}
            total={session.length}
            isConfident={isKanjiConfident(card.id, confidentKanji)}
            onContinue={handleKanjiContinue}
            onMarkConfident={handleKanjiConfident}
            onExit={() => setView(exitView)}
          />
        </div>
      )
    }

    if (card.type === 'reading') {
      return (
        <div className="app">
          <ReadingView
            key={card.id}
            card={card}
            current={currentIndex}
            total={session.length}
            onRate={handleRate}
            onExit={() => setView(exitView)}
          />
        </div>
      )
    }

    return (
      <div className="app">
        <StudyView
          card={card}
          showAnswer={showAnswer}
          current={currentIndex}
          total={session.length}
          onReveal={() => setShowAnswer(true)}
          onRate={handleRate}
          onExit={() => setView(exitView)}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <Dashboard
        stats={stats}
        dueCount={dueCount}
        learnedCount={learnedCount}
        mistakeCount={mistakeCount}
        totalCards={allCards.length}
        onStartReview={() => startSession(allCards)}
        onSelectDeck={(type) => startSession(getCardsByType(type as CardType))}
        onOpenKanjiLab={() => setView('kanji-lab')}
        onOpenSentencePractice={() => setView('sentence-practice')}
        onOpenSentenceGeneratorPreview={() => setView('sentence-generator-preview')}
        onOpenVocabList={() => setView('vocab-list')}
        onOpenContentStudio={() => setView('content-studio')}
        onStartMistakeReview={startMistakeReview}
        deckInfo={deckInfo}
        deckProgress={deckProgress}
        wrongPool={wrongPool}
        progress={progress}
      />
    </div>
  )
}

export default App
