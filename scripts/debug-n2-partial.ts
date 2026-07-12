import { buildHeroSteps } from '../src/lib/heroSequence'
import { getHeroEnglish } from '../src/lib/heroSentenceGloss'
import {
  buildForcedSlotEnglishDiff,
  diffEnglishObjectSwap,
  diffEnglishWordSwap,
} from '../src/lib/heroEnglishDiff'
import { buildHeroEnglishTrack } from '../src/lib/heroEnglishTrack'
import { formatHeroEnglishObject } from '../src/lib/heroWordFit'
import { heroTopicLabel } from '../src/lib/heroCollocations'

const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, 'N2')
const step = steps[1]
const prev = steps[0]
const prevEn = getHeroEnglish(prev.frame)
const en = getHeroEnglish(step.frame)

console.log('word', prev.frame.word, '->', step.frame.word)
console.log('topic', heroTopicLabel(step.frame.word))
console.log('formatObj', formatHeroEnglishObject(step.frame))
console.log('prev EN:', prevEn)
console.log('next EN:', en)

const objectDiff = diffEnglishObjectSwap(step.frame, prev.frame, prevEn, en)
const relaxed = diffEnglishWordSwap(prevEn, en, true)
const forced = buildForcedSlotEnglishDiff('word', step.frame, prev.frame, prevEn, en)
console.log('objectDiff', objectDiff)
console.log('relaxed', relaxed)
console.log('forced', forced)

const track = buildHeroEnglishTrack(
  step.frame,
  prev.frame,
  false,
  ['word'],
  ['word'],
  'word',
  true,
)
console.log('track', track.mode)
if (track.mode === 'partial') {
  console.log('before', JSON.stringify(track.before))
  console.log('reel', track.reel.text, track.reel.prevText)
  console.log('after', JSON.stringify(track.after))
}
