import { conjugateVerb, conjugateVerbForm } from './posSentenceConjugate'
import type { VerbMorph } from '../data/heroPosTemplates'

/** Rotatable verb suffix — root stays in V / V2, ending cycles in VEnd / V2End */
export type VerbEndingId =
  | 'plain'
  | 'masu'
  | 'mashita'
  | 'masen'
  | 'masenDeshita'
  | 'nai'
  | 'nakatta'
  | 'ta'
  | 'te'
  | 'volitional'
  | 'tai'
  | 'tagaru'
  | 'teiru'
  | 'teita'
  | 'tearu'
  | 'teoku'
  | 'teiku'
  | 'tekuru'
  | 'teshimau'
  | 'teshimatta'
  | 'kotogaDekiru'
  | 'nakerebaNaranai'
  | 'nakutehaIkenai'
  | 'nakutemoIi'
  | 'temoIi'
  | 'tehaIkenai'
  | 'ba'
  | 'tara'
  | 'nara'
  | 'to'
  | 'sou'
  | 'rashii'
  | 'mitai'
  | 'youda'
  | 'youniSuru'
  | 'youniNaru'
  | 'kotoniSuru'
  | 'kotoniNaru'
  | 'tsumori'
  | 'yotei'
  | 'youtoSuru'
  | 'hajimeru'
  | 'tsuzukeru'
  | 'owaru'
  | 'sugiru'
  | 'yasui'
  | 'nikui'
  | 'tokoro'
  | 'tokoroDatta'

/** Order used when the VEnd / V2End slot rotates */
export const VERB_ENDING_ROTATION: readonly VerbEndingId[] = [
  'plain',
  'masu',
  'mashita',
  'masen',
  'masenDeshita',
  'nai',
  'nakatta',
  'ta',
  'te',
  'volitional',
  'tai',
  'tagaru',
  'teiru',
  'teita',
  'tearu',
  'teoku',
  'teiku',
  'tekuru',
  'teshimau',
  'teshimatta',
  'kotogaDekiru',
  'nakerebaNaranai',
  'nakutehaIkenai',
  'nakutemoIi',
  'temoIi',
  'tehaIkenai',
  'ba',
  'tara',
  'nara',
  'to',
  'sou',
  'rashii',
  'mitai',
  'youda',
  'youniSuru',
  'youniNaru',
  'kotoniSuru',
  'kotoniNaru',
  'tsumori',
  'yotei',
  'youtoSuru',
  'hajimeru',
  'tsuzukeru',
  'owaru',
  'sugiru',
  'yasui',
  'nikui',
  'tokoro',
  'tokoroDatta',
]

const PARTS_CACHE = new Map<string, {
  plain: string
  stem: string
  te: string
  ta: string
  nai: string
  ba: string
  tara: string
  nara: string
  volitional: string
  tai: string
  masu: string
}>()

function parts(dict: string) {
  let cached = PARTS_CACHE.get(dict)
  if (!cached) {
    cached = {
      plain: dict,
      stem: conjugateVerbForm(dict, 'stem'),
      te: conjugateVerbForm(dict, 'te'),
      ta: conjugateVerbForm(dict, 'ta'),
      nai: conjugateVerbForm(dict, 'nai'),
      ba: conjugateVerbForm(dict, 'ba'),
      tara: conjugateVerbForm(dict, 'tara'),
      nara: conjugateVerbForm(dict, 'nara'),
      volitional: conjugateVerbForm(dict, 'volitional'),
      tai: conjugateVerb(dict, 'tai'),
      masu: conjugateVerb(dict, 'desu'),
    }
    PARTS_CACHE.set(dict, cached)
  }
  return cached
}

const ENDING_SURFACE_CACHE = new Map<string, string>()

function naiPast(dict: string): string {
  const nai = conjugateVerb(dict, 'nai')
  if (nai.endsWith('ない')) return `${nai.slice(0, -2)}なかった`
  return `${nai}かった`
}

function naiStem(dict: string): string {
  const nai = conjugateVerb(dict, 'nai')
  return nai.endsWith('ない') ? nai.slice(0, -1) : nai
}

function masuStem(dict: string): string {
  const masu = conjugateVerb(dict, 'desu')
  return masu.endsWith('ます') ? masu.slice(0, -2) : parts(dict).stem
}

