/**
 * Reports words the generator can see but no slot can ever pick.
 *
 * Slot rules gate on tags, not categories alone, so a word whose tags miss the
 * allowlist a slot checks is silently unreachable — in the pool, accepted by
 * nothing, indistinguishable from a word that is merely rare. Sampling
 * generated sentences cannot tell those apart (an unreachable word just never
 * shows up, which looks like bad luck). This checks the gates directly.
 *
 * Two very different things are reported:
 *
 *   CANONICAL TAG VIOLATIONS — a word missing its own category's guaranteed
 *   tag. `withCanonicalCategoryTags` makes this impossible at construction, so
 *   a violation means some record bypassed it. Never legitimate; fails the run.
 *
 *   UNREACHABLE — no slot or pool accepts the word. Often legitimate: no
 *   pattern takes that category yet, or every slot that does filters it out on
 *   purpose (an い-adjective is rightly refused by a manner-adverb slot). Use
 *   it to find coverage gaps, not as a defect list.
 *
 * Usage:  npx tsx scripts/audit-word-reachability.ts [--all] [--category=Food]
 */
import { auditWordReachability, SENTENCE_CATEGORIES, type SentenceCategory } from '../src/lib/categorySentenceEngine'

const showAll = process.argv.includes('--all')
const categoryArg = process.argv.find(arg => arg.startsWith('--category='))?.split('=')[1] as SentenceCategory | undefined

const rows = auditWordReachability()
const violations = rows.filter(row => row.missingCanonicalTags.length > 0)
const reachable = rows.filter(row => row.reachable)
const orphans = rows.filter(row => !row.reachable)
const blockedOnly = orphans.filter(row => row.tagBlockedBy.length > 0)
const noSlot = orphans.filter(row => row.tagBlockedBy.length === 0)
const pct = (n: number) => ((n / rows.length) * 100).toFixed(1)

console.log(`Words visible to the generator: ${rows.length}`)
console.log(`  reachable:   ${reachable.length} (${pct(reachable.length)}%)`)
console.log(`  unreachable: ${orphans.length} (${pct(orphans.length)}%)`)
console.log(`    every accepting slot filters them out: ${blockedOnly.length}`)
console.log(`    no slot takes the category at all:     ${noSlot.length}`)

console.log(`\nCanonical tag violations: ${violations.length}`)
if (violations.length) {
  for (const row of violations.slice(0, 30)) {
    console.log(`  ${row.japanese} [${row.categories.join('/')}] missing ${row.missingCanonicalTags.join(', ')} — has: ${row.tags.join(', ') || '(none)'}`)
  }
  if (violations.length > 30) console.log(`  … and ${violations.length - 30} more`)
} else {
  console.log('  none — every word carries its category tag, so category membership')
  console.log('  alone is enough for the broad category-shaped allowlists.')
}

console.log(`\nUnreachable by category:`)
const byCategory = new Map<SentenceCategory, { total: number; orphan: number }>()
for (const category of SENTENCE_CATEGORIES) byCategory.set(category, { total: 0, orphan: 0 })
for (const row of rows) {
  for (const category of row.categories) {
    const entry = byCategory.get(category)
    if (!entry) continue
    entry.total++
    if (!row.reachable) entry.orphan++
  }
}
for (const [category, { total, orphan }] of [...byCategory.entries()].sort((a, b) => b[1].orphan - a[1].orphan)) {
  if (!total) continue
  console.log(`  ${category.padEnd(12)} ${String(orphan).padStart(4)} / ${String(total).padEnd(5)} unreachable`)
}

if (orphans.length) {
  console.log(`\n${'='.repeat(78)}\nUNREACHABLE SAMPLE:\n`)
  const shown = categoryArg ? orphans.filter(row => row.categories.includes(categoryArg)) : orphans
  for (const row of showAll ? shown : shown.slice(0, 30)) {
    console.log(`  ${row.japanese} (${row.reading}) — ${row.english}  [${row.categories.join('/')}]`)
    console.log(`     has: ${row.tags.join(', ') || '(none)'}`)
    console.log(`     ${row.tagBlockedBy[0] ?? 'no slot accepts this category'}`)
  }
  if (!showAll && shown.length > 30) console.log(`  … and ${shown.length - 30} more (pass --all)`)
}

// Only the invariant fails the run; unreachability is reported, not enforced.
process.exitCode = violations.length > 0 ? 1 : 0
