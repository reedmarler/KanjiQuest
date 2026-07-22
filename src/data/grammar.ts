import type { StudyCard } from '../lib/types'

type GrammarEntry = [
  id: string,
  pattern: string,
  meaning: string,
  formula: string,
  jlpt?: 'N5' | 'N4',
]

const grammarEntries: GrammarEntry[] = [
  ['masu-nonpast', '〜ます', 'Polite non-past: do / will do. 食べます — I eat / will eat.', 'Verb stem + ます'],
  ['masu-past', '〜ました', 'Polite past: did. 食べました — I ate.', 'Verb stem + ました'],
  ['masu-negative', '〜ません', 'Polite negative: do not. 飲みません — I do not drink.', 'Verb stem + ません'],
  ['masu-negative-past', '〜ませんでした', 'Polite negative past: did not. 行きませんでした — I did not go.', 'Verb stem + ませんでした'],
  ['plain-dictionary', 'Plain form: dictionary form', 'Plain affirmative non-past: do / will do. 食べる — eat.', 'Used in casual speech and before many grammar patterns.'],
  ['plain-negative', 'Plain form: 〜ない', 'Plain negative: do not. 飲まない — do not drink.', 'Godan: a-row + ない. Ichidan: drop る + ない.'],
  ['plain-past', 'Plain form: 〜た', 'Plain past: did. 食べた — ate.', 'The plain past form is related to the て-form.'],
  ['plain-negative-past', 'Plain form: 〜なかった', 'Plain negative past: did not. 行かなかった — did not go.', 'Plain negative 〜ない becomes 〜なかった.'],

  ['arimasu', '〜があります', 'There is / are (a thing). 机の上に本があります。— There is a book on the desk.', 'Place に thing があります'],
  ['imasu', '〜がいます', 'There is / are (a person or animal). 公園に犬がいます。— There is a dog in the park.', 'Place に person / animal がいます'],
  ['ni-arimasu', '〜にあります', 'Is located at (a thing). 銀行は駅の前にあります。— The bank is in front of the station.', 'Thing は place にあります'],
  ['ni-imasu', '〜にいます', 'Is located at (a person or animal). 田中さんは教室にいます。— Tanaka is in the classroom.', 'Person / animal は place にいます'],
  ['goro', '〜ごろ', 'Around / about a time. 七時ごろ帰ります。— I will return around seven.', 'Time + ごろ'],

  ['suki', '〜が好きです', 'Like. 日本語が好きです。— I like Japanese.', 'Thing + が好きです'],
  ['kirai', '〜が嫌いです', 'Dislike. 納豆が嫌いです。— I dislike natto.', 'Thing + が嫌いです'],
  ['hoshii', '〜がほしいです', 'Want a thing. 車がほしいです。— I want a car.', 'Thing + がほしいです'],
  ['tai', '〜たいです', 'Want to do. 水を飲みたいです。— I want to drink water.', 'Verb stem + たいです'],
  ['koto-ga-dekiru', '〜ことができます', 'Can do / be able to do. 日本語を話すことができます。— I can speak Japanese.', 'Dictionary form + ことができます'],
  ['potential', 'Potential form: 〜られる', 'Can do. 食べられます。— I can eat. Godan example: 行く → 行ける.', 'Ichidan: drop る + られる. Godan: e-row + る.', 'N4'],

  ['janai', '〜じゃないです', 'Is not / are not, casual polite. 学生じゃないです。— I am not a student.', 'Noun / な-adjective + じゃないです'],
  ['dewa-arimasen', '〜ではありません', 'Is not / are not, formal polite. これは本ではありません。— This is not a book.', 'Noun / な-adjective + ではありません'],
  ['shika-nai', '〜しか〜ない', 'Only; use a negative verb. 水しか飲みません。— I drink only water.', 'Noun + しか + negative verb'],
  ['nakereba', '〜なければなりません', 'Must / have to. 毎日勉強しなければなりません。— I must study every day.', 'Verb negative stem + なければなりません'],
  ['nakutemo', '〜なくてもいいです', 'Do not have to. 明日来なくてもいいです。— You do not have to come tomorrow.', 'Verb negative stem + なくてもいいです'],
  ['temo', '〜てもいいです', 'May / it is okay to. ここで写真を撮ってもいいですか。— May I take pictures here?', 'Verb て-form + もいいです'],

  ['yori', '〜より', 'Than. 犬より猫が好きです。— I like cats more than dogs.', 'A より B のほうが…'],
  ['no-hou-ga', '〜のほうが', 'More / the one that is more. 夏より冬のほうが好きです。— I like winter more than summer.', 'A より B のほうが + adjective'],
  ['ichiban', '一番', 'Most / best. 日本語が一番好きです。— I like Japanese the most.', 'Group の中で + noun が一番…'],

  ['ageru', '〜をあげます', 'Give to someone else. 友だちに花をあげます。— I give flowers to a friend.', 'Giver は receiver に thing をあげます'],
  ['kureru', '〜をくれます', 'Give to me / my in-group. 友だちが私に本をくれました。— A friend gave me a book.', 'Giver が me に thing をくれます'],
  ['morau', '〜をもらいます', 'Receive. 友だちに本をもらいました。— I received a book from a friend.', 'Receiver は giver に / から thing をもらいます'],

  ['soshite', 'そして', 'And then / and. 朝ご飯を食べました。そして、学校へ行きました。— I ate breakfast, then went to school.', 'Sentence。そして、sentence。'],
  ['demo', 'でも', 'But / however. 高いです。でも、買いたいです。— It is expensive, but I want to buy it.', 'Sentence。でも、sentence。'],
  ['dakara', 'だから', 'Therefore / so. 雨です。だから、家にいます。— It is raining, so I am at home.', 'Reason。だから、result。'],
  ['kara', '〜から', 'Because. 忙しいから、今日は行きません。— Because I am busy, I will not go.', 'Plain form + から'],
  ['kedo', '〜けど', 'But / though. 小さいけど、便利です。— It is small, but useful.', 'Plain form + けど'],

  ['no-possessive', '〜の', 'Possession / connection. 私の本です。— It is my book.', 'Noun の noun'],
  ['kono-sono-ano', 'この・その・あの', 'This / that / that over there, before a noun. この本は面白いです。— This book is interesting.', 'この / その / あの + noun'],
  ['dono', 'どの', 'Which, before a noun. どの本が好きですか。— Which book do you like?', 'どの + noun'],
  ['i-adjective', '大きい犬', 'An い-adjective comes before a noun. 大きい犬 — a big dog.', 'い-adjective + noun'],
  ['na-adjective', '静かな町', 'A な-adjective uses な before a noun. 静かな町 — a quiet town.', 'な-adjective + な + noun'],

  ['counter-tsu', '一つ〜十', 'General object counter. りんごを三つ買いました。— I bought three apples.', 'Number + つ'],
  ['counter-nin', '〜人', 'People counter. 二人います。— There are two people.', 'Number + 人'],
  ['counter-mai', '〜枚', 'Flat object counter. 紙を二枚ください。— Please give me two sheets of paper.', 'Number + 枚'],
  ['counter-hon', '〜本', 'Long, cylindrical object counter. ペンを三本買いました。— I bought three pens.', 'Number + 本'],
  ['counter-ko', '〜個', 'General object counter. みかんを四個食べました。— I ate four mandarins.', 'Number + 個'],

  ['te-kudasai', '〜てください', 'Please do. ここに名前を書いてください。— Please write your name here.', 'Verb て-form + ください'],
  ['naide-kudasai', '〜ないでください', 'Please do not. ここで写真を撮らないでください。— Please do not take pictures here.', 'Verb ない-form + でください'],
  ['mashou', '〜ましょう', 'Let’s do. 一緒に勉強しましょう。— Let’s study together.', 'Verb stem + ましょう'],
  ['masen-ka', '〜ませんか', 'Won’t you? / Would you like to? 一緒に行きませんか。— Would you like to go together?', 'Verb stem + ませんか'],

  ['to-omoimasu', '〜と思います', 'I think. この映画は面白いと思います。— I think this movie is interesting.', 'Plain form + と思います', 'N4'],
  ['to-iimasu', '〜と言います', 'Say / be called. 「ありがとう」と言います。— Say “thank you.”', 'Quote + と言います', 'N4'],
  ['tsumori', '〜つもりです', 'Intend to. 来年日本へ行くつもりです。— I intend to go to Japan next year.', 'Dictionary form + つもりです', 'N4'],
  ['yotei', '〜予定です', 'Be scheduled / plan to. 明日出発する予定です。— I plan to leave tomorrow.', 'Dictionary form + 予定です', 'N4'],
  ['koto-ga-aru', '〜たことがあります', 'Have done before. 日本へ行ったことがあります。— I have been to Japan before.', 'Verb た-form + ことがあります', 'N4'],
  ['tari-tari', '〜たり〜たりする', 'Do things such as. 週末は本を読んだり、映画を見たりします。— On weekends I do things like read books and watch movies.', 'Verb た-form + り、verb た-form + りする', 'N4'],
  ['nagara', '〜ながら', 'While doing. 音楽を聞きながら勉強します。— I study while listening to music.', 'Verb stem + ながら + main action', 'N4'],
  ['mae-ni', '〜前に', 'Before. 寝る前に歯を磨きます。— I brush my teeth before sleeping.', 'Dictionary form + 前に', 'N4'],
  ['ato-de', '〜あとで', 'After. ご飯を食べたあとで勉強します。— I study after eating.', 'Verb た-form + あとで', 'N4'],
  ['node', '〜ので', 'Because; a gentle reason. 雨が降っているので、行きません。— Because it is raining, I will not go.', 'Plain form + ので', 'N4'],
  ['you-ni', '〜ように', 'So that / in order that. 忘れないようにメモします。— I take notes so that I will not forget.', 'Plain / potential form + ように', 'N4'],
  ['sugiru', '〜すぎる', 'Too much. このかばんは重すぎます。— This bag is too heavy.', 'Verb stem / adjective stem + すぎる', 'N4'],
  ['hajimeru', '〜始める', 'Begin to do. 雨が降り始めました。— It began to rain.', 'Verb stem + 始める', 'N4'],
  ['owaru', '〜終わる', 'Finish doing. 本を読み終わりました。— I finished reading the book.', 'Verb stem + 終わる', 'N4'],
  ['tsuzukeru', '〜続ける', 'Continue doing. 日本語を勉強し続けます。— I will continue studying Japanese.', 'Verb stem + 続ける', 'N4'],
]

export const grammarCards: StudyCard[] = grammarEntries.map(([id, front, back, hint, jlpt = 'N5']) => ({
  id: `grammar-${id}`,
  type: 'grammar',
  front,
  back,
  hint,
  jlpt,
}))
