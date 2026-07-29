import type { JlptLevel } from '../lib/types'
import type { HeroSentenceFrame, HeroStep } from './heroSentences'

export interface HeroStoryBeat {
  japanese: string
  reading: string
  english: string
}

/**
 * A narrative, told once per JLPT level.  The `id` is permanent and shared by
 * every level, so a reader can "level up" the same story and the app can relate
 * the versions to each other.  Add a level by adding a key to `levels`.
 */
export interface HeroStoryDefinition {
  id: string
  title: string
  shortTitle: string
  levels: Partial<Record<JlptLevel, HeroStoryBeat[]>>
}

/** One narrative resolved at one level — what the player actually reads. */
export interface HeroStory {
  id: string
  level: JlptLevel
  title: string
  shortTitle: string
  beats: HeroStoryBeat[]
}

const LEVEL_ORDER: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

export const HERO_STORY_DEFINITIONS: HeroStoryDefinition[] = [
  {
    id: 'school_001',
    title: 'First Day at School',
    shortTitle: 'School Day',
    levels: {
      N5: [
        { japanese: '今日は学校へ行きます。', reading: 'きょうはがっこうへいきます。', english: 'Today I go to school.' },
        { japanese: '新しい教室に入ります。', reading: 'あたらしいきょうしつにはいります。', english: 'I enter the new classroom.' },
        { japanese: '先生は笑います。', reading: 'せんせいはわらいます。', english: 'The teacher smiles.' },
        { japanese: '私は自己紹介をします。', reading: 'わたしはじこしょうかいをします。', english: 'I introduce myself.' },
        { japanese: '学生は私を見ます。', reading: 'がくせいはわたしをみます。', english: 'The students look at me.' },
        { japanese: '隣の学生は話しかけます。', reading: 'となりのがくせいははなしかけます。', english: 'The student next to me speaks to me.' },
        { japanese: '私たちは一緒に昼ご飯を食べます。', reading: 'わたしたちはいっしょにひるごはんをたべます。', english: 'We eat lunch together.' },
        { japanese: '午後は日本語を勉強します。', reading: 'ごごはにほんごをべんきょうします。', english: 'In the afternoon I study Japanese.' },
        { japanese: '私は新しい友達を作ります。', reading: 'わたしはあたらしいともだちをつくります。', english: 'I make a new friend.' },
        { japanese: '学校は楽しいです。', reading: 'がっこうはたのしいです。', english: 'School is fun.' },
      ],
      N4: [
        { japanese: '今日から新しい学校へ通うことになりました。', reading: 'きょうからあたらしいがっこうへかようことになりました。', english: 'Starting today, I will be attending a new school.' },
        { japanese: '教室に入ってから、先生にあいさつをします。', reading: 'きょうしつにはいってから、せんせいにあいさつをします。', english: 'After entering the classroom, I greet the teacher.' },
        { japanese: '少し緊張していますが、笑うようにします。', reading: 'すこしきんちょうしていますが、わらうようにします。', english: "I'm a little nervous, but I try to smile." },
        { japanese: 'みんなの前で自己紹介をしてみます。', reading: 'みんなのまえでじこしょうかいをしてみます。', english: 'I try introducing myself in front of everyone.' },
        { japanese: '隣の学生が話しかけてくれます。', reading: 'となりのがくせいがはなしかけてくれます。', english: 'The student next to me kindly speaks to me.' },
        { japanese: '一緒に昼ご飯を食べながら話します。', reading: 'いっしょにひるごはんをたべながらはなします。', english: 'We talk while eating lunch together.' },
        { japanese: '午後は日本語を勉強したり、本を読んだりします。', reading: 'ごごはにほんごをべんきょうしたり、ほんをよんだりします。', english: 'In the afternoon I study Japanese, read books, and so on.' },
        { japanese: '最初は難しいと思いました。', reading: 'さいしょはむずかしいとおもいました。', english: 'At first I thought it would be difficult.' },
        { japanese: 'でも、新しい友達ができて安心しました。', reading: 'でも、あたらしいともだちができてあんしんしました。', english: 'But I made a new friend and felt relieved.' },
        { japanese: '明日も学校へ来るつもりです。', reading: 'あしたもがっこうへくるつもりです。', english: 'I intend to come to school again tomorrow.' },
      ],
    },
  },
  {
    id: 'wallet_001',
    title: 'The Lost Wallet',
    shortTitle: 'Lost Wallet',
    levels: {
      N5: [
        { japanese: '私は駅へ行きます。', reading: 'わたしはえきへいきます。', english: 'I go to the station.' },
        { japanese: '電車を待ちます。', reading: 'でんしゃをまちます。', english: 'I wait for the train.' },
        { japanese: 'ポケットを見ます。', reading: 'ポケットをみます。', english: 'I look in my pocket.' },
        { japanese: '財布がありません。', reading: 'さいふがありません。', english: "My wallet isn't there." },
        { japanese: 'ベンチの下を探します。', reading: 'ベンチのしたをさがします。', english: 'I search under the bench.' },
        { japanese: '女の人は財布を持っています。', reading: 'おんなのひとはさいふをもっています。', english: 'A woman has the wallet.' },
        { japanese: '女の人は私に財布を渡します。', reading: 'おんなのひとはわたしにさいふをわたします。', english: 'The woman hands me the wallet.' },
        { japanese: '私はありがとうございますと言います。', reading: 'わたしはありがとうございますといいます。', english: 'I say thank you.' },
        { japanese: '電車に乗ります。', reading: 'でんしゃにのります。', english: 'I get on the train.' },
        { japanese: '私は安心します。', reading: 'わたしはあんしんします。', english: 'I feel relieved.' },
      ],
      N4: [
        { japanese: '駅へ向かって歩いていると、財布がないことに気が付きました。', reading: 'えきへむかってあるいていると、さいふがないことにきがつきました。', english: 'As I was walking toward the station, I noticed my wallet was gone.' },
        { japanese: 'ポケットを何度も調べてみます。', reading: 'ポケットをなんどもしらべてみます。', english: 'I check my pockets over and over.' },
        { japanese: 'ベンチの下も探してみました。', reading: 'ベンチのしたもさがしてみました。', english: 'I tried searching under the bench as well.' },
        { japanese: 'でも、財布は見つかりませんでした。', reading: 'でも、さいふはみつかりませんでした。', english: "But the wallet wasn't found." },
        { japanese: '駅員に聞いてみることにします。', reading: 'えきいんにきいてみることにします。', english: 'I decide to try asking a station attendant.' },
        { japanese: '駅員が女の人を呼んでくれました。', reading: 'えきいんがおんなのひとをよんでくれました。', english: 'The attendant kindly called a woman over.' },
        { japanese: '女の人は財布を拾っていたそうです。', reading: 'おんなのひとはさいふをひろっていたそうです。', english: 'Apparently the woman had picked up the wallet.' },
        { japanese: '財布を返してもらって安心しました。', reading: 'さいふをかえしてもらってあんしんしました。', english: 'I got my wallet back and felt relieved.' },
        { japanese: 'お礼を言ってから電車に乗ります。', reading: 'おれいをいってからでんしゃにのります。', english: 'After thanking her, I get on the train.' },
        { japanese: '次からはもっと気を付けようと思います。', reading: 'つぎからはもっときをつけようとおもいます。', english: 'From now on I think I will be more careful.' },
      ],
    },
  },
  {
    id: 'shopping_001',
    title: 'Grocery Shopping',
    shortTitle: 'Groceries',
    levels: {
      N5: [
        { japanese: '私はスーパーへ行きます。', reading: 'わたしはスーパーへいきます。', english: 'I go to the supermarket.' },
        { japanese: '野菜を見ます。', reading: 'やさいをみます。', english: 'I look at the vegetables.' },
        { japanese: 'トマトを買います。', reading: 'トマトをかいます。', english: 'I buy tomatoes.' },
        { japanese: '牛乳も買います。', reading: 'ぎゅうにゅうもかいます。', english: 'I buy milk too.' },
        { japanese: 'パンをかごに入れます。', reading: 'パンをかごにいれます。', english: 'I put bread in the basket.' },
        { japanese: 'レジへ行きます。', reading: 'レジへいきます。', english: 'I go to the register.' },
        { japanese: 'お金を払います。', reading: 'おかねをはらいます。', english: 'I pay.' },
        { japanese: '店員は笑います。', reading: 'てんいんはわらいます。', english: 'The clerk smiles.' },
        { japanese: '買い物は終わります。', reading: 'かいものはおわります。', english: 'The shopping is finished.' },
        { japanese: '家へ帰ります。', reading: 'いえへかえります。', english: 'I go home.' },
      ],
      N4: [
        { japanese: '晩ご飯の材料を買うためにスーパーへ行きます。', reading: 'ばんごはんのざいりょうをかうためにスーパーへいきます。', english: 'I go to the supermarket to buy ingredients for dinner.' },
        { japanese: '野菜を選んでから肉を探します。', reading: 'やさいをえらんでからにくをさがします。', english: 'After choosing vegetables, I look for meat.' },
        { japanese: 'トマトや玉ねぎを買うことにしました。', reading: 'トマトやたまねぎをかうことにしました。', english: 'I decided to buy tomatoes, onions, and the like.' },
        { japanese: '牛乳もなくなりそうです。', reading: 'ぎゅうにゅうもなくなりそうです。', english: 'It looks like the milk will run out too.' },
        { japanese: 'パンや卵も買ってしまいました。', reading: 'パンやたまごもかってしまいました。', english: 'I ended up buying bread and eggs as well.' },
        { japanese: 'レジにはたくさんの人が並んでいます。', reading: 'レジにはたくさんのひとがならんでいます。', english: 'A lot of people are lined up at the register.' },
        { japanese: '少し待たなければなりません。', reading: 'すこしまたなければなりません。', english: 'I have to wait a little.' },
        { japanese: 'お金を払って袋をもらいます。', reading: 'おかねをはらってふくろをもらいます。', english: 'I pay and receive a bag.' },
        { japanese: '買い物が終わってほっとしました。', reading: 'かいものがおわってほっとしました。', english: 'I felt relieved once the shopping was over.' },
        { japanese: '家に帰って料理を始めます。', reading: 'いえにかえってりょうりをはじめます。', english: 'I go home and start cooking.' },
      ],
    },
  },
  {
    id: 'konbini_001',
    title: 'At the Convenience Store',
    shortTitle: 'Convenience',
    levels: {
      N5: [
        { japanese: '私はコンビニへ行きます。', reading: 'わたしはコンビニへいきます。', english: 'I go to the convenience store.' },
        { japanese: 'お茶を探します。', reading: 'おちゃをさがします。', english: 'I look for tea.' },
        { japanese: 'サンドイッチを見ます。', reading: 'サンドイッチをみます。', english: 'I look at the sandwiches.' },
        { japanese: 'おにぎりも買います。', reading: 'おにぎりもかいます。', english: 'I buy a rice ball too.' },
        { japanese: '店員は袋をくれます。', reading: 'てんいんはふくろをくれます。', english: 'The clerk gives me a bag.' },
        { japanese: 'お金を払います。', reading: 'おかねをはらいます。', english: 'I pay.' },
        { japanese: '店を出ます。', reading: 'みせをでます。', english: 'I leave the store.' },
        { japanese: '公園へ歩きます。', reading: 'こうえんへあるきます。', english: 'I walk to the park.' },
        { japanese: 'ベンチに座ります。', reading: 'ベンチにすわります。', english: 'I sit on a bench.' },
        { japanese: '昼ご飯を食べます。', reading: 'ひるごはんをたべます。', english: 'I eat lunch.' },
      ],
      N4: [
        { japanese: '飲み物を買うためにコンビニへ入ります。', reading: 'のみものをかうためにコンビニへはいります。', english: 'I go into the convenience store to buy a drink.' },
        { japanese: '新しいお茶を飲んでみたいと思います。', reading: 'あたらしいおちゃをのんでみたいとおもいます。', english: "I think I'd like to try the new tea." },
        { japanese: 'おにぎりとサンドイッチを買うことにしました。', reading: 'おにぎりとサンドイッチをかうことにしました。', english: 'I decided to buy a rice ball and a sandwich.' },
        { japanese: '甘い物も食べたくなりました。', reading: 'あまいものもたべたくなりました。', english: 'I started wanting something sweet as well.' },
        { japanese: '店員が袋をくれました。', reading: 'てんいんがふくろをくれました。', english: 'The clerk gave me a bag.' },
        { japanese: '支払いをしてから店を出ます。', reading: 'しはらいをしてからみせをでます。', english: 'After paying, I leave the store.' },
        { japanese: '公園まで歩きながら飲みます。', reading: 'こうえんまであるきながらのみます。', english: 'I drink while walking to the park.' },
        { japanese: 'ベンチに座って昼ご飯を食べます。', reading: 'ベンチにすわってひるごはんをたべます。', english: 'I sit on a bench and eat lunch.' },
        { japanese: '少し休んでから会社へ向かいます。', reading: 'すこしやすんでからかいしゃへむかいます。', english: 'After resting a bit, I head to the office.' },
        { japanese: '忙しい一日になりそうです。', reading: 'いそがしいいちにちになりそうです。', english: 'It looks like it will be a busy day.' },
      ],
    },
  },
  {
    id: 'park_001',
    title: 'Going to the Park',
    shortTitle: 'The Park',
    levels: {
      N5: [
        { japanese: '今日は天気がいいです。', reading: 'きょうはてんきがいいです。', english: 'The weather is nice today.' },
        { japanese: '私は公園へ行きます。', reading: 'わたしはこうえんへいきます。', english: 'I go to the park.' },
        { japanese: '子供たちは遊びます。', reading: 'こどもたちはあそびます。', english: 'The children play.' },
        { japanese: '犬が走ります。', reading: 'いぬがはしります。', english: 'A dog runs.' },
        { japanese: '私は本を読みます。', reading: 'わたしはほんをよみます。', english: 'I read a book.' },
        { japanese: '鳥を見ます。', reading: 'とりをみます。', english: 'I watch the birds.' },
        { japanese: '友達が来ます。', reading: 'ともだちがきます。', english: 'A friend comes.' },
        { japanese: '一緒に話します。', reading: 'いっしょにはなします。', english: 'We talk together.' },
        { japanese: '少し歩きます。', reading: 'すこしあるきます。', english: 'We walk a little.' },
        { japanese: '家へ帰ります。', reading: 'いえへかえります。', english: 'I go home.' },
      ],
      N4: [
        { japanese: '天気がよかったので公園へ行きました。', reading: 'てんきがよかったのでこうえんへいきました。', english: 'The weather was nice, so I went to the park.' },
        { japanese: '子供たちが元気に遊んでいます。', reading: 'こどもたちがげんきにあそんでいます。', english: 'The children are playing energetically.' },
        { japanese: '犬が楽しそうに走っています。', reading: 'いぬがたのしそうにはしっています。', english: 'A dog is running as if it is having fun.' },
        { japanese: 'ベンチに座って本を読み始めます。', reading: 'ベンチにすわってほんをよみはじめます。', english: 'I sit on a bench and start reading a book.' },
        { japanese: '鳥の声を聞きながら読みます。', reading: 'とりのこえをききながらよみます。', english: 'I read while listening to the birds.' },
        { japanese: '友達も来ることになっています。', reading: 'ともだちもくることになっています。', english: 'A friend is supposed to come as well.' },
        { japanese: '一緒に散歩したり写真を撮ったりしました。', reading: 'いっしょにさんぽしたりしゃしんをとったりしました。', english: 'We took a walk, took photos, and so on.' },
        { japanese: '少し疲れたので休みます。', reading: 'すこしつかれたのでやすみます。', english: 'I got a little tired, so I rest.' },
        { japanese: '夕方になって涼しくなりました。', reading: 'ゆうがたになってすずしくなりました。', english: 'Evening came and it grew cool.' },
        { japanese: 'また来たいと思います。', reading: 'またきたいとおもいます。', english: 'I think I would like to come again.' },
      ],
    },
  },
  {
    id: 'birthday_001',
    title: 'Birthday Party',
    shortTitle: 'Birthday',
    levels: {
      N5: [
        { japanese: '今日は私の誕生日です。', reading: 'きょうはわたしのたんじょうびです。', english: 'Today is my birthday.' },
        { japanese: '家族が来ます。', reading: 'かぞくがきます。', english: 'My family comes.' },
        { japanese: 'ケーキがあります。', reading: 'ケーキがあります。', english: 'There is a cake.' },
        { japanese: 'ろうそくをつけます。', reading: 'ろうそくをつけます。', english: 'I light the candles.' },
        { japanese: 'みんなで歌います。', reading: 'みんなでうたいます。', english: 'Everyone sings together.' },
        { japanese: 'ろうそくを消します。', reading: 'ろうそくをけします。', english: 'I blow out the candles.' },
        { japanese: 'プレゼントを開けます。', reading: 'プレゼントをあけます。', english: 'I open the presents.' },
        { japanese: '本をもらいます。', reading: 'ほんをもらいます。', english: 'I receive a book.' },
        { japanese: 'とてもうれしいです。', reading: 'とてもうれしいです。', english: 'I am very happy.' },
        { japanese: '楽しい一日です。', reading: 'たのしいいちにちです。', english: 'It is a fun day.' },
      ],
      N4: [
        { japanese: '今日は誕生日なので家族が集まります。', reading: 'きょうはたんじょうびなのでかぞくがあつまります。', english: 'Today is my birthday, so my family gathers.' },
        { japanese: '母がケーキを作ってくれました。', reading: 'ははがケーキをつくってくれました。', english: 'My mother made a cake for me.' },
        { japanese: 'みんなで写真を撮ってから食べます。', reading: 'みんなでしゃしんをとってからたべます。', english: 'We all take a photo, and then we eat.' },
        { japanese: 'プレゼントを開けてみます。', reading: 'プレゼントをあけてみます。', english: 'I try opening the presents.' },
        { japanese: '欲しかった本だったのでうれしくなりました。', reading: 'ほしかったほんだったのでうれしくなりました。', english: 'It was the book I had wanted, so I became happy.' },
        { japanese: '祖父も手紙を書いてくれました。', reading: 'そふもてがみをかいてくれました。', english: 'My grandfather wrote me a letter too.' },
        { japanese: '家族と話したり笑ったりしました。', reading: 'かぞくとはなしたりわらったりしました。', english: 'I talked and laughed with my family.' },
        { japanese: '楽しい時間はすぐ終わってしまいます。', reading: 'たのしいじかんはすぐおわってしまいます。', english: 'Enjoyable times end all too quickly.' },
        { japanese: '来年もお祝いしたいと思います。', reading: 'らいねんもおいわいしたいとおもいます。', english: 'I would like to celebrate again next year.' },
        { japanese: 'とても思い出に残る一日でした。', reading: 'とてもおもいでにのこるいちにちでした。', english: 'It was a very memorable day.' },
      ],
    },
  },
  {
    id: 'cooking_001',
    title: 'Cooking Dinner',
    shortTitle: 'Cooking',
    levels: {
      N5: [
        { japanese: '私は台所へ行きます。', reading: 'わたしはだいどころへいきます。', english: 'I go to the kitchen.' },
        { japanese: '野菜を切ります。', reading: 'やさいをきります。', english: 'I cut the vegetables.' },
        { japanese: '肉を焼きます。', reading: 'にくをやきます。', english: 'I grill the meat.' },
        { japanese: 'ご飯を作ります。', reading: 'ごはんをつくります。', english: 'I make the rice.' },
        { japanese: 'スープも作ります。', reading: 'スープもつくります。', english: 'I make soup too.' },
        { japanese: '家族が来ます。', reading: 'かぞくがきます。', english: 'My family comes.' },
        { japanese: '一緒に食べます。', reading: 'いっしょにたべます。', english: 'We eat together.' },
        { japanese: 'とてもおいしいです。', reading: 'とてもおいしいです。', english: 'It is very delicious.' },
        { japanese: 'お皿を洗います。', reading: 'おさらをあらいます。', english: 'I wash the dishes.' },
        { japanese: '少し休みます。', reading: 'すこしやすみます。', english: 'I rest a little.' },
      ],
      N4: [
        { japanese: '家族のために晩ご飯を作ることにしました。', reading: 'かぞくのためにばんごはんをつくることにしました。', english: 'I decided to make dinner for my family.' },
        { japanese: '野菜を切ってから肉を焼きます。', reading: 'やさいをきってからにくをやきます。', english: 'After cutting the vegetables, I grill the meat.' },
        { japanese: 'スープも作り始めます。', reading: 'スープもつくりはじめます。', english: 'I start making soup as well.' },
        { japanese: '少し塩を入れすぎてしまいました。', reading: 'すこししおをいれすぎてしまいました。', english: 'I ended up adding a little too much salt.' },
        { japanese: '味を見てみます。', reading: 'あじをみてみます。', english: 'I taste it to check.' },
        { japanese: '家族が手伝ってくれました。', reading: 'かぞくがてつだってくれました。', english: 'My family helped me out.' },
        { japanese: 'みんなで楽しく食べます。', reading: 'みんなでたのしくたべます。', english: 'We all eat happily together.' },
        { japanese: 'おいしいと言ってもらいました。', reading: 'おいしいといってもらいました。', english: 'They told me it was delicious.' },
        { japanese: '食べ終わってから皿を洗います。', reading: 'たべおわってからさらをあらいます。', english: 'After we finish eating, I wash the dishes.' },
        { japanese: 'また作ってみたいと思います。', reading: 'またつくってみたいとおもいます。', english: 'I think I would like to make it again.' },
      ],
    },
  },
  {
    id: 'grandma_001',
    title: "Visiting Grandma",
    shortTitle: 'Grandma',
    levels: {
      N5: [
        { japanese: '今日は祖母の家へ行きます。', reading: 'きょうはそぼのいえへいきます。', english: "Today I go to my grandmother's house." },
        { japanese: '祖母は笑います。', reading: 'そぼはわらいます。', english: 'My grandmother smiles.' },
        { japanese: 'お茶を飲みます。', reading: 'おちゃをのみます。', english: 'We drink tea.' },
        { japanese: '一緒に話します。', reading: 'いっしょにはなします。', english: 'We talk together.' },
        { japanese: '写真を見ます。', reading: 'しゃしんをみます。', english: 'We look at photos.' },
        { japanese: '昼ご飯を食べます。', reading: 'ひるごはんをたべます。', english: 'We eat lunch.' },
        { japanese: '散歩をします。', reading: 'さんぽをします。', english: 'We take a walk.' },
        { japanese: '私は祖母を手伝います。', reading: 'わたしはそぼをてつだいます。', english: 'I help my grandmother.' },
        { japanese: '祖母は喜びます。', reading: 'そぼはよろこびます。', english: 'My grandmother is delighted.' },
        { japanese: 'また来ますと言います。', reading: 'またきますといいます。', english: 'I say that I will come again.' },
      ],
      N4: [
        { japanese: '久しぶりに祖母の家へ行くことにしました。', reading: 'ひさしぶりにそぼのいえへいくことにしました。', english: "I decided to visit my grandmother's house for the first time in a while." },
        { japanese: '着いてから一緒にお茶を飲みます。', reading: 'ついてからいっしょにおちゃをのみます。', english: 'After arriving, we drink tea together.' },
        { japanese: '昔の写真を見ながら話しました。', reading: 'むかしのしゃしんをみながらはなしました。', english: 'We talked while looking at old photos.' },
        { japanese: '祖母は元気そうでした。', reading: 'そぼはげんきそうでした。', english: 'My grandmother seemed well.' },
        { japanese: '昼ご飯を食べてから散歩します。', reading: 'ひるごはんをたべてからさんぽします。', english: 'After eating lunch, we take a walk.' },
        { japanese: '荷物を運ぶのを手伝いました。', reading: 'にもつをはこぶのをてつだいました。', english: 'I helped her carry her things.' },
        { japanese: '祖母はとても喜んでくれました。', reading: 'そぼはとてもよろこんでくれました。', english: 'My grandmother was very pleased.' },
        { japanese: 'もっと長くいたかったです。', reading: 'もっとながくいたかったです。', english: 'I wanted to stay longer.' },
        { japanese: '帰る前にまた来ると約束しました。', reading: 'かえるまえにまたくるとやくそくしました。', english: 'Before leaving, I promised to come again.' },
        { japanese: 'とても楽しい一日になりました。', reading: 'とてもたのしいいちにちになりました。', english: 'It turned into a very enjoyable day.' },
      ],
    },
  },
  {
    id: 'rain_001',
    title: 'A Rainy Day',
    shortTitle: 'Rainy Day',
    levels: {
      N5: [
        { japanese: '朝は雨です。', reading: 'あさはあめです。', english: 'It is raining in the morning.' },
        { japanese: '私は傘を持ちます。', reading: 'わたしはかさをもちます。', english: 'I take an umbrella.' },
        { japanese: '学校へ歩きます。', reading: 'がっこうへあるきます。', english: 'I walk to school.' },
        { japanese: '靴がぬれます。', reading: 'くつがぬれます。', english: 'My shoes get wet.' },
        { japanese: '教室へ入ります。', reading: 'きょうしつへはいります。', english: 'I enter the classroom.' },
        { japanese: '雨はまだ降ります。', reading: 'あめはまだふります。', english: 'It is still raining.' },
        { japanese: '窓を見ます。', reading: 'まどをみます。', english: 'I look out the window.' },
        { japanese: '午後は晴れます。', reading: 'ごごははれます。', english: 'In the afternoon it clears up.' },
        { japanese: '傘をしまいます。', reading: 'かさをしまいます。', english: 'I put away my umbrella.' },
        { japanese: '気分がいいです。', reading: 'きぶんがいいです。', english: 'I feel good.' },
      ],
      N4: [
        { japanese: '朝起きると雨が降っていました。', reading: 'あさおきるとあめがふっていました。', english: 'When I woke up in the morning, it was raining.' },
        { japanese: 'ぬれないように傘を持って出かけます。', reading: 'ぬれないようにかさをもってでかけます。', english: 'I take an umbrella so I do not get wet, and head out.' },
        { japanese: '学校へ歩いていると風も強くなりました。', reading: 'がっこうへあるいているとかぜもつよくなりました。', english: 'As I walked to school, the wind grew stronger too.' },
        { japanese: '靴がぬれてしまいました。', reading: 'くつがぬれてしまいました。', english: 'My shoes ended up getting wet.' },
        { japanese: '教室へ入ってから服を乾かします。', reading: 'きょうしつへはいってからふくをかわかします。', english: 'After entering the classroom, I dry my clothes.' },
        { japanese: '午前中はずっと雨でした。', reading: 'ごぜんちゅうはずっとあめでした。', english: 'It rained the entire morning.' },
        { japanese: '窓の外を見ながら授業を受けます。', reading: 'まどのそとをみながらじゅぎょうをうけます。', english: 'I attend class while looking out the window.' },
        { japanese: '午後になると晴れてきました。', reading: 'ごごになるとはれてきました。', english: 'When afternoon came, it began to clear up.' },
        { japanese: '帰るころには道も乾いていました。', reading: 'かえるころにはみちもかわいていました。', english: 'By the time I headed home, the roads had dried too.' },
        { japanese: '明日は晴れるといいと思います。', reading: 'あしたははれるといいとおもいます。', english: 'I hope it will be sunny tomorrow.' },
      ],
    },
  },
  {
    id: 'zoo_001',
    title: 'Going to the Zoo',
    shortTitle: 'The Zoo',
    levels: {
      N5: [
        { japanese: '私は動物園へ行きます。', reading: 'わたしはどうぶつえんへいきます。', english: 'I go to the zoo.' },
        { japanese: 'ライオンを見ます。', reading: 'ライオンをみます。', english: 'I look at the lions.' },
        { japanese: 'ゾウも見ます。', reading: 'ゾウもみます。', english: 'I look at the elephants too.' },
        { japanese: 'サルは木に登ります。', reading: 'サルはきにのぼります。', english: 'The monkeys climb the tree.' },
        { japanese: 'ペンギンは泳ぎます。', reading: 'ペンギンはおよぎます。', english: 'The penguins swim.' },
        { japanese: 'キリンは大きいです。', reading: 'キリンはおおきいです。', english: 'The giraffes are big.' },
        { japanese: '写真を撮ります。', reading: 'しゃしんをとります。', english: 'I take photos.' },
        { japanese: 'アイスクリームを食べます。', reading: 'アイスクリームをたべます。', english: 'I eat ice cream.' },
        { japanese: 'とても楽しいです。', reading: 'とてもたのしいです。', english: 'It is very fun.' },
        { japanese: 'また来たいです。', reading: 'またきたいです。', english: 'I want to come again.' },
      ],
      N4: [
        { japanese: '動物園へ行くことにしました。', reading: 'どうぶつえんへいくことにしました。', english: 'I decided to go to the zoo.' },
        { japanese: '入ってすぐライオンを見つけました。', reading: 'はいってすぐライオンをみつけました。', english: 'Right after going in, I spotted the lions.' },
        { japanese: 'ゾウやキリンの写真を撮ります。', reading: 'ゾウやキリンのしゃしんをとります。', english: 'I take photos of the elephants, giraffes, and so on.' },
        { japanese: 'サルは木を登ったり飛んだりしています。', reading: 'サルはきをのぼったりとんだりしています。', english: 'The monkeys are climbing trees and leaping about.' },
        { japanese: 'ペンギンが気持ちよさそうに泳いでいます。', reading: 'ペンギンがきもちよさそうにおよいでいます。', english: 'The penguins are swimming as if it feels wonderful.' },
        { japanese: '動物についてたくさん勉強できました。', reading: 'どうぶつについてたくさんべんきょうできました。', english: 'I was able to learn a lot about animals.' },
        { japanese: 'おなかがすいたのでアイスクリームを買います。', reading: 'おなかがすいたのでアイスクリームをかいます。', english: 'I got hungry, so I buy ice cream.' },
        { japanese: '一日中歩いたので少し疲れました。', reading: 'いちにちじゅうあるいたのですこしつかれました。', english: 'I walked all day, so I got a little tired.' },
        { japanese: 'とても楽しい思い出になりました。', reading: 'とてもたのしいおもいでになりました。', english: 'It became a very happy memory.' },
        { japanese: 'また家族と来たいと思います。', reading: 'またかぞくときたいとおもいます。', english: 'I think I would like to come again with my family.' },
      ],
    },
  },
]

