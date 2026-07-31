/**
 * Audits the dashboard's rotating hero sentences at scale.
 *
 * Rebuilds the exact stream the rotator shows (buildHeroSteps over many seeds),
 * then runs grammar/semantic checks over every frame and reports offenders
 * grouped by rule, with counts and examples.
 */
import { buildHeroSteps, clearHeroStepsCache } from '../src/lib/heroSequence'
import { getPosTemplate } from '../src/data/heroPosTemplates'
import { getHeroEnglish } from '../src/lib/heroSentenceGloss'
import type { JlptLevel } from '../src/lib/types'
import type { WrongPool } from '../src/lib/wrongPool'

interface Row {
  level: string
  templateId: number
  templateLabel: string
  jp: string
  en: string
}

const LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const SEEDS = Number(process.env.SEEDS ?? 60)

function collect(): Row[] {
  const rows: Row[] = []
  for (const level of LEVELS) {
    for (let seed = 0; seed < SEEDS; seed++) {
      clearHeroStepsCache()
      const steps = buildHeroSteps({} as WrongPool, {}, level, seed * 7919)
      for (const step of steps) {
        const frame = step.frame
        const jp = (frame.segments ?? []).map((s) => s.text).join('')
        if (!jp) continue
        rows.push({
          level,
          templateId: frame.templateId!,
          templateLabel: getPosTemplate(frame.templateId!).label,
          jp,
          en: getHeroEnglish(frame),
        })
      }
    }
  }
  return rows
}

// ---- Japanese surface analysis -------------------------------------------

const jpNegative = (jp: string) => /(ない|ません|なかった|ませんでした)$/.test(jp)
const jpPast = (jp: string) => /(った|いた|えた|した|んだ|ました|なかった|ませんでした|てしまった|ていた|かった)$/.test(jp)
const jpVolitional = (jp: string) => /(おう|こう|そう|とう|もう|ろう|よう)$/.test(jp) && !/(そうだ|ようだ)$/.test(jp)
const jpDesire = (jp: string) => /(たい|たがる)$/.test(jp)
const jpPotential = (jp: string) => /ことができる$/.test(jp)
const jpProhibition = (jp: string) => /てはいけない$/.test(jp)
const jpObligation = (jp: string) => /(なければならない|なくてはいけない)$/.test(jp)
const jpPermission = (jp: string) => /てもいい$/.test(jp)

// ---- English surface analysis --------------------------------------------

const enNegative = (en: string) => /\b(do not|does not|did not|not|never|must not|cannot|can not)\b/i.test(en)
const enPast = (en: string) =>
  /\b(was|were|did|had|ate|drank|read|made|bought|took|saw|watched|listened|studied|used|waited|started|learned|borrowed|sang|wrote|went|came|ended up)\b/i.test(en)

// Adverbs that must survive into the gloss, with the English they map to.
const ADVERB_GLOSS: [string, RegExp][] = [
  ['あまり', /not much|not very|much/i],
  ['ぜんぜん', /at all|not at all/i],
  ['よく', /often|well|frequently|a lot/i],
  ['ときどき', /sometimes|occasionally/i],
  ['時々', /sometimes|occasionally/i],
  ['たくさん', /a lot|many|lots|much/i],
  ['少し', /a little|a bit|slightly|some/i],
  ['もう', /already|any ?more|yet/i],
  ['まだ', /still|yet/i],
  ['すぐ', /right away|immediately|soon|at once/i],
  ['ゆっくり', /slowly|leisurely/i],
  ['はやく', /quickly|early|fast|soon/i],
  ['必ず', /always|certainly|definitely|without fail|be sure/i],
  ['毎日', /every ?day|daily/i],
  ['とても', /very|really|so/i],
]

interface Check {
  rule: string
  severity: 'broken' | 'awkward'
  note: string
  test: (r: Row) => boolean
}

