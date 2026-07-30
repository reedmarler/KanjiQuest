import { getCuratedEnglish } from './curatedSentenceEngine'
import { getPosTemplate } from '../data/heroPosTemplates'
import type { HeroSentenceFrame } from '../data/heroSentences'
import { isPosFrame } from '../data/heroSentences'
import { normalizeHeroEnglishGloss } from './heroEnglishNormalize'
import { autoGlossFromBack, heroObjectPhrase } from './heroVocabPhrases'
import { isVerbEndingId, type VerbEndingId } from './verbEndings'
import { allCards } from '../data'

/**
 * Curated dicts above only cover the small hand-picked word pools the hero
 * rotator normally draws from. Anything outside that pool (e.g. a vocab word
 * forced into a slot for a one-off example sentence) falls back to an
 * auto-derived gloss from that card's own English meaning, instead of
 * leaking the raw Japanese into the English sentence.
 */
function buildAutoGlossMap(filter: (word: string) => boolean): Record<string, string> {
  const result: Record<string, string> = {}
  for (const card of allCards) {
    if (card.type !== 'vocab') continue
    if (!card.front || !filter(card.front)) continue
    const gloss = autoGlossFromBack(card.back)
    if (gloss) result[card.front] = gloss
  }
  return result
}

const AUTO_VERB_EN = buildAutoGlossMap((word) => word.endsWith('る') || word.endsWith('う') || word.endsWith('く') || word.endsWith('ぐ') || word.endsWith('す') || word.endsWith('つ') || word.endsWith('ぬ') || word.endsWith('ぶ') || word.endsWith('む'))
const AUTO_I_ADJ_EN = buildAutoGlossMap((word) => word.endsWith('い'))
const AUTO_NA_ADJ_EN = buildAutoGlossMap(() => true)
const AUTO_ADV_EN = buildAutoGlossMap(() => true)

const IRREGULAR_PAST_EN: Record<string, string> = {
  eat: 'ate',
  drink: 'drank',
  read: 'read',
  watch: 'watched',
  go: 'went',
  buy: 'bought',
  make: 'made',
  meet: 'met',
  'wait for': 'waited for',
  come: 'came',
  write: 'wrote',
  run: 'ran',
  swim: 'swam',
  sing: 'sang',
  do: 'did',
  see: 'saw',
  say: 'said',
  take: 'took',
}

/** English simple past tense, e.g. "eat" -> "ate", "watch" -> "watched". */
function pastTenseEn(phrase: string): string {
  if (IRREGULAR_PAST_EN[phrase]) return IRREGULAR_PAST_EN[phrase]
  const [base, ...rest] = phrase.split(' ')
  if (!base) return phrase
  let conjugated: string
  if (base.endsWith('e')) conjugated = `${base}d`
  else if (/[^aeiou]y$/.test(base)) conjugated = `${base.slice(0, -1)}ied`
  else conjugated = `${base}ed`
  return [conjugated, ...rest].join(' ')
}

/** English present tense of a (possibly phrasal) verb, e.g. "watch" -> "watches", "wait for" -> "waits for". */
function presentTenseEn(phrase: string): string {
  const [base, ...rest] = phrase.split(' ')
  if (!base) return phrase
  let conjugated: string
  if (/(?:[sxz]|[cs]h)$/.test(base)) conjugated = `${base}es`
  else if (/[^aeiou]y$/.test(base)) conjugated = `${base.slice(0, -1)}ies`
  else conjugated = `${base}s`
  return [conjugated, ...rest].join(' ')
}

/** English present participle, e.g. "make" -> "making", "run" -> "running". */
function presentParticipleEn(phrase: string): string {
  const [base, ...rest] = phrase.split(' ')
  if (!base) return phrase
  let conjugated: string
  if (base.endsWith('ie')) conjugated = `${base.slice(0, -2)}ying`
  else if (/[^aeiou]e$/.test(base) && base !== 'be') conjugated = `${base.slice(0, -1)}ing`
  else conjugated = `${base}ing`
  return [conjugated, ...rest].join(' ')
}

