import { useState } from 'react'
import type { AppStats, CardProgress, JlptLevel } from '../lib/types'
import type { WrongPool } from '../lib/wrongPool'
import { RotatingHeroSentence } from './RotatingHeroSentence'

const HERO_JLPT_OPTIONS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2']

interface DashboardProps {
  stats: AppStats
  dueCount: number
  learnedCount: number
  totalCards: number
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  onStartReview: () => void
  onSelectDeck: (type: string) => void
  onOpenKanjiLab: () => void
  onOpenSentencePractice: () => void
  onOpenSentenceGeneratorPreview: () => void
  onOpenVocabList: () => void
  onOpenContentStudio: () => void
  onStartMistakeReview: () => void
  mistakeCount: number
  deckInfo: { type: string; label: string; count: number; emoji: string }[]
  deckProgress: Record<string, { learned: number; due: number }>
}

export function Dashboard({
  stats,
  dueCount,
  learnedCount,
  totalCards,
  onStartReview,
  onSelectDeck,
  onOpenKanjiLab,
  onOpenSentencePractice,
  onOpenSentenceGeneratorPreview,
  onOpenVocabList,
  onOpenContentStudio,
  onStartMistakeReview,
  mistakeCount,
  deckInfo,
  deckProgress,
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

      <div className="dashboard-actions">
        {dueCount > 0 && (
          <button className="action-chip action-chip-review" onClick={onStartReview}>
            <span className="action-chip-count">{dueCount}</span>
            <span>Review</span>
          </button>
        )}
        {mistakeCount > 0 && (
          <button className="action-chip action-chip-mistakes" onClick={onStartMistakeReview}>
            <span className="action-chip-count">{mistakeCount}</span>
            <span>Mistakes</span>
          </button>
        )}
      </div>

      <section className="practice-grid">
        <button type="button" className="practice-card practice-card-studio" onClick={onOpenContentStudio}>
          <span className="practice-emoji">編</span><span className="practice-label">Content Studio</span><span className="practice-card-badge">INTERNAL</span>
        </button>
        <button type="button" className="practice-card" onClick={onOpenSentencePractice}>
          <span className="practice-emoji">文</span>
          <span className="practice-label">Sentence Practice</span>
        </button>
        <button type="button" className="practice-card practice-card-generator" onClick={onOpenSentenceGeneratorPreview}>
          <span className="practice-emoji">回</span>
          <span className="practice-label">Generator Preview</span>
        </button>
        <button type="button" className="practice-card practice-card-kanji" onClick={onOpenKanjiLab}>
          <span className="practice-emoji">漢</span>
          <span className="practice-label">Kanji Lab</span>
        </button>
        <button type="button" className="practice-card practice-card-vocab" onClick={onOpenVocabList}>
          <span className="practice-emoji">語</span>
          <span className="practice-label">Vocab List</span>
        </button>
        <button type="button" className="practice-card practice-card-reading" onClick={() => onSelectDeck('reading')}>
          <span className="practice-emoji">読</span>
          <span className="practice-label">Reading Quiz</span>
        </button>
      </section>

      <section className="study-decks-panel">
        <div className="study-decks-panel-header">
          <h2>Study decks</h2>
          <span className="study-decks-panel-meta">
            {deckInfo.reduce((sum, deck) => sum + deck.count, 0)} cards
          </span>
        </div>
        <div className="study-decks-panel-body">
          {deckInfo.map((deck) => {
            const prog = deckProgress[deck.type] ?? { learned: 0, due: 0 }
            const pct = deck.count > 0 ? Math.round((prog.learned / deck.count) * 100) : 0
            return (
              <button
                key={deck.type}
                type="button"
                className="study-deck-row"
                onClick={() => onSelectDeck(deck.type)}
              >
                <span className="study-deck-row-emoji">{deck.emoji}</span>
                <span className="study-deck-row-main">
                  <span className="study-deck-row-label">{deck.label}</span>
                  <span className="study-deck-row-count">{deck.count} cards · {pct}%</span>
                  <div className="study-deck-row-bar">
                    <div className="study-deck-row-fill" style={{ width: `${pct}%` }} />
                  </div>
                </span>
                {prog.due > 0 && <span className="study-deck-row-due">{prog.due} due</span>}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
