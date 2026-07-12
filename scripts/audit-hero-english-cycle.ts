import { buildHeroSteps } from '../src/lib/heroSequence'
import { getHeroEnglish } from '../src/lib/heroSentenceGloss'
import { frameToJapanese } from '../src/lib/heroSentenceNatural'

const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, 'N5')

const BAD_PATTERNS = [
  /\b(I|He|She) (do|does) \w+\./,
  /\b(I|He|She) uses \w+\./,
  /\bdid something with\b/,
]

const bad: { i: number; jp: string; en: string; pred: string; changed: string[] }[] = []

for (let i = 0; i < Math.min(50, steps.length); i++) {
  const step = steps[i]
  const en = getHeroEnglish(step.frame)
  if (BAD_PATTERNS.some((p) => p.test(en))) {
    bad.push({
      i,
      jp: frameToJapanese(step.frame),
      en,
      pred: step.frame.predicate,
      changed: step.changed,
    })
  }
}

console.log('Bad translations in first 50 steps:', bad.length)
for (const b of bad) console.log(b)

console.log('\nPredicate swap samples:')
for (let i = 1; i < Math.min(50, steps.length); i++) {
  const step = steps[i]
  if (step.changed.includes('predicate')) {
    console.log(frameToJapanese(step.frame))
    console.log('  =>', getHeroEnglish(step.frame))
  }
}
