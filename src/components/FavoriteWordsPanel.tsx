import { useFavoriteWords } from '../lib/favoriteWords'

interface FavoriteWordsPanelProps {
  onManage: () => void
}

/** How many chips fit the mode slot before it starts to crowd the dashboard. */
const PREVIEW_LIMIT = 8

/**
 * The star mode's inline panel: a glance at the starred words, the switch that
 * makes the rotator favour them, and a way through to the full list.
 */
export function FavoriteWordsPanel({ onManage }: FavoriteWordsPanelProps) {
  const { words, remove, prioritize, setPrioritize } = useFavoriteWords()
  const preview = words.slice(0, PREVIEW_LIMIT)
  const overflow = words.length - preview.length

  return (
    <div className="favorite-words-panel">
      <div className="favorite-words-panel-top">
        <button
          type="button"
          className={`control-chip${prioritize ? ' is-active' : ''}`}
          onClick={() => setPrioritize(!prioritize)}
          aria-pressed={prioritize}
          disabled={!words.length}
          title={words.length
            ? 'Show sentences using your starred words more often'
            : 'Star some words first'}
        >
          <span className="control-chip-jp" aria-hidden="true">★</span>
          Prioritize
        </button>
        <span className="favorite-words-count">{words.length} starred</span>
        <button type="button" className="favorite-words-manage" onClick={onManage}>
          Manage
        </button>
      </div>

      {words.length ? (
        <div className="favorite-words-chips">
          {preview.map((word) => (
            <button
              key={word.japanese}
              type="button"
              className="favorite-word-chip"
              onClick={() => remove(word.japanese)}
              aria-label={`Remove ${word.japanese} from favorites`}
              title="Remove from favorites"
            >
              <span lang="ja">{word.japanese}</span>
              <span className="favorite-word-chip-x" aria-hidden="true">×</span>
            </button>
          ))}
          {overflow > 0 && <span className="favorite-words-more">+{overflow} more</span>}
        </div>
      ) : (
        <p className="favorite-words-empty">
          No starred words yet. Open <b>Manage</b> to add some, or tap ☆ beside any word in the vocab list.
        </p>
      )}
    </div>
  )
}
