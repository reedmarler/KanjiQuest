/**
 * Offline helper: report which vocab words lack hero collocations and suggest roles.
 * Run: npx tsx scripts/generate-hero-collocations.ts [N2|N3|N5]
 *
 * Human or LLM review should fill src/lib/heroCollocations.ts MANUAL_COLLOCATIONS
 * and src/lib/heroVocabPhrases.ts HERO_OBJECT_PHRASES before words enter sentences.
 */
import { allCards } from '../src/data/index.ts'
import { getHeroCollocations, hasAnyHeroCollocation } from '../src/lib/heroCollocations.ts'
import { HERO_OBJECT_PHRASES } from '../src/lib/heroVocabPhrases.ts'
import type { JlptLevel } from '../src/lib/types.ts'

const level = (process.argv[2] as JlptLevel) ?? 'N2'

const words = new Map<string, string>()
for (const card of allCards) {
  if (card.jlpt !== level || (card.type !== 'vocab' && card.type !== 'kanji')) continue
  if (!words.has(card.front)) words.set(card.front, card.back.split('/')[0].trim())
}

let ready = 0
const missing: string[] = []

for (const [word, back] of words) {
  if (hasAnyHeroCollocation(word)) {
    ready++
    continue
  }
  missing.push(`${word} (${back})`)
}

console.log(`Level ${level}: ${ready}/${words.size} words have hero collocations`)
console.log(`Missing ${missing.length}:`)
for (const line of missing) console.log(`  - ${line}`)

console.log('\nCurated gloss count:', Object.keys(HERO_OBJECT_PHRASES).length)
console.log('Tip: add to HERO_OBJECT_PHRASES + MANUAL_COLLOCATIONS in heroCollocations.ts')
