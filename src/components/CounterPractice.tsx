import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  COUNTER_CATEGORIES,
  COUNTER_QUIZ_VARIANTS,
  COUNTER_QUIZZES,
  JAPANESE_COUNTERS,
  type CounterCategory,
  type CounterQuiz,
  type JapaneseCounter,
} from '../data/japaneseCounters'
import { FuriganaSegment, getFuriganaRuns } from './FuriganaText'
import { SpeakableWord, useSpeakable } from './SpeakableWord'

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

function CounterQuizBlank({ answer, revealed }: { answer: string; revealed: boolean }) {
  return (
    <ruby className="counter-quiz-blank-ruby">
      <span className={`counter-quiz-blank${revealed ? ' is-revealed' : ''}`}>
        <span className="counter-quiz-blank-answer" aria-hidden="true">{answer}</span>
        <span className="counter-quiz-answer-display">{revealed ? answer : '？'}</span>
      </span>
      <rt className="counter-quiz-blank-reading" aria-hidden="true">&nbsp;</rt>
    </ruby>
  )
}

function counterPromptSpeechText(quiz: CounterQuiz) {
  const answerStart = quiz.completed.indexOf(quiz.answer)
  if (answerStart < 0) return quiz.prompt.replace('___', '、')

  let expressionStart = answerStart
  while (expressionStart > 0 && /[一二三四五六七八九十百千万〇零]/.test(quiz.completed[expressionStart - 1]!)) {
    expressionStart -= 1
  }

  return `${quiz.completed.slice(0, expressionStart)}、${quiz.completed.slice(answerStart + quiz.answer.length)}`
}

function CounterPromptSentence({
  quiz,
  answered,
  showFurigana,
}: {
  quiz: CounterQuiz
  answered: boolean
  showFurigana: boolean
}) {
  const furiganaClass = showFurigana ? '' : ' is-furigana-hidden'
  const answerStart = quiz.completed.indexOf(quiz.answer)
  if (answerStart < 0) {
    const [before, after] = quiz.prompt.split('___')
    return <><span>{before}</span><CounterQuizBlank answer={quiz.answer} revealed={answered} /><span>{after}</span></>
  }

  const answerEnd = answerStart + quiz.answer.length
  let surfaceOffset = 0
  let blankRendered = false

  return (
    <span className={`counter-prompt-furigana${furiganaClass}`}>
      {getFuriganaRuns(quiz.completed, quiz.reading).flatMap((run, index) => {
        const runStart = surfaceOffset
        const runEnd = runStart + run.text.length
        surfaceOffset = runEnd

        if (runEnd <= answerStart || runStart >= answerEnd) {
          return run.reading
            ? <ruby key={`run-${index}`} className="furigana-ruby">{run.text}<rt>{run.reading}</rt></ruby>
            : <span key={`run-${index}`}>{run.text}</span>
        }

        const pieces: React.ReactNode[] = []
        const prefixLength = Math.max(0, answerStart - runStart)
        const suffixStart = Math.max(0, answerEnd - runStart)
        if (prefixLength > 0) pieces.push(<span key={`prefix-${index}`}>{run.text.slice(0, prefixLength)}</span>)
        if (!blankRendered) {
          pieces.push(<CounterQuizBlank key="blank" answer={quiz.answer} revealed={answered} />)
          blankRendered = true
        }
        if (suffixStart < run.text.length) pieces.push(<span key={`suffix-${index}`}>{run.text.slice(suffixStart)}</span>)
        return pieces
      })}
    </span>
  )
}

