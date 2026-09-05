/**
 * Beginner Zone content.
 *
 * The hook for absolute beginners is the *mnemonic*, not the drill. A blank
 * flashcard asking "what sound is あ?" gives a learner nothing to hold onto,
 * so every character here carries a one-line picture story that links what the
 * character LOOKS like to the sound it MAKES. That is the difference between
 * rote repetition and a beginner recognising a character the second time they
 * see it.
 *
 * Characters are grouped into rows of five, the way the kana chart is actually
 * taught, so the 46-character wall arrives as nine small, finishable chunks.
 */

export type BeginnerScript = 'hiragana' | 'katakana' | 'kanji'

export interface BeginnerCharacter {
  /** The character itself. */
  char: string
  /** How it is pronounced, in romaji. */
  romaji: string
  /** For kanji only: what the character means. */
  meaning?: string
  /** The picture story tying the character's shape to its sound. */
  mnemonic: string
}

export interface BeginnerRow {
  id: string
  /** Row label as it appears on a kana chart — the row's leading character itself, e.g. "あ", "か". */
  label: string
  characters: BeginnerCharacter[]
}

export interface BeginnerDeck {
  script: BeginnerScript
  title: string
  /** Shown on the deck's menu card and its study header. */
  description: string
  rows: BeginnerRow[]
}

