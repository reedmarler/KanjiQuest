import { getHeroEnglish } from '../src/lib/heroSentenceGloss'

const frame = {
  prefix: '',
  subject: '',
  topicParticle: '',
  modifier: '',
  word: '文法',
  objectParticle: '',
  bridge: 'は学問の基礎であり、',
  predicate: '毎日勉強しています',
}
console.log('pos:', getHeroEnglish(frame))
frame.predicate = '毎日勉強していません'
console.log('neg:', getHeroEnglish(frame))
