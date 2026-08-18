import { useEffect, useMemo, useState } from 'react'
import { getBeginnerDeck, type BeginnerCharacter, type BeginnerScript } from '../data/beginnerMnemonics'
import { SpeakableWord } from './SpeakableWord'
import { TraceCanvas } from './TraceCanvas'

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
const TRACE_STORAGE_PREFIX = 'kq-beginner-trace-'

/** How many correct recalls in a row retire a character from the row. */
const MASTERY_TARGET = 2

/** Trace score (0-100) at or above which a character counts as "traced well". */
const TRACE_TARGET = 65

type BeginnerMode = 'learn' | 'write'

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

function shuffled<T>(items: readonly T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  }
  return copy
}

export function BeginnerLearner({ script, onBack }: BeginnerLearnerProps) {
  const deck = useMemo(() => getBeginnerDeck(script), [script])
  const [mode, setMode] = useState<BeginnerMode>('learn')
  const [rowIndex, setRowIndex] = useState(0)
  const [mastery, setMastery] = useState<Record<string, number>>(() => loadNumberMap(storageKey(MASTERY_STORAGE_PREFIX, script)))
  const [traceScores, setTraceScores] = useState<Record<string, number>>(() => loadNumberMap(storageKey(TRACE_STORAGE_PREFIX, script)))
  const [revealed, setRevealed] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [traceIndex, setTraceIndex] = useState(0)

  const row = deck.rows[rowIndex]!
  // The queue is the row's characters, shuffled once per row so the learner
  // does not simply memorise the chart order instead of the characters.
  const [queue, setQueue] = useState<BeginnerCharacter[]>(() => shuffled(deck.rows[0]!.characters))
  const card = queue[0]
  const traceChar = row.characters[traceIndex]

  useEffect(() => {
    window.localStorage.setItem(storageKey(MASTERY_STORAGE_PREFIX, script), JSON.stringify(mastery))
  }, [mastery, script])

  useEffect(() => {
    window.localStorage.setItem(storageKey(TRACE_STORAGE_PREFIX, script), JSON.stringify(traceScores))
  }, [traceScores, script])

  function openRow(index: number) {
    setRowIndex(index)
    setQueue(shuffled(deck.rows[index]!.characters))
    setRevealed(false)
    setTraceIndex(0)
  }

  function switchMode(next: BeginnerMode) {
    setMode(next)
    setTraceIndex(0)
  }

  function recordTraceScore(char: string, score: number) {
    setTraceScores((current) => ({
      ...current,
      // Keep the learner's personal best rather than their latest attempt —
      // a single rough retry right after a clean trace shouldn't erase it.
      [char]: Math.max(current[char] ?? 0, score),
    }))
  }

  function scoreCard(known: boolean) {
    if (!card) return
    setMastery((current) => ({
      ...current,
      // A miss resets to zero rather than decrementing: the point of the
      // mnemonic is instant recognition, and "almost knew it" is still a miss.
      [card.char]: known ? (current[card.char] ?? 0) + 1 : 0,
    }))
    setStreak((current) => {
      const next = known ? current + 1 : 0
      setBestStreak((best) => Math.max(best, next))
      return next
    })
    setQueue((current) => {
      const [head, ...rest] = current
      if (!head) return current
      const score = known ? (mastery[head.char] ?? 0) + 1 : 0
      // Mastered cards leave the queue; missed ones go to the back so they
      // come round again in this same sitting.
      return score >= MASTERY_TARGET ? rest : [...rest, head]
    })
    setRevealed(false)
  }

  const rowMastered = row.characters.filter((entry) => (mastery[entry.char] ?? 0) >= MASTERY_TARGET).length
  const rowComplete = queue.length === 0
  const nextRowIndex = rowIndex + 1 < deck.rows.length ? rowIndex + 1 : null
  const rowTraced = row.characters.filter((entry) => (traceScores[entry.char] ?? 0) >= TRACE_TARGET).length

  return (
    <div className="beginner-learner">
      <div className="beginner-learner-top">
        <button type="button" className="beginner-back" onClick={onBack} aria-label="Back to Beginner Zone">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          <span>Back</span>
        </button>
        <span className="beginner-learner-title">{deck.title}</span>
        {mode === 'learn' ? (
          <span className="beginner-streak" title="Correct in a row">
            <span aria-hidden="true">&#128293;</span>
            <b>{streak}</b>
          </span>
        ) : (
          <span className="beginner-streak beginner-streak-placeholder" aria-hidden="true" />
        )}
      </div>

      <div className="beginner-mode-tabs" role="tablist" aria-label="Practice mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'learn'}
          className={`beginner-mode-tab${mode === 'learn' ? ' is-active' : ''}`}
          onClick={() => switchMode('learn')}
        >
          Learn
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'write'}
          className={`beginner-mode-tab${mode === 'write' ? ' is-active' : ''}`}
          onClick={() => switchMode('write')}
        >
          Write
        </button>
      </div>

      <div className="beginner-row-tabs" role="tablist" aria-label={`${deck.title} rows`}>
        {deck.rows.map((entry, index) => {
          const masteredCount = mode === 'learn'
            ? entry.characters.filter((c) => (mastery[c.char] ?? 0) >= MASTERY_TARGET).length
            : entry.characters.filter((c) => (traceScores[c.char] ?? 0) >= TRACE_TARGET).length
          const done = masteredCount === entry.characters.length
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={index === rowIndex}
              className={`beginner-row-tab${index === rowIndex ? ' is-active' : ''}${done ? ' is-done' : ''}`}
              onClick={() => openRow(index)}
              title={`${entry.label} — ${masteredCount}/${entry.characters.length} ${mode === 'learn' ? 'learned' : 'traced well'}`}
            >
              <span>{entry.label}</span>
              <small>{masteredCount}/{entry.characters.length}</small>
            </button>
          )
        })}
      </div>

      {mode === 'write' ? (
        traceChar ? (
          <main className="beginner-card beginner-trace-card">
            <p className="beginner-trace-hint">
              Trace <b lang="ja">{traceChar.char}</b> ({traceChar.romaji}) over the gray guide.
            </p>
            <TraceCanvas key={traceChar.char} char={traceChar.char} onScored={(score) => recordTraceScore(traceChar.char, score)} />
            <div className="beginner-trace-nav">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setTraceIndex((current) => Math.max(0, current - 1))}
                disabled={traceIndex === 0}
              >
                &larr; Previous
              </button>
              <span className="beginner-card-footer">
                {row.label} &middot; {rowTraced} of {row.characters.length} traced well
              </span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setTraceIndex((current) => Math.min(row.characters.length - 1, current + 1))}
                disabled={traceIndex >= row.characters.length - 1}
              >
                Next &rarr;
              </button>
            </div>
          </main>
        ) : null
      ) : rowComplete ? (
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
          {nextRowIndex === null ? (
            <button type="button" className="btn btn-primary" onClick={onBack}>Finish {deck.title} &rarr;</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => openRow(nextRowIndex)}>
              Next: {deck.rows[nextRowIndex]!.label} &rarr;
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => openRow(rowIndex)}>Practise this row again</button>
        </main>
      ) : card ? (
        <main className={`beginner-card${revealed ? ' is-revealed' : ''}`}>
          <p className="beginner-char" lang="ja">
            <SpeakableWord text={card.char}>{card.char}</SpeakableWord>
          </p>

          {revealed ? (
            <div className="beginner-answer">
              <b className="beginner-romaji">{card.romaji}</b>
              {card.meaning && <span className="beginner-meaning">{card.meaning}</span>}
              {/* The mnemonic is the whole point of this deck — it gets the
                  visual weight, not the romaji. */}
              <p className="beginner-mnemonic">
                <span className="beginner-mnemonic-label">Remember it</span>
                {card.mnemonic}
              </p>
              <div className="beginner-score-buttons">
                <button type="button" className="btn btn-ghost" onClick={() => scoreCard(false)}>Not yet</button>
                <button type="button" className="btn btn-primary" onClick={() => scoreCard(true)}>I knew it</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-primary beginner-reveal" onClick={() => setRevealed(true)}>
              Show the sound
            </button>
          )}

          <p className="beginner-card-footer">
            {row.label} &middot; {rowMastered} of {row.characters.length} learned &middot; {queue.length} left this round
          </p>
        </main>
      ) : null}
    </div>
  )
}