const hiraganaRows: BeginnerRow[] = [
  {
    id: 'hiragana-a',
    label: 'あ',
    characters: [
      { char: 'あ', romaji: 'a', mnemonic: 'A capital A with a curl — say "Ahh" as the doctor checks your throat.' },
      { char: 'い', romaji: 'i', mnemonic: 'Two eels swimming side by side. Two "ee"-ls, sound "i".' },
      { char: 'う', romaji: 'u', mnemonic: 'A face in profile looking down — "oooh", it dropped its lunch.' },
      { char: 'え', romaji: 'e', mnemonic: 'An exotic bird with a long neck — an "e"-mu.' },
      { char: 'お', romaji: 'o', mnemonic: 'Like あ but with a lasso on top — the cowboy yells "Oh!"' },
    ],
  },
  {
    id: 'hiragana-ka',
    label: 'か',
    characters: [
      { char: 'か', romaji: 'ka', mnemonic: 'A kite with its string trailing off the side — "ka"-ite.' },
      { char: 'き', romaji: 'ki', mnemonic: 'An old-fashioned key with two teeth — "ki"-y.' },
      { char: 'く', romaji: 'ku', mnemonic: 'A bird\'s open beak about to say "coo".' },
      { char: 'け', romaji: 'ke', mnemonic: 'A keg tipped on its side, tap sticking out — "ke"-g.' },
      { char: 'こ', romaji: 'ko', mnemonic: 'Two curved lines like a coiled rope — "co"-il.' },
    ],
  },
  {
    id: 'hiragana-sa',
    label: 'さ',
    characters: [
      { char: 'さ', romaji: 'sa', mnemonic: 'A person sitting cross-legged sipping "sa"-ke.' },
      { char: 'し', romaji: 'shi', mnemonic: 'A single fishing hook dangling in the water — "shee", quiet, fish nearby.' },
      { char: 'す', romaji: 'su', mnemonic: 'A swirl of noodles on a fork — you "su"-ck them up with a slurp.' },
      { char: 'せ', romaji: 'se', mnemonic: 'A mouth with a tooth sticking out — the dentist says "se"-t still.' },
      { char: 'そ', romaji: 'so', mnemonic: 'A zigzag stitch in fabric — that is how you "so"-w.' },
    ],
  },
  {
    id: 'hiragana-ta',
    label: 'た',
    characters: [
      { char: 'た', romaji: 'ta', mnemonic: 'A lowercase t next to a small a — literally "t-a".' },
      { char: 'ち', romaji: 'chi', mnemonic: 'A chair seen from the side, back curving over — "chi"-air.' },
      { char: 'つ', romaji: 'tsu', mnemonic: 'A wave curling over — a big tsunami, "tsu".' },
      { char: 'て', romaji: 'te', mnemonic: 'A hand held out flat, palm up — in Japanese a hand IS "te".' },
      { char: 'と', romaji: 'to', mnemonic: 'A toe with a splinter of wood stuck in it — "to"-e.' },
    ],
  },
  {
    id: 'hiragana-na',
    label: 'な',
    characters: [
      { char: 'な', romaji: 'na', mnemonic: 'A nun kneeling in prayer beside a cross — "na"-n.' },
      { char: 'に', romaji: 'ni', mnemonic: 'Two people kneeling on their knees — "ni"-es.' },
      { char: 'ぬ', romaji: 'nu', mnemonic: 'A bowl of noodles with a loop of pasta hanging off — "nu"-dles.' },
      { char: 'ね', romaji: 'ne', mnemonic: 'A cat with a curled-up tail, snake-like — "ne"-ko is cat.' },
      { char: 'の', romaji: 'no', mnemonic: 'A single "no entry" sign, one bold slash through it.' },
    ],
  },
  {
    id: 'hiragana-ha',
    label: 'は',
    characters: [
      { char: 'は', romaji: 'ha', mnemonic: 'A lowercase h next to a small a — "h-a", ha!' },
      { char: 'ひ', romaji: 'hi', mnemonic: 'A wide grinning mouth — someone saying "hee hee".' },
      { char: 'ふ', romaji: 'fu', mnemonic: 'Mount Fuji with clouds drifting past its slopes — "Fu"-ji.' },
      { char: 'へ', romaji: 'he', mnemonic: 'A gentle hill on the horizon — you "he"-ave climbing it.' },
      { char: 'ほ', romaji: 'ho', mnemonic: 'は with an extra bar — a house with a chimney, "ho"-me.' },
    ],
  },
  {
    id: 'hiragana-ma',
    label: 'ま',
    characters: [
      { char: 'ま', romaji: 'ma', mnemonic: 'Two arms crossed and a curl — "ma"-ma with her hair in a bun.' },
      { char: 'み', romaji: 'mi', mnemonic: 'The number 21 on its side — that is "mi"-ne, 21 is my age.' },
      { char: 'む', romaji: 'mu', mnemonic: 'A cow with a curly tail chewing grass — "mu"-uuu.' },
      { char: 'め', romaji: 'me', mnemonic: 'An eye with a loop of lash — an eye is "me" in Japanese.' },
      { char: 'も', romaji: 'mo', mnemonic: 'A fishing hook with two worms on it — you want "mo"-re fish.' },
    ],
  },
  {
    id: 'hiragana-ya',
    label: 'や',
    characters: [
      { char: 'や', romaji: 'ya', mnemonic: 'A yak with horns leaning to one side — "ya"-k.' },
      { char: 'ゆ', romaji: 'yu', mnemonic: 'A fish caught on a hook, swimming loop — a "u"-nique fish, "yu".' },
      { char: 'よ', romaji: 'yo', mnemonic: 'A yo-yo hanging on its string, mid-drop — "yo".' },
    ],
  },
  {
    id: 'hiragana-ra',
    label: 'ら',
    characters: [
      { char: 'ら', romaji: 'ra', mnemonic: 'A rabbit sitting up, ear flopped forward — "ra"-bbit.' },
      { char: 'り', romaji: 'ri', mnemonic: 'Two strokes like a reed bending in the river — "ri"-ver reed.' },
      { char: 'る', romaji: 'ru', mnemonic: 'A loop-the-loop route on a road map — "ru"-te.' },
      { char: 'れ', romaji: 're', mnemonic: 'Like る but the loop escapes — the runner "re"-treats.' },
      { char: 'ろ', romaji: 'ro', mnemonic: 'る without its loop — an open "ro"-ad going nowhere.' },
    ],
  },
  {
    id: 'hiragana-wa',
    label: 'わ',
    characters: [
      { char: 'わ', romaji: 'wa', mnemonic: 'A wine glass tipping over — "wa", spilled it.' },
      { char: 'を', romaji: 'wo', mnemonic: 'A person throwing a boomerang — "whoa", it came back.' },
      { char: 'ん', romaji: 'n', mnemonic: 'A single lazy squiggle — the sound you hum, "nnn".' },
    ],
  },
  {
    id: 'hiragana-ga',
    label: 'が',
    characters: [
      { char: 'が', romaji: 'ga', mnemonic: 'Add dakuten to か: the two marks make "ka" buzz into "ga".' },
      { char: 'ぎ', romaji: 'gi', mnemonic: 'Add dakuten to き: "ki" becomes the voiced sound "gi".' },
      { char: 'ぐ', romaji: 'gu', mnemonic: 'Add dakuten to く: "ku" becomes the voiced sound "gu".' },
      { char: 'げ', romaji: 'ge', mnemonic: 'Add dakuten to け: "ke" becomes the voiced sound "ge".' },
      { char: 'ご', romaji: 'go', mnemonic: 'Add dakuten to こ: "ko" becomes the voiced sound "go".' },
    ],
  },
  {
    id: 'hiragana-za',
    label: 'ざ',
    characters: [
      { char: 'ざ', romaji: 'za', mnemonic: 'Add dakuten to さ: "sa" buzzes into "za".' },
      { char: 'じ', romaji: 'ji', mnemonic: 'Add dakuten to し: "shi" becomes "ji".' },
      { char: 'ず', romaji: 'zu', mnemonic: 'Add dakuten to す: "su" becomes "zu".' },
      { char: 'ぜ', romaji: 'ze', mnemonic: 'Add dakuten to せ: "se" becomes "ze".' },
      { char: 'ぞ', romaji: 'zo', mnemonic: 'Add dakuten to そ: "so" becomes "zo".' },
    ],
  },
  {
    id: 'hiragana-da',
    label: 'だ',
    characters: [
      { char: 'だ', romaji: 'da', mnemonic: 'Add dakuten to た: "ta" becomes "da".' },
      { char: 'ぢ', romaji: 'ji', mnemonic: 'Add dakuten to ち: this uncommon kana is usually pronounced "ji".' },
      { char: 'づ', romaji: 'zu', mnemonic: 'Add dakuten to つ: this uncommon kana is usually pronounced "zu".' },
      { char: 'で', romaji: 'de', mnemonic: 'Add dakuten to て: "te" becomes "de".' },
      { char: 'ど', romaji: 'do', mnemonic: 'Add dakuten to と: "to" becomes "do".' },
    ],
  },
  {
    id: 'hiragana-ba',
    label: 'ば',
    characters: [
      { char: 'ば', romaji: 'ba', mnemonic: 'Add dakuten to は: "ha" becomes "ba".' },
      { char: 'び', romaji: 'bi', mnemonic: 'Add dakuten to ひ: "hi" becomes "bi".' },
      { char: 'ぶ', romaji: 'bu', mnemonic: 'Add dakuten to ふ: "fu" becomes "bu".' },
      { char: 'べ', romaji: 'be', mnemonic: 'Add dakuten to へ: "he" becomes "be".' },
      { char: 'ぼ', romaji: 'bo', mnemonic: 'Add dakuten to ほ: "ho" becomes "bo".' },
    ],
  },
  {
    id: 'hiragana-pa',
    label: 'ぱ',
    characters: [
      { char: 'ぱ', romaji: 'pa', mnemonic: 'Add the small handakuten circle to は: "ha" pops into "pa".' },
      { char: 'ぴ', romaji: 'pi', mnemonic: 'Add the small circle to ひ: "hi" pops into "pi".' },
      { char: 'ぷ', romaji: 'pu', mnemonic: 'Add the small circle to ふ: "fu" pops into "pu".' },
      { char: 'ぺ', romaji: 'pe', mnemonic: 'Add the small circle to へ: "he" pops into "pe".' },
      { char: 'ぽ', romaji: 'po', mnemonic: 'Add the small circle to ほ: "ho" pops into "po".' },
    ],
  },
  /*
   * Yōon: an -i row kana with a small や/ゆ/よ tucked beside it, collapsing
   * the two into one syllable — きい followed by や read separately is not
   * this, きゃ said as one beat is. The rule, not a new picture, is the
   * mnemonic here, same as the dakuten and handakuten rows above it.
   */
  {
    id: 'hiragana-kya',
    label: 'きゃ',
    characters: [
      { char: 'きゃ', romaji: 'kya', mnemonic: 'き with a small や tucked beside it: "ki" glides into one beat, "kya".' },
      { char: 'きゅ', romaji: 'kyu', mnemonic: 'き with a small ゆ tucked beside it: "ki" glides into one beat, "kyu".' },
      { char: 'きょ', romaji: 'kyo', mnemonic: 'き with a small よ tucked beside it: "ki" glides into one beat, "kyo".' },
    ],
  },
  {
    id: 'hiragana-sha',
    label: 'しゃ',
    characters: [
      { char: 'しゃ', romaji: 'sha', mnemonic: 'し with a small や tucked beside it: "shi" glides into one beat, "sha".' },
      { char: 'しゅ', romaji: 'shu', mnemonic: 'し with a small ゆ tucked beside it: "shi" glides into one beat, "shu".' },
      { char: 'しょ', romaji: 'sho', mnemonic: 'し with a small よ tucked beside it: "shi" glides into one beat, "sho".' },
    ],
  },
  {
    id: 'hiragana-cha',
    label: 'ちゃ',
    characters: [
      { char: 'ちゃ', romaji: 'cha', mnemonic: 'ち with a small や tucked beside it: "chi" glides into one beat, "cha".' },
      { char: 'ちゅ', romaji: 'chu', mnemonic: 'ち with a small ゆ tucked beside it: "chi" glides into one beat, "chu".' },
      { char: 'ちょ', romaji: 'cho', mnemonic: 'ち with a small よ tucked beside it: "chi" glides into one beat, "cho".' },
    ],
  },
  {
    id: 'hiragana-nya',
    label: 'にゃ',
    characters: [
      { char: 'にゃ', romaji: 'nya', mnemonic: 'に with a small や tucked beside it: "ni" glides into one beat, "nya".' },
      { char: 'にゅ', romaji: 'nyu', mnemonic: 'に with a small ゆ tucked beside it: "ni" glides into one beat, "nyu".' },
      { char: 'にょ', romaji: 'nyo', mnemonic: 'に with a small よ tucked beside it: "ni" glides into one beat, "nyo".' },
    ],
  },
  {
    id: 'hiragana-hya',
    label: 'ひゃ',
    characters: [
      { char: 'ひゃ', romaji: 'hya', mnemonic: 'ひ with a small や tucked beside it: "hi" glides into one beat, "hya".' },
      { char: 'ひゅ', romaji: 'hyu', mnemonic: 'ひ with a small ゆ tucked beside it: "hi" glides into one beat, "hyu".' },
      { char: 'ひょ', romaji: 'hyo', mnemonic: 'ひ with a small よ tucked beside it: "hi" glides into one beat, "hyo".' },
    ],
  },
  {
    id: 'hiragana-mya',
    label: 'みゃ',
    characters: [
      { char: 'みゃ', romaji: 'mya', mnemonic: 'み with a small や tucked beside it: "mi" glides into one beat, "mya".' },
      { char: 'みゅ', romaji: 'myu', mnemonic: 'み with a small ゆ tucked beside it: "mi" glides into one beat, "myu".' },
      { char: 'みょ', romaji: 'myo', mnemonic: 'み with a small よ tucked beside it: "mi" glides into one beat, "myo".' },
    ],
  },
  {
    id: 'hiragana-rya',
    label: 'りゃ',
    characters: [
      { char: 'りゃ', romaji: 'rya', mnemonic: 'り with a small や tucked beside it: "ri" glides into one beat, "rya".' },
      { char: 'りゅ', romaji: 'ryu', mnemonic: 'り with a small ゆ tucked beside it: "ri" glides into one beat, "ryu".' },
      { char: 'りょ', romaji: 'ryo', mnemonic: 'り with a small よ tucked beside it: "ri" glides into one beat, "ryo".' },
    ],
  },
  {
    id: 'hiragana-gya',
    label: 'ぎゃ',
    characters: [
      { char: 'ぎゃ', romaji: 'gya', mnemonic: 'ぎ with a small や tucked beside it: the voiced "gi" glides into one beat, "gya".' },
      { char: 'ぎゅ', romaji: 'gyu', mnemonic: 'ぎ with a small ゆ tucked beside it: the voiced "gi" glides into one beat, "gyu".' },
      { char: 'ぎょ', romaji: 'gyo', mnemonic: 'ぎ with a small よ tucked beside it: the voiced "gi" glides into one beat, "gyo".' },
    ],
  },
  {
    id: 'hiragana-ja',
    label: 'じゃ',
    characters: [
      { char: 'じゃ', romaji: 'ja', mnemonic: 'じ with a small や tucked beside it: the voiced "ji" glides into one beat, "ja".' },
      { char: 'じゅ', romaji: 'ju', mnemonic: 'じ with a small ゆ tucked beside it: the voiced "ji" glides into one beat, "ju".' },
      { char: 'じょ', romaji: 'jo', mnemonic: 'じ with a small よ tucked beside it: the voiced "ji" glides into one beat, "jo".' },
    ],
  },
  {
    id: 'hiragana-bya',
    label: 'びゃ',
    characters: [
      { char: 'びゃ', romaji: 'bya', mnemonic: 'び with a small や tucked beside it: the voiced "bi" glides into one beat, "bya".' },
      { char: 'びゅ', romaji: 'byu', mnemonic: 'び with a small ゆ tucked beside it: the voiced "bi" glides into one beat, "byu".' },
      { char: 'びょ', romaji: 'byo', mnemonic: 'び with a small よ tucked beside it: the voiced "bi" glides into one beat, "byo".' },
    ],
  },
  {
    id: 'hiragana-pya',
    label: 'ぴゃ',
    characters: [
      { char: 'ぴゃ', romaji: 'pya', mnemonic: 'ぴ with a small や tucked beside it: the popped "pi" glides into one beat, "pya".' },
      { char: 'ぴゅ', romaji: 'pyu', mnemonic: 'ぴ with a small ゆ tucked beside it: the popped "pi" glides into one beat, "pyu".' },
      { char: 'ぴょ', romaji: 'pyo', mnemonic: 'ぴ with a small よ tucked beside it: the popped "pi" glides into one beat, "pyo".' },
    ],
  },
]

