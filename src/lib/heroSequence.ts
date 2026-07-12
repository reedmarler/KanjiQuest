import {
  HERO_SLOT_WIDTHS,
  type HeroStep,
} from '../data/heroSentences'
import {
  auditCuratedSteps,
  buildCuratedHeroSteps,
  CURATED_ROTATIONS_PER_SENTENCE,
  getCuratedEnglish,
} from './curatedSentenceEngine'
import { segmentsToJapanese } from './posSentenceEngine'
import type { JlptLevel } from './types'
import type { WrongPool } from './wrongPool'

const TOTAL_STEPS = 100

const STEPS_CACHE = new Map<string, HeroStep[]>()
const STEPS_CACHE_VERSION = 5

export function clearHeroStepsCache(): void {
  STEPS_CACHE.clear()
}

export function buildHeroSteps(
  _wrongPool: WrongPool,
  _progress: Record<string, unknown> = {},
  level: JlptLevel,
): HeroStep[] {
  const cacheKey = `${level}:curated:v${STEPS_CACHE_VERSION}`
  const cached = STEPS_CACHE.get(cacheKey)
  if (cached) return cached

  const curated = buildCuratedHeroSteps(TOTAL_STEPS)
  const steps: HeroStep[] = curated.map((step) => ({
    frame: step.frame,
    changed: step.changed,
    slotWidths: HERO_SLOT_WIDTHS,
    templateRefresh: step.templateRefresh,
  }))

  STEPS_CACHE.set(cacheKey, steps)
  return steps
}

/** Validate gloss can be produced for every step */
export function auditPosSteps(level: JlptLevel): number {
  const steps = buildHeroSteps({} as WrongPool, {}, level)
  let issues = 0
  for (const step of steps) {
    const jp = segmentsToJapanese(step.frame.segments ?? [])
    const en = step.frame.curatedId ? getCuratedEnglish(step.frame.curatedId) : ''
    if (!jp || !en) issues++
  }
  issues += auditCuratedSteps(
    steps.map((s) => ({
      frame: s.frame,
      changed: s.changed,
      templateRefresh: s.templateRefresh,
    })),
  )
  return issues
}

export { CURATED_ROTATIONS_PER_SENTENCE as ROTATIONS_PER_SENTENCE }
