import { hiraganaCards } from './kana'
import { chunkThreads, type Region, type Waypoint } from '../lib/mapState'

/**
 * The first region of the Ink Road, wired to real cards.
 *
 * Tsuzuri Village teaches kana, so its threads are the hiragana deck's own card
 * ids rather than a parallel list — the map has no content of its own to drift
 * out of sync. Once the practice screens record `CardProgress` (nothing writes
 * it today, so `MapView` runs on demo progress), the same waypoints will read
 * true with no change here.
 */

export const INK_ROAD_REGIONS: readonly Region[] = [
  { id: 'tsuzuri', title: 'Tsuzuri Village' },
]

export const TSUZURI_JAPANESE = '綴村'
export const TSUZURI_BAND = 'kana'

const STOP_NAMES = [
  'The Gate Board',
  'First Lantern',
  'The Well',
  'Two Doors',
  'The Rice Field',
  'The Road Marker',
] as const

const stopThreads = chunkThreads(hiraganaCards.map((card) => card.id), 8)

/**
 * The shrine tests the region rather than adding to it, so it draws from every
 * stop instead of owning threads of its own.
 */
const shrineThreads = hiraganaCards
  .filter((_, index) => index % 4 === 0)
  .map((card) => card.id)

export const INK_ROAD_WAYPOINTS: readonly Waypoint[] = [
  ...stopThreads.map((threads, index) => ({
    id: `tsuzuri-${index + 1}`,
    regionId: 'tsuzuri',
    kind: 'stop' as const,
    threads,
  })),
  { id: 'tsuzuri-shrine', regionId: 'tsuzuri', kind: 'shrine' as const, threads: shrineThreads },
]

export const WAYPOINT_NAMES: Record<string, string> = {
  ...Object.fromEntries(stopThreads.map((_, index) => [`tsuzuri-${index + 1}`, STOP_NAMES[index] ?? `Stop ${index + 1}`])),
  'tsuzuri-shrine': 'Village Shrine',
}

/**
 * Each region's light.
 *
 * The map is dark because the app is, but the regions are meant to differ —
 * Tsuzuri at dawn, the Market Road at noon, Shizukudani in mist. Keeping the
 * light as data means that is a palette entry per region rather than a rewrite
 * of the view: `MapView` sets these as custom properties and every shape reads
 * them.
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

export const REGION_PALETTES: Record<string, RegionPalette> = {
  tsuzuri: DAWN,
}

export function paletteFor(regionId: string): RegionPalette {
  return REGION_PALETTES[regionId] ?? DAWN
}
