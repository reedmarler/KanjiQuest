/**
 * Audits the Sentence Testing generator (categorySentenceEngine /
 * sentenceGeneratorPreview) at scale, using the same style of checks as
 * scripts/audit-hero-stream.ts, so the two pipelines' defect rates are
 * directly comparable.
 */
import { generatePreviewSentence } from '../src/lib/sentenceGeneratorPreview'
import { GENERATION_COMPLEXITIES, patternsForComplexity, type GenerationComplexity } from '../src/lib/generationComplexity'

interface Row {
  complexity: GenerationComplexity
  frameId: string
  jp: string
  en: string
}

const SEEDS_PER_PATTERN = Number(process.env.SEEDS ?? 40)

function collect(): Row[] {
  const rows: Row[] = []
  for (const complexity of GENERATION_COMPLEXITIES) {
    const patterns = patternsForComplexity(complexity)
    for (const pattern of patterns) {
      for (let i = 0; i < SEEDS_PER_PATTERN; i++) {
        try {
          const s = generatePreviewSentence(pattern.jlpt, i * 9973 + 1, undefined, pattern.id, true)
          if (!s.japanese) continue
          rows.push({ complexity, frameId: pattern.id, jp: s.japanese, en: s.english })
        } catch {
          // Pattern not generator-executable for this seed; skip.
        }
      }
    }
  }
  return rows
}

const jpNegative = (jp: string) => /(ない|ません|なかった|ませんでした)$/.test(jp)
const jpPast = (jp: string) => /(った|いた|えた|した|んだ|ました|なかった|ませんでした|てしまった|ていた|かった)\.?$/.test(jp)

const enNegative = (en: string) => /\b(do not|does not|did not|not|never|must not|cannot|can not|n't)\b/i.test(en)
const enPast = (en: string) =>
  /\b(was|were|did|had|ate|drank|read|made|bought|took|saw|watched|listened|studied|used|waited|started|learned|borrowed|sang|wrote|went|came|ended up)\b/i.test(en)

interface Check {
  rule: string
  severity: 'broken' | 'awkward'
  note: string
  test: (r: Row) => boolean
}

const CHECKS: Check[] = [
  {
    rule: 'EN: polarity inverted (JP negative, EN affirmative)',
    severity: 'broken',
    note: 'Japanese is negative but the English gloss reads affirmative.',
    test: (r) => jpNegative(r.jp) && !enNegative(r.en),
  },
  {
    rule: 'EN: polarity invented (JP affirmative, EN negative)',
    severity: 'broken',
    note: 'Japanese is affirmative but the gloss reads negative.',
    test: (r) => !jpNegative(r.jp) && enNegative(r.en),
  },
  {
    rule: 'EN: tense mismatch (JP non-past, EN past)',
    severity: 'broken',
    note: 'Gloss is past tense but the Japanese predicate is not.',
    test: (r) => !jpPast(r.jp) && enPast(r.en) && !/ended up/i.test(r.en),
  },
  {
    rule: 'EN: subject-verb agreement',
    severity: 'broken',
    note: 'Agreement error such as "I wants", "I is", "He want", "Everyone are".',
    test: (r) => /\bI (wants|is|has)\b/i.test(r.en) || /\b(He|She) (want|is not want)\b/i.test(r.en) || /\bEveryone are\b/i.test(r.en),
  },
  {
    rule: 'EN: double negative',
    severity: 'broken',
    note: 'Gloss stacks two negatives.',
    test: (r) => /\b(do|does|did) not not\b/i.test(r.en),
  },
  {
    rule: 'EN: empty or malformed gloss',
    severity: 'broken',
    note: 'No English text, or leftover template braces/placeholders.',
    test: (r) => !r.en?.trim() || /\{[a-zA-Z]+\}/.test(r.en),
  },
  {
    rule: 'EN: double space / stray punctuation',
    severity: 'awkward',
    note: 'Gloss has doubled spaces or a stray period/comma run.',
    test: (r) => /\s{2,}/.test(r.en) || /\.\./.test(r.en) || /\s\./.test(r.en),
  },
  {
    rule: 'JP: doubled particle or literal',
    severity: 'awkward',
    note: 'Same particle appears twice in a row, suggesting a missing slot fill.',
    test: (r) => /(は|が|を|に|で|と){2,}/.test(r.jp),
  },
]

function main() {
  const rows = collect()
  const unique = [...new Map(rows.map((r) => [`${r.jp}|${r.en}`, r])).values()]
  console.log(`Collected ${rows.length} frames (${unique.length} unique JP+EN pairs) across ${GENERATION_COMPLEXITIES.length} complexity levels x ${SEEDS_PER_PATTERN} seeds/pattern.\n`)

  const findings = CHECKS
    .map((c) => ({ ...c, rows: unique.filter(c.test) }))
    .filter((f) => f.rows.length > 0)
    .sort((a, b) => (a.severity === b.severity ? b.rows.length - a.rows.length : a.severity === 'broken' ? -1 : 1))

  const brokenKeys = new Set(findings.filter((f) => f.severity === 'broken').flatMap((f) => f.rows.map((r) => `${r.jp}|${r.en}`)))
  const flaggedKeys = new Set(findings.flatMap((f) => f.rows.map((r) => `${r.jp}|${r.en}`)))
  const pct = (n: number) => ((n / unique.length) * 100).toFixed(1)

  console.log(`BROKEN:  ${brokenKeys.size} / ${unique.length} unique (${pct(brokenKeys.size)}%)`)
  console.log(`FLAGGED: ${flaggedKeys.size} / ${unique.length} unique (${pct(flaggedKeys.size)}%)`)
  console.log('='.repeat(78))

  for (const f of findings) {
    const byComplexity = new Map<number, number>()
    for (const r of f.rows) byComplexity.set(r.complexity, (byComplexity.get(r.complexity) ?? 0) + 1)
    console.log(`\n[${f.severity.toUpperCase()}] ${f.rule} — ${f.rows.length} unique (${pct(f.rows.length)}%)`)
    console.log(`  ${f.note}`)
    console.log(`  by level: ${[...byComplexity.entries()].sort((a, b) => a[0] - b[0]).map(([l, n]) => `L${l}(${n})`).join(' ')}`)
    for (const r of f.rows.slice(0, 5)) {
      console.log(`   • ${r.jp}`)
      console.log(`     "${r.en}"   [${r.frameId}]`)
    }
    if (f.rows.length > 5) console.log(`   … and ${f.rows.length - 5} more`)
  }

  console.log('\n' + '='.repeat(78))
  const clean = unique.filter((r) => !flaggedKeys.has(`${r.jp}|${r.en}`))
  console.log(`\nClean sample (${clean.length} / ${unique.length}, ${pct(clean.length)}%):\n`)
  for (let i = 0; i < Math.min(25, clean.length); i++) {
    const r = clean[Math.floor((i * 7919) % clean.length)]!
    console.log(`  ${r.jp}\n     "${r.en}"  [${r.frameId} L${r.complexity}]`)
  }
}

main()
