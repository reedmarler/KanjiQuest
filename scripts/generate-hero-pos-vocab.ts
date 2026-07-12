/**
 * Generate hero POS vocabulary + word index using Kuromoji.
 * Run: npm run generate:hero-pos
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error kuromoji has no bundled types
import kuromoji from 'kuromoji'

import { allCards } from '../src/data/index'
import {
  HERO_SUBJECTS,
  HERO_TEMPLATES,
} from '../src/data/heroSentences'
import { kuromojiPosToCategory } from '../src/lib/japanesePos/posMapping'
import type { PosCategory, TokenPos } from '../src/lib/japanesePos/types'
import { SORTED_AUXILIARIES } from '../src/lib/japanesePos/particles'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '../src/data/heroPosVocabulary.ts')

const SWAPPABLE: PosCategory[] = ['noun', 'verb', 'i_adj', 'na_adj', 'adverb', 'pronoun']

/** Manual overrides when Kuromoji mis-tags hero curriculum words */
const MANUAL_POS: Record<string, PosCategory> = {
  私: 'pronoun',
  彼: 'pronoun',
  彼女: 'pronoun',
  みんな: 'pronoun',
  友達: 'noun',
  先生: 'noun',
  母: 'noun',
  兄: 'noun',
  姉: 'noun',
  父さん: 'noun',
  母さん: 'noun',
  兄さん: 'noun',
  毎日: 'adverb',
  よく: 'adverb',
  時々: 'adverb',
  とても: 'adverb',
  一緒に: 'adverb',
  最近は: 'adverb',
  もうすぐ: 'adverb',
  今から: 'adverb',
  好き: 'na_adj',
  嫌い: 'na_adj',
  上手: 'na_adj',
  下手: 'na_adj',
  大切: 'na_adj',
  重要: 'na_adj',
  難しい: 'i_adj',
  面白い: 'i_adj',
  楽しい: 'i_adj',
  食べる: 'verb',
  飲む: 'verb',
  読む: 'verb',
  見る: 'verb',
  行く: 'verb',
  買う: 'verb',
  作る: 'verb',
  聞く: 'verb',
  会う: 'verb',
  待つ: 'verb',
  使う: 'verb',
  話す: 'verb',
  撮る: 'verb',
  借りる: 'verb',
  勉強する: 'verb',
  リンゴ: 'noun',
  パン: 'noun',
}

/** Map ます-form predicate stems to dictionary verbs */
const MASU_TO_DICTIONARY: Record<string, string> = {
  食べます: '食べる',
  飲みます: '飲む',
  読みます: '読む',
  見ます: '見る',
  行きます: '行く',
  買います: '買う',
  作ります: '作る',
  聞きます: '聞く',
  会います: '会う',
  待ちます: '待つ',
  使います: '使う',
  話します: '話す',
  撮ります: '撮る',
  借ります: '借りる',
  勉強します: '勉強する',
  します: 'する',
}

function collectWords(): Set<string> {
  const words = new Set<string>()

  for (const subject of HERO_SUBJECTS) words.add(subject)

  for (const template of HERO_TEMPLATES) {
    for (const word of template.words) words.add(word)
    if (template.modifier) words.add(template.modifier)
    if (template.prefix) words.add(template.prefix)
    if (template.bridge) words.add(template.bridge)
    words.add(template.predicate)
  }

  for (const card of allCards) {
    if (card.type !== 'vocab' && card.type !== 'kanji') continue
    if (card.front && /^[\u4e00-\u9fff\u3040-\u30ffー]+$/u.test(card.front)) {
      words.add(card.front)
    }
  }

  for (const dict of Object.values(MASU_TO_DICTIONARY)) words.add(dict)
  for (const word of Object.keys(MANUAL_POS)) words.add(word)

  return words
}

function stripAuxiliary(surface: string): string {
  for (const suffix of SORTED_AUXILIARIES) {
    if (surface.endsWith(suffix) && surface.length > suffix.length) {
      return surface.slice(0, -suffix.length)
    }
  }
  return surface
}

