import { buildHeroSteps } from "../src/lib/heroSequence"
import { frameToJapanese } from "../src/lib/heroSentenceNatural"
import { getHeroEnglish } from "../src/lib/heroSentenceGloss"
import { findMasuVerbBase } from "../src/lib/heroPredicateConjugation"

const bad: string[] = []
const cap: string[] = []
const patterns = [
  [/, She\b/, ", She"],
  [/, He\b/, ", He"],
  [/, My teacher\b/, ", My teacher"],
  [/, My friend\b/, ", My friend"],
  [/ and She\b/, " and She"],
  [/ and He\b/, " and He"],
  [/ and My /, " and My"],
  [/^[^A-Z]/, "lowercase start"],
  [/\bYesterday, [a-z]/, "Yesterday lowercase"],
  [/\bThis morning, [a-z]/, "morning lowercase"],
]

for (const level of ["N5","N4","N3","N2","N1"] as const) {
  const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, level)
  for (let i = 0; i < steps.length; i++) {
    const f = steps[i].frame
    const jp = frameToJapanese(f)
    const en = getHeroEnglish(f)
    const base = findMasuVerbBase(f.predicate)
    if (base === "見ます" && ["本","小説","雑誌","新聞","漫画","辞書","文学","哲学","歴史","経済","政治"].includes(f.word)) {
      bad.push(`[${level}] ${jp} | ${en}`)
    }
    if (base === "読みます" && ["映画","写真","ドラマ","アニメ","テレビ"].includes(f.word)) {
      bad.push(`[${level}] read-watch ${jp}`)
    }
    for (const [re, label] of patterns) {
      if (re.test(en)) { cap.push(`[${level}] ${label}: ${en}`); break }
    }
  }
}
console.log("watch+read-material", bad.length)
for (const b of [...new Set(bad)].slice(0, 20)) console.log(b)
console.log("\ncap issues", cap.length)
for (const c of [...new Set(cap)].slice(0, 30)) console.log(c)
