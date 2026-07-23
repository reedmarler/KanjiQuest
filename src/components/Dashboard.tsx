import { useState } from 'react'
import type { CardProgress, JlptLevel } from '../lib/types'
import type { WrongPool } from '../lib/wrongPool'
import { RotatingHeroSentence } from './RotatingHeroSentence'

const HERO_JLPT_OPTIONS: JlptLevel[] = ['N5', 'N4', 'N3']

interface DashboardProps {
  learnedCount: number
  totalCards: number
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  onOpenSentencePractice: () => void
  onOpenGrammar: () => void
  onOpenVocabList: () => void
  onOpenVocabPractice: () => void
  onOpenContentStudio: () => void
  onOpenFavoriteSentences: () => void
}

export function Dashboard({
  learnedCount,
  totalCards,
  onOpenSentencePractice,
  onOpenGrammar,
  onOpenVocabList,
  onOpenVocabPractice,
  onOpenContentStudio,
  onOpenFavoriteSentences,
  wrongPool,
  progress,
}: DashboardProps) {
  const [furiganaOn, setFuriganaOn] = useState(true)
  const [jlptLevel, setJlptLevel] = useState<JlptLevel>('N5')

  const progressPct = totalCards > 0 ? Math.round((learnedCount / totalCards) * 100) : 0
  const furiganaActive = furiganaOn

  function toggleFurigana() {
    setFuriganaOn((on) => !on)
  }

  return (
    <div className="dashboard">
      <header className="hero hero-compact">
        <h1>Kanji Quest</h1>
        <RotatingHeroSentence
          wrongPool={wrongPool}
          progress={progress}
          displayMode="sentence"
          furiganaOn={furiganaOn}
          delayedFurigana={false}
          jlptLevel={jlptLevel}
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
          onClick={onOpenFavoriteSentences}
          aria-label="Open favorite sentences"
        >
          <span className="stat-value stat-value-jp" aria-hidden="true">★</span>
          <span className="stat-label">Favorite Sentences</span>
        </button>

        <div className="stat-card stat-card-levels">
          <div className="hero-level-grid" role="group" aria-label="JLPT level">
            {HERO_JLPT_OPTIONS.map((level) => (
              <button
                key={level}
                type="button"
                className={`hero-level-btn${jlptLevel === level ? ' is-active' : ''}`}
                onClick={() => setJlptLevel(level)}
                aria-pressed={jlptLevel === level}
                aria-label={`JLPT ${level}`}
              >
                {level}
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
        <button type="button" className="practice-card practice-card-vocab" onClick={onOpenVocabList}>
          <span className="practice-emoji">語</span>
          <span className="practice-label">Vocab List</span>
        </button>
      </section>
    </div>
  )
}
