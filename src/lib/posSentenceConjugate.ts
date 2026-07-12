import type { VerbForm, VerbMorph } from '../data/heroPosTemplates'

/** Known verb conjugations — dictionary → surface forms */
const VERB_FORMS: Record<string, Partial<Record<VerbMorph, string>>> = {
  '食べる': { plain: '食べる', nai: '食べない', ta: '食べた', tai: '食べたい', desu: '食べます', deshou: '食べるでしょう', ka: '食べるか', yo: '食べるよ' },
  '飲む': { plain: '飲む', nai: '飲まない', ta: '飲んだ', tai: '飲みたい', desu: '飲みます', deshou: '飲むでしょう', ka: '飲むか', yo: '飲むよ' },
  '読む': { plain: '読む', nai: '読まない', ta: '読んだ', tai: '読みたい', desu: '読みます', deshou: '読むでしょう', ka: '読むか', yo: '読むよ' },
  '見る': { plain: '見る', nai: '見ない', ta: '見た', tai: '見たい', desu: '見ます', deshou: '見るでしょう', ka: '見るか', yo: '見るよ' },
  '行く': { plain: '行く', nai: '行かない', ta: '行った', tai: '行きたい', desu: '行きます', deshou: '行くでしょう', ka: '行くか', yo: '行くよ' },
  '買う': { plain: '買う', nai: '買わない', ta: '買った', tai: '買いたい', desu: '買います', deshou: '買うでしょう', ka: '買うか', yo: '買うよ' },
  '作る': { plain: '作る', nai: '作らない', ta: '作った', tai: '作りたい', desu: '作ります', deshou: '作るでしょう', ka: '作るか', yo: '作るよ' },
  '聞く': { plain: '聞く', nai: '聞かない', ta: '聞いた', tai: '聞きたい', desu: '聞きます', deshou: '聞くでしょう', ka: '聞くか', yo: '聞くよ' },
  '会う': { plain: '会う', nai: '会わない', ta: '会った', tai: '会いたい', desu: '会います', deshou: '会うでしょう', ka: '会うか', yo: '会うよ' },
  '待つ': { plain: '待つ', nai: '待たない', ta: '待った', tai: '待ちたい', desu: '待ちます', deshou: '待つでしょう', ka: '待つか', yo: '待つよ' },
  '使う': { plain: '使う', nai: '使わない', ta: '使った', tai: '使いたい', desu: '使います', deshou: '使うでしょう', ka: '使うか', yo: '使うよ' },
  '話す': { plain: '話す', nai: '話さない', ta: '話した', tai: '話したい', desu: '話します', deshou: '話すでしょう', ka: '話すか', yo: '話すよ' },
  '撮る': { plain: '撮る', nai: '撮らない', ta: '撮った', tai: '撮りたい', desu: '撮ります', deshou: '撮るでしょう', ka: '撮るか', yo: '撮るよ' },
  '借りる': { plain: '借りる', nai: '借りない', ta: '借りた', tai: '借りたい', desu: '借ります', deshou: '借りるでしょう', ka: '借りるか', yo: '借りるよ' },
  '勉強する': { plain: '勉強する', nai: '勉強しない', ta: '勉強した', tai: '勉強したい', desu: '勉強します', deshou: '勉強するでしょう', ka: '勉強するか', yo: '勉強するよ' },
  'する': { plain: 'する', nai: 'しない', ta: 'した', tai: 'したい', desu: 'します', deshou: 'するでしょう', ka: 'するか', yo: 'するよ' },
  '来る': { plain: '来る', nai: '来ない', ta: '来た', tai: '来たい', desu: '来ます', deshou: '来るでしょう', ka: '来るか', yo: '来るよ' },
  '帰る': { plain: '帰る', nai: '帰らない', ta: '帰った', tai: '帰りたい', desu: '帰ります', deshou: '帰るでしょう', ka: '帰るか', yo: '帰るよ' },
  '書く': { plain: '書く', nai: '書かない', ta: '書いた', tai: '書きたい', desu: '書きます', deshou: '書くでしょう', ka: '書くか', yo: '書くよ' },
  '走る': { plain: '走る', nai: '走らない', ta: '走った', tai: '走りたい', desu: '走ります', deshou: '走るでしょう', ka: '走るか', yo: '走るよ' },
  '泳ぐ': { plain: '泳ぐ', nai: '泳がない', ta: '泳いだ', tai: '泳ぎたい', desu: '泳ぎます', deshou: '泳ぐでしょう', ka: '泳ぐか', yo: '泳ぐよ' },
  '遊ぶ': { plain: '遊ぶ', nai: '遊ばない', ta: '遊んだ', tai: '遊びたい', desu: '遊びます', deshou: '遊ぶでしょう', ka: '遊ぶか', yo: '遊ぶよ' },
  '歌う': { plain: '歌う', nai: '歌わない', ta: '歌った', tai: '歌いたい', desu: '歌います', deshou: '歌うでしょう', ka: '歌うか', yo: '歌うよ' },
  '始める': { plain: '始める', nai: '始めない', ta: '始めた', tai: '始めたい', desu: '始めます', deshou: '始めるでしょう', ka: '始めるか', yo: '始めるよ' },
  '覚える': { plain: '覚える', nai: '覚えない', ta: '覚えた', tai: '覚えたい', desu: '覚えます', deshou: '覚えるでしょう', ka: '覚えるか', yo: '覚えるよ' },
}

