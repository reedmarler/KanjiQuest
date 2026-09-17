import { useEffect, useMemo, useState } from 'react'
import { getQuestById } from '../data/questCampaign'
import { AppBackButton } from './AppBackButton'

interface QuestCheckpointProps {
  questId?: string
  onBack: () => void
  onComplete: () => void
}

const QUESTION_COUNT = 5

export function QuestCheckpoint({ questId, onBack, onComplete }: QuestCheckpointProps) {
  const quest = getQuestById(questId)
  const questions = useMemo(() => quest?.grammarDrills.slice(0, QUESTION_COUNT) ?? [], [quest])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [index, finished])

  if (!quest || questions.length === 0) {
    return (
      <main className="simple-quest-challenge">
        <header className="simple-quest-challenge-topbar"><AppBackButton onClick={onBack} aria-label="Back to quests" /></header>
        <section className="simple-quest-result"><h1>Quest unavailable</h1><button type="button" className="btn btn-primary" onClick={onBack}>Back to quests</button></section>
      </main>
    )
  }

  const question = questions[index]!
  const passScore = Math.ceil(questions.length * 0.6)
  const passed = correctCount >= passScore
  const progress = finished ? 100 : (index / questions.length) * 100

  function checkAnswer() {
    if (!selected || revealed) return
    if (selected === question.answer) setCorrectCount((count) => count + 1)
    setRevealed(true)
  }

  function advance() {
    if (!revealed) return
    if (index === questions.length - 1) {
      setFinished(true)
      return
    }
    setIndex((value) => value + 1)
    setSelected(null)
    setRevealed(false)
  }

  function retry() {
    setIndex(0)
    setSelected(null)
    setRevealed(false)
    setCorrectCount(0)
    setFinished(false)
  }

  return (
    <main className="simple-quest-challenge">
      <header className="simple-quest-challenge-topbar">
        <AppBackButton onClick={onBack} aria-label="Back to quests" />
        <div>
          <span>QUEST {String(quest.number).padStart(2, '0')}</span>
          <strong>{quest.title}</strong>
        </div>
      </header>

      <div className="simple-quest-progress" role="progressbar" aria-label="Quest progress" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={finished ? questions.length : index}>
        <i style={{ width: `${progress}%` }} />
      </div>

      {finished ? (
        <section className={`simple-quest-result${passed ? ' is-passed' : ''}`}>
          <span className="simple-quest-result-mark" lang="ja" aria-hidden="true">{passed ? '完' : '復'}</span>
          <small>{passed ? 'QUEST COMPLETE' : 'ONE MORE TRY'}</small>
          <h1>{correctCount} of {questions.length} correct</h1>
          <p>{passed ? 'Nice work. The next quest is ready.' : `Score ${passScore} or better to complete this quest.`}</p>
          <button type="button" className="btn btn-primary" onClick={passed ? onComplete : retry}>{passed ? 'Finish quest' : 'Try again'}</button>
          {passed && <button type="button" className="btn btn-ghost" onClick={retry}>Practice again</button>}
        </section>
      ) : (
        <section className="simple-quest-question">
          <header>
            <span>QUESTION {index + 1} OF {questions.length}</span>
            <b>{quest.level}</b>
          </header>
          <p className="simple-quest-english">{question.english}</p>
          <h1 lang="ja">{question.prompt}</h1>

          <div className="simple-quest-options" role="group" aria-label="Answer choices">
            {question.options.map((option) => {
              const state = !revealed
                ? option === selected ? ' is-selected' : ''
                : option === question.answer ? ' is-correct' : option === selected ? ' is-wrong' : ''
              return (
                <button key={option} type="button" className={state} disabled={revealed} onClick={() => setSelected(option)}>
                  {option}
                </button>
              )
            })}
          </div>

          <div className="simple-quest-action">
            {revealed && (
              <p className={selected === question.answer ? 'is-correct' : 'is-wrong'}>
                <strong>{selected === question.answer ? 'Correct' : `Answer: ${question.answer}`}</strong>
                <span>{question.meaning}</span>
              </p>
            )}
            <button type="button" className="btn btn-primary" disabled={!selected} onClick={revealed ? advance : checkAnswer}>
              {revealed ? index === questions.length - 1 ? 'See result' : 'Next' : 'Check'}
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
