/**
 * How deep is each Grammar-mode focus?
 *
 * The dashboard's grammar drill holds a sentence still and rotates one part of
 * speech. Whether a focus is worth offering comes down to two numbers: how
 * many of the level's patterns can serve it at all, and how many genuinely
 * different words or forms that slot can reach once it is serving. A focus
 * that only two patterns support, or one whose slot has three fillers, is a
 * loop the learner notices within a minute.
 *
 * This measures both against the generator the drill actually calls, through
 * the same filters — natural-sentence and single-slot-neighbour — that the
 * hero applies before it will show a rotation.
 *
 *   npm run audit:hero-focus
 */
import { patternsForLevel } from '../src/lib/generationComplexity'
import { generatePreviewSentence, type GeneratedPreviewSentence } from '../src/lib/sentenceGeneratorPreview'
import { generateCategorySentence } from '../src/lib/categorySentenceEngine'
import { isDashboardSentenceNatural } from '../src/lib/dashboardSentenceQuality'
import { HERO_FOCUS_LEVELS, HERO_FOCUS_SLOTS, buildHeroSteps, focusSlotsFor, focusServes, particlesIn, type HeroSwapFocus } from '../src/lib/heroSequence'
import type { WrongPool } from '../src/lib/wrongPool'
import type { JlptLevel } from '../src/lib/types'

const LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const BASE_ATTEMPTS = 10
const ROTATION_ATTEMPTS = 40

const FOCUSES: HeroSwapFocus[] = ['noun', 'verb', 'adjective', 'adverb', 'auxiliary', 'particle']

interface SlotReading {
  /** Distinct surfaces this slot reached, base form included. */
  forms: Set<string>
  /** Of those, the ones the hero would actually show. */
  usable: Set<string>
}

function baseSentence(patternId: string, level: JlptLevel, jlpt: JlptLevel, focus?: HeroSwapFocus) {
  for (let attempt = 0; attempt < BASE_ATTEMPTS; attempt += 1) {
    const seed = 4001 + attempt * 733
    try {
      const sentence = generatePreviewSentence(jlpt, seed, undefined, patternId, true)
      if (sentence.japanese && isDashboardSentenceNatural(sentence) && (!focus || focusServes(sentence, focus))) return { sentence, seed }
    } catch { /* this seed's tag rules ruled every combination out */ }
  }
  return null
}

/** The text a slot is showing, by the same rule the rotation diff uses. */
function surfaceOf(sentence: GeneratedPreviewSentence, slot: string): string | undefined {
  return sentence.furigana.find((part) => part.slot === slot)?.text
}

