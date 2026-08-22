import { useState } from 'react'
import { FuriganaSentence } from './FuriganaText'
import {
  WIRED_BUILDER_LEVELS,
  buildGeneratedBuilderExercises,
} from '../lib/generatedSentenceExercises'
import type { SentenceExercise } from '../data/sentenceExercises'
import { AppBackButton } from './AppBackButton'

export const BATCH_CHECK_SIZE = 10

type Verdict = 'good' | 'bad'

interface SentenceBatchCheckProps {
  onBack: () => void
}

function batchText(exercises: SentenceExercise[], verdicts: Record<string, Verdict>) {
  return exercises
    .map((exercise, index) => {
      const japanese = exercise.segments?.join('') ?? ''
      const verdict = verdicts[exercise.id] ?? '—'
      return `${index + 1}. ${japanese}\n   ${exercise.english}\n   [${verdict}]`
    })
    .join('\n\n')
}

export function SentenceBatchCheck({ onBack }: SentenceBatchCheckProps) {
  const [batch, setBatch] = useState(0)
  const [exercises, setExercises] = useState(() =>
    buildGeneratedBuilderExercises(WIRED_BUILDER_LEVELS, BATCH_CHECK_SIZE, 0),
  )
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [copied, setCopied] = useState(false)

  const goodCount = Object.values(verdicts).filter((verdict) => verdict === 'good').length
  const badCount = Object.values(verdicts).filter((verdict) => verdict === 'bad').length

  const regenerate = () => {
    const next = batch + 1
    setBatch(next)
    setExercises(buildGeneratedBuilderExercises(WIRED_BUILDER_LEVELS, BATCH_CHECK_SIZE, next))
    setVerdicts({})
    setCopied(false)
  }

  const mark = (id: string, verdict: Verdict) => {
    setVerdicts((prev) => {
      const next = { ...prev }
      if (next[id] === verdict) delete next[id]
      else next[id] = verdict
      return next
    })
  }

  const copyBatch = async () => {
    try {
      await navigator.clipboard.writeText(batchText(exercises, verdicts))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="kanji-lab sentence-batch-check">
      <header className="kanji-lab-header">
        <AppBackButton onClick={onBack} aria-label="Back to Sentence Practice" />
        <div>
          <h1>Translation Check</h1>
          <p className="kanji-lab-sub">
            {BATCH_CHECK_SIZE} generated sentences at once — read each one and mark whether the
            English matches
          </p>
        </div>
      </header>

      <div className="batch-check-toolbar">
        <button className="btn btn-primary" onClick={regenerate}>
          Generate {BATCH_CHECK_SIZE} more
        </button>
        <button className="btn btn-secondary" onClick={copyBatch}>
          {copied ? 'Copied ✓' : 'Copy batch'}
        </button>
        <span className="batch-check-tally">
          <b className="is-good">{goodCount}</b> ok · <b className="is-bad">{badCount}</b> off ·{' '}
          {exercises.length - goodCount - badCount} unmarked
        </span>
      </div>

      {exercises.length === 0 ? (
        <p className="batch-check-empty">No sentences came back from the generator.</p>
      ) : (
        <ol className="batch-check-list">
          {exercises.map((exercise) => {
            const verdict = verdicts[exercise.id]

            return (
              <li
                key={exercise.id}
                className={`batch-check-row${verdict ? ` is-${verdict}` : ''}`}
              >
                <div className="batch-check-sentence">
                  <FuriganaSentence
                    className="batch-check-japanese"
                    segments={exercise.segments ?? []}
                    readings={exercise.segmentReadings}
                  />
                  <p className="batch-check-english">{exercise.english}</p>
                </div>

                <div className="batch-check-verdict">
                  <button
                    className={`batch-check-mark is-good${verdict === 'good' ? ' is-active' : ''}`}
                    aria-pressed={verdict === 'good'}
                    aria-label="Translation looks right"
                    onClick={() => mark(exercise.id, 'good')}
                  >
                    ✓
                  </button>
                  <button
                    className={`batch-check-mark is-bad${verdict === 'bad' ? ' is-active' : ''}`}
                    aria-pressed={verdict === 'bad'}
                    aria-label="Translation looks wrong"
                    onClick={() => mark(exercise.id, 'bad')}
                  >
                    ✗
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
