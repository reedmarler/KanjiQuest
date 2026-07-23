import { buildDrillExercises, DRILL_LEVELS, stripTrailingPeriod } from '../lib/drillExercises'
import type { DrillExercise, DrillJlptLevel, DrillOption } from '../lib/drillExercises'

/** JLPT levels that have curated vocab drills wired up. */
export type VocabJlptLevel = DrillJlptLevel

export const VOCAB_LEVELS = DRILL_LEVELS

export type VocabPracticeExercise = DrillExercise

/**
 * Every choice set holds words of the same class that all fit the sentence
 * grammatically — the English clue is what tells them apart, so the drill tests
 * vocabulary rather than pattern-matching on the sentence shape.
 */
const foodWords: DrillOption[] = [['パン', 'パン'], ['寿司', 'すし'], ['肉', 'にく'], ['野菜', 'やさい']]
const foodWords2: DrillOption[] = [['魚', 'さかな'], ['卵', 'たまご'], ['果物', 'くだもの'], ['ご飯', 'ごはん']]
const drinkWords: DrillOption[] = [['水', 'みず'], ['お茶', 'おちゃ'], ['牛乳', 'ぎゅうにゅう'], ['コーヒー', 'コーヒー']]
const placeWords: DrillOption[] = [['学校', 'がっこう'], ['駅', 'えき'], ['銀行', 'ぎんこう'], ['図書館', 'としょかん']]
const placeWords2: DrillOption[] = [['病院', 'びょういん'], ['公園', 'こうえん'], ['店', 'みせ'], ['空港', 'くうこう']]
const timeWords: DrillOption[] = [['今日', 'きょう'], ['明日', 'あした'], ['昨日', 'きのう'], ['毎日', 'まいにち']]
const peopleWords: DrillOption[] = [['友だち', 'ともだち'], ['先生', 'せんせい'], ['母', 'はは'], ['弟', 'おとうと']]
const transportWords: DrillOption[] = [['電車', 'でんしゃ'], ['車', 'くるま'], ['自転車', 'じてんしゃ'], ['飛行機', 'ひこうき']]
const thingWords: DrillOption[] = [['本', 'ほん'], ['ノート', 'ノート'], ['ペン', 'ペン'], ['かばん', 'かばん']]
const bodyWords: DrillOption[] = [['目', 'め'], ['耳', 'みみ'], ['口', 'くち'], ['手', 'て']]
const natureWords: DrillOption[] = [['山', 'やま'], ['海', 'うみ'], ['川', 'かわ'], ['空', 'そら']]
const weatherWords: DrillOption[] = [['雨', 'あめ'], ['雪', 'ゆき'], ['風', 'かぜ'], ['雲', 'くも']]
const verbWords: DrillOption[] = [['食べます', 'たべます'], ['飲みます', 'のみます'], ['読みます', 'よみます'], ['見ます', 'みます']]
const verbWords2: DrillOption[] = [['行きます', 'いきます'], ['買います', 'かいます'], ['書きます', 'かきます'], ['聞きます', 'ききます']]
const adjWords: DrillOption[] = [['高いです', 'たかいです'], ['安いです', 'やすいです'], ['新しいです', 'あたらしいです'], ['古いです', 'ふるいです']]
const adjWords2: DrillOption[] = [['大きいです', 'おおきいです'], ['小さいです', 'ちいさいです'], ['忙しいです', 'いそがしいです'], ['面白いです', 'おもしろいです']]

