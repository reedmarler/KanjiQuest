import { useMemo, useState } from 'react'
import { allCards } from '../data'
import { useFavoriteWords } from '../lib/favoriteWords'
import type { StudyCard } from '../lib/types'
import { AppBackButton } from './AppBackButton'

interface FavoriteWordsPageProps {
  onBack: () => void
}

const SUGGESTION_LIMIT = 40
const SEARCH_LIMIT = 30

/** Frequency rank, stored by the imported decks as a "#123" hint. */
function frequencyRank(card: StudyCard) {
  const rank = Number(card.hint?.match(/^#(\d+)/)?.[1])
  return Number.isFinite(rank) ? rank : Number.POSITIVE_INFINITY
}

/**
 * The frequency lists are raw corpus counts, so their top entries include
 * conjugation suffixes and particles (せる, た, の) that carry no standalone
 * meaning. Suggesting those as words to study is noise, so a card needs a real
 * gloss and, for bare kana, enough length to be a word rather than a fragment.
 */
function isSuggestable(card: StudyCard) {
  const meaning = (card.english ?? card.back ?? '').trim()
  if (!meaning || /^(?:meaning|reading) needed$/i.test(meaning)) return false
  if (/\b(particle|suffix|prefix|auxiliary|copula|conj\.|counter)\b/i.test(meaning)) return false
  const kanaOnly = /^[ぁ-んァ-ヶー]+$/.test(card.front)
  return !kanaOnly || card.front.length >= 3
}

export function FavoriteWordsPage({ onBack }: FavoriteWordsPageProps) {
  const { words, toggle, remove, isFavorite, prioritize, setPrioritize } = useFavoriteWords()
  const [search, setSearch] = useState('')

  const vocab = useMemo(() => allCards.filter((card) => card.type === 'vocab'), [])

  // The most common words the learner has not starred yet — a useful default
  // shortlist, since frequency is the best proxy available for "worth drilling".
  const suggestions = useMemo(() => vocab
    .filter((card) => Number.isFinite(frequencyRank(card)) && !isFavorite(card.front) && isSuggestable(card))
    .sort((left, right) => frequencyRank(left) - frequencyRank(right))
    .slice(0, SUGGESTION_LIMIT),
  [vocab, isFavorite])

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return []
    return vocab
      .filter((card) => [card.front, card.reading, card.back, card.english]
        .some((value) => value?.toLowerCase().includes(term)))
      .slice(0, SEARCH_LIMIT)
  }, [search, vocab])

  const renderAddable = (card: StudyCard) => (
    <li key={card.id} className="vocab-list-item favorite-words-row">
      <div className="vocab-list-item-main">
        <span className="vocab-list-jp" lang="ja">{card.front}</span>
        {card.reading && <span className="vocab-list-reading">{card.reading}</span>}
      </div>
      <span className="vocab-list-en">{card.english ?? card.back}</span>
      <button
        type="button"
        className={`favorite-word-star${isFavorite(card.front) ? ' is-favorite' : ''}`}
        onClick={() => toggle({ japanese: card.front, reading: card.reading, english: card.english ?? card.back })}
        aria-pressed={isFavorite(card.front)}
        aria-label={isFavorite(card.front) ? `Remove ${card.front} from favorites` : `Add ${card.front} to favorites`}
      >
        {isFavorite(card.front) ? '★' : '☆'}
      </button>
    </li>
  )

  return (
    <div className="vocab-list-page favorite-words-page">
      <header className="kanji-lab-header">
        <AppBackButton onClick={onBack} aria-label="Back to Dashboard" />
        <div>
          <h1>Favorite Words</h1>
          <p className="kanji-lab-sub">
            {words.length} starred · the dashboard sentence rotator can favour these
          </p>
        </div>
      </header>

      <section className="cs-card favorite-words-controls">
        <button
          type="button"
          className={`control-chip${prioritize ? ' is-active' : ''}`}
          onClick={() => setPrioritize(!prioritize)}
          aria-pressed={prioritize}
          disabled={!words.length}
        >
          <span className="control-chip-jp" aria-hidden="true">★</span>
          Prioritize in rotator
        </button>
        <input
          type="search"
          className="favorite-words-search"
          placeholder="Search any word to add…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </section>

      {search.trim() && (
        <section className="vocab-list-section">
          <h2 className="vocab-list-section-title">
            Search results
            <span className="vocab-list-section-count">{matches.length}</span>
          </h2>
          {matches.length
            ? <ul className="vocab-list-items">{matches.map(renderAddable)}</ul>
            : <p className="vocab-list-empty">No words match “{search.trim()}”.</p>}
        </section>
      )}

      <section className="vocab-list-section">
        <h2 className="vocab-list-section-title">
          Your favorites
          <span className="vocab-list-section-count">{words.length}</span>
        </h2>
        {words.length ? (
          <ul className="vocab-list-items">
            {words.map((word) => (
              <li key={word.japanese} className="vocab-list-item favorite-words-row">
                <div className="vocab-list-item-main">
                  <span className="vocab-list-jp" lang="ja">{word.japanese}</span>
                  {word.reading && <span className="vocab-list-reading">{word.reading}</span>}
                </div>
                <span className="vocab-list-en">{word.english}</span>
                <button
                  type="button"
                  className="favorite-word-star is-favorite"
                  onClick={() => remove(word.japanese)}
                  aria-label={`Remove ${word.japanese} from favorites`}
                >
                  ★
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="vocab-list-empty">Nothing starred yet — add a few from the suggestions below.</p>
        )}
      </section>

      <section className="vocab-list-section">
        <h2 className="vocab-list-section-title">
          Suggested — most common words
          <span className="vocab-list-section-count">{suggestions.length}</span>
        </h2>
        <ul className="vocab-list-items">{suggestions.map(renderAddable)}</ul>
      </section>
    </div>
  )
}
