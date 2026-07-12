import {
  HERO_TEMPLATES,
  charLength,
  isTopicCommentTemplate,
  type HeroSentenceFrame,
  type HeroTemplate,
} from '../src/data/heroSentences'
import { getHeroEnglish } from '../src/lib/heroSentenceGloss'
import { frameToJapanese } from '../src/lib/heroSentenceNatural'
import { buildHeroStudyPool, buildTemplateWordPool } from '../src/lib/heroStudyPool'
import { frameIsValid } from '../src/lib/heroSentenceValidate'

function buildFrame(template: HeroTemplate, word: string): HeroSentenceFrame {
  if (isTopicCommentTemplate(template)) {
    return {
      prefix: template.prefix ?? '',
      subject: '',
      topicParticle: '',
      modifier: template.modifier ?? '',
      word,
      objectParticle: template.objectParticle,
      bridge: template.bridge ?? '',
      predicate: template.predicate,
    }
  }

  return {
    prefix: template.prefix ?? '',
    subject: '私',
    topicParticle: 'は',
    modifier: template.modifier ?? '',
    word,
    objectParticle: template.objectParticle,
    bridge: template.bridge ?? '',
    predicate: template.predicate,
  }
}

const studyPool = buildHeroStudyPool({ ids: [], byDeck: {} }, {}, 'N5')
const issues: string[] = []
let validCount = 0

for (const template of HERO_TEMPLATES) {
  const pool = buildTemplateWordPool(template, studyPool, 'N5')
  for (const word of pool) {
    if (charLength(word) !== template.wordLength) {
      issues.push(`LENGTH ${template.id}: "${word}" is ${charLength(word)} chars, wants ${template.wordLength}`)
      continue
    }
    const frame = buildFrame(template, word)
    const jp = frameToJapanese(frame)
    const en = getHeroEnglish(frame)
    if (!frameIsValid(frame, template)) {
      issues.push(`INVALID ${template.id} | ${jp} | ${en}`)
      continue
    }
    validCount++
    if (en.includes(' — ')) {
      issues.push(`FALLBACK ${template.id} | ${jp} | ${en}`)
    }
  }
}

console.log(`Valid sentences: ${validCount}`)
console.log(`Issues: ${issues.length}`)
for (const line of issues.sort()) console.log(line)
