import { useState } from 'react'
import { getExercisesByType } from '../data/sentenceExercises'
import type { FillGapLevelFilter } from '../lib/fillGapLevels'
import { FillGapLevelPicker } from './FillGapLevelPicker'

interface SentencePracticeProps {
  onStartFillGap: (filter: FillGapLevelFilter) => void
  onStartBuilder: () => void
  onBack: () => void
}

export function SentencePractice({ onStartFillGap, onStartBuilder, onBack }: SentencePracticeProps) {
  const [step, setStep] = useState<'menu' | 'fill-gap-levels'>('menu')
  const fillCount = getExercisesByType('fill-gap').length
  const buildCount = getExercisesByType('sentence-builder').length

  if (step === 'fill-gap-levels') {
    return (
      <FillGapLevelPicker
        onStart={onStartFillGap}
        onBack={() => setStep('menu')}
      />
    )
  }

  return (
    <div className="kanji-lab sentence-practice">
      <header className="kanji-lab-header">
        <button className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <div>
          <h1>Sentence Practice</h1>
          <p className="kanji-lab-sub">Build real sentences — English meaning shown after each one</p>
        </div>
      </header>

      <div className="kanji-mode-grid">
        <button className="kanji-mode-card" onClick={() => setStep('fill-gap-levels')}>
          <span className="kanji-mode-emoji">✏️</span>
          <span className="kanji-mode-label">Fill the Gap</span>
          <span className="kanji-mode-desc">
            Pick the missing word by level — {fillCount} sentences (N5–N1)
          </span>
        </button>

        <button className="kanji-mode-card" onClick={onStartBuilder}>
          <span className="kanji-mode-emoji">🧱</span>
          <span className="kanji-mode-label">Sentence Builder</span>
          <span className="kanji-mode-desc">
            Tap words in order — {buildCount} sentences with English translation after
          </span>
        </button>
      </div>
    </div>
  )
}
