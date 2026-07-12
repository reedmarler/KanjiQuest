import { buildHeroSteps } from '../src/lib/heroSequence'
import { frameJapaneseIsValid, frameToJapanese } from '../src/lib/heroSentenceNatural'
import type { JlptLevel } from '../src/lib/types'

const level = (process.argv[2] as JlptLevel) ?? 'N5'
const steps = buildHeroSteps({ ids: [], byDeck: {} }, {}, level)
const issues: string[] = []

for (let i = 0; i < steps.length; i++) {
  const frame = steps[i].frame
  const jp = frameToJapanese(frame)
  if (!frameJapaneseIsValid(frame)) {
    issues.push(`step ${i} | ${jp}`)
  }
}

console.log(`Level ${level}: ${steps.length} steps, invalid Japanese frames ${issues.length}`)
for (const line of issues.slice(0, 20)) console.log(line)
