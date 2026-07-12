import { buildHeroSteps } from "../src/lib/heroSequence"
import { getHeroEnglish } from "../src/lib/heroSentenceGloss"

for (const level of ["N2","N3"] as const) {
  const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, level)
  for (const step of steps) {
    const f = step.frame
    if (f.bridge && !f.subject) {
      const en = getHeroEnglish(f)
      if (/ and wants/.test(en) || / and studies/.test(en) || /^ /.test(en)) console.log(level, en, f.predicate, f.bridge)
    }
  }
}