function tagWord(
  word: string,
  tokenizer: { tokenize: (s: string) => Array<{
    surface_form: string
    pos: string
    pos_detail_1?: string
    conjugation_type?: string
    basic_form?: string
  }> },
): TokenPos {
  if (MANUAL_POS[word]) return MANUAL_POS[word]

  const tokens = tokenizer.tokenize(word)
  if (tokens.length === 0) return 'other'

  const primary = tokens[0]
  let pos = kuromojiPosToCategory(
    primary.pos,
    primary.pos_detail_1,
    primary.conjugation_type,
  )

  if (pos === 'other' && primary.basic_form && primary.basic_form !== '*') {
    pos = kuromojiPosToCategory(
      primary.pos,
      primary.pos_detail_1,
      primary.conjugation_type,
    )
  }

  // Multi-token phrases (te-form modifiers) — treat as adverb/other, not swappable as unit
  if (tokens.length > 1 && word.includes('、')) return 'adverb'
  if (tokens.length > 1 && word.length >= 4) return 'other'

  return pos
}

async function buildTokenizer() {
  const dicPath = resolve(__dirname, '../node_modules/kuromoji/dict')
  return new Promise<ReturnType<typeof kuromoji.builder> extends { build: (cb: (e: Error | null, t: infer T) => void) => void } ? T : never>(
    (resolvePromise, reject) => {
      kuromoji.builder({ dicPath }).build((err: Error | null, tokenizer: unknown) => {
        if (err) reject(err)
        else resolvePromise(tokenizer as never)
      })
    },
  )
}

async function main() {
  const words = collectWords()
  const tokenizer = await buildTokenizer()

  const index: Record<string, TokenPos> = {}
  const vocab: Record<PosCategory, Set<string>> = {
    noun: new Set(),
    verb: new Set(),
    i_adj: new Set(),
    na_adj: new Set(),
    adverb: new Set(),
    pronoun: new Set(),
  }

  for (const word of words) {
    if (!word || word === '___') continue

    // Skip single-character noise unless manually curated
    if (word.length === 1 && !MANUAL_POS[word]) continue

    // Predicate → dictionary verb
    if (MASU_TO_DICTIONARY[word]) {
      const dict = MASU_TO_DICTIONARY[word]
      index[word] = 'verb'
      vocab.verb.add(dict)
      index[dict] = 'verb'
      continue
    }

    // Na/i adjective predicates (好きです, 難しいです)
    const stem = stripAuxiliary(word)
    if (MANUAL_POS[stem]) {
      const cat = MANUAL_POS[stem]
      index[word] = cat
      index[stem] = cat
      vocab[cat].add(stem)
      continue
    }

    const pos = tagWord(word, tokenizer)
    index[word] = pos

    if (SWAPPABLE.includes(pos as PosCategory)) {
      const entry = pos === 'verb' && word.endsWith('ます')
        ? (MASU_TO_DICTIONARY[word] ?? stem)
        : stem
      vocab[pos as PosCategory].add(entry || word)
    }
  }

  // Ensure pronouns from subjects
  for (const subject of HERO_SUBJECTS) {
    const cat: PosCategory = ['私', '彼', '彼女', 'みんな'].includes(subject)
      ? 'pronoun'
      : 'noun'
    index[subject] = cat
    vocab[cat].add(subject)
  }

  const sort = (arr: Set<string>) => [...arr].sort((a, b) => a.localeCompare(b, 'ja'))

  const file = `/**
 * POS-tagged vocabulary for hero sentence rotation.
 * Regenerate with: npm run generate:hero-pos
 */
import type { PosCategory, PosVocabulary } from '../lib/japanesePos/types'

export const HERO_POS_VOCABULARY: PosVocabulary = {
  noun: ${JSON.stringify(sort(vocab.noun), null, 2).replace(/\n/g, '\n  ')},
  verb: ${JSON.stringify(sort(vocab.verb), null, 2).replace(/\n/g, '\n  ')},
  i_adj: ${JSON.stringify(sort(vocab.i_adj), null, 2).replace(/\n/g, '\n  ')},
  na_adj: ${JSON.stringify(sort(vocab.na_adj), null, 2).replace(/\n/g, '\n  ')},
  adverb: ${JSON.stringify(sort(vocab.adverb), null, 2).replace(/\n/g, '\n  ')},
  pronoun: ${JSON.stringify(sort(vocab.pronoun), null, 2).replace(/\n/g, '\n  ')},
}

/** Flat lookup: surface form → POS category */
export const HERO_WORD_POS_INDEX: Record<string, PosCategory | 'particle' | 'auxiliary' | 'other'> = ${JSON.stringify(index, null, 2)}
`

  writeFileSync(OUT_PATH, file, 'utf8')
  console.log(`Wrote ${OUT_PATH}`)
  console.log('Counts:', Object.fromEntries(
    SWAPPABLE.map((k) => [k, vocab[k].size]),
  ))
  console.log('Index entries:', Object.keys(index).length)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
