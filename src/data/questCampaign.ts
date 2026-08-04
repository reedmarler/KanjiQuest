import type { DrillExercise } from '../lib/drillExercises'

export type QuestDefinition = {
  id: string
  number: number
  title: string
  subtitle: string
  level: 'N5' | 'N4'
  vocabularySetId: string
  vocabularyTheme: string
  grammar: readonly string[]
  storyTitle: string
  storyJapanese: string
  storyEnglish: string
  scene: readonly { japanese: string; english: string }[]
  grammarDrills: readonly DrillExercise[]
}

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

export const QUESTS: readonly QuestDefinition[] = [
  {
    id: 'first-morning', number: 1, title: 'My First Morning', subtitle: 'Settle into a new day in Japan.', level: 'N5',
    vocabularySetId: 'home', vocabularyTheme: 'Home & routine', grammar: ['～ます / ～です', 'time words', 'place particles'],
    storyTitle: 'Scene one: A new routine', storyJapanese: '朝、私は家で朝ご飯を食べます。', storyEnglish: 'In the morning, I eat breakfast at home.',
    scene: [
      { japanese: '朝、私は布団から出ます。', english: 'In the morning, I get out of my futon.' },
      { japanese: '洗面所で歯ブラシを使います。', english: 'I use a toothbrush in the washroom.' },
      { japanese: '母は洗濯をしています。', english: 'My mother is doing the laundry.' },
      { japanese: '私は部屋を掃除して、ゴミ箱にごみを入れます。', english: 'I clean the room and put the trash in the trash can.' },
      { japanese: '玄関に毛布があります。', english: 'There is a blanket in the entryway.' },
    ],
    grammarDrills: homeGrammarDrills,
  },
  {
    id: 'lunch-together', number: 2, title: 'Lunch Together', subtitle: 'Order food and get to know someone.', level: 'N5',
    vocabularySetId: 'food', vocabularyTheme: 'Food & dining', grammar: ['～が好きです', '～をください', 'food words'],
    storyTitle: 'Scene two: At the restaurant', storyJapanese: '友達と一緒に昼ご飯を食べます。', storyEnglish: 'I eat lunch together with a friend.', scene: [], grammarDrills: [],
  },
  {
    id: 'catch-the-train', number: 3, title: 'Catch the Train', subtitle: 'Find your way through the station.', level: 'N5',
    vocabularySetId: 'travel', vocabularyTheme: 'Travel & transport', grammar: ['～へ行きます', '～ています', 'location particles'],
    storyTitle: 'Scene three: On the platform', storyJapanese: '駅で電車を待っています。', storyEnglish: 'I am waiting for the train at the station.', scene: [], grammarDrills: [],
  },
  {
    id: 'lost-wallet', number: 4, title: 'The Lost Wallet', subtitle: 'Ask for help and solve a small problem.', level: 'N5',
    vocabularySetId: 'shopping', vocabularyTheme: 'Shopping & money', grammar: ['あります / ありません', 'questions', 'past tense'],
    storyTitle: 'Scene four: Looking under the bench', storyJapanese: '財布がありません。ベンチの下を探します。', storyEnglish: 'My wallet is missing. I look under the bench.', scene: [], grammarDrills: [],
  },
  {
    id: 'first-school-day', number: 5, title: 'First Day at School', subtitle: 'Meet your class and make a friend.', level: 'N5',
    vocabularySetId: 'school', vocabularyTheme: 'School & study', grammar: ['～て', 'introductions', 'together actions'],
    storyTitle: 'Scene five: A new friend', storyJapanese: '隣の学生が話しかけます。', storyEnglish: 'The student next to me speaks to me.', scene: [], grammarDrills: [],
  },
  {
    id: 'rainy-day', number: 6, title: 'A Rainy Day', subtitle: 'Make a plan when the weather changes.', level: 'N4',
    vocabularySetId: 'nature', vocabularyTheme: 'Nature & weather', grammar: ['～から', 'plans', 'reasons'],
    storyTitle: 'Scene six: Changing plans', storyJapanese: '雨が降っているから、家にいます。', storyEnglish: 'Because it is raining, I stay home.', scene: [], grammarDrills: [],
  },
]

export function getQuestById(id: string | null | undefined) {
  return QUESTS.find((quest) => quest.id === id)
}
