import { GENERATED_BUILDER_SESSION_SIZE } from '../lib/generatedSentenceExercises'
import { AppBackButton } from './AppBackButton'

interface SentencePracticeProps {
  onStartBuilder: () => void
  onBack: () => void
}

export function SentencePractice({ onStartBuilder, onBack }: SentencePracticeProps) {
  return (
    <div className="kanji-lab sentence-practice">
      <header className="kanji-lab-header">
        <AppBackButton onClick={onBack} aria-label="Back to Dashboard" />
        <div>
          <h1>Sentence Practice</h1>
          <p className="kanji-lab-sub">Build real sentences — English meaning shown after each one</p>
        </div>
      </header>

      <div className="kanji-mode-grid">
        <button className="kanji-mode-card" onClick={onStartBuilder}>
          <span className="kanji-mode-emoji">🧱</span>
          <span className="kanji-mode-label">Sentence Builder</span>
          <span className="kanji-mode-desc">
            Generate and translate {GENERATED_BUILDER_SESSION_SIZE} N5 sentences from the sentence database
          </span>
        </button>

      </div>
    </div>
  )
}
