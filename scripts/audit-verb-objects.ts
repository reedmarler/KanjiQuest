import { buildHeroSteps, clearHeroStepsCache } from '../src/lib/heroSequence'
import { segmentsToJapanese } from '../src/lib/posSentenceEngine'
import { getPosTemplate } from '../src/data/heroPosTemplates'
import { getVerbObjectBindings, fitsWo, fitsNi, posFillsAreValid } from '../src/lib/posSentenceVet'
import type { JlptLevel } from '../src/lib/types'

clearHeroStepsCache()
const levels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

let totalBad = 0
for (const level of levels) {
  const steps = buildHeroSteps({}, {}, level)
  let bad = 0
  for (const step of steps) {
    const f = step.frame
    if (!f.templateId || !f.fills) continue
    const template = getPosTemplate(f.templateId)
    if (!posFillsAreValid(template, f.fills)) {
      bad++
      console.log(`[${level}] INVALID`, segmentsToJapanese(f.segments ?? []), f.fills)
    }
    for (const b of getVerbObjectBindings(template)) {
      const noun = f.fills[b.nounSlot]
      const verb = f.fills[b.verbSlot] ?? f.fills.V
      if (!noun || !verb) continue
      const ok = b.particle === 'を' ? fitsWo(noun, verb) : fitsNi(noun, verb)
      if (!ok) {
        bad++
        console.log(`[${level}] BIND`, segmentsToJapanese(f.segments ?? []), b, noun, verb)
      }
    }
  }
  console.log(`${level}: ${bad} bad / ${steps.length} steps`)
  totalBad += bad
}
console.log('total bad:', totalBad)
process.exit(totalBad > 0 ? 1 : 0)
