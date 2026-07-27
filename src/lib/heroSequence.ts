import { HERO_SLOT_WIDTHS, type HeroSentenceFrame, type HeroStep } from '../data/heroSentences'
import { swappableSlotsInTemplate } from '../data/heroPosTemplates'
import {
  compileSegments,
  fillTemplate,
  getChangedSegmentKeys,
  HERO_POS_TEMPLATES_BY_LEVEL,
  rotateFill,
} from './posSentenceEngine'
import type { JlptLevel } from './types'
import type { WrongPool } from './wrongPool'

const RUNS_PER_LEVEL = 24
const ROTATIONS_PER_RUN = 9
const STEPS_CACHE = new Map<string, HeroStep[]>()

if (typeof window !== 'undefined') {
  window.addEventListener('kanji-quest-content-database-change', () => STEPS_CACHE.clear())
}

export function clearHeroStepsCache(): void {
  STEPS_CACHE.clear()
}

function frameFor(templateId: number, fills: Parameters<typeof compileSegments>[1]): HeroSentenceFrame {
  return {
    segments: compileSegments(
      HERO_POS_TEMPLATES_BY_LEVEL.All.find((template) => template.id === templateId)
        ?? HERO_POS_TEMPLATES_BY_LEVEL.All[0]!,
      fills,
    ),
    generatedPatternId: `database-${templateId}`,
    prefix: '',
    subject: '',
    topicParticle: '',
    modifier: '',
    word: '',
    objectParticle: '',
    bridge: '',
    predicate: '',
  }
}

/**
 * A hero run is deliberately a single grammar frame.  Each next state is
 * admitted only after the sentence validator accepts it, so one word (or a
 * verb ending) can change without making the surrounding sentence nonsense.
 */
function buildDatabaseHeroSteps(level: JlptLevel, sequenceSeed: number): HeroStep[] {
  const templates = HERO_POS_TEMPLATES_BY_LEVEL[level]
  if (!templates.length) return []

  const start = Math.abs(sequenceSeed) % templates.length
  const selected = Array.from({ length: RUNS_PER_LEVEL }, (_, index) => (
    // 17 walks through the template bank without clustering neighboring grammar.
    templates[(start + index * 17) % templates.length]!
  ))

  const steps: HeroStep[] = []

  selected.forEach((template, templateIndex) => {
    let fills = fillTemplate(template, sequenceSeed + 1409 + templateIndex * 113)
    let current = frameFor(template.id, fills)
    const slots = swappableSlotsInTemplate(template)

    steps.push({
      frame: current,
      changed: [],
      slotWidths: HERO_SLOT_WIDTHS,
      templateRefresh: true,
    })

    for (let turn = 0; turn < Math.max(ROTATIONS_PER_RUN, slots.length); turn++) {
      const slot = slots[turn % slots.length]
      const nextFills = rotateFill(fills, slot!, sequenceSeed + 3001 + templateIndex * 97 + turn * 19, template)
      const next = frameFor(template.id, nextFills)
      const changed = getChangedSegmentKeys(current.segments ?? [], next.segments ?? [])

      // A failed validation can return the existing fills. Do not create a
      // fake animation in that case.
      if (changed.length !== 1) continue

      steps.push({
        frame: next,
        changed,
        slotWidths: HERO_SLOT_WIDTHS,
        templateRefresh: false,
      })
      fills = nextFills
      current = next
    }
  })

  return steps
}

export function buildHeroSteps(
  _wrongPool: WrongPool,
  _progress: Record<string, unknown> = {},
  level: JlptLevel,
  sequenceSeed = 0,
): HeroStep[] {
  const cacheKey = `${level}:${sequenceSeed}`
  const cached = STEPS_CACHE.get(cacheKey)
  if (cached) return cached

  const steps = buildDatabaseHeroSteps(level, sequenceSeed)
  STEPS_CACHE.set(cacheKey, steps)
  return steps
}

/** Kept for the Content Studio audit action. */
export function auditPosSteps(level: JlptLevel): number {
  return buildHeroSteps({} as WrongPool, {}, level)
    .filter((step) => !(step.frame.segments?.map((segment) => segment.text).join('')))
    .length
}

export const ROTATIONS_PER_SENTENCE = ROTATIONS_PER_RUN
