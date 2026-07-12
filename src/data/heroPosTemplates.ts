import type { PosCategory } from '../lib/japanesePos/types'
import type { VerbEndingId } from '../lib/verbEndings'

/** Swappable slot keys used across templates */
export type PosSlotKey = 'P' | 'N' | 'N2' | 'N3' | 'V' | 'V2' | 'VEnd' | 'V2End' | 'Adv' | 'IAdj' | 'NaAdj'

/** Surface form for a verb slot before grammar suffixes */
export type VerbForm =
  | 'plain'
  | 'te'
  | 'ta'
  | 'ba'
  | 'tara'
  | 'nara'
  | 'stem'
  | 'tai'
  | 'nai'
  | 'desu'
  | 'passive'
  | 'causative'
  | 'causativePassive'
  | 'potential'
  | 'volitional'

export type VerbMorph =
  | 'plain'
  | 'nai'
  | 'ta'
  | 'tai'
  | 'desu'
  | 'deshou'
  | 'ka'
  | 'yo'

export type TemplatePiece =
  | { kind: 'slot'; key: PosSlotKey; form?: VerbForm }
  | { kind: 'lit'; text: string }
  | { kind: 'vmorph'; morph: VerbMorph }
  | { kind: 'imorph'; suffix: 'い' | 'く' }
  | { kind: 'namorph'; suffix: 'な' | 'に' }
  | { kind: 'naPredicate'; text: '好き' | 'です' }

export interface PosTemplate {
  id: number
  label: string
  pieces: TemplatePiece[]
}

export const POS_SLOT_TO_CATEGORY: Record<PosSlotKey, PosCategory> = {
  P: 'pronoun',
  N: 'noun',
  N2: 'noun',
  N3: 'noun',
  V: 'verb',
  V2: 'verb',
  VEnd: 'verb',
  V2End: 'verb',
  Adv: 'adverb',
  IAdj: 'i_adj',
  NaAdj: 'na_adj',
}

export const SLOT_ROTATION_ORDER: PosSlotKey[] = [
  'P', 'N', 'N2', 'N3', 'Adv', 'IAdj', 'NaAdj', 'V', 'VEnd', 'V2', 'V2End',
]

function p(
  id: number,
  label: string,
  ...pieces: TemplatePiece[]
): PosTemplate {
  return { id, label, pieces }
}

function v(morph: VerbMorph): TemplatePiece {
  return { kind: 'vmorph', morph }
}

function s(key: PosSlotKey, form?: VerbForm): TemplatePiece {
  return form ? { kind: 'slot', key, form } : { kind: 'slot', key }
}

/** [P] は [N] を [V](form) + trailing pieces */
function pHaNwoVForm(vForm: VerbForm, ...trail: TemplatePiece[]): TemplatePiece[] {
  return [s('P'), lit('は'), s('N'), lit('を'), s('V', vForm), ...trail]
}

/** [P] は [N] に [V](form) + trailing pieces */
function pHaNniVForm(vForm: VerbForm, ...trail: TemplatePiece[]): TemplatePiece[] {
  return [s('P'), lit('は'), s('N'), lit('に'), s('V', vForm), ...trail]
}

/** [P] は [N] が [V](form) + trailing pieces */
function pHaNgaVForm(vForm: VerbForm, ...trail: TemplatePiece[]): TemplatePiece[] {
  return [s('P'), lit('は'), s('N'), lit('が'), s('V', vForm), ...trail]
}

function lit(text: string): TemplatePiece {
  return { kind: 'lit', text }
}

/** [P] は [N] を [V] */
function pHaNwoV(morph: VerbMorph = 'plain', adv = false): TemplatePiece[] {
  const out: TemplatePiece[] = [s('P'), lit('は'), s('N'), lit('を')]
  if (adv) out.push(s('Adv'))
  out.push(s('V'), v(morph))
  return out
}

