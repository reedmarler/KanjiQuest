import { buildCuratedHeroSteps } from '../src/lib/curatedSentenceEngine'
import { CURATED_BY_ID } from '../src/data/curatedHeroSentences'

function diffSlot(aId: number, bId: number): string | null {
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

const steps = buildCuratedHeroSteps(100)
let issues = 0
let sameSlotRuns = 0

for (let i = 1; i < steps.length; i++) {
  const prev = steps[i - 1]!
  const curr = steps[i]!
  const prevId = prev.frame.curatedId!
  const currId = curr.frame.curatedId!

  if (curr.templateRefresh) continue

  if (curr.changed.length !== 1) {
    console.log(`step ${i}: expected 1 changed slot, got`, curr.changed)
    issues++
  }

  const actual = diffSlot(prevId, currId)
  if (actual && curr.changed[0] !== actual) {
    console.log(`step ${i}: changed=${curr.changed[0]} actual=${actual}`)
    issues++
  }

  if (i >= 2 && !prev.templateRefresh && !curr.templateRefresh) {
    if (prev.changed[0] === curr.changed[0]) {
      sameSlotRuns++
    }
  }
}

console.log(`issues: ${issues}, consecutive same-slot steps: ${sameSlotRuns}`)
