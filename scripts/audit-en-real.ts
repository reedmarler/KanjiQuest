import { buildHeroSteps } from "../src/lib/heroSequence"
import { getHeroEnglish } from "../src/lib/heroSentenceGloss"

const bad: string[] = []
for (const level of ["N5","N4","N3","N2","N1"] as const) {
  const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, level)
  for (const step of steps) {
    const en = getHeroEnglish(step.frame)
    if (/, (She|He|My teacher|My friend|Everyone)\b/.test(en)) bad.push(`pronoun: ${en}`)
    if (/ and (She|He|My teacher|My friend)\b/.test(en)) bad.push(`and-cap: ${en}`)
    if (/^[^A-Z]/.test(en)) bad.push(`start: ${en}`)
    if (/\bwatched (novels|literature|history|magazines|newspaper|books|philosophy|economics)\b/i.test(en)) bad.push(`watch-read-en: ${en}`)
    if (/\bread (movies|photos|dramas|anime|television)\b/i.test(en)) bad.push(`read-watch-en: ${en}`)
  }
}
console.log("issues", bad.length)
for (const b of [...new Set(bad)].slice(0, 40)) console.log(b)
