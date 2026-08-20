import { useMemo, useState } from 'react'
import type { BeginnerCharacter, BeginnerDeck } from '../data/beginnerMnemonics'
import { speakJapanese } from '../lib/speech'
import { SPEECH_SPEEDS } from '../lib/speechSpeeds'

/** How many questions the closing gauntlet asks. Long enough to actually
 *  sample the whole deck, short enough to finish in one sitting. */
const QUESTION_COUNT = 12
const CHOICE_COUNT = 4

/**
 * The two directions a kana has to work in to count as "known": hearing the
 * sound and picking the shape, and seeing the shape and picking the sound.
 * Drilling only one direction lets a learner pass while still being unable to
 * read, which is the whole point of this final check.
 */
type QuestionKind = 'listen' | 'read'

interface Question {
  kind: QuestionKind
  answer: BeginnerCharacter
  choices: BeginnerCharacter[]
}

function shuffled<T>(items: readonly T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  }
  return copy
}

function buildQuestions(characters: BeginnerCharacter[]): Question[] {
  // Sampling without replacement first means every question is a different
  // character until the deck runs out, rather than the same few repeating.
  const pool = shuffled(characters)
  return Array.from({ length: Math.min(QUESTION_COUNT, characters.length) }, (_, index) => {
    const answer = pool[index]!
    const distractors = shuffled(characters.filter((entry) => entry.char !== answer.char)).slice(0, CHOICE_COUNT - 1)
    return {
      kind: index % 2 === 0 ? 'listen' : 'read',
      answer,
      choices: shuffled([answer, ...distractors]),
    }
  })
}

interface BeginnerFinalChallengeProps {
  deck: BeginnerDeck
  onExit: () => void
}

export function BeginnerFinalChallenge({ deck, onExit }: BeginnerFinalChallengeProps) {
  const characters = useMemo(() => deck.rows.flatMap((row) => row.characters), [deck])
  const [questions, setQuestions] = useState<Question[]>(() => buildQuestions(characters))
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)

  const question = questions[index]
  const finished = index >= questions.length

  function pick(char: string) {
    if (picked) return
    setPicked(char)
    if (char === question?.answer.char) setCorrect((current) => current + 1)
  }

  function next() {
    setPicked(null)
    setIndex((current) => current + 1)
  }

  function restart() {
    setQuestions(buildQuestions(characters))
    setIndex(0)
    setPicked(null)
    setCorrect(0)
  }

  if (finished) {
    const perfect = correct === questions.length
    return (
      <main className="beginner-card beginner-card-complete">
        <span className="beginner-complete-mark" aria-hidden="true">{perfect ? '🏆' : '🎉'}</span>
        <h2>{perfect ? 'Perfect run' : 'Challenge complete'}</h2>
        <p className="beginner-challenge-score">{correct} / {questions.length}</p>
        <p>
          {perfect
            ? `You know every character in ${deck.title} both ways round.`
            : 'Run it again to tighten up the ones that slipped.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={restart}>Run it again</button>
        <button type="button" className="btn btn-ghost" onClick={onExit}>Back to {deck.title}</button>
      </main>
    )
  }

  if (!question) return null

  return (
    <main className="beginner-card beginner-challenge">
      <div className="beginner-challenge-top">
        <span className="beginner-write-label">Final challenge — {index + 1} of {questions.length}</span>
        <span className="beginner-challenge-tally">{correct} correct</span>
      </div>

      {question.kind === 'listen' ? (
        <>
          <p className="beginner-challenge-prompt-label">Which character makes this sound?</p>
          <button
            type="button"
            className="beginner-speak-btn beginner-speak-btn--quiz"
            onClick={() => speakJapanese(question.answer.char, { rate: SPEECH_SPEEDS.learning, synthesisRate: SPEECH_SPEEDS.natural })}
            aria-label="Play the sound"
          >
            <span aria-hidden="true">&#128266;</span>
            <em>Listen</em>
          </button>
        </>
      ) : (
        <>
          <p className="beginner-challenge-prompt-label">How is this read?</p>
          <p className="beginner-challenge-glyph" lang="ja">{question.answer.char}</p>
        </>
      )}

      <div className="beginner-challenge-choices">
        {question.choices.map((choice) => {
          const isAnswer = choice.char === question.answer.char
          const state = !picked ? '' : isAnswer ? ' is-correct' : choice.char === picked ? ' is-wrong' : ' is-dimmed'
          return (
            <button
              key={choice.char}
              type="button"
              className={`beginner-challenge-choice${state}`}
              onClick={() => pick(choice.char)}
              disabled={Boolean(picked)}
              lang={question.kind === 'listen' ? 'ja' : undefined}
            >
              {question.kind === 'listen' ? choice.char : choice.romaji}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="btn btn-primary beginner-action-btn beginner-action-btn-green beginner-challenge-next"
        onClick={next}
        disabled={!picked}
      >
        {index + 1 === questions.length ? 'See result →' : 'Next →'}
      </button>
    </main>
  )
}
