import { useEffect, useMemo, useState } from 'react'
import { getKanjiDetail } from '../data/kanjiDetails'
import { buildKanjiQuiz, filterKanjiByJlpt, type KanjiQuizState } from '../lib/kanjiLab'
import { getKanjiDisplayText, getKanjiWordForm } from '../lib/kanjiWordForm'
import { KANJI_MODE_INFO, type KanjiLabMode, type KanjiRadical } from '../lib/kanjiTypes'
import { renderSentence } from '../lib/quiz'
import { AnswerReveal } from './AnswerReveal'
import { getKanjiQuizAnswerGloss } from '../lib/studyGloss'
import type { StudyCard } from '../lib/types'

interface KanjiQuizViewProps {
  card: StudyCard
  mode: KanjiLabMode
  current: number
  total: number
  isConfident: boolean
  onContinue: (correct: boolean) => void
  onMarkConfident: (correct: boolean) => void
  onExit: () => void
}

export function KanjiQuizView({
  card,
  mode,
  current,
  total,
  isConfident,
  onContinue,
  onMarkConfident,
  onExit,
}: KanjiQuizViewProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [breakdownReady, setBreakdownReady] = useState(mode !== 'breakdown')
  const [optionsReady, setOptionsReady] = useState(false)

  useEffect(() => {
    setOptionsReady(false)
    const id = window.setTimeout(() => setOptionsReady(true), 0)
    return () => window.clearTimeout(id)
  }, [card.id, mode])

  const detail = getKanjiDetail(card)
  const wordForm = getKanjiWordForm(card)
  const displayText = getKanjiDisplayText(card)
  const pool = useMemo(() => filterKanjiByJlpt('All'), [])

  const [quiz, setQuiz] = useState<KanjiQuizState>(() => buildKanjiQuiz(card, mode, pool))

  useEffect(() => {
    setQuiz(buildKanjiQuiz(card, mode, pool))
    setSelectedIndex(null)
    setAnswered(false)
  }, [card.id, mode, pool])

  const selected = selectedIndex !== null ? quiz.options[selectedIndex] : null
  const isCorrect = selected === quiz.correct
  const answerGloss = getKanjiQuizAnswerGloss(
    card,
    mode,
    quiz.prompt === 'context' ? quiz.sentence : undefined,
  )
  const modeLabel =
    mode in KANJI_MODE_INFO
      ? KANJI_MODE_INFO[mode as keyof typeof KANJI_MODE_INFO].label
      : 'Quiz'

  const handleSelect = (index: number) => {
    if (!optionsReady || answered || (mode === 'breakdown' && !breakdownReady)) return
    setSelectedIndex(index)
    setAnswered(true)
  }

  if (mode === 'breakdown' && !breakdownReady) {
    return (
      <div className="study-view kanji-quiz-view">
        <div className="study-top">
          <button className="btn btn-ghost" onClick={onExit}>← Exit</button>
          <span className="study-progress">{current + 1} / {total}</span>
          <span className="study-type-badge">Breakdown {card.jlpt && <span className="jlpt-badge">{card.jlpt}</span>}</span>
        </div>
        <div className="kanji-breakdown-phase">
          <span className={`kanji-learn-char ${wordForm ? 'kanji-quiz-word' : ''}`}>
            {displayText}
          </span>
          <div className="kanji-radicals">
            <h3>Break it down</h3>
            <div className="radical-list">
              {detail.radicals.map((r: KanjiRadical) => (
                <div key={r.char} className="radical-chip">
                  <span className="radical-char">{r.char}</span>
                  <span className="radical-meaning">{r.meaning}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="kanji-mnemonic"><p>{detail.mnemonic}</p></div>
          <button className="btn btn-primary btn-large" onClick={() => setBreakdownReady(true)}>
            Ready — quiz me
          </button>
        </div>
      </div>
    )
  }

  const sentenceParts =
    quiz.prompt === 'context' && quiz.sentence && quiz.highlight
      ? renderSentence(quiz.sentence, quiz.highlight)
      : null

  return (
    <div className="study-view kanji-quiz-view">
      <div className="study-top">
        <button className="btn btn-ghost" onClick={onExit}>← Exit</button>
        <span className="study-progress">{current + 1} / {total}</span>
        <span className="study-type-badge">
          {modeLabel} {card.jlpt && <span className="jlpt-badge">{card.jlpt}</span>}
        </span>
      </div>

      <div className="study-progress-bar">
        <div className="study-progress-fill" style={{ width: `${((current + 1) / total) * 100}%` }} />
      </div>

      <div className="kanji-quiz-card">
        {quiz.prompt === 'context' && sentenceParts ? (
          <>
            <p className="kanji-context-prompt">How is the highlighted kanji read?</p>
            <p className="kanji-context-sentence">
              {sentenceParts.before}
              <span className="reading-highlight">{sentenceParts.target}</span>
              {sentenceParts.after}
            </p>
          </>
        ) : (
          <>
            <p className="kanji-quiz-prompt">{quiz.prompt}</p>
            {quiz.showChar && (
              <span className={`kanji-quiz-char ${wordForm ? 'kanji-quiz-word' : ''}`}>
                {displayText}
              </span>
            )}
          </>
        )}

        <div className="kanji-quiz-options">
          {quiz.options.map((option, index) => {
            let cls = 'kanji-quiz-option'
            if (mode === 'recall') cls += ' kanji-char-option'
            if (answered) {
              if (index === selectedIndex) cls += isCorrect ? ' correct' : ' wrong'
              else if (option === quiz.correct) cls += ' correct'
              else cls += ' dimmed'
            }
            return (
              <button
                key={`${card.id}-${mode}-${index}`}
                className={cls}
                onClick={() => handleSelect(index)}
                disabled={answered || !optionsReady}
              >
                {option}
              </button>
            )
          })}
        </div>

        {answered && (
          <div className={`reading-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
            <AnswerReveal gloss={answerGloss} />
            {!isCorrect && (
              <p className="reading-result-note">
                Answer: <strong>{quiz.correct}</strong>
              </p>
            )}
          </div>
        )}
      </div>

      {answered ? (
        <div className="kanji-quiz-actions">
          {isConfident && (
            <p className="kanji-confident-badge">Already in your confident list — cycles less often</p>
          )}
          <div className="kanji-quiz-action-row">
            <button
              className="btn btn-primary btn-large"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onContinue(isCorrect)}
            >
              Keep drilling
            </button>
            {!isConfident && isCorrect && (
              <button
                className="btn btn-secondary btn-large kanji-confident-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onMarkConfident(true)}
              >
                I&apos;m confident
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="tap-hint">Choose the correct answer</p>
      )}
    </div>
  )
}
