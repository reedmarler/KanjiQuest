/**
 * Understanding-check words for the Beginner Zone.
 *
 * Once a learner has been through every hiragana row, recognising single
 * characters in isolation is not the same as reading. These are short,
 * everyday words built only from characters taught in the hiragana rows, so
 * a learner traces and reads something that actually means something.
 */

export interface UnderstandingWord {
  word: string
  meaning: string
}

export const hiraganaUnderstandingWords: UnderstandingWord[] = [
  { word: 'あう', meaning: 'to meet' },
  { word: 'いえ', meaning: 'house' },
  { word: 'うえ', meaning: 'up / above' },
  { word: 'あさ', meaning: 'morning' },
  { word: 'くつ', meaning: 'shoes' },
  { word: 'さかな', meaning: 'fish' },
  { word: 'てがみ', meaning: 'letter' },
  { word: 'とけい', meaning: 'clock / watch' },
  { word: 'ねこ', meaning: 'cat' },
  { word: 'はな', meaning: 'flower' },
  { word: 'ひと', meaning: 'person' },
  { word: 'まど', meaning: 'window' },
  { word: 'みみ', meaning: 'ear' },
  { word: 'やま', meaning: 'mountain' },
  { word: 'ゆき', meaning: 'snow' },
  { word: 'よる', meaning: 'night' },
]