function readSlot(patternId: string, level: JlptLevel, baseSeed: number, base: GeneratedPreviewSentence, slot: string): SlotReading {
  const anchor = slot === 'ending'
    ? (base.furigana.some((part) => part.slot === 'adjective')
      ? 'adjective'
      : base.furigana.some((part) => part.slot === 'verb') ? 'verb' : 'ending')
    : slot
  const forms = new Set<string>()
  const usable = new Set<string>()
  const start = surfaceOf(base, anchor)
  if (start) { forms.add(start); usable.add(start) }

  for (let attempt = 1; attempt <= ROTATION_ATTEMPTS; attempt += 1) {
    let candidate: GeneratedPreviewSentence | null = null
    try {
      candidate = generateCategorySentence(baseSeed, patternId, level, { slotSeeds: { [slot]: baseSeed + 17 + attempt * 11 } })
    } catch { continue }
    if (!candidate?.japanese) continue
    const text = surfaceOf(candidate, anchor)
    if (!text) continue
    forms.add(text)
    // The hero drops a rotation that reads badly, and one that moved more than
    // the slot it asked for — so neither counts toward what a learner sees.
    if (!isDashboardSentenceNatural(candidate)) continue
    const moved = candidate.furigana.filter((part, index) => part.text !== base.furigana[index]?.text).length
    if (candidate.furigana.length !== base.furigana.length || moved > 1) continue
    usable.add(text)
  }
  return { forms, usable }
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

console.log('Grammar-mode focus depth\n')
console.log('patterns = how many of the level\'s patterns the focus can run on at all')
console.log('reach    = distinct forms the slot produced, per serving pattern (median / best)')
console.log('shown    = of those, the ones that survive the hero\'s own filters\n')

const particleTally = new Set<string>()
/** Where each focus actually found something, for the table check at the end. */
const servingLevels = new Map<HeroSwapFocus, JlptLevel[]>()
const totals = new Map<HeroSwapFocus, { patterns: number; reach: number[]; shown: number[] }>()
for (const focus of FOCUSES) totals.set(focus, { patterns: 0, reach: [], shown: [] })

for (const level of LEVELS) {
  const patterns = patternsForLevel(level)
  const rows = new Map<HeroSwapFocus, { patterns: number; reach: number[]; shown: number[] }>()
  for (const focus of FOCUSES) rows.set(focus, { patterns: 0, reach: [], shown: [] })
  let generated = 0

  for (const pattern of patterns) {
    const found = baseSentence(pattern.id, level, pattern.jlpt)
    if (!found) continue
    generated += 1
    const { sentence } = found
    const present = new Set(sentence.furigana.map((part) => part.slot).filter(Boolean) as string[])

    for (const focus of FOCUSES) {
      const focusedFound = focusServes(sentence, focus) ? found : baseSentence(pattern.id, level, pattern.jlpt, focus)
      if (!focusedFound) continue
      const { sentence: focusedSentence, seed: focusedSeed } = focusedFound
      const row = rows.get(focus)!
      if (focus === 'particle') {
        // Particles are contrasted between sentences, so a pattern's depth is
        // how many distinct case markers it puts on screen.
        const shown = new Set(particlesIn(focusedSentence))
        shown.forEach((particle) => particleTally.add(particle))
        row.patterns += 1
        row.reach.push(shown.size)
        row.shown.push(shown.size)
        continue
      }
      const slots = focusSlotsFor(focusedSentence, focus)
      const readings = [...new Set(slots)].map((slot) => readSlot(pattern.id, level, focusedSeed, focusedSentence, slot))
      const reach = readings.reduce((sum, reading) => sum + reading.forms.size, 0)
      const shown = readings.reduce((sum, reading) => sum + reading.usable.size, 0)
      // A slot with one reachable form is not a rotation; it is a still frame.
      if (shown <= 1) continue
      row.patterns += 1
      row.reach.push(reach)
      row.shown.push(shown)
    }
    void present
  }

  console.log(`===== ${level} — ${generated} of ${patterns.length} patterns generate`)
  for (const focus of FOCUSES) {
    const row = rows.get(focus)!
    if (row.patterns > 0) servingLevels.set(focus, [...(servingLevels.get(focus) ?? []), level])
    const total = totals.get(focus)!
    total.patterns += row.patterns
    total.reach.push(...row.reach)
    total.shown.push(...row.shown)
    const share = generated ? Math.round((row.patterns / generated) * 100) : 0
    console.log(
      `  ${focus.padEnd(10)} patterns ${String(row.patterns).padStart(3)}/${String(generated).padEnd(3)} (${String(share).padStart(3)}%)` +
      `   reach ${String(median(row.reach)).padStart(4)} / ${String(Math.max(0, ...row.reach)).padStart(3)}` +
      `   shown ${String(median(row.shown)).padStart(4)} / ${String(Math.max(0, ...row.shown)).padStart(3)}`,
    )
  }
}

console.log('\n===== all levels')
for (const focus of FOCUSES) {
  const total = totals.get(focus)!
  console.log(
    `  ${focus.padEnd(10)} serving patterns ${String(total.patterns).padStart(3)}` +
    `   reach ${String(median(total.reach)).padStart(4)} / ${String(Math.max(0, ...total.reach)).padStart(3)}` +
    `   shown ${String(median(total.shown)).padStart(4)} / ${String(Math.max(0, ...total.shown)).padStart(3)}`,
  )
}
console.log('\nparticles contrasted:', [...particleTally].join(' '))
console.log('\nwhat each focus rotates:')
for (const [focus, what] of Object.entries(HERO_FOCUS_SLOTS)) console.log(`  ${focus.padEnd(10)} ${what}`)

/*
 * The dashboard closes a focus off at levels where it has no pattern to run
 * on, because an empty stream is a blank hero. That table is a claim about the
 * generator, so it is checked here against what this run actually found.
 */
console.log('\nlevels the dashboard offers each focus at:')
let drifted = false
for (const focus of FOCUSES) {
  const measured = servingLevels.get(focus) ?? []
  const declared = [...HERO_FOCUS_LEVELS[focus]]
  const same = measured.length === declared.length && measured.every((level) => declared.includes(level))
  if (!same) drifted = true
  console.log(`  ${focus.padEnd(10)} declared [${declared.join(' ')}]${same ? '' : `   MEASURED [${measured.join(' ')}]`}`)
}
if (drifted) {
  console.error('\nHERO_FOCUS_LEVELS no longer matches the generator. Update it in src/lib/heroSequence.ts.')
  process.exit(1)
}
console.log('\nThe offered levels match what the generator can serve.')

/*
 * And the offer has to hold on every seed. The hero builds two steps before it
 * paints and fills the rest after, so a focus that comes back empty at two
 * steps is a blank hero however well it does at twenty — which is what the
 * one-pattern adverb drill did until the pattern walk was given more laps.
 */
let empty = 0
const unexpectedChanges: string[] = []
const allowedChangedKeys: Partial<Record<HeroSwapFocus, ReadonlySet<string>>> = {
  verb: new Set(['verb', 'ending']),
  // The description sits in a differently named slot per frame — see
  // isAdjectivalSlot in heroSequence.
  adjective: new Set(['adjective', 'ending', 'predicate', 'reason']),
  adverb: new Set(['adverb', 'sequence']),
  auxiliary: new Set(['verb', 'ending']),
}
for (const focus of FOCUSES) {
  for (const level of HERO_FOCUS_LEVELS[focus]) {
    for (let seed = 0; seed < 6; seed += 1) {
      const steps = buildHeroSteps({} as WrongPool, {}, level, seed, 2, focus)
      if (steps.length === 0) {
        console.error(`  ${focus} at ${level} builds nothing on seed ${seed}`)
        empty += 1
      }
      const allowed = allowedChangedKeys[focus]
      if (allowed) {
        const unexpected = steps.flatMap((step) => step.changed).filter((key) => !allowed.has(key))
        if (unexpected.length) unexpectedChanges.push(`${focus} at ${level} seed ${seed}: ${unexpected.join(', ')}`)
      }
    }
  }
}
if (empty) {
  console.error(`\n${empty} offered focus/level/seed combinations build an empty stream, which paints a blank hero.`)
  process.exit(1)
}
if (unexpectedChanges.length) {
  console.error('\nA focused stream changed slots outside its stated drill:')
  unexpectedChanges.forEach((message) => console.error(`  ${message}`))
  process.exit(1)
}
console.log('Every offered focus builds a first stream on every seed tried.')
