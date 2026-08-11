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
 * `--pools` inverts the report: how many eligible words each slot has. A slot
 * with a handful of candidates is what makes the stream feel repetitive, and
 * distinguishes "we need more words" from "we need more sentence patterns".
 *
 * Usage:  npx tsx scripts/audit-word-reachability.ts [--all] [--category=Food] [--pools]
 */
import { auditWordReachability, getVerbUsageRecords, SENTENCE_CATEGORIES, type SentenceCategory } from '../src/lib/categorySentenceEngine'

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

if (process.argv.includes('--pools')) {
  // Eligible words per slot, and the resulting sentence space per verb. The
  // per-verb figure multiplies its slots together, so one starved slot caps
  // the whole verb no matter how rich the others are — which is exactly the
  // difference between needing more vocabulary and needing more patterns.
  const perSlot = new Map<string, number>()
  for (const row of rows) for (const slot of row.slots) perSlot.set(slot, (perSlot.get(slot) ?? 0) + 1)

  // Enumerated from the verb records, not from perSlot: a slot with zero
  // candidates never appears in perSlot at all, and those are the ones that
  // matter most — a single empty slot makes the whole verb ungeneratable, the
  // way an empty Money category silently killed 払う.
  const verbSpace = getVerbUsageRecords().map(verb => {
    const slots = Object.keys(verb.slots).map(name => ({ name, count: perSlot.get(`${verb.id}.${name}`) ?? 0 }))
    const counts = slots.map(slot => slot.count)
    return {
      verb: verb.id,
      japanese: verb.japanese,
      slots: slots.map(slot => `${slot.name}:${slot.count}`).join(' '),
      narrowest: counts.length ? Math.min(...counts) : 0,
      space: counts.reduce((a, b) => a * b, 1),
    }
  }).sort((a, b) => a.space - b.space)

  const dead = verbSpace.filter(v => v.space === 0)
  const starved = verbSpace.filter(v => v.space > 0 && v.narrowest <= 5)
  const median = verbSpace.filter(v => v.space > 0)[Math.floor(verbSpace.filter(v => v.space > 0).length / 2)]

  console.log(`\n${'='.repeat(78)}\nSLOT POOL DEPTH — ${verbSpace.length} verbs\n`)
  console.log(`DEAD (a slot has 0 candidates, so the verb can never generate): ${dead.length}`)
  for (const v of dead) console.log(`  ${v.japanese} ${v.verb.padEnd(24)} ${v.slots}`)
  console.log(`\nStarved (narrowest slot <= 5 candidates): ${starved.length}`)
  for (const v of starved.slice(0, 12)) console.log(`  ${v.japanese} ${v.verb.padEnd(24)} space=${String(v.space).padStart(7)}  ${v.slots}`)
  console.log(`\nMedian distinct-sentence space among live verbs: ${median?.space.toLocaleString() ?? 0}`)
}

// Only the invariant fails the run; unreachability is reported, not enforced.
process.exitCode = violations.length > 0 ? 1 : 0
