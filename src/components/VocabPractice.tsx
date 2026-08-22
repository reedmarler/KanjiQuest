import { useCallback, useEffect, useRef, useState } from 'react'
import type { DrillExercise } from '../lib/drillExercises'
import { createGeneratedVocabDrillBatch } from '../lib/generatedPracticeDrills'
import type { GenerationComplexity } from '../lib/generationComplexity'
import { ChoiceDrill, loadLevelPreference } from './ChoiceDrill'
import { AppBackButton } from './AppBackButton'

interface VocabPracticeProps {
  onBack: () => void
  isFavorite: (exercise: DrillExercise) => boolean
  onToggleFavorite: (exercise: DrillExercise) => void
}

// 5, not 3: with level-filtered batches now cheap (only the selected level's
// specs run), 5 batches reliably clears 15 unique even on Level 5 — the
// thinnest level, whose small hand-curated patterns need more samples to
// reach 15 than the richer verb-pool-driven levels do.
const VOCAB_BATCH_COUNT = 5
const VOCAB_LEVELS_KEY = 'kanji-quest-generated-vocab-practice-levels-v1'

export function VocabPractice({ onBack, isFavorite, onToggleFavorite }: VocabPracticeProps) {
  const [pool, setPool] = useState<DrillExercise[] | null>(null)
  const [completedBatches, setCompletedBatches] = useState(0)
  const nextBatchSeed = useRef(Math.floor(Date.now() / 1000))

  const buildFreshPool = useCallback(async (levels: readonly GenerationComplexity[], onBatchReady?: (completed: number) => void) => {
    // Yield first so either loading state has a chance to paint before generation starts.
    // requestAnimationFrame never fires while the tab is hidden/backgrounded
    // (common on mobile mid-navigation), which would hang this forever.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    const exercises: DrillExercise[] = []
    const seedBase = nextBatchSeed.current
    nextBatchSeed.current += VOCAB_BATCH_COUNT

    for (let batch = 0; batch < VOCAB_BATCH_COUNT; batch += 1) {
      exercises.push(...createGeneratedVocabDrillBatch(seedBase + batch, levels))
      onBatchReady?.(batch + 1)
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    }

    return exercises
  }, [])

  useEffect(() => {
    let cancelled = false

    async function buildSession() {
      // Only the saved level preference is needed on first load — building
      // every level's content up front would defeat the point of filtering.
      const initialLevels = loadLevelPreference(VOCAB_LEVELS_KEY)
      const exercises = await buildFreshPool(initialLevels, (completed) => {
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
        <AppBackButton onClick={onBack} />
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
