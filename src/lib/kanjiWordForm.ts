import { kanjiKanaMap } from '../data/kanjiKana'
import type { StudyCard } from './types'

const KANA_RE = /[\u3040-\u309F\u30A0-\u30FF]/
const KANJI_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]/

export interface KanjiWordForm {
  word: string
  kana: string
}

/** Single-kanji cards that are best learned as a full word (okurigana, etc.). */
export const kanjiWordFormMap: Record<string, KanjiWordForm> = {
  'kanji-n4-hazu': { word: '恥ずかしい', kana: 'はずかしい' },
  'kanji-n4-sabishi': { word: '寂しい', kana: 'さびしい' },
  'kanji-n4-iso': { word: '忙しい', kana: 'いそがしい' },
  'kanji-n4-yasashi': { word: '優しい', kana: 'やさしい' },
  'kanji-n4-hiroi': { word: '広い', kana: 'ひろい' },
  'kanji-n4-chikai': { word: '近い', kana: 'ちかい' },
  'kanji-n4-tooi': { word: '遠い', kana: 'とおい' },
  'kanji-n5-tabe': { word: '食べる', kana: 'たべる' },
  'kanji-n5-nomi': { word: '飲む', kana: 'のむ' },
  'kanji-n5-mi': { word: '見る', kana: 'みる' },
  'kanji-n5-han': { word: '話す', kana: 'はなす' },
  'kanji-n5-i2': { word: '行く', kana: 'いく' },
  'kanji-n5-suki': { word: '好き', kana: 'すき' },
  'kanji-n4-kaeru': { word: '帰る', kana: 'かえる' },
  'kanji-n4-machi': { word: '待つ', kana: 'まつ' },
  'kanji-n4-ai': { word: '会う', kana: 'あう' },
  'kanji-n4-omoi': { word: '思う', kana: 'おもう' },
  'kanji-n4-waka': { word: '分かる', kana: 'わかる' },
  'kanji-n4-oshie': { word: '教える', kana: 'おしえる' },
  'kanji-n4-narai': { word: '習う', kana: 'ならう' },
  'kanji-n4-oyogu': { word: '泳ぐ', kana: 'およぐ' },
  'kanji-n4-hataraku': { word: '働く', kana: 'はたらく' },
  'kanji-n4-hajime': { word: '始める', kana: 'はじめる' },
  'kanji-n4-owari': { word: '終わる', kana: 'おわる' },
  'kanji-n4-tsukau': { word: '使う', kana: 'つかう' },
  'kanji-n4-noru': { word: '乗る', kana: 'のる' },
  'kanji-n4-todoku': { word: '届く', kana: 'とどく' },
}

function isSingleKanji(text: string): boolean {
  const kanji = [...text].filter((ch) => KANJI_RE.test(ch))
  return kanji.length === 1 && text.length === 1
}

/** Full word + kana when the kanji is studied as part of a word, not standalone. */
export function getKanjiWordForm(card: StudyCard): KanjiWordForm | null {
  if (kanjiWordFormMap[card.id]) return kanjiWordFormMap[card.id]

  const hasOkurigana = KANA_RE.test(card.front)
  const kana = kanjiKanaMap[card.id]

  if (hasOkurigana && kana) {
    return { word: card.front, kana }
  }

  if (!isSingleKanji(card.front) && kana) {
    return { word: card.front, kana }
  }

  return null
}

/** How the target kanji is read inside its word form (for context quizzes). */
export function getKanjiReadingInWordForm(card: StudyCard): string | null {
  const wordForm = getKanjiWordForm(card)
  if (!wordForm) return null

  const target = card.front.length === 1 ? card.front : [...card.front].find((ch) => KANJI_RE.test(ch))
  if (!target) return wordForm.kana

  const idx = wordForm.word.indexOf(target)
  if (idx === -1) return wordForm.kana

  const before = wordForm.word.slice(0, idx)
  const after = wordForm.word.slice(idx + target.length)

  let kana = wordForm.kana
  if (before && kana.startsWith(before)) {
    kana = kana.slice(before.length)
  } else {
    const beforeKana = [...before].filter((ch) => KANA_RE.test(ch)).join('')
    if (beforeKana && kana.startsWith(beforeKana)) {
      kana = kana.slice(beforeKana.length)
    }
  }

  if (after) {
    const afterKana = [...after].filter((ch) => KANA_RE.test(ch)).join('')
    if (afterKana && kana.endsWith(afterKana)) {
      kana = kana.slice(0, kana.length - afterKana.length)
    } else if (kana.includes(after)) {
      kana = kana.slice(0, kana.indexOf(after))
    }
  }

  return kana || wordForm.kana
}

export function getKanjiDisplayText(card: StudyCard): string {
  return getKanjiWordForm(card)?.word ?? card.front
}