const katakanaRows: BeginnerRow[] = [
  {
    id: 'katakana-a',
    label: 'ア',
    characters: [
      { char: 'ア', romaji: 'a', mnemonic: 'An axe head on a handle — "a"-xe. Sharp and angular, like all katakana.' },
      { char: 'イ', romaji: 'i', mnemonic: 'An eagle\'s beak in profile — "ea"-gle, sound "i".' },
      { char: 'ウ', romaji: 'u', mnemonic: 'A person in a hooded cloak, head down — "oooh", spooky.' },
      { char: 'エ', romaji: 'e', mnemonic: 'A steel girder from an "e"-levator shaft, capital I on its side.' },
      { char: 'オ', romaji: 'o', mnemonic: 'A shrine gate with an offering leaning on it — "o"-ffering.' },
    ],
  },
  {
    id: 'katakana-ka',
    label: 'カ',
    characters: [
      { char: 'カ', romaji: 'ka', mnemonic: 'Same "ka"-ite as か, but folded sharp and paper-like.' },
      { char: 'キ', romaji: 'ki', mnemonic: 'A key with two notches — the angular twin of き.' },
      { char: 'ク', romaji: 'ku', mnemonic: 'A sharp beak snapping — "ku", clipped and quick.' },
      { char: 'ケ', romaji: 'ke', mnemonic: 'A keg on its side with the tap knocked off — "ke"-g.' },
      { char: 'コ', romaji: 'ko', mnemonic: 'A corner bracket, two straight edges — "co"-rner.' },
    ],
  },
  {
    id: 'katakana-sa',
    label: 'サ',
    characters: [
      { char: 'サ', romaji: 'sa', mnemonic: 'A samurai\'s crossed swords — "sa"-murai.' },
      { char: 'シ', romaji: 'shi', mnemonic: 'Two dashes and a swoop going UP — she smiles, "shi".' },
      { char: 'ス', romaji: 'su', mnemonic: 'A ski slope with a skier carving down — "su"-ki.' },
      { char: 'セ', romaji: 'se', mnemonic: 'The angular twin of せ — a tooth in a "se"-t of jaws.' },
      { char: 'ソ', romaji: 'so', mnemonic: 'Two dashes and a swoop going DOWN — sew a stitch, "so".' },
    ],
  },
  {
    id: 'katakana-ta',
    label: 'タ',
    characters: [
      { char: 'タ', romaji: 'ta', mnemonic: 'A tie hanging with the knot at top — "ta"-ie.' },
      { char: 'チ', romaji: 'chi', mnemonic: 'A cheerleader mid-jump, arms out — "chee"-r.' },
      { char: 'ツ', romaji: 'tsu', mnemonic: 'Two dashes and a swoop UP — a tsunami rising. Compare シ carefully.' },
      { char: 'テ', romaji: 'te', mnemonic: 'A telephone pole with two crossbars — "te"-lephone.' },
      { char: 'ト', romaji: 'to', mnemonic: 'A toe with a splinter, drawn with a ruler — "to"-e.' },
    ],
  },
  {
    id: 'katakana-na',
    label: 'ナ',
    characters: [
      { char: 'ナ', romaji: 'na', mnemonic: 'A knife with a crossguard — "kna"-ife.' },
      { char: 'ニ', romaji: 'ni', mnemonic: 'Two straight lines — and "ni" means two in Japanese.' },
      { char: 'ヌ', romaji: 'nu', mnemonic: 'Noodles sliding off chopsticks — "nu"-dles.' },
      { char: 'ネ', romaji: 'ne', mnemonic: 'A nest up in a bare tree — "ne"-st.' },
      { char: 'ノ', romaji: 'no', mnemonic: 'A single bold slash — "no", nothing more to it.' },
    ],
  },
  {
    id: 'katakana-ha',
    label: 'ハ',
    characters: [
      { char: 'ハ', romaji: 'ha', mnemonic: 'Two strokes like a laughing mouth open wide — "ha ha".' },
      { char: 'ヒ', romaji: 'hi', mnemonic: 'A heel of a boot in profile — "hee"-l.' },
      { char: 'フ', romaji: 'fu', mnemonic: 'The slope of Mount Fuji, one clean line — "Fu"-ji.' },
      { char: 'ヘ', romaji: 'he', mnemonic: 'The same hill as へ — the two scripts share this one.' },
      { char: 'ホ', romaji: 'ho', mnemonic: 'A holy cross with supports — "ho"-ly.' },
    ],
  },
  {
    id: 'katakana-ma',
    label: 'マ',
    characters: [
      { char: 'マ', romaji: 'ma', mnemonic: 'A magic wand tip with a sparkle — "ma"-gic.' },
      { char: 'ミ', romaji: 'mi', mnemonic: 'Three lines — three stripes on a military "mi"-litary badge.' },
      { char: 'ム', romaji: 'mu', mnemonic: 'A cow\'s open mouth from the front — "mu"-uuu.' },
      { char: 'メ', romaji: 'me', mnemonic: 'Crossed swords — a duel that leaves a mark on "me".' },
      { char: 'モ', romaji: 'mo', mnemonic: 'The angular twin of も — a hook wanting "mo"-re.' },
    ],
  },
  {
    id: 'katakana-ya',
    label: 'ヤ',
    characters: [
      { char: 'ヤ', romaji: 'ya', mnemonic: 'A yacht with a mast and boom — "ya"-cht.' },
      { char: 'ユ', romaji: 'yu', mnemonic: 'A U-turn sign drawn with straight edges — "yu".' },
      { char: 'ヨ', romaji: 'yo', mnemonic: 'A fork with three prongs — "yo", pass the fork.' },
    ],
  },
  {
    id: 'katakana-ra',
    label: 'ラ',
    characters: [
      { char: 'ラ', romaji: 'ra', mnemonic: 'A rabbit\'s ears folded back flat — "ra"-bbit.' },
      { char: 'リ', romaji: 'ri', mnemonic: 'Two reeds standing straight in the river — "ri"-ver.' },
      { char: 'ル', romaji: 'ru', mnemonic: 'Two legs running a route — "ru"-n.' },
      { char: 'レ', romaji: 're', mnemonic: 'A single bent line, like a "re"-clining chair back.' },
      { char: 'ロ', romaji: 'ro', mnemonic: 'A perfect square — a "ro"-om seen from above.' },
    ],
  },
  {
    id: 'katakana-wa',
    label: 'ワ・ン',
    characters: [
      { char: 'ワ', romaji: 'wa', mnemonic: 'A wine glass, angular and empty — "wa", drank it.' },
      { char: 'ヲ', romaji: 'wo', mnemonic: 'Rare in modern Japanese — a boomerang thrown flat, "whoa".' },
      { char: 'ン', romaji: 'n', mnemonic: 'Two dashes swooping UP — hum "nnn". Compare ソ, which swoops down.' },
    ],
  },
  {
    id: 'katakana-ga',
    label: 'ガ',
    characters: [
      { char: 'ガ', romaji: 'ga', mnemonic: 'Add dakuten to カ: "ka" buzzes into "ga".' },
      { char: 'ギ', romaji: 'gi', mnemonic: 'Add dakuten to キ: "ki" becomes "gi".' },
      { char: 'グ', romaji: 'gu', mnemonic: 'Add dakuten to ク: "ku" becomes "gu".' },
      { char: 'ゲ', romaji: 'ge', mnemonic: 'Add dakuten to ケ: "ke" becomes "ge".' },
      { char: 'ゴ', romaji: 'go', mnemonic: 'Add dakuten to コ: "ko" becomes "go".' },
    ],
  },
  {
    id: 'katakana-za',
    label: 'ザ',
    characters: [
      { char: 'ザ', romaji: 'za', mnemonic: 'Add dakuten to サ: "sa" buzzes into "za".' },
      { char: 'ジ', romaji: 'ji', mnemonic: 'Add dakuten to シ: "shi" becomes "ji".' },
      { char: 'ズ', romaji: 'zu', mnemonic: 'Add dakuten to ス: "su" becomes "zu".' },
      { char: 'ゼ', romaji: 'ze', mnemonic: 'Add dakuten to セ: "se" becomes "ze".' },
      { char: 'ゾ', romaji: 'zo', mnemonic: 'Add dakuten to ソ: "so" becomes "zo".' },
    ],
  },
  {
    id: 'katakana-da',
    label: 'ダ',
    characters: [
      { char: 'ダ', romaji: 'da', mnemonic: 'Add dakuten to タ: "ta" becomes "da".' },
      { char: 'ヂ', romaji: 'ji', mnemonic: 'Add dakuten to チ: this uncommon kana is usually pronounced "ji".' },
      { char: 'ヅ', romaji: 'zu', mnemonic: 'Add dakuten to ツ: this uncommon kana is usually pronounced "zu".' },
      { char: 'デ', romaji: 'de', mnemonic: 'Add dakuten to テ: "te" becomes "de".' },
      { char: 'ド', romaji: 'do', mnemonic: 'Add dakuten to ト: "to" becomes "do".' },
    ],
  },
  {
    id: 'katakana-ba',
    label: 'バ',
    characters: [
      { char: 'バ', romaji: 'ba', mnemonic: 'Add dakuten to ハ: "ha" becomes "ba".' },
      { char: 'ビ', romaji: 'bi', mnemonic: 'Add dakuten to ヒ: "hi" becomes "bi".' },
      { char: 'ブ', romaji: 'bu', mnemonic: 'Add dakuten to フ: "fu" becomes "bu".' },
      { char: 'ベ', romaji: 'be', mnemonic: 'Add dakuten to ヘ: "he" becomes "be".' },
      { char: 'ボ', romaji: 'bo', mnemonic: 'Add dakuten to ホ: "ho" becomes "bo".' },
    ],
  },
  {
    id: 'katakana-pa',
    label: 'パ',
    characters: [
      { char: 'パ', romaji: 'pa', mnemonic: 'Add the small handakuten circle to ハ: "ha" pops into "pa".' },
      { char: 'ピ', romaji: 'pi', mnemonic: 'Add the small circle to ヒ: "hi" pops into "pi".' },
      { char: 'プ', romaji: 'pu', mnemonic: 'Add the small circle to フ: "fu" pops into "pu".' },
      { char: 'ペ', romaji: 'pe', mnemonic: 'Add the small circle to ヘ: "he" pops into "pe".' },
      { char: 'ポ', romaji: 'po', mnemonic: 'Add the small circle to ホ: "ho" pops into "po".' },
    ],
  },
  /* Same yōon rule as the hiragana set — an -i row kana with a small
     ャ/ュ/ョ tucked beside it, collapsing the two into one beat. */
  {
    id: 'katakana-kya',
    label: 'キャ',
    characters: [
      { char: 'キャ', romaji: 'kya', mnemonic: 'キ with a small ャ tucked beside it: "ki" glides into one beat, "kya".' },
      { char: 'キュ', romaji: 'kyu', mnemonic: 'キ with a small ュ tucked beside it: "ki" glides into one beat, "kyu".' },
      { char: 'キョ', romaji: 'kyo', mnemonic: 'キ with a small ョ tucked beside it: "ki" glides into one beat, "kyo".' },
    ],
  },
  {
    id: 'katakana-sha',
    label: 'シャ',
    characters: [
      { char: 'シャ', romaji: 'sha', mnemonic: 'シ with a small ャ tucked beside it: "shi" glides into one beat, "sha".' },
      { char: 'シュ', romaji: 'shu', mnemonic: 'シ with a small ュ tucked beside it: "shi" glides into one beat, "shu".' },
      { char: 'ショ', romaji: 'sho', mnemonic: 'シ with a small ョ tucked beside it: "shi" glides into one beat, "sho".' },
      { char: 'シェ', romaji: 'she', mnemonic: 'シ with a small ェ tucked beside it: a loanword-only beat, "she" — as in シェフ (chef).' },
    ],
  },
  {
    id: 'katakana-cha',
    label: 'チャ',
    characters: [
      { char: 'チャ', romaji: 'cha', mnemonic: 'チ with a small ャ tucked beside it: "chi" glides into one beat, "cha".' },
      { char: 'チュ', romaji: 'chu', mnemonic: 'チ with a small ュ tucked beside it: "chi" glides into one beat, "chu".' },
      { char: 'チョ', romaji: 'cho', mnemonic: 'チ with a small ョ tucked beside it: "chi" glides into one beat, "cho".' },
      { char: 'チェ', romaji: 'che', mnemonic: 'チ with a small ェ tucked beside it: a loanword-only beat, "che" — as in チェス (chess).' },
    ],
  },
  {
    id: 'katakana-nya',
    label: 'ニャ',
    characters: [
      { char: 'ニャ', romaji: 'nya', mnemonic: 'ニ with a small ャ tucked beside it: "ni" glides into one beat, "nya".' },
      { char: 'ニュ', romaji: 'nyu', mnemonic: 'ニ with a small ュ tucked beside it: "ni" glides into one beat, "nyu".' },
      { char: 'ニョ', romaji: 'nyo', mnemonic: 'ニ with a small ョ tucked beside it: "ni" glides into one beat, "nyo".' },
    ],
  },
  {
    id: 'katakana-hya',
    label: 'ヒャ',
    characters: [
      { char: 'ヒャ', romaji: 'hya', mnemonic: 'ヒ with a small ャ tucked beside it: "hi" glides into one beat, "hya".' },
      { char: 'ヒュ', romaji: 'hyu', mnemonic: 'ヒ with a small ュ tucked beside it: "hi" glides into one beat, "hyu".' },
      { char: 'ヒョ', romaji: 'hyo', mnemonic: 'ヒ with a small ョ tucked beside it: "hi" glides into one beat, "hyo".' },
    ],
  },
  {
    id: 'katakana-mya',
    label: 'ミャ',
    characters: [
      { char: 'ミャ', romaji: 'mya', mnemonic: 'ミ with a small ャ tucked beside it: "mi" glides into one beat, "mya".' },
      { char: 'ミュ', romaji: 'myu', mnemonic: 'ミ with a small ュ tucked beside it: "mi" glides into one beat, "myu".' },
      { char: 'ミョ', romaji: 'myo', mnemonic: 'ミ with a small ョ tucked beside it: "mi" glides into one beat, "myo".' },
    ],
  },
  {
    id: 'katakana-rya',
    label: 'リャ',
    characters: [
      { char: 'リャ', romaji: 'rya', mnemonic: 'リ with a small ャ tucked beside it: "ri" glides into one beat, "rya".' },
      { char: 'リュ', romaji: 'ryu', mnemonic: 'リ with a small ュ tucked beside it: "ri" glides into one beat, "ryu".' },
      { char: 'リョ', romaji: 'ryo', mnemonic: 'リ with a small ョ tucked beside it: "ri" glides into one beat, "ryo".' },
    ],
  },
  {
    id: 'katakana-gya',
    label: 'ギャ',
    characters: [
      { char: 'ギャ', romaji: 'gya', mnemonic: 'ギ with a small ャ tucked beside it: the voiced "gi" glides into one beat, "gya".' },
      { char: 'ギュ', romaji: 'gyu', mnemonic: 'ギ with a small ュ tucked beside it: the voiced "gi" glides into one beat, "gyu".' },
      { char: 'ギョ', romaji: 'gyo', mnemonic: 'ギ with a small ョ tucked beside it: the voiced "gi" glides into one beat, "gyo".' },
    ],
  },
  {
    id: 'katakana-ja',
    label: 'ジャ',
    characters: [
      { char: 'ジャ', romaji: 'ja', mnemonic: 'ジ with a small ャ tucked beside it: the voiced "ji" glides into one beat, "ja".' },
      { char: 'ジュ', romaji: 'ju', mnemonic: 'ジ with a small ュ tucked beside it: the voiced "ji" glides into one beat, "ju".' },
      { char: 'ジョ', romaji: 'jo', mnemonic: 'ジ with a small ョ tucked beside it: the voiced "ji" glides into one beat, "jo".' },
      { char: 'ジェ', romaji: 'je', mnemonic: 'ジ with a small ェ tucked beside it: a loanword-only beat, "je" — as in ジェット (jet). Rare in hiragana, common in katakana.' },
    ],
  },
  {
    id: 'katakana-bya',
    label: 'ビャ',
    characters: [
      { char: 'ビャ', romaji: 'bya', mnemonic: 'ビ with a small ャ tucked beside it: the voiced "bi" glides into one beat, "bya".' },
      { char: 'ビュ', romaji: 'byu', mnemonic: 'ビ with a small ュ tucked beside it: the voiced "bi" glides into one beat, "byu".' },
      { char: 'ビョ', romaji: 'byo', mnemonic: 'ビ with a small ョ tucked beside it: the voiced "bi" glides into one beat, "byo".' },
    ],
  },
  {
    id: 'katakana-pya',
    label: 'ピャ',
    characters: [
      { char: 'ピャ', romaji: 'pya', mnemonic: 'ピ with a small ャ tucked beside it: the popped "pi" glides into one beat, "pya".' },
      { char: 'ピュ', romaji: 'pyu', mnemonic: 'ピ with a small ュ tucked beside it: the popped "pi" glides into one beat, "pyu".' },
      { char: 'ピョ', romaji: 'pyo', mnemonic: 'ピ with a small ョ tucked beside it: the popped "pi" glides into one beat, "pyo".' },
    ],
  },
  /*
   * Extended katakana: combinations built only to spell foreign sounds that
   * don't occur in native Japanese, so they exist for katakana (loanwords,
   * foreign names) but essentially never appear in hiragana. Each pairs a
   * base kana with a small vowel the way yōon does, just with more vowels
   * available since these aren't limited to the -i row + や/ゆ/よ pattern.
   */
  {
    id: 'katakana-tsa',
    label: 'ツァ',
    characters: [
      { char: 'ツァ', romaji: 'tsa', mnemonic: 'ツ with a small ァ tucked beside it: "tsu" shifts to "tsa" — as in モーツァルト (Mozart).' },
      { char: 'ツィ', romaji: 'tsi', mnemonic: 'ツ with a small ィ tucked beside it: "tsu" shifts to "tsi" — a rare loanword-only combination.' },
      { char: 'ツェ', romaji: 'tse', mnemonic: 'ツ with a small ェ tucked beside it: "tsu" shifts to "tse" — as in the "tse" in tsetse fly.' },
      { char: 'ツォ', romaji: 'tso', mnemonic: 'ツ with a small ォ tucked beside it: "tsu" shifts to "tso" — as in カンツォーネ (canzone).' },
    ],
  },
  {
    id: 'katakana-fa',
    label: 'ファ',
    characters: [
      { char: 'ファ', romaji: 'fa', mnemonic: 'フ with a small ァ tucked beside it: "fu" shifts to "fa" — as in ファン (fan).' },
      { char: 'フィ', romaji: 'fi', mnemonic: 'フ with a small ィ tucked beside it: "fu" shifts to "fi" — as in フィルム (film).' },
      { char: 'フェ', romaji: 'fe', mnemonic: 'フ with a small ェ tucked beside it: "fu" shifts to "fe" — as in カフェ (café).' },
      { char: 'フォ', romaji: 'fo', mnemonic: 'フ with a small ォ tucked beside it: "fu" shifts to "fo" — as in フォーク (fork).' },
    ],
  },
  {
    id: 'katakana-ti',
    label: 'ティ',
    characters: [
      { char: 'ティ', romaji: 'ti', mnemonic: 'テ with a small ィ tucked beside it: "te" sharpens into the crisp "ti" — as in パーティー (party).' },
      { char: 'トゥ', romaji: 'tu', mnemonic: 'ト with a small ゥ tucked beside it: "to" shifts to "tu" — as in ヒンドゥー (Hindu).' },
    ],
  },
  {
    id: 'katakana-di',
    label: 'ディ',
    characters: [
      { char: 'ディ', romaji: 'di', mnemonic: 'デ with a small ィ tucked beside it: the voiced "de" sharpens into "di" — as in ディズニー (Disney).' },
      { char: 'ドゥ', romaji: 'du', mnemonic: 'ド with a small ゥ tucked beside it: the voiced "do" shifts to "du" — rare, used only for foreign "du" sounds.' },
    ],
  },
  {
    id: 'katakana-wi',
    label: 'ウィ',
    characters: [
      { char: 'ウィ', romaji: 'wi', mnemonic: 'ウ with a small ィ tucked beside it: "u" glides into "wi" — as in ウィンドウ (window).' },
      { char: 'ウェ', romaji: 'we', mnemonic: 'ウ with a small ェ tucked beside it: "u" glides into "we" — as in ウェブ (web).' },
      { char: 'ウォ', romaji: 'wo', mnemonic: 'ウ with a small ォ tucked beside it: "u" glides into "wo" — as in ウォーター (water). Unlike を, this one keeps its "w".' },
    ],
  },
  {
    id: 'katakana-va',
    label: 'ヴァ',
    characters: [
      { char: 'ヴァ', romaji: 'va', mnemonic: 'ヴ — a katakana-only base built from ウ with dakuten, for the "v" Japanese has no native sound for — with a small ァ: "va", as in ヴァイオリン (violin).' },
      { char: 'ヴィ', romaji: 'vi', mnemonic: 'ヴ with a small ィ tucked beside it: "vi", as in ヴィーナス (Venus).' },
      { char: 'ヴ', romaji: 'vu', mnemonic: 'ヴ on its own: the bare "vu" sound, ウ with dakuten added to voice it.' },
      { char: 'ヴェ', romaji: 've', mnemonic: 'ヴ with a small ェ tucked beside it: "ve", as in ラヴェンダー (lavender).' },
      { char: 'ヴォ', romaji: 'vo', mnemonic: 'ヴ with a small ォ tucked beside it: "vo", as in ヴォーカル (vocal).' },
    ],
  },
]

