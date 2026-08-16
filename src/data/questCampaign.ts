import type { DrillExercise } from '../lib/drillExercises'

/**
 * Relic perks are the mechanical half of a quest reward — the battle screen
 * reads these ids to decide what actually happens, while the copy on the
 * reward itself explains it to the player.
 */
export type RelicPerk =
  | 'dawn-guard'
  | 'second-wind'
  | 'clear-path'
  | 'true-sight'
  | 'perfect-edge'
  | 'change-fate'
  | 'iron-will'
  | 'twin-strike'
  | 'ward-echo'
  | 'kitsune-luck'
  | 'mountain-stance'
  | 'lantern-flame'

/** A guardian's signature counter, shown when it lands a hit on the player. */
export type GuardianAttack = {
  name: string
  japanese: string
  flavor: string
}

export type GuardianBattleStyle =
  | 'sludge'
  | 'ember'
  | 'frost'
  | 'vanish'
  | 'wind'
  | 'storm'
  | 'shadow'
  | 'bone'
  | 'foxfire'
  | 'spirit'
  | 'earth'
  | 'oni'

/**
 * Later guardians fight in phases: each cleared phase changes the guardian's
 * look and taunt rather than simply draining one shared health bar, which is
 * what makes the final encounters feel like a real escalation.
 */
export type GuardianPhase = {
  name: string
  mark: string
  taunt: string
}

export type QuestDefinition = {
  id: string
  number: number
  symbol: string
  title: string
  subtitle: string
  level: 'N5' | 'N4' | 'N3'
  arcId: string
  vocabularySetId: string
  vocabularyTheme: string
  grammar: readonly string[]
  storyTitle: string
  storyJapanese: string
  storyEnglish: string
  scene: readonly { japanese: string; reading: string; english: string }[]
  grammarDrills: readonly DrillExercise[]
  guardian: {
    name: string
    japanese: string
    title: string
    mark: string
    lore: string
    portrait?: string
    battleStyle: GuardianBattleStyle
    /** Strikes needed to break the seal. Bosses run higher. */
    health?: number
    attacks?: readonly GuardianAttack[]
    phases?: readonly GuardianPhase[]
  }
  reward: {
    name: string
    mark: string
    perk: RelicPerk
    perkTitle: string
    perkDescription: string
  }
}

export type CampaignArc = {
  id: string
  title: string
  japanese: string
  subtitle: string
  blurb: string
  mark: string
}

/**
 * What the whole campaign is for.
 *
 * Each arc explains its own chapter, but nothing said where the road ends, so
 * the quest list read as twelve separate errands. This is the one line that
 * makes them a journey: the relics are not trophies, they are the twelve
 * seals the lantern needs before it will light.
 */
export const CAMPAIGN_GOAL = {
  mark: '灯',
  title: 'Rekindle the Hollow Lantern',
  japanese: '空提灯に灯を',
  premise: 'Yōkai stole the seals of everyday Japanese and fed them to a lantern that burns without light.',
  promise: 'Recover all twelve and the lantern lights again.',
} as const

export const CAMPAIGN_ARCS: readonly CampaignArc[] = [
  {
    id: 'inkbound',
    title: 'The Inkbound Road',
    japanese: '墨の道',
    subtitle: 'Campaign I · N5',
    blurb: 'Yōkai have stolen the seals of everyday speech. Walk the road and take them back, one ordinary day at a time.',
    mark: '墨',
  },
  {
    id: 'hollow-lantern',
    title: 'The Hollow Lantern',
    japanese: '空提灯',
    subtitle: 'Campaign II · N4',
    blurb: 'The road darkens. Something older is gathering the stolen words into a lantern that burns without light.',
    mark: '灯',
  },
]

/* ---------------------------------------------------------------------- */
/* Quest 01 — home                                                         */
/* ---------------------------------------------------------------------- */

const homeGrammarDrills: readonly DrillExercise[] = [
  {
    id: 'quest-first-morning-from-futon', jlpt: 'N5', complexity: 1,
    prompt: '朝、私は布団___出ます。', promptReading: 'あさ、わたしはふとん___でます。',
    answer: 'から', answerReading: 'から', options: ['から', 'まで', 'に', 'へ'], optionReadings: ['から', 'まで', 'に', 'へ'],
    english: 'In the morning, I get out of my futon.', pattern: 'から', meaning: 'from / starting point', blankSlot: 'origin',
  },
  {
    id: 'quest-first-morning-washroom', jlpt: 'N5', complexity: 1,
    prompt: '洗面所___歯ブラシを使います。', promptReading: 'せんめんじょ___はぶらしをつかいます。',
    answer: 'で', answerReading: 'で', options: ['で', 'に', 'を', 'と'], optionReadings: ['で', 'に', 'を', 'と'],
    english: 'I use a toothbrush in the washroom.', pattern: 'で', meaning: 'where an action happens', blankSlot: 'location',
  },
  {
    id: 'quest-first-morning-laundry', jlpt: 'N5', complexity: 1,
    prompt: '母は洗濯をし___。', promptReading: 'はははせんたくをし___。',
    answer: 'ています', answerReading: 'ています', options: ['ています', 'ます', 'ました', 'ません'], optionReadings: ['ています', 'ます', 'ました', 'ません'],
    english: 'My mother is doing the laundry.', pattern: '～ています', meaning: 'an action in progress', blankSlot: 'verb-form',
  },
  {
    id: 'quest-first-morning-cleaning', jlpt: 'N5', complexity: 1,
    prompt: '私は部屋を掃除し___、ゴミ箱にごみを入れます。', promptReading: 'わたしはへやをそうじし___、ごみばこにごみをいれます。',
    answer: 'て', answerReading: 'て', options: ['て', 'た', 'る', 'ない'], optionReadings: ['て', 'た', 'る', 'ない'],
    english: 'I clean the room and put the trash in the trash can.', pattern: '～て', meaning: 'linking actions', blankSlot: 'connector',
  },
  {
    id: 'quest-first-morning-entrance', jlpt: 'N5', complexity: 1,
    prompt: '玄関___毛布があります。', promptReading: 'げんかん___もうふがあります。',
    answer: 'に', answerReading: 'に', options: ['に', 'で', 'を', 'と'], optionReadings: ['に', 'で', 'を', 'と'],
    english: 'There is a blanket in the entryway.', pattern: 'あります', meaning: 'exists / is located', blankSlot: 'location',
  },
]

/* ---------------------------------------------------------------------- */
/* Quest 02 — food                                                         */
/* ---------------------------------------------------------------------- */

const foodGrammarDrills: readonly DrillExercise[] = [
  {
    id: 'quest-lunch-like-ramen', jlpt: 'N5', complexity: 1,
    prompt: '私はラーメン___好きです。', promptReading: 'わたしはラーメン___すきです。',
    answer: 'が', answerReading: 'が', options: ['が', 'を', 'は', 'に'], optionReadings: ['が', 'を', 'は', 'に'],
    english: 'I like ramen.', pattern: '～が好きです', meaning: 'marks what is liked', blankSlot: 'subject',
  },
  {
    id: 'quest-lunch-water-please', jlpt: 'N5', complexity: 1,
    prompt: 'すみません、水___ください。', promptReading: 'すみません、みず___ください。',
    answer: 'を', answerReading: 'を', options: ['を', 'が', 'に', 'で'], optionReadings: ['を', 'が', 'に', 'で'],
    english: 'Excuse me, water please.', pattern: '～をください', meaning: 'requesting an item', blankSlot: 'object',
  },
  {
    id: 'quest-lunch-shop-gyoza', jlpt: 'N5', complexity: 1,
    prompt: 'この店___餃子はとても美味しいです。', promptReading: 'このみせ___ぎょうざはとてもおいしいです。',
    answer: 'の', answerReading: 'の', options: ['の', 'は', 'が', 'で'], optionReadings: ['の', 'は', 'が', 'で'],
    english: "This shop's gyoza is very delicious.", pattern: 'の', meaning: 'connects two nouns', blankSlot: 'possessive',
  },
  {
    id: 'quest-lunch-with-friend', jlpt: 'N5', complexity: 1,
    prompt: '友達___一緒に昼ご飯を食べます。', promptReading: 'ともだち___いっしょにひるごはんをたべます。',
    answer: 'と', answerReading: 'と', options: ['と', 'に', 'で', 'を'], optionReadings: ['と', 'に', 'で', 'を'],
    english: 'I eat lunch together with a friend.', pattern: '～と一緒に', meaning: 'doing something with someone', blankSlot: 'companion',
  },
  {
    id: 'quest-lunch-check-please', jlpt: 'N5', complexity: 1,
    prompt: 'お会計___お願いします。', promptReading: 'おかいけい___おねがいします。',
    answer: 'を', answerReading: 'を', options: ['を', 'が', 'は', 'と'], optionReadings: ['を', 'が', 'は', 'と'],
    english: 'The check, please.', pattern: '～をお願いします', meaning: 'polite request', blankSlot: 'object',
  },
]

