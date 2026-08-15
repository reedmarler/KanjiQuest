import { useCallback, useEffect, useRef, useState } from 'react'
import type { DrillExercise } from '../lib/drillExercises'
import { createGeneratedGrammarDrillBatch } from '../lib/generatedPracticeDrills'
import type { GenerationComplexity } from '../lib/generationComplexity'
import { getQuestById } from '../data/questCampaign'
import { ChoiceDrill, loadLevelPreference } from './ChoiceDrill'

interface GrammarPracticeProps {
  onBack: () => void
  onDashboard?: () => void
  isFavorite: (exercise: DrillExercise) => boolean
  onToggleFavorite: (exercise: DrillExercise) => void
  questId?: string
  onQuestComplete?: () => void
}

const GRAMMAR_BATCH_COUNT = 5
const GRAMMAR_LEVELS_KEY = 'kanji-quest-generated-grammar-practice-levels-v1'

export function GrammarPractice({ onBack, onDashboard, isFavorite, onToggleFavorite, questId, onQuestComplete }: GrammarPracticeProps) {
  const quest = getQuestById(questId)
  const questMode = Boolean(quest?.grammarDrills.length)
  const [pool, setPool] = useState<DrillExercise[] | null>(null)
  const [completedBatches, setCompletedBatches] = useState(0)
  const nextBatchSeed = useRef(Math.floor(Date.now() / 1000))

  const buildFreshPool = useCallback(async (levels: readonly GenerationComplexity[], onBatchReady?: (completed: number) => void) => {
    // requestAnimationFrame never fires while the tab is hidden/backgrounded
    // (common on mobile mid-navigation), which would hang this forever.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    const exercises: DrillExercise[] = []
    const seedBase = nextBatchSeed.current
    nextBatchSeed.current += GRAMMAR_BATCH_COUNT

    for (let batch = 0; batch < GRAMMAR_BATCH_COUNT; batch += 1) {
      exercises.push(...createGeneratedGrammarDrillBatch(seedBase + batch, levels))
      onBatchReady?.(batch + 1)
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    }

    return exercises
  }, [])

  useEffect(() => {
    if (questMode) return
    let cancelled = false

    async function buildSession() {
      const initialLevels = loadLevelPreference(GRAMMAR_LEVELS_KEY)
      const exercises = await buildFreshPool(initialLevels, (completed) => {
        if (!cancelled) setCompletedBatches(completed)
      })
      if (!cancelled) setPool(exercises)
    }

    void buildSession()
    return () => { cancelled = true }
  }, [buildFreshPool, questMode])

  if (quest?.grammarDrills.length) {
    return (
      <ChoiceDrill
        pool={[...quest.grammarDrills]}
        badgeLabel="Grammar"
        eyebrow={quest.title}
        finishMark="文法"
        finishTitle="Grammar step complete"
        finishNoun="quest grammar choices"
        storagePrefix={`kanji-quest-${quest.id}-grammar`}
        availableLevels={[1]}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        onBack={onBack}
        onDashboard={onDashboard}
        onFinishAction={onQuestComplete}
        finishActionLabel="Read the scene →"
      />
    )
  }

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
