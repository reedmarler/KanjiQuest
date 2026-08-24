import { hiraganaCards } from './kana'
import { vocabFocusSets } from './vocabFocusSets'
import { kanjiFocusSets } from './kanjiFocusSets'
import { kanjiCards } from './kanji'
import { chunkThreads, type Region, type Waypoint } from '../lib/mapState'

/**
 * The Ink Road, region by region.
 *
 * Every thread is a real card id, so the map has no content of its own to drift
 * out of step with the decks: Tsuzuri is the hiragana deck, and each region
 * after it is one or more of the topic focus sets — their vocabulary plus the
 * characters those words are written with.
 */

const kanjiIdByCharacter = new Map(kanjiCards.map((card) => [card.front, card.id]))

/** A topic's vocabulary, plus every character in it that the deck can teach. */
function topicThreads(topicId: string): string[] {
  const vocabulary = vocabFocusSets.find((set) => set.id === topicId)?.cards.map((card) => card.id) ?? []
  const characters = kanjiFocusSets.find((set) => set.id === topicId)?.characters ?? []
  const kanji = characters
    .map((character) => kanjiIdByCharacter.get(character))
    .filter((id): id is string => Boolean(id))
  return [...vocabulary, ...kanji]
}

/**
 * Each region's light.
 *
 * The regions are meant to differ — Tsuzuri at dawn, the Market Road at noon,
 * Shizukudani in mist. Keeping the light as data means that is an entry here
 * rather than a rewrite of the view: `MapView` sets these as custom properties
 * and every shape reads them.
 */
export interface RegionPalette {
  /** Sky at the top of the frame, and where it meets the horizon. */
  skyFar: string
  skyNear: string
  /** The ground plane the road lies on. */
  ground: string
  /** Ink: the drawn road, cleared marks, anything the learner has restored. */
  ink: string
  /** Lamp light — tōrō, windows, the lantern's flame. */
  lit: string
  /** Blossom and other seasonal colour. */
  bloom: string
}

const DAWN: RegionPalette = {
  skyFar: '#0e1220',
  skyNear: '#1b2033',
  ground: '#141a24',
  ink: '#fffffe',
  lit: '#e8c25a',
  bloom: '#ff8ba7',
}

/** Later in the day and further from home: warmer ground, dustier sky. */
const MARKET_NOON: RegionPalette = {
  skyFar: '#171a2b',
  skyNear: '#2a2536',
  ground: '#221c26',
  ink: '#fff6e8',
  lit: '#f0a94e',
  bloom: '#e0705f',
}

interface RoadRegion {
  id: string
  title: string
  japanese: string
  band: string
  palette: RegionPalette
  stops: { name: string; threads: readonly string[] }[]
  shrine: string
}

function named(names: readonly string[], chunks: string[][]) {
  return chunks.map((threads, index) => ({ name: names[index] ?? `Stop ${index + 1}`, threads }))
}

const TSUZURI_STOPS = ['The Gate Board', 'First Lantern', 'The Well', 'Two Doors', 'The Rice Field', 'The Road Marker'] as const
const MARKET_STOPS = ['First Stall', 'The Fishmonger', 'The Coin Purse', 'Under the Noren'] as const

const REGIONS: RoadRegion[] = [
  {
    id: 'tsuzuri',
    title: 'Tsuzuri Village',
    japanese: '綴村',
    band: 'kana',
    palette: DAWN,
    stops: named(TSUZURI_STOPS, chunkThreads(hiraganaCards.map((card) => card.id), 8)),
    shrine: 'Village Shrine',
  },
  {
    id: 'market',
    title: 'The Market Road',
    japanese: '市の道',
    band: 'N5',
    palette: MARKET_NOON,
    stops: named(MARKET_STOPS, [
      ...chunkThreads(topicThreads('food'), 15),
      ...chunkThreads(topicThreads('shopping'), 15),
    ]),
    shrine: 'Market Shrine',
  },
]

/**
 * A shrine tests its region rather than adding to it, so it draws a sample from
 * every stop instead of owning threads of its own.
 */
function shrineThreads(region: RoadRegion): string[] {
  return region.stops.flatMap((stop) => stop.threads.filter((_, index) => index % 4 === 0))
}

export const INK_ROAD_REGIONS: readonly Region[] = REGIONS.map((region) => ({
  id: region.id,
  title: region.title,
}))

export const INK_ROAD_WAYPOINTS: readonly Waypoint[] = REGIONS.flatMap((region) => [
  ...region.stops.map((stop, index) => ({
    id: `${region.id}-${index + 1}`,
    regionId: region.id,
    kind: 'stop' as const,
    threads: stop.threads,
  })),
  {
    id: `${region.id}-shrine`,
    regionId: region.id,
    kind: 'shrine' as const,
    threads: shrineThreads(region),
  },
])

export const WAYPOINT_NAMES: Record<string, string> = Object.fromEntries(
  REGIONS.flatMap((region) => [
    ...region.stops.map((stop, index) => [`${region.id}-${index + 1}`, stop.name] as const),
    [`${region.id}-shrine`, region.shrine] as const,
  ]),
)

interface RegionLook {
  japanese: string
  band: string
  palette: RegionPalette
}

const LOOKS: Record<string, RegionLook> = Object.fromEntries(
  REGIONS.map((region) => [region.id, { japanese: region.japanese, band: region.band, palette: region.palette }]),
)

export function lookFor(regionId: string): RegionLook {
  return LOOKS[regionId] ?? { japanese: '綴村', band: 'kana', palette: DAWN }
}
