import { useEffect, useMemo, useState } from 'react'
import { getBeginnerDeck, type BeginnerCharacter, type BeginnerScript } from '../data/beginnerMnemonics'
import { hiraganaWordBank, type UnderstandingWord } from '../data/beginnerUnderstandingWords'
import { speakJapanese } from '../lib/speech'
import { SpeakableWord } from './SpeakableWord'
import { StrokeOrderAnimation } from './StrokeOrderAnimation'
import { TraceCanvas } from './TraceCanvas'

/** How many words the trace-and-recall part of a row quiz shows before the
 *  blank-slate dictation word that actually passes the quiz. */
const QUIZ_TRACE_WORDS = 2
/** Dictation score needed to pass a row quiz — generous, since writing a
 *  whole word from memory after five new characters is genuinely hard. */
const QUIZ_PASS_SCORE = 45

function shuffled<T>(items: readonly T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  }
  return copy
}

/** Words usable once `rows[0..rowIndex]` are learned, preferring ones that
 *  actually exercise a character from the row just finished so the quiz
 *  tests new content rather than only what was already known. */
function pickQuizWords(rows: { characters: BeginnerCharacter[] }[], rowIndex: number): UnderstandingWord[] {
  const available = new Set(rows.slice(0, rowIndex + 1).flatMap((r) => r.characters.map((c) => c.char)))
  const newChars = new Set(rows[rowIndex]!.characters.map((c) => c.char))
  const eligible = hiraganaWordBank.filter((entry) => [...entry.word].every((ch) => available.has(ch)))
  const preferred = eligible.filter((entry) => [...entry.word].some((ch) => newChars.has(ch)))
  const pool = preferred.length >= QUIZ_TRACE_WORDS + 1 ? preferred : eligible
  return shuffled(pool).slice(0, QUIZ_TRACE_WORDS + 1)
}

interface BeginnerLearnerProps {
  script: BeginnerScript
  onBack: () => void
}

/**
 * Mastery and trace scores are per character and survive reloads, because a
 * beginner working through 46 characters will not do it in one sitting.
 * Keyed by script so the three decks never overwrite each other.
 */
const MASTERY_STORAGE_PREFIX = 'kq-beginner-mastery-'
const TRACE_STORAGE_PREFIX = 'kq-beginner-trace-'

/** How many correct recalls in a row retire a character from the row. */
const MASTERY_TARGET = 2

function storageKey(prefix: string, script: BeginnerScript) {
  return `${prefix}${script}`
}

