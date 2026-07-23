import { sentencePatternCatalog } from '../src/data/sentencePatternCatalog'
import { getFuriganaRuns } from '../src/components/FuriganaText'
import { generateCategorySentence } from '../src/lib/categorySentenceEngine'

const KATAKANA_RE = /[\u30A1-\u30FA\u30FC]/
const PARTICLES = new Set(['は', 'へ', 'を', 'に', 'で', 'と', 'が', 'から', 'まで'])

const patterns = sentencePatternCatalog.filter(
  (pattern) => pattern.generatorReady && ['N5', 'N4', 'N3'].includes(pattern.jlpt),
)

let generated = 0
let katakanaCases = 0
let particleCases = 0
const violations: string[] = []

for (const pattern of patterns) {
  for (let seed = 1; seed <= 80; seed += 1) {
    const sentence = generateCategorySentence(seed, pattern.id, pattern.jlpt as 'N5' | 'N4' | 'N3')
    if (!sentence) continue

    generated += 1
    if (KATAKANA_RE.test(sentence.japanese)) katakanaCases += 1
    if (sentence.furigana.some((part) => PARTICLES.has(part.text))) particleCases += 1

    for (const part of sentence.furigana) {
      const rubyRuns = getFuriganaRuns(part.text, part.reading)
      if (rubyRuns.some((run) => run.reading && KATAKANA_RE.test(run.text))) {
        violations.push(`${pattern.id} seed ${seed}: katakana received ruby in ${sentence.japanese}`)
      }
      if (PARTICLES.has(part.text) && rubyRuns.some((run) => run.reading)) {
        violations.push(`${pattern.id} seed ${seed}: particle received ruby in ${sentence.japanese}`)
      }
    }
  }
}

console.log(`Generated ${generated} sentences across ${patterns.length} patterns.`)
console.log(`Checked ${katakanaCases} katakana cases and ${particleCases} particle cases.`)

if (violations.length) {
  console.error(`Found ${violations.length} ruby violation(s):`)
  console.error(violations.slice(0, 20).join('\n'))
  process.exitCode = 1
} else {
  console.log('No katakana or particle ruby violations found.')
}
