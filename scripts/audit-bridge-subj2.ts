import { buildHeroSteps } from "../src/lib/heroSequence"
import { frameToJapanese } from "../src/lib/heroSentenceNatural"

for (const level of ["N2","N3"] as const) {
  const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, level)
  console.log("\n" + level)
  for (const step of steps) {
    const f = step.frame
    if (!f.bridge) continue
    const jp = frameToJapanese(f)
    if (f.subject) console.log("SUBJ+BRIDGE:", jp)
  }
}
