import { useMemo, useState } from 'react'
import {
  BUCKET_LABELS,
  getLevelContent,
  JLPT_LEVELS,
  type ContentBucket,
  type LevelContent,
} from '../lib/contentCatalog'
import type { JlptLevel } from '../lib/types'
import type { SentenceExercise } from '../data/sentenceExercises'
import type { StudyCard } from '../lib/types'

interface VocabListProps {
  onBack: () => void
}

function sentencePreview(exercise: SentenceExercise): string {
  if (exercise.segments) return exercise.segments.join('')
  return exercise.english
}

function ContentSection({
  bucket,
  content,
}: {
  bucket: ContentBucket
  content: LevelContent
}) {
  const items = content[bucket]
  if (!items || items.length === 0) return null

  return (
    <section className="vocab-list-section">
      <h2 className="vocab-list-section-title">
        {BUCKET_LABELS[bucket]}
        <span className="vocab-list-section-count">{items.length}</span>
      </h2>
      <ul className="vocab-list-items">
        {bucket === 'sentences'
          ? (items as SentenceExercise[]).map((exercise) => (
              <li key={exercise.id} className="vocab-list-item vocab-list-item-sentence">
                <div className="vocab-list-item-main">
                  <span className="vocab-list-jp">{sentencePreview(exercise)}</span>
                  <span className="vocab-list-type">Build</span>
                </div>
                <span className="vocab-list-en">{exercise.english}</span>
              </li>
            ))
          : (items as StudyCard[]).map((card) => (
              <li key={card.id} className="vocab-list-item">
                <div className="vocab-list-item-main">
                  <span className="vocab-list-jp">{card.front}</span>
                  {card.reading && (
                    <span className="vocab-list-reading">{card.reading}</span>
                  )}
                  <span className="vocab-list-type">{card.type}</span>
                </div>
                <span className="vocab-list-en">
                  {card.english ?? card.back}
                </span>
                {card.hint && (
                  <span className="vocab-list-hint">{card.hint}</span>
                )}
              </li>
            ))}
      </ul>
    </section>
  )
}

export function VocabList({ onBack }: VocabListProps) {
  const [level, setLevel] = useState<JlptLevel>('N5')
  const content = useMemo(() => getLevelContent(level), [level])
  const buckets: ContentBucket[] = level === 'N5'
    ? ['kana', 'vocab', 'grammar', 'kanji', 'reading', 'sentences']
    : ['vocab', 'grammar', 'kanji', 'reading', 'sentences']

  return (
    <div className="vocab-list-page">
      <header className="kanji-lab-header">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Dashboard
        </button>
        <div>
          <h1>Vocab List</h1>
          <p className="kanji-lab-sub">
            All study content by JLPT level — {content.summary.total} items at {level}
          </p>
        </div>
      </header>

      <section className="kanji-level-picker">
        <h2>JLPT level</h2>
        <div className="kanji-level-tabs">
          {JLPT_LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              className={`kanji-level-tab ${level === lvl ? 'active' : ''}`}
              onClick={() => setLevel(lvl)}
            >
              {lvl}
            </button>
          ))}
        </div>
      </section>

      <section className="kanji-level-stats vocab-list-stats">
        {buckets.map((bucket) => (
          <div
            key={bucket}
            className={`kanji-level-chip ${content.summary[bucket] > 0 ? '' : 'is-empty'}`}
          >
            <span className="level-name">{BUCKET_LABELS[bucket]}</span>
            <span className="level-count">{content.summary[bucket]}</span>
          </div>
        ))}
        <div className="kanji-level-chip highlighted">
          <span className="level-name">Total</span>
          <span className="level-count">{content.summary.total}</span>
        </div>
      </section>

      <div className="vocab-list-sections">
        {buckets.map((bucket) => (
          <ContentSection key={bucket} bucket={bucket} content={content} />
        ))}
        {content.summary.total === 0 && (
          <p className="vocab-list-empty">No content tagged for {level} yet.</p>
        )}
      </div>
    </div>
  )
}
