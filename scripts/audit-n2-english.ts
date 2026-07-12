import { buildHeroSteps } from '../src/lib/heroSequence'
import { getHeroEnglish } from '../src/lib/heroSentenceGloss'
import { frameToJapanese } from '../src/lib/heroSentenceNatural'
import { buildHeroEnglishTrack } from '../src/lib/heroEnglishTrack'
import { isMinimalEnglishSlotChange } from '../src/lib/heroEnglishDiff'

const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, 'N2')

let partialCount = 0
let blurCount = 0
let staticCount = 0
const blurReasons: string[] = []

for (let i = 1; i < Math.min(60, steps.length); i++) {
  const step = steps[i]
  const prev = steps[i - 1]
  const changed = step.changed.filter((s) => step.frame[s] !== prev.frame[s])
  const prevEn = getHeroEnglish(prev.frame)
  const en = getHeroEnglish(step.frame)

  const track = buildHeroEnglishTrack(
    step.frame,
    prev.frame,
    false,
    changed,
    changed.length === 1 ? changed : [],
    `step-${i}`,
    true,
  )

  if (track.mode === 'partial') partialCount++
  else if (track.mode === 'blur') {
    blurCount++
    blurReasons.push(
      `#${i} [${changed.join(',')}] minimal=${isMinimalEnglishSlotChange(changed, step.frame, prev.frame)} jp=${frameToJapanese(step.frame)}`,
    )
  } else staticCount++
}

console.log('N2 first 60 steps:', { partial: partialCount, blur: blurCount, static: staticCount })
console.log('Blur fallbacks:', blurReasons.slice(0, 20).join('\n'))

// Capitalization audit
const capIssues: string[] = []
const patterns = [
  /, [A-Z][a-z]+ (also )?(went|reads|studies|thinks|wants|is|has|can|does)/,
  /\bYesterday, [a-z]/,
  /\bLast week, [a-z]/,
  /\bThis morning, [a-z]/,
  /, She\b/,
  /, He\b/,
  /, My teacher\b/,
  /, My friend\b/,
  /\band (She|He|My teacher|My friend)\b/,
]

for (let i = 0; i < steps.length; i++) {
  const en = getHeroEnglish(steps[i].frame)
  for (const p of patterns) {
    if (p.test(en)) {
      capIssues.push(`#${i} ${p}: ${en}`)
      break
    }
  }
}

console.log('\nCapitalization issues:', capIssues.length)
for (const line of capIssues.slice(0, 25)) console.log(line)