/* ---------------------------------------------------------------------- */
/* Quest 03 — travel                                                       */
/* ---------------------------------------------------------------------- */

const travelGrammarDrills: readonly DrillExercise[] = [
  {
    id: 'quest-train-to-tokyo', jlpt: 'N5', complexity: 1,
    prompt: '私は東京___行きます。', promptReading: 'わたしはとうきょう___いきます。',
    answer: 'へ', answerReading: 'へ', options: ['へ', 'で', 'を', 'から'], optionReadings: ['へ', 'で', 'を', 'から'],
    english: 'I am going to Tokyo.', pattern: '～へ行きます', meaning: 'direction of travel', blankSlot: 'destination',
  },
  {
    id: 'quest-train-waiting-at-station', jlpt: 'N5', complexity: 1,
    prompt: '駅___電車を待っています。', promptReading: 'えき___でんしゃをまっています。',
    answer: 'で', answerReading: 'で', options: ['で', 'に', 'へ', 'を'], optionReadings: ['で', 'に', 'へ', 'を'],
    english: 'I am waiting for the train at the station.', pattern: 'で', meaning: 'where an action happens', blankSlot: 'location',
  },
  {
    id: 'quest-train-board', jlpt: 'N5', complexity: 1,
    prompt: '電車___乗ります。', promptReading: 'でんしゃ___のります。',
    answer: 'に', answerReading: 'に', options: ['に', 'を', 'で', 'へ'], optionReadings: ['に', 'を', 'で', 'へ'],
    english: 'I board the train.', pattern: '～に乗ります', meaning: 'getting on a vehicle', blankSlot: 'target',
  },
  {
    id: 'quest-train-platform-three', jlpt: 'N5', complexity: 1,
    prompt: '次の電車は三番線___出ます。', promptReading: 'つぎのでんしゃはさんばんせん___でます。',
    answer: 'から', answerReading: 'から', options: ['から', 'まで', 'に', 'で'], optionReadings: ['から', 'まで', 'に', 'で'],
    english: 'The next train departs from platform three.', pattern: 'から', meaning: 'from / starting point', blankSlot: 'origin',
  },
  {
    id: 'quest-train-ticket-window', jlpt: 'N5', complexity: 1,
    prompt: '切符売り場___どこですか。', promptReading: 'きっぷうりば___どこですか。',
    answer: 'は', answerReading: 'は', options: ['は', 'が', 'を', 'に'], optionReadings: ['は', 'が', 'を', 'に'],
    english: 'Where is the ticket window?', pattern: 'は', meaning: 'marks the topic', blankSlot: 'topic',
  },
]

/* ---------------------------------------------------------------------- */
/* Quest 04 — shopping                                                     */
/* ---------------------------------------------------------------------- */

const shoppingGrammarDrills: readonly DrillExercise[] = [
  {
    id: 'quest-wallet-missing', jlpt: 'N5', complexity: 1,
    prompt: '財布___ありません。', promptReading: 'さいふ___ありません。',
    answer: 'が', answerReading: 'が', options: ['が', 'を', 'に', 'で'], optionReadings: ['が', 'を', 'に', 'で'],
    english: 'My wallet is missing.', pattern: 'ありません', meaning: 'does not exist', blankSlot: 'subject',
  },
  {
    id: 'quest-wallet-under-bench', jlpt: 'N5', complexity: 1,
    prompt: 'ベンチ___下を探しました。', promptReading: 'ベンチ___したをさがしました。',
    answer: 'の', answerReading: 'の', options: ['の', 'に', 'で', 'は'], optionReadings: ['の', 'に', 'で', 'は'],
    english: 'I searched under the bench.', pattern: 'の', meaning: 'connects two nouns', blankSlot: 'possessive',
  },
  {
    id: 'quest-wallet-shopping-past', jlpt: 'N5', complexity: 1,
    prompt: '昨日、店で買い物を___。', promptReading: 'きのう、みせでかいものを___。',
    answer: 'しました', answerReading: 'しました', options: ['しました', 'します', 'しません', 'しています'], optionReadings: ['しました', 'します', 'しません', 'しています'],
    english: 'Yesterday I went shopping at the store.', pattern: '～ました', meaning: 'polite past tense', blankSlot: 'verb-form',
  },
  {
    id: 'quest-wallet-did-you-see', jlpt: 'N5', complexity: 1,
    prompt: 'すみません、財布を見___か。', promptReading: 'すみません、さいふをみ___か。',
    answer: 'ませんでした', answerReading: 'ませんでした', options: ['ませんでした', 'ました', 'ます', 'ません'], optionReadings: ['ませんでした', 'ました', 'ます', 'ません'],
    english: "Excuse me, did you not see a wallet?", pattern: '～ませんでしたか', meaning: 'polite past question', blankSlot: 'verb-form',
  },
  {
    id: 'quest-wallet-found-at-koban', jlpt: 'N5', complexity: 1,
    prompt: '交番___財布が見つかりました。', promptReading: 'こうばん___さいふがみつかりました。',
    answer: 'で', answerReading: 'で', options: ['で', 'に', 'へ', 'を'], optionReadings: ['で', 'に', 'へ', 'を'],
    english: 'The wallet was found at the police box.', pattern: 'で', meaning: 'where an action happens', blankSlot: 'location',
  },
]

/* ---------------------------------------------------------------------- */
/* Quest 05 — school                                                       */
/* ---------------------------------------------------------------------- */

const schoolGrammarDrills: readonly DrillExercise[] = [
  {
    id: 'quest-school-enter-and-sit', jlpt: 'N5', complexity: 2,
    prompt: '教室に入___、席に座ります。', promptReading: 'きょうしつにはい___、せきにすわります。',
    answer: 'って', answerReading: 'って', options: ['って', 'った', 'ります', 'らない'], optionReadings: ['って', 'った', 'ります', 'らない'],
    english: 'I enter the classroom and sit in my seat.', pattern: '～て', meaning: 'linking actions in order', blankSlot: 'connector',
  },
  {
    id: 'quest-school-study-at-library', jlpt: 'N5', complexity: 1,
    prompt: '私は毎日図書館___勉強します。', promptReading: 'わたしはまいにちとしょかん___べんきょうします。',
    answer: 'で', answerReading: 'で', options: ['で', 'に', 'へ', 'を'], optionReadings: ['で', 'に', 'へ', 'を'],
    english: 'I study at the library every day.', pattern: 'で', meaning: 'where an action happens', blankSlot: 'location',
  },
  {
    id: 'quest-school-student-speaks', jlpt: 'N5', complexity: 1,
    prompt: '隣の学生___話しかけます。', promptReading: 'となりのがくせい___はなしかけます。',
    answer: 'が', answerReading: 'が', options: ['が', 'を', 'に', 'の'], optionReadings: ['が', 'を', 'に', 'の'],
    english: 'The student next to me speaks to me.', pattern: 'が', meaning: 'marks the doer', blankSlot: 'subject',
  },
  {
    id: 'quest-school-lets-homework', jlpt: 'N5', complexity: 1,
    prompt: '一緒に宿題をし___。', promptReading: 'いっしょにしゅくだいをし___。',
    answer: 'ましょう', answerReading: 'ましょう', options: ['ましょう', 'ました', 'ません', 'ています'], optionReadings: ['ましょう', 'ました', 'ません', 'ています'],
    english: "Let's do our homework together.", pattern: '～ましょう', meaning: 'suggesting an action', blankSlot: 'verb-form',
  },
  {
    id: 'quest-school-introduce', jlpt: 'N5', complexity: 1,
    prompt: '初めまして、田中___。', promptReading: 'はじめまして、たなか___。',
    answer: 'です', answerReading: 'です', options: ['です', 'ます', 'でした', 'ではない'], optionReadings: ['です', 'ます', 'でした', 'ではない'],
    english: 'Nice to meet you, I am Tanaka.', pattern: 'です', meaning: 'polite "to be"', blankSlot: 'copula',
  },
]

