/**
 * Builds a study card for every character the Kanji Paths name but the deck
 * cannot teach.
 *
 * `kanjiFocusSets` derives its characters from the vocabulary of each topic, so
 * it happily lists 洗 and 濯 for the home path — while `kanji.ts` holds only ~70
 * hand-authored cards, none of them those two. A character with no card has no
 * id, and anything keyed by card id (the scheduler, and now the world map's ink)
 * cannot see it. `npm run audit:map-state` measured the hole: the twelve topics
 * the campaign uses want 180 characters and can only track 24.
 *
 * Three sources, in order of authority:
 *
 *   READINGS   src/data/kanjiReadings.generated.ts — KANJIDIC2 (EDRDG). Primary
 *              kun and on, rendered as romaji to match the hand-authored cards.
 *   MEANINGS   scripts/data/openjlpt-n*.json, where the character also stands
 *              alone as a word. Carries a JLPT level with it, which is the
 *              level of the *word* — close enough to place the card, and noted
 *              here rather than silently presented as a kanji grade.
 *   CURATED    the table below, for the 126 characters no dataset covers.
 *              Hand-written, so it is kept visible and reviewable rather than
 *              buried inside a file labelled "generated".
 *
 * The script refuses to emit a card it cannot fully source. A character with no
 * meaning fails the run rather than shipping a blank back.
 *
 * Usage:  npm run generate:kanji-cards
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { toRomaji } from 'wanakana'
import { kanjiFocusSets } from '../src/data/kanjiFocusSets'
import { handAuthoredKanjiCards } from '../src/data/kanji'
import { kanjiReadings } from '../src/data/kanjiReadings.generated'
import type { JlptLevel } from '../src/lib/types'

interface Curated {
  back: string
  jlpt: JlptLevel
  /** Only for the handful KANJIDIC2 does not carry (non-jōyō characters). */
  reading?: string
}

