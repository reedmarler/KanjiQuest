import { lazy, Suspense, useEffect, useState } from 'react'
import type { CardProgress } from '../lib/types'
import type { WrongPool } from '../lib/wrongPool'
import { GENERATION_COMPLEXITIES, heroJlptForComplexity, type GenerationComplexity } from '../lib/generationComplexity'

const RotatingHeroSentence = lazy(() => import('./RotatingHeroSentence').then((module) => ({ default: module.RotatingHeroSentence })))

function DashboardHeroSentence({
  wrongPool,
  progress,
  furiganaOn,
  jlptLevel,
}: {
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  furiganaOn: boolean
  jlptLevel: ReturnType<typeof heroJlptForComplexity>
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Let the dashboard controls paint before the sentence data is requested.
    const timer = window.setTimeout(() => setReady(true), 900)
    return () => window.clearTimeout(timer)
  }, [])

  if (!ready) return <div className="hero-sentence-loading" aria-hidden="true" />

  return (
    <Suspense fallback={<div className="hero-sentence-loading" aria-hidden="true" />}>
      <RotatingHeroSentence
        wrongPool={wrongPool}
        progress={progress}
        displayMode="sentence"
        furiganaOn={furiganaOn}
        delayedFurigana={false}
        jlptLevel={jlptLevel}
      />
    </Suspense>
  )
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
  onOpenContentStudio: () => void
  onOpenFavoriteSentences: () => void
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
  onOpenContentStudio,
  onOpenFavoriteSentences,
  onOpenSentenceTesting,
  wrongPool,
  progress,
}: DashboardProps) {
  const [furiganaOn, setFuriganaOn] = useState(true)
  const [complexity, setComplexity] = useState<GenerationComplexity>(1)

  const progressPct = totalCards > 0 ? Math.round((learnedCount / totalCards) * 100) : 0
  const furiganaActive = furiganaOn

  function toggleFurigana() {
    setFuriganaOn((on) => !on)
  }

  return (
    <div className="dashboard">
      <header className="hero hero-compact">
        <h1>Kanji Quest</h1>
        <DashboardHeroSentence
          wrongPool={wrongPool}
          progress={progress}
          furiganaOn={furiganaOn}
          jlptLevel={heroJlptForComplexity(complexity)}
        />
      </header>

      <section className="stats-grid stats-compact">
        <button
          type="button"
          className="stat-card stat-card-btn stat-card-studio"
          onClick={onOpenContentStudio}
        >
          <span className="stat-value stat-value-jp">編</span>
          <span className="stat-label">Studio</span>
        </button>

        <button
          type="button"
          className={`stat-card stat-card-btn${furiganaActive ? ' is-active' : ''}`}
          onClick={toggleFurigana}
          aria-pressed={furiganaActive}
          aria-label="Toggle furigana"
        >
          <span className="stat-value stat-value-jp">ふり</span>
          <span className="stat-label">Furigana</span>
        </button>

        <button
          type="button"
          className="stat-card stat-card-btn"
          onClick={onOpenVocabList}
          aria-label="Open vocabulary list"
        >
          <span className="stat-value stat-value-jp" aria-hidden="true">語</span>
          <span className="stat-label">Vocab List</span>
        </button>

        <button
          type="button"
          className="stat-card stat-card-btn"
          onClick={onOpenFavoriteSentences}
          aria-label="Open favorite sentences"
        >
          <span className="stat-value stat-value-jp" aria-hidden="true">★</span>
          <span className="stat-label">Favorite Sentences</span>
        </button>

        <div className="stat-card stat-card-levels">
          <div className="hero-level-grid" role="group" aria-label="Sentence complexity">
            {GENERATION_COMPLEXITIES.map((level) => (
              <button
                key={level}
                type="button"
                className={`hero-level-btn${complexity === level ? ' is-active' : ''}`}
                onClick={() => setComplexity(level)}
                aria-pressed={complexity === level}
                aria-label={`Generation complexity level ${level}`}
              >
                L{level}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="progress-section progress-compact">
        <div className="progress-header">
          <span>Progress</span>
          <span>{progressPct}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </section>

      <section className="practice-grid">
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
      </section>

      <section className="sentence-testing-launch">
        <div>
          <span>NEW · COMPLEXITY LEVELS 1–5</span>
          <h2>Sentence Testing</h2>
          <p>Generate 15 sentences from the complexity level you choose.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onOpenSentenceTesting}>Open →</button>
      </section>
    </div>
  )
}
