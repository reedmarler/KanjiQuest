import { useMemo, useState } from 'react'
import {
  COUNTER_CATEGORIES,
  COUNTER_QUIZZES,
  JAPANESE_COUNTERS,
  type CounterCategory,
  type JapaneseCounter,
} from '../data/japaneseCounters'
import { FuriganaSegment } from './FuriganaText'
import { SpeakableCue, SpeakableWord } from './SpeakableWord'

interface CounterPracticeProps {
  onBack: () => void
}

type CategoryFilter = 'All' | CounterCategory

function shuffled<T>(items: readonly T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target]!, copy[index]!]
  }
  return copy
}

function CounterStudyCard({
  counter,
  selected,
  onSelect,
}: {
  counter: JapaneseCounter
  selected: string | null
  onSelect: (option: string) => void
}) {
  const quiz = COUNTER_QUIZZES[counter.id]!
  const options = useMemo(() => shuffled(quiz.options), [quiz.options])
  const [before, after] = quiz.prompt.split('___')
  const answered = selected !== null
  const correct = selected === quiz.answer

  return (
    <main className={`counter-study-card counter-quiz-card${answered ? ' is-answered' : ''}`}>
      <div className="counter-study-card-top">
        <span className="counter-category-badge">{counter.category}</span>
        <span className="counter-card-instruction">Choose the missing counter</span>
      </div>

      <div className="counter-quiz-prompt">
        <p lang="ja">
          <span>{before}</span>
          <span className="counter-quiz-blank">{answered ? quiz.answer : '？'}</span>
          <span>{after}</span>
        </p>
        <span>{quiz.english}</span>
      </div>

      <div className="counter-quiz-options" role="group" aria-label="Counter choices">
        {options.map((option) => {
          const optionIsCorrect = option === quiz.answer
          const optionIsSelected = option === selected
          const stateClass = answered
            ? optionIsCorrect
              ? ' is-correct'
              : optionIsSelected
                ? ' is-wrong'
                : ''
            : ''
          return (
            <button
              key={option}
              type="button"
              className={`${optionIsSelected ? 'is-selected' : ''}${stateClass}`}
              disabled={answered}
              onClick={() => onSelect(option)}
            >
              {option}
            </button>
          )
        })}
      </div>

      {answered && (
        <section className={`counter-quiz-feedback${correct ? ' is-correct' : ' is-wrong'}`} aria-live="polite">
          <div className="counter-quiz-result">
            <strong>{correct ? 'Correct' : `Answer: ${quiz.answer}`}</strong>
            <span><b lang="ja">{counter.suffix}</b> · {counter.reading}</span>
          </div>
          <SpeakableWord text={quiz.reading} className="counter-sentence-example">
            <span className="counter-sentence-japanese" lang="ja">
              <FuriganaSegment text={quiz.completed} reading={quiz.reading} />
            </span>
            <span className="counter-sentence-english">{quiz.english}</span>
            <SpeakableCue />
          </SpeakableWord>
        </section>
      )}
    </main>
  )
}

export function CounterPractice({ onBack }: CounterPracticeProps) {
  const [category, setCategory] = useState<CategoryFilter>('All')
  const [deck, setDeck] = useState<JapaneseCounter[]>(() => [...JAPANESE_COUNTERS])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [correctIds, setCorrectIds] = useState<Set<string>>(() => new Set())
  const [completed, setCompleted] = useState(false)

  const cards = useMemo(
    () => category === 'All' ? deck : deck.filter((counter) => counter.category === category),
    [category, deck],
  )
  const counter = cards[index] ?? cards[0]
  const progress = completed ? 100 : ((index + 1) / Math.max(cards.length, 1)) * 100

  function chooseCategory(nextCategory: CategoryFilter) {
    setCategory(nextCategory)
    setIndex(0)
    setSelected(null)
    setCorrectIds(new Set())
    setCompleted(false)
  }

  function previousCounter() {
    if (completed) {
      setCompleted(false)
      setSelected(null)
      return
    }
    if (index === 0) {
      onBack()
      return
    }
    setIndex((current) => current - 1)
    setSelected(null)
  }

  function nextCounter() {
    if (index + 1 >= cards.length) {
      setCompleted(true)
      return
    }
    setIndex((current) => current + 1)
    setSelected(null)
  }

  function shuffleDeck() {
    setDeck((current) => shuffled(current))
    setIndex(0)
    setSelected(null)
    setCorrectIds(new Set())
    setCompleted(false)
  }

  function restartDeck() {
    setIndex(0)
    setSelected(null)
    setCorrectIds(new Set())
    setCompleted(false)
  }

  function selectCounter(option: string) {
    if (!counter || selected !== null) return
    setSelected(option)
    if (option === COUNTER_QUIZZES[counter.id]?.answer) {
      setCorrectIds((current) => new Set(current).add(counter.id))
    }
  }

  return (
    <div className="counter-practice">
      <header className="counter-practice-top">
        <button type="button" className="vocab-back-arrow" onClick={previousCounter} aria-label={index > 0 || completed ? 'Previous counter' : 'Back to study tools'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div>
          <span>NUMBER STUDY</span>
          <h1>Japanese counters</h1>
        </div>
        <span className="counter-practice-count">{completed ? cards.length : index + 1} / {cards.length}</span>
      </header>

      <div className="study-progress-bar counter-progress-bar" aria-label={`Counter ${Math.min(index + 1, cards.length)} of ${cards.length}`}>
        <div className="study-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <section className="counter-path-heading">
        <div>
          <span>33 WAYS TO COUNT</span>
          <p>Choose the counter that completes each sentence.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={shuffleDeck}>Shuffle</button>
      </section>

      <nav className="counter-category-tabs" aria-label="Counter categories">
        {(['All', ...COUNTER_CATEGORIES] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={category === item ? 'is-active' : ''}
            aria-pressed={category === item}
            onClick={() => chooseCategory(item)}
          >
            {item === 'All' ? `All ${JAPANESE_COUNTERS.length}` : item}
          </button>
        ))}
      </nav>

      {completed ? (
        <main className="counter-study-complete">
          <span lang="ja">数</span>
          <h2>Counter path complete</h2>
          <p>
            {cards.filter((item) => correctIds.has(item.id)).length} of {cards.length} correct in {category === 'All' ? 'the full deck' : category}.
          </p>
          <button type="button" className="btn btn-primary" onClick={restartDeck}>Study again</button>
          <button type="button" className="btn btn-ghost" onClick={shuffleDeck}>Shuffle and restart</button>
        </main>
      ) : counter ? (
        <>
          <CounterStudyCard
            counter={counter}
            selected={selected}
            onSelect={selectCounter}
          />
          <div className="counter-study-navigation">
            <button type="button" className="btn btn-ghost" onClick={previousCounter}>
              {index === 0 ? 'Study tools' : 'Previous'}
            </button>
            <button type="button" className="btn counter-next-button" onClick={nextCounter} disabled={selected === null}>
              {selected === null ? 'Choose an answer' : index + 1 >= cards.length ? 'Finish set' : 'Next counter'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