const CURATED: Record<string, Curated> = {
  団: { back: 'group / association', jlpt: 'N3', reading: 'dan' },
  冷: { back: 'cool / cold', jlpt: 'N4' },
  凍: { back: 'freeze', jlpt: 'N2' },
  庫: { back: 'storehouse / warehouse', jlpt: 'N3' },
  洗: { back: 'wash', jlpt: 'N4' },
  濯: { back: 'launder', jlpt: 'N2' },
  噌: { back: 'miso', jlpt: 'N2', reading: 'so' },
  売: { back: 'sell', jlpt: 'N5' },
  引: { back: 'pull / draw', jlpt: 'N4' },
  税: { back: 'tax', jlpt: 'N3' },
  込: { back: 'crowded / include', jlpt: 'N3' },
  釣: { back: 'fishing / change (money)', jlpt: 'N2' },
  領: { back: 'territory / domain', jlpt: 'N2', reading: 'ryou' },
  収: { back: 'collect / obtain', jlpt: 'N3' },
  書: { back: 'write', jlpt: 'N5' },
  改: { back: 'reform / renew', jlpt: 'N3' },
  路: { back: 'road / path', jlpt: 'N3', reading: 'ro' },
  片: { back: 'one side / piece', jlpt: 'N3' },
  往: { back: 'journey / outward trip', jlpt: 'N2', reading: 'ou' },
  復: { back: 'return / repeat', jlpt: 'N3', reading: 'fuku' },
  転: { back: 'revolve / turn', jlpt: 'N3' },
  信: { back: 'trust / believe', jlpt: 'N3' },
  辞: { back: 'word / resign', jlpt: 'N3', reading: 'ji' },
  予: { back: 'beforehand / in advance', jlpt: 'N3', reading: 'yo' },
  成: { back: 'become / achieve', jlpt: 'N3' },
  績: { back: 'achievement / results', jlpt: 'N2' },
  合: { back: 'fit / join', jlpt: 'N4' },
  出: { back: 'exit / leave', jlpt: 'N5' },
  司: { back: 'director / official', jlpt: 'N2', reading: 'shi' },
  僚: { back: 'colleague', jlpt: 'N1' },
  議: { back: 'deliberation / discussion', jlpt: 'N3' },
  資: { back: 'resources / capital', jlpt: 'N2' },
  締: { back: 'tighten / fasten', jlpt: 'N2' },
  切: { back: 'cut', jlpt: 'N5' },
  休: { back: 'rest', jlpt: 'N5' },
  憩: { back: 'rest / recess', jlpt: 'N1' },
  顔: { back: 'face', jlpt: 'N4' },
  痛: { back: 'pain / hurt', jlpt: 'N3' },
  医: { back: 'doctor / medicine', jlpt: 'N4' },
  看: { back: 'watch over / nurse', jlpt: 'N2', reading: 'kan' },
  護: { back: 'protect / safeguard', jlpt: 'N2' },
  術: { back: 'technique / art', jlpt: 'N3', reading: 'jutsu' },
  郵: { back: 'mail / post', jlpt: 'N3' },
  警: { back: 'warn / guard', jlpt: 'N3', reading: 'kei' },
  察: { back: 'guess / police', jlpt: 'N3' },
  温: { back: 'warm', jlpt: 'N4' },
  婦: { back: 'woman / wife', jlpt: 'N3', reading: 'fu' },
  安: { back: 'cheap / peaceful', jlpt: 'N5' },
  配: { back: 'distribute / arrange', jlpt: 'N3' },
  緊: { back: 'tense / tight', jlpt: 'N2', reading: 'kin' },
  張: { back: 'stretch / strain', jlpt: 'N3' },
  感: { back: 'feeling / sense', jlpt: 'N4' },
  携: { back: 'carry / portable', jlpt: 'N2' },
  写: { back: 'copy / photograph', jlpt: 'N4' },
  真: { back: 'true / real', jlpt: 'N4' },
  動: { back: 'move', jlpt: 'N4' },
  映: { back: 'reflect / project', jlpt: 'N3' },
  番: { back: 'number / turn', jlpt: 'N4', reading: 'ban' },
  午: { back: 'noon', jlpt: 'N5' },
  定: { back: 'fix / decide', jlpt: 'N4' },
  遅: { back: 'late / slow', jlpt: 'N3' },
  禁: { back: 'prohibit / forbid', jlpt: 'N3' },
  喫: { back: 'consume / smoke', jlpt: 'N2', reading: 'kitsu' },
  辛: { back: 'spicy / harsh', jlpt: 'N3' },
  甘: { back: 'sweet', jlpt: 'N3' },
  苦: { back: 'bitter / suffering', jlpt: 'N3' },
  取: { back: 'take / pick up', jlpt: 'N4' },
  持: { back: 'hold / carry', jlpt: 'N4' },
  試: { back: 'try / test', jlpt: 'N3' },
  選: { back: 'choose / select', jlpt: 'N3' },
  監: { back: 'oversee / supervise', jlpt: 'N2' },
  督: { back: 'supervise / lead', jlpt: 'N1' },
  応: { back: 'respond / answer', jlpt: 'N3', reading: 'ou' },
  援: { back: 'aid / assist', jlpt: 'N2' },
  勝: { back: 'win / victory', jlpt: 'N4' },
  負: { back: 'lose / bear', jlpt: 'N3' },
  練: { back: 'practice / train', jlpt: 'N3' },
  豚: { back: 'pig', jlpt: 'N3' },
  飼: { back: 'raise / keep (an animal)', jlpt: 'N2' },
  吠: { back: 'bark / howl', jlpt: 'N1', reading: 'ho' },
  帽: { back: 'hat / cap', jlpt: 'N3', reading: 'bou' },
  眼: { back: 'eye / eyeball', jlpt: 'N3', reading: 'me / gan' },
  化: { back: 'change / transform', jlpt: 'N4', reading: 'ka' },
  粧: { back: 'makeup / adorn', jlpt: 'N1' },
  向: { back: 'face / toward', jlpt: 'N4' },
  理: { back: 'reason / logic', jlpt: 'N4', reading: 'ri' },
  焼: { back: 'bake / grill', jlpt: 'N3' },
  煮: { back: 'boil / simmer', jlpt: 'N2' },
  炒: { back: 'stir-fry', jlpt: 'N1', reading: 'ita' },
  蒸: { back: 'steam', jlpt: 'N2' },
  混: { back: 'mix / blend', jlpt: 'N3' },
  沸: { back: 'boil / seethe', jlpt: 'N2' },
  調: { back: 'tune / investigate', jlpt: 'N3' },
  糖: { back: 'sugar', jlpt: 'N2' },
  震: { back: 'quake / tremble', jlpt: 'N2' },
  避: { back: 'avoid / evade', jlpt: 'N2' },
  救: { back: 'rescue / save', jlpt: 'N3' },
  消: { back: 'extinguish / erase', jlpt: 'N4' },
  防: { back: 'prevent / defend', jlpt: 'N3' },
  報: { back: 'report / news', jlpt: 'N3' },
  危: { back: 'dangerous', jlpt: 'N3' },
  両: { back: 'both', jlpt: 'N4' },
  祖: { back: 'ancestor / grandparent', jlpt: 'N3' },
  父: { back: 'father', jlpt: 'N5' },
  母: { back: 'mother', jlpt: 'N5' },
  戚: { back: 'relative / kin', jlpt: 'N1' },
  誕: { back: 'birth / nativity', jlpt: 'N3' },
  結: { back: 'tie / bind', jlpt: 'N3' },
  婚: { back: 'marriage', jlpt: 'N3' },
  離: { back: 'separate / detach', jlpt: 'N3' },
  越: { back: 'exceed / cross over', jlpt: 'N3' },
  卒: { back: 'graduate', jlpt: 'N3' },
  以: { back: 'by means of / than', jlpt: 'N4' },
  平: { back: 'flat / peaceful', jlpt: 'N4' },
  明: { back: 'bright / clear', jlpt: 'N5' },
  意: { back: 'idea / meaning', jlpt: 'N4' },
  提: { back: 'propose / present', jlpt: 'N3' },
  談: { back: 'discuss / talk', jlpt: 'N3' },
  誤: { back: 'mistake / err', jlpt: 'N2' },
  解: { back: 'solve / understand', jlpt: 'N3' },
  謝: { back: 'apologise / thank', jlpt: 'N3' },
  伝: { back: 'transmit / convey', jlpt: 'N4' },
  贈: { back: 'present / bestow', jlpt: 'N2' },
  招: { back: 'invite / beckon', jlpt: 'N2' },
  祝: { back: 'celebrate', jlpt: 'N3' },
  記: { back: 'record / write down', jlpt: 'N4' },
  注: { back: 'pour / annotate', jlpt: 'N3' },
  商: { back: 'commerce / trade', jlpt: 'N3' },
  札: { back: 'note (money) / tag', jlpt: 'N3' },
  場: { back: 'place / venue', jlpt: 'N3' },
  計: { back: 'measure / plan', jlpt: 'N3' },
  員: { back: 'member / staff', jlpt: 'N4' },
  局: { back: 'bureau / office', jlpt: 'N3' },
  社: { back: 'company / society', jlpt: 'N4', reading: 'sha' },
  便: { back: 'convenience / mail', jlpt: 'N4' },
  図: { back: 'diagram / drawing', jlpt: 'N3' },
  園: { back: 'garden / park', jlpt: 'N3' },
  帯: { back: 'belt / sash', jlpt: 'N3' },
  画: { back: 'picture / drawing', jlpt: 'N4', reading: 'ga' },
  楽: { back: 'enjoyable / music', jlpt: 'N4' },
  兄: { back: 'older brother', jlpt: 'N5' },
  科: { back: 'department / subject', jlpt: 'N3' },
  格: { back: 'status / rank', jlpt: 'N3' },
  料: { back: 'material / fee', jlpt: 'N4' },
  館: { back: 'building / hall', jlpt: 'N3' },
  美: { back: 'beauty', jlpt: 'N3' },
  公: { back: 'public / official', jlpt: 'N3' },
  同: { back: 'same', jlpt: 'N4' },
  割: { back: 'divide / proportion', jlpt: 'N3', reading: 'wa / katsu' },
  馬: { back: 'horse', jlpt: 'N3' },
  流: { back: 'flow / current', jlpt: 'N3' },
  直: { back: 'direct / fix', jlpt: 'N3', reading: 'choku' },
  曲: { back: 'bend / tune', jlpt: 'N3' },
  代: { back: 'generation / substitute', jlpt: 'N4' },
  新: { back: 'new', jlpt: 'N5' },
  期: { back: 'period / term', jlpt: 'N3' },
  財: { back: 'wealth / assets', jlpt: 'N3' },
  尾: { back: 'tail', jlpt: 'N2' },
  都: { back: 'capital / metropolis', jlpt: 'N4' },
  末: { back: 'end / final', jlpt: 'N3' },
  約: { back: 'promise / approximately', jlpt: 'N3' },
  角: { back: 'corner / angle', jlpt: 'N5' },
  隣: { back: 'neighbour / next door', jlpt: 'N5' },
  左: { back: 'left', jlpt: 'N5' },
  右: { back: 'right', jlpt: 'N5' },
  碗: { back: 'bowl', jlpt: 'N2', reading: 'wan' },
}

