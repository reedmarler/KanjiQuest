import { wordFitsPredicate } from '../src/lib/heroWordVerbFit'
import { conjugateVerb } from '../src/lib/posSentenceConjugate'
import { getPosTemplate } from '../src/data/heroPosTemplates'
import { fillTemplate, compileSegments, segmentsToJapanese } from '../src/lib/posSentenceEngine'
import { posFillsAreValid } from '../src/lib/posSentenceVet'
import { buildHeroSteps, clearHeroStepsCache } from '../src/lib/heroSequence'

const masu = conjugateVerb('聞く', 'desu')
console.log('聞きます masu:', masu)
console.log('パン+聞く fits:', wordFitsPredicate('パン', masu, 'を'))

clearHeroStepsCache()
const steps = buildHeroSteps({}, {}, 'N3')
let bad = 0
for (const step of steps) {
  const jp = segmentsToJapanese(step.frame.segments ?? [])
  if (/パン.*聞|聞.*パン/.test(jp)) {
    bad++
    console.log('BAD:', jp, step.frame.fills)
  }
}
console.log('bad steps with pan+kiku:', bad)

const t = getPosTemplate(1)
for (let i = 0; i < 500; i++) {
  const f = fillTemplate(t, i)
  if (f.V === '聞く' && f.N === 'パン') {
    console.log('fill produced pan+kiku at seed', i, posFillsAreValid(t, f))
  }
}
