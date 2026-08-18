import { useEffect, useMemo, useState } from 'react'
import { getBeginnerDeck, type BeginnerCharacter, type BeginnerScript } from '../data/beginnerMnemonics'
import { SpeakableWord } from './SpeakableWord'

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

function storageKey(script: BeginnerScript) {
  return `${MASTERY_STORAGE_PREFIX}${script}`
}

function loadMastery(script: BeginnerScript): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(storageKey(script))
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
  const [rowIndex, setRowIndex] = useState(0)
  const [mastery, setMastery] = useState<Record<string, number>>(() => loadMastery(script))
  const [revealed, setRevealed] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)

  const row = deck.rows[rowIndex]!
  // The queue is the row's characters, shuffled once per row so the learner
  // does not simply memorise the chart order instead of the characters.
  const [queue, setQueue] = useState<BeginnerCharacter[]>(() => shuffled(deck.rows[0]!.characters))
  const card = queue[0]

  useEffect(() => {
    window.localStorage.setItem(storageKey(script), JSON.stringify(mastery))
  }, [mastery, script])

  function openRow(index: number) {
    setRowIndex(index)
    setQueue(shuffled(deck.rows[index]!.characters))
    setRevealed(false)
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
          const mastered = entry.characters.filter((c) => (mastery[c.char] ?? 0) >= MASTERY_TARGET).length
          const done = mastered === entry.characters.length
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={index === rowIndex}
              className={`beginner-row-tab${index === rowIndex ? ' is-active' : ''}${done ? ' is-done' : ''}`}
              onClick={() => openRow(index)}
              title={`${entry.label} — ${mastered}/${entry.characters.length} learned`}
            >
              <span>{entry.label}</span>
              <small>{mastered}/{entry.characters.length}</small>
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
