/**
 * Build top-1000 frequency vocabulary from Tono/Yamazaki/Maekawa + OpenJLPT levels.
 * Run: npx tsx scripts/generate-top1000-vocab.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toRomaji } from 'wanakana'
import { vocabularyCards } from '../src/data/vocabulary.ts'
import { vocabBulkCards } from '../src/data/vocabBulk.ts'
import { vocabBulkHeroCards } from '../src/data/vocabBulkHero.ts'
import { vocabBulkListCards } from '../src/data/vocabBulkList.ts'
import type { JlptLevel, StudyCard } from '../src/lib/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
const TOP_N = 1000

interface FreqEntry {
  rank: number
  reading: string
  english: string
  kanji?: string
  roumaji: string
}

interface OpenJlptEntry {
  word: string
  reading: string
  meanings: string[]
  level: JlptLevel
}

const JLPT_ORDER: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

function jlptRank(level: JlptLevel): number {
  return JLPT_ORDER.indexOf(level)
}

function primaryAlt(value: string): string {
  return value.split('/')[0]?.trim() ?? value
}

function primaryHiragana(reading: string): string {
  return primaryAlt(reading).replace(/\s+/g, '')
}

function normalizeRomaji(value: string): string {
  return value.toLowerCase().replace(/[,/]/g, ' ').replace(/\s+/g, ' ').trim()
}

function compactRomaji(value: string): string {
  const firstComma = value.split(',')[0] ?? value
  const primary = primaryAlt(firstComma)
  return normalizeRomaji(primary).replace(/\s+/g, '')
}

function isParticleLikeEntry(english: string): boolean {
  return /^(p\.|aux\.|cp\.|conj\.|disc\.)/i.test(english)
}

function shouldUseOpenJlpt(entry: FreqEntry, match: OpenJlptEntry): boolean {
  if (entry.kanji) return true
  if (!isParticleLikeEntry(entry.english)) return true
  return jlptRank(match.level) <= jlptRank('N4')
}

function stripPos(english: string): string {
  return english
    .replace(/^(n\.|v\.|p\.|aux\.|cp\.|i-adj\.|adj\.|na-adj\.|adv\.|conj\.|interj\.|pron\.|disc\.|adn\.)\s*/i, '')
    .replace(/\s+(n\.|v\.|p\.|aux\.|cp\.|i-adj\.|adj\.|na-adj\.|adv\.|conj\.|interj\.|pron\.|disc\.|adn\.)\s+/gi, ' ')
    .trim()
}

function inferJlpt(rank: number): JlptLevel {
  if (rank <= 150) return 'N5'
  if (rank <= 350) return 'N4'
  if (rank <= 550) return 'N3'
  if (rank <= 750) return 'N2'
  return 'N1'
}

function isKanjiToken(token: string): boolean {
  return /[\u4e00-\u9faf々〆ヵヶ]/.test(token)
}

function isLatinToken(token: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9,]*$/.test(token)
}

function romajiMatchesReading(roumaji: string, reading: string): boolean {
  const expected = compactRomaji(toRomaji(primaryHiragana(reading)))
  const actual = compactRomaji(roumaji)
  if (!expected || !actual) return false
  return actual === expected || expected.startsWith(actual) || actual.startsWith(expected)
}

function extractRoumaji(rest: string, reading: string): { roumaji: string; body: string } | null {
  const tokens = rest.split(/\s+/)
  const latin: string[] = []

  while (tokens.length > 0) {
    const token = tokens[tokens.length - 1]
    if (!isLatinToken(token)) break
    latin.unshift(tokens.pop()!)
  }

  if (latin.length === 0) return null

  let roumaji = latin.join(' ')
  if (!romajiMatchesReading(roumaji, reading) && latin.length > 1) {
    for (let size = 1; size <= latin.length; size++) {
      const candidate = latin.slice(-size).join(' ')
      if (romajiMatchesReading(candidate, reading)) {
        roumaji = candidate
        break
      }
    }
  }

  if (!romajiMatchesReading(roumaji, reading)) return null
  return { roumaji, body: tokens.join(' ') }
}

function parseFreqLine(line: string): FreqEntry | null {
  const tail = line.match(/^(.+)\s+(\d+)\s+(\d+)\s+([\d.]+)(?:\s+(\S+))?(?:\s+(\S))?\s*$/)
  if (!tail) return null

  const rank = Number(tail[2])
  let rest = tail[1].trim()
  const firstSpace = rest.indexOf(' ')
  if (firstSpace === -1) return null

  const reading = rest.slice(0, firstSpace).trim()
  rest = rest.slice(firstSpace + 1).trim()

  const roumajiResult = extractRoumaji(rest, reading)
  if (!roumajiResult) return null

  let body = roumajiResult.body.trim()
  let kanji: string | undefined

  const bodyTokens = body.split(/\s+/)
  if (bodyTokens.length > 1 && isKanjiToken(bodyTokens[bodyTokens.length - 1]!)) {
    kanji = bodyTokens.pop()
    body = bodyTokens.join(' ')
  }

  const english = body.trim()
  if (!english) return null

  return {
    rank,
    reading,
    english,
    kanji,
    roumaji: roumajiResult.roumaji,
  }
}

function loadFreqEntries(): FreqEntry[] {
  const raw = readFileSync(join(DATA_DIR, 'tono-frequency.tsv'), 'utf8')
  const entries: FreqEntry[] = []
  let skipped = 0

  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('Readings ')) continue
    const parsed = parseFreqLine(line)
    if (parsed) entries.push(parsed)
    else skipped++
  }

  console.log(`Parsed ${entries.length} frequency rows (${skipped} skipped)`)
  return entries.sort((a, b) => a.rank - b.rank).slice(0, TOP_N)
}