/** "I/you/we/they" take the base verb form; "he/she/it/everyone" take -s. */
function verbFor(subject: string, verb: string): string {
  return usesBaseVerb(subject) ? verb : presentTenseEn(verb)
}

function sayEn(subject: string): string {
  return usesBaseVerb(subject) ? 'say' : 'says'
}

const PRONOUN_EN: Record<string, string> = {
  '私': 'I',
  '君': 'you',
  'あなた': 'you',
  '僕': 'I',
  '俺': 'I',
  '私たち': 'we',
  '彼': 'he',
  '彼女': 'she',
  'みんな': 'everyone',
}

const VERB_EN: Record<string, string> = {
  '食べる': 'eat',
  '飲む': 'drink',
  '読む': 'read',
  '見る': 'watch',
  '行く': 'go',
  '買う': 'buy',
  '作る': 'make',
  '聞く': 'listen to',
  '会う': 'meet',
  '待つ': 'wait for',
  '使う': 'use',
  '話す': 'speak',
  '撮る': 'take photos of',
  '借りる': 'borrow',
  '勉強する': 'study',
  'する': 'do',
  '来る': 'come',
  '帰る': 'go home',
  '書く': 'write',
  '走る': 'run',
  '泳ぐ': 'swim',
  '遊ぶ': 'play',
  '歌う': 'sing',
  '始める': 'start',
  '覚える': 'learn',
  '住む': 'live',
}

const I_ADJ_EN: Record<string, string> = {
  '高い': 'tall',
  '低い': 'short',
  '新しい': 'new',
  '古い': 'old',
  '大きい': 'big',
  '小さい': 'small',
  '難しい': 'difficult',
  '易しい': 'easy',
  '面白い': 'interesting',
  '楽しい': 'fun',
  '忙しい': 'busy',
  '暑い': 'hot',
  '寒い': 'cold',
  '早い': 'early',
  '遅い': 'late',
}

const NA_ADJ_EN: Record<string, string> = {
  '好き': 'favorite',
  '嫌い': 'disliked',
  '上手': 'good at',
  '下手': 'bad at',
  '重要': 'important',
  '大切': 'important',
  '静か': 'quiet',
}

const ADV_EN: Record<string, string> = {
  'よく': 'often',
  '時々': 'sometimes',
  'ときどき': 'sometimes',
  'とても': 'very',
  'すぐ': 'right away',
  'もう': 'already',
  'まだ': 'still',
  '少し': 'a little',
  'たくさん': 'a lot',
  '毎日': 'every day',
  'ゆっくり': 'slowly',
  'はやく': 'quickly',
  'ぜんぜん': 'not at all',
  'あまり': 'not much',
  '必ず': 'certainly',
}

function nounEn(word: string): string {
  return heroObjectPhrase(word) ?? word
}

function verbEn(dict: string): string {
  return VERB_EN[dict] ?? AUTO_VERB_EN[dict] ?? dict
}

function pronounEn(word: string, capital = false): string {
  const base = PRONOUN_EN[word] ?? word
  if (!capital) return base
  return base.charAt(0).toUpperCase() + base.slice(1)
}

function adjEn(word: string, pos: 'i_adj' | 'na_adj'): string {
  if (pos === 'i_adj') return I_ADJ_EN[word] ?? AUTO_I_ADJ_EN[word] ?? word.replace(/い$/, '')
  return NA_ADJ_EN[word] ?? AUTO_NA_ADJ_EN[word] ?? word
}

function advEn(word: string): string {
  return ADV_EN[word] ?? AUTO_ADV_EN[word] ?? word
}

function usesBaseVerb(subject: string) {
  return /^(?:I|you|we|they)\b/i.test(subject)
}

function templateUsesBuiltInGrammar(label: string): boolean {
  return /ように|ことに|ながら|ため|ので|のに|らしい|みたい|すぎる|やすい|にくい|させ|られ|れる|ところ|思う|言う|かどうか|あいだ|うち|あと|前に|べき|はず|違いない|しれない|もらう|くれる|あげる|ばかり|しまう|おく|いけない|ならない|でしょう| か$| よ$| たい$| ない$| た$| です$/.test(
    label,
  )
}

