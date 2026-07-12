import { buildHeroSteps } from "../src/lib/heroSequence"
import { getHeroEnglish } from "../src/lib/heroSentenceGloss"

const patterns: [string, RegExp][] = [
  ["lowercase start", /^[a-z]/],
  [", She", /, She\b/],
  [", He", /, He\b/],
  [", My teacher", /, My teacher\b/],
  [", My friend", /, My friend\b/],
  ["and She", / and She\b/],
  ["and He", / and He\b/],
  ["and My ", / and My [A-Z]/],
  ["temporal+lowercase verb", /\b(Yesterday|Last week|This morning), [a-z]+ (went|read|ate)/],
]

for (const level of ["N3","N1","N5"] as const) {
  const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, level)
  const hits = new Map<string, string[]>()
  for (const step of steps) {
    const en = getHeroEnglish(step.frame)
    for (const [name, p] of patterns) {
      if (p.test(en)) {
        if (!hits.has(name)) hits.set(name, [])
        hits.get(name)!.push(en)
      }
    }
  }
  console.log("\n" + level)
  for (const [name, lines] of hits) {
    console.log(name, lines.length, "e.g.", lines[0])
  }
}
