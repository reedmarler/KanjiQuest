/**
 * Row-quiz words for the Beginner Zone.
 *
 * After every hiragana row the learner gets a small quiz built only from
 * characters they have actually seen so far — the あ row's quiz can only use
 * あいうえお, the か row's quiz can use あいうえお plus かきくけこ, and so on.
 * Every word here uses only the 46 plain hiragana this app teaches (no
 * dakuten/handakuten/youon), so a word is always a valid subset match once
 * its characters have all been introduced.
 */

export interface UnderstandingWord {
  word: string
  meaning: string
}

export const hiraganaWordBank: UnderstandingWord[] = [
  { word: 'あい', meaning: 'love' },
  { word: 'いえ', meaning: 'house' },
  { word: 'うえ', meaning: 'up / above' },
  { word: 'あお', meaning: 'blue' },
  { word: 'あう', meaning: 'to meet' },
  { word: 'おい', meaning: 'nephew' },
  { word: 'かお', meaning: 'face' },
  { word: 'いか', meaning: 'squid' },
  { word: 'あか', meaning: 'red' },
  { word: 'かき', meaning: 'persimmon' },
  { word: 'きく', meaning: 'to listen' },
  { word: 'さけ', meaning: 'alcohol' },
  { word: 'あさ', meaning: 'morning' },
  { word: 'さかな', meaning: 'fish' },
  { word: 'くさ', meaning: 'grass' },
  { word: 'すし', meaning: 'sushi' },
  { word: 'せかい', meaning: 'world' },
  { word: 'そら', meaning: 'sky' },
  { word: 'うそ', meaning: 'lie' },
  { word: 'たこ', meaning: 'octopus' },
  { word: 'いち', meaning: 'one' },
  { word: 'くつ', meaning: 'shoes' },
  { word: 'とけい', meaning: 'clock' },
  { word: 'なつ', meaning: 'summer' },
  { word: 'いぬ', meaning: 'dog' },
  { word: 'ねこ', meaning: 'cat' },
  { word: 'きのう', meaning: 'yesterday' },
  { word: 'はな', meaning: 'flower' },
  { word: 'はと', meaning: 'pigeon' },
  { word: 'ひと', meaning: 'person' },
  { word: 'ふね', meaning: 'boat' },
  { word: 'へや', meaning: 'room' },
  { word: 'ほし', meaning: 'star' },
  { word: 'まつ', meaning: 'pine tree' },
  { word: 'みみ', meaning: 'ear' },
  { word: 'むし', meaning: 'bug' },
  { word: 'くも', meaning: 'cloud' },
  { word: 'もも', meaning: 'peach' },
  { word: 'やま', meaning: 'mountain' },
  { word: 'ゆき', meaning: 'snow' },
  { word: 'よる', meaning: 'night' },
  { word: 'さくら', meaning: 'cherry blossom' },
  { word: 'とり', meaning: 'bird' },
  { word: 'くるま', meaning: 'car' },
  { word: 'そと', meaning: 'outside' },
  { word: 'わたし', meaning: 'I / me' },
  { word: 'かわ', meaning: 'river' },
  { word: 'こころ', meaning: 'heart' },
  { word: 'ふゆ', meaning: 'winter' },
]

export const katakanaWordBank: UnderstandingWord[] = [
  { word: 'アイ', meaning: 'eye' },
  { word: 'エア', meaning: 'air' },
  { word: 'ウエア', meaning: 'wear' },
  { word: 'イカ', meaning: 'squid' },
  { word: 'カカオ', meaning: 'cacao' },
  { word: 'ココア', meaning: 'cocoa' },
  { word: 'スシ', meaning: 'sushi' },
  { word: 'サケ', meaning: 'sake' },
  { word: 'スカイ', meaning: 'sky' },
  { word: 'タコ', meaning: 'octopus' },
  { word: 'テスト', meaning: 'test' },
  { word: 'トイ', meaning: 'toy' },
  { word: 'ナス', meaning: 'eggplant' },
  { word: 'ネコ', meaning: 'cat' },
  { word: 'ニコニコ', meaning: 'smile' },
  { word: 'ハト', meaning: 'pigeon' },
  { word: 'フネ', meaning: 'boat' },
  { word: 'ホシ', meaning: 'star' },
  { word: 'メモ', meaning: 'memo' },
  { word: 'ママ', meaning: 'mama' },
  { word: 'ミニ', meaning: 'mini' },
  { word: 'ヤマ', meaning: 'mountain' },
  { word: 'ユニ', meaning: 'uni' },
  { word: 'ヨコ', meaning: 'side' },
  { word: 'リス', meaning: 'squirrel' },
  { word: 'ラテ', meaning: 'latte' },
  { word: 'ルス', meaning: 'away' },
  { word: 'ワイン', meaning: 'wine' },
  { word: 'カワ', meaning: 'river' },
  { word: 'オン', meaning: 'on' },
]