function glossVerbEnding(
  ending: VerbEndingId,
  p: string,
  n: string,
  v: string,
  adv = '',
): string {
  const advBit = adv ? `${adv} ` : ''
  switch (ending) {
    case 'plain':
    case 'masu':
      return `${p} ${advBit}${verbFor(p, v)} ${n}.`
    case 'mashita':
      return `${p} ${advBit}${pastTenseEn(v)} ${n}.`
    case 'masen':
    case 'nai':
      return `${p} does not ${advBit}${v} ${n}.`
    case 'masenDeshita':
    case 'nakatta':
      return `${p} did not ${advBit}${v} ${n}.`
    case 'ta':
      return `${p} ${advBit}${pastTenseEn(v)} ${n}.`
    case 'te':
      return `${p} ${verbFor(p, v)} ${n} (and…).`
    case 'volitional':
      return `${p} will ${advBit}${v} ${n}.`
    case 'tai':
    case 'tagaru':
      return `${p} wants to ${advBit}${v} ${n}.`
    case 'teiru':
      return `${p} is ${presentParticipleEn(v)} ${n}.`
    case 'teita':
      return `${p} was ${presentParticipleEn(v)} ${n}.`
    case 'tearu':
      return `${p} has ${n} ${v}ed.`
    case 'teoku':
      return `${p} ${verbFor(p, v)} ${n} in advance.`
    case 'teiku':
      return `${p} goes on to ${v} ${n}.`
    case 'tekuru':
      return `${p} has been ${presentParticipleEn(v)} ${n}.`
    case 'teshimau':
      return `${p} ends up ${presentParticipleEn(v)} ${n}.`
    case 'teshimatta':
      return `${p} ended up ${presentParticipleEn(v)} ${n}.`
    case 'kotogaDekiru':
      return `${p} can ${v} ${n}.`
    case 'nakerebaNaranai':
    case 'nakutehaIkenai':
      return `${p} must ${v} ${n}.`
    case 'nakutemoIi':
      return `${p} does not have to ${v} ${n}.`
    case 'temoIi':
      return `${p} may ${v} ${n}.`
    case 'tehaIkenai':
      return `${p} must not ${v} ${n}.`
    case 'ba':
    case 'tara':
    case 'nara':
    case 'to':
      return `If ${p} ${verbFor(p, v)} ${n}, …`
    case 'sou':
      return `It looks like ${p} will ${v} ${n}.`
    case 'rashii':
    case 'mitai':
    case 'youda':
      return `It seems ${p} ${verbFor(p, v)} ${n}.`
    case 'youniSuru':
      return `${p} tries to ${v} ${n}.`
    case 'youniNaru':
      return `${p} comes to ${v} ${n}.`
    case 'kotoniSuru':
      return `${p} decides to ${v} ${n}.`
    case 'kotoniNaru':
      return `It is decided that ${p} will ${v} ${n}.`
    case 'tsumori':
      return `${p} intends to ${v} ${n}.`
    case 'yotei':
      return `${p} plans to ${v} ${n}.`
    case 'youtoSuru':
      return `${p} tries to ${v} ${n}.`
    case 'hajimeru':
      return `${p} starts ${presentParticipleEn(v)} ${n}.`
    case 'tsuzukeru':
      return `${p} keeps ${presentParticipleEn(v)} ${n}.`
    case 'owaru':
      return `${p} finishes ${presentParticipleEn(v)} ${n}.`
    case 'sugiru':
      return `${p} ${verbFor(p, v)} ${n} too much.`
    case 'yasui':
      return `${n} is easy to ${v}.`
    case 'nikui':
      return `${n} is hard to ${v}.`
    case 'tokoro':
      return `${p} is about to ${v} ${n}.`
    case 'tokoroDatta':
      return `${p} was just about to ${v} ${n}.`
    default:
      return `${p} ${advBit}${verbFor(p, v)} ${n}.`
  }
}