/* ---------------------------------------------------------------------- */
/* Quest 06 — nature                                                       */
/* ---------------------------------------------------------------------- */

const natureGrammarDrills: readonly DrillExercise[] = [
  {
    id: 'quest-rain-because-raining', jlpt: 'N4', complexity: 2,
    prompt: '雨が降っている___、家にいます。', promptReading: 'あめがふっている___、いえにいます。',
    answer: 'から', answerReading: 'から', options: ['から', 'ので', 'のに', 'まで'], optionReadings: ['から', 'ので', 'のに', 'まで'],
    english: 'Because it is raining, I stay home.', pattern: '～から', meaning: 'gives a reason', blankSlot: 'reason',
  },
  {
    id: 'quest-rain-sky-became-dark', jlpt: 'N4', complexity: 2,
    prompt: '空が暗___なりました。', promptReading: 'そらがくら___なりました。',
    answer: 'く', answerReading: 'く', options: ['く', 'い', 'に', 'の'], optionReadings: ['く', 'い', 'に', 'の'],
    english: 'The sky became dark.', pattern: '～くなる', meaning: 'becoming (with i-adjectives)', blankSlot: 'adjective-form',
  },
  {
    id: 'quest-rain-if-weather-improves', jlpt: 'N4', complexity: 2,
    prompt: '天気が良くなっ___、公園へ行きます。', promptReading: 'てんきがよくなっ___、こうえんへいきます。',
    answer: 'たら', answerReading: 'たら', options: ['たら', 'ても', 'たり', 'ては'], optionReadings: ['たら', 'ても', 'たり', 'ては'],
    english: 'If the weather improves, I will go to the park.', pattern: '～たら', meaning: 'if / when', blankSlot: 'condition',
  },
  {
    id: 'quest-rain-wind-but-not-cold', jlpt: 'N4', complexity: 2,
    prompt: '風が強いです___、寒くないです。', promptReading: 'かぜがつよいです___、さむくないです。',
    answer: 'が', answerReading: 'が', options: ['が', 'から', 'ので', 'と'], optionReadings: ['が', 'から', 'ので', 'と'],
    english: 'The wind is strong, but it is not cold.', pattern: '～が', meaning: 'but / however', blankSlot: 'contrast',
  },
  {
    id: 'quest-rain-take-umbrella', jlpt: 'N4', complexity: 2,
    prompt: '傘を持___行きます。', promptReading: 'かさをも___いきます。',
    answer: 'って', answerReading: 'って', options: ['って', 'った', 'ちます', 'たない'], optionReadings: ['って', 'った', 'ちます', 'たない'],
    english: 'I will take an umbrella with me.', pattern: '～ていく', meaning: 'doing and going', blankSlot: 'connector',
  },
]

/* ---------------------------------------------------------------------- */
/* Quest 07 — work                                                         */
/* ---------------------------------------------------------------------- */

const workGrammarDrills: readonly DrillExercise[] = [
  {
    id: 'quest-night-must-work-late', jlpt: 'N4', complexity: 3,
    prompt: '今夜は残業をしなければ___。', promptReading: 'こんやはざんぎょうをしなければ___。',
    answer: 'なりません', answerReading: 'なりません', options: ['なりません', 'いいです', 'ください', 'できます'], optionReadings: ['なりません', 'いいです', 'ください', 'できます'],
    english: 'I have to work overtime tonight.', pattern: '～なければならない', meaning: 'must / have to', blankSlot: 'obligation',
  },
  {
    id: 'quest-night-hand-to-manager', jlpt: 'N4', complexity: 3,
    prompt: '部長___会議の資料を渡しました。', promptReading: 'ぶちょう___かいぎのしりょうをわたしました。',
    answer: 'に', answerReading: 'に', options: ['に', 'を', 'で', 'から'], optionReadings: ['に', 'を', 'で', 'から'],
    english: 'I handed the meeting materials to the manager.', pattern: 'に', meaning: 'marks the receiver', blankSlot: 'recipient',
  },
  {
    id: 'quest-night-by-tomorrow', jlpt: 'N4', complexity: 3,
    prompt: 'この仕事は明日___に終わらせます。', promptReading: 'このしごとはあした___におわらせます。',
    answer: 'まで', answerReading: 'まで', options: ['まで', 'から', 'ほど', 'だけ'], optionReadings: ['まで', 'から', 'ほど', 'だけ'],
    english: 'I will finish this work by tomorrow.', pattern: '～までに', meaning: 'by a deadline', blankSlot: 'deadline',
  },
  {
    id: 'quest-night-even-if-phone-rings', jlpt: 'N4', complexity: 3,
    prompt: '電話が鳴っ___、誰も出ません。', promptReading: 'でんわがなっ___、だれもでません。',
    answer: 'ても', answerReading: 'ても', options: ['ても', 'たら', 'たり', 'てから'], optionReadings: ['ても', 'たら', 'たり', 'てから'],
    english: 'Even if the phone rings, no one answers.', pattern: '～ても', meaning: 'even if', blankSlot: 'concession',
  },
  {
    id: 'quest-night-when-left-office', jlpt: 'N4', complexity: 3,
    prompt: '会社を出た___、雨が降っていました。', promptReading: 'かいしゃをでた___、あめがふっていました。',
    answer: '時', answerReading: 'とき', options: ['時', '所', '事', '方'], optionReadings: ['とき', 'ところ', 'こと', 'ほう'],
    english: 'When I left the office, it was raining.', pattern: '～た時', meaning: 'when something happened', blankSlot: 'time',
  },
]

/* ---------------------------------------------------------------------- */
/* Quest 08 — health                                                       */
/* ---------------------------------------------------------------------- */

const healthGrammarDrills: readonly DrillExercise[] = [
  {
    id: 'quest-hospital-because-fever', jlpt: 'N4', complexity: 3,
    prompt: '熱がある___、病院へ行きます。', promptReading: 'ねつがある___、びょういんへいきます。',
    answer: 'ので', answerReading: 'ので', options: ['ので', 'のに', 'まで', 'でも'], optionReadings: ['ので', 'のに', 'まで', 'でも'],
    english: 'Because I have a fever, I am going to the hospital.', pattern: '～ので', meaning: 'gives a soft reason', blankSlot: 'reason',
  },
  {
    id: 'quest-hospital-said-throat-hurts', jlpt: 'N4', complexity: 3,
    prompt: '先生に喉が痛い___言いました。', promptReading: 'せんせいにのどがいたい___いいました。',
    answer: 'と', answerReading: 'と', options: ['と', 'を', 'が', 'の'], optionReadings: ['と', 'を', 'が', 'の'],
    english: 'I told the doctor that my throat hurts.', pattern: '～と言う', meaning: 'quoting speech', blankSlot: 'quote',
  },
  {
    id: 'quest-hospital-better-take-medicine', jlpt: 'N4', complexity: 3,
    prompt: '薬を飲んだ___がいいです。', promptReading: 'くすりをのんだ___がいいです。',
    answer: '方', answerReading: 'ほう', options: ['方', '事', '所', '時'], optionReadings: ['ほう', 'こと', 'ところ', 'とき'],
    english: 'You had better take the medicine.', pattern: '～た方がいい', meaning: 'giving advice', blankSlot: 'advice',
  },
  {
    id: 'quest-hospital-if-overdo-it', jlpt: 'N4', complexity: 3,
    prompt: '無理をする___、もっと悪くなります。', promptReading: 'むりをする___、もっとわるくなります。',
    answer: 'と', answerReading: 'と', options: ['と', 'ても', 'のに', 'から'], optionReadings: ['と', 'ても', 'のに', 'から'],
    english: 'If you overdo it, it will get worse.', pattern: '～と', meaning: 'natural consequence', blankSlot: 'condition',
  },
  {
    id: 'quest-hospital-if-you-rest', jlpt: 'N4', complexity: 3,
    prompt: 'ゆっくり休め___、すぐ治ります。', promptReading: 'ゆっくりやすめ___、すぐなおります。',
    answer: 'ば', answerReading: 'ば', options: ['ば', 'たら', 'ても', 'ては'], optionReadings: ['ば', 'たら', 'ても', 'ては'],
    english: 'If you rest properly, you will recover soon.', pattern: '～ば', meaning: 'conditional "if"', blankSlot: 'condition',
  },
]

