/**
 * Checks the world map's derived state, and whether the content can feed it.
 *
 * The map replaces stored quest-step booleans with a reading of the scheduler,
 * so two things have to hold before a single node is drawn. The rules have to
 * behave — a waypoint with an unlearned thread is not cleared, a lapsed one
 * goes thin, a sealed region stays shut — and the decks have to be able to
 * supply thread-sets in the first place. Neither is visible from the UI, and
 * both are cheap to check here.
 *
 * Two sections, and only one of them can fail the run:
 *
 *   INVARIANTS — the rules in src/lib/mapState.ts. A failure is a defect.
 *
 *   CONTENT — what the existing focus sets can actually supply as threads.
 *   Reported, never enforced: a topic with no kanji cards behind its characters
 *   is a gap to fill, not a broken build.
 *
 * Usage:  npx tsx scripts/audit-map-state.ts [--content]
 */
import {
  chunkThreads,
  deriveMapState,
  threadState,
  CLEAR_THRESHOLD,
  type Region,
  type Waypoint,
} from '../src/lib/mapState'
import type { CardProgress } from '../src/lib/types'
import { vocabFocusSets } from '../src/data/vocabFocusSets'
import { kanjiFocusSets } from '../src/data/kanjiFocusSets'
import { kanjiCards } from '../src/data/kanji'
import { QUESTS } from '../src/data/questCampaign'

const MS_PER_DAY = 86_400_000
const NOW = Date.UTC(2026, 7, 23)

let failures = 0