function loadOpenJlpt(): OpenJlptEntry[] {
  const rows: OpenJlptEntry[] = []
  for (const level of JLPT_ORDER) {
    const file = join(DATA_DIR, `openjlpt-${level.toLowerCase()}.json`)
    const chunk = JSON.parse(readFileSync(file, 'utf8')) as OpenJlptEntry[]
    rows.push(...chunk.map((row) => ({ ...row, level })))
  }
  return rows
}

function buildJlptIndex(rows: OpenJlptEntry[]): {
  byWord: Map<string, OpenJlptEntry>
  byReading: Map<string, OpenJlptEntry>
} {
  const byWord = new Map<string, OpenJlptEntry>()
  const byReading = new Map<string, OpenJlptEntry>()

  for (const row of rows) {
    const wordExisting = byWord.get(row.word)
    if (!wordExisting || jlptRank(row.level) < jlptRank(wordExisting.level)) {
      byWord.set(row.word, row)
    }

    const readingKey = primaryHiragana(row.reading || '')
    if (readingKey) {
      const readingExisting = byReading.get(readingKey)
      if (!readingExisting || jlptRank(row.level) < jlptRank(readingExisting.level)) {
        byReading.set(readingKey, row)
      }
    }
  }

  return { byWord, byReading }
}

function lookupOpenJlpt(
  entry: FreqEntry,
  index: { byWord: Map<string, OpenJlptEntry>; byReading: Map<string, OpenJlptEntry> },
): OpenJlptEntry | undefined {
  const kana = primaryHiragana(entry.reading)
  const intendedFront = entry.kanji ?? kana

  const direct = index.byWord.get(intendedFront)
  if (direct) return direct

  if (entry.kanji) {
    const byKana = index.byReading.get(kana)
    if (byKana && (byKana.word === entry.kanji || byKana.word === kana)) return byKana
    return undefined
  }

  const byKana = index.byReading.get(kana)
  if (byKana && byKana.word === kana) return byKana
  return undefined
}

function existingFronts(): Set<string> {
  const cards = [...vocabularyCards, ...vocabBulkCards, ...vocabBulkHeroCards, ...vocabBulkListCards]
  return new Set(cards.map((c) => c.front.replace(/\s+/g, '')))
}

function escapeTs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function formatCard(card: StudyCard): string {
  const parts = [
    `id: '${card.id}'`,
    `type: 'vocab'`,
    `front: '${escapeTs(card.front)}'`,
    `reading: '${escapeTs(card.reading ?? '')}'`,
    `back: '${escapeTs(card.back)}'`,
    `jlpt: '${card.jlpt}'`,
  ]
  if (card.hint) parts.push(`hint: '${escapeTs(card.hint)}'`)
  return `  { ${parts.join(', ')} }`
}

function main() {
  const freq = loadFreqEntries()
  const openJlpt = loadOpenJlpt()
  const index = buildJlptIndex(openJlpt)
  const seen = existingFronts()
  const cards: StudyCard[] = []
  const kanaById: Record<string, string> = {}
  let openJlptMatches = 0

  for (const entry of freq) {
    const matchRaw = lookupOpenJlpt(entry, index)
    const match = matchRaw && shouldUseOpenJlpt(entry, matchRaw) ? matchRaw : undefined
    const kana = primaryHiragana(entry.reading)
    const front = entry.kanji ?? kana
    const frontKey = front.replace(/\s+/g, '')
    if (!frontKey || seen.has(frontKey)) continue

    if (match) openJlptMatches++
    seen.add(frontKey)
    const id = `vocab-freq-${String(cards.length + 1).padStart(4, '0')}`
    const reading = match
      ? compactRomaji(toRomaji(match.reading || match.word))
      : compactRomaji(entry.roumaji)
    const back = match?.meanings.join('; ') ?? stripPos(entry.english)
    const jlpt = match?.level ?? inferJlpt(entry.rank)

    kanaById[id] = match?.reading ? primaryHiragana(match.reading) : kana
    cards.push({
      id,
      type: 'vocab',
      front,
      reading,
      back,
      jlpt,
      hint: `#${entry.rank}`,
    })
  }

  const cardLines = cards.map(formatCard).join(',\n')
  const cardsOut = `import type { StudyCard } from '../lib/types'

/** Top ${TOP_N} most-used Japanese words (Tono frequency), excluding duplicates already in core decks */
export const vocabTop1000Cards: StudyCard[] = [
${cardLines},
]
`
  writeFileSync(join(__dirname, '../src/data/vocabTop1000.ts'), cardsOut, 'utf8')

  const kanaLines = Object.entries(kanaById)
    .map(([id, kana]) => `  '${id}': '${escapeTs(kana)}',`)
    .join('\n')

  const kanaOut = `/** Hiragana readings for frequency-ranked vocabulary */
export const vocabTop1000KanaMap: Record<string, string> = {
${kanaLines}
}
`
  writeFileSync(join(__dirname, '../src/data/vocabTop1000Kana.ts'), kanaOut, 'utf8')

  console.log(`New cards generated: ${cards.length}`)
  console.log(
    'JLPT breakdown:',
    Object.fromEntries(JLPT_ORDER.map((lvl) => [lvl, cards.filter((c) => c.jlpt === lvl).length])),
  )
  console.log(`OpenJLPT matches: ${openJlptMatches}`)
}

main()