/** Every (narrative × level) pairing that actually has beats written. */
export const HERO_STORIES: HeroStory[] = HERO_STORY_DEFINITIONS.flatMap((definition) =>
  LEVEL_ORDER.flatMap((level) => {
    const beats = definition.levels[level]
    if (!beats) return []
    return [{
      id: definition.id,
      level,
      title: definition.title,
      shortTitle: definition.shortTitle,
      beats,
    }]
  }),
)

/** Only the levels some story has been written for, easiest-first. */
export const HERO_STORY_LEVELS: JlptLevel[] = LEVEL_ORDER.filter(
  (level) => HERO_STORIES.some((story) => story.level === level),
)

export function getHeroStoriesForLevel(level: JlptLevel): HeroStory[] {
  return HERO_STORIES.filter((story) => story.level === level)
}

/**
 * Resolve a story for a level.  Falls back within the level before falling back
 * across levels, so switching to a level that lacks the current narrative still
 * lands on a readable story rather than an empty one.
 */
export function getHeroStory(id: string, level: JlptLevel): HeroStory {
  return HERO_STORIES.find((story) => story.id === id && story.level === level)
    ?? getHeroStoriesForLevel(level)[0]
    ?? HERO_STORIES.find((story) => story.id === id)
    ?? HERO_STORIES[0]!
}

function storyFrame(story: HeroStory, beat: HeroStoryBeat, index: number): HeroSentenceFrame {
  return {
    generatedEnglish: beat.english,
    generatedPatternId: `story-${story.id}-${story.level}-${index}`,
    generatedReading: beat.reading,
    prefix: '',
    subject: '',
    topicParticle: '',
    modifier: '',
    word: '',
    objectParticle: '',
    bridge: '',
    predicate: '',
    segments: [{
      key: 'story',
      text: beat.japanese,
      reading: beat.reading,
      swappable: true,
      posCategory: 'noun',
    }],
  }
}

export function buildHeroStorySteps(storyId: string, level: JlptLevel = 'N5'): HeroStep[] {
  const story = getHeroStory(storyId, level)
  return story.beats.map((beat, index) => ({
    frame: storyFrame(story, beat, index),
    changed: index === 0 ? [] : ['story'],
    slotWidths: {
      prefix: 2,
      subject: 1,
      topicParticle: 1,
      modifier: 1,
      word: 1,
      objectParticle: 1,
      bridge: 2,
      predicate: 2,
    },
    templateRefresh: true,
  }))
}
