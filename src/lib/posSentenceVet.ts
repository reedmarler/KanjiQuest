import type { PosSlotKey, PosTemplate } from '../data/heroPosTemplates'
import { conjugateVerb } from './posSentenceConjugate'
import { wordFitsPredicate } from './heroWordVerbFit'

export type PosFills = Partial<Record<PosSlotKey, string>>

const PEOPLE = new Set(['友達', '先生', '恋人', '両親', '彼', '彼女', '私', 'みんな'])
const PLACES = new Set([
  '京都', '東京', '大阪', '公園', '駅', '空港', '銀行', '病院', '図書館',
  '美術館', '動物園', '港', '島', '町', '村', '海', '温泉', '神社', '寺',
  'レストラン', 'ホテル', '学校', '会社', '教室', '市場', '庭', '川', '山',
])
const EVENT_NOUNS = new Set(['雨', '春', '夏', '秋', '冬', '仕事', '試験', '宿題'])
const ANIMATE_GA = new Set([...PEOPLE, ...EVENT_NOUNS, '犬', '猫', '鳥'])

const NI_VERBS = new Set(['行く', '来る', '会う', '帰る'])

/** Each noun slot paired with a particle and verb slot (parsed from template pieces) */
export interface VerbObjectBinding {
  nounSlot: 'N' | 'N2' | 'N3'
  particle: 'を' | 'に'
  verbSlot: 'V' | 'V2'
}

/** Walk template pieces — detect を/に + verb bindings regardless of adverbs between */
export function getVerbObjectBindings(template: PosTemplate): VerbObjectBinding[] {
  const bindings: VerbObjectBinding[] = []
  let pendingWoNoun: 'N' | 'N2' | 'N3' | null = null
  let pendingNiNoun: 'N' | 'N2' | 'N3' | null = null
  let lastNoun: 'N' | 'N2' | 'N3' | null = null

  for (const piece of template.pieces) {
    if (piece.kind === 'slot' && (piece.key === 'N' || piece.key === 'N2' || piece.key === 'N3')) {
      lastNoun = piece.key
    }
    if (piece.kind === 'lit' && piece.text === 'を' && lastNoun) {
      pendingWoNoun = lastNoun
      pendingNiNoun = null
    }
    if (piece.kind === 'lit' && piece.text === 'に' && lastNoun) {
      pendingNiNoun = lastNoun
      pendingWoNoun = null
    }
    if (piece.kind === 'slot' && (piece.key === 'V' || piece.key === 'V2')) {
      if (pendingWoNoun) {
        bindings.push({ nounSlot: pendingWoNoun, particle: 'を', verbSlot: piece.key })
        pendingWoNoun = null
      }
      if (pendingNiNoun) {
        bindings.push({ nounSlot: pendingNiNoun, particle: 'に', verbSlot: piece.key })
        pendingNiNoun = null
      }
    }
  }
  return bindings
}

function verbMasu(dict: string): string {
  return conjugateVerb(dict, 'desu')
}

export function fitsWo(noun: string, verb: string): boolean {
  return wordFitsPredicate(noun, verbMasu(verb), 'を')
}

export function fitsNi(noun: string, verb: string): boolean {
  return wordFitsPredicate(noun, verbMasu(verb), 'に')
}

function isPerson(noun: string | undefined): boolean {
  return Boolean(noun && PEOPLE.has(noun))
}

function isPlace(noun: string | undefined): boolean {
  return Boolean(noun && PLACES.has(noun))
}

function isAnimateGaSubject(noun: string | undefined): boolean {
  return Boolean(noun && ANIMATE_GA.has(noun))
}

function bindingIsValid(binding: VerbObjectBinding, fills: PosFills): boolean {
  const noun = fills[binding.nounSlot]
  const verb = fills[binding.verbSlot] ?? fills.V
  if (!noun || !verb) return false
  if (binding.particle === 'を') {
    if (NI_VERBS.has(verb)) return false
    return fitsWo(noun, verb)
  }
  if (NI_VERBS.has(verb)) return fitsNi(noun, verb)
  if (verb === '待つ') return isPerson(noun) || isPlace(noun)
  return true
}

function passesGrammarTemplateRules(template: PosTemplate, fills: PosFills): boolean {
  const id = template.id
  const n = fills.N
  const v = fills.V
  const v2 = fills.V2 ?? fills.V

  if (id >= 134 && id <= 140) return Boolean(n && isPerson(n))
  if (id === 141 || id === 142) return Boolean(n && (isAnimateGaSubject(n) || EVENT_NOUNS.has(n)))
  if (id >= 143 && id <= 150) {
    if (!n || !v || (!isAnimateGaSubject(n) && !EVENT_NOUNS.has(n))) return false
    if (v2 && v2 === v && (id === 108 || id >= 109)) return false
    return true
  }
  if (id === 108 && v && v === v2) return false
  return true
}

