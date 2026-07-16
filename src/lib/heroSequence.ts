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
import { buildGeneratedHeroSteps } from './generatedHeroSequence'
import { getHeroEnglish } from './heroSentenceGloss'
import type { JlptLevel } from './types'
import type { WrongPool } from './wrongPool'

const TOTAL_STEPS = 100

const STEPS_CACHE = new Map<string, HeroStep[]>()
const STEPS_CACHE_VERSION = 6

if (typeof window !== 'undefined') {
  window.addEventListener('kanji-quest-content-database-change',()=>STEPS_CACHE.clear())
}

export function clearHeroStepsCache(): void {
  STEPS_CACHE.clear()
}

export function buildHeroSteps(
  _wrongPool: WrongPool,
  _progress: Record<string, unknown> = {},
  level: JlptLevel,
): HeroStep[] {
  const cacheKey = `${level}:database:v${STEPS_CACHE_VERSION}`
  const cached = STEPS_CACHE.get(cacheKey)
  if (cached) return cached

  const generated=buildGeneratedHeroSteps(level)
  const steps: HeroStep[] = generated.length>1 ? generated : buildCuratedHeroSteps(TOTAL_STEPS).map((step) => ({
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
    const en = step.frame.generatedEnglish ?? (step.frame.curatedId ? getCuratedEnglish(step.frame.curatedId) : getHeroEnglish(step.frame))
    if (!jp || !en) issues++
  }
  if (steps.every(step=>!step.frame.generatedEnglish)) {
    issues += auditCuratedSteps(
      steps.map((s) => ({
        frame: s.frame,
        changed: s.changed,
        templateRefresh: s.templateRefresh,
      })),
    )
  }
  return issues
}

export { CURATED_ROTATIONS_PER_SENTENCE as ROTATIONS_PER_SENTENCE }
