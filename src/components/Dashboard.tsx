import { useState } from 'react'
import type { AppStats, CardProgress, JlptLevel } from '../lib/types'
import type { WrongPool } from '../lib/wrongPool'
import { RotatingHeroSentence } from './RotatingHeroSentence'

const HERO_JLPT_OPTIONS: JlptLevel[] = ['N5', 'N4', 'N3']

interface DashboardProps {
  stats: AppStats
  learnedCount: number
  totalCards: number
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  onOpenSentencePractice: () => void
  onOpenVocabList: () => void
  onOpenContentStudio: () => void
}

export function Dashboard({
  stats,
  learnedCount,
  totalCards,
  onOpenSentencePractice,
  onOpenVocabList,
  onOpenContentStudio,
  wrongPool,
  progress,
}: DashboardProps) {
  const [displayMode, setDisplayMode] = useState<'sentence' | 'word'>('sentence')
  const [furiganaOn, setFuriganaOn] = useState(true)
  const [delayedFurigana, setDelayedFurigana] = useState(true)
  const [jlptLevel, setJlptLevel] = useState<JlptLevel>('N5')

  const progressPct = totalCards > 0 ? Math.round((learnedCount / totalCards) * 100) : 0
  const furiganaActive = displayMode === 'sentence' ? furiganaOn : delayedFurigana

  function toggleFurigana() {
    if (displayMode === 'sentence') {
      setFuriganaOn((on) => !on)
      return
    }
    setDelayedFurigana((on) => !on)
  }

  function toggleDisplayMode() {
    setDisplayMode((mode) => (mode === 'sentence' ? 'word' : 'sentence'))
  }

  return (
    <div className="dashboard">
      <header className="hero hero-compact">
        <h1>Kanji Quest</h1>
        <RotatingHeroSentence
          wrongPool={wrongPool}
          progress={progress}
          displayMode={displayMode}
          furiganaOn={furiganaOn}
          delayedFurigana={delayedFurigana}
          jlptLevel={jlptLevel}
        />
      </header>

      <section className="stats-grid stats-compact">
        <div className="stat-card streak">
          <span className="stat-value">{stats.streak}</span>
          <span className="stat-label">Streak</span>
        </div>

        <button
          type="button"
          className={`stat-card stat-card-btn${furiganaActive ? ' is-active' : ''}`}
          onClick={toggleFurigana}
          aria-pressed={furiganaActive}
          aria-label={
            displayMode === 'sentence'
              ? 'Toggle furigana'
              : 'Toggle delayed furigana'
          }
        >
          <span className="stat-value stat-value-jp">ふり</span>
          <span className="stat-label">Furigana</span>
        </button>

        <button
          type="button"
          className="stat-card stat-card-btn"
          onClick={toggleDisplayMode}
          aria-label={displayMode === 'sentence' ? 'Kanji word mode' : 'Sentence mode'}
        >
          <span className="stat-value stat-value-jp">
            {displayMode === 'sentence' ? '漢' : '文'}
          </span>
          <span className="stat-label">
            {displayMode === 'sentence' ? 'Kanji' : 'Sentence'}
          </span>
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
        <button type="button" className="practice-card" onClick={onOpenContentStudio}>
          <span className="practice-emoji">編</span>
          <span className="practice-label">Content Studio</span>
        </button>
        <button type="button" className="practice-card" onClick={onOpenSentencePractice}>
          <span className="practice-emoji">文</span>
          <span className="practice-label">Sentence Practice</span>
        </button>
        <button type="button" className="practice-card practice-card-vocab" onClick={onOpenVocabList}>
          <span className="practice-emoji">語</span>
          <span className="practice-label">Vocab List</span>
        </button>
      </section>
    </div>
  )
}
