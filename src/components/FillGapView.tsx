import { useEffect, useMemo, useState } from 'react'
import { AnswerReveal } from './AnswerReveal'
import { filledGapParts } from './FuriganaText'
import { buildOptions } from '../lib/quiz'
import type { SentenceExercise } from '../data/sentenceExercises'

interface FillGapViewProps {
  exercise: SentenceExercise
  current: number
  total: number
  onResult: (correct: boolean) => void
  onExit: () => void
}

export function FillGapView({ exercise, current, total, onResult, onExit }: FillGapViewProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)

  const options = useMemo(
    () => buildOptions(exercise.gapAnswer ?? '', exercise.distractors ?? []),
    [exercise.id, exercise.gapAnswer, exercise.distractors],
  )

  useEffect(() => {
    setSelected(null)
    setAnswered(false)
  }, [exercise.id])

  const isCorrect = selected === exercise.gapAnswer
  const parts = (exercise.sentence ?? '').split('___')
  const readings = exercise.filledReadings
  const meanings = exercise.filledMeanings
  const correctFilled = filledGapParts(exercise.sentence ?? '', exercise.gapAnswer ?? '')

  const answerGloss = readings
    ? {
        english: exercise.english,
        segments: [...correctFilled],
        readings: [readings[0], readings[1], readings[2]],
        meanings: meanings ? [meanings[0], meanings[1], meanings[2]] : undefined,
      }
    : null

  const handleSelect = (option: string) => {
    if (answered) return
    setSelected(option)
  }

  const handleConfirm = () => {
    if (!selected || answered) return
    setAnswered(true)
  }

  return (
    <div className="study-view sentence-view">
      <div className="study-top">
        <button className="btn btn-ghost" onClick={onExit}>← Exit</button>
        <span className="study-progress">{current + 1} / {total}</span>
        <span className="study-type-badge">
          Fill the gap {exercise.jlpt && <span className="jlpt-badge">{exercise.jlpt}</span>}
        </span>
      </div>

      <div className="study-progress-bar">
        <div className="study-progress-fill" style={{ width: `${((current + 1) / total) * 100}%` }} />
      </div>

      <div className="sentence-card fill-gap-card">
        <p className="sentence-prompt">Pick a word, then tap Confirm</p>

        <div className="sentence-gap-panel">
          {!answered ? (
            <p className="sentence-gap-display">
              {parts[0]}
              <span className={`gap-slot${selected ? ' is-preview' : ''}`}>
                {selected ?? '___'}
              </span>
              {parts[1] ?? ''}
            </p>
          ) : answerGloss ? (
            <div className={`sentence-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
              <AnswerReveal gloss={answerGloss} />
            </div>
          ) : null}
        </div>

        <div className="sentence-options">
          {options.map((option) => {
            let cls = 'sentence-option'
            if (answered) {
              if (option === exercise.gapAnswer) cls += ' correct'
              else if (option === selected) cls += ' wrong'
              else cls += ' dimmed'
            } else if (option === selected) {
              cls += ' selected'
            }
            const meaning = exercise.optionMeanings?.[option]
            return (
              <button key={option} className={cls} onClick={() => handleSelect(option)} disabled={answered}>
                <span className="quiz-option-jp">{option}</span>
                <span className={`quiz-option-en${meaning ? ' has-text' : ''}`}>
                  {meaning ?? '\u00A0'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="sentence-action-slot">
        {!answered ? (
          <button
            className={`btn btn-primary btn-large${selected ? '' : ' is-placeholder'}`}
            onClick={handleConfirm}
            disabled={!selected}
            tabIndex={selected ? 0 : -1}
            aria-hidden={!selected}
          >
            Confirm
          </button>
        ) : (
          <button
            className="btn btn-primary btn-large"
            onClick={() => onResult(isCorrect)}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  )
}
