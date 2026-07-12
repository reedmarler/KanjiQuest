import {
  countFillGapByFilter,
  FILL_GAP_LEVEL_OPTIONS,
  fillGapCountsByLevel,
  type FillGapLevelFilter,
} from '../lib/fillGapLevels'

interface FillGapLevelPickerProps {
  onStart: (filter: FillGapLevelFilter) => void
  onBack: () => void
}

export function FillGapLevelPicker({ onStart, onBack }: FillGapLevelPickerProps) {
  const levelCounts = fillGapCountsByLevel()
  const singles = FILL_GAP_LEVEL_OPTIONS.filter((o) => o.group === 'single')
  const mixed = FILL_GAP_LEVEL_OPTIONS.filter((o) => o.group === 'mixed')
  const all = FILL_GAP_LEVEL_OPTIONS.filter((o) => o.group === 'all')

  return (
    <div className="kanji-lab sentence-practice fill-gap-levels">
      <header className="kanji-lab-header">
        <button className="btn btn-ghost" onClick={onBack}>← Sentence Practice</button>
        <div>
          <h1>Fill the Gap</h1>
          <p className="kanji-lab-sub">Choose a JLPT level or mixed set</p>
        </div>
      </header>

      <section className="kanji-level-stats fill-gap-level-stats">
        {(['N5', 'N4', 'N3', 'N2', 'N1'] as const).map((lvl) => (
          <div key={lvl} className="kanji-level-chip">
            <span className="level-name">{lvl}</span>
            <span className="level-count">{levelCounts[lvl]} sentences</span>
          </div>
        ))}
      </section>

      <section className="fill-gap-level-section">
        <h2>Single level</h2>
        <div className="fill-gap-level-grid">
          {singles.map((option) => (
            <LevelCard
              key={option.id}
              option={option}
              count={countFillGapByFilter(option.id)}
              onStart={onStart}
            />
          ))}
        </div>
      </section>

      <section className="fill-gap-level-section">
        <h2>Mixed levels</h2>
        <p className="kanji-modes-hint">Blend difficulty — great for review and bridging gaps between levels.</p>
        <div className="fill-gap-level-grid">
          {mixed.map((option) => (
            <LevelCard
              key={option.id}
              option={option}
              count={countFillGapByFilter(option.id)}
              onStart={onStart}
            />
          ))}
        </div>
      </section>

      <section className="fill-gap-level-section">
        <div className="fill-gap-level-grid">
          {all.map((option) => (
            <LevelCard
              key={option.id}
              option={option}
              count={countFillGapByFilter(option.id)}
              onStart={onStart}
              wide
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function LevelCard({
  option,
  count,
  onStart,
  wide = false,
}: {
  option: (typeof FILL_GAP_LEVEL_OPTIONS)[number]
  count: number
  onStart: (filter: FillGapLevelFilter) => void
  wide?: boolean
}) {
  const disabled = count === 0

  return (
    <button
      className={`fill-gap-level-card ${wide ? 'wide' : ''}`}
      onClick={() => onStart(option.id)}
      disabled={disabled}
    >
      <span className="fill-gap-level-label">{option.label}</span>
      <span className="fill-gap-level-desc">{option.description}</span>
      <span className="fill-gap-level-count">
        {count} sentence{count !== 1 ? 's' : ''}
      </span>
    </button>
  )
}
