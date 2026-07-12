import { useState } from 'react'
import { KANJI_MODE_INFO, JLPT_LEVELS, type JlptFilter, type KanjiLabMode } from '../lib/kanjiTypes'
import { kanjiProgressByLevel, filterKanjiByJlpt } from '../lib/kanjiLab'
import { countConfidentKanji } from '../lib/confidentKanji'
import { isLearned } from '../lib/srs'
import type { CardProgress } from '../lib/types'

interface KanjiLabProps {
  progress: Record<string, CardProgress>
  confidentKanji: Set<string>
  onStart: (mode: KanjiLabMode, level: JlptFilter) => void
  onBack: () => void
}

export function KanjiLab({ progress, confidentKanji, onStart, onBack }: KanjiLabProps) {
  const [level, setLevel] = useState<JlptFilter>('All')
  const levelStats = kanjiProgressByLevel(progress, isLearned)
  const currentStat = levelStats[level]
  const levelPool = filterKanjiByJlpt(level)
  const confidentCount = countConfidentKanji(confidentKanji, levelPool.map((c) => c.id))
  const drillingCount = levelPool.length - confidentCount

  return (
    <div className="kanji-lab">
      <header className="kanji-lab-header">
        <button className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <div>
          <h1>Kanji Lab</h1>
          <p className="kanji-lab-sub">Multiple ways to learn, remember, and test kanji</p>
          <p className="kanji-lab-sub kanji-drill-note">
            {drillingCount} in active drill · {confidentCount} confident (cycle less)
          </p>
        </div>
      </header>

      <section className="kanji-level-picker">
        <h2>JLPT level</h2>
        <div className="kanji-level-tabs">
          {JLPT_LEVELS.map((l) => (
            <button
              key={l}
              className={`kanji-level-tab ${level === l ? 'active' : ''}`}
              onClick={() => setLevel(l)}
            >
              {l}
            </button>
          ))}
        </div>
        <p className="kanji-level-summary">
          {currentStat.learned} of {currentStat.total} kanji learned at this level
        </p>
      </section>

      <section className="kanji-level-stats">
        {(['N5', 'N4', 'N3', 'N2', 'N1'] as const).map((lvl) => {
          const stat = levelStats[lvl]
          const pct = stat.total > 0 ? Math.round((stat.learned / stat.total) * 100) : 0
          return (
            <div key={lvl} className={`kanji-level-chip ${level === lvl ? 'highlighted' : ''}`}>
              <span className="level-name">{lvl}</span>
              <span className="level-count">{stat.learned}/{stat.total}</span>
              <div className="level-bar">
                <div className="level-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </section>

      <section className="kanji-modes">
        <h2>Choose how to study</h2>
        <p className="kanji-modes-hint">
          Kanji stay in your drill pool until you mark them confident. Use &ldquo;I&apos;m confident&rdquo; after answering to ease them out.
        </p>

        <div className="kanji-mode-grid">
          {(Object.keys(KANJI_MODE_INFO) as Exclude<KanjiLabMode, 'mixed'>[]).map((mode) => {
            const info = KANJI_MODE_INFO[mode]
            return (
              <button
                key={mode}
                className="kanji-mode-card"
                onClick={() => onStart(mode, level)}
              >
                <span className="kanji-mode-emoji">{info.emoji}</span>
                <span className="kanji-mode-label">{info.label}</span>
                <span className="kanji-mode-desc">{info.description}</span>
              </button>
            )
          })}

          <button
            className="kanji-mode-card kanji-mode-mixed"
            onClick={() => onStart('mixed', level)}
          >
            <span className="kanji-mode-emoji">🔀</span>
            <span className="kanji-mode-label">Mixed Drill</span>
            <span className="kanji-mode-desc">Rotates through all quiz modes — best for real retention</span>
          </button>
        </div>
      </section>
    </div>
  )
}
