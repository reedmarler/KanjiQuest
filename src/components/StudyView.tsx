import { AnswerReveal } from './AnswerReveal'
import { getFlashcardAnswerGloss } from '../lib/studyGloss'
import type { StudyCard } from '../lib/types'

interface StudyViewProps {
  card: StudyCard
  showAnswer: boolean
  current: number
  total: number
  onReveal: () => void
  onRate: (quality: number) => void
  onExit: () => void
}

const ratingButtons = [
  { quality: 0, label: 'Again', sub: '< 10 min', className: 'rate-again' },
  { quality: 1, label: 'Hard', sub: '1 day', className: 'rate-hard' },
  { quality: 2, label: 'Good', sub: 'interval', className: 'rate-good' },
  { quality: 3, label: 'Easy', sub: '1+ weeks', className: 'rate-easy' },
]

const typeLabels: Record<string, string> = {
  hiragana: 'Hiragana',
  katakana: 'Katakana',
  vocab: 'Vocabulary',
  grammar: 'Grammar',
  kanji: 'Kanji',
}

export function StudyView({
  card,
  showAnswer,
  current,
  total,
  onReveal,
  onRate,
  onExit,
}: StudyViewProps) {
  const typeLabel = typeLabels[card.type] ?? card.type

  return (
    <div className="study-view">
      <div className="study-top">
        <button className="btn btn-ghost" onClick={onExit}>← Back</button>
        <span className="study-progress">{current + 1} / {total}</span>
        <span className="study-type-badge">
          {typeLabel}
          {card.jlpt && <span className="jlpt-badge">{card.jlpt}</span>}
        </span>
      </div>

      <div className="study-progress-bar">
        <div
          className="study-progress-fill"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>

      <div className="flashcard" onClick={!showAnswer ? onReveal : undefined}>
        <div className="card-front">
          <span className="card-character">{card.front}</span>
          {card.hint && !showAnswer && !card.hint.includes(' = ') && (
            <p className="card-hint">{card.hint}</p>
          )}
        </div>

        {showAnswer && (
          <div className="card-answer">
            <AnswerReveal gloss={getFlashcardAnswerGloss(card)} />
          </div>
        )}

        {!showAnswer && (
          <p className="tap-hint">Tap to reveal answer</p>
        )}
      </div>

      {showAnswer ? (
        <div className="rating-buttons">
          {ratingButtons.map((btn) => (
            <button
              key={btn.quality}
              className={`rate-btn ${btn.className}`}
              onClick={() => onRate(btn.quality)}
            >
              <span className="rate-label">{btn.label}</span>
              <span className="rate-sub">{btn.sub}</span>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn btn-primary btn-large" onClick={onReveal}>
          Show answer
        </button>
      )}
    </div>
  )
}
