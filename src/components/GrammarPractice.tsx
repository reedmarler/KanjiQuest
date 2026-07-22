import { useMemo, useState } from 'react'
import { grammarPracticeExercises } from '../data/grammarPractice'

interface GrammarPracticeProps {
  onBack: () => void
}

export function GrammarPractice({ onBack }: GrammarPracticeProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)

  const exercise = grammarPracticeExercises[currentIndex]
  const isCorrect = selected === exercise.answer
  const progress = ((currentIndex + 1) / grammarPracticeExercises.length) * 100
  const promptParts = useMemo(() => exercise.prompt.split('___'), [exercise.prompt])
  const filledAnswer = answered ? exercise.answer : null

  function choose(option: string) {
    if (answered) return
    setSelected(option)
  }

  function continuePractice() {
    if (!selected) return
    if (!answered) {
      setAnswered(true)
      if (selected === exercise.answer) setCorrectCount((count) => count + 1)
      return
    }
    if (currentIndex + 1 >= grammarPracticeExercises.length) {
      setFinished(true)
      return
    }
    setCurrentIndex((index) => index + 1)
    setSelected(null)
    setAnswered(false)
  }

  function restart() {
    setCurrentIndex(0)
    setSelected(null)
    setAnswered(false)
    setCorrectCount(0)
    setFinished(false)
  }

  if (finished) {
    return (
      <div className="grammar-practice-view">
        <button className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <section className="grammar-finish-card">
          <span className="grammar-finish-mark">文法</span>
          <h1>Grammar practice complete</h1>
          <p>You got <strong>{correctCount}</strong> of {grammarPracticeExercises.length} grammar choices right.</p>
          <div className="grammar-finish-actions">
            <button className="btn btn-primary" onClick={restart}>Practice again</button>
            <button className="btn btn-secondary" onClick={onBack}>Dashboard</button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="grammar-practice-view">
      <div className="study-top grammar-study-top">
        <button className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <span className="study-progress">{currentIndex + 1} / {grammarPracticeExercises.length}</span>
        <span className="study-type-badge">Grammar <span className="jlpt-badge">{exercise.jlpt}</span></span>
      </div>

      <div className="study-progress-bar">
        <div className="study-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <main className="grammar-choice-card">
        <div className="grammar-eyebrow">Choose the grammar that fits</div>

        <p className="grammar-english-clue">“{exercise.english}”</p>

        <div className="grammar-sentence-frame" lang="ja">
          <span>{promptParts[0]}</span>
          <span className={`grammar-gap${filledAnswer ? ' is-filled' : ''}${answered ? (isCorrect ? ' is-correct' : ' is-wrong') : ''}`}>
            {filledAnswer ?? '___'}
          </span>
          <span>{promptParts[1]}</span>
        </div>

        <div className="grammar-options" aria-label="Grammar answers">
          {exercise.options.map((option) => {
            let className = 'grammar-option'
            if (answered) {
              if (option === exercise.answer) className += ' correct'
              else if (option === selected) className += ' wrong'
              else className += ' dimmed'
            } else if (option === selected) {
              className += ' selected'
            }
            return (
              <button key={option} type="button" className={className} onClick={() => choose(option)} disabled={answered}>
                {option}
              </button>
            )
          })}
        </div>

        <div className="sentence-action-slot grammar-action-slot">
          <button
            className="btn btn-primary btn-large"
            onClick={continuePractice}
            disabled={!selected}
          >
            {answered ? 'Continue' : selected ? 'Check' : 'Choose an answer'}
          </button>
        </div>
      </main>
    </div>
  )
}
