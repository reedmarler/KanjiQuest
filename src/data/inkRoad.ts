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
  /**
   * Three tones for solid shapes: a lit face, a body, and a roof or shadow
   * side. Outlines alone read as a wireframe however good the shapes are —
   * what makes a scene look built is value separation under one light.
   */
  propLight: string
  propMid: string
  propDark: string
  /**
   * Ink is the road's own colour, which in daylight is pale stone — so marks
   * and the traveller need their own value or they vanish into it. Dark regions
   * set this the same as `ink`; bright ones invert it.
   */
  mark: string
  /** Snowline on the far peak, when the region has one. */
  peak?: string
  /**
   * How heavily distance washes out, 0–1.
   *
   * A dark region can take a strong haze because its fog colour is close to its
   * ground; in daylight the sky is far lighter than the grass, so the same
   * value buries the whole middle distance in mist.
   */
  haze: number
}

/**
 * Tsuzuri in spring daylight, taken from the reference: blue sky over pale
 * distance, green verges, dark tiled roofs above cream walls, a stone path, and
 * sakura either side of the road.
 */
const SPRING_DAY: RegionPalette = {
  skyFar: '#5aa7dd',
  skyNear: '#cbe4f2',
  ground: '#6c9f4c',
  ink: '#efe7d6',
  lit: '#ffd166',
  bloom: '#f7a6c9',
  propLight: '#e8e1d1',
  propMid: '#9a7350',
  propDark: '#333b46',
  mark: '#2b3340',
  peak: '#eef6fb',
  haze: 0.5,
}

/** Late afternoon over the market: the same day, lower and warmer. */
const MARKET_AFTERNOON: RegionPalette = {
  skyFar: '#e8a45c',
  skyNear: '#f7ddb4',
  ground: '#8a8347',
  ink: '#f6ecd8',
  lit: '#ffc861',
  bloom: '#e8836a',
  propLight: '#e2d3ba',
  propMid: '#9c6a44',
  propDark: '#3d3037',
  mark: '#33262b',
  haze: 0.52,
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
    palette: SPRING_DAY,
    stops: named(TSUZURI_STOPS, chunkThreads(hiraganaCards.map((card) => card.id), 8)),
    shrine: 'Village Shrine',
  },
  {
    id: 'market',
    title: 'The Market Road',
    japanese: '市の道',
    band: 'N5',
    palette: MARKET_AFTERNOON,
    stops: named(MARKET_STOPS, [
      ...chunkThreads(topicThreads('food'), 15),
      ...chunkThreads(topicThreads('shopping'), 15),
    ]),
    shrine: 'Market Shrine',
  },
]

/**
 * The card a shrine owns, and the only one its trial can ink.
 *
 * A shrine that only sampled its region's threads would clear itself the moment
 * the stops did — the sample is already inked by then, so there would be
 * nothing to pass. This token has no card in any deck, so it stays unwritten
 * until the trial grades it, and an unwritten thread blocks clearing however
 * high the ink runs. The gate lives in the scheduler with everything else
 * rather than in a flag beside it, which also means a shrine passed long ago
 * eventually comes due again.
 */
export function shrineTokenId(regionId: string): string {
  return `shrine-${regionId}`
}

/**
 * A shrine tests its region rather than adding to it, so it draws a sample from
 * every stop, plus the token the trial answers for.
 */
function shrineThreads(region: RoadRegion): string[] {
  return [
    ...region.stops.flatMap((stop) => stop.threads.filter((_, index) => index % 4 === 0)),
    shrineTokenId(region.id),
  ]
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
  return LOOKS[regionId] ?? { japanese: '綴村', band: 'kana', palette: SPRING_DAY }
}
