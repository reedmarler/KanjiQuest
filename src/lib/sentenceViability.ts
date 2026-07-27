import type { PosTemplate } from '../data/heroPosTemplates'
import { HERO_SENTENCE_VIABILITY } from '../data/heroSentenceViability'
import type { PosFills } from './posSentenceVet'

const FOOD_DRINK = new Set([
  'お茶', 'コーヒー', '寿司', 'パン', 'リンゴ', 'コーヒー', 'ジュース', 'ミルク',
  '魚', '肉', '米', 'ケーキ', 'ラーメン', 'ピザ', '料理',
])

const PEOPLE = new Set(['友達', '先生', '恋人', '両親', '彼', '彼女', '私', 'みんな'])
const PLACES = new Set([
  '京都', '東京', '大阪', '公園', '駅', '図書館', '学校', '会社', '病院', '海', '山',
  'レストラン', 'ホテル', '教室', '庭', '川',
])
const EVENTS = new Set(['雨', '春', '夏', '秋', '冬', '仕事', '試験', '宿題'])
const STUDY_NOUNS = new Set([
  '漢字', '日本語', '数学', '科学', '歴史', '宿題', '試験', '仕事',
])
const SIZE_NOUNS = new Set([
  '本', '雑誌', '新聞', '小説', '漫画', '映画', '写真', '料理', 'パン', 'リンゴ',
  '寿司', 'コーヒー', 'お茶', '魚', '肉', '米', '花', '車', '電車', '犬', '猫', '鳥',
  '図書館', '学校', '会社', '公園', '駅', '病院', '京都', '東京', '海', '山',
])

function normalizeAdj(raw: string | undefined): string {
  if (!raw) return ''
  return raw.endsWith('い') ? raw : `${raw}い`
}

/** Semantic i-adjective + noun pairing (が / を adjective frames) */
function iAdjFitsNoun(adj: string, noun: string): boolean {
  const base = normalizeAdj(adj)
  if (!base || !noun) return true

  if (base === '早い' || base === '遅い') {
    return PEOPLE.has(noun) || EVENTS.has(noun) || ['電車', '仕事', '試験', '宿題', '授業'].includes(noun)
  }
  if (base === '美味しい') {
    return FOOD_DRINK.has(noun) || ['料理', 'パン', '寿司'].includes(noun)
  }
  if (base === '大きい' || base === '小さい') {
    return SIZE_NOUNS.has(noun)
  }
  if (base === '忙しい') {
    return PEOPLE.has(noun) || ['先生', '友達', '仕事'].includes(noun)
  }
  if (base === '暑い' || base === '寒い') {
    return PLACES.has(noun) || EVENTS.has(noun) || ['海', '山', '夏', '冬'].includes(noun)
  }
  if (base === '難しい' || base === '易しい') {
    return STUDY_NOUNS.has(noun) || PEOPLE.has(noun) || ['漢字', '日本語', '数学', '科学', '歴史'].includes(noun)
  }
  if (base === '楽しい' || base === '面白い') {
    return !FOOD_DRINK.has(noun) || noun === '料理'
  }
  return true
}

function naAdjFitsNoun(adj: string | undefined, noun: string): boolean {
  if (!adj || !noun) return true
  if (adj === '上手' || adj === '下手') {
    return STUDY_NOUNS.has(noun) || ['日本語', '漢字', '数学', '料理', 'ピアノ', 'テニス'].includes(noun)
  }
  if (adj === '静か') {
    return PLACES.has(noun) || ['図書館', '公園', '教室', '病院'].includes(noun)
  }
  return true
}

/** Rule-based semantic pass when LLM cache has no entry */
export function passesSemanticHeuristics(template: PosTemplate, fills: PosFills): boolean {
  const label = template.label
  const n = fills.N
  const n2 = fills.N2
  const iAdj = fills.IAdj
  const naAdj = fills.NaAdj

  if (label.includes('が [I-Adj]') || label.includes('を [I-Adj]')) {
    const subject = label.includes('[N] は [N] が') ? n2 : n
    if (subject && iAdj && !iAdjFitsNoun(iAdj, subject)) return false
  }

  if (label.includes('を [I-Adj]') && n && iAdj && !iAdjFitsNoun(iAdj, n)) {
    return false
  }

  if (label.includes('[Na-Adj]') && n && naAdj && !naAdjFitsNoun(naAdj, n)) {
    return false
  }

  if (label.includes('が [Na-Adj]') && n && naAdj && !naAdjFitsNoun(naAdj, n)) {
    return false
  }

  return true
}

export type ViabilityVerdict = 'approved' | 'rejected' | 'unknown'

export function getViabilityVerdict(japanese: string): ViabilityVerdict {
  const hit = HERO_SENTENCE_VIABILITY[japanese]
  if (hit === true) return 'approved'
  if (hit === false) return 'rejected'
  return 'unknown'
}

/** Full check: LLM cache (if present) + semantic heuristics */
export function iAdjectivesForNoun(all: readonly string[], noun: string | undefined): string[] {
  if (!noun) return [...all]
  return all.filter((adj) => iAdjFitsNoun(adj, noun))
}

export function naAdjectivesForNoun(all: readonly string[], noun: string | undefined): string[] {
  if (!noun) return [...all]
  return all.filter((adj) => naAdjFitsNoun(adj, noun))
}

export function sentenceIsViable(
  japanese: string,
  template: PosTemplate,
  fills: PosFills,
): boolean {
  const verdict = getViabilityVerdict(japanese)
  if (verdict === 'approved') return true
  if (verdict === 'rejected') return false
  return passesSemanticHeuristics(template, fills)
}
