import { buildHeroSteps } from '../src/lib/heroSequence'
import { frameToJapanese } from '../src/lib/heroSentenceNatural'
import { wordFitsPredicate } from '../src/lib/heroWordVerbFit'
import { findMasuVerbBase } from '../src/lib/heroPredicateConjugation'

const weird: string[] = []

for (const level of ['N5', 'N4', 'N3', 'N2', 'N1'] as const) {
  const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, level)
  for (let i = 0; i < steps.length; i++) {
    const f = steps[i].frame
    const jp = frameToJapanese(f)
    if (!wordFitsPredicate(f.word, f.predicate, f.objectParticle)) {
      weird.push(`[${level}]#${i} verb-fit: ${jp}`)
    }
    const base = findMasuVerbBase(f.predicate)
    if (base === '見ます' && f.word === '新聞') {
      weird.push(`[${level}]#${i} watch-newspaper: ${jp}`)
    }
    if (base === '読みます' && f.word === '写真') {
      weird.push(`[${level}]#${i} read-photo: ${jp}`)
    }
    if (base === '読みます' && f.word === '地図' && f.modifier === '友達と会って、') {
      weird.push(`[${level}]#${i} read-map-after-friend: ${jp}`)
    }
    if (f.bridge && !f.subject && f.predicate.includes('勉強')) {
      // topic-comment with study — check if word is abstract topic
    }
    // Double topic markers
    if ((jp.match(/は/g) ?? []).length >= 3 && f.bridge) {
      weird.push(`[${level}]#${i} many-wa: ${jp}`)
    }
  }
}

console.log('weird count', weird.length)
for (const w of [...new Set(weird)].slice(0, 50)) console.log(w)