type ExtendedForms = Partial<Record<VerbForm, string>>

const EXTENDED_VERB_FORMS: Record<string, ExtendedForms> = {
  '食べる': { te: '食べて', stem: '食べ', ba: '食べれば', tara: '食べたら', nara: '食べるなら', volitional: '食べよう', passive: '食べられる', causative: '食べさせる', causativePassive: '食べさせられる', potential: '食べられる' },
  '飲む': { te: '飲んで', stem: '飲み', ba: '飲めば', tara: '飲んだら', nara: '飲むなら', volitional: '飲もう', passive: '飲まれる', causative: '飲ませる', causativePassive: '飲ませられる', potential: '飲める' },
  '読む': { te: '読んで', stem: '読み', ba: '読めば', tara: '読んだら', nara: '読むなら', volitional: '読もう', passive: '読まれる', causative: '読ませる', causativePassive: '読ませられる', potential: '読める' },
  '見る': { te: '見て', stem: '見', ba: '見れば', tara: '見たら', nara: '見るなら', volitional: '見よう', passive: '見られる', causative: '見せる', causativePassive: '見せられる', potential: '見られる' },
  '行く': { te: '行って', stem: '行き', ba: '行けば', tara: '行ったら', nara: '行くなら', volitional: '行こう', passive: '行かれる', causative: '行かせる', causativePassive: '行かせられる', potential: '行ける' },
  '買う': { te: '買って', stem: '買い', ba: '買えば', tara: '買ったら', nara: '買うなら', volitional: '買おう', passive: '買われる', causative: '買わせる', causativePassive: '買わせられる', potential: '買える' },
  '作る': { te: '作って', stem: '作り', ba: '作れば', tara: '作ったら', nara: '作るなら', volitional: '作ろう', passive: '作られる', causative: '作らせる', causativePassive: '作らせられる', potential: '作れる' },
  '聞く': { te: '聞いて', stem: '聞き', ba: '聞けば', tara: '聞いたら', nara: '聞くなら', volitional: '聞こう', passive: '聞かれる', causative: '聞かせる', causativePassive: '聞かせられる', potential: '聞ける' },
  '会う': { te: '会って', stem: '会い', ba: '会えば', tara: '会ったら', nara: '会うなら', volitional: '会おう', passive: '会われる', causative: '会わせる', causativePassive: '会わせられる', potential: '会える' },
  '待つ': { te: '待って', stem: '待ち', ba: '待てば', tara: '待ったら', nara: '待つなら', volitional: '待とう', passive: '待たれる', causative: '待たせる', causativePassive: '待たせられる', potential: '待てる' },
  '使う': { te: '使って', stem: '使い', ba: '使えば', tara: '使ったら', nara: '使うなら', volitional: '使おう', passive: '使われる', causative: '使わせる', causativePassive: '使わせられる', potential: '使える' },
  '話す': { te: '話して', stem: '話し', ba: '話せば', tara: '話したら', nara: '話すなら', volitional: '話そう', passive: '話される', causative: '話させる', causativePassive: '話させられる', potential: '話せる' },
  '撮る': { te: '撮って', stem: '撮り', ba: '撮れば', tara: '撮ったら', nara: '撮るなら', volitional: '撮ろう', passive: '撮られる', causative: '撮らせる', causativePassive: '撮らせられる', potential: '撮れる' },
  '借りる': { te: '借りて', stem: '借り', ba: '借りれば', tara: '借りたら', nara: '借りるなら', volitional: '借りよう', passive: '借りられる', causative: '借りさせる', causativePassive: '借りさせられる', potential: '借りられる' },
  '勉強する': { te: '勉強して', stem: '勉強し', ba: '勉強すれば', tara: '勉強したら', nara: '勉強するなら', volitional: '勉強しよう', passive: '勉強される', causative: '勉強させる', causativePassive: '勉強させられる', potential: '勉強できる' },
  'する': { te: 'して', stem: 'し', ba: 'すれば', tara: 'したら', nara: 'するなら', volitional: 'しよう', passive: 'される', causative: 'させる', causativePassive: 'させられる', potential: 'できる' },
  '来る': { te: '来て', stem: '来', ba: '来れば', tara: '来たら', nara: '来るなら', volitional: '来よう', passive: '来られる', causative: '来させる', causativePassive: '来させられる', potential: '来られる' },
  '帰る': { te: '帰って', stem: '帰り', ba: '帰れば', tara: '帰ったら', nara: '帰るなら', volitional: '帰ろう', passive: '帰られる', causative: '帰らせる', causativePassive: '帰らせられる', potential: '帰れる' },
  '書く': { te: '書いて', stem: '書き', ba: '書けば', tara: '書いたら', nara: '書くなら', volitional: '書こう', passive: '書かれる', causative: '書かせる', causativePassive: '書かせられる', potential: '書ける' },
  '走る': { te: '走って', stem: '走り', ba: '走れば', tara: '走ったら', nara: '走るなら', volitional: '走ろう', passive: '走られる', causative: '走らせる', causativePassive: '走らせられる', potential: '走れる' },
  '泳ぐ': { te: '泳いで', stem: '泳ぎ', ba: '泳げば', tara: '泳いだら', nara: '泳ぐなら', volitional: '泳ごう', passive: '泳がれる', causative: '泳がせる', causativePassive: '泳がせられる', potential: '泳げる' },
  '遊ぶ': { te: '遊んで', stem: '遊び', ba: '遊べば', tara: '遊んだら', nara: '遊ぶなら', volitional: '遊ぼう', passive: '遊ばれる', causative: '遊ばせる', causativePassive: '遊ばせられる', potential: '遊べる' },
  '歌う': { te: '歌って', stem: '歌い', ba: '歌えば', tara: '歌ったら', nara: '歌うなら', volitional: '歌おう', passive: '歌われる', causative: '歌わせる', causativePassive: '歌わせられる', potential: '歌える' },
  '始める': { te: '始めて', stem: '始め', ba: '始めれば', tara: '始めたら', nara: '始めるなら', volitional: '始めよう', passive: '始められる', causative: '始めさせる', causativePassive: '始めさせられる', potential: '始められる' },
  '覚える': { te: '覚えて', stem: '覚え', ba: '覚えれば', tara: '覚えたら', nara: '覚えるなら', volitional: '覚えよう', passive: '覚えられる', causative: '覚えさせる', causativePassive: '覚えさせられる', potential: '覚えられる' },
}