/* ---------------------------------------------------------------------- */
/* Quest 09 — holidays                                                     */
/* ---------------------------------------------------------------------- */

const holidaysGrammarDrills: readonly DrillExercise[] = [
  {
    id: 'quest-festival-in-order-to-see', jlpt: 'N4', complexity: 3,
    prompt: '花火を見る___に、川へ行きます。', promptReading: 'はなびをみる___に、かわへいきます。',
    answer: 'ため', answerReading: 'ため', options: ['ため', 'よう', 'こと', 'はず'], optionReadings: ['ため', 'よう', 'こと', 'はず'],
    english: 'I go to the river in order to see the fireworks.', pattern: '～ために', meaning: 'purpose', blankSlot: 'purpose',
  },
  {
    id: 'quest-festival-borrowed-yukata', jlpt: 'N4', complexity: 3,
    prompt: '友達___浴衣を借りました。', promptReading: 'ともだち___ゆかたをかりました。',
    answer: 'に', answerReading: 'に', options: ['に', 'を', 'で', 'と'], optionReadings: ['に', 'を', 'で', 'と'],
    english: 'I borrowed a yukata from a friend.', pattern: 'に', meaning: 'marks the source person', blankSlot: 'source',
  },
  {
    id: 'quest-festival-while-eating', jlpt: 'N4', complexity: 3,
    prompt: 'たこ焼きを食べ___、歩きました。', promptReading: 'たこやきをたべ___、あるきました。',
    answer: 'ながら', answerReading: 'ながら', options: ['ながら', 'たり', 'てから', 'ように'], optionReadings: ['ながら', 'たり', 'てから', 'ように'],
    english: 'I walked while eating takoyaki.', pattern: '～ながら', meaning: 'two actions at once', blankSlot: 'simultaneous',
  },
  {
    id: 'quest-festival-bought-mask-at', jlpt: 'N4', complexity: 3,
    prompt: '夏祭り___狐の面を買いました。', promptReading: 'なつまつり___きつねのめんをかいました。',
    answer: 'で', answerReading: 'で', options: ['で', 'に', 'へ', 'から'], optionReadings: ['で', 'に', 'へ', 'から'],
    english: 'I bought a fox mask at the summer festival.', pattern: 'で', meaning: 'where an action happens', blankSlot: 'location',
  },
  {
    id: 'quest-festival-even-after-ends', jlpt: 'N4', complexity: 3,
    prompt: '祭りが終わっ___、太鼓の音が聞こえます。', promptReading: 'まつりがおわっ___、たいこのおとがきこえます。',
    answer: 'ても', answerReading: 'ても', options: ['ても', 'たら', 'てから', 'ながら'], optionReadings: ['ても', 'たら', 'てから', 'ながら'],
    english: 'Even after the festival ends, I can hear the drums.', pattern: '～ても', meaning: 'even if / even after', blankSlot: 'concession',
  },
]

/* ---------------------------------------------------------------------- */
/* Quest 10 — city                                                         */
/* ---------------------------------------------------------------------- */

const cityGrammarDrills: readonly DrillExercise[] = [
  {
    id: 'quest-apartment-i-hear-nobody', jlpt: 'N4', complexity: 4,
    prompt: '隣の部屋には誰も住んでいない___です。', promptReading: 'となりのへやにはだれもすんでいない___です。',
    answer: 'そう', answerReading: 'そう', options: ['そう', 'よう', 'はず', 'つもり'], optionReadings: ['そう', 'よう', 'はず', 'つもり'],
    english: 'I hear that nobody lives in the room next door.', pattern: '～そうです', meaning: 'reported information', blankSlot: 'hearsay',
  },
  {
    id: 'quest-apartment-seems-footsteps', jlpt: 'N4', complexity: 4,
    prompt: '夜中に足音が聞こえる___です。', promptReading: 'よなかにあしおとがきこえる___です。',
    answer: 'らしい', answerReading: 'らしい', options: ['らしい', 'そうな', 'ような', 'みたい'], optionReadings: ['らしい', 'そうな', 'ような', 'みたい'],
    english: 'Apparently footsteps can be heard in the middle of the night.', pattern: '～らしい', meaning: 'seems / apparently', blankSlot: 'inference',
  },
  {
    id: 'quest-apartment-tried-asking', jlpt: 'N4', complexity: 4,
    prompt: '管理人に聞いて___ましたが、分かりませんでした。', promptReading: 'かんりにんにきいて___ましたが、わかりませんでした。',
    answer: 'み', answerReading: 'み', options: ['み', 'おき', 'しまい', 'あり'], optionReadings: ['み', 'おき', 'しまい', 'あり'],
    english: 'I tried asking the caretaker, but I did not find out.', pattern: '～てみる', meaning: 'try doing something', blankSlot: 'attempt',
  },
  {
    id: 'quest-apartment-when-opened-door', jlpt: 'N4', complexity: 4,
    prompt: 'ドアを開ける___、部屋は空っぽでした。', promptReading: 'ドアをあける___、へやはからっぽでした。',
    answer: 'と', answerReading: 'と', options: ['と', 'ても', 'ので', 'のに'], optionReadings: ['と', 'ても', 'ので', 'のに'],
    english: 'When I opened the door, the room was empty.', pattern: '～と', meaning: 'and then / upon doing', blankSlot: 'sequence',
  },
  {
    id: 'quest-apartment-feels-like', jlpt: 'N4', complexity: 4,
    prompt: '誰かがここにいた___な気がします。', promptReading: 'だれかがここにいた___なきがします。',
    answer: 'よう', answerReading: 'よう', options: ['よう', 'そう', 'はず', 'べき'], optionReadings: ['よう', 'そう', 'はず', 'べき'],
    english: 'I get the feeling someone was here.', pattern: '～ような気がする', meaning: 'it feels as if', blankSlot: 'impression',
  },
]

/* ---------------------------------------------------------------------- */
/* Quest 11 — directions                                                   */
/* ---------------------------------------------------------------------- */

const mountainGrammarDrills: readonly DrillExercise[] = [
  {
    id: 'quest-mountain-the-more-you-climb', jlpt: 'N4', complexity: 4,
    prompt: '登れば登る___、霧が濃くなります。', promptReading: 'のぼればのぼる___、きりがこくなります。',
    answer: 'ほど', answerReading: 'ほど', options: ['ほど', 'だけ', 'まで', 'より'], optionReadings: ['ほど', 'だけ', 'まで', 'より'],
    english: 'The more you climb, the thicker the fog becomes.', pattern: '～ば～ほど', meaning: 'the more, the more', blankSlot: 'degree',
  },
  {
    id: 'quest-mountain-must-not-go', jlpt: 'N4', complexity: 4,
    prompt: 'この先へ行って___いけません。', promptReading: 'このさきへいって___いけません。',
    answer: 'は', answerReading: 'は', options: ['は', 'も', 'が', 'に'], optionReadings: ['は', 'も', 'が', 'に'],
    english: 'You must not go any further.', pattern: '～てはいけない', meaning: 'prohibition', blankSlot: 'prohibition',
  },
  {
    id: 'quest-mountain-showed-me-the-way', jlpt: 'N4', complexity: 4,
    prompt: '老婆が道を教えて___ました。', promptReading: 'ろうばがみちをおしえて___ました。',
    answer: 'くれ', answerReading: 'くれ', options: ['くれ', 'あげ', 'もらい', 'おき'], optionReadings: ['くれ', 'あげ', 'もらい', 'おき'],
    english: 'An old woman showed me the way.', pattern: '～てくれる', meaning: 'someone does something for me', blankSlot: 'benefit',
  },
  {
    id: 'quest-mountain-without-looking-back', jlpt: 'N4', complexity: 4,
    prompt: '振り返ら___に歩き続けました。', promptReading: 'ふりかえら___にあるきつづけました。',
    answer: 'ず', answerReading: 'ず', options: ['ず', 'ない', 'なく', 'ぬ'], optionReadings: ['ず', 'ない', 'なく', 'ぬ'],
    english: 'I kept walking without looking back.', pattern: '～ずに', meaning: 'without doing', blankSlot: 'manner',
  },
  {
    id: 'quest-mountain-because-lost', jlpt: 'N4', complexity: 4,
    prompt: '道に迷った___、地図を見ました。', promptReading: 'みちにまよった___、ちずをみました。',
    answer: 'ので', answerReading: 'ので', options: ['ので', 'のに', 'ほど', 'まで'], optionReadings: ['ので', 'のに', 'ほど', 'まで'],
    english: 'Because I got lost, I looked at the map.', pattern: '～ので', meaning: 'gives a reason', blankSlot: 'reason',
  },
]

