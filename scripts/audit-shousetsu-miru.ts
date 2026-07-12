import { buildHeroSteps } from "../src/lib/heroSequence"
import { frameToJapanese } from "../src/lib/heroSentenceNatural"
import { findMasuVerbBase } from "../src/lib/heroPredicateConjugation"

const hits: string[] = []
for (const level of ["N5","N4","N3","N2","N1"] as const) {
  const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, level)
  for (const step of steps) {
    const f = step.frame
    const base = findMasuVerbBase(f.predicate)
    if (f.word === "小説" && base === "見ます") hits.push(`${level}: ${frameToJapanese(f)}`)
    if (f.word === "小説" && f.predicate.includes("見")) hits.push(`${level}: ${frameToJapanese(f)}`)
  }
}
console.log(hits.length)
for (const h of hits) console.log(h)
