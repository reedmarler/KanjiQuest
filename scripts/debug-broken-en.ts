import { buildHeroSteps } from "../src/lib/heroSequence"
import { getHeroEnglish } from "../src/lib/heroSentenceGloss"
import { getScaffoldEnglish } from "../src/lib/heroSentenceGloss"

// can't import private - use heuristics
const bad: string[] = []
for (const level of ["N5","N4","N3","N2","N1"] as const) {
  const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, level)
  for (const step of steps) {
    const en = getHeroEnglish(step.frame)
    if (/^ /.test(en) || /^ uses /.test(en) || / and wants to/.test(en) || /, wants to/.test(en)) {
      bad.push(`${level} [${step.frame.bridge}|${step.frame.predicate}] ${en}`)
    }
  }
}
console.log(bad.length)
for (const b of [...new Set(bad)].slice(0,40)) console.log(b)