const n4PlaceWords: DrillOption[] = [['空港', 'くうこう'], ['工場', 'こうじょう'], ['事務所', 'じむしょ'], ['美術館', 'びじゅつかん']]
const n4PeopleWords: DrillOption[] = [['社長', 'しゃちょう'], ['医者', 'いしゃ'], ['客', 'きゃく'], ['店員', 'てんいん']]
const n4AbstractWords: DrillOption[] = [['約束', 'やくそく'], ['準備', 'じゅんび'], ['相談', 'そうだん'], ['経験', 'けいけん']]
const n4VerbWords: DrillOption[] = [['届きます', 'とどきます'], ['集めます', 'あつめます'], ['調べます', 'しらべます'], ['決めます', 'きめます']]
const n4VerbWords2: DrillOption[] = [['続けます', 'つづけます'], ['始めます', 'はじめます'], ['比べます', 'くらべます'], ['選びます', 'えらびます']]
const n4AdjWords: DrillOption[] = [['簡単でした', 'かんたんでした'], ['大切でした', 'たいせつでした'], ['複雑でした', 'ふくざつでした'], ['有名でした', 'ゆうめいでした']]

const n3AbstractWords: DrillOption[] = [['状況', 'じょうきょう'], ['結果', 'けっか'], ['原因', 'げんいん'], ['影響', 'えいきょう']]
const n3AbstractWords2: DrillOption[] = [['責任', 'せきにん'], ['目的', 'もくてき'], ['方法', 'ほうほう'], ['条件', 'じょうけん']]
const n3VerbWords: DrillOption[] = [['認めます', 'みとめます'], ['断ります', 'ことわります'], ['許します', 'ゆるします'], ['疑います', 'うたがいます']]
const n3VerbWords2: DrillOption[] = [['求めます', 'もとめます'], ['示します', 'しめします'], ['含みます', 'ふくみます'], ['支えます', 'ささえます']]
const n3AdjWords: DrillOption[] = [['複雑です', 'ふくざつです'], ['確実です', 'かくじつです'], ['適当です', 'てきとうです'], ['深刻です', 'しんこくです']]

const optionEnglish = new Map<string, string>([
  ['パン', 'bread'], ['寿司', 'sushi'], ['肉', 'meat'], ['野菜', 'vegetables'],
  ['魚', 'fish'], ['卵', 'eggs'], ['果物', 'fruit'], ['ご飯', 'rice'],
  ['水', 'water'], ['お茶', 'tea'], ['牛乳', 'milk'], ['コーヒー', 'coffee'],
  ['学校', 'school'], ['駅', 'the station'], ['銀行', 'the bank'], ['図書館', 'the library'],
  ['病院', 'the hospital'], ['公園', 'the park'], ['店', 'the store'], ['空港', 'the airport'],
  ['今日', 'today'], ['明日', 'tomorrow'], ['昨日', 'yesterday'], ['毎日', 'every day'],
  ['友だち', 'my friend'], ['先生', 'my teacher'], ['母', 'my mother'], ['弟', 'my younger brother'],
  ['電車', 'train'], ['車', 'car'], ['自転車', 'bicycle'], ['飛行機', 'airplane'],
  ['本', 'a book'], ['ノート', 'a notebook'], ['ペン', 'a pen'], ['かばん', 'a bag'],
  ['目', 'my eyes'], ['耳', 'my ears'], ['口', 'my mouth'], ['手', 'my hands'],
  ['山', 'the mountain'], ['海', 'the sea'], ['川', 'the river'], ['空', 'the sky'],
  ['雨', 'rain'], ['雪', 'snow'], ['風', 'wind'], ['雲', 'clouds'],
  ['食べます', 'eat'], ['飲みます', 'drink'], ['読みます', 'read'], ['見ます', 'watch'],
  ['行きます', 'go'], ['買います', 'buy'], ['書きます', 'write'], ['聞きます', 'listen to'],
  ['高いです', 'expensive'], ['安いです', 'cheap'], ['新しいです', 'new'], ['古いです', 'old'],
  ['大きいです', 'big'], ['小さいです', 'small'], ['忙しいです', 'busy'], ['面白いです', 'interesting'],
  ['工場', 'a factory'], ['事務所', 'the office'], ['美術館', 'the art museum'],
  ['社長', 'the company president'], ['医者', 'a doctor'], ['客', 'a customer'], ['店員', 'the shop assistant'],
  ['約束', 'my promise'], ['準備', 'preparations'], ['相談', 'a consultation'], ['経験', 'experience'],
  ['届きます', 'arrive'], ['集めます', 'collect'], ['調べます', 'look up'], ['決めます', 'decide'],
  ['続けます', 'continue'], ['始めます', 'start'], ['比べます', 'compare'], ['選びます', 'choose'],
  ['簡単でした', 'simple'], ['大切でした', 'important'], ['複雑でした', 'complicated'], ['有名でした', 'famous'],
  ['状況', 'the situation'], ['結果', 'the results'], ['原因', 'the cause'], ['影響', 'the effect'],
  ['責任', 'responsibility'], ['目的', 'the purpose'], ['方法', 'a method'], ['条件', 'the conditions'],
  ['認めます', 'admit'], ['断ります', 'decline'], ['許します', 'permit'], ['疑います', 'doubt'],
  ['求めます', 'ask for'], ['示します', 'show'], ['含みます', 'include'], ['支えます', 'support'],
  ['複雑です', 'complex'], ['確実です', 'certain'], ['適当です', 'suitable'], ['深刻です', 'serious'],
])

