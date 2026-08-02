import { writeFileSync } from 'node:fs'
import { getPendingReviewWords } from '../src/lib/categorySentenceEngine'
import { TAG_GROUPS, UNIVERSAL_TAGS } from '../src/data/tagTaxonomy'

const words = getPendingReviewWords()

console.log(`WORDS NEEDING REVIEW: ${words.length}\n`)
console.log('TAGS AVAILABLE:')
let total = 0
for (const group of TAG_GROUPS) {
  console.log(`  ${group.name.padEnd(26)} ${group.tags.length}`)
  total += group.tags.length
}
console.log(`  ${'Universal (any word)'.padEnd(26)} ${UNIVERSAL_TAGS.length}`)
console.log(`  ${'—'.repeat(26)} ---`)
console.log(`  ${'TOTAL'.padEnd(26)} ${total + UNIVERSAL_TAGS.length}\n`)

const byGroup = new Map<string, typeof words>()
for (const word of words) {
  const key = word.categories[0] ?? 'Unknown'
  byGroup.set(key, [...(byGroup.get(key) ?? []), word])
}
console.log('REVIEW POOL BY CLASSIFIER GUESS (guess is unverified — that is what you are checking):')
for (const [category, list] of [...byGroup.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${category.padEnd(14)} ${list.length}`)
}

const lines = words.map((word) => `${word.japanese} | ${word.categories[0] ?? ''} | ${word.tags.join(', ')}   # ${word.english}`)
writeFileSync('review-pool.txt', `# Words the sentence generator will not use until reviewed.
# Format: word | category | tags        (# ... is a comment and is ignored)
# The category and tags below are the classifier's UNVERIFIED guess — correct them.
# Paste finished lines into Content Studio -> Category Editor -> "Paste many words at once".

${lines.join('\n')}
`)
console.log(`\nwrote review-pool.txt (${lines.length} lines, paste-ready)`)