const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'] as const

interface JlptWord {
  word: string
  meanings: string[]
  level: JlptLevel
}

/** Characters that also stand alone as a JLPT word carry their own gloss. */
const standalone = new Map<string, JlptWord>()
for (const level of LEVELS) {
  const rows = JSON.parse(readFileSync(`scripts/data/openjlpt-${level}.json`, 'utf8')) as JlptWord[]
  for (const row of rows) {
    if ([...row.word].length === 1 && !standalone.has(row.word)) standalone.set(row.word, row)
  }
}

/**
 * Matches the hand-authored cards: the everyday reading, then the on, in romaji.
 *
 * KANJIDIC2 does not order its kun by frequency — 歯 leads with よわい, which no
 * learner needs before は — so a character that also stands alone as a word
 * takes that word's reading first. KANJIDIC2 fills in the rest.
 */
function romajiReading(character: string, word: JlptWord | undefined): string | undefined {
  const entry = kanjiReadings[character]
  const primary = word?.reading || entry?.kun[0]
  const parts = [primary, entry?.on[0]]
    .filter(Boolean)
    .map((reading) => toRomaji(reading!).replace(/^-|-$/g, ''))
  return parts.length ? [...new Set(parts)].join(' / ') : undefined
}

/** Gloss tags like "(sl)" or "(uk)" belong in a dictionary, not on a card. */
function cleanGloss(meanings: readonly string[]): string {
  return meanings
    .slice(0, 2)
    .map((meaning) => meaning.replace(/\((?:\d+|sl|uk|abbr|col|arch|obs|on-mim|hon|pol|humble|esp\.[^)]*|e\.g\.[^)]*)\)\s*/gi, '').trim())
    .filter(Boolean)
    .join(' / ')
}

