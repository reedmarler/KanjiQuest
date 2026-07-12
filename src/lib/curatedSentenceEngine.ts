import {
  CURATED_BY_ID,
  CURATED_HERO_SENTENCES,
  type CuratedHeroSentence,
} from '../data/curatedHeroSentences'
import type { HeroSentenceFrame } from '../data/heroSentences'
import { sanitizeHeroEnglishGloss } from './heroEnglishNormalize'
import {
  getChangedSegmentKeys,
  type HeroSegment,
} from './posSentenceEngine'

export const CURATED_ROTATIONS_PER_SENTENCE = 5

export function curatedToFrame(sentence: CuratedHeroSentence): HeroSentenceFrame {
  return {
    curatedId: sentence.id,
    segments: sentence.segments.map((s) => ({ ...s })),
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

export function getCuratedSentence(id: number): CuratedHeroSentence | undefined {
  return CURATED_BY_ID.get(id)
}

export function getCuratedEnglish(id: number): string {
  const raw = CURATED_BY_ID.get(id)?.english ?? ''
  return sanitizeHeroEnglishGloss(raw)
}

function pickFrom<T>(list: readonly T[], seed: number, exclude?: ReadonlySet<T>): T | null {
  const pool = exclude ? list.filter((x) => !exclude.has(x)) : [...list]
  if (pool.length === 0) return null
  return pool[Math.abs(seed) % pool.length]!
}

/** Which swappable slot differs between two curated sentences (null if not 1 apart) */
function diffSlotForIds(aId: number, bId: number): string | null {
  const a = CURATED_BY_ID.get(aId)
  const b = CURATED_BY_ID.get(bId)
  if (!a || !b || a.pattern !== b.pattern) return null

  let diff: string | null = null
  for (const [key, val] of Object.entries(a.slots)) {
    if (b.slots[key] !== val) {
      if (diff) return null
      diff = key
    }
  }
  return diff
}

/** Pick a 1-slot neighbor; prefer ids not used in the current 5-step cycle */
function pickNeighbor(
  currentId: number,
  seed: number,
  cycleUsed: ReadonlySet<number>,
  avoidSlot: string | null = null,
): number {
  const current = CURATED_BY_ID.get(currentId)
  if (!current) return CURATED_HERO_SENTENCES[0]!.id

  const unused = current.neighbors.filter((id) => !cycleUsed.has(id))
  const pool = unused.length > 0 ? unused : [...current.neighbors]

  if (avoidSlot && pool.length > 1) {
    const altSlot = pool.filter((id) => diffSlotForIds(currentId, id) !== avoidSlot)
    if (altSlot.length > 0) {
      const picked = pickFrom(altSlot, seed)
      if (picked !== null) return picked
    }
  }

  const fresh = pickFrom(pool, seed)
  if (fresh !== null) return fresh

  const any = pickFrom(current.neighbors, seed + 1)
  if (any !== null) return any

  for (const s of CURATED_HERO_SENTENCES) {
    if (s.id !== currentId && s.neighbors.includes(currentId)) return s.id
  }
  return CURATED_HERO_SENTENCES[(seed + currentId) % CURATED_HERO_SENTENCES.length]!.id
}

function pickFreshStart(seed: number, recent: ReadonlySet<number>): number {
  const pool = CURATED_HERO_SENTENCES.filter((s) => !recent.has(s.id))
  const list = pool.length > 0 ? pool : CURATED_HERO_SENTENCES
  return list[Math.abs(seed) % list.length]!.id
}

export interface CuratedHeroStep {
  frame: HeroSentenceFrame
  changed: string[]
  templateRefresh: boolean
}

export function buildCuratedHeroSteps(totalSteps = 100): CuratedHeroStep[] {
  const steps: CuratedHeroStep[] = []
  let currentId = pickFreshStart(0, new Set())
  let cycleUsed = new Set<number>([currentId])
  let lastChangedSlot: string | null = null

  for (let i = 0; i < totalSteps; i++) {
    const subStep = i % CURATED_ROTATIONS_PER_SENTENCE
    const templateRefresh = subStep === 0

    if (i > 0 && subStep === 0) {
      const recent = new Set<number>()
      for (let j = Math.max(0, i - CURATED_ROTATIONS_PER_SENTENCE); j < i; j++) {
        const prevId = steps[j]!.frame.curatedId
        if (prevId) recent.add(prevId)
      }
      currentId = pickFreshStart(i, recent)
      cycleUsed = new Set([currentId])
      lastChangedSlot = null
    } else if (i > 0) {
      const current = CURATED_BY_ID.get(currentId)
      const hasNeighbor = (current?.neighbors.length ?? 0) > 0
      if (!hasNeighbor) {
        const recent = new Set(cycleUsed)
        currentId = pickFreshStart(i, recent)
        cycleUsed = new Set([currentId])
        lastChangedSlot = null
      } else {
        const nextId = pickNeighbor(currentId, i, cycleUsed, lastChangedSlot)
        if (nextId === currentId) {
          const recent = new Set(cycleUsed)
          currentId = pickFreshStart(i, recent)
          cycleUsed = new Set([currentId])
          lastChangedSlot = null
        } else {
          currentId = nextId
          cycleUsed.add(currentId)
        }
      }
    }

    const sentence = CURATED_BY_ID.get(currentId)!
    const frame = curatedToFrame(sentence)
    const prevSegments: HeroSegment[] = i === 0
      ? []
      : (steps[i - 1]!.frame.segments ?? [])

    const changed = getChangedSegmentKeys(prevSegments, frame.segments ?? [])

    steps.push({
      frame,
      changed,
      templateRefresh,
    })

    if (!templateRefresh && changed.length === 1) {
      lastChangedSlot = changed[0]!
    }
  }

  return steps
}

/** Verify every non-refresh step is exactly 1 swappable slot apart */
export function auditCuratedSteps(steps: CuratedHeroStep[]): number {
  let issues = 0
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]!.frame
    const curr = steps[i]!.frame
    const prevId = prev.curatedId
    const currId = curr.curatedId
    if (!prevId || !currId) {
      issues++
      continue
    }
    if (steps[i]!.templateRefresh) continue

    const prevS = CURATED_BY_ID.get(prevId)
    const currS = CURATED_BY_ID.get(currId)
    if (!prevS || !currS || prevS.pattern !== currS.pattern) {
      issues++
      continue
    }
    if (!prevS.neighbors.includes(currId)) {
      issues++
    }
  }
  return issues
}
