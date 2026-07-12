import { useMemo, useState } from 'react'
import { AnswerReveal } from './AnswerReveal'
import { getReadingAnswerGloss } from '../lib/studyGloss'
import type { StudyCard } from '../lib/types'
import { buildOptions, renderSentence } from '../lib/quiz'

interface ReadingViewProps {
  card: StudyCard
  current: number
  total: number
  onRate: (quality: number) => void
  onExit: () => void
}

const ratingButtons = [
  { quality: 0, label: 'Again', sub: '< 10 min', className: 'rate-again' },
  { quality: 1, label: 'Hard', sub: '1 day', className: 'rate-hard' },
  { quality: 2, label: 'Good', sub: 'interval', className: 'rate-good' },
  { quality: 3, label: 'Easy', sub: '1+ weeks', className: 'rate-easy' },
]

export function ReadingView({ card, current, total, onRate, onExit }: ReadingViewProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)

  const options = useMemo(
    () => buildOptions(card.back, card.distractors ?? []),
    [card.id, card.back, card.distractors],
  )

  const parts = renderSentence(card.sentence ?? '', card.highlight ?? card.front)
  const isCorrect = selected === card.back
  const answerGloss = getReadingAnswerGloss(card)

  const handleSelect = (option: string) => {
    if (answered) return
    setSelected(option)
    setAnswered(true)
  }

  const handleNext = () => {
    if (!answered) return
    const quality = isCorrect ? 2 : 0
    setSelected(null)
    setAnswered(false)
    onRate(quality)
  }

  return (
    <div className="study-view reading-view">
      <div className="study-top">
        <button className="btn btn-ghost" onClick={onExit}>← Back</button>
        <span className="study-progress">{current + 1} / {total}</span>
        <span className="study-type-badge">
          Reading {card.jlpt && <span className="jlpt-badge">{card.jlpt}</span>}
        </span>
      </div>

      <div className="study-progress-bar">
        <div
          className="study-progress-fill"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>

      <div className="reading-card">
        <p className="reading-prompt">How is the highlighted kanji read?</p>

        {!answered ? (
          <p className="reading-sentence">
            {parts.before}
            <span className="reading-highlight">{parts.target}</span>
            {parts.after}
          </p>
        ) : null}

        <div className="reading-options">
          {options.map((option) => {
            let className = 'reading-option'
            if (answered) {
              if (option === card.back) className += ' correct'
              else if (option === selected) className += ' wrong'
              else className += ' dimmed'
            }
            return (
              <button
                key={option}
                className={className}
                onClick={() => handleSelect(option)}
                disabled={answered}
              >
                {option}
              </button>
            )
          })}
        </div>

        {answered && answerGloss && (
          <div className={`reading-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
            <AnswerReveal gloss={answerGloss} />
            {isCorrect ? (
              <p className="reading-result-note">
                Correct! <strong>{card.highlight}</strong> → {card.back}
              </p>
            ) : (
              <p className="reading-result-note">
                <strong>{card.highlight}</strong> is read <strong>{card.back}</strong>
                {selected && <> (you chose {selected})</>}
              </p>
            )}
          </div>
        )}
      </div>

      {answered ? (
        <div className="reading-actions">
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
          <button className="btn btn-primary btn-large" onClick={handleNext}>
            {isCorrect ? 'Continue' : 'Continue (Again)'}
          </button>
        </div>
      ) : (
        <p className="tap-hint reading-tap-hint">Choose the correct kana reading</p>
      )}
    </div>
  )
}
