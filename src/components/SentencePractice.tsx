import { useState } from 'react'
import { getExercisesByType } from '../data/sentenceExercises'
import type { FillGapLevelFilter } from '../lib/fillGapLevels'
import { GENERATED_BUILDER_SESSION_SIZE } from '../lib/generatedSentenceExercises'
import { FillGapLevelPicker } from './FillGapLevelPicker'
import { BATCH_CHECK_SIZE, SentenceBatchCheck } from './SentenceBatchCheck'

interface SentencePracticeProps {
  onStartFillGap: (filter: FillGapLevelFilter) => void
  onStartBuilder: () => void
  onBack: () => void
}

export function SentencePractice({ onStartFillGap, onStartBuilder, onBack }: SentencePracticeProps) {
  const [step, setStep] = useState<'menu' | 'fill-gap-levels' | 'batch-check'>('menu')
  const fillCount = getExercisesByType('fill-gap').length

  if (step === 'fill-gap-levels') {
    return (
      <FillGapLevelPicker
        onStart={onStartFillGap}
        onBack={() => setStep('menu')}
      />
    )
  }

  if (step === 'batch-check') {
    return <SentenceBatchCheck onBack={() => setStep('menu')} />
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
            Generate and translate {GENERATED_BUILDER_SESSION_SIZE} N5 sentences from the sentence database
          </span>
        </button>

        <button className="kanji-mode-card kanji-mode-mixed" onClick={() => setStep('batch-check')}>
          <span className="kanji-mode-emoji">🔍</span>
          <span className="kanji-mode-label">Translation Check</span>
          <span className="kanji-mode-desc">
            Generate {BATCH_CHECK_SIZE} builder sentences at once and review every English
            translation in one pass
          </span>
        </button>
      </div>
    </div>
  )
}
