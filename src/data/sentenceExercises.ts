import type { JlptLevel } from '../lib/types'

export type SentenceExerciseType = 'sentence-builder'

export interface SentenceExercise {
  id: string
  type: SentenceExerciseType
  /** Word tiles in correct order */
  segments?: string[]
  /** Kana readings parallel to segments — furigana after answering */
  segmentReadings?: string[]
  /** English gloss parallel to segments — shown under kanji after answering */
  segmentMeanings?: string[]
  english: string
  jlpt?: JlptLevel
}

export const sentenceExercises: SentenceExercise[] = [
  {
    id: 'sent-build-ikou',
    type: 'sentence-builder',
    segments: ['一緒に', '行こう。'],
    segmentReadings: ['いっしょに', 'いこう。'],
    segmentMeanings: ['together', "let's go"],
    english: "Let's go together.",
    jlpt: 'N5',
  },
  {
    id: 'sent-build-aeru',
    type: 'sentence-builder',
    segments: ['今日', '会える？'],
    segmentReadings: ['きょう', 'あえる？'],
    segmentMeanings: ['today', 'can meet?'],
    english: 'Can we meet today?',
    jlpt: 'N5',
  },
  {
    id: 'sent-build-matteru',
    type: 'sentence-builder',
    segments: ['駅で', '待ってる', 'よ。'],
    segmentReadings: ['えきで', 'まってる', 'よ。'],
    segmentMeanings: ['at the station', 'waiting', ''],
    english: "I'm waiting at the station.",
    jlpt: 'N5',
  },
  {
    id: 'sent-build-benkyou',
    type: 'sentence-builder',
    segments: ['日本語を', '勉強', 'している。'],
    segmentReadings: ['にほんごを', 'べんきょう', 'している。'],
    segmentMeanings: ['Japanese', 'study', 'doing'],
    english: "I'm studying Japanese.",
    jlpt: 'N5',
  },
  {
    id: 'sent-build-kanojo',
    type: 'sentence-builder',
    segments: ['彼女は', '優しい', '人だ。'],
    segmentReadings: ['かのじょは', 'やさしい', 'ひとだ。'],
    segmentMeanings: ['she', 'kind', 'person'],
    english: 'She is a kind person.',
    jlpt: 'N4',
  },
  {
    id: 'sent-build-kaeru',
    type: 'sentence-builder',
    segments: ['もう', '帰らないと。'],
    segmentReadings: ['もう', 'かえらないと。'],
    segmentMeanings: ['already', 'have to go home'],
    english: 'I have to head home already.',
    jlpt: 'N4',
  },
  {
    id: 'sent-build-renraku',
    type: 'sentence-builder',
    segments: ['着いたら', '連絡', 'して。'],
    segmentReadings: ['ついたら', 'れんらく', 'して。'],
    segmentMeanings: ['when you arrive', 'contact', 'do'],
    english: 'Contact me when you arrive.',
    jlpt: 'N4',
  },
  {
    id: 'sent-build-suki',
    type: 'sentence-builder',
    segments: ['君のことが', '好き', 'だよ。'],
    segmentReadings: ['きみのことが', 'すき', 'だよ。'],
    segmentMeanings: ['you', 'like', ''],
    english: 'I like you.',
    jlpt: 'N5',
  },
  {
    id: 'sent-build-naratta',
    type: 'sentence-builder',
    segments: ['彼女から', '日本語を', '習った。'],
    segmentReadings: ['かのじょから', 'にほんごを', 'ならった。'],
    segmentMeanings: ['from her', 'Japanese', 'learned'],
    english: 'I learned Japanese from her.',
    jlpt: 'N4',
  },
  {
    id: 'sent-build-wakaru',
    type: 'sentence-builder',
    segments: ['日本語が', '少し', '分かる。'],
    segmentReadings: ['にほんごが', 'すこし', 'わかる。'],
    segmentMeanings: ['Japanese', 'a little', 'understand'],
    english: 'I understand a little Japanese.',
    jlpt: 'N5',
  },
  {
    id: 'sent-build-fuan',
    type: 'sentence-builder',
    segments: ['将来が', '不安で', '眠れない。'],
    segmentReadings: ['しょうらいが', 'ふあんで', 'ねむれない。'],
    segmentMeanings: ['future', 'anxious', "can't sleep"],
    english: "I can't sleep because I'm worried about the future.",
    jlpt: 'N3',
  },
  {
    id: 'sent-build-doryoku',
    type: 'sentence-builder',
    segments: ['努力すれば', '必ず', '報われる。'],
    segmentReadings: ['どりょくすれば', 'かならず', 'むくわれる。'],
    segmentMeanings: ['if you try hard', 'surely', 'rewarded'],
    english: 'If you make effort, you will be rewarded.',
    jlpt: 'N3',
  },
]

export function getSentenceExerciseById(id: string): SentenceExercise | undefined {
  return sentenceExercises.find((e) => e.id === id)
}

export function getExercisesByType(type: SentenceExerciseType): SentenceExercise[] {
  return sentenceExercises.filter((e) => e.type === type)
}
