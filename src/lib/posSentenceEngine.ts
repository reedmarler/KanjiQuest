import { HERO_POS_VOCABULARY } from '../data/heroPosVocabulary'
import {
  getPosTemplate,
  HERO_POS_TEMPLATES,
  initialVerbEndingForTemplate,
  POS_SLOT_TO_CATEGORY,
  swappableSlotsInTemplate,
  type PosSlotKey,
  type PosTemplate,
  type VerbMorph,
} from '../data/heroPosTemplates'
import type { PosCategory } from './japanesePos/types'
import {
  adjDeshou,
  conjugateVerb,
  conjugateVerbForm,
  CURATED_VERBS,
  surfaceIAdj,
  surfaceNaAdj,
} from './posSentenceConjugate'
import {
  applyVerbEnding,
  isVerbEndingId,
  rotateVerbEnding,
} from './verbEndings'
import {
  nounsForTemplateSlot,
  posFillsAreValid,
  verbsForTemplate,
  type PosFills,
} from './posSentenceVet'
import { sentenceIsViable, iAdjectivesForNoun, naAdjectivesForNoun } from './sentenceViability'

export type { PosFills }

export const ROTATIONS_PER_SENTENCE = 5

export interface HeroSegment {
  key: string
  text: string
  swappable: boolean
  posCategory?: PosCategory
}

const CURATED_PRONOUNS = ['私', '彼', '彼女', 'みんな'] as const

const CURATED_NOUNS = [
  '本', '雑誌', '新聞', '小説', '漫画', '映画', '音楽', '写真', '料理', 'パン',
  'リンゴ', '寿司', 'コーヒー', 'お茶', '魚', '肉', '米', '花', '車', '電車',
  '図書館', '学校', '会社', '公園', '駅', '病院', '京都', '東京', '海', '山',
  '仕事', '宿題', '試験', '数学', '科学', '歴史', '漢字', '日本語', '友達', '先生',
  'ケーキ', 'ラーメン', 'ピザ', '犬', '猫', '鳥', '春', '夏', '秋', '冬', '雨',
] as const

const CURATED_I_ADJ = [
  '高い', '低い', '新しい', '古い', '大きい', '小さい', '難しい', '易しい',
  '面白い', '楽しい', '忙しい', '暑い', '寒い', '早い', '遅い', '美味しい',
] as const

const CURATED_NA_ADJ = ['好き', '嫌い', '上手', '下手', '重要', '大切', '静か', '有名'] as const

const CURATED_ADVERBS = [
  'よく', '時々', 'とても', 'すぐ', 'もう', 'まだ', '少し', 'たくさん',
  'ゆっくり', 'はやく', 'ときどき', 'ぜんぜん', 'あまり', '必ず', '毎日',
] as const

export const HERO_POS_TEMPLATES_ALL = HERO_POS_TEMPLATES

const N5_N3_IDS = new Set([
  1, 2, 3, 4, 5, 6, 7, 20, 21, 23, 25, 27, 28, 38, 39, 82,
])

const N2_N3_GRAMMAR_IDS = new Set(
  Array.from({ length: 50 }, (_, i) => i + 101),
)

export const HERO_POS_TEMPLATES_BY_LEVEL: Record<string, PosTemplate[]> = {
  N5: HERO_POS_TEMPLATES.filter((t) => N5_N3_IDS.has(t.id) && t.id <= 30),
  N4: HERO_POS_TEMPLATES.filter((t) => N5_N3_IDS.has(t.id)),
  N3: HERO_POS_TEMPLATES.filter((t) => t.id <= 50 || (t.id >= 101 && t.id <= 125)),
  N2: HERO_POS_TEMPLATES.filter((t) => t.id <= 80 || N2_N3_GRAMMAR_IDS.has(t.id)),
  N1: HERO_POS_TEMPLATES,
  All: HERO_POS_TEMPLATES,
}

const POOL_CACHE: Partial<Record<PosCategory, string[]>> = {}

function cleanPool(category: PosCategory): string[] {
  const hit = POOL_CACHE[category]
  if (hit) return hit

  const raw = [...HERO_POS_VOCABULARY[category]]
  let pool: string[]
  if (category === 'adverb') {
    pool = [...CURATED_ADVERBS]
  } else if (category === 'pronoun') {
    pool = [...CURATED_PRONOUNS]
  } else if (category === 'verb') {
    pool = CURATED_VERBS.filter((w) => raw.includes(w))
  } else if (category === 'noun') {
    const curated = CURATED_NOUNS.filter((w) => raw.includes(w))
    pool = curated.length > 0 ? [...curated] : raw.filter((w) => w.length >= 2 && w.length <= 4).slice(0, 80)
  } else if (category === 'i_adj') {
    pool = [...CURATED_I_ADJ]
  } else if (category === 'na_adj') {
    pool = [...CURATED_NA_ADJ]
  } else {
    pool = raw.filter((w) => w.length >= 2)
  }
  POOL_CACHE[category] = pool
  return pool
}

