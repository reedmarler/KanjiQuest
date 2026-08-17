import { useMemo, useState } from 'react'
import {
  COUNTER_CATEGORIES,
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
  revealed,
  onReveal,
}: {
  counter: JapaneseCounter
  revealed: boolean
  onReveal: () => void
}) {
  return (
    <main className={`counter-study-card${revealed ? ' is-revealed' : ''}`}>
      <div className="counter-study-card-top">
        <span className="counter-category-badge">{counter.category}</span>
        <span className="counter-card-instruction">What does this counter count?</span>
      </div>

      <div className="counter-study-prompt">
        <span className="counter-study-suffix" lang="ja">{counter.suffix}</span>
        <span className={`counter-study-reading${revealed ? ' is-visible' : ''}`} lang="ja">
          {counter.reading}
        </span>
      </div>

      <section className={`counter-study-answer${revealed ? ' is-visible' : ''}`} aria-hidden={!revealed}>
        <h2>{counter.counts}</h2>
        <SpeakableWord text={counter.example.reading} className="counter-example">
          <span className="counter-example-japanese" lang="ja">
            <FuriganaSegment text={counter.example.japanese} reading={counter.example.reading} />
          </span>
          <span className="counter-example-english">{counter.example.english}</span>
          <SpeakableCue />
        </SpeakableWord>
        <p className="counter-study-note">{counter.note}</p>
      </section>

      <button type="button" className="btn btn-primary counter-reveal-button" onClick={onReveal}>
        {revealed ? 'Hide answer' : 'Reveal counter'}
      </button>
    </main>
  )
}

export function CounterPractice({ onBack }: CounterPracticeProps) {
  const [category, setCategory] = useState<CategoryFilter>('All')
  const [deck, setDeck] = useState<JapaneseCounter[]>(() => [...JAPANESE_COUNTERS])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
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
    setRevealed(false)
    setCompleted(false)
  }

  function previousCounter() {
    if (completed) {
      setCompleted(false)
      setRevealed(false)
      return
    }
    if (index === 0) {
      onBack()
      return
    }
    setIndex((current) => current - 1)
    setRevealed(false)
  }

  function nextCounter() {
    if (index + 1 >= cards.length) {
      setCompleted(true)
      return
    }
    setIndex((current) => current + 1)
    setRevealed(false)
  }

  function shuffleDeck() {
    setDeck((current) => shuffled(current))
    setIndex(0)
    setRevealed(false)
    setCompleted(false)
  }

  function restartDeck() {
    setIndex(0)
    setRevealed(false)
    setCompleted(false)
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
          <p>Learn what each counter counts, then reveal its reading and sound changes.</p>
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
          <p>You reviewed all {cards.length} counters in {category === 'All' ? 'the full deck' : category}.</p>
          <button type="button" className="btn btn-primary" onClick={restartDeck}>Study again</button>
          <button type="button" className="btn btn-ghost" onClick={shuffleDeck}>Shuffle and restart</button>
        </main>
      ) : counter ? (
        <>
          <CounterStudyCard
            counter={counter}
            revealed={revealed}
            onReveal={() => setRevealed((current) => !current)}
          />
          <div className="counter-study-navigation">
            <button type="button" className="btn btn-ghost" onClick={previousCounter}>
              {index === 0 ? 'Study tools' : 'Previous'}
            </button>
            <button type="button" className="btn counter-next-button" onClick={nextCounter}>
              {index + 1 >= cards.length ? 'Finish set' : 'Next counter'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
