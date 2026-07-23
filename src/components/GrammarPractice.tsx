import { useCallback, useEffect, useRef, useState } from 'react'
import type { DrillExercise } from '../lib/drillExercises'
import { createGeneratedGrammarDrillBatch } from '../lib/generatedPracticeDrills'
import { ChoiceDrill } from './ChoiceDrill'

interface GrammarPracticeProps {
  onBack: () => void
  isFavorite: (exercise: DrillExercise) => boolean
  onToggleFavorite: (exercise: DrillExercise) => void
}

const GRAMMAR_BATCH_COUNT = 5

export function GrammarPractice({ onBack, isFavorite, onToggleFavorite }: GrammarPracticeProps) {
  const [pool, setPool] = useState<DrillExercise[] | null>(null)
  const [completedBatches, setCompletedBatches] = useState(0)
  const nextBatchSeed = useRef(Math.floor(Date.now() / 1000))

  const buildFreshPool = useCallback(async (onBatchReady?: (completed: number) => void) => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    const exercises: DrillExercise[] = []
    const seedBase = nextBatchSeed.current
    nextBatchSeed.current += GRAMMAR_BATCH_COUNT

    for (let batch = 0; batch < GRAMMAR_BATCH_COUNT; batch += 1) {
      exercises.push(...createGeneratedGrammarDrillBatch(seedBase + batch))
      onBatchReady?.(batch + 1)
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    }

    return exercises
  }, [])

  useEffect(() => {
    let cancelled = false

    async function buildSession() {
      const exercises = await buildFreshPool((completed) => {
        if (!cancelled) setCompletedBatches(completed)
      })
      if (!cancelled) setPool(exercises)
    }

    void buildSession()
    return () => { cancelled = true }
  }, [buildFreshPool])

  if (!pool) {
    const progress = (completedBatches / GRAMMAR_BATCH_COUNT) * 100
    return (
      <div className="practice-loading">
        <button className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <section className="practice-loading-card" role="status" aria-live="polite">
          <span className="practice-loading-mark">文法</span>
          <h1>Grammar</h1>
          <p>Building a fresh practice set</p>
          <div className="practice-loading-bar" aria-label={`${completedBatches} of ${GRAMMAR_BATCH_COUNT} grammar batches ready`}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </section>
      </div>
    )
  }

  return (
    <ChoiceDrill
      key={pool[0]?.id}
      pool={pool}
      badgeLabel="Grammar"
      eyebrow="Choose the grammar that fits"
      finishMark="文法"
      finishTitle="Grammar practice complete"
      finishNoun="grammar choices"
      storagePrefix="kanji-quest-generated-grammar-practice"
      onLoadNextPool={buildFreshPool}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      onBack={onBack}
    />
  )
}