/** Whether every verb–object binding in the template is satisfied */
export function posFillsAreValid(template: PosTemplate, fills: PosFills): boolean {
  const requiredSlots = template.pieces
    .filter((piece): piece is Extract<typeof piece, { kind: 'slot' }> => piece.kind === 'slot')
    .map((piece) => piece.key)
  if (requiredSlots.some((slot) => !fills[slot])) return false
  if (!passesGrammarTemplateRules(template, fills)) return false

  const bindings = getVerbObjectBindings(template)
  if (bindings.length > 0) {
    return bindings.every((b) => bindingIsValid(b, fills))
  }

  const label = template.label
  if (label.includes('[N] が [V]') && !label.includes('を')) {
    return isAnimateGaSubject(fills.N) || EVENT_NOUNS.has(fills.N!)
  }
  if (label.includes('で [V]') && !label.includes('を [V]')) {
    if (!isPlace(fills.N)) return false
    const n2 = fills.N2 ?? fills.N!
    if (!n2 || !fills.V) return false
    return fitsWo(n2, fills.V)
  }
  if (label.includes('と [V]') && fills.V === '会う') {
    return isPerson(fills.N)
  }

  return true
}

export function verbsForTemplate(
  template: PosTemplate,
  allVerbs: readonly string[],
  fills?: PosFills,
  verbSlot: 'V' | 'V2' = 'V',
): string[] {
  const bindings = getVerbObjectBindings(template)
  const binding = bindings.find((b) => b.verbSlot === verbSlot)
  if (binding && fills?.[binding.nounSlot]) {
    const noun = fills[binding.nounSlot]!
    if (binding.particle === 'を') {
      return allVerbs.filter((v) => !NI_VERBS.has(v) && fitsWo(noun, v))
    }
    return allVerbs.filter((v) => fitsNi(noun, v) || (v === '待つ' && (isPerson(noun) || isPlace(noun))))
  }

  const label = template.label
  if (label.includes('に [V]') && !label.includes('を [V]')) {
    return allVerbs.filter((v) => NI_VERBS.has(v) || v === '待つ' || v === 'する' || v === '勉強する')
  }
  if (label.includes('を') && label.includes('[V]')) {
    return allVerbs.filter((v) => !NI_VERBS.has(v))
  }
  if (label.includes('[N] が [V]')) {
    return allVerbs.filter((v) => !['帰る', '来る', '行く'].includes(v))
  }
  if (template.id >= 134 && template.id <= 140) {
    return allVerbs.filter((v) => !NI_VERBS.has(v))
  }
  return [...allVerbs]
}

export function nounsForTemplateSlot(
  template: PosTemplate,
  slot: 'N' | 'N2' | 'N3',
  fills: PosFills,
  allNouns: readonly string[],
): string[] {
  const bindings = getVerbObjectBindings(template)
  const asObject = bindings.find((b) => b.nounSlot === slot && b.particle === 'を')
  if (asObject) {
    const verb = fills[asObject.verbSlot] ?? fills.V
    if (verb) return allNouns.filter((n) => fitsWo(n, verb))
  }
  const asTarget = bindings.find((b) => b.nounSlot === slot && b.particle === 'に')
  if (asTarget) {
    const verb = fills[asTarget.verbSlot] ?? fills.V
    if (verb && NI_VERBS.has(verb)) return allNouns.filter((n) => fitsNi(n, verb))
    if (verb === '待つ') return allNouns.filter((n) => isPerson(n) || isPlace(n))
  }

  if (slot === 'N') {
    if (template.id >= 134 && template.id <= 140) return allNouns.filter((n) => isPerson(n))
    if (template.label.includes('[N] が [V]') || (template.id >= 141 && template.id <= 150)) {
      return allNouns.filter((n) => isAnimateGaSubject(n) || EVENT_NOUNS.has(n))
    }
    if (template.label.includes('で [V]')) return allNouns.filter((n) => isPlace(n))
    if (template.label.includes('と [V]') && fills.V === '会う') return allNouns.filter((n) => isPerson(n))
  }

  if (slot === 'N2' && template.label.includes('で [N] を [V]') && fills.V) {
    return allNouns.filter((n) => fitsWo(n, fills.V!))
  }

  return [...allNouns]
}