/** [P] は [N] に/で/と [V] */
function pHaNxv(
  particle: 'に' | 'で' | 'と',
  morph: VerbMorph = 'plain',
  adv = false,
): TemplatePiece[] {
  const out: TemplatePiece[] = [s('P'), lit('は'), s('N'), lit(particle)]
  if (adv) out.push(s('Adv'))
  out.push(s('V'), v(morph))
  return out
}

/** [P] は [N] が [I-Adj] */
function pHaNgaIAdj(suffix: 'い' | '' = 'い', adv = false): TemplatePiece[] {
  const out: TemplatePiece[] = [s('P'), lit('は'), s('N'), lit('が')]
  if (adv) out.push(s('Adv'))
  out.push(s('IAdj'))
  if (suffix) out.push({ kind: 'imorph', suffix })
  return out
}

/** [P] は [N] が [Na-Adj] */
function pHaNgaNaAdj(suffix: 'です' | 'か' | 'よ' | '' = 'です', adv = false): TemplatePiece[] {
  const out: TemplatePiece[] = [s('P'), lit('は'), s('N'), lit('が')]
  if (adv) out.push(s('Adv'))
  out.push(s('NaAdj'))
  if (suffix === 'です') out.push({ kind: 'naPredicate', text: 'です' })
  else if (suffix === 'か') out.push(lit('か'))
  else if (suffix === 'よ') out.push(lit('よ'))
  return out
}

/** [P] は [N] を [Adv] [V] with fixed adverb literal */
function pHaNwoAdvLitV(advLit: string, morph: VerbMorph = 'plain'): TemplatePiece[] {
  return [s('P'), lit('は'), s('N'), lit('を'), lit(advLit), s('V'), v(morph)]
}

/** [P] は [N] を とても [Adj] */
function pHaNwoTotemoAdj(adj: 'IAdj' | 'NaAdj'): TemplatePiece[] {
  return [s('P'), lit('は'), s('N'), lit('を'), lit('とても'), s(adj)]
}