/** Build English gloss for a POS-template or curated frame */
export function getPosEnglish(frame: HeroSentenceFrame): string {
  if (frame.curatedId) {
    return getCuratedEnglish(frame.curatedId)
  }
  if (!isPosFrame(frame) || !frame.templateId || !frame.fills) {
    return ''
  }

  const template = getPosTemplate(frame.templateId)
  const f = frame.fills
  const p = f.P ? pronounEn(f.P, true) : 'I'
  const n = f.N ? nounEn(f.N) : 'it'
  const n2 = f.N2 ? nounEn(f.N2) : 'it'
  const v = f.V ? verbEn(f.V) : 'do'
  const v2 = f.V2 ? verbEn(f.V2) : v
  const adv = f.Adv ? advEn(f.Adv) : ''
  const iAdj = f.IAdj ? adjEn(f.IAdj.endsWith('い') ? f.IAdj : `${f.IAdj}い`, 'i_adj') : ''
  const naAdj = f.NaAdj ? adjEn(f.NaAdj, 'na_adj') : ''

  const label = template.label
  const vEnd = isVerbEndingId(f.VEnd) ? f.VEnd : null
  if (vEnd && !templateUsesBuiltInGrammar(label)) {
    return glossVerbEnding(vEnd, p, n, v, adv)
  }

  if (label.includes('ように する')) return `${p} tries to ${v} ${n}.`
  if (label.includes('ように なる')) return `${p} ends up ${presentParticipleEn(v)} ${n}.`
  if (label.includes('ことに する')) return `${p} decides to ${v} ${n}.`
  if (label.includes('ことに なる')) return `It is decided that ${p} will ${v} ${n}.`
  if (label.includes('た ばかり')) return `${p} just ${pastTenseEn(v)} ${n}.`
  if (label.includes('て しまう')) return `${p} ends up ${presentParticipleEn(v)} ${n}.`
  if (label.includes('て おく')) return `${p} ${verbFor(p, v)} ${n} in advance.`
  if (label.includes('ながら')) return `${p} ${verbFor(p, v2)} while ${presentParticipleEn(v)} ${n}.`
  if (label.includes('ため に')) return `${p} ${verbFor(p, v2)} in order to ${v} ${n}.`
  if (label.includes('ので')) return `${p} ${verbFor(p, v2)} because ${p} ${verbFor(p, v)} ${n}.`
  if (label.includes('のに')) return `Even though ${p} ${verbFor(p, v)} ${n}, ${p} ${verbFor(p, v2)}.`
  if (label.includes('なら') && label.includes('[V] なら')) return `If ${p} ${verbFor(p, v)} ${n}, ${p} ${verbFor(p, v2)}.`
  if (label.includes('たら') && label.includes('[V] たら')) return `When ${p} ${verbFor(p, v)} ${n}, ${p} ${verbFor(p, v2)}.`
  if (label.includes('ても')) return `Even if ${p} ${verbFor(p, v)} ${n}, ${p} ${verbFor(p, v2)}.`
  if (label.includes(' ば') && label.includes('[V] ば')) return `If ${p} ${verbFor(p, v)} ${n}, ${p} ${verbFor(p, v2)}.`
  if (label.includes(' そう') && !label.includes('しれない')) return `It looks like ${p} will ${v} ${n}.`
  if (label.includes('らしい')) return `It seems ${p} ${pastTenseEn(v)} ${n}.`
  if (label.includes('みたい')) return `It seems like ${p} ${pastTenseEn(v)} ${n}.`
  if (label.includes('すぎる')) return `${p} ${verbFor(p, v)} ${n} too much.`
  if (label.includes('やすい')) return `${n} is easy to ${v}.`
  if (label.includes('にくい')) return `${n} is hard to ${v}.`
  if (label.includes('始める')) return `${p} starts ${presentParticipleEn(v)} ${n}.`
  if (label.includes('続ける')) return `${p} keeps ${presentParticipleEn(v)} ${n}.`
  if (label.includes('終わる')) return `${p} finishes ${presentParticipleEn(v)} ${n}.`
  if (label.includes('ようと する')) return `${p} tries to ${v} ${n}.`
  if (label.includes('かも しれない')) return `${p} might ${v} ${n}.`
  if (label.includes('違いない')) return `${p} must ${v} ${n}.`
  if (label.includes('はず だ')) return `${p} is supposed to ${v} ${n}.`
  if (label.includes('べき だ')) return `${p} should ${v} ${n}.`
  if (label.includes('なければ ならない')) return `${p} must ${v} ${n}.`
  if (label.includes('なくても いい')) return `${p} ${usesBaseVerb(p) ? 'do' : 'does'} not have to ${v} ${n}.`
  if (label.includes('て は いけない')) return `${p} must not ${v} ${n}.`
  if (label.includes('て もらう')) return `${p} has ${n} ${v}ed for them.`
  if (label.includes('て くれる')) return `${n} ${verbFor(p, v)} for ${p}.`
  if (label.includes('て あげる')) return `${p} ${verbFor(p, v)} ${n} for someone.`
  if (label.includes('させられる')) return `${p} is made to ${v} ${n}.`
  if (label.includes(' させる')) return `${p} makes ${n} ${v}.`
  if (label.includes(' られる')) return `${p} is ${v}ed by ${n}.`
  if (label.includes(' れる') && label.includes('に [V]')) return `${p} can ${v} ${n}.`
  if (label.includes('と 思う')) return `${p} thinks ${n} ${verbFor(p, v)}.`
  if (label.includes('と 言う')) return `${p} says ${n} ${verbFor(p, v)}.`
  if (label.includes('か どうか')) return `${p} checks whether ${n} ${verbFor(p, v)}.`
  if (label.includes('ように [V]') && label.includes('が [V]')) return `${p} ${verbFor(p, v2)} so that ${n} ${verbFor(p, v)}.`
  if (label.includes('ような [N]')) return `${p} ${verbFor(p, v)} a ${n2}-like ${n}.`
  if (label.includes('ところ')) return `${p} is just about to ${v} ${n}.`
  if (label.includes('あいだ に')) return `${p} ${verbFor(p, v2)} while ${n} ${verbFor(p, v)}.`
  if (label.includes('うち に')) return `${p} ${verbFor(p, v2)} while ${n} ${verbFor(p, v)}.`
  if (label.includes('あと で')) return `After ${n} ${verbFor(p, v)}, ${p} ${verbFor(p, v2)}.`
  if (label.includes('前 に') && label.includes('が [V]')) return `Before ${n} ${verbFor(p, v)}, ${p} ${verbFor(p, v2)}.`

  if (label.includes('が 好き')) {
    return `${p} likes ${naAdj} ${n}.`
  }
  if (label.includes('[N] は [N] の [N]')) {
    return `${nounEn(f.N!)} is ${n2}'s ${nounEn(f.N3 ?? f.N2!)}.`
  }
  if (label.includes('[N] は [N] が [I-Adj]') && !label.includes('[P]')) {
    return `${nounEn(f.N!)} — ${nounEn(f.N2!)} is ${iAdj}.`
  }
  if (label.includes('[N] が [Adv] [I-Adj]')) {
    return `${nounEn(f.N!)} is ${adv} ${iAdj}.`
  }
  if (label.includes('より [I-Adj]')) {
    return `${p} is more ${iAdj} than ${n}.`
  }
  if (label.includes('を [I-Adj]') && !label.includes('[V]') && !label.includes('く')) {
    return `${p} ${verbFor(p, 'find')} ${n} ${iAdj}.`
  }
  if (label.includes('を [Na-Adj]') && !label.includes('[V]') && !label.includes('に する')) {
    return `${p} ${verbFor(p, 'find')} ${n} ${naAdj}.`
  }
  if (label.includes('に する') || label.includes('に した')) {
    return `${p} makes ${n} ${naAdj}.`
  }
  if (label.includes('く した')) {
    return `${p} made ${n} more ${iAdj}.`
  }
  if (label.includes('が [I-Adj]') && !label.includes('[V]')) {
    return `${p} ${sayEn(p)} ${n} is ${adv ? `${adv} ` : ''}${iAdj}.`
  }
  if (label.includes('が [Na-Adj]') && !label.includes('[V]')) {
    return `${p} ${sayEn(p)} ${n} is ${adv ? `${adv} ` : ''}${naAdj}.`
  }
  if (label.includes('たい')) {
    const advBit = adv ? `${adv} ` : ''
    if (label.includes('に [V]')) return `${p} wants to ${advBit}${v} at ${n}.`
    if (label.includes('で [V]')) return `${p} wants to ${advBit}${v} at ${n}.`
    if (label.includes('と [V]')) return `${p} wants to ${advBit}${v} with ${n}.`
    return `${p} wants to ${advBit}${v} ${n}.`
  }
  if (label.includes('ない')) {
    const advBit = adv ? `${adv} ` : ''
    return `${p} ${usesBaseVerb(p) ? 'do' : 'does'} not ${advBit}${v} ${n}.`
  }
  if (label.includes(' た') && !label.includes('たい')) {
    const advBit = adv ? `${adv} ` : ''
    return `${p} ${advBit}${pastTenseEn(v)} ${n}.`
  }
  if (label.includes('です') && !label.includes('でしょう')) {
    const advBit = adv ? `${adv} ` : ''
    if (label.includes('に [V]')) return `${p} ${advBit}${verbFor(p, v)} at ${n}.`
    if (label.includes('で [V]')) return `${p} ${advBit}${verbFor(p, v)} at ${n}.`
    if (label.includes('と [V]')) return `${p} ${advBit}${verbFor(p, v)} with ${n}.`
    if (label.includes('が [I-Adj]')) return `${p} ${sayEn(p)} ${n} is ${iAdj}.`
    if (label.includes('が [Na-Adj]')) return `${p} ${sayEn(p)} ${n} is ${naAdj}.`
    return `${p} ${advBit}${verbFor(p, v)} ${n}.`
  }
  if (label.includes('でしょう')) {
    return `${p} will probably ${v} ${n}.`
  }
  if (label.includes(' か')) {
    return `Does ${p} ${adv ? `${adv} ` : ''}${v} ${n}?`
  }
  if (label.includes(' よ')) {
    return `${p} ${adv ? `${adv} ` : ''}${verbFor(p, v)} ${n}!`
  }
  if (label.includes('く [V]')) {
    return adv
      ? `${p} ${verbFor(p, v)} ${n} ${adv} because it is ${iAdj}.`
      : `${p} ${verbFor(p, v)} ${n} because it is ${iAdj}.`
  }
  if (label.includes('Na-Adj] に [V]') || label.includes('Na-Adj] な [N] を [V]')) {
    return `${p} ${verbFor(p, v)} ${naAdj} ${n}.`
  }
  if (label.includes('に [N] を [V]') || label.includes('で [N] を [V]')) {
    const place = label.includes('に') ? 'at' : 'at'
    return `${p} ${verbFor(p, v)} ${n2} ${place} ${n}.`
  }
  if (label.includes('に [V]')) {
    if (f.V === '住む') return `${p} ${usesBaseVerb(p) ? 'live' : 'lives'} in ${n}.`
    return `${p} ${adv ? `${adv} ` : ''}${verbFor(p, v)} to ${n}.`
  }
  if (label.includes('で [V]')) {
    return `${p} ${adv ? `${adv} ` : ''}${verbFor(p, v)} at ${n}.`
  }
  if (label.includes('と [V]')) {
    return `${p} ${adv ? `${adv} ` : ''}${verbFor(p, v)} with ${n}.`
  }
  if (label.includes('から [V]')) {
    return `${p} ${verbFor(p, v)} from ${n}.`
  }
  if (label.includes('まで [V]')) {
    return `${p} ${verbFor(p, v)} until ${n}.`
  }

  const advBit = adv ? `${adv} ` : ''
  return `${p} ${advBit}${verbFor(p, v)} ${n}.`
}

export function getPosEnglishNormalized(frame: HeroSentenceFrame): string {
  return normalizeHeroEnglishGloss(getPosEnglish(frame))
}