function loadNumberMap(key: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    // Written by us, but a hand-edited or half-written value should degrade to
    // "not learned yet" rather than crashing the deck on open.
    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

export function BeginnerLearner({ script, onBack }: BeginnerLearnerProps) {
  const deck = useMemo(() => getBeginnerDeck(script), [script])
  const [rowIndex, setRowIndex] = useState(0)
  const [mastery, setMastery] = useState<Record<string, number>>(() => loadNumberMap(storageKey(MASTERY_STORAGE_PREFIX, script)))
  const [traceScores, setTraceScores] = useState<Record<string, number>>(() => loadNumberMap(storageKey(TRACE_STORAGE_PREFIX, script)))
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  // Rows the learner has already passed a quiz for, this session — not
  // persisted, so returning later re-quizzes a row, which is fine practice.
  const [quizzedRows, setQuizzedRows] = useState<Record<number, boolean>>({})
  const [quizWords, setQuizWords] = useState<UnderstandingWord[] | null>(null)
  const [quizPhase, setQuizPhase] = useState<'trace' | 'dictation'>('trace')
  const [quizTraceIndex, setQuizTraceIndex] = useState(0)
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [dictationResult, setDictationResult] = useState<{ score: number; passed: boolean } | null>(null)

  const row = deck.rows[rowIndex]!
  // The row's characters, shuffled once per row so the learner does not
  // simply memorise the chart order instead of the characters. cardIndex
  // walks through it; Next/Previous just move the pointer.
  const [cards, setCards] = useState<BeginnerCharacter[]>(() => shuffled(deck.rows[0]!.characters))
  const [cardIndex, setCardIndex] = useState(0)
  const card = cards[cardIndex]

  useEffect(() => {
    window.localStorage.setItem(storageKey(MASTERY_STORAGE_PREFIX, script), JSON.stringify(mastery))
  }, [mastery, script])

  useEffect(() => {
    window.localStorage.setItem(storageKey(TRACE_STORAGE_PREFIX, script), JSON.stringify(traceScores))
  }, [traceScores, script])

  function openRow(index: number) {
    setRowIndex(index)
    setCards(shuffled(deck.rows[index]!.characters))
    setCardIndex(0)
    setQuizWords(null)
  }

  function startQuiz(index: number) {
    setQuizWords(pickQuizWords(deck.rows, index))
    setQuizPhase('trace')
    setQuizTraceIndex(0)
    setQuizRevealed(false)
    setDictationResult(null)
  }

  function advanceQuizTrace() {
    setQuizRevealed(false)
    setQuizTraceIndex((current) => {
      const next = current + 1
      if (next >= (quizWords?.length ?? 1) - 1) {
        setQuizPhase('dictation')
      }
      return next
    })
  }

  function finishQuiz() {
    setQuizzedRows((current) => ({ ...current, [rowIndex]: true }))
    setQuizWords(null)
  }

  function recordTraceScore(char: string, score: number) {
    setTraceScores((current) => ({
      ...current,
      // Keep the learner's personal best rather than their latest attempt —
      // a single rough retry right after a clean trace shouldn't erase it.
      [char]: Math.max(current[char] ?? 0, score),
    }))
  }

  function goNext() {
    if (!card) return
    setMastery((current) => ({ ...current, [card.char]: MASTERY_TARGET }))
    setStreak((current) => {
      const next = current + 1
      setBestStreak((best) => Math.max(best, next))
      return next
    })
    setCardIndex((current) => current + 1)
  }

  function goPrevious() {
    setCardIndex((current) => Math.max(0, current - 1))
  }

  const rowComplete = cardIndex >= cards.length
  const nextRowIndex = rowIndex + 1 < deck.rows.length ? rowIndex + 1 : null
  const rowNeedsQuiz = script === 'hiragana' && !quizzedRows[rowIndex]
  const traceWords = quizWords?.slice(0, -1) ?? []
  const dictationWord = quizWords?.[quizWords.length - 1] ?? null
  const currentTraceWord = traceWords[quizTraceIndex]

  return (
    <div className="beginner-learner">
      <div className="beginner-learner-top">
        <button type="button" className="beginner-back" onClick={onBack} aria-label="Back to Beginner Zone">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          <span>Back</span>
        </button>
        <span className="beginner-learner-title">{deck.title}</span>
        <span className="beginner-streak" title="Correct in a row">
          <span aria-hidden="true">&#128293;</span>
          <b>{streak}</b>
        </span>
      </div>

      <div className="beginner-row-tabs" role="tablist" aria-label={`${deck.title} rows`}>
        {deck.rows.map((entry, index) => {
          const masteredCount = entry.characters.filter((c) => (mastery[c.char] ?? 0) >= MASTERY_TARGET).length
          const done = masteredCount === entry.characters.length
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={index === rowIndex}
              className={`beginner-row-tab${index === rowIndex ? ' is-active' : ''}${done ? ' is-done' : ''}`}
              onClick={() => openRow(index)}
              title={`${entry.label} — ${masteredCount}/${entry.characters.length} learned`}
            >
              <span>{entry.label}</span>
              <small>{masteredCount}/{entry.characters.length}</small>
            </button>
          )
        })}
      </div>

      {rowComplete ? (
        <main className="beginner-card beginner-card-complete">
          <span className="beginner-complete-mark" aria-hidden="true">&#127881;</span>
          <h2>{row.label} learned</h2>
          <p>
            You recalled all {row.characters.length} characters
            {bestStreak > 1 ? ` with a best streak of ${bestStreak}` : ''}.
          </p>
          <div className="beginner-complete-chars" lang="ja" aria-hidden="true">
            {row.characters.map((entry) => <span key={entry.char}>{entry.char}</span>)}
          </div>
          {rowNeedsQuiz ? (
            <button type="button" className="btn btn-primary" onClick={() => startQuiz(rowIndex)}>Row quiz &rarr;</button>
          ) : nextRowIndex === null ? (
            <button type="button" className="btn btn-primary" onClick={onBack}>Finish {deck.title} &rarr;</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => openRow(nextRowIndex)}>
              Next: {deck.rows[nextRowIndex]!.label} &rarr;
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => openRow(rowIndex)}>Practise this row again</button>
        </main>
      ) : quizWords ? (
        quizPhase === 'trace' && currentTraceWord ? (
          <main className="beginner-card">
            <span className="beginner-write-label">Row quiz — word {quizTraceIndex + 1} of {traceWords.length}</span>
            <p className="beginner-char" lang="ja">
              <SpeakableWord text={currentTraceWord.word}>{currentTraceWord.word}</SpeakableWord>
            </p>

            <div className="beginner-write-section">
              <StrokeOrderAnimation word={currentTraceWord.word} />
              <TraceCanvas key={currentTraceWord.word} char={currentTraceWord.word} />
            </div>

            {quizRevealed ? (
              <div className="beginner-answer">
                <p className="beginner-mnemonic">
                  <span className="beginner-mnemonic-label">Means</span>
                  {currentTraceWord.meaning}
                </p>
                <div className="beginner-score-buttons">
                  <button type="button" className="btn btn-primary" onClick={advanceQuizTrace}>Next word &rarr;</button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-primary beginner-reveal" onClick={() => setQuizRevealed(true)}>
                Check meaning
              </button>
            )}
          </main>
        ) : dictationWord ? (
          <main className="beginner-card">
            <span className="beginner-write-label">Listen, then write it from memory</span>
            <button
              type="button"
              className="btn btn-primary beginner-reveal"
              onClick={() => speakJapanese(dictationWord.word)}
            >
              &#128264; Play the word
            </button>

            <div className="beginner-write-section">
              <TraceCanvas
                key={dictationWord.word}
                char={dictationWord.word}
                showGuide={false}
                onScored={(score) => setDictationResult({ score, passed: score >= QUIZ_PASS_SCORE })}
              />
            </div>

            {dictationResult && (
              <div className="beginner-answer">
                <p className="beginner-char" lang="ja">{dictationWord.word}</p>
                <p className="beginner-mnemonic">
                  <span className="beginner-mnemonic-label">Means</span>
                  {dictationWord.meaning}
                </p>
                {dictationResult.passed ? (
                  <div className="beginner-score-buttons">
                    <button type="button" className="btn btn-primary" onClick={finishQuiz}>Quiz passed &rarr;</button>
                  </div>
                ) : (
                  <div className="beginner-score-buttons">
                    <button type="button" className="btn btn-ghost" onClick={() => setDictationResult(null)}>Try again</button>
                  </div>
                )}
              </div>
            )}
          </main>
        ) : null
      ) : card ? (
        <main className="beginner-card is-revealed">
          <p className="beginner-char" lang="ja">
            <SpeakableWord text={card.char}>{card.char}</SpeakableWord>
          </p>

          {/* Writing lives right under the character itself — trace it while
              it's fresh on screen, rather than as a separate mode to switch
              into. Keyed on the character so a fresh canvas loads per card. */}
          <div className="beginner-write-section">
            <span className="beginner-write-label">Practice writing it</span>
            {script === 'hiragana' && <StrokeOrderAnimation word={card.char} />}
            <TraceCanvas key={card.char} char={card.char} onScored={(score) => recordTraceScore(card.char, score)} />
          </div>

          <div className="beginner-answer">
            {card.meaning && <span className="beginner-meaning">{card.meaning}</span>}
            <div className="beginner-score-buttons">
              <button type="button" className="btn btn-ghost" onClick={goPrevious} disabled={cardIndex === 0}>Previous</button>
              <button type="button" className="btn btn-primary" onClick={goNext}>Next</button>
            </div>
          </div>
        </main>
      ) : null}
    </div>
  )
}