export const HERO_POS_TEMPLATES: PosTemplate[] = [
  p(1, '[P] は [N] を [V]', ...pHaNwoV()),
  p(2, '[P] は [N] を [Adv] [V]', ...pHaNwoV('plain', true)),
  p(3, '[N] は [N] が [I-Adj]', s('N'), lit('は'), s('N2'), lit('が'), s('IAdj')),
  p(4, '[P] は [Na-Adj] な [N] が 好き', s('P'), lit('は'), s('NaAdj'), { kind: 'namorph', suffix: 'な' }, s('N'), lit('が'), { kind: 'naPredicate', text: '好き' }),
  p(5, '[P] は [N] に [V]', ...pHaNxv('に')),
  p(6, '[P] は [N] で [V]', ...pHaNxv('で')),
  p(7, '[P] は [N] と [V]', ...pHaNxv('と')),
  p(8, '[P] は [N] を [I-Adj] く [V]', s('P'), lit('は'), s('N'), lit('を'), s('IAdj'), { kind: 'imorph', suffix: 'く' }, s('V')),
  p(9, '[P] は [Na-Adj] に [V]', s('P'), lit('は'), s('NaAdj'), { kind: 'namorph', suffix: 'に' }, s('V')),
  p(10, '[N] が [Adv] [I-Adj]', s('N'), lit('が'), s('Adv'), s('IAdj')),
  p(11, '[P] は [N] を [Adv] [V] たい', ...pHaNwoV('tai', true)),
  p(12, '[P] は [N] に [N] を [V]', s('P'), lit('は'), s('N'), lit('に'), s('N2'), lit('を'), s('V')),
  p(13, '[P] は [N] から [V]', s('P'), lit('は'), s('N'), lit('から'), s('V')),
  p(14, '[P] は [N] まで [V]', s('P'), lit('は'), s('N'), lit('まで'), s('V')),
  p(15, '[P] は [N] より [I-Adj]', s('P'), lit('は'), s('N'), lit('より'), s('IAdj')),
  p(16, '[P] は [N] と [N] を [V]', s('P'), lit('は'), s('N'), lit('と'), s('N2'), lit('を'), s('V')),
  p(17, '[P] は [N] を [Na-Adj] に する', s('P'), lit('は'), s('N'), lit('を'), s('NaAdj'), { kind: 'namorph', suffix: 'に' }, lit('する')),
  p(18, '[P] は [N] が [Adv] [V]', s('P'), lit('は'), s('N'), lit('が'), s('Adv'), s('V')),
  p(19, '[N] は [N] の [N]', s('N'), lit('は'), s('N2'), lit('の'), s('N3')),
  p(20, '[P] は [Adv] [N] を [V]', s('P'), lit('は'), s('Adv'), s('N'), lit('を'), s('V')),
  p(21, '[P] は [N] を [V] ない', ...pHaNwoV('nai')),
  p(22, '[P] は [N] を [Adv] [V] ない', ...pHaNwoV('nai', true)),
  p(23, '[P] は [N] を [V] た', ...pHaNwoV('ta')),
  p(24, '[P] は [N] を [Adv] [V] た', ...pHaNwoV('ta', true)),
  p(25, '[P] は [N] が [I-Adj] い', ...pHaNgaIAdj('い')),
  p(26, '[P] は [Na-Adj] な [N] を [V]', s('P'), lit('は'), s('NaAdj'), { kind: 'namorph', suffix: 'な' }, s('N'), lit('を'), s('V')),
  p(27, '[P] は [N] を [I-Adj]', s('P'), lit('は'), s('N'), lit('を'), s('IAdj')),
  p(28, '[P] は [N] を [Na-Adj]', s('P'), lit('は'), s('N'), lit('を'), s('NaAdj')),
  p(29, '[P] は [N] に [Adv] [V]', ...pHaNxv('に', 'plain', true)),
  p(30, '[P] は [N] で [Adv] [V]', ...pHaNxv('で', 'plain', true)),
  p(31, '[P] は [N] と [Adv] [V]', ...pHaNxv('と', 'plain', true)),
  p(32, '[P] は [Adv] [N] に [V]', s('P'), lit('は'), s('Adv'), s('N'), lit('に'), s('V')),
  p(33, '[P] は [Adv] [N] で [V]', s('P'), lit('は'), s('Adv'), s('N'), lit('で'), s('V')),
  p(34, '[P] は [N] を とても [I-Adj]', ...pHaNwoTotemoAdj('IAdj')),
  p(35, '[P] は [N] を とても [Na-Adj]', ...pHaNwoTotemoAdj('NaAdj')),
  p(36, '[P] は [N] が とても [I-Adj]', s('P'), lit('は'), s('N'), lit('が'), lit('とても'), s('IAdj')),
  p(37, '[P] は [N] が とても [Na-Adj]', s('P'), lit('は'), s('N'), lit('が'), lit('とても'), s('NaAdj')),
  p(38, '[P] は [N] を 少し [V]', ...pHaNwoAdvLitV('少し')),
  p(39, '[P] は [N] を よく [V]', ...pHaNwoAdvLitV('よく')),
  p(40, '[P] は [N] を たくさん [V]', ...pHaNwoAdvLitV('たくさん')),
  p(41, '[P] は [N] を もう [V]', ...pHaNwoAdvLitV('もう')),
  p(42, '[P] は [N] を まだ [V]', ...pHaNwoAdvLitV('まだ')),
  p(43, '[P] は [N] を すぐ [V]', ...pHaNwoAdvLitV('すぐ')),
  p(44, '[P] は [N] を ゆっくり [V]', ...pHaNwoAdvLitV('ゆっくり')),
  p(45, '[P] は [N] を はやく [V]', ...pHaNwoAdvLitV('はやく')),
  p(46, '[P] は [N] を ときどき [V]', ...pHaNwoAdvLitV('ときどき')),
  p(47, '[P] は [N] を よく [Adv] [V]', s('P'), lit('は'), s('N'), lit('を'), lit('よく'), s('Adv'), s('V')),
  p(48, '[P] は [N] を ぜんぜん [V] ない', ...pHaNwoAdvLitV('ぜんぜん', 'nai')),
  p(49, '[P] は [N] を あまり [V] ない', ...pHaNwoAdvLitV('あまり', 'nai')),
  p(50, '[P] は [N] を 必ず [V]', ...pHaNwoAdvLitV('必ず')),
  p(51, '[P] は [N] に [N] を [Adv] [V]', s('P'), lit('は'), s('N'), lit('に'), s('N2'), lit('を'), s('Adv'), s('V')),
  p(52, '[P] は [N] で [N] を [V]', s('P'), lit('は'), s('N'), lit('で'), s('N2'), lit('を'), s('V')),
  p(53, '[P] は [N] と [N] を [Adv] [V]', s('P'), lit('は'), s('N'), lit('と'), s('N2'), lit('を'), s('Adv'), s('V')),
  p(54, '[P] は [N] に [N] が [V]', s('P'), lit('は'), s('N'), lit('に'), s('N2'), lit('が'), s('V')),
  p(55, '[P] は [N] で [N] が [V]', s('P'), lit('は'), s('N'), lit('で'), s('N2'), lit('が'), s('V')),
  p(56, '[P] は [N] に [N] が [I-Adj]', s('P'), lit('は'), s('N'), lit('に'), s('N2'), lit('が'), s('IAdj')),
  p(57, '[P] は [N] に [N] が [Na-Adj]', s('P'), lit('は'), s('N'), lit('に'), s('N2'), lit('が'), s('NaAdj')),
  p(58, '[P] は [N] を [N] に [V]', s('P'), lit('は'), s('N'), lit('を'), s('N2'), lit('に'), s('V')),
  p(59, '[P] は [N] を [N] で [V]', s('P'), lit('は'), s('N'), lit('を'), s('N2'), lit('で'), s('V')),
  p(60, '[P] は [N] と [N] に [V]', s('P'), lit('は'), s('N'), lit('と'), s('N2'), lit('に'), s('V')),
  p(61, '[P] は [N] と [N] で [V]', s('P'), lit('は'), s('N'), lit('と'), s('N2'), lit('で'), s('V')),
  p(62, '[P] は [N] に [Adv] [I-Adj]', s('P'), lit('は'), s('N'), lit('に'), s('Adv'), s('IAdj')),
  p(63, '[P] は [N] で [Adv] [I-Adj]', s('P'), lit('は'), s('N'), lit('で'), s('Adv'), s('IAdj')),
  p(64, '[P] は [N] に とても [Na-Adj]', s('P'), lit('は'), s('N'), lit('に'), lit('とても'), s('NaAdj')),
  p(65, '[P] は [N] で とても [Na-Adj]', s('P'), lit('は'), s('N'), lit('で'), lit('とても'), s('NaAdj')),
  p(66, '[P] は [N] が [I-Adj] く [V]', s('P'), lit('は'), s('N'), lit('が'), s('IAdj'), { kind: 'imorph', suffix: 'く' }, s('V')),
  p(67, '[P] は [N] が [Na-Adj] に [V]', s('P'), lit('は'), s('N'), lit('が'), s('NaAdj'), { kind: 'namorph', suffix: 'に' }, s('V')),
  p(68, '[P] は [N] を [I-Adj] く した', s('P'), lit('は'), s('N'), lit('を'), s('IAdj'), { kind: 'imorph', suffix: 'く' }, lit('した')),
  p(69, '[P] は [N] を [Na-Adj] に した', s('P'), lit('は'), s('N'), lit('を'), s('NaAdj'), { kind: 'namorph', suffix: 'に' }, lit('した')),
  p(70, '[P] は [N] を [Adv] [I-Adj]', s('P'), lit('は'), s('N'), lit('を'), s('Adv'), s('IAdj')),
  p(71, '[P] は [N] を [Adv] [Na-Adj]', s('P'), lit('は'), s('N'), lit('を'), s('Adv'), s('NaAdj')),
  p(72, '[P] は [N] が [Adv] [I-Adj]', ...pHaNgaIAdj('', true)),
  p(73, '[P] は [N] が [Adv] [Na-Adj]', s('P'), lit('は'), s('N'), lit('が'), s('Adv'), s('NaAdj')),
  p(74, '[P] は [N] を [I-Adj] く [V] たい', s('P'), lit('は'), s('N'), lit('を'), s('IAdj'), { kind: 'imorph', suffix: 'く' }, s('V'), v('tai')),
  p(75, '[P] は [N] を [Na-Adj] に [V] たい', s('P'), lit('は'), s('N'), lit('を'), s('NaAdj'), { kind: 'namorph', suffix: 'に' }, s('V'), v('tai')),
  p(76, '[P] は [N] に [V] たい', ...pHaNxv('に', 'tai')),
  p(77, '[P] は [N] で [V] たい', ...pHaNxv('で', 'tai')),
  p(78, '[P] は [N] と [V] たい', ...pHaNxv('と', 'tai')),
  p(79, '[P] は [N] を [Adv] [V] たい', ...pHaNwoV('tai', true)),
  p(80, '[P] は [N] が [I-Adj] い です', ...pHaNgaIAdj('い'), lit('です')),
  p(81, '[P] は [N] が [Na-Adj] です', ...pHaNgaNaAdj('です')),
  p(82, '[P] は [N] を [V] です', ...pHaNwoV('desu')),
  p(83, '[P] は [N] に [V] です', ...pHaNxv('に', 'desu')),
  p(84, '[P] は [N] で [V] です', ...pHaNxv('で', 'desu')),
  p(85, '[P] は [N] と [V] です', ...pHaNxv('と', 'desu')),
  p(86, '[P] は [N] を [Adv] [V] です', ...pHaNwoV('desu', true)),
  p(87, '[P] は [N] を [V] でしょう', ...pHaNwoV('deshou')),
  p(88, '[P] は [N] を [Adv] [V] でしょう', ...pHaNwoV('deshou', true)),
  p(89, '[P] は [N] が [I-Adj] でしょう', s('P'), lit('は'), s('N'), lit('が'), s('IAdj'), v('deshou')),
  p(90, '[P] は [N] が [Na-Adj] でしょう', s('P'), lit('は'), s('N'), lit('が'), s('NaAdj'), v('deshou')),
  p(91, '[P] は [N] を [V] か', ...pHaNwoV('ka')),
  p(92, '[P] は [N] を [Adv] [V] か', ...pHaNwoV('ka', true)),
  p(93, '[P] は [N] が [I-Adj] か', ...pHaNgaIAdj(''), lit('か')),
  p(94, '[P] は [N] が [Na-Adj] か', ...pHaNgaNaAdj('か')),
  p(95, '[P] は [N] に [V] か', ...pHaNxv('に', 'ka')),
  p(96, '[P] は [N] で [V] か', ...pHaNxv('で', 'ka')),
  p(97, '[P] は [N] と [V] か', ...pHaNxv('と', 'ka')),
  p(98, '[P] は [N] を [V] よ', ...pHaNwoV('yo')),
  p(99, '[P] は [N] を [Adv] [V] よ', ...pHaNwoV('yo', true)),
  p(100, '[P] は [N] が [I-Adj] よ', ...pHaNgaIAdj(''), lit('よ')),

  // N2/N3 grammar patterns (101–150)
  p(101, '[P] は [N] を [V] ように する', ...pHaNwoVForm('plain', lit('ように'), lit('する'))),
  p(102, '[P] は [N] を [V] ように なる', ...pHaNwoVForm('plain', lit('ように'), lit('なる'))),
  p(103, '[P] は [N] を [V] ことに する', ...pHaNwoVForm('plain', lit('ことに'), lit('する'))),
  p(104, '[P] は [N] を [V] ことに なる', ...pHaNwoVForm('plain', lit('ことに'), lit('なる'))),
  p(105, '[P] は [N] を [V] た ばかり', ...pHaNwoVForm('ta', lit('ばかり'))),
  p(106, '[P] は [N] を [V] て しまう', ...pHaNwoVForm('te', lit('しまう'))),
  p(107, '[P] は [N] を [V] て おく', ...pHaNwoVForm('te', lit('おく'))),
  p(108, '[P] は [N] を [V] ながら [V]', ...pHaNwoVForm('te', lit('ながら'), s('V2'))),
  p(109, '[P] は [N] を [V] ため に [V]', ...pHaNwoVForm('plain', lit('ために'), s('V2'))),
  p(110, '[P] は [N] を [V] ので [V]', ...pHaNwoVForm('plain', lit('ので'), s('V2'))),
  p(111, '[P] は [N] を [V] のに [V]', ...pHaNwoVForm('plain', lit('のに'), s('V2'))),
  p(112, '[P] は [N] を [V] なら [V]', ...pHaNwoVForm('nara', s('V2'))),
  p(113, '[P] は [N] を [V] たら [V]', ...pHaNwoVForm('tara', s('V2'))),
  p(114, '[P] は [N] を [V] ても [V]', ...pHaNwoVForm('te', lit('も'), s('V2'))),
  p(115, '[P] は [N] を [V] ば [V]', ...pHaNwoVForm('ba', s('V2'))),
  p(116, '[P] は [N] を [V] そう', ...pHaNwoVForm('stem', lit('そう'))),
  p(117, '[P] は [N] を [V] らしい', ...pHaNwoVForm('ta', lit('らしい'))),
  p(118, '[P] は [N] を [V] みたい', ...pHaNwoVForm('ta', lit('みたい'))),
  p(119, '[P] は [N] を [V] すぎる', ...pHaNwoVForm('stem', lit('すぎる'))),
  p(120, '[P] は [N] を [V] やすい', ...pHaNwoVForm('stem', lit('やすい'))),
  p(121, '[P] は [N] を [V] にくい', ...pHaNwoVForm('stem', lit('にくい'))),
  p(122, '[P] は [N] を [V] 始める', ...pHaNwoVForm('stem', lit('始める'))),
  p(123, '[P] は [N] を [V] 続ける', ...pHaNwoVForm('stem', lit('続ける'))),
  p(124, '[P] は [N] を [V] 終わる', ...pHaNwoVForm('stem', lit('終わる'))),
  p(125, '[P] は [N] を [V] ようと する', ...pHaNwoVForm('volitional', lit('と'), lit('する'))),
  p(126, '[P] は [N] を [V] かも しれない', ...pHaNwoVForm('plain', lit('かも'), lit('しれない'))),
  p(127, '[P] は [N] を [V] に 違いない', ...pHaNwoVForm('plain', lit('に'), lit('違いない'))),
  p(128, '[P] は [N] を [V] はず だ', ...pHaNwoVForm('plain', lit('はず'), lit('だ'))),
  p(129, '[P] は [N] を [V] べき だ', ...pHaNwoVForm('plain', lit('べき'), lit('だ'))),
  p(130, '[P] は [N] を [V] なければ ならない', ...pHaNwoVForm('nai', lit('なければ'), lit('ならない'))),
  p(131, '[P] は [N] を [V] なくても いい', ...pHaNwoVForm('nai', lit('なくても'), lit('いい'))),
  p(132, '[P] は [N] を [V] て は いけない', ...pHaNwoVForm('te', lit('は'), lit('いけない'))),
  p(133, '[P] は [N] を [V] て もらう', ...pHaNwoVForm('te', lit('もらう'))),
  p(134, '[P] は [N] に [V] て もらう', ...pHaNniVForm('te', lit('もらう'))),
  p(135, '[P] は [N] に [V] て くれる', ...pHaNniVForm('te', lit('くれる'))),
  p(136, '[P] は [N] に [V] て あげる', ...pHaNniVForm('te', lit('あげる'))),
  p(137, '[P] は [N] に [V] させる', ...pHaNniVForm('causative')),
  p(138, '[P] は [N] に [V] られる', ...pHaNniVForm('passive')),
  p(139, '[P] は [N] に [V] させられる', ...pHaNniVForm('causativePassive')),
  p(140, '[P] は [N] に [V] れる', ...pHaNniVForm('potential')),
  p(141, '[P] は [N] が [V] と 思う', ...pHaNgaVForm('plain', lit('と'), lit('思う'))),
  p(142, '[P] は [N] が [V] と 言う', ...pHaNgaVForm('plain', lit('と'), lit('言う'))),
  p(143, '[P] は [N] が [V] か どうか [V]', ...pHaNgaVForm('plain', lit('かどうか'), s('V2'))),
  p(144, '[P] は [N] が [V] ように [V]', ...pHaNgaVForm('plain', lit('ように'), s('V2'))),
  p(145, '[P] は [N] が [V] ような [N]', ...pHaNgaVForm('plain', lit('ような'), s('N2'))),
  p(146, '[P] は [N] が [V] ところ', ...pHaNgaVForm('plain', lit('ところ'))),
  p(147, '[P] は [N] が [V] あいだ に [V]', ...pHaNgaVForm('plain', lit('あいだ'), lit('に'), s('V2'))),
  p(148, '[P] は [N] が [V] うち に [V]', ...pHaNgaVForm('plain', lit('うち'), lit('に'), s('V2'))),
  p(149, '[P] は [N] が [V] あと で [V]', ...pHaNgaVForm('ta', lit('あと'), lit('で'), s('V2'))),
  p(150, '[P] は [N] が [V] 前 に [V]', ...pHaNgaVForm('plain', lit('前'), lit('に'), s('V2'))),
]

