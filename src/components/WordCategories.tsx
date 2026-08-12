import { useEffect, useMemo, useState } from 'react'
import { allCards } from '../data'
import { useFavoriteWords } from '../lib/favoriteWords'
import { WORD_CATEGORY_ORDER as CATEGORY_ORDER, classifyPartOfSpeech, type WordCategory } from '../lib/partOfSpeech'
import type { StudyCard } from '../lib/types'

interface WordCategoriesProps {
  onBack?: () => void
  embedded?: boolean
}

const CATEGORY_MARKS: Record<WordCategory, string> = {
  Verbs: '動',
  Adjectives: '形',
  Adverbs: '副',
  Nouns: '名',
  Other: '他',
}

const INITIAL_RENDERED_ITEMS = 150
const RENDER_BATCH_SIZE = 200

export function WordCategories({ onBack, embedded = false }: WordCategoriesProps) {
  const grouped = useMemo(() => {
    const groups: Record<WordCategory, StudyCard[]> = { Verbs: [], Adjectives: [], Adverbs: [], Nouns: [], Other: [] }
    for (const card of allCards) {
      if (card.type !== 'vocab') continue
      groups[classifyPartOfSpeech(card)].push(card)
    }
    return groups
  }, [])

  const { isFavorite, toggle } = useFavoriteWords()
  const [category, setCategory] = useState<WordCategory>('Verbs')
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDERED_ITEMS)
  const words = grouped[category]

  useEffect(() => {
    setVisibleCount(INITIAL_RENDERED_ITEMS)
  }, [category])

  useEffect(() => {
    if (visibleCount >= words.length) return
    const timer = window.setTimeout(() => {
      setVisibleCount((count) => Math.min(count + RENDER_BATCH_SIZE, words.length))
    }, 16)
    return () => window.clearTimeout(timer)
  }, [words.length, visibleCount])

  const visibleWords = words.slice(0, visibleCount)
  const totalWords = CATEGORY_ORDER.reduce((sum, key) => sum + grouped[key].length, 0)

  return (
    <div className="vocab-list-page word-categories-page">
      {!embedded && <header className="kanji-lab-header">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Dashboard
        </button>
        <div>
          <h1>Word Categories</h1>
          <p className="kanji-lab-sub">All {totalWords} vocabulary words, grouped by part of speech</p>
        </div>
      </header>}
      {embedded && <p className="library-panel-count">{totalWords} words total</p>}

      <section className="kanji-level-picker">
        <h2>Category</h2>
        <div className="kanji-level-tabs">
          {CATEGORY_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              className={`kanji-level-tab ${category === key ? 'active' : ''}`}
              onClick={() => setCategory(key)}
            >
              {CATEGORY_MARKS[key]} {key}
            </button>
          ))}
        </div>
      </section>

      <section className="kanji-level-stats vocab-list-stats">
        {CATEGORY_ORDER.map((key) => (
          <div key={key} className={`kanji-level-chip ${grouped[key].length > 0 ? '' : 'is-empty'}`}>
            <span className="level-name">{key}</span>
            <span className="level-count">{grouped[key].length}</span>
          </div>
        ))}
      </section>

      <div className="vocab-list-sections">
        <section className="vocab-list-section">
          <h2 className="vocab-list-section-title">
            {category}
            <span className="vocab-list-section-count">
              {visibleWords.length < words.length ? `${visibleWords.length} / ${words.length}` : words.length}
            </span>
          </h2>
          {words.length ? (
            <ul className="vocab-list-items">
              {visibleWords.map((card) => (
                <li key={card.id} className="vocab-list-item">
                  <div className="vocab-list-item-main">
                    <span className="vocab-list-jp">{card.front}</span>
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
              ))}
            </ul>
          ) : (
            <p className="vocab-list-empty">No words in this category yet.</p>
          )}
          {visibleWords.length < words.length && (
            <p className="vocab-list-loading-more" role="status">
              Loading {words.length - visibleWords.length} more
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
