import { useEffect, useMemo, useState } from 'react'
import { getBeginnerDeck, type BeginnerCharacter, type BeginnerScript } from '../data/beginnerMnemonics'
import { hiraganaWordBank, type UnderstandingWord } from '../data/beginnerUnderstandingWords'
import { speakJapanese } from '../lib/speech'
import { SPEECH_SPEEDS } from '../lib/speechSpeeds'
import { BeginnerFinalChallenge } from './BeginnerFinalChallenge'
import { SpeakableWord } from './SpeakableWord'
import { StrokeOrderAnimation } from './StrokeOrderAnimation'
import { TraceCanvas } from './TraceCanvas'

/** How many words the trace-and-recall part of a row quiz shows before the
 *  blank-slate dictation word that closes out the quiz. */
const QUIZ_TRACE_WORDS = 2

/** Every listen button in this view forces the browser's own voice rather
 *  than the app's usual ElevenLabs clips — the hosted voice, tuned for
 *  fluent sentences, handled bare hiragana and hiragana-only words badly
 *  (clipped, then mispronounced, then just wrong) no matter how the
 *  request was tuned. A single character also gets no surrounding word to
 *  give the ear a beat to catch it in, so it needs to be slower than the
 *  pace a whole word reads fine at. */
const SINGLE_CHARACTER_SPEECH_RATE = 0.5

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
 * Mastery is per character and survives reloads, because a beginner working
 * through 46 characters will not do it in one sitting. Keyed by script so the
 * three decks never overwrite each other.
 */
