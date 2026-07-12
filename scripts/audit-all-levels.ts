import { buildHeroSteps } from "../src/lib/heroSequence"
import { getHeroEnglish } from "../src/lib/heroSentenceGloss"
import { buildHeroEnglishTrack } from "../src/lib/heroEnglishTrack"

const levels = ["N5","N4","N3","N2","N1"] as const
const patterns = [
  /, [A-Z][a-z]+ (also )?(went|reads|studies|thinks|wants|is|has|can|does)/,
  /\bYesterday, [a-z]/,
  /\bLast week, [a-z]/,
  /\bThis morning, [a-z]/,
  /, She\b/,
  /, He\b/,
  /, My teacher\b/,
  /, My friend\b/,
  /\bI [a-z]{3,}/,
  /^[a-z]/,
]

for (const level of levels) {
  const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, level)
  let partial = 0, blur = 0
  const cap: string[] = []
  for (let i = 1; i < steps.length; i++) {
    const step = steps[i]
    const prev = steps[i-1]
    const changed = step.changed.filter(s => step.frame[s] !== prev.frame[s])
    const track = buildHeroEnglishTrack(step.frame, prev.frame, false, changed, changed.length===1?changed:[], `s${i}`, true)
    if (track.mode === "partial") partial++
    else if (track.mode === "blur") blur++
    const en = getHeroEnglish(step.frame)
    for (const p of patterns) {
      if (p.test(en)) { cap.push(en); break }
    }
  }
  console.log(level, { partial, blur, cap: cap.length })
  for (const line of cap.slice(0,5)) console.log(" ", line)
}