function optionText(option: DrillOption): string {
  return stripTrailingPeriod(typeof option === 'string' ? option : option[0])
}

function optionReading(option: DrillOption): string {
  return stripTrailingPeriod(typeof option === 'string' ? option : option[1])
}

function updateEnglishClue(english: string, from: string, to: string): string {
  if (from === to) return english
  return english.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), to)
}

function drill(
  id: string,
  jlpt: VocabJlptLevel,
  english: string,
  segments: string[],
  readings: string[],
  segmentIndex: number,
  meaning: string,
  options: readonly DrillOption[],
) {
  return {
    source: { id: `vocab-drill-${id}`, jlpt, english, segments, readings },
    focus: { segmentIndex, pattern: segments[segmentIndex], meaning, options },
  }
}

function rotateAnswers(entry: ReturnType<typeof drill>) {
  const answer = stripTrailingPeriod(entry.source.segments[entry.focus.segmentIndex])
  const answerEnglish = optionEnglish.get(answer)

  return entry.focus.options?.map((option, optionIndex) => {
    const text = optionText(option)
    const reading = optionReading(option)
    const english = answerEnglish
      ? updateEnglishClue(entry.source.english, answerEnglish, optionEnglish.get(text) ?? answerEnglish)
      : entry.source.english

    return {
      source: {
        ...entry.source,
        id: `${entry.source.id}-${optionIndex + 1}`,
        english,
        segments: entry.source.segments.map((segment, segmentIndex) =>
          segmentIndex === entry.focus.segmentIndex ? text : segment,
        ),
        readings: entry.source.readings.map((readingSegment, segmentIndex) =>
          segmentIndex === entry.focus.segmentIndex ? reading : readingSegment,
        ),
      },
      focus: {
        ...entry.focus,
        pattern: text,
      },
    }
  }) ?? [entry]
}

