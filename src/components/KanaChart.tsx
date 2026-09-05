import { useState } from 'react'
import { getBeginnerDeck, type BeginnerScript } from '../data/beginnerMnemonics'
import { loadNumberMap, MASTERY_STORAGE_PREFIX, MASTERY_TARGET, storageKey } from '../lib/beginnerMastery'
import { AppBackButton } from './AppBackButton'

type ChartScript = Extract<BeginnerScript, 'hiragana' | 'katakana'>

// Every row reads left to right as a, i, u, e, o — including the contracted
// きゃ/きゅ/きょ rows, whose romaji still ends in one of those vowels, so a
// character's column is just the vowel its own romaji ends with. を and ん
// break that pattern — they sit under う and お rather than their own sound.
// Keyed by character rather than romaji: ウォ genuinely says "wo" and belongs
// in the お column like any other -o sound, and only を's romaji collides
// with it, so the override has to name the exact character it applies to.
const CHART_VOWEL_COLUMNS: Record<string, number> = { a: 1, i: 2, u: 3, e: 4, o: 5 }
const CHART_COLUMN_OVERRIDES: Record<string, number> = { を: 3, ヲ: 3, ん: 5, ン: 5 }

function chartColumn(char: string, romaji: string): number {
  return CHART_COLUMN_OVERRIDES[char] ?? CHART_VOWEL_COLUMNS[romaji.charAt(romaji.length - 1)] ?? 5
}

const CHART_COLUMNS = [1, 2, 3, 4, 5]

interface KanaChartProps {
  script: ChartScript
  onBack: () => void
  onOpenQuiz: () => void
  /** Any character opens the learner right there, cycling the rest of its
   *  row from that point rather than jumping to the row's own first
   *  character. */
  onSelectCharacter: (rowIndex: number, charIndex: number) => void
}

export function KanaChart({ script, onBack, onOpenQuiz, onSelectCharacter }: KanaChartProps) {
  const deck = getBeginnerDeck(script)
  const masteryKey = storageKey(MASTERY_STORAGE_PREFIX, script)
  const [mastery, setMastery] = useState<Record<string, number>>(() => loadNumberMap(masteryKey))
  const [showRomaji, setShowRomaji] = useState(true)
  const leadCharacter = deck.rows[0]?.characters[0]?.char ?? (script === 'hiragana' ? 'あ' : 'ア')

  function toggleRow(rowIndex: number) {
    const row = deck.rows[rowIndex]!
    const studied = row.characters.every((character) => (mastery[character.char] ?? 0) >= MASTERY_TARGET)
    const next = { ...mastery }
    for (const character of row.characters) {
      if (studied) delete next[character.char]
      else next[character.char] = MASTERY_TARGET
    }
    setMastery(next)
    window.localStorage.setItem(masteryKey, JSON.stringify(next))
  }

  return (
    <main className={`hiragana-chart-page hiragana-chart-page--${script}${showRomaji ? '' : ' is-romaji-hidden'}`}>
      <AppBackButton onClick={onBack} aria-label="Back to Beginner Zone" />
      <section className="hiragana-chart-heading">
        <div className="hiragana-chart-hero-mark" lang="ja" aria-hidden="true">{leadCharacter}</div>
        <div className="hiragana-chart-heading-copy">
          <h1>{deck.title} Chart</h1>
        </div>
        <div className="hiragana-chart-actions">
          <button
            type="button"
            className="hiragana-chart-quiz-button hiragana-chart-en-button"
            onClick={() => setShowRomaji((current) => !current)}
            aria-pressed={showRomaji}
            aria-label={`${showRomaji ? 'Hide' : 'Show'} romaji labels`}
          >
            EN
          </button>
          <button type="button" className="hiragana-chart-quiz-button" onClick={onOpenQuiz}>
            Quiz
          </button>
        </div>
      </section>
      <section className="hiragana-chart-board" aria-label={`${deck.title} rows`}>
        {deck.rows.map((row, rowIndex) => {
          const studied = row.characters.every((character) => (mastery[character.char] ?? 0) >= MASTERY_TARGET)
          const filledColumns = new Set(row.characters.map((character) => chartColumn(character.char, character.romaji)))
          return (
            <div key={row.id} className="hiragana-chart-row">
              <button
                type="button"
                className={`hiragana-chart-row-status${studied ? ' is-studied' : ''}`}
                onClick={() => toggleRow(rowIndex)}
                aria-pressed={studied}
                aria-label={`${studied ? 'Clear' : 'Mark'} ${row.label} row as studied`}
              >
                <span aria-hidden="true" />
              </button>
              <div className="hiragana-chart-row-chars">
                {row.characters.map((character, charIndex) => (
                  <button
                    key={character.char}
                    type="button"
                    className="hiragana-chart-cell"
                    style={{ gridColumn: chartColumn(character.char, character.romaji), gridRow: 1 }}
                    onClick={() => onSelectCharacter(rowIndex, charIndex)}
                    aria-label={`Practice starting at ${character.char}, romaji ${character.romaji}`}
                  >
                    <span className="hiragana-chart-cell-char" lang="ja">{character.char}</span>
                    <small className="hiragana-chart-cell-romaji">{character.romaji}</small>
                  </button>
                ))}
                {CHART_COLUMNS.filter((column) => !filledColumns.has(column)).map((column) => (
                  <span
                    key={column}
                    className="hiragana-chart-cell-empty"
                    style={{ gridColumn: column, gridRow: 1 }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          )
        })}
      </section>
    </main>
  )
}