/** Build full verb surface from dictionary root + rotatable ending */
export function applyVerbEnding(dict: string, ending: VerbEndingId): string {
  const key = `${dict}:${ending}`
  const hit = ENDING_SURFACE_CACHE.get(key)
  if (hit) return hit

  const p = parts(dict)
  let surface: string
  switch (ending) {
    case 'plain':
      surface = p.plain
      break
    case 'masu':
      surface = p.masu
      break
    case 'mashita':
      surface = `${masuStem(dict)}ました`
      break
    case 'masen':
      surface = `${masuStem(dict)}ません`
      break
    case 'masenDeshita':
      surface = `${masuStem(dict)}ませんでした`
      break
    case 'nai':
      surface = p.nai
      break
    case 'nakatta':
      surface = naiPast(dict)
      break
    case 'ta':
      surface = p.ta
      break
    case 'te':
      surface = p.te
      break
    case 'volitional':
      surface = p.volitional
      break
    case 'tai':
      surface = p.tai
      break
    case 'tagaru':
      surface = `${p.tai}がる`
      break
    case 'teiru':
      surface = `${p.te}いる`
      break
    case 'teita':
      surface = `${p.te}いた`
      break
    case 'tearu':
      surface = `${p.te}ある`
      break
    case 'teoku':
      surface = `${p.te}おく`
      break
    case 'teiku':
      surface = `${p.te}いく`
      break
    case 'tekuru':
      surface = `${p.te}くる`
      break
    case 'teshimau':
      surface = `${p.te}しまう`
      break
    case 'teshimatta':
      surface = `${p.te}しまった`
      break
    case 'kotogaDekiru':
      surface = `${p.plain}ことができる`
      break
    case 'nakerebaNaranai':
      surface = `${naiStem(dict)}ければならない`
      break
    case 'nakutehaIkenai':
      surface = `${naiStem(dict)}くてはいけない`
      break
    case 'nakutemoIi':
      surface = `${naiStem(dict)}くてもいい`
      break
    case 'temoIi':
      surface = `${p.te}もいい`
      break
    case 'tehaIkenai':
      surface = `${p.te}はいけない`
      break
    case 'ba':
      surface = p.ba
      break
    case 'tara':
      surface = p.tara
      break
    case 'nara':
      surface = p.nara
      break
    case 'to':
      surface = `${p.plain}と`
      break
    case 'sou':
      surface = `${p.stem}そう`
      break
    case 'rashii':
      surface = `${p.ta}らしい`
      break
    case 'mitai':
      surface = `${p.ta}みたい`
      break
    case 'youda':
      surface = `${p.plain}ようだ`
      break
    case 'youniSuru':
      surface = `${p.plain}ようにする`
      break
    case 'youniNaru':
      surface = `${p.plain}ようになる`
      break
    case 'kotoniSuru':
      surface = `${p.plain}ことにする`
      break
    case 'kotoniNaru':
      surface = `${p.plain}ことになる`
      break
    case 'tsumori':
      surface = `${p.plain}つもり`
      break
    case 'yotei':
      surface = `${p.plain}予定`
      break
    case 'youtoSuru':
      surface = `${p.volitional}とする`
      break
    case 'hajimeru':
      surface = `${p.stem}始める`
      break
    case 'tsuzukeru':
      surface = `${p.stem}続ける`
      break
    case 'owaru':
      surface = `${p.stem}終わる`
      break
    case 'sugiru':
      surface = `${p.stem}すぎる`
      break
    case 'yasui':
      surface = `${p.stem}やすい`
      break
    case 'nikui':
      surface = `${p.stem}にくい`
      break
    case 'tokoro':
      surface = `${p.stem}ところ`
      break
    case 'tokoroDatta':
      surface = `${p.stem}ところだった`
      break
    default:
      surface = p.plain
  }
  ENDING_SURFACE_CACHE.set(key, surface)
  return surface
}

export function pickVerbEnding(seed: number, exclude?: VerbEndingId): VerbEndingId {
  const others = exclude
    ? VERB_ENDING_ROTATION.filter((e) => e !== exclude)
    : [...VERB_ENDING_ROTATION]
  const pool = others.length > 0 ? others : [...VERB_ENDING_ROTATION]
  return pool[Math.abs(seed) % pool.length]!
}

export function rotateVerbEnding(current: VerbEndingId, seed: number): VerbEndingId {
  return pickVerbEnding(seed, current)
}

const VMORPH_TO_ENDING: Partial<Record<VerbMorph, VerbEndingId>> = {
  plain: 'plain',
  nai: 'nai',
  ta: 'ta',
  tai: 'tai',
  desu: 'masu',
}

/** Endings that attach as sentence modality — not root rotations */
const NON_ROTATING_VMORPH = new Set<VerbMorph>(['deshou', 'ka', 'yo'])

export function vmorphToEnding(morph: VerbMorph): VerbEndingId {
  return VMORPH_TO_ENDING[morph] ?? 'plain'
}

export function vmorphAllowsEndingRotation(morph: VerbMorph): boolean {
  return !NON_ROTATING_VMORPH.has(morph)
}

export function isVerbEndingId(value: string | undefined): value is VerbEndingId {
  return Boolean(value && (VERB_ENDING_ROTATION as readonly string[]).includes(value))
}
