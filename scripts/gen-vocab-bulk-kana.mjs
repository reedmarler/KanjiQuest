import fs from 'fs'

const src = fs.readFileSync('src/data/vocabBulk.ts', 'utf8')
const re = /id: '(vocab-bulk-[^']+)'[\s\S]*?reading: '([^']+)'/g

const K = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ',
  ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', he: 'へ', ho: 'ほ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を', n: 'ん',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  da: 'だ', de: 'で', do: 'ど',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ', shou: 'しょう',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', chou: 'ちょう',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ', hyou: 'ひょう',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ', myou: 'みょう',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ', ryou: 'りょう',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ', gyou: 'ぎょう',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ', jou: 'じょう',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ', byou: 'びょう',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ', pyou: 'ぴょう',
  kyou: 'きょう', gyou: 'ぎょう',
  sou: 'そう', tou: 'とう', nou: 'のう', hou: 'ほう', mou: 'もう',
  rou: 'ろう', dou: 'どう', bou: 'ぼう', pou: 'ぽう', gou: 'ごう',
  zou: 'ぞう', kou: 'こう',
}

const ORDER = Object.keys(K).sort((a, b) => b.length - a.length)

function romaji(input) {
  let s = input.toLowerCase().split('/')[0].trim().replace(/[-]/g, ' ')
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s[i] === ' ') {
      out += ' '
      i++
      continue
    }
    if (i + 1 < s.length && s[i] === s[i + 1] && s[i] !== 'n' && !'aiueoy'.includes(s[i])) {
      out += 'っ'
      i++
      continue
    }
    if (s[i] === 'n' && (i + 1 >= s.length || s[i + 1] === ' ' || !'aiueoy'.includes(s[i + 1]))) {
      out += 'ん'
      i++
      continue
    }
    let matched = false
    for (const key of ORDER) {
      if (s.startsWith(key, i)) {
        out += K[key]
        i += key.length
        const last = key.slice(-1)
        if (i < s.length && 'aeou'.includes(last)) {
          if (s[i] === last) {
            out += last === 'e' ? 'ー' : K[last]
            i++
          } else if (last === 'o' && s[i] === 'u') {
            out += 'う'
            i++
          }
        }
        matched = true
        break
      }
    }
    if (!matched) {
      out += s[i]
      i++
    }
  }
  return out
}

const lines = [
  '/** Hiragana for bulk vocabulary cards */',
  'export const vocabBulkKanaMap: Record<string, string> = {',
]

let m
let count = 0
while ((m = re.exec(src))) {
  lines.push(`  '${m[1]}': '${romaji(m[2])}',`)
  count++
}

lines.push('}')
fs.writeFileSync('src/data/vocabBulkKana.ts', lines.join('\n'))
console.log(`wrote ${count} entries`)

// spot-check
const checks = ['kekkon', 'messeeji', 'tsukiatte', 'shitto', 'kippu', 'hikkoshi', 'bekkyo', 'shourai', 'kyouri / gori']
for (const c of checks) console.log(c, '->', romaji(c))
