import { buildHeroSteps } from '../src/lib/heroSequence'
import { frameToJapanese } from '../src/lib/heroSentenceNatural'
import { getHeroEnglish } from '../src/lib/heroSentenceGloss'

const steps = buildHeroSteps({}, {}, 'N3')
for (let i = 0; i < 20; i++) {
  const s = steps[i]
  const jp = frameToJapanese(s.frame)
  const en = getHeroEnglish(s.frame)
  console.log(
    `#${i} [${s.changed.join(',')}] refresh=${s.templateRefresh}`,
    jp,
    '|',
    en,
  )
}