const MASTERY_STORAGE_PREFIX = 'kq-beginner-mastery-'

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
  const [streak, setStreak] = useState(0)
  // Rows the learner has already passed a quiz for, this session — not
  // persisted, so returning later re-quizzes a row, which is fine practice.
  const [quizzedRows, setQuizzedRows] = useState<Record<number, boolean>>({})
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [quizWords, setQuizWords] = useState<UnderstandingWord[] | null>(null)
  const [quizPhase, setQuizPhase] = useState<'trace' | 'dictation'>('trace')
  const [quizTraceIndex, setQuizTraceIndex] = useState(0)
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [dictationRevealed, setDictationRevealed] = useState(false)

  const row = deck.rows[rowIndex]!
  // The row's characters, shuffled once per row so the learner does not
  // simply memorise the chart order instead of the characters. cardIndex
  // walks through it; Next/Previous just move the pointer.
  const [cards, setCards] = useState<BeginnerCharacter[]>(() => deck.rows[0]!.characters)
  const [cardIndex, setCardIndex] = useState(0)
  const card = cards[cardIndex]

  useEffect(() => {
    window.localStorage.setItem(storageKey(MASTERY_STORAGE_PREFIX, script), JSON.stringify(mastery))
  }, [mastery, script])

  function openRow(index: number) {
    setRowIndex(index)
    setCards(deck.rows[index]!.characters)
    setCardIndex(0)
    setQuizWords(null)
  }

  function startQuiz(index: number) {
    setQuizWords(pickQuizWords(deck.rows, index))
    setQuizPhase('trace')
    setQuizTraceIndex(0)
    setQuizRevealed(false)
    setDictationRevealed(false)
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

  function goPreviousQuizTrace() {
    setQuizRevealed(false)
    setQuizTraceIndex((current) => Math.max(0, current - 1))
  }

  function finishQuiz() {
    setQuizzedRows((current) => ({ ...current, [rowIndex]: true }))
    setQuizWords(null)
  }

  function goNext() {
    if (!card) return
    setMastery((current) => ({ ...current, [card.char]: MASTERY_TARGET }))
    setStreak((current) => current + 1)
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

      {challengeOpen ? (
        <BeginnerFinalChallenge deck={deck} onExit={() => { setChallengeOpen(false); openRow(0) }} />
      ) : quizWords ? (
        quizPhase === 'trace' && currentTraceWord ? (
          <main className="beginner-card">
            {/* Previous, the speaker, and Check meaning / Next word share one
                row. Hearing the word is the point of this screen, so the
                speaker is the prominent middle element and the two nav
                buttons flanking it are the same size as each other. */}
            <div className="beginner-top-actions beginner-top-actions--tight">
              <button
                type="button"
                className="btn btn-ghost beginner-action-btn beginner-quiz-nav-btn"
                onClick={goPreviousQuizTrace}
                disabled={quizTraceIndex === 0}
              >
                Previous
              </button>
              <button
                type="button"
                className="beginner-speak-btn beginner-speak-btn--quiz"
                onClick={() => speakJapanese(currentTraceWord.word, { rate: SPEECH_SPEEDS.learning, forceBrowser: true })}
                aria-label={`Play the word ${currentTraceWord.word}`}
              >
                <span aria-hidden="true">&#128266;</span>
                <em>Listen</em>
              </button>
              {quizRevealed ? (
                <button type="button" className="btn btn-primary beginner-action-btn beginner-action-btn-green beginner-quiz-nav-btn" onClick={advanceQuizTrace}>
                  Next word &rarr;
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary beginner-action-btn beginner-action-btn-green beginner-quiz-nav-btn"
                  onClick={() => setQuizRevealed(true)}
                >
                  Check meaning
                </button>
              )}
            </div>

            {/* The meaning gets its own full-width line rather than sitting
                inside the tracing panel — at this size it would cover the
                learner's own writing and collide with Clear. */}
            {quizRevealed && <p className="beginner-quiz-meaning">{currentTraceWord.meaning}</p>}

            <div className="beginner-write-stack">
              <div className="beginner-quiz-example">
                <StrokeOrderAnimation word={currentTraceWord.word} size="hero" />
              </div>
              <div className="beginner-write-section">
                <TraceCanvas key={currentTraceWord.word} char={currentTraceWord.word} />
              </div>
            </div>
          </main>
        ) : dictationWord ? (
          <main className="beginner-card">
            {/* Listen → write from memory → reveal. Before revealing, the
                only thing on screen is the speaker and a blank box, so the
                task is unambiguous; revealing puts the real word (drawn
                stroke by stroke) right beside their attempt to compare
                against, rather than scoring it out of a hundred. */}
            <span className="beginner-write-label">
              {dictationRevealed ? 'Compare yours with the answer' : 'Listen, then write it from memory'}
            </span>

            <div className="beginner-top-actions beginner-top-actions--tight">
              <span />
              <button
                type="button"
                className="beginner-speak-btn beginner-speak-btn--quiz"
                onClick={() => speakJapanese(dictationWord.word, { rate: SPEECH_SPEEDS.learning, forceBrowser: true })}
                aria-label={`Play the word ${dictationWord.word}`}
              >
                <span aria-hidden="true">&#128266;</span>
                <em>Listen</em>
              </button>
              {dictationRevealed ? (
                <button type="button" className="btn btn-primary beginner-action-btn beginner-action-btn-green beginner-quiz-nav-btn" onClick={finishQuiz}>
                  Finish quiz &rarr;
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary beginner-action-btn beginner-action-btn-green beginner-quiz-nav-btn"
                  onClick={() => setDictationRevealed(true)}
                >
                  Show answer
                </button>
              )}
            </div>

            {dictationRevealed && <p className="beginner-quiz-meaning">{dictationWord.meaning}</p>}

            {/* Same stacked layout as the trace phase — the two-column
                flashcard layout sizes each glyph for a single character, so
                a two-kana word wrapped into a giant vertical pile there. */}
            <div className="beginner-write-stack">
              {dictationRevealed && (
                <div className="beginner-quiz-example">
                  <StrokeOrderAnimation word={dictationWord.word} size="hero" />
                </div>
              )}
              <div className="beginner-write-section">
                <TraceCanvas key={dictationWord.word} char={dictationWord.word} showGuide={false} />
              </div>
            </div>
          </main>
        ) : null
      ) : rowComplete ? (
        <main className="beginner-card beginner-card-complete">
          <span className="beginner-complete-mark" aria-hidden="true">&#127881;</span>
          <h2>You learned</h2>
          <div className="beginner-complete-chars" lang="ja">
            {row.characters.map((entry) => <span key={entry.char}>{entry.char}</span>)}
          </div>
          <p>{rowNeedsQuiz ? 'Let’s build words.' : 'Keep going.'}</p>
          {rowNeedsQuiz ? (
            <button type="button" className="btn btn-primary" onClick={() => startQuiz(rowIndex)}>Row quiz &rarr;</button>
          ) : nextRowIndex === null ? (
            <button type="button" className="btn btn-primary" onClick={() => setChallengeOpen(true)}>Final challenge &rarr;</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => openRow(nextRowIndex)}>
              Next: {deck.rows[nextRowIndex]!.label} &rarr;
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => openRow(rowIndex)}>Practice this row again</button>
        </main>
      ) : card ? (
        <main className="beginner-card is-revealed">
          {script !== 'hiragana' && (
            <p className="beginner-char" lang="ja">
              <SpeakableWord text={card.char}>{card.char}</SpeakableWord>
            </p>
          )}

          {/* Previous, a prominent speaker button, and Next sit above the
              writing area. Hearing the character is the point of this
              button, so it's bigger and louder than the nav buttons either
              side of it — Check moved into the tracing panel itself
              (compactCheck below) so this row stays about pronunciation,
              not scoring. */}
          <div className="beginner-top-actions">
            <button type="button" className="btn btn-ghost beginner-action-btn" onClick={goPrevious} disabled={cardIndex === 0}>Previous</button>
            <button
              type="button"
              className="beginner-speak-btn"
              // Slower than the app's usual "learning" pace — a single
              // character has no surrounding word to give the ear a beat to
              // catch it in, so the standard slowdown still reads as rushed
              // here even though it's plenty for whole words elsewhere.
              onClick={() => speakJapanese(card.char, { rate: SINGLE_CHARACTER_SPEECH_RATE, forceBrowser: true })}
              aria-label={`Play the sound for ${card.char}`}
            >
              &#128266;
            </button>
            <button type="button" className="btn btn-primary beginner-action-btn beginner-action-btn-green" onClick={goNext}>Next</button>
          </div>

          {/* Writing lives right under the character itself — trace it while
              it's fresh on screen, rather than as a separate mode to switch
              into. Keyed on the character so a fresh canvas loads per card.
              On desktop the example and the tracing box sit side by side,
              with tracing given most of the width since it's what you use. */}
          <div className="beginner-write-layout">
            {script === 'hiragana' && (
              <div className="beginner-char-listen">
                <StrokeOrderAnimation word={card.char} size="hero" />
              </div>
            )}
            <div className="beginner-write-section">
              <TraceCanvas key={card.char} char={card.char} />
            </div>
          </div>

          {card.meaning && (
            <div className="beginner-answer">
              <span className="beginner-meaning">{card.meaning}</span>
            </div>
          )}
        </main>
      ) : null}
    </div>
  )
}