/* ---------------------------------------------------------------------- */
/* Quest 12 — final                                                        */
/* ---------------------------------------------------------------------- */

const finaleGrammarDrills: readonly DrillExercise[] = [
  {
    id: 'quest-lantern-cannot-allow', jlpt: 'N3', complexity: 5,
    prompt: '全ての言葉を奪われる___にはいきません。', promptReading: 'すべてのことばをうばわれる___にはいきません。',
    answer: 'わけ', answerReading: 'わけ', options: ['わけ', 'こと', 'もの', 'はず'], optionReadings: ['わけ', 'こと', 'もの', 'はず'],
    english: 'I cannot allow all the words to be taken.', pattern: '～わけにはいかない', meaning: 'cannot possibly do', blankSlot: 'impossibility',
  },
  {
    id: 'quest-lantern-no-choice-but', jlpt: 'N3', complexity: 5,
    prompt: '恐れずに前へ進む___ありません。', promptReading: 'おそれずにまえへすすむ___ありません。',
    answer: 'しか', answerReading: 'しか', options: ['しか', 'だけ', 'ほど', 'より'], optionReadings: ['しか', 'だけ', 'ほど', 'より'],
    english: 'There is nothing to do but move forward without fear.', pattern: '～しかない', meaning: 'no choice but', blankSlot: 'limitation',
  },
  {
    id: 'quest-lantern-about-to-go-out', jlpt: 'N3', complexity: 5,
    prompt: '提灯の火が消え___ています。', promptReading: 'ちょうちんのひがきえ___ています。',
    answer: 'かけ', answerReading: 'かけ', options: ['かけ', 'きっ', 'だし', 'つづけ'], optionReadings: ['かけ', 'きっ', 'だし', 'つづけ'],
    english: 'The lantern flame is about to go out.', pattern: '～かける', meaning: 'on the verge of', blankSlot: 'aspect',
  },
  {
    id: 'quest-lantern-while-drinking-tea', jlpt: 'N3', complexity: 5,
    prompt: '主は静かに茶を飲み___、私を見ています。', promptReading: 'あるじはしずかにちゃをのみ___、わたしをみています。',
    answer: 'ながら', answerReading: 'ながら', options: ['ながら', 'つつも', 'たり', 'ように'], optionReadings: ['ながら', 'つつも', 'たり', 'ように'],
    english: 'The master watches me while quietly drinking tea.', pattern: '～ながら', meaning: 'two actions at once', blankSlot: 'simultaneous',
  },
  {
    id: 'quest-lantern-if-words-return', jlpt: 'N3', complexity: 5,
    prompt: '言葉が戻___、道も戻ります。', promptReading: 'ことばがもど___、みちももどります。',
    answer: 'れば', answerReading: 'れば', options: ['れば', 'ったら', 'っても', 'るなら'], optionReadings: ['れば', 'ったら', 'っても', 'るなら'],
    english: 'If the words return, the road returns as well.', pattern: '～ば', meaning: 'conditional "if"', blankSlot: 'condition',
  },
]

