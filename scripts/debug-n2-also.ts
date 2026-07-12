import { buildHeroSteps } from '../src/lib/heroSequence'
import { getHeroEnglish } from '../src/lib/heroSentenceGloss'
import { buildHeroEnglishTrack } from '../src/lib/heroEnglishTrack'

const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, 'N2')
const step = steps.find((s, i) => i > 0 && s.changed.includes('topicParticle'))
if (!step) {
  console.log('no topic particle step')
  process.exit(0)
}
const i = steps.indexOf(step)
const prev = steps[i - 1]
const prevEn = getHeroEnglish(prev.frame)
const en = getHeroEnglish(step.frame)
console.log('prev:', prevEn)
console.log('next:', en)
const track = buildHeroEnglishTrack(
  step.frame,
  prev.frame,
  false,
  ['topicParticle'],
  ['topicParticle'],
  'topicParticle',
  true,
)
console.log('track', track)
