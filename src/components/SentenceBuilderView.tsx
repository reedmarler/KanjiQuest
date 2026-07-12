import { useMemo, useState } from 'react'
import { AnswerReveal } from './AnswerReveal'
import { shuffle } from '../lib/quiz'
import type { SentenceExercise } from '../data/sentenceExercises'

interface SentenceBuilderViewProps {
  exercise: SentenceExercise
  current: number
  total: number
  onResult: (correct: boolean) => void
  onExit: () => void
}

export function SentenceBuilderView({
  exercise,
  current,
  total,
  onResult,
  onExit,
}: SentenceBuilderViewProps) {
  const segments = exercise.segments ?? []
  const readings = exercise.segmentReadings
  const meanings = exercise.segmentMeanings
  const shuffled = useMemo(() => shuffle(segments), [exercise.id, segments.join('|')])
  const [available, setAvailable] = useState(shuffled)
  const [built, setBuilt] = useState<string[]>([])
  const [answered, setAnswered] = useState(false)

  const isCorrect =
    answered &&
    built.length === segments.length &&
    built.every((s, i) => s === segments[i])

  const answerGloss = {
    english: exercise.english,
    segments,
    readings,
    meanings,
  }

  const handlePick = (word: string, index: number) => {
    if (answered) return
    setBuilt((prev) => [...prev, word])
    setAvailable((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUndo = () => {
    if (answered || built.length === 0) return
    const last = built[built.length - 1]
    setBuilt((prev) => prev.slice(0, -1))
    setAvailable((prev) => [...prev, last])
  }

  const handleCheck = () => {
    if (built.length !== segments.length) return
    setAnswered(true)
  }

  return (
    <div className="study-view sentence-view">
      <div className="study-top">
        <button className="btn btn-ghost" onClick={onExit}>← Exit</button>
        <span className="study-progress">{current + 1} / {total}</span>
        <span className="study-type-badge">
          Sentence Builder {exercise.jlpt && <span className="jlpt-badge">{exercise.jlpt}</span>}
        </span>
      </div>

      <div className="study-progress-bar">
        <div className="study-progress-fill" style={{ width: `${((current + 1) / total) * 100}%` }} />
      </div>

      <div className="sentence-card">
        <p className="sentence-prompt">Tap words in the correct order</p>

        {!answered && (
          <>
            <div className="sentence-built">
              {built.length === 0 ? (
                <span className="sentence-built-placeholder">Build the sentence here…</span>
              ) : (
                built.map((word, i) => (
                  <span key={`${word}-${i}`} className="built-tile">{word}</span>
                ))
              )}
            </div>

            <div className="sentence-actions-row">
              <button className="btn btn-secondary" onClick={handleUndo} disabled={built.length === 0}>
                Undo
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCheck}
                disabled={built.length !== segments.length}
              >
                Check
              </button>
            </div>

            <div className="sentence-word-bank">
              {available.map((word, i) => (
                <button key={`${word}-${i}`} className="word-bank-tile" onClick={() => handlePick(word, i)}>
                  {word}
                </button>
              ))}
            </div>
          </>
        )}

        {answered && (
          <div className={`sentence-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
            <AnswerReveal gloss={answerGloss} />
          </div>
        )}
      </div>

      {answered && (
        <button className="btn btn-primary btn-large" onClick={() => onResult(isCorrect)}>
          Continue
        </button>
      )}
    </div>
  )
}