const MORPH_AS_FORM: Partial<Record<VerbForm, VerbMorph>> = {
  nai: 'nai',
  ta: 'ta',
  tai: 'tai',
  desu: 'desu',
}

export const CURATED_VERBS = Object.keys(VERB_FORMS)

export function conjugateVerb(dict: string, morph: VerbMorph): string {
  const forms = VERB_FORMS[dict]
  if (forms?.[morph]) return forms[morph]!
  if (morph === 'plain') return dict
  if (morph === 'desu' && dict.endsWith('る')) return dict.slice(0, -1) + 'ます'
  if (morph === 'nai' && dict.endsWith('る')) return dict.slice(0, -1) + 'ない'
  if (morph === 'ta' && dict.endsWith('る')) return dict.slice(0, -1) + 'た'
  if (morph === 'tai' && dict.endsWith('る')) return dict.slice(0, -1) + 'たい'
  if (morph === 'deshou') return dict + 'でしょう'
  if (morph === 'ka') return dict + 'か'
  if (morph === 'yo') return dict + 'よ'
  return dict
}

/** Surface form for grammar-pattern verb slots (te-form, stem, passive, etc.) */
export function conjugateVerbForm(dict: string, form: VerbForm): string {
  if (form === 'plain') return dict

  const morph = MORPH_AS_FORM[form]
  if (morph) return conjugateVerb(dict, morph)

  const ext = EXTENDED_VERB_FORMS[dict]
  if (ext?.[form]) return ext[form]!

  if (form === 'te' && dict.endsWith('る')) return `${dict.slice(0, -1)}て`
  if (form === 'stem' && dict.endsWith('る')) return dict.slice(0, -1)
  if (form === 'ba' && dict.endsWith('る')) return `${dict.slice(0, -1)}れば`
  if (form === 'tara') return `${conjugateVerb(dict, 'ta')}ら`
  if (form === 'nara') return `${dict}なら`
  if (form === 'volitional' && dict.endsWith('る')) return `${dict.slice(0, -1)}よう`
  if (form === 'passive' && dict.endsWith('る')) return `${dict.slice(0, -1)}られる`
  if (form === 'causative' && dict.endsWith('る')) return `${dict.slice(0, -1)}させる`
  if (form === 'causativePassive' && dict.endsWith('る')) return `${dict.slice(0, -1)}させられる`
  if (form === 'potential' && dict.endsWith('る')) return `${dict.slice(0, -1)}られる`

  return dict
}

/** i-adjective surface forms */
export function surfaceIAdj(stem: string, suffix: 'い' | 'く'): string {
  const base = stem.endsWith('い') ? stem : stem + 'い'
  if (suffix === 'い') return base
  return base.slice(0, -1) + 'く'
}

/** na-adjective surface forms */
export function surfaceNaAdj(stem: string, suffix: 'な' | 'に'): string {
  const base = stem.replace(/(な|に|だ|です)$/, '')
  if (suffix === 'な') return `${base}な`
  return `${base}に`
}

/** Apply でしょう to adjectives */
export function adjDeshou(surface: string): string {
  return `${surface}でしょう`
}
