import { allCards } from '../src/data/index.ts'
import { getHeroCollocations, hasAnyHeroCollocation } from '../src/lib/heroCollocations.ts'
import { findTemplatesForWord } from '../src/lib/heroWordFit.ts'
import { getHeroEnglish } from '../src/lib/heroSentenceGloss.ts'
import { frameToJapanese } from '../src/lib/heroSentenceNatural.ts'
import { frameIsValid } from '../src/lib/heroSentenceValidate.ts'
import { isTopicCommentTemplate } from '../src/data/heroSentences.ts'
import type { JlptLevel } from '../src/lib/types.ts'

const level = (process.argv[2] as JlptLevel) ?? 'N2'
const cards = allCards.filter(
  (c) => c.jlpt === level && (c.type === 'vocab' || c.type === 'kanji'),
)

let withCollocation = 0
let withTemplate = 0
let validSamples = 0
const samples: string[] = []

for (const card of cards) {
  const word = card.type === 'vocab' ? card.front : card.front
  if (!hasAnyHeroCollocation(word)) continue
  withCollocation++

  const templates = findTemplatesForWord(word)
  if (templates.length === 0) continue
  withTemplate++

  const template = templates[0]
  const frame = {
    subject: template.topicComment ? '' : '私',
    topicParticle: template.topicComment ? '' : 'は',
    modifier: template.modifier ?? '',
    word,
    objectParticle: template.objectParticle,
    predicate: template.predicate,
  }

  if (frameIsValid(frame, template)) {
    validSamples++
    if (samples.length < 8) {
      samples.push(`${frameToJapanese(frame)} | ${getHeroEnglish(frame)}`)
    }
  }
}

console.log(`Level ${level}: cards=${cards.length} collocations=${withCollocation} templates=${withTemplate} valid=${validSamples}`)
for (const line of samples) console.log(' ', line)

const missing = cards
  .map((c) => c.front)
  .filter((w, i, arr) => arr.indexOf(w) === i)
  .filter((w) => !hasAnyHeroCollocation(w))
console.log(`Missing collocations (${missing.length}):`, missing.slice(0, 20).join(', '))
