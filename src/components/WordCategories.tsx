import { useEffect, useMemo, useState } from 'react'
import { allCards } from '../data'
import type { StudyCard } from '../lib/types'

interface WordCategoriesProps {
  onBack?: () => void
  embedded?: boolean
}

const CATEGORY_ORDER = ['Verbs', 'Adjectives', 'Adverbs', 'Nouns', 'Other'] as const
type WordCategory = typeof CATEGORY_ORDER[number]

const FUNCTION_WORD_PATTERN = /\b(particle|conjunction|copula|auxiliary|suffix|prefix|interjection|pronoun|expression|counter|case)\b/
const ADVERB_PATTERN = /\b(quickly|slowly|already|always|often|sometimes|usually|really|very|together|again|still|soon|perhaps|probably|almost|especially|suddenly|finally|immediately|gradually|completely|entirely|frequently|occasionally|constantly|mostly|nearly|barely|extremely)\b/
const NA_ADJECTIVE_HINT_PATTERN = /\b(quiet|noisy|healthy|convenient|inconvenient|important|necessary|unnecessary|free|famous|kind|unkind|dangerous|safe|strange|simple|complex|various|serious|clear|energetic|lively|lonely|handsome|polite|rude|honest|calm|fair|equal|special|normal|strict|gentle|brave|foolish|wise|selfish|sincere)\b/

/**
 * A lightweight, browse-only part-of-speech guess — good enough for grouping
 * a word list, not a claim about grammatical accuracy. Most cards' tags come
 * from an imported spreadsheet that only records topical categories (Food,
 * Places...), not part of speech, so this reads the English gloss and the
 * Japanese surface form directly instead of relying on card tags.
 */
// These words gloss with an adverbial English meaning ("together", "usually",
// "always") but are themselves nouns or な-adjectives whose adverbial form
// (一緒に, 常に...) is a separate word — the base form belongs in Nouns.
const ADVERB_LOOKING_NOUNS = new Set(['同棲', '一緒', '共', '常', '普段', '普通'])
// に対する/に関する are fixed grammatical constructions ("regarding", "toward")
// built on する, not ordinary dictionary-form verbs — they never conjugate the
// way a real する-verb does (no に対します, no に対して alone as the verb).
// 大好き's English gloss happens to start with "to be", but it is a
// な-adjective/noun ("a favorite"), not a verb.
const NON_VERB_OVERRIDES = new Set(['に対する', 'に関する', '大好き'])

function guessWordCategory(card: StudyCard): WordCategory {
  const meaning = (card.back || card.english || '').toLowerCase()
  if (ADVERB_LOOKING_NOUNS.has(card.front)) return 'Nouns'
  // Curated adverb deck — these are confirmed adverbs by construction, so
  // skip the English-gloss guesswork the rest of this function relies on.
  if (card.id.startsWith('vocab-adverb-')) return 'Adverbs'
  if (card.id.startsWith('vocab-verb-')) return 'Verbs'
  if (card.id.startsWith('vocab-adj-')) return 'Adjectives'
  if (NON_VERB_OVERRIDES.has(card.front)) return NA_ADJECTIVE_HINT_PATTERN.test(meaning) || card.front === '大好き' ? 'Adjectives' : 'Other'
  if (/^to\s+\w/.test(meaning) || card.front.endsWith('する')) return 'Verbs'
  if (FUNCTION_WORD_PATTERN.test(meaning) || /^(i|me|you|he|him|she|her|we|us|they|them|this|that|these|those|what|who|where|when|why|how|which)\b/.test(meaning)) return 'Other'
  if (card.front.endsWith('い') && card.front.length > 1 && !['きれい', '嫌い', 'わがまま'].includes(card.front)) return 'Adjectives'
  if (NA_ADJECTIVE_HINT_PATTERN.test(meaning)) return 'Adjectives'
  if (ADVERB_PATTERN.test(meaning)) return 'Adverbs'
  return 'Nouns'
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
      groups[guessWordCategory(card)].push(card)
    }
    return groups
  }, [])

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