function CounterStudyCard({
  counter,
  quizRun,
  showEnglish,
  showFurigana,
  onToggleEnglish,
  onToggleFurigana,
  selected,
  onSelect,
}: {
  counter: JapaneseCounter
  quizRun: number
  showEnglish: boolean
  showFurigana: boolean
  onToggleEnglish: () => void
  onToggleFurigana: () => void
  selected: string | null
  onSelect: (option: string, answer: string) => void
}) {
  const quizPool = useMemo(
    () => [COUNTER_QUIZZES[counter.id]!, ...(COUNTER_QUIZ_VARIANTS[counter.id] ?? [])],
    [counter.id],
  )
  const counterOffset = [...counter.id].reduce((total, character) => total + character.charCodeAt(0), 0)
  const quiz = quizPool[(quizRun + counterOffset) % quizPool.length]!
  const options = useMemo(() => shuffled(quiz.options), [quiz.options])
  const answered = selected !== null
  const correct = selected === quiz.answer
  const promptSpeech = useSpeakable(answered ? quiz.completed : counterPromptSpeechText(quiz))
  const promptRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const element = promptRef.current
    if (!element) return

    let active = true
    function fitPrompt() {
      if (!active || !element) return
      element.style.removeProperty('font-size')
      const fullSize = Number.parseFloat(window.getComputedStyle(element).fontSize)
      const availableWidth = element.clientWidth
      const renderedWidth = element.scrollWidth
      if (renderedWidth <= availableWidth || !renderedWidth) return
      const minimumSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) * .9
      element.style.fontSize = `${Math.max(minimumSize, fullSize * (availableWidth / renderedWidth))}px`
    }

    fitPrompt()
    const observer = new ResizeObserver(fitPrompt)
    observer.observe(element)
    document.fonts?.ready.then(fitPrompt)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [quiz.completed])

  return (
    <main className={`counter-study-card counter-quiz-card${answered ? ' is-answered' : ''}`}>
      <div className="counter-study-card-top">
        <span className="counter-category-badge">{counter.category}</span>
        <div className="control-group control-group-primary-options counter-card-display-options" role="group" aria-label="Display options">
          <button
            type="button"
            className={`control-chip control-chip-compact${showFurigana ? ' is-active' : ''}`}
            onClick={onToggleFurigana}
            aria-pressed={showFurigana}
            aria-label="Toggle furigana"
            title="Furigana"
          >
            &#12405;&#12426;
          </button>
          <button
            type="button"
            className={`control-chip control-chip-compact${showEnglish ? ' is-active' : ''}`}
            onClick={onToggleEnglish}
            aria-pressed={showEnglish}
            aria-label="Toggle English translation"
            title="English"
          >
            EN
          </button>
        </div>
      </div>

      <div className="counter-quiz-prompt">
        <p
          {...promptSpeech.triggerProps}
          ref={promptRef}
          className={promptSpeech.isSpeaking ? 'is-speaking' : ''}
          lang="ja"
        >
          <CounterPromptSentence quiz={quiz} answered={answered} showFurigana={showFurigana} />
        </p>
        <span
          className={`counter-question-english${showEnglish ? '' : ' is-hidden'}`}
          aria-hidden={!showEnglish}
        >
          {quiz.english}
        </span>
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
              onClick={() => onSelect(option, quiz.answer)}
            >
              {option}
            </button>
          )
        })}
      </div>

      {answered && (
        <section className={`counter-quiz-feedback${correct ? ' is-correct' : ' is-wrong'}`} aria-live="polite">
          <SpeakableWord text={quiz.completed} className="counter-sentence-example">
            <span
              className={`counter-sentence-japanese${showFurigana ? '' : ' is-furigana-hidden'}`}
              lang="ja"
            >
              <FuriganaSegment text={quiz.completed} reading={quiz.reading} />
            </span>
            <span
              className={`counter-sentence-english${showEnglish ? '' : ' is-hidden'}`}
              aria-hidden={!showEnglish}
            >
              {quiz.english}
            </span>
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
  const [quizRun, setQuizRun] = useState(() => Math.floor(Math.random() * 1000))
  const [showEnglish, setShowEnglish] = useState(true)
  const [showFurigana, setShowFurigana] = useState(true)
  const [shuffleMode, setShuffleMode] = useState(false)
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)
  const categoryPickerRef = useRef<HTMLDivElement>(null)

  const cards = useMemo(
    () => category === 'All' ? deck : deck.filter((counter) => counter.category === category),
    [category, deck],
  )
  const counter = cards[index] ?? cards[0]
  const categoryLabel = category === 'All' ? `All ${JAPANESE_COUNTERS.length}` : category
  const correctCount = cards.filter((item) => correctIds.has(item.id)).length
  const accuracy = Math.round((correctCount / Math.max(cards.length, 1)) * 100)
  const completionMessage = accuracy >= 80 ? 'Strong finish' : accuracy >= 60 ? 'Good progress' : 'Ready for another round'

  useEffect(() => {
    if (!categoryMenuOpen) return

    function closeCategoryMenu(event: PointerEvent) {
      if (!categoryPickerRef.current?.contains(event.target as Node)) setCategoryMenuOpen(false)
    }

    function closeCategoryMenuOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setCategoryMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeCategoryMenu)
    document.addEventListener('keydown', closeCategoryMenuOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeCategoryMenu)
      document.removeEventListener('keydown', closeCategoryMenuOnEscape)
    }
  }, [categoryMenuOpen])

  function chooseCategory(nextCategory: CategoryFilter) {
    setCategory(nextCategory)
    setIndex(0)
    setSelected(null)
    setCorrectIds(new Set())
    setCompleted(false)
    setQuizRun((current) => current + 1)
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
    if (shuffleMode) {
      const remainingCards = cards.slice(index + 1)
      const randomCounter = remainingCards[Math.floor(Math.random() * remainingCards.length)]!
      const sequentialCounter = cards[index + 1]!
      if (randomCounter.id !== sequentialCounter.id) {
        setDeck((current) => {
          const copy = [...current]
          const randomIndex = copy.findIndex((item) => item.id === randomCounter.id)
          const sequentialIndex = copy.findIndex((item) => item.id === sequentialCounter.id)
          ;[copy[randomIndex], copy[sequentialIndex]] = [copy[sequentialIndex]!, copy[randomIndex]!]
          return copy
        })
      }
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
    setQuizRun((current) => current + 1)
  }

  function restartDeck() {
    setIndex(0)
    setSelected(null)
    setCorrectIds(new Set())
    setCompleted(false)
    setQuizRun((current) => current + 1)
  }

  function selectCounter(option: string, answer: string) {
    if (!counter || selected !== null) return
    setSelected(option)
    if (option === answer) {
      setCorrectIds((current) => new Set(current).add(counter.id))
    }
  }

  return (
    <div className="counter-practice">
      <header className="counter-practice-top">
        <button
          type="button"
          className="vocab-back-arrow"
          onClick={onBack}
          aria-label="Back to study tools"
          title="Back to study tools"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div className="counter-practice-title">
          <h1>Japanese counters</h1>
        </div>
        <div className="counter-header-actions">
          <div className="counter-category-picker" ref={categoryPickerRef}>
            <button
              type="button"
              className={`counter-category-button${categoryMenuOpen ? ' is-open' : ''}`}
              onClick={() => setCategoryMenuOpen((open) => !open)}
              aria-label={`Choose counter category. Current category: ${categoryLabel}`}
              aria-haspopup="menu"
              aria-expanded={categoryMenuOpen}
              aria-controls="counter-category-menu"
              title="Counter category"
            >
              <span className="counter-category-button-mark" aria-hidden="true">数</span>
              <span className="counter-category-button-text">{categoryLabel}</span>
              <span className="counter-category-button-chevron" aria-hidden="true">&#9662;</span>
            </button>
            {categoryMenuOpen && (
              <div className="counter-category-menu" id="counter-category-menu" role="menu" aria-label="Counter categories">
                {(['All', ...COUNTER_CATEGORIES] as const).map((item) => {
                  const label = item === 'All' ? 'All' : item
                  const counterCount = item === 'All'
                    ? JAPANESE_COUNTERS.length
                    : JAPANESE_COUNTERS.filter((counterItem) => counterItem.category === item).length
                  return (
                    <button
                      key={item}
                      type="button"
                      role="menuitemradio"
                      aria-checked={category === item}
                      className={category === item ? 'is-active' : ''}
                      onClick={() => {
                        chooseCategory(item)
                        setCategoryMenuOpen(false)
                      }}
                    >
                      <span>{label}</span>
                      <span className="counter-category-menu-count">{counterCount}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            className={`counter-shuffle-toggle${shuffleMode ? ' is-active' : ''}`}
            onClick={() => setShuffleMode((enabled) => !enabled)}
            role="switch"
            aria-checked={shuffleMode}
            aria-label="Random counter order"
            title="Random counter order"
          >
            <span className="control-toggle-track" aria-hidden="true"><span /></span>
            <span>Shuffle</span>
          </button>
        </div>
      </header>

      {completed ? (
        <main className="counter-study-complete">
          <header className="counter-complete-heading">
            <span className="counter-complete-mark" lang="ja">数</span>
            <div>
              <span>{categoryLabel}</span>
              <h2>Set complete</h2>
              <p>{completionMessage}</p>
            </div>
          </header>

          <section className="counter-complete-stats" aria-label="Counter results">
            <div>
              <strong>{correctCount}</strong>
              <span>Correct</span>
            </div>
            <div>
              <strong>{cards.length - correctCount}</strong>
              <span>Review</span>
            </div>
            <div>
              <strong>{accuracy}%</strong>
              <span>Accuracy</span>
            </div>
          </section>

          <div className="counter-complete-actions">
            <button type="button" className="btn btn-ghost" onClick={shuffleDeck}>Shuffle set</button>
            <button type="button" className="btn btn-primary" onClick={restartDeck}>Study again</button>
          </div>
        </main>
      ) : counter ? (
        <>
          <CounterStudyCard
            counter={counter}
            quizRun={quizRun}
            showEnglish={showEnglish}
            showFurigana={showFurigana}
            onToggleEnglish={() => setShowEnglish((visible) => !visible)}
            onToggleFurigana={() => setShowFurigana((visible) => !visible)}
            selected={selected}
            onSelect={selectCounter}
          />
          <div className="counter-study-navigation standard-kanji-action-row">
            <button
              type="button"
              className="btn btn-ghost standard-kanji-review"
              onClick={previousCounter}
              disabled={index === 0}
            >
              Previous counter
            </button>
            <button type="button" className="btn counter-next-button" onClick={nextCounter} disabled={selected === null}>
              {selected === null ? 'Choose an answer' : index + 1 >= cards.length ? 'Finish set' : shuffleMode ? 'Random counter' : 'Next counter'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
