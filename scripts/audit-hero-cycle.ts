import { buildHeroSteps } from '../src/lib/heroSequence'
import { frameToJapanese } from '../src/lib/heroSentenceNatural'
import { frameTenseRequirement, predicateMatchesFrameTense } from '../src/lib/heroGrammarCoherence'
import type { HeroSlot } from '../src/data/heroSentences'

const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, 'N5')

const counts: Record<string, number> = {}
let tenseErrors = 0
let templateRefreshes = 0

for (let i = 1; i < Math.min(50, steps.length); i++) {
  const step = steps[i]
  const prev = steps[i - 1]
  const changed = step.changed.filter((s) => step.frame[s] !== prev.frame[s])
  for (const slot of changed) {
    counts[slot] = (counts[slot] ?? 0) + 1
  }
  if (step.templateRefresh) templateRefreshes++

  const req = frameTenseRequirement(step.frame)
  if (!predicateMatchesFrameTense(step.frame.predicate, req)) {
    tenseErrors++
    console.log('TENSE ERR', frameToJapanese(step.frame), step.frame.predicate, req)
  }
}

console.log('First 50 steps — slot changes:', counts)
console.log('Template refreshes:', templateRefreshes)
console.log('Tense mismatches:', tenseErrors)
const kinou = steps.filter((s) => s.frame.prefix === '昨日')
if (kinou.length > 0) {
  console.log('昨日 sample:', kinou.slice(0, 5).map((s) => ({
    jp: frameToJapanese(s.frame),
    pred: s.frame.predicate,
    word: s.frame.word,
  })))
}