const kanjiRows: BeginnerRow[] = [
  {
    id: 'kanji-numbers-1',
    label: 'Numbers 1–5',
    characters: [
      { char: '一', romaji: 'ichi', meaning: 'one', mnemonic: 'One single stroke. One line, one thing.' },
      { char: '二', romaji: 'ni', meaning: 'two', mnemonic: 'Two stacked lines. Count them: two.' },
      { char: '三', romaji: 'san', meaning: 'three', mnemonic: 'Three stacked lines. The pattern holds — then stops.' },
      { char: '四', romaji: 'shi / yon', meaning: 'four', mnemonic: 'A box with legs inside — four walls of a room.' },
      { char: '五', romaji: 'go', meaning: 'five', mnemonic: 'A zigzag between two lines — a hand with five fingers folded.' },
    ],
  },
  {
    id: 'kanji-numbers-2',
    label: 'Numbers 6–10',
    characters: [
      { char: '六', romaji: 'roku', meaning: 'six', mnemonic: 'A little house on two legs — six-sided, like a shed roof.' },
      { char: '七', romaji: 'nana', meaning: 'seven', mnemonic: 'A number 7 written backwards with a slash through it.' },
      { char: '八', romaji: 'hachi', meaning: 'eight', mnemonic: 'Two legs spreading apart — the shape opens up, like an 8 split.' },
      { char: '九', romaji: 'kyuu', meaning: 'nine', mnemonic: 'A 9 with a hook — almost ten, hooked back at the last moment.' },
      { char: '十', romaji: 'juu', meaning: 'ten', mnemonic: 'A plus sign — ten fingers, two hands crossed.' },
    ],
  },
  {
    id: 'kanji-nature',
    label: 'Nature',
    characters: [
      { char: '日', romaji: 'hi / nichi', meaning: 'sun, day', mnemonic: 'A window with the sun in it. One box, one line — daylight.' },
      { char: '月', romaji: 'tsuki / getsu', meaning: 'moon, month', mnemonic: 'A crescent moon leaning, with two clouds crossing it.' },
      { char: '火', romaji: 'hi / ka', meaning: 'fire', mnemonic: 'A person with sparks flying off both shoulders — they are on fire.' },
      { char: '水', romaji: 'mizu / sui', meaning: 'water', mnemonic: 'A river with streams splitting off both sides of the current.' },
      { char: '木', romaji: 'ki / moku', meaning: 'tree, wood', mnemonic: 'A tree: trunk, branches out, roots down.' },
    ],
  },
  {
    id: 'kanji-nature-2',
    label: 'Earth & sky',
    characters: [
      { char: '山', romaji: 'yama / san', meaning: 'mountain', mnemonic: 'Three peaks on a ridge line. You can see the mountain.' },
      { char: '川', romaji: 'kawa / sen', meaning: 'river', mnemonic: 'Three lines of water flowing downstream between banks.' },
      { char: '土', romaji: 'tsuchi / do', meaning: 'earth, soil', mnemonic: 'A plant pushing up through two layers of ground.' },
      { char: '金', romaji: 'kane / kin', meaning: 'gold, money', mnemonic: 'A roof over two nuggets buried in the earth — treasure.' },
      { char: '田', romaji: 'ta / den', meaning: 'rice field', mnemonic: 'A field divided into four paddies by irrigation channels.' },
    ],
  },
  {
    id: 'kanji-people',
    label: 'People & body',
    characters: [
      { char: '人', romaji: 'hito / jin', meaning: 'person', mnemonic: 'Two legs walking. A person, seen from the front.' },
      { char: '口', romaji: 'kuchi / kou', meaning: 'mouth', mnemonic: 'An open mouth, drawn as a square.' },
      { char: '目', romaji: 'me / moku', meaning: 'eye', mnemonic: 'An eye turned on its side — the pupil and lids inside.' },
      { char: '手', romaji: 'te / shu', meaning: 'hand', mnemonic: 'A hand with fingers spread and a wrist below.' },
      { char: '女', romaji: 'onna / jo', meaning: 'woman', mnemonic: 'A figure sitting with legs crossed and arms folded.' },
    ],
  },
  {
    id: 'kanji-size',
    label: 'Size & position',
    characters: [
      { char: '大', romaji: 'oo / dai', meaning: 'big', mnemonic: 'A person (人) with arms stretched wide — "it was THIS big".' },
      { char: '小', romaji: 'chii / shou', meaning: 'small', mnemonic: 'A tiny thing with two little marks shrinking away from it.' },
      { char: '中', romaji: 'naka / chuu', meaning: 'middle, inside', mnemonic: 'A line skewered straight through the middle of a box.' },
      { char: '上', romaji: 'ue / jou', meaning: 'up, above', mnemonic: 'A mark sitting ON TOP of the ground line.' },
      { char: '下', romaji: 'shita / ka', meaning: 'down, below', mnemonic: 'A mark hanging BELOW the ground line. The mirror of 上.' },
    ],
  },
]

export const beginnerDecks: BeginnerDeck[] = [
  {
    script: 'hiragana',
    title: 'Hiragana',
    description: 'The rounded kana and voiced sounds every Japanese sentence is built from.',
    rows: hiraganaRows,
  },
  {
    script: 'katakana',
    title: 'Katakana',
    description: 'The angular kana and voiced sounds used for foreign words, names, and effects.',
    rows: katakanaRows,
  },
  {
    script: 'kanji',
    title: 'First Kanji',
    description: 'Thirty starter kanji — numbers, nature, people, and direction.',
    rows: kanjiRows,
  },
]

export function getBeginnerDeck(script: BeginnerScript): BeginnerDeck {
  return beginnerDecks.find((deck) => deck.script === script) ?? beginnerDecks[0]!
}
