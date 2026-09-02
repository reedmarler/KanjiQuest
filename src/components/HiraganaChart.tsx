import { getBeginnerDeck } from '../data/beginnerMnemonics'
import { AppBackButton } from './AppBackButton'

interface HiraganaChartProps {
  onBack: () => void
  /** Any character in a row opens the learner at that row — the chart is a
   *  map into the learner, not a separate drill of its own. */
  onSelectRow: (rowIndex: number) => void
}

export function HiraganaChart({ onBack, onSelectRow }: HiraganaChartProps) {
  const deck = getBeginnerDeck('hiragana')

  return (
    <main className="hiragana-chart-page">
      <AppBackButton onClick={onBack} aria-label="Back to Beginner Zone" />
      <section className="hiragana-chart-heading">
        <h1>Hiragana Chart</h1>
        <p>All 46 characters at a glance. Tap one to practice its row.</p>
      </section>
      <div className="hiragana-chart-grid">
        {deck.rows.map((row, rowIndex) => (
          <div key={row.id} className="hiragana-chart-row">
            <span className="hiragana-chart-row-label" lang="ja" aria-hidden="true">{row.label}</span>
            <div className="hiragana-chart-row-chars">
              {row.characters.map((character) => (
                <button
                  key={character.char}
                  type="button"
                  className="hiragana-chart-cell"
                  onClick={() => onSelectRow(rowIndex)}
                  aria-label={`Practice the ${row.label} row, starting with ${character.char}, romaji ${character.romaji}`}
                >
                  <span className="hiragana-chart-cell-char" lang="ja">{character.char}</span>
                  <small className="hiragana-chart-cell-romaji">{character.romaji}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
