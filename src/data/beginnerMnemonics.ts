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
  /** Row label as it appears on a kana chart, e.g. "A row", "KA row". */
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
    label: 'A row',
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
    label: 'KA row',
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
    label: 'SA row',
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
    label: 'TA row',
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
    label: 'NA row',
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
    label: 'HA row',
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
    label: 'MA row',
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
    label: 'YA row',
    characters: [
      { char: 'や', romaji: 'ya', mnemonic: 'A yak with horns leaning to one side — "ya"-k.' },
      { char: 'ゆ', romaji: 'yu', mnemonic: 'A fish caught on a hook, swimming loop — a "u"-nique fish, "yu".' },
      { char: 'よ', romaji: 'yo', mnemonic: 'A yo-yo hanging on its string, mid-drop — "yo".' },
    ],
  },
  {
    id: 'hiragana-ra',
    label: 'RA row',
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
    label: 'WA + N',
    characters: [
      { char: 'わ', romaji: 'wa', mnemonic: 'A wine glass tipping over — "wa", spilled it.' },
      { char: 'を', romaji: 'wo', mnemonic: 'A person throwing a boomerang — "whoa", it came back.' },
      { char: 'ん', romaji: 'n', mnemonic: 'A single lazy squiggle — the sound you hum, "nnn".' },
    ],
  },
]

const katakanaRows: BeginnerRow[] = [
  {
    id: 'katakana-a',
    label: 'A row',
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
    label: 'KA row',
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
    label: 'SA row',
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
    label: 'TA row',
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
    label: 'NA row',
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
    label: 'HA row',
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
    label: 'MA row',
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
    label: 'YA row',
    characters: [
      { char: 'ヤ', romaji: 'ya', mnemonic: 'A yacht with a mast and boom — "ya"-cht.' },
      { char: 'ユ', romaji: 'yu', mnemonic: 'A U-turn sign drawn with straight edges — "yu".' },
      { char: 'ヨ', romaji: 'yo', mnemonic: 'A fork with three prongs — "yo", pass the fork.' },
    ],
  },
  {
    id: 'katakana-ra',
    label: 'RA row',
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
    label: 'WA + N',
    characters: [
      { char: 'ワ', romaji: 'wa', mnemonic: 'A wine glass, angular and empty — "wa", drank it.' },
      { char: 'ヲ', romaji: 'wo', mnemonic: 'Rare in modern Japanese — a boomerang thrown flat, "whoa".' },
      { char: 'ン', romaji: 'n', mnemonic: 'Two dashes swooping UP — hum "nnn". Compare ソ, which swoops down.' },
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
    description: 'The 46 rounded characters every Japanese sentence is built from.',
    rows: hiraganaRows,
  },
  {
    script: 'katakana',
    title: 'Katakana',
    description: 'The angular script used for foreign words, names, and sound effects.',
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
