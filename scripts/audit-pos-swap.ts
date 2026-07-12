/**
 * Audit POS-based sentence swapping for the hero rotator.
 * Run: npx tsx scripts/audit-pos-swap.ts
 */
import { swapJapaneseSentence } from '../src/lib/japanesePos'
import { HERO_POS_VOCABULARY, HERO_WORD_POS_INDEX } from '../src/data/heroPosVocabulary'
import { buildHeroSteps } from '../src/lib/heroSequence'
import { frameToJapanese } from '../src/lib/heroSentenceNatural'
import { getHeroWordPos } from '../src/lib/heroPosSwap'

// Example from spec
const example = swapJapaneseSentence(
  '私はリンゴを食べる',
  HERO_POS_VOCABULARY,
  { wordPosIndex: HERO_WORD_POS_INDEX },
  { seed: 42 },
)
console.log('Example swap:')
console.log('  in:', '私はリンゴを食べる')
console.log('  out:', example.sentence)
console.log('  replacements:', example.replacements.map((r) => `${r.from}→${r.to} (${r.pos})`).join(', '))

// Hero cycle POS sanity
let posMismatches = 0
const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, 'N2')

for (let i = 1; i < steps.length; i++) {
  const prev = steps[i - 1].frame
  const next = steps[i].frame
  const changed = steps[i].changed.filter((s) => prev[s] !== next[s])

  for (const slot of changed) {
    if (slot !== 'word' && slot !== 'subject' && slot !== 'modifier') continue
    const before = prev[slot]
    const after = next[slot]
    if (!before || !after || before === after) continue

    const beforePos = getHeroWordPos(before)
    const afterPos = getHeroWordPos(after)
    if (beforePos && afterPos && beforePos !== afterPos) {
      posMismatches++
      if (posMismatches <= 5) {
        console.log(`POS mismatch #${i} [${slot}]: ${before}(${beforePos}) → ${after}(${afterPos})`)
        console.log(`  jp: ${frameToJapanese(next)}`)
      }
    }
  }
}

console.log('\nHero cycle POS mismatches:', posMismatches)
console.log(posMismatches === 0 ? 'PASS' : 'WARN — some slots lack POS tags')