export function verbSlotUsesEndingRotation(
  template: PosTemplate,
  slotKey: 'V' | 'V2',
): boolean {
  for (let i = 0; i < template.pieces.length; i++) {
    const piece = template.pieces[i]
    if (piece.kind !== 'slot' || piece.key !== slotKey || piece.form) continue
    const next = template.pieces[i + 1]
    if (next?.kind === 'vmorph' && !vmorphAllowsEndingRotation(next.morph)) {
      return false
    }
    return true
  }
  return false
}

function vmorphAllowsEndingRotation(morph: VerbMorph): boolean {
  return morph !== 'deshou' && morph !== 'ka' && morph !== 'yo'
}

export function swappableSlotsInTemplate(template: PosTemplate): PosSlotKey[] {
  const keys = new Set<PosSlotKey>()
  for (const piece of template.pieces) {
    if (piece.kind === 'slot') keys.add(piece.key)
  }
  if (verbSlotUsesEndingRotation(template, 'V')) keys.add('VEnd')
  if (verbSlotUsesEndingRotation(template, 'V2')) keys.add('V2End')
  return SLOT_ROTATION_ORDER.filter((k) => keys.has(k))
}

export function initialVerbEndingForTemplate(template: PosTemplate, slotKey: 'V' | 'V2'): VerbEndingId | null {
  for (let i = 0; i < template.pieces.length; i++) {
    const piece = template.pieces[i]
    if (piece.kind !== 'slot' || piece.key !== slotKey || piece.form) continue
    const next = template.pieces[i + 1]
    if (next?.kind === 'vmorph') {
      return vmorphToEndingId(next.morph)
    }
    return 'plain'
  }
  return null
}

function vmorphToEndingId(morph: VerbMorph): VerbEndingId {
  if (morph === 'nai') return 'nai'
  if (morph === 'ta') return 'ta'
  if (morph === 'tai') return 'tai'
  if (morph === 'desu') return 'masu'
  return 'plain'
}

export function getPosTemplate(id: number): PosTemplate {
  return HERO_POS_TEMPLATES.find((t) => t.id === id) ?? HERO_POS_TEMPLATES[0]
}
