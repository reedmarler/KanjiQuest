import type { StudyCard } from '../lib/types'

const hiraganaRows: [string, string[]][] = [
  ['a', ['あ', 'い', 'う', 'え', 'お']],
  ['ka', ['か', 'き', 'く', 'け', 'こ']],
  ['sa', ['さ', 'し', 'す', 'せ', 'そ']],
  ['ta', ['た', 'ち', 'つ', 'て', 'と']],
  ['na', ['な', 'に', 'ぬ', 'ね', 'の']],
  ['ha', ['は', 'ひ', 'ふ', 'へ', 'ほ']],
  ['ma', ['ま', 'み', 'む', 'め', 'も']],
  ['ya', ['や', '', 'ゆ', '', 'よ']],
  ['ra', ['ら', 'り', 'る', 'れ', 'ろ']],
  ['wa', ['わ', '', '', '', 'を']],
  ['n', ['ん', '', '', '', '']],
]

const katakanaRows: [string, string[]][] = [
  ['a', ['ア', 'イ', 'ウ', 'エ', 'オ']],
  ['ka', ['カ', 'キ', 'ク', 'ケ', 'コ']],
  ['sa', ['サ', 'シ', 'ス', 'セ', 'ソ']],
  ['ta', ['タ', 'チ', 'ツ', 'テ', 'ト']],
  ['na', ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ']],
  ['ha', ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ']],
  ['ma', ['マ', 'ミ', 'ム', 'メ', 'モ']],
  ['ya', ['ヤ', '', 'ユ', '', 'ヨ']],
  ['ra', ['ラ', 'リ', 'ル', 'レ', 'ロ']],
  ['wa', ['ワ', '', '', '', 'ヲ']],
  ['n', ['ン', '', '', '', '']],
]

const romajiMap: Record<string, string> = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'wo', 'ん': 'n',
  'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
  'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
  'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
  'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
  'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
  'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
  'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
  'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
  'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
  'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n',
}

function buildKanaCards(rows: [string, string[]][], type: 'hiragana' | 'katakana'): StudyCard[] {
  const cards: StudyCard[] = []
  for (const [, chars] of rows) {
    for (const char of chars) {
      if (!char) continue
      cards.push({
        id: `${type}-${char}`,
        type,
        front: char,
        back: romajiMap[char] ?? '',
        hint: `What is the romaji for this ${type === 'hiragana' ? 'hiragana' : 'katakana'} character?`,
      })
    }
  }
  return cards
}

export const hiraganaCards = buildKanaCards(hiraganaRows, 'hiragana')
export const katakanaCards = buildKanaCards(katakanaRows, 'katakana')
