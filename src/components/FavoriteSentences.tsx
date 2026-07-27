import { FuriganaGlossSentence } from './FuriganaText'
import type { FavoriteSentence } from '../lib/favoriteSentences'

interface FavoriteSentencesProps {
  favorites: FavoriteSentence[]
  onRemove: (favorite: FavoriteSentence) => void
  onBack?: () => void
  embedded?: boolean
}

export function FavoriteSentences({ favorites, onBack, onRemove, embedded = false }: FavoriteSentencesProps) {
  return (
    <div className="favorite-sentences-view">
      {!embedded && <header className="favorite-sentences-header">
        <button className="btn btn-ghost" onClick={onBack}>Back to Dashboard</button>
        <div>
          <h1>Favorite Sentences</h1>
          <p>{favorites.length} saved</p>
        </div>
      </header>}
      {embedded && <p className="library-panel-count">{favorites.length} saved sentence{favorites.length === 1 ? '' : 's'}</p>}

      {favorites.length ? (
        <div className="favorite-sentence-list">
          {favorites.map((favorite) => (
            <article className="favorite-sentence-row" key={favorite.japanese}>
              <button
                type="button"
                className="favorite-sentence-remove"
                onClick={() => onRemove(favorite)}
                aria-label={`Remove ${favorite.english} from favorite sentences`}
                title="Remove from favorite sentences"
              >
                ★
              </button>
              <p className="favorite-sentence-japanese">
                <FuriganaGlossSentence
                  segments={favorite.segments}
                  readings={favorite.readings}
                  meanings={favorite.meanings}
                  segmentClassName="furigana-emphasis"
                />
              </p>
              <p className="favorite-sentence-english">{favorite.english}</p>
              {favorite.jlpt && <span className="jlpt-badge">{favorite.jlpt}</span>}
            </article>
          ))}
        </div>
      ) : (
        <p className="favorite-sentences-empty">No favorite sentences yet.</p>
      )}
    </div>
  )
}
