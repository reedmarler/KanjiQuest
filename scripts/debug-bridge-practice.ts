import { getHeroEnglish } from '../src/lib/heroSentenceGloss'
import { masuPredicateVariants } from '../src/lib/heroPredicateConjugation'

const frame = {
  prefix: '',
  subject: '',
  topicParticle: '',
  modifier: '',
  word: '漢字',
  objectParticle: '',
  bridge: 'は難しいと思うので、',
  predicate: '毎日練習しています',
}

for (const p of masuPredicateVariants(frame.predicate)) {
  console.log(p, '->', getHeroEnglish({ ...frame, predicate: p }))
}