const existing = new Set(handAuthoredKanjiCards.map((card) => card.front))
const wanted: string[] = []
for (const set of kanjiFocusSets) {
  for (const character of set.characters) {
    if (!existing.has(character) && !wanted.includes(character)) wanted.push(character)
  }
}

const usedIds = new Set(handAuthoredKanjiCards.map((card) => card.id))
const unresolved: string[] = []
const lines: string[] = []
const sources = { curated: 0, jlpt: 0 }

for (const character of wanted) {
  const curated = CURATED[character]
  const word = standalone.get(character)
  const back = curated?.back ?? (word ? cleanGloss(word.meanings) : undefined)
  const jlpt = curated?.jlpt ?? word?.level
  const reading = curated?.reading ?? romajiReading(character, word)

  if (!back || !jlpt || !reading) {
    unresolved.push(`${character} (${[!back && 'meaning', !reading && 'reading', !jlpt && 'level'].filter(Boolean).join(', ')})`)
    continue
  }

  if (curated) sources.curated += 1
  else sources.jlpt += 1

  const slug = reading.split(' / ')[0]!.replace(/[^a-z]/g, '') || 'kanji'
  let id = `kanji-${jlpt.toLowerCase()}-${slug}`
  for (let suffix = 2; usedIds.has(id); suffix += 1) id = `kanji-${jlpt.toLowerCase()}-${slug}${suffix}`
  usedIds.add(id)

  lines.push(
    `  { id: '${id}', type: 'kanji', front: '${character}', reading: '${reading}', back: '${back.replace(/'/g, "\\'")}', jlpt: '${jlpt}' },`,
  )
}

const header = `/**
 * One card per character named by a Kanji Path but absent from the
 * hand-authored deck, so every path character has an id the scheduler — and
 * the world map's ink — can track.
 *
 * Readings: KANJIDIC2 (EDRDG), primary kun and on, as romaji.
 * Meanings and levels: the openjlpt word lists where the character stands alone
 * as a word, otherwise the curated table in the generator. A level here is the
 * level of that word, not a kanji grade.
 *
 * Generated by scripts/generate-kanji-character-cards.ts — edit that, not this.
 */
import type { StudyCard } from '../lib/types'

export const kanjiCharacterCards: StudyCard[] = [
`

writeFileSync('src/data/kanjiCharacterCards.generated.ts', `${header}${lines.join('\n')}\n]\n`)

console.log(`Characters wanted by the Kanji Paths and missing a card: ${wanted.length}`)
console.log(`  written: ${lines.length}  (${sources.jlpt} from the JLPT word lists, ${sources.curated} curated)`)
console.log(`  unresolved: ${unresolved.length}`)
for (const item of unresolved) console.log(`    ${item}`)

// A character we cannot fully source is a hole in the deck, not a warning.
process.exitCode = unresolved.length > 0 ? 1 : 0