function pickFromList(list: readonly string[], seed: number, exclude?: string): string {
  const others = exclude ? list.filter((w) => w !== exclude) : list
  const pool = others.length > 0 ? others : list
  return pool[Math.abs(seed) % pool.length]!
}

function pickFromPool(category: PosCategory, seed: number, exclude?: string): string {
  return pickFromList(cleanPool(category), seed, exclude)
}

function pickSlotValue(
  template: PosTemplate,
  key: PosSlotKey,
  fills: PosFills,
  seed: number,
): string {
  const category = POS_SLOT_TO_CATEGORY[key]
  if (key === 'V' || key === 'V2') {
    const verbs = verbsForTemplate(template, cleanPool('verb'), fills, key)
    const exclude = key === 'V2' ? fills.V : undefined
    if (verbs.length === 0) {
      return pickFromPool('verb', seed, exclude)
    }
    return pickFromList(verbs, seed, exclude)
  }
  if (key === 'N' || key === 'N2' || key === 'N3') {
    const nouns = nounsForTemplateSlot(template, key, fills, cleanPool('noun'))
    const exclude =
      key === 'N2' ? fills.N
      : key === 'N3' ? fills.N2
      : undefined
    return pickFromList(nouns.length > 0 ? nouns : cleanPool('noun'), seed, exclude)
  }
  if (key === 'IAdj') {
    const subject = template.label.includes('[N] は [N] が') ? fills.N2 : fills.N
    const pool = iAdjectivesForNoun(cleanPool('i_adj'), subject)
    return pickFromList(pool.length > 0 ? pool : cleanPool('i_adj'), seed)
  }
  if (key === 'NaAdj') {
    const pool = naAdjectivesForNoun(cleanPool('na_adj'), fills.N)
    return pickFromList(pool.length > 0 ? pool : cleanPool('na_adj'), seed)
  }
  return pickFromPool(category, seed, fills[key])
}

const MAX_VET_ATTEMPTS = 48

function fillsPassVet(template: PosTemplate, fills: PosFills): boolean {
  if (!posFillsAreValid(template, fills)) return false
  const jp = segmentsToJapanese(compileSegments(template, fills))
  return sentenceIsViable(jp, template, fills)
}

export function fillTemplate(template: PosTemplate, seed: number): PosFills {
  for (let attempt = 0; attempt < MAX_VET_ATTEMPTS; attempt++) {
    const s = seed + attempt * 31
    const fills: PosFills = {}
    for (const key of swappableSlotsInTemplate(template)) {
      if (key === 'VEnd' || key === 'V2End') continue
      fills[key] = pickSlotValue(template, key, fills, s + key.length * 17)
    }
    const vEnd = initialVerbEndingForTemplate(template, 'V')
    if (vEnd) fills.VEnd = vEnd
    const v2End = initialVerbEndingForTemplate(template, 'V2')
    if (v2End) fills.V2End = v2End
    if (fillsPassVet(template, fills)) return fills
  }

  const fallback: PosFills = { P: '私', N: '本', V: '読む', VEnd: 'plain' }
  const vEnd = initialVerbEndingForTemplate(template, 'V')
  if (vEnd) fallback.VEnd = vEnd
  return fallback
}

export function rotateFill(
  fills: PosFills,
  slot: PosSlotKey,
  seed: number,
  template?: PosTemplate,
): PosFills {
  if (!template) {
    if (slot === 'VEnd') {
      const current = isVerbEndingId(fills.VEnd) ? fills.VEnd : 'plain'
      return { ...fills, VEnd: rotateVerbEnding(current, seed) }
    }
    if (slot === 'V2End') {
      const current = isVerbEndingId(fills.V2End) ? fills.V2End : 'plain'
      return { ...fills, V2End: rotateVerbEnding(current, seed) }
    }
    return {
      ...fills,
      [slot]: pickFromPool(POS_SLOT_TO_CATEGORY[slot], seed, fills[slot]),
    }
  }

  for (let attempt = 0; attempt < MAX_VET_ATTEMPTS; attempt++) {
    const s = seed + attempt * 13
    let next: PosFills
    if (slot === 'VEnd') {
      const current = isVerbEndingId(fills.VEnd) ? fills.VEnd : 'plain'
      next = { ...fills, VEnd: rotateVerbEnding(current, s) }
    } else if (slot === 'V2End') {
      const current = isVerbEndingId(fills.V2End) ? fills.V2End : 'plain'
      next = { ...fills, V2End: rotateVerbEnding(current, s) }
    } else {
      next = { ...fills, [slot]: pickSlotValue(template, slot, fills, s) }
    }
    if (fillsPassVet(template, next)) return next
  }

  if (slot === 'VEnd' || slot === 'V2End') return fills
  const retry = pickSlotValue(template, slot, fills, seed + 9999)
  const next = { ...fills, [slot]: retry }
  if (fillsPassVet(template, next)) return next
  return fills
}