const CHECKS: Check[] = [
  // ---- Japanese generation bugs ----
  {
    rule: 'JP: あまり + affirmative predicate',
    severity: 'broken',
    note: 'あまり is negative-polarity; it requires 〜ない. "あまり始める" is ungrammatical.',
    test: (r) => r.jp.includes('あまり') && !jpNegative(r.jp),
  },
  {
    rule: 'JP: ぜんぜん + affirmative predicate',
    severity: 'broken',
    note: 'ぜんぜん requires a negative predicate in standard usage.',
    test: (r) => r.jp.includes('ぜんぜん') && !jpNegative(r.jp),
  },
  {
    rule: 'JP: とても + verb (not adjective)',
    severity: 'broken',
    note: 'とても modifies adjectives, not plain action verbs. "とても見る" is ungrammatical.',
    test: (r) => r.jp.includes('とても') && !/(い|な)(です)?$/.test(r.jp) && !jpNegative(r.jp),
  },
  {
    rule: 'JP: たい + がる double-stacked',
    severity: 'broken',
    note: 'Malformed morphology: 〜たい and 〜たがる stacked, e.g. 勉強したいがる (should be 勉強したがる).',
    test: (r) => /たいがる/.test(r.jp),
  },
  {
    rule: 'JP: negative-polarity adverb + non-negative modal',
    severity: 'broken',
    note: 'あまり/ぜんぜん combined with potential/obligation without negation.',
    test: (r) => /(あまり|ぜんぜん)/.test(r.jp) && (jpPotential(r.jp) || jpObligation(r.jp)),
  },
  {
    rule: 'JP: もう + non-past affirmative',
    severity: 'awkward',
    note: 'もう ("already") wants past/perfective or negative; もう + non-past reads as "already does".',
    test: (r) => r.jp.includes('もう') && !jpNegative(r.jp) && !jpPast(r.jp) && !jpVolitional(r.jp),
  },
  {
    rule: 'JP: まだ + plain non-past affirmative',
    severity: 'awkward',
    note: 'まだ wants 〜ている ("still doing") or a negative ("not yet").',
    test: (r) => r.jp.includes('まだ') && !jpNegative(r.jp) && !/ている/.test(r.jp) && !jpPast(r.jp),
  },
  {
    rule: 'JP: frequency adverb + volitional',
    severity: 'awkward',
    note: 'Frequency adverb ("often", "sometimes") with volitional ("let\'s") is contradictory.',
    test: (r) => /(ときどき|時々|よく|毎日)/.test(r.jp) && jpVolitional(r.jp),
  },

  // ---- English gloss bugs ----
  {
    rule: 'EN: polarity inverted (JP negative, EN affirmative)',
    severity: 'broken',
    note: 'Japanese is negative but the English gloss is affirmative — the translation states the opposite.',
    test: (r) => jpNegative(r.jp) && !enNegative(r.en),
  },
  {
    rule: 'EN: polarity invented (JP affirmative, EN negative)',
    severity: 'broken',
    note: 'Japanese is affirmative but the gloss is negative.',
    test: (r) => !jpNegative(r.jp) && !/(あまり|ぜんぜん)/.test(r.jp) && enNegative(r.en),
  },
  {
    rule: 'EN: tense mismatch (JP non-past, EN past)',
    severity: 'broken',
    note: 'Gloss is past tense but the Japanese is not, e.g. 飲もう → "drank".',
    test: (r) => !jpPast(r.jp) && !jpDesire(r.jp) && enPast(r.en) && !/ended up/i.test(r.en),
  },
  {
    rule: 'EN: desire form glossed as past',
    severity: 'broken',
    note: '〜たい ("want to") rendered as a past-tense statement.',
    test: (r) => jpDesire(r.jp) && enPast(r.en) && !/want/i.test(r.en),
  },
  {
    rule: 'EN: subject-verb agreement',
    severity: 'broken',
    note: 'Agreement error such as "I wants", "I is", "He want", "Everyone are".',
    test: (r) => /\bI (wants|is|has|does not wants)\b/i.test(r.en)
      || /\b(He|She) (want|is not want)\b/i.test(r.en)
      || /\bEveryone are\b/i.test(r.en),
  },
  {
    rule: 'EN: double negative',
    severity: 'broken',
    note: 'Gloss stacks two negatives, e.g. "did not not much wait".',
    test: (r) => /\b(do|does|did) not not\b/i.test(r.en) || /not\b.*\bnot much\b/i.test(r.en),
  },
  {
    rule: 'EN: adverb dropped from gloss',
    severity: 'broken',
    note: 'An adverb present in the Japanese has no counterpart in the English.',
    test: (r) => ADVERB_GLOSS.some(([jp, re]) => r.jp.includes(jp) && !re.test(r.en)),
  },
  {
    rule: 'EN: adverb placed before verb (word salad)',
    severity: 'awkward',
    note: 'Adverb phrase dropped in front of the verb without reordering, e.g. "I a little drink tea".',
    test: (r) => /\b(a little|a lot|not much|not at all|very|often|already|still)\s+(drink|eat|read|buy|make|take|watch|use|wait|start|study|learn|borrow|sing|write)s?\b/i.test(r.en),
  },
  {
    rule: 'EN: modal lost (prohibition/obligation/permission)',
    severity: 'broken',
    note: 'てはいけない / なければならない / てもいい not rendered as must / must not / may.',
    test: (r) => (jpProhibition(r.jp) && !/must not|may not|cannot|should not/i.test(r.en))
      || (jpObligation(r.jp) && !/must|have to|need to/i.test(r.en))
      || (jpPermission(r.jp) && !/may|can|allowed|it is ok/i.test(r.en)),
  },
  {
    rule: 'EN: redundant noun ("photos of pictures")',
    severity: 'awkward',
    note: 'Noun and verb glosses duplicate the same concept.',
    test: (r) => /photos of pictures|pictures of photos|study studies|cook cooking/i.test(r.en),
  },
  {
    rule: 'EN: unexpected possessive on 先生/友達',
    severity: 'awkward',
    note: '先生 / 友達 glossed as "my teacher" / "my friend" even with a third-person subject.',
    test: (r) => /\b(He|She|Everyone)\b/.test(r.en) && /\bmy (teacher|friend)\b/i.test(r.en),
  },
  {
    rule: 'EN: gloss missing',
    severity: 'broken',
    note: 'No English translation produced for the frame.',
    test: (r) => !r.en || !r.en.trim(),
  },
]

