import { buildHeroSteps } from "../src/lib/heroSequence"
import { frameToJapanese } from "../src/lib/heroSentenceNatural"

const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, "N2")
const kinds: Record<string, number> = {}
for (let i = 1; i < steps.length; i++) {
  for (const s of steps[i].changed) kinds[s] = (kinds[s] ?? 0) + 1
}
console.log("N2 slot change counts:", kinds)
for (const step of steps) {
  if (step.changed.includes("bridge")) {
    console.log("bridge swap:", frameToJapanese(step.frame))
  }
}