export function compileSegments(template: PosTemplate, fills: PosFills): HeroSegment[] {
  const segments: HeroSegment[] = []
  let verbMorph: VerbMorph = 'plain'

  for (const piece of template.pieces) {
    if (piece.kind === 'vmorph') {
      verbMorph = piece.morph
      if (piece.morph === 'deshou') {
        const last = segments[segments.length - 1]
        if (last && (last.posCategory === 'i_adj' || last.posCategory === 'na_adj')) {
          last.text = adjDeshou(last.text)
        }
      }
      continue
    }

    if (piece.kind === 'imorph') {
      const seg = segments.find((s) => s.key === 'IAdj')
      const stem = fills.IAdj ?? '高'
      if (seg) seg.text = surfaceIAdj(stem, piece.suffix)
      else segments.push({ key: `lit-${segments.length}`, text: piece.suffix, swappable: false })
      continue
    }

    if (piece.kind === 'namorph') {
      const seg = segments.find((s) => s.key === 'NaAdj')
      const stem = fills.NaAdj ?? '好き'
      if (seg) seg.text = surfaceNaAdj(stem, piece.suffix)
      continue
    }

    if (piece.kind === 'slot') {
      const raw = fills[piece.key] ?? (piece.key === 'V2' ? fills.V : '') ?? ''
      let text = raw
      const isVerb = piece.key === 'V' || piece.key === 'V2'
      if (isVerb) {
        if (piece.form) {
          text = conjugateVerbForm(raw || '食べる', piece.form)
        } else {
          const endKey = piece.key === 'V2' ? 'V2End' : 'VEnd'
          const ending = fills[endKey]
          if (isVerbEndingId(ending)) {
            text = applyVerbEnding(raw || '食べる', ending)
          } else if (piece.key === 'V') {
            text = conjugateVerb(raw || '食べる', verbMorph)
          } else {
            text = conjugateVerb(raw || '食べる', 'plain')
          }
        }
      } else if (piece.key === 'IAdj') {
        const stem = raw.endsWith('い') ? raw : `${raw}い`
        text = stem
      }
      segments.push({
        key: piece.key,
        text,
        swappable: true,
        posCategory: POS_SLOT_TO_CATEGORY[piece.key],
      })
      if (piece.key === 'V') verbMorph = 'plain'
      continue
    }

    if (piece.kind === 'lit' || piece.kind === 'naPredicate') {
      segments.push({ key: `lit-${segments.length}`, text: piece.text, swappable: false })
    }
  }

  return segments
}

export function segmentsToJapanese(segments: readonly HeroSegment[]): string {
  return segments.map((s) => s.text).join('')
}

export function pickTemplate(seed: number, level: string): PosTemplate {
  const pool = HERO_POS_TEMPLATES_BY_LEVEL[level] ?? HERO_POS_TEMPLATES_ALL
  return pool[Math.abs(seed) % pool.length]
}

export function rotationSlotForStep(template: PosTemplate, subStep: number): PosSlotKey | null {
  const slots = swappableSlotsInTemplate(template)
  if (slots.length === 0 || subStep <= 0) return null
  return slots[(subStep - 1) % slots.length]
}

export function buildPosSentence(templateId: number, fills: PosFills) {
  const template = getPosTemplate(templateId)
  const segments = compileSegments(template, fills)
  return { template, fills, segments, japanese: segmentsToJapanese(segments) }
}

export function getChangedSegmentKeys(
  prev: readonly HeroSegment[],
  curr: readonly HeroSegment[],
): string[] {
  const changed: string[] = []
  const prevMap = new Map(prev.map((s) => [s.key, s.text]))
  for (const seg of curr) {
    if (seg.swappable && prevMap.get(seg.key) !== seg.text) {
      changed.push(seg.key)
    }
  }
  return changed
}
