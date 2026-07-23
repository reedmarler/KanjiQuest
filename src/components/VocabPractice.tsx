import { useCallback, useEffect, useRef, useState } from 'react'
import type { DrillExercise } from '../lib/drillExercises'
import { createGeneratedVocabDrillBatch } from '../lib/generatedPracticeDrills'
import { ChoiceDrill } from './ChoiceDrill'

interface VocabPracticeProps {
  onBack: () => void
  isFavorite: (exercise: DrillExercise) => boolean
  onToggleFavorite: (exercise: DrillExercise) => void
}

const VOCAB_BATCH_COUNT = 3

export function VocabPractice({ onBack, isFavorite, onToggleFavorite }: VocabPracticeProps) {
  const [pool, setPool] = useState<DrillExercise[] | null>(null)
  const [completedBatches, setCompletedBatches] = useState(0)
  const nextBatchSeed = useRef(Math.floor(Date.now() / 1000))

  const buildFreshPool = useCallback(async (onBatchReady?: (completed: number) => void) => {
    // Yield first so either loading state has a chance to paint before generation starts.
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    const exercises: DrillExercise[] = []
    const seedBase = nextBatchSeed.current
    nextBatchSeed.current += VOCAB_BATCH_COUNT

    for (let batch = 0; batch < VOCAB_BATCH_COUNT; batch += 1) {
      exercises.push(...createGeneratedVocabDrillBatch(seedBase + batch))
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
    const progress = (completedBatches / VOCAB_BATCH_COUNT) * 100
    return (
      <div className="practice-loading">
        <button className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <section className="practice-loading-card" role="status" aria-live="polite">
          <span className="practice-loading-mark">語</span>
          <h1>Vocab</h1>
          <p>Building a fresh practice set</p>
          <div className="practice-loading-bar" aria-label={`${completedBatches} of ${VOCAB_BATCH_COUNT} vocabulary batches ready`}>
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
      badgeLabel="Vocab"
      eyebrow="Choose the word that fits"
      finishMark="語"
      finishTitle="Vocab practice complete"
      finishNoun="word choices"
      storagePrefix="kanji-quest-generated-vocab-practice"
      onLoadNextPool={buildFreshPool}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      onBack={onBack}
    />
  )
}