const entries = [
  drill('pan', 'N5', 'I eat bread.',
    ['私', 'は', 'パン', 'を', '食べます。'], ['わたし', 'は', 'パン', 'を', 'たべます。'], 2, 'food', foodWords),
  drill('mizu', 'N5', 'I drink water.',
    ['私', 'は', '水', 'を', '飲みます。'], ['わたし', 'は', 'みず', 'を', 'のみます。'], 2, 'drink', drinkWords),
  drill('gakkou', 'N5', 'I go to school.',
    ['私', 'は', '学校', 'へ', '行きます。'], ['わたし', 'は', 'がっこう', 'へ', 'いきます。'], 2, 'place', placeWords),
  drill('kyou', 'N5', 'I am busy today.',
    ['今日', 'は', '忙しいです。'], ['きょう', 'は', 'いそがしいです。'], 0, 'time', timeWords),
  drill('tomodachi', 'N5', 'I meet my friend.',
    ['私', 'は', '友だち', 'に', '会います。'], ['わたし', 'は', 'ともだち', 'に', 'あいます。'], 2, 'person', peopleWords),
  drill('densha', 'N5', 'I go by train.',
    ['私', 'は', '電車', 'で', '行きます。'], ['わたし', 'は', 'でんしゃ', 'で', 'いきます。'], 2, 'transport', transportWords),
  drill('yomimasu', 'N5', 'I read a book.',
    ['私', 'は', '本', 'を', '読みます。'], ['わたし', 'は', 'ほん', 'を', 'よみます。'], 4, 'verb', verbWords),
  drill('takai', 'N5', 'This book is expensive.',
    ['この', '本', 'は', '高いです。'], ['この', 'ほん', 'は', 'たかいです。'], 3, 'adjective', adjWords),
  drill('umi', 'N5', 'I go to the sea.',
    ['私', 'は', '海', 'へ', '行きます。'], ['わたし', 'は', 'うみ', 'へ', 'いきます。'], 2, 'nature', natureWords),
  drill('kaban', 'N5', 'I bought a bag.',
    ['私', 'は', 'かばん', 'を', '買いました。'], ['わたし', 'は', 'かばん', 'を', 'かいました。'], 2, 'object', thingWords),
  drill('ame', 'N5', 'Rain is falling.',
    ['雨', 'が', '降っています。'], ['あめ', 'が', 'ふっています。'], 0, 'weather', weatherWords),
  drill('sensei', 'N5', 'I ask my teacher.',
    ['私', 'は', '先生', 'に', '聞きます。'], ['わたし', 'は', 'せんせい', 'に', 'ききます。'], 2, 'person', peopleWords),
  drill('ginkou', 'N5', 'I work at the bank.',
    ['私', 'は', '銀行', 'で', '働きます。'], ['わたし', 'は', 'ぎんこう', 'で', 'はたらきます。'], 2, 'place', placeWords),
  drill('mainichi', 'N5', 'I study every day.',
    ['私', 'は', '毎日', '勉強します。'], ['わたし', 'は', 'まいにち', 'べんきょうします。'], 2, 'time', timeWords),
  drill('sakana', 'N5', 'I do not eat fish.',
    ['私', 'は', '魚', 'を', '食べません。'], ['わたし', 'は', 'さかな', 'を', 'たべません。'], 2, 'food', foodWords2),
  drill('ocha', 'N5', 'I want to drink tea.',
    ['私', 'は', 'お茶', 'を', '飲みたいです。'], ['わたし', 'は', 'おちゃ', 'を', 'のみたいです。'], 2, 'drink', drinkWords),
  drill('te', 'N5', 'I wash my hands.',
    ['私', 'は', '手', 'を', '洗います。'], ['わたし', 'は', 'て', 'を', 'あらいます。'], 2, 'body', bodyWords),
  drill('byouin', 'N5', 'I went to the hospital.',
    ['私', 'は', '病院', 'へ', '行きました。'], ['わたし', 'は', 'びょういん', 'へ', 'いきました。'], 2, 'place', placeWords2),
  drill('mimasu', 'N5', 'I watch a movie.',
    ['私', 'は', '映画', 'を', '見ます。'], ['わたし', 'は', 'えいが', 'を', 'みます。'], 4, 'verb', verbWords),
  drill('kakimasu', 'N5', 'I write my name.',
    ['私', 'は', '名前', 'を', '書きます。'], ['わたし', 'は', 'なまえ', 'を', 'かきます。'], 4, 'verb', verbWords2),
  drill('ookii', 'N5', 'This room is big.',
    ['この', '部屋', 'は', '大きいです。'], ['この', 'へや', 'は', 'おおきいです。'], 3, 'adjective', adjWords2),
  drill('kouen', 'N5', 'I play in the park.',
    ['私', 'は', '公園', 'で', '遊びます。'], ['わたし', 'は', 'こうえん', 'で', 'あそびます。'], 2, 'place', placeWords2),
  drill('haha', 'N5', 'My mother cooks.',
    ['母', 'は', '料理します。'], ['はは', 'は', 'りょうりします。'], 0, 'person', peopleWords),
  drill('jitensha', 'N5', 'I ride a bicycle.',
    ['私', 'は', '自転車', 'に', '乗ります。'], ['わたし', 'は', 'じてんしゃ', 'に', 'のります。'], 2, 'transport', transportWords),

  drill('kuukou', 'N4', 'I wait for my friend at the airport.',
    ['私', 'は', '空港', 'で', '友だち', 'を', '待ちます。'],
    ['わたし', 'は', 'くうこう', 'で', 'ともだち', 'を', 'まちます。'], 2, 'place', n4PlaceWords),
  drill('isha', 'N4', 'I consulted a doctor.',
    ['私', 'は', '医者', 'に', '相談しました。'], ['わたし', 'は', 'いしゃ', 'に', 'そうだんしました。'], 2, 'person', n4PeopleWords),
  drill('yakusoku', 'N4', 'I keep my promise.',
    ['私', 'は', '約束', 'を', '守ります。'], ['わたし', 'は', 'やくそく', 'を', 'まもります。'], 2, 'concept', n4AbstractWords),
  drill('shirabemasu', 'N4', 'I look up the meaning.',
    ['私', 'は', '意味', 'を', '調べます。'], ['わたし', 'は', 'いみ', 'を', 'しらべます。'], 4, 'verb', n4VerbWords),
  drill('junbi', 'N4', 'I get ready for the trip.',
    ['私', 'は', '旅行', 'の', '準備', 'を', 'します。'],
    ['わたし', 'は', 'りょこう', 'の', 'じゅんび', 'を', 'します。'], 4, 'concept', n4AbstractWords),
  drill('bijutsukan', 'N4', 'I saw paintings at the art museum.',
    ['私', 'は', '美術館', 'で', '絵', 'を', '見ました。'],
    ['わたし', 'は', 'びじゅつかん', 'で', 'え', 'を', 'みました。'], 2, 'place', n4PlaceWords),
  drill('tenin', 'N4', 'I asked the shop assistant.',
    ['私', 'は', '店員', 'に', '聞きました。'], ['わたし', 'は', 'てんいん', 'に', 'ききました。'], 2, 'person', n4PeopleWords),
  drill('kimemasu', 'N4', 'I decide the date.',
    ['私', 'は', '日にち', 'を', '決めます。'], ['わたし', 'は', 'ひにち', 'を', 'きめます。'], 4, 'verb', n4VerbWords),
  drill('kurabemasu', 'N4', 'I compare the prices.',
    ['私', 'は', '値段', 'を', '比べます。'], ['わたし', 'は', 'ねだん', 'を', 'くらべます。'], 4, 'verb', n4VerbWords2),
  drill('keiken', 'N4', 'Experience is important.',
    ['経験', 'が', '大切です。'], ['けいけん', 'が', 'たいせつです。'], 0, 'concept', n4AbstractWords),
  drill('koujou', 'N4', 'I work at a factory.',
    ['私', 'は', '工場', 'で', '働いています。'], ['わたし', 'は', 'こうじょう', 'で', 'はたらいています。'], 2, 'place', n4PlaceWords),
  drill('shachou', 'N4', 'I met the company president.',
    ['私', 'は', '社長', 'に', '会いました。'], ['わたし', 'は', 'しゃちょう', 'に', 'あいました。'], 2, 'person', n4PeopleWords),
  drill('tsuzukemasu', 'N4', 'I continue practicing.',
    ['私', 'は', '練習', 'を', '続けます。'], ['わたし', 'は', 'れんしゅう', 'を', 'つづけます。'], 4, 'verb', n4VerbWords2),
  drill('kantan', 'N4', 'The explanation was simple.',
    ['説明', 'が', '簡単でした。'], ['せつめい', 'が', 'かんたんでした。'], 2, 'adjective', n4AdjWords),
  drill('erabimasu', 'N4', 'I choose a present.',
    ['私', 'は', 'プレゼント', 'を', '選びます。'], ['わたし', 'は', 'プレゼント', 'を', 'えらびます。'], 4, 'verb', n4VerbWords2),
  drill('atsumemasu', 'N4', 'I collect stamps.',
    ['私', 'は', '切手', 'を', '集めます。'], ['わたし', 'は', 'きって', 'を', 'あつめます。'], 4, 'verb', n4VerbWords),

  drill('genin', 'N3', 'They investigate the cause of the accident.',
    ['事故', 'の', '原因', 'を', '調べます。'], ['じこ', 'の', 'げんいん', 'を', 'しらべます。'], 2, 'concept', n3AbstractWords),
  drill('kekka', 'N3', 'The exam results came out.',
    ['試験', 'の', '結果', 'が', '出ました。'], ['しけん', 'の', 'けっか', 'が', 'でました。'], 2, 'concept', n3AbstractWords),
  drill('eikyou', 'N3', 'We are affected by the weather.',
    ['私たち', 'は', '天気', 'の', '影響', 'を', '受けます。'],
    ['わたしたち', 'は', 'てんき', 'の', 'えいきょう', 'を', 'うけます。'], 4, 'concept', n3AbstractWords),
  drill('joukyou', 'N3', 'The situation changed.',
    ['状況', 'が', '変わりました。'], ['じょうきょう', 'が', 'かわりました。'], 0, 'concept', n3AbstractWords),
  drill('sekinin', 'N3', 'I take responsibility.',
    ['私', 'は', '責任', 'を', '取ります。'], ['わたし', 'は', 'せきにん', 'を', 'とります。'], 2, 'concept', n3AbstractWords2),
  drill('houhou', 'N3', 'I think of a method.',
    ['私', 'は', '方法', 'を', '考えます。'], ['わたし', 'は', 'ほうほう', 'を', 'かんがえます。'], 2, 'concept', n3AbstractWords2),
  drill('mokuteki', 'N3', 'I explain the purpose.',
    ['私', 'は', '目的', 'を', '説明します。'], ['わたし', 'は', 'もくてき', 'を', 'せつめいします。'], 2, 'concept', n3AbstractWords2),
  drill('kotowarimasu', 'N3', 'I decline the invitation.',
    ['私', 'は', '招待', 'を', '断ります。'], ['わたし', 'は', 'しょうたい', 'を', 'ことわります。'], 4, 'verb', n3VerbWords),
  drill('mitomemasu', 'N3', 'I admit my mistake.',
    ['私', 'は', '間違い', 'を', '認めます。'], ['わたし', 'は', 'まちがい', 'を', 'みとめます。'], 4, 'verb', n3VerbWords),
  drill('fukuzatsu', 'N3', 'The problem is complex.',
    ['問題', 'が', '複雑です。'], ['もんだい', 'が', 'ふくざつです。'], 2, 'adjective', n3AdjWords),
  drill('motomemasu', 'N3', 'I ask for help.',
    ['私', 'は', '助け', 'を', '求めます。'], ['わたし', 'は', 'たすけ', 'を', 'もとめます。'], 4, 'verb', n3VerbWords2),
  drill('jouken', 'N3', 'I present the conditions.',
    ['私', 'は', '条件', 'を', '示します。'], ['わたし', 'は', 'じょうけん', 'を', 'しめします。'], 2, 'concept', n3AbstractWords2),
]

/** Vocab choice drills — the blank is a word, not a grammar pattern. */
export const vocabPracticeExercises: VocabPracticeExercise[] = buildDrillExercises(entries.flatMap(rotateAnswers))