export const QUESTS: readonly QuestDefinition[] = [
  {
    id: 'first-morning', number: 1, symbol: '朝', title: 'My First Morning', subtitle: 'Settle into a new day in Japan.', level: 'N5', arcId: 'inkbound',
    vocabularySetId: 'home', vocabularyTheme: 'Home & routine', grammar: ['～ます / ～です', 'time words', 'place particles'],
    storyTitle: 'Scene one: A new routine', storyJapanese: '朝、私は家で朝ご飯を食べます。', storyEnglish: 'In the morning, I eat breakfast at home.',
    scene: [
      { japanese: '朝、私は布団から出ます。', reading: 'あさ、わたしはふとんからでます。', english: 'In the morning, I get out of my futon.' },
      { japanese: '洗面所で歯ブラシを使います。', reading: 'せんめんじょではぶらしをつかいます。', english: 'I use a toothbrush in the washroom.' },
      { japanese: '母は洗濯をしています。', reading: 'はははせんたくをしています。', english: 'My mother is doing the laundry.' },
      { japanese: '私は部屋を掃除して、ゴミ箱にごみを入れます。', reading: 'わたしはへやをそうじして、ごみばこにごみをいれます。', english: 'I clean the room and put the trash in the trash can.' },
      { japanese: '玄関に毛布があります。', reading: 'げんかんにもうふがあります。', english: 'There is a blanket in the entryway.' },
    ],
    grammarDrills: homeGrammarDrills,
    guardian: {
      name: 'Akaname', japanese: '垢嘗', title: 'The Grime Ronin', mark: '怪', health: 3,
      lore: 'A small yōkai has swallowed the words of the morning. Use those words correctly to restore the lantern seal.',
      portrait: '/guardian-grime-ronin.png', battleStyle: 'sludge',
      attacks: [
        { name: 'Grime Lick', japanese: '垢舐め', flavor: 'It drags a filthy tongue across the seal and a word blurs away.' },
        { name: 'Damp Tile Slip', japanese: '濡れ床', flavor: 'The floor turns slick and your footing — and your grammar — slides.' },
      ],
    },
    reward: { name: 'Morning Lantern', mark: '灯', perk: 'dawn-guard', perkTitle: 'Dawn Guard', perkDescription: 'Blocks the first wrong answer in every guardian battle.' },
  },
  {
    id: 'lunch-together', number: 2, symbol: '食', title: 'Lunch Together', subtitle: 'Order food and get to know someone.', level: 'N5', arcId: 'inkbound',
    vocabularySetId: 'food', vocabularyTheme: 'Food & dining', grammar: ['～が好きです', '～をください', 'food words'],
    storyTitle: 'Scene two: At the restaurant', storyJapanese: '友達と一緒に昼ご飯を食べます。', storyEnglish: 'I eat lunch together with a friend.',
    scene: [
      { japanese: '友達と一緒に昼ご飯を食べます。', reading: 'ともだちといっしょにひるごはんをたべます。', english: 'I eat lunch together with a friend.' },
      { japanese: '私はラーメンが好きです。', reading: 'わたしはラーメンがすきです。', english: 'I like ramen.' },
      { japanese: 'すみません、水をください。', reading: 'すみません、みずをください。', english: 'Excuse me, water please.' },
      { japanese: 'この店の餃子はとても美味しいです。', reading: 'このみせのぎょうざはとてもおいしいです。', english: "This shop's gyoza is very delicious." },
      { japanese: 'お会計をお願いします。', reading: 'おかいけいをおねがいします。', english: 'The check, please.' },
    ],
    grammarDrills: foodGrammarDrills,
    guardian: {
      name: 'Jikininki', japanese: '食人鬼', title: 'The Ember Chef', mark: '餓', health: 3,
      lore: 'A hungry spirit twists the language of food and hospitality. Feed it the right words or it will eat the meal, the menu, and the meaning.',
      portrait: '/guardian-ogre-chef.png', battleStyle: 'ember',
      attacks: [
        { name: 'Devouring Bowl', japanese: '喰らい椀', flavor: 'It swallows the sentence whole and leaves only steam.' },
        { name: 'Bitter Course', japanese: '苦膳', flavor: 'Every flavour turns wrong on your tongue, and so does the particle.' },
      ],
    },
    reward: { name: 'Shared Bento', mark: '弁', perk: 'second-wind', perkTitle: 'Second Wind', perkDescription: 'Restores one heart after two correct answers in a row.' },
  },
  {
    id: 'catch-the-train', number: 3, symbol: '電車', title: 'Catch the Train', subtitle: 'Find your way through the station.', level: 'N5', arcId: 'inkbound',
    vocabularySetId: 'travel', vocabularyTheme: 'Travel & transport', grammar: ['～へ行きます', '～ています', 'location particles'],
    storyTitle: 'Scene three: On the platform', storyJapanese: '駅で電車を待っています。', storyEnglish: 'I am waiting for the train at the station.',
    scene: [
      { japanese: '駅で電車を待っています。', reading: 'えきででんしゃをまっています。', english: 'I am waiting for the train at the station.' },
      { japanese: '私は東京へ行きます。', reading: 'わたしはとうきょうへいきます。', english: 'I am going to Tokyo.' },
      { japanese: '切符売り場はどこですか。', reading: 'きっぷうりばはどこですか。', english: 'Where is the ticket window?' },
      { japanese: '次の電車は三番線から出ます。', reading: 'つぎのでんしゃはさんばんせんからでます。', english: 'The next train departs from platform three.' },
      { japanese: '電車が来ましたから、乗ります。', reading: 'でんしゃがきましたから、のります。', english: 'The train has come, so I board it.' },
    ],
    grammarDrills: travelGrammarDrills,
    guardian: {
      name: 'Frostfang Byakko', japanese: '氷牙白虎', title: 'The Icebound Blade', mark: '氷', health: 4,
      lore: 'The silver tiger has frozen every rail out of the station. Name each place and destination precisely or his blade will send you back to the first platform.',
      portrait: '/guardian-frostfang.png', battleStyle: 'frost',
      attacks: [
        { name: 'Glacier Draw', japanese: '氷河抜刀', flavor: 'The curved blade clears its sheath and an icy line cuts through your destination.' },
        { name: 'White Tiger Rush', japanese: '白虎突進', flavor: 'Silver armor flashes down the platform before the next word can arrive.' },
        { name: 'Frozen Rail', japanese: '凍結線路', flavor: 'Blue frost locks every route except the wrong one.' },
      ],
    },
    reward: { name: 'Traveler’s Bell', mark: '鈴', perk: 'clear-path', perkTitle: 'Clear Path', perkDescription: 'Removes one wrong choice from the first question of each battle.' },
  },
  {
    id: 'lost-wallet', number: 4, symbol: '財布', title: 'The Lost Wallet', subtitle: 'Ask for help and solve a small problem.', level: 'N5', arcId: 'inkbound',
    vocabularySetId: 'shopping', vocabularyTheme: 'Shopping & money', grammar: ['あります / ありません', 'questions', 'past tense'],
    storyTitle: 'Scene four: Looking under the bench', storyJapanese: '財布がありません。ベンチの下を探します。', storyEnglish: 'My wallet is missing. I look under the bench.',
    scene: [
      { japanese: '財布がありません。', reading: 'さいふがありません。', english: 'My wallet is missing.' },
      { japanese: 'ベンチの下を探しました。', reading: 'ベンチのしたをさがしました。', english: 'I searched under the bench.' },
      { japanese: '昨日、店で買い物をしました。', reading: 'きのう、みせでかいものをしました。', english: 'Yesterday I went shopping at the store.' },
      { japanese: 'すみません、財布を見ませんでしたか。', reading: 'すみません、さいふをみませんでしたか。', english: 'Excuse me, did you not see a wallet?' },
      { japanese: '交番で財布が見つかりました。', reading: 'こうばんでさいふがみつかりました。', english: 'The wallet was found at the police box.' },
    ],
    grammarDrills: shoppingGrammarDrills,
    guardian: {
      name: 'Noppera-bō', japanese: 'のっぺらぼう', title: 'The Ashen Faceless', mark: '盗', health: 3,
      lore: 'A faceless stranger hides names, possessions, and the truth of what happened. Only exact past-tense speech will pin it down.',
      portrait: '/guardian-faceless-ninja.png', battleStyle: 'vanish',
      attacks: [
        { name: 'Blank Face', japanese: '無貌', flavor: 'You look up and the answer has no features left to read.' },
        { name: 'Pocket Sleight', japanese: '掏摸', flavor: 'The word you were holding is simply gone.' },
      ],
    },
    reward: { name: 'Truth Coin', mark: '真', perk: 'true-sight', perkTitle: 'True Sight', perkDescription: 'Shows the grammar meaning hint on every battle question.' },
  },
  {
    id: 'first-school-day', number: 5, symbol: '学校', title: 'First Day at School', subtitle: 'Meet your class and make a friend.', level: 'N5', arcId: 'inkbound',
    vocabularySetId: 'school', vocabularyTheme: 'School & study', grammar: ['～て', 'introductions', 'together actions'],
    storyTitle: 'Scene five: A new friend', storyJapanese: '隣の学生が話しかけます。', storyEnglish: 'The student next to me speaks to me.',
    scene: [
      { japanese: '隣の学生が話しかけます。', reading: 'となりのがくせいがはなしかけます。', english: 'The student next to me speaks to me.' },
      { japanese: '初めまして、田中です。', reading: 'はじめまして、たなかです。', english: 'Nice to meet you, I am Tanaka.' },
      { japanese: '私は毎日図書館で勉強しています。', reading: 'わたしはまいにちとしょかんでべんきょうしています。', english: 'I study at the library every day.' },
      { japanese: '教室に入って、席に座ります。', reading: 'きょうしつにはいって、せきにすわります。', english: 'I enter the classroom and sit in my seat.' },
      { japanese: '一緒に宿題をしましょう。', reading: 'いっしょにしゅくだいをしましょう。', english: "Let's do our homework together." },
    ],
    grammarDrills: schoolGrammarDrills,
    guardian: {
      name: 'Tengu', japanese: '天狗', title: 'The Crimson General', mark: '天', health: 4,
      lore: 'The mountain teacher demands precise introductions and cleanly connected actions. He has failed better students than you for less.',
      portrait: '/guardian-tengu-general.png', battleStyle: 'wind',
      attacks: [
        { name: 'Feather Gale', japanese: '羽嵐', flavor: 'One beat of his fan scatters your sentence across the classroom.' },
        { name: 'Red Ink', japanese: '朱筆', flavor: 'He circles the error before you finish making it.' },
        { name: 'Mountain Rebuke', japanese: '山喝', flavor: 'A single shouted correction and the whole room straightens.' },
      ],
    },
    reward: { name: 'Tengu Feather', mark: '羽', perk: 'perfect-edge', perkTitle: 'Perfect Edge', perkDescription: 'Three correct answers in a row deal one extra strike.' },
  },
  {
    id: 'rainy-day', number: 6, symbol: '雨', title: 'A Rainy Day', subtitle: 'Make a plan when the weather changes.', level: 'N4', arcId: 'inkbound',
    vocabularySetId: 'nature', vocabularyTheme: 'Nature & weather', grammar: ['～から', '～たら', 'reasons'],
    storyTitle: 'Scene six: Changing plans', storyJapanese: '雨が降っているから、家にいます。', storyEnglish: 'Because it is raining, I stay home.',
    scene: [
      { japanese: '雨が降っているから、家にいます。', reading: 'あめがふっているから、いえにいます。', english: 'Because it is raining, I stay home.' },
      { japanese: '空が暗くなりました。', reading: 'そらがくらくなりました。', english: 'The sky became dark.' },
      { japanese: '傘を持って行きます。', reading: 'かさをもっていきます。', english: 'I will take an umbrella with me.' },
      { japanese: '天気が良くなったら、公園へ行きます。', reading: 'てんきがよくなったら、こうえんへいきます。', english: 'If the weather improves, I will go to the park.' },
      { japanese: '風が強いですが、寒くないです。', reading: 'かぜがつよいですが、さむくないです。', english: 'The wind is strong, but it is not cold.' },
    ],
    grammarDrills: natureGrammarDrills,
    guardian: {
      name: 'Ame-onna', japanese: '雨女', title: 'The Storm Priestess', mark: '雨', health: 4,
      lore: 'The storm grows smarter as you speak, testing reasons, plans, and every condition you try to set against it.',
      portrait: '/guardian-storm-priestess.png', battleStyle: 'storm',
      attacks: [
        { name: 'Downpour', japanese: '土砂降り', flavor: 'Rain hammers the page until the reason washes off it.' },
        { name: 'Cold Front', japanese: '寒波', flavor: 'The air drops and your clause freezes half-formed.' },
        { name: 'Endless Drizzle', japanese: '長雨', flavor: 'It does not stop. It simply keeps being true.' },
      ],
    },
    reward: { name: 'Storm Charm', mark: '護', perk: 'change-fate', perkTitle: 'Change Fate', perkDescription: 'Once per battle, swap a question you do not want.' },
  },
  {
    id: 'night-shift', number: 7, symbol: '夜', title: 'The Night Shift', subtitle: 'Stay late and finish what the office left behind.', level: 'N4', arcId: 'hollow-lantern',
    vocabularySetId: 'work', vocabularyTheme: 'Work & office', grammar: ['～なければならない', '～ても', '～た時'],
    storyTitle: 'Scene seven: The last light on the floor', storyJapanese: '今夜は残業をしなければなりません。', storyEnglish: 'I have to work overtime tonight.',
    scene: [
      { japanese: '今夜は残業をしなければなりません。', reading: 'こんやはざんぎょうをしなければなりません。', english: 'I have to work overtime tonight.' },
      { japanese: '部長に会議の資料を渡しました。', reading: 'ぶちょうにかいぎのしりょうをわたしました。', english: 'I handed the meeting materials to the manager.' },
      { japanese: 'この仕事は明日までに終わらせます。', reading: 'このしごとはあしたまでにおわらせます。', english: 'I will finish this work by tomorrow.' },
      { japanese: '電話が鳴っても、誰も出ません。', reading: 'でんわがなっても、だれもでません。', english: 'Even if the phone rings, no one answers.' },
      { japanese: '会社を出た時、雨が降っていました。', reading: 'かいしゃをでたとき、あめがふっていました。', english: 'When I left the office, it was raining.' },
    ],
    grammarDrills: workGrammarDrills,
    guardian: {
      name: 'Kage Yoroi', japanese: '影鎧', title: 'The Unlit Blade', mark: '影', health: 4,
      lore: 'A suit of living shadow stands beneath the last office light. Finish the work exactly or its magenta blade will erase the sentence from the dark.',
      portrait: '/guardian-shadowblade.png', battleStyle: 'shadow',
      attacks: [
        { name: 'Midnight Sever', japanese: '真夜中斬り', flavor: 'A magenta edge crosses the room and the clause falls into darkness.' },
        { name: 'Blackout Step', japanese: '暗転歩法', flavor: 'The lights fail for one breath. The knight is already behind your answer.' },
        { name: 'Shadow Deadline', japanese: '影の締切', flavor: 'The darkness closes around the final word before you can finish it.' },
      ],
    },
    reward: { name: 'Overtime Seal', mark: '残', perk: 'iron-will', perkTitle: 'Iron Will', perkDescription: 'Start every guardian battle with one extra heart.' },
  },
  {
    id: 'hospital-visit', number: 8, symbol: '病院', title: 'The Hospital Visit', subtitle: 'Explain what hurts and listen to advice.', level: 'N4', arcId: 'hollow-lantern',
    vocabularySetId: 'health', vocabularyTheme: 'Health & body', grammar: ['～ので', '～た方がいい', '～ば'],
    storyTitle: 'Scene eight: The fever ward', storyJapanese: '熱があるので、病院へ行きます。', storyEnglish: 'Because I have a fever, I am going to the hospital.',
    scene: [
      { japanese: '熱があるので、病院へ行きます。', reading: 'ねつがあるので、びょういんへいきます。', english: 'Because I have a fever, I am going to the hospital.' },
      { japanese: '先生に喉が痛いと言いました。', reading: 'せんせいにのどがいたいといいました。', english: 'I told the doctor that my throat hurts.' },
      { japanese: '薬を飲んだ方がいいです。', reading: 'くすりをのんだほうがいいです。', english: 'You had better take the medicine.' },
      { japanese: '無理をすると、もっと悪くなります。', reading: 'むりをすると、もっとわるくなります。', english: 'If you overdo it, it will get worse.' },
      { japanese: 'ゆっくり休めば、すぐ治ります。', reading: 'ゆっくりやすめば、すぐなおります。', english: 'If you rest properly, you will recover soon.' },
    ],
    grammarDrills: healthGrammarDrills,
    guardian: {
      name: 'Gashadokuro', japanese: 'がしゃどくろ', title: 'The Ivory Shogun', mark: '骨', health: 5,
      lore: 'Assembled from everyone who never said where it hurt. It looms over the ward and dares you to explain yourself clearly.',
      portrait: '/guardian-bone-shogun.png', battleStyle: 'bone',
      attacks: [
        { name: 'Bone Rain', japanese: '骨雨', flavor: 'The ceiling comes apart into a thousand small white sounds.' },
        { name: 'Gnashing Toll', japanese: '歯噛み', flavor: 'A grinding note that shakes the reason out of your clause.' },
        { name: 'Marrow Cold', japanese: '髄寒', flavor: 'The cold reaches the middle of you and the advice slips away.' },
      ],
      phases: [
        { name: 'Gashadokuro', mark: '骨', taunt: 'It rises past the third floor and keeps rising.' },
        { name: 'Gashadokuro · Splintered', mark: '砕', taunt: 'Cracks run through the skull. It does not slow down.' },
      ],
    },
    reward: { name: 'Bone Charm', mark: '薬', perk: 'twin-strike', perkTitle: 'Twin Strike', perkDescription: 'Every third correct answer lands a double strike.' },
  },
  {
    id: 'festival-mask', number: 9, symbol: '祭', title: 'The Festival Mask', subtitle: 'Follow the drums to the river and buy a face.', level: 'N4', arcId: 'hollow-lantern',
    vocabularySetId: 'holidays', vocabularyTheme: 'Holidays & celebrations', grammar: ['～ために', '～ながら', '～ても'],
    storyTitle: 'Scene nine: Under the fireworks', storyJapanese: '夏祭りで狐の面を買いました。', storyEnglish: 'I bought a fox mask at the summer festival.',
    scene: [
      { japanese: '夏祭りで狐の面を買いました。', reading: 'なつまつりできつねのめんをかいました。', english: 'I bought a fox mask at the summer festival.' },
      { japanese: '花火を見るために、川へ行きます。', reading: 'はなびをみるために、かわへいきます。', english: 'I go to the river in order to see the fireworks.' },
      { japanese: '友達に浴衣を借りました。', reading: 'ともだちにゆかたをかりました。', english: 'I borrowed a yukata from a friend.' },
      { japanese: '屋台でたこ焼きを食べながら、歩きました。', reading: 'やたいでたこやきをたべながら、あるきました。', english: 'I walked while eating takoyaki from a stall.' },
      { japanese: '祭りが終わっても、太鼓の音が聞こえます。', reading: 'まつりがおわっても、たいこのおとがきこえます。', english: 'Even after the festival ends, I can hear the drums.' },
    ],
    grammarDrills: holidaysGrammarDrills,
    guardian: {
      name: 'Kyūbi no Kitsune', japanese: '九尾の狐', title: 'The Foxfire Duelist', mark: '狐', health: 5,
      lore: 'You bought her face at a stall for four hundred yen. She would like it back, and she will play for it.',
      portrait: '/guardian-kitsune-duelist.png', battleStyle: 'foxfire',
      attacks: [
        { name: 'Foxfire', japanese: '狐火', flavor: 'Blue flames drift up from the riverbank and rearrange the sentence.' },
        { name: 'Nine Tails', japanese: '九尾', flavor: 'Nine answers appear. Eight of them are hers.' },
        { name: 'Borrowed Face', japanese: '面借り', flavor: 'She is wearing your handwriting now.' },
      ],
      phases: [
        { name: 'Kitsune · Masked', mark: '狐', taunt: 'She bows politely. The mask does not move when she speaks.' },
        { name: 'Kitsune · Unmasked', mark: '妖', taunt: 'The mask falls. There was never a face under it.' },
      ],
    },
    reward: { name: 'Fox Mask', mark: '面', perk: 'kitsune-luck', perkTitle: 'Fox Luck', perkDescription: 'A wrong answer sometimes costs nothing at all.' },
  },
  {
    id: 'empty-apartment', number: 10, symbol: '空室', title: 'The Empty Apartment', subtitle: 'Ask the neighbours what they have been hearing.', level: 'N4', arcId: 'hollow-lantern',
    vocabularySetId: 'city', vocabularyTheme: 'City & community', grammar: ['～そうです', '～らしい', '～てみる'],
    storyTitle: 'Scene ten: Room 402', storyJapanese: '隣の部屋には誰も住んでいないそうです。', storyEnglish: 'I hear that nobody lives in the room next door.',
    scene: [
      { japanese: '隣の部屋には誰も住んでいないそうです。', reading: 'となりのへやにはだれもすんでいないそうです。', english: 'I hear that nobody lives in the room next door.' },
      { japanese: '夜中に足音が聞こえるらしいです。', reading: 'よなかにあしおとがきこえるらしいです。', english: 'Apparently footsteps can be heard in the middle of the night.' },
      { japanese: '管理人に聞いてみましたが、分かりませんでした。', reading: 'かんりにんにきいてみましたが、わかりませんでした。', english: 'I tried asking the caretaker, but I did not find out.' },
      { japanese: 'ドアを開けると、部屋は空っぽでした。', reading: 'ドアをあけると、へやはからっぽでした。', english: 'When I opened the door, the room was empty.' },
      { japanese: '誰かがここにいたような気がします。', reading: 'だれかがここにいたようなきがします。', english: 'I get the feeling someone was here.' },
    ],
    grammarDrills: cityGrammarDrills,
    guardian: {
      name: 'Yūrei', japanese: '幽霊', title: 'The Spectral Courtier', mark: '霊', health: 5,
      lore: 'It has been repeating the same sentence in room 402 for eleven years. Say it back correctly and it can finally stop.',
      portrait: '/guardian-spectral-warrior.png', battleStyle: 'spirit',
      attacks: [
        { name: 'Cold Whisper', japanese: '冷語', flavor: 'The words arrive from behind you, in your own voice.' },
        { name: 'Repeating Hallway', japanese: '繰廊', flavor: 'You walk the same corridor and answer the same question again.' },
        { name: 'Unfinished Sentence', japanese: '未完文', flavor: 'It stops halfway through. It has always stopped halfway through.' },
      ],
      phases: [
        { name: 'Yūrei · Faint', mark: '霊', taunt: 'A shape at the end of the hall, barely there.' },
        { name: 'Yūrei · Remembering', mark: '憶', taunt: 'It turns toward you. It is starting to recall the rest.' },
      ],
    },
    reward: { name: 'Echo Ward', mark: '響', perk: 'ward-echo', perkTitle: 'Echo Ward', perkDescription: 'The first missed question comes back for a second attempt.' },
  },
  {
    id: 'mountain-path', number: 11, symbol: '山', title: 'The Mountain Path', subtitle: 'Climb into the fog and do not look back.', level: 'N4', arcId: 'hollow-lantern',
    vocabularySetId: 'directions', vocabularyTheme: 'Directions & locations', grammar: ['～ば～ほど', '～てはいけない', '～ずに'],
    storyTitle: 'Scene eleven: Above the fog line', storyJapanese: '山道を登れば登るほど、霧が濃くなります。', storyEnglish: 'The more I climb the mountain path, the thicker the fog becomes.',
    scene: [
      { japanese: '山道を登れば登るほど、霧が濃くなります。', reading: 'やまみちをのぼればのぼるほど、きりがこくなります。', english: 'The more I climb the mountain path, the thicker the fog becomes.' },
      { japanese: '道に迷ったので、地図を見ました。', reading: 'みちにまよったので、ちずをみました。', english: 'Because I got lost, I looked at the map.' },
      { japanese: 'この先へ行ってはいけません。', reading: 'このさきへいってはいけません。', english: 'You must not go any further.' },
      { japanese: '老婆が現れて、道を教えてくれました。', reading: 'ろうばがあらわれて、みちをおしえてくれました。', english: 'An old woman appeared and showed me the way.' },
      { japanese: '振り返らずに歩き続けました。', reading: 'ふりかえらずにあるきつづけました。', english: 'I kept walking without looking back.' },
    ],
    grammarDrills: mountainGrammarDrills,
    guardian: {
      name: 'Yamauba', japanese: '山姥', title: 'The Stone Mountain Hag', mark: '姥', health: 5,
      lore: 'She gave you directions and a warm meal. She would like you to stay on this mountain permanently, and she is very good at asking.',
      portrait: '/guardian-mountain-hag.png', battleStyle: 'earth',
      attacks: [
        { name: 'Kind Offer', japanese: '親切', flavor: 'Stay the night, she says, and the path behind you closes a little.' },
        { name: 'Fog Bind', japanese: '霧縛', flavor: 'The white closes in until only the wrong road is visible.' },
        { name: 'Second Mouth', japanese: '二口', flavor: 'Something under her hair finishes the sentence for you.' },
      ],
      phases: [
        { name: 'Yamauba · Hospitable', mark: '姥', taunt: 'She smiles and pours the tea. The path is still behind you.' },
        { name: 'Yamauba · True Form', mark: '鬼', taunt: 'The kindness drops away like a shawl.' },
      ],
    },
    reward: { name: 'Stone Stance', mark: '岩', perk: 'mountain-stance', perkTitle: 'Mountain Stance', perkDescription: 'Guardian counters below full strength cannot take your last heart.' },
  },
  {
    id: 'hollow-lantern', number: 12, symbol: '灯', title: 'The Hollow Lantern', subtitle: 'Face the one who has been collecting the words.', level: 'N3', arcId: 'hollow-lantern',
    vocabularySetId: 'communication', vocabularyTheme: 'Communication & conversation', grammar: ['～わけにはいかない', '～しかない', '～かける'],
    storyTitle: 'Scene twelve: The last light', storyJapanese: '提灯の火が消えかけています。', storyEnglish: 'The lantern flame is about to go out.',
    scene: [
      { japanese: '提灯の火が消えかけています。', reading: 'ちょうちんのひがきえかけています。', english: 'The lantern flame is about to go out.' },
      { japanese: '全ての言葉を奪われるわけにはいきません。', reading: 'すべてのことばをうばわれるわけにはいきません。', english: 'I cannot allow all the words to be taken.' },
      { japanese: '主は静かに茶を飲みながら、私を見ています。', reading: 'あるじはしずかにちゃをのみながら、わたしをみています。', english: 'The master watches me while quietly drinking tea.' },
      { japanese: '恐れずに前へ進むしかありません。', reading: 'おそれずにまえへすすむしかありません。', english: 'There is nothing to do but move forward without fear.' },
      { japanese: '言葉が戻れば、道も戻ります。', reading: 'ことばがもどれば、みちももどります。', english: 'If the words return, the road returns as well.' },
    ],
    grammarDrills: finaleGrammarDrills,
    guardian: {
      name: 'Koganemaru', japanese: '黄金丸', title: 'The Horned Regent', mark: '王', health: 6,
      lore: 'The gold oni forged the stolen words into his armor. Break the magenta core at his chest and the Hollow Lantern will release every voice it holds.',
      portrait: '/guardian-gold-oni.png', battleStyle: 'oni',
      attacks: [
        { name: 'Regent Hammer', japanese: '王槌', flavor: 'A plated fist strikes the road and the whole sentence jumps from its place.' },
        { name: 'Dragon Shoulder', japanese: '双竜衝', flavor: 'The beasts on his armor roar and crash through both sides of the clause.' },
        { name: 'Magenta Core', japanese: '紅玉核', flavor: 'The chest gem burns bright enough to pull the meaning out of every word.' },
        { name: 'Golden Ruin', japanese: '黄金崩し', flavor: 'All that armored weight comes down at once. Even the lantern flame bends.' },
      ],
      phases: [
        { name: 'Koganemaru · Sealed', mark: '封', taunt: 'The horned armor wakes, one gold plate at a time.' },
        { name: 'Koganemaru · Unbound', mark: '解', taunt: 'The magenta core opens and the mountain answers.' },
        { name: 'Koganemaru · Regent', mark: '王', taunt: 'He raises one fist. Every stolen word falls silent.' },
      ],
    },
    reward: { name: 'Rekindled Lantern', mark: '燈', perk: 'lantern-flame', perkTitle: 'Rekindled Flame', perkDescription: 'Every relic you carry grows stronger. The road is yours.' },
  },
]

export function getQuestById(id: string | null | undefined) {
  return QUESTS.find((quest) => quest.id === id)
}

export function getArcById(id: string | null | undefined) {
  return CAMPAIGN_ARCS.find((arc) => arc.id === id)
}

export function questsForArc(arcId: string) {
  return QUESTS.filter((quest) => quest.arcId === arcId)
}

/** Quests are walked in order — each one unlocks the next. */
export function isQuestUnlocked(quest: QuestDefinition, isComplete: (questId: string) => boolean) {
  if (quest.number === 1) return true
  const previous = QUESTS.find((item) => item.number === quest.number - 1)
  return previous ? isComplete(previous.id) : false
}
