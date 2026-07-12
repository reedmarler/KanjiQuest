import { buildHeroSteps } from '../src/lib/heroSequence'
import { getHeroEnglish } from '../src/lib/heroSentenceGloss'
import { frameToJapanese } from '../src/lib/heroSentenceNatural'

const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, 'N3')
for (const step of steps) {
  const en = getHeroEnglish(step.frame)
  if (/^ /.test(en) || /^[^A-Z]/.test(en)) {
    console.log(en)
    console.log('jp:', frameToJapanese(step.frame))
    console.log('frame:', step.frame)
    console.log('template:', step.template.id)
  }
}
