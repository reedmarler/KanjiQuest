import type { StudyCard } from '../lib/types'
import { getKanjiDetail } from '../data/kanjiDetails'
import { getKanjiWordForm } from './kanjiWordForm'

function cardMeaning(card: StudyCard): string {
  return card.back.split('/')[0].trim()
}

/** English translation keyed by exact Japanese example sentence. */
export const kanjiSentenceEnglishMap: Record<string, string> = {
  'あの人は誰ですか。': 'Who is that person?',
  '今日はいい日だね。': "Today's a nice day, huh?",
  '水を飲んでください。': 'Please drink some water.',
  '日本語を学んでいる。': "I'm studying Japanese.",
  'ご飯食べた？': 'Did you eat?',
  '君のことが好きだよ。': 'I like you.',
  '一緒に行こう。': "Let's go together.",
  '駅で待ってるよ。': "I'm waiting at the station.",
  '今日会える？': 'Can we meet today?',
  'ずっと待ってたよ。': "I've been waiting for you.",
  '君のこと思ってた。': 'I was thinking about you.',
  '日本語が少し分かる。': 'I understand a little Japanese.',
  '彼女から日本語を教わった。': 'She taught me Japanese.',
  '彼女は優しい人だ。': "She's a kind person.",
  '元気？最近どう？': 'You good? How have you been lately?',
  '豊富な経験がある。': 'Has a wealth of experience.',
  '大きな影響を与えた。': 'Had a big influence.',
  '妥協点を見つけた。': 'Found a compromise.',
  '発言には矛盾がある。': "There's a contradiction in what was said.",
}

function fallbackSentenceEnglish(card: StudyCard, sentence: string): string | undefined {
  const meaning = cardMeaning(card).split('/')[0].trim().toLowerCase()
  const wordForm = getKanjiWordForm(card)

  if (sentence.startsWith('ちょっと') && wordForm && sentence.includes(wordForm.word)) {
    return `That's a little ${meaning}.`
  }
  if (sentence.startsWith('とても') && wordForm && sentence.includes(wordForm.word)) {
    return `It's very ${meaning}.`
  }
  if (sentence.startsWith('よく') && wordForm && sentence.includes(wordForm.word)) {
    return `I often ${meaning.replace(/ \/ .*/, '')}.`
  }
  if (sentence.endsWith('です。') && wordForm && sentence.includes(wordForm.word)) {
    return `It is ${meaning}.`
  }
  if (sentence.endsWith('です。') && sentence.length > 2) {
    return `It is ${meaning}.`
  }

  const compound = getKanjiDetail(card).compounds[0]
  if (compound && sentence === `${compound.word}。`) {
    return compound.meaning + '.'
  }

  return undefined
}

export function getKanjiSentenceEnglish(card: StudyCard, sentence: string): string | undefined {
  return kanjiSentenceEnglishMap[sentence] ?? fallbackSentenceEnglish(card, sentence)
}