function main() {
  const rows = collect()
  const unique = new Map<string, Row>()
  for (const r of rows) unique.set(`${r.jp}|${r.en}`, r)
  const uniqueRows = [...unique.values()]

  console.log(`Collected ${rows.length} frames (${uniqueRows.length} unique JP+EN pairs) across ${LEVELS.length} levels x ${SEEDS} seeds.\n`)

  const findings = CHECKS
    .map((c) => ({ ...c, rows: uniqueRows.filter(c.test) }))
    .filter((f) => f.rows.length > 0)
    .sort((a, b) => (a.severity === b.severity ? b.rows.length - a.rows.length : a.severity === 'broken' ? -1 : 1))

  const flaggedKeys = new Set(findings.flatMap((f) => f.rows.map((r) => `${r.jp}|${r.en}`)))
  const brokenKeys = new Set(
    findings.filter((f) => f.severity === 'broken').flatMap((f) => f.rows.map((r) => `${r.jp}|${r.en}`)),
  )

  const pct = (n: number) => ((n / uniqueRows.length) * 100).toFixed(1)
  console.log(`BROKEN:  ${brokenKeys.size} / ${uniqueRows.length} unique (${pct(brokenKeys.size)}%)`)
  console.log(`FLAGGED: ${flaggedKeys.size} / ${uniqueRows.length} unique (${pct(flaggedKeys.size)}%)`)
  console.log('='.repeat(78))

  for (const f of findings) {
    const byTemplate = new Map<number, number>()
    for (const r of f.rows) byTemplate.set(r.templateId, (byTemplate.get(r.templateId) ?? 0) + 1)
    const tmpl = [...byTemplate.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    console.log(`\n[${f.severity.toUpperCase()}] ${f.rule} — ${f.rows.length} unique (${pct(f.rows.length)}%)`)
    console.log(`  ${f.note}`)
    console.log(`  top templates: ${tmpl.map(([id, n]) => `#${id}(${n})`).join(' ')}`)
    for (const r of f.rows.slice(0, 4)) {
      console.log(`   • ${r.jp}`)
      console.log(`     "${r.en}"   [t#${r.templateId}]`)
    }
    if (f.rows.length > 4) console.log(`   … and ${f.rows.length - 4} more`)
  }

  console.log('\n' + '='.repeat(78))
  console.log('\nSample that passed every check (manual review):\n')
  const clean = uniqueRows.filter((r) => !flaggedKeys.has(`${r.jp}|${r.en}`))
  console.log(`  (${clean.length} clean, ${pct(clean.length)}%)\n`)
  for (let i = 0; i < Math.min(30, clean.length); i++) {
    const r = clean[Math.floor((i * 7919) % clean.length)]!
    console.log(`  ${r.jp}\n     "${r.en}"  [t#${r.templateId}]`)
  }
}

main()
