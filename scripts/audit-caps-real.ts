import { buildHeroSteps } from "../src/lib/heroSequence"
import { getHeroEnglish } from "../src/lib/heroSentenceGloss"

const bad: string[] = []
for (const level of ["N5","N4","N3","N2","N1"] as const) {
  const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, level)
  for (const step of steps) {
    const en = getHeroEnglish(step.frame)
    if (/^[^A-Z]/.test(en)) bad.push(`[${level}] lowercase start: ${en}`)
    if (/, (She|He|My teacher|My friend)\b/.test(en)) bad.push(`[${level}] cap pronoun: ${en}`)
    if (/ and (She|He|My )/.test(en)) bad.push(`[${level}] cap after and: ${en}`)
  }
}
console.log("issues", bad.length)
for (const line of bad.slice(0, 30)) console.log(line)
