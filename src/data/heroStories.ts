import type { HeroSentenceFrame, HeroStep } from './heroSentences'

export interface HeroStoryBeat {
  japanese: string
  reading: string
  english: string
}

export interface HeroStory {
  id: string
  title: string
  shortTitle: string
  beats: HeroStoryBeat[]
}

export const HERO_STORIES: HeroStory[] = [
  {
    id: 'lost-wallet',
    title: 'The Lost Wallet',
    shortTitle: 'Lost Wallet',
    beats: [
      { japanese: '私は駅へ行きます。', reading: 'わたしはえきへいきます。', english: 'I go to the station.' },
      { japanese: '電車を待っています。', reading: 'でんしゃをまっています。', english: 'I am waiting for the train.' },
      { japanese: 'ポケットを見ます。', reading: 'ポケットをみます。', english: 'I look in my pocket.' },
      { japanese: '財布がありません。', reading: 'さいふがありません。', english: "My wallet isn't there." },
      { japanese: 'ベンチの下を探します。', reading: 'ベンチのしたをさがします。', english: 'I look under the bench.' },
      { japanese: '女の人が財布を持っています。', reading: 'おんなのひとがさいふをもっています。', english: 'A woman has the wallet.' },
      { japanese: '「これですか」と聞きます。', reading: '「これですか」とききます。', english: '"Is this yours?" she asks.' },
      { japanese: '「ありがとうございます」と言います。', reading: '「ありがとうございます」といいます。', english: 'I say, "Thank you."' },
      { japanese: '電車に乗ります。', reading: 'でんしゃにのります。', english: 'I get on the train.' },
      { japanese: '少し安心します。', reading: 'すこしあんしんします。', english: 'I feel relieved.' },
    ],
  },
  {
    id: 'first-school-day',
    title: 'First Day at School',
    shortTitle: 'School Day',
    beats: [
      { japanese: '今日から新しい学校です。', reading: 'きょうからあたらしいがっこうです。', english: 'Today is my first day at a new school.' },
      { japanese: '少し緊張しています。', reading: 'すこしきんちょうしています。', english: "I'm a little nervous." },
      { japanese: '教室へ入ります。', reading: 'きょうしつへはいります。', english: 'I enter the classroom.' },
      { japanese: '先生が私を紹介します。', reading: 'せんせいがわたしをしょうかいします。', english: 'The teacher introduces me.' },
      { japanese: 'クラスのみんなが笑います。', reading: 'クラスのみんながわらいます。', english: 'Everyone in the class smiles.' },
      { japanese: '隣の学生が話しかけます。', reading: 'となりのがくせいがはなしかけます。', english: 'The student next to me talks to me.' },
      { japanese: '一緒に昼ご飯を食べます。', reading: 'いっしょにひるごはんをたべます。', english: 'We eat lunch together.' },
      { japanese: '放課後に図書館へ行きます。', reading: 'ほうかごにとしょかんへいきます。', english: 'After school we go to the library.' },
      { japanese: '新しい友達ができました。', reading: 'あたらしいともだちができました。', english: 'I made a new friend.' },
      { japanese: '明日も学校へ行きたいです。', reading: 'あしたもがっこうへいきたいです。', english: 'I want to go to school again tomorrow.' },
    ],
  },
]

export type HeroStoryId = typeof HERO_STORIES[number]['id']

export function getHeroStory(id: string): HeroStory {
  return HERO_STORIES.find((story) => story.id === id) ?? HERO_STORIES[0]!
}

function storyFrame(story: HeroStory, beat: HeroStoryBeat, index: number): HeroSentenceFrame {
  return {
    generatedEnglish: beat.english,
    generatedPatternId: `story-${story.id}-${index}`,
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

export function buildHeroStorySteps(storyId: string): HeroStep[] {
  const story = getHeroStory(storyId)
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
