import { useMemo } from 'react'
import { getBeginnerDeck, type BeginnerScript } from '../data/beginnerMnemonics'
import { loadNumberMap, MASTERY_STORAGE_PREFIX, MASTERY_TARGET, storageKey } from '../lib/beginnerMastery'
import { AppBackButton } from './AppBackButton'

type ChartScript = Extract<BeginnerScript, 'hiragana' | 'katakana'>

interface KanaChartProps {
  script: ChartScript
  onBack: () => void
  /** Any character opens the learner right there, cycling the rest of its
   *  row from that point rather than jumping to the row's own first
   *  character. */
  onSelectCharacter: (rowIndex: number, charIndex: number) => void
}

export function KanaChart({ script, onBack, onSelectCharacter }: KanaChartProps) {
  const deck = getBeginnerDeck(script)
  // A fresh read on every mount is enough — this page is fully remounted
  // each time it's navigated to, so progress made in the learner since the
  // last visit is always picked up.
  const mastery = useMemo(() => loadNumberMap(storageKey(MASTERY_STORAGE_PREFIX, script)), [script])
  const totalCharacters = useMemo(() => deck.rows.reduce((total, row) => total + row.characters.length, 0), [deck])

  return (
    <main className="hiragana-chart-page">
      <AppBackButton onClick={onBack} aria-label="Back to Beginner Zone" />
      <section className="hiragana-chart-heading">
        <h1>{deck.title} Chart</h1>
        <p>All {totalCharacters} characters at a glance. Tap one to practice from there.</p>
      </section>
      <div className="hiragana-chart-grid">
        {deck.rows.map((row, rowIndex) => {
          const studied = row.characters.every((character) => (mastery[character.char] ?? 0) >= MASTERY_TARGET)
          return (
            <div key={row.id} className="hiragana-chart-row">
              <span
                className={`hiragana-chart-row-status${studied ? ' is-studied' : ''}`}
                aria-label={`${row.label} row, ${studied ? 'studied' : 'not yet studied'}`}
              >
                {studied ? '✓' : '○'}
              </span>
              <div className="hiragana-chart-row-chars">
                {row.characters.map((character, charIndex) => (
                  <button
                    key={character.char}
                    type="button"
                    className="hiragana-chart-cell"
                    onClick={() => onSelectCharacter(rowIndex, charIndex)}
                    aria-label={`Practice starting at ${character.char}, romaji ${character.romaji}`}
                  >
                    <span className="hiragana-chart-cell-char" lang="ja">{character.char}</span>
                    <small className="hiragana-chart-cell-romaji">{character.romaji}</small>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