function check(label: string, passed: boolean, detail = ''): void {
  if (passed) {
    console.log(`  ok    ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function eq<T>(label: string, actual: T, expected: T): void {
  check(label, Object.is(actual, expected), `expected ${String(expected)}, got ${String(actual)}`)
}

/** A card the player has met, `interval` days out, next due in `dueIn` days. */
function card(id: string, interval: number, dueIn = 1): CardProgress {
  return {
    id,
    easeFactor: 2.5,
    interval,
    repetitions: interval > 0 ? 2 : 0,
    nextReview: NOW + dueIn * MS_PER_DAY,
    lastReviewed: NOW - MS_PER_DAY,
    correct: 1,
    incorrect: 0,
  }
}

function threads(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`)
}

function waypoint(id: string, regionId: string, ids: readonly string[], kind: 'stop' | 'shrine' = 'stop'): Waypoint {
  return { id, regionId, kind, threads: ids }
}

const REGIONS: Region[] = [
  { id: 'tsuzuri', title: 'Tsuzuri Village' },
  { id: 'market', title: 'The Market Road' },
]

const byId = <T extends { id: string }>(items: readonly T[], id: string) => items.find((item) => item.id === id)!

console.log(`INVARIANTS\n`)

/* ---------------------------------------------------------------------- */
/* thread states                                                           */
/* ---------------------------------------------------------------------- */

console.log('thread states')
eq('no record is unwritten', threadState(undefined), 'unwritten')
eq('never reviewed is unwritten', threadState({ ...card('x', 9), lastReviewed: 0 }), 'unwritten')
eq('failed card (interval 0) is faint, not unwritten', threadState(card('x', 0)), 'faint')
eq('interval 2 is faint', threadState(card('x', 2)), 'faint')
eq('interval 3 is inked', threadState(card('x', 3)), 'inked')
eq('interval 20 is inked', threadState(card('x', 20)), 'inked')
eq('interval 21 is set', threadState(card('x', 21)), 'set')

/* ---------------------------------------------------------------------- */
/* ink and clearing                                                        */
/* ---------------------------------------------------------------------- */

console.log('\nink and clearing')
{
  const ids = threads('a', 10)
  const inked = Object.fromEntries(ids.slice(0, 8).map((id) => [id, card(id, 5, 30)]))

  const allFaint = { ...inked, ...Object.fromEntries(ids.slice(8).map((id) => [id, card(id, 1, 30)])) }
  const cleared = deriveMapState(allFaint, [waypoint('w', 'tsuzuri', ids)], REGIONS, NOW)
  eq('8 of 10 inked reads as 0.8 ink', cleared.waypoints[0]!.ink, 0.8)
  check(`0.8 ink clears at threshold ${CLEAR_THRESHOLD}`, cleared.waypoints[0]!.cleared)

  const oneUnwritten = { ...inked, [ids[8]!]: card(ids[8]!, 1, 30) }
  const blocked = deriveMapState(oneUnwritten, [waypoint('w', 'tsuzuri', ids)], REGIONS, NOW)
  eq('an unwritten thread still reads 0.8 ink', blocked.waypoints[0]!.ink, 0.8)
  check('but an unwritten thread blocks clearing', !blocked.waypoints[0]!.cleared)

  const short = deriveMapState(
    Object.fromEntries(ids.slice(0, 7).map((id) => [id, card(id, 5, 30)])),
    [waypoint('w', 'tsuzuri', ids)],
    REGIONS,
    NOW,
  )
  check('0.7 ink does not clear', !short.waypoints[0]!.cleared)

  const empty = deriveMapState({}, [waypoint('w', 'tsuzuri', [])], REGIONS, NOW)
  check('a waypoint with no threads never clears', !empty.waypoints[0]!.cleared)
  eq('and reads as 0 ink, not NaN', empty.waypoints[0]!.ink, 0)
}

/* ---------------------------------------------------------------------- */
/* node states                                                             */
/* ---------------------------------------------------------------------- */

console.log('\nnode states')
{
  const ids = threads('b', 5)
  const mature = Object.fromEntries(ids.map((id) => [id, card(id, 30, 20)]))
  const state = deriveMapState(mature, [waypoint('w', 'tsuzuri', ids)], REGIONS, NOW)
  eq('cleared and current reads inked', state.waypoints[0]!.node, 'inked')

  const lapsed = { ...mature, [ids[0]!]: card(ids[0]!, 30, -2) }
  const thin = deriveMapState(lapsed, [waypoint('w', 'tsuzuri', ids)], REGIONS, NOW)
  eq('cleared with a due thread reads thin', thin.waypoints[0]!.node, 'thin')
  check('thin never un-clears the waypoint', thin.waypoints[0]!.cleared)
  eq('and the region counts it as thinning', thin.regions[0]!.thinning, 1)

  const started = deriveMapState({ [ids[0]!]: card(ids[0]!, 1, 30) }, [waypoint('w', 'tsuzuri', ids)], REGIONS, NOW)
  eq('one thread seen reads open', started.waypoints[0]!.node, 'open')

  const untouched = deriveMapState({}, [waypoint('w', 'tsuzuri', ids)], REGIONS, NOW)
  eq('nothing seen reads fogged', untouched.waypoints[0]!.node, 'fogged')
}

/* ---------------------------------------------------------------------- */
/* one step ahead, and free travel behind                                  */
/* ---------------------------------------------------------------------- */

console.log('\none step ahead')
{
  const first = threads('c', 4)
  const road = [
    waypoint('w1', 'tsuzuri', first),
    waypoint('w2', 'tsuzuri', threads('d', 4)),
    waypoint('w3', 'tsuzuri', threads('e', 4)),
  ]
  const done = Object.fromEntries(first.map((id) => [id, card(id, 30, 20)]))

  const state = deriveMapState(done, road, REGIONS, NOW)
  eq('the frontier is the first uncleared stop', state.frontierId, 'w2')
  check('the cleared stop stays open behind you', byId(state.waypoints, 'w1').available)
  check('the frontier is available', byId(state.waypoints, 'w2').available)
  check('the stop beyond it is not', !byId(state.waypoints, 'w3').available)

  const peeked = deriveMapState({ ...done, 'e-1': card('e-1', 1, 30) }, road, REGIONS, NOW)
  check('a stop already started stays reachable out of order', byId(peeked.waypoints, 'w3').available)
  eq('without moving the frontier', peeked.frontierId, 'w2')

  const all = Object.fromEntries(
    road.flatMap((stop) => stop.threads).map((id) => [id, card(id, 30, 20)]),
  )
  eq('a finished road parks the frontier on the last stop', deriveMapState(all, road, REGIONS, NOW).frontierId, 'w3')
}

/* ---------------------------------------------------------------------- */
/* region gating                                                           */
/* ---------------------------------------------------------------------- */

console.log('\nregion gating')
{
  const stop = threads('f', 4)
  const shrine = threads('g', 4)
  const road = [
    waypoint('v1', 'tsuzuri', stop),
    waypoint('v2', 'tsuzuri', shrine, 'shrine'),
    waypoint('m1', 'market', threads('h', 4)),
  ]

  const stopOnly = Object.fromEntries(stop.map((id) => [id, card(id, 30, 20)]))
  const sealed = deriveMapState(stopOnly, road, REGIONS, NOW)
  eq('the next region is sealed while its shrine stands', byId(sealed.waypoints, 'm1').node, 'sealed')
  check('and unreachable', !byId(sealed.waypoints, 'm1').available)
  check('the region itself reads closed', !sealed.regions[1]!.open)
  eq('the shrine is the frontier', sealed.frontierId, 'v2')

  const withShrine = { ...stopOnly, ...Object.fromEntries(shrine.map((id) => [id, card(id, 30, 20)])) }
  const opened = deriveMapState(withShrine, road, REGIONS, NOW)
  check('clearing the shrine opens the next region', opened.regions[1]!.open)
  eq('its first stop is no longer sealed', byId(opened.waypoints, 'm1').node, 'fogged')
  check('and is now reachable', byId(opened.waypoints, 'm1').available)
  eq('the frontier crosses over', opened.frontierId, 'm1')
}

/* ---------------------------------------------------------------------- */
/* counts the chrome reads                                                 */
/* ---------------------------------------------------------------------- */

console.log('\ncounts')
{
  const shared = 'shared-thread'
  const road = [
    waypoint('w1', 'tsuzuri', [shared, 'p-1']),
    waypoint('w2', 'tsuzuri', [shared, 'p-2']),
  ]
  const state = deriveMapState({ [shared]: card(shared, 10, -1) }, road, REGIONS, NOW)
  eq('a shared thread is due at both stops', state.waypoints[0]!.due + state.waypoints[1]!.due, 2)
  eq('but the map counts the card once', state.due, 1)

  const ids = threads('q', 4)
  const half = deriveMapState(
    Object.fromEntries(ids.map((id) => [id, card(id, 30, 20)])),
    [waypoint('w1', 'tsuzuri', ids), waypoint('w2', 'tsuzuri', threads('r', 4))],
    REGIONS,
    NOW,
  )
  eq('region ink is the mean of its stops', half.regions[0]!.ink, 0.5)
  eq('with one of two cleared', half.regions[0]!.waypointsCleared, 1)
}

/* ---------------------------------------------------------------------- */
/* chunking                                                               */
/* ---------------------------------------------------------------------- */

console.log('\nchunking')
{
  const sizes = (n: number, per: number) => chunkThreads(threads('z', n), per).map((chunk) => chunk.length)
  eq('40 at 15 splits 15/15/10', sizes(40, 15).join('/'), '15/15/10')
  eq('31 at 15 folds the tail in', sizes(31, 15).join('/'), '15/16')
  eq('30 at 15 splits evenly', sizes(30, 15).join('/'), '15/15')
  eq('10 at 15 stays one stop', sizes(10, 15).join('/'), '10')
  eq('nothing in, nothing out', chunkThreads([], 15).length, 0)
}

/* ---------------------------------------------------------------------- */
/* CONTENT — what the decks can supply                                     */
/* ---------------------------------------------------------------------- */

console.log(`\n${'='.repeat(78)}\nCONTENT — thread-sets the existing decks can supply\n`)

const kanjiIdByCharacter = new Map(kanjiCards.map((kanji) => [kanji.front, kanji.id]))
const questSetIds = [...new Set(QUESTS.map((quest) => quest.vocabularySetId))]

let totalThreads = 0
let totalUnmapped = 0
const rows: string[] = []

for (const setId of questSetIds) {
  const vocab = vocabFocusSets.find((set) => set.id === setId)
  const kanji = kanjiFocusSets.find((set) => set.id === setId)
  if (!vocab) {
    rows.push(`  ${setId.padEnd(15)} MISSING from vocabFocusSets`)
    continue
  }

  const vocabIds = vocab.cards.map((entry) => entry.id)
  const characters = kanji?.characters ?? []
  const mapped = characters.map((character) => kanjiIdByCharacter.get(character)).filter((id): id is string => Boolean(id))
  const unmapped = characters.length - mapped.length

  const threadIds = [...vocabIds, ...mapped]
  const stops = chunkThreads(threadIds, 15)
  totalThreads += threadIds.length
  totalUnmapped += unmapped

  rows.push(
    `  ${setId.padEnd(15)} ${String(threadIds.length).padStart(3)} threads ` +
      `(${String(vocabIds.length).padStart(2)} vocab + ${String(mapped.length).padStart(2)} kanji)  ` +
      `${stops.length} stops [${stops.map((stop) => stop.length).join(' ')}]` +
      (unmapped > 0 ? `  · ${unmapped} characters with no card` : ''),
  )
}

console.log(rows.join('\n'))
console.log(`\n  ${questSetIds.length} topics · ${totalThreads} threads · ${totalUnmapped} characters without an SRS card`)

// Grammar is authored as drills, not as cards, so it cannot carry ink yet.
const grammarPatterns = new Set(QUESTS.flatMap((quest) => quest.grammar))
console.log(`  ${grammarPatterns.size} grammar patterns across the campaign carry no card id — excluded from ink for now`)

if (process.argv.includes('--content')) {
  console.log(`\n${'-'.repeat(78)}\nA learner three days in, walking Tsuzuri\n`)

  const home = vocabFocusSets.find((set) => set.id === 'home')!
  const stops = chunkThreads(home.cards.map((entry) => entry.id), 6)
  const road = stops.map((stop, index) => waypoint(`tsuzuri-${index + 1}`, 'tsuzuri', stop))

  // Two stops learned, the third half-met, the first already slipping.
  const learner: Record<string, CardProgress> = {}
  road.slice(0, 2).forEach((stop) => stop.threads.forEach((id) => { learner[id] = card(id, 6, 4) }))
  road[0]!.threads.slice(0, 2).forEach((id) => { learner[id] = card(id, 6, -1) })
  road[2]?.threads.slice(0, 3).forEach((id) => { learner[id] = card(id, 1, 0) })

  const state = deriveMapState(learner, road, REGIONS, NOW)
  for (const stop of state.waypoints) {
    console.log(
      `  ${stop.id.padEnd(12)} ${stop.node.padEnd(7)} ink ${String(Math.round(stop.ink * 100)).padStart(3)}%  ` +
        `${stop.counts.inked + stop.counts.set}/${stop.total} inked  ${stop.due} due  ` +
        `${stop.available ? 'open' : 'locked'}`,
    )
  }
  console.log(`\n  region ink ${Math.round(state.regions[0]!.ink * 100)}% · ${state.due} cards due · standing at ${state.frontierId}`)
}

console.log(`\n${failures === 0 ? 'All invariants hold.' : `${failures} invariant(s) failed.`}`)
process.exitCode = failures > 0 ? 1 : 0
