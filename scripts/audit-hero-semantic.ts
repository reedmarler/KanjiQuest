import { buildHeroSteps } from '../src/lib/heroSequence'
import { getHeroEnglish } from '../src/lib/heroSentenceGloss'
import { frameToJapanese } from '../src/lib/heroSentenceNatural'
import { buildHeroEnglishTrack } from '../src/lib/heroEnglishTrack'

const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, 'N5')
let blurWord = 0
let partialWord = 0
let semanticBad = 0

for (let i = 1; i < 50; i++) {
  const step = steps[i]
  const prev = steps[i - 1]
  const changed = step.changed.filter((s) => step.frame[s] !== prev.frame[s])
  const en = getHeroEnglish(step.frame)
  if (/\b(ate|eat|eaten) (photo|map|movie|music|newspaper|magazine)/i.test(en)) semanticBad++
  if (/\b(read|reading) (music|movie)/i.test(en)) semanticBad++
  if (/\b(use|used) (movie|music|photo)/i.test(en)) semanticBad++
  const track = buildHeroEnglishTrack(
    step.frame,
    prev.frame,
    false,
    changed,
    changed.length === 1 ? changed : [],
    'k',
    true,
  )
  if (changed.length === 1 && changed[0] === 'word') {
    if (track.mode === 'blur') blurWord++
    if (track.mode === 'partial') partialWord++
  }
}

console.log('semantic nonsense:', semanticBad)
console.log('word partial swaps:', partialWord, 'word blur fallbacks:', blurWord)

for (let i = 10; i < 22; i++) {
  const step = steps[i]
  const prev = steps[i - 1]
  const changed = step.changed.filter((s) => step.frame[s] !== prev.frame[s])
  console.log(`#${i} [${changed.join(',')}] ${frameToJapanese(step.frame)}`)
  console.log(`    ${getHeroEnglish(step.frame)}`)
}
