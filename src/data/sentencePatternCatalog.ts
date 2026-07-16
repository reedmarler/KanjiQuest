import type { JlptLevel } from '../lib/types'

export interface SentencePatternRecord {
  id: string
  jlpt: JlptLevel
  structure: string
  slots: string[]
  example: string
  meaning: string
  verbForm: string
  generatorReady: boolean
  note?: string
}

const rows: Array<[JlptLevel, string, string[], string, string, string, boolean?, string?]> = [
  ['N5','Subject は Object を Verb',['Subject','は','Object','を','Verb'],'私は本を読む','direct transitive action','dictionary',true],
  ['N5','Subject は Destination に Verb',['Subject','は','Destination','に','Verb'],'私は学校に行く','movement to a destination','dictionary',true],
  ['N5','Subject は Location で Object を Verb',['Subject','は','Location','で','Object','を','Verb'],'私は家でご飯を食べる','action performed at a location','dictionary',true],
  ['N5','Subject は Companion と Verb',['Subject','は','Companion','と','Verb'],'私は友達と話す','action with a companion','dictionary',true],
  ['N5','Subject は Time に Verb',['Subject','は','Time','に','Verb'],'私は七時に起きる','event at a specific time','dictionary',true],
  ['N5','Subject は Object が 好き',['Subject','は','Object','が','好き'],'私は音楽が好き','likes or preference','predicate',true],
  ['N5','Subject は Adjective',['Subject','は','Adjective'],'今日は暑い','adjective predicate','adjective',true],
  ['N5','Subject は Noun です',['Subject','は','Noun','です'],'私は学生です','noun identification','copula',true],
  ['N5','Subject は Object を Adverb Verb',['Subject','は','Object','を','Adverb','Verb'],'私は本をゆっくり読む','adverb-modified action','dictionary',true],
  ['N5','Subject は Destination へ Verb',['Subject','は','Destination','へ','Verb'],'私は駅へ行く','movement toward a destination','dictionary',true],

  ['N4','Subject は Object を Verbたい',['Subject','は','Object','を','Verbたい'],'本を読みたい','desire to do','masu-stem + たい'],
  ['N4','Subject は Object を Verbている',['Subject','は','Object','を','Verbている'],'本を読んでいる','ongoing or resulting state','te-form + いる'],
  ['N4','Subject は Object を Verbた',['Subject','は','Object','を','Verbた'],'本を読んだ','plain past action','ta-form'],
  ['N4','Subject は Object を Verbない',['Subject','は','Object','を','Verbない'],'本を読まない','plain negative action','nai-form'],
  ['N4','Subject は Verbなければならない',['Subject','は','Verbなければならない'],'勉強しなければならない','must do','negative conditional'],
  ['N4','Subject は Verbてもいい',['Subject','は','Verbてもいい'],'食べてもいい','permission to do','te-form'],
  ['N4','Subject は Verbてはいけない',['Subject','は','Verbてはいけない'],'入ってはいけない','prohibition','te-form'],
  ['N4','Subject は Destination へ Verbたことがある',['Subject','は','Destination','へ','Verbたことがある'],'日本へ行ったことがある','past experience','ta-form',false,'Destination is optional; other verbs may take an object instead.'],
  ['N4','Subject は Object を Verbながら MainVerb',['Subject','は','Object','を','Verbながら','MainVerb'],'音楽を聞きながら勉強する','two simultaneous actions','masu-stem + ながら'],
  ['N4','Subject は Verb始める',['Subject','は','Verb始める'],'勉強し始める','begin to do','masu-stem + 始める'],

  ['N3','Subject は Verbようにする',['Subject','は','Verbようにする'],'毎日勉強するようにする','make an effort or habit','plain form + ようにする'],
  ['N3','Subject は Verbことにする',['Subject','は','Verbことにする'],'日本へ行くことにする','decide to do','plain form + ことにする'],
  ['N3','Subject は Verbようになる',['Subject','は','Verbようになる'],'漢字が読めるようになる','change in ability or habit','plain/potential + ようになる'],
  ['N3','Subject は Object を Verbてしまう',['Subject','は','Object','を','Verbてしまう'],'宿題を忘れてしまう','completion or regret','te-form + しまう'],
  ['N3','Subject は Verbておく',['Subject','は','Verbておく'],'予約しておく','do in preparation','te-form + おく'],
  ['N3','Condition-ば Result',['Conditionば','Result'],'雨が降れば行かない','conditional if','ba-form'],
  ['N3','Condition-たら Result',['Conditionたら','Result'],'時間があったら行く','conditional when/if','tara-form'],
  ['N3','Clause のに Contrasting result',['Clause','のに','Contrasting result'],'勉強したのに忘れた','although or despite','plain form + のに'],
  ['N3','Reason clause ので Result',['Reason clause','ので','Result'],'雨なので家にいる','because or since','plain/na/noun + ので'],
  ['N3','Purpose clause ために Main clause',['Purpose clause','ために','Main clause'],'日本へ行くために勉強する','in order to','dictionary form + ために'],

  ['N2','Clause わけではない',['Clause','わけではない'],'嫌いなわけではない','it does not mean that','plain form + わけではない'],
  ['N2','Clause わけにはいかない',['Clause','わけにはいかない'],'行くわけにはいかない','cannot reasonably or socially do','dictionary form + わけにはいかない'],
  ['N2','Clause ことになる',['Clause','ことになる'],'転勤することになった','it has been decided that','dictionary form + ことになる'],
  ['N2','Verb ことはない',['Verb','ことはない'],'心配することはない','there is no need to','dictionary form + ことはない'],
  ['N2','Clause に違いない',['Clause','に違いない'],'彼が犯人に違いない','must certainly be','plain/noun + に違いない',false,'Normalized from 本当に違いない so the template has a complete proposition.'],
  ['N2','Clause はずだ',['Clause','はずだ'],'彼は来るはずだ','expected or supposed to','plain form + はずだ'],
  ['N2','Clause ものだ',['Clause','ものだ'],'人生は難しいものだ','general truth or recollection','plain form + ものだ'],
  ['N2','Noun のような Noun',['Noun','のような','Noun'],'鳥のような声','noun resembling another noun','noun + のような'],
  ['N2','Verbない ように MainVerb',['Verbない','ように','MainVerb'],'忘れないように書く','do so that something occurs/does not occur','plain form + ように'],
  ['N2','Subject は Verbところだ',['Subject','は','Verbところだ'],'今帰るところだ','about to, in the middle of, or just did','dictionary/ている/た + ところだ'],

  ['N1','Subject は Verbざるを得ない',['Subject','は','Verbざるを得ない'],'行かざるを得ない','cannot avoid doing','nai-stem + ざるを得ない'],
  ['N1','Noun にほかならない',['Noun','にほかならない'],'成功は努力の結果にほかならない','nothing other than','noun + にほかならない',false,'Normalized to a complete noun assertion.'],
  ['N1','Clause ものの Result',['Clause','ものの','Result'],'勉強したものの忘れた','although','plain form + ものの'],
  ['N1','Clause かねない',['Clause','かねない'],'事故になりかねない','might result in something negative','masu-stem + かねない'],
  ['N1','Verbないことには Result',['Verbないことには','Result'],'食べないことには始まらない','unless something is done','nai-form + ことには'],
  ['N1','Noun に至るまで',['Noun','に至るまで'],'子供に至るまで知っている','extending even to','noun + に至るまで'],
  ['N1','Noun ならでは の Noun',['Noun','ならではの','Noun'],'日本ならではの文化','unique or characteristic of','noun + ならでは'],
  ['N1','Noun に即して Verb',['Noun','に即して','Verb'],'現実に即して考える','in accordance with','noun + に即して'],
  ['N1','Topic をめぐって Verb',['Topic','をめぐって','Verb'],'問題をめぐって議論する','concerning or surrounding a topic','noun + をめぐって'],
  ['N1','Event に際して Main clause',['Event','に際して','Main clause'],'出発に際して挨拶する','on the occasion of','noun/dictionary + に際して'],
]

export const sentencePatternCatalog: SentencePatternRecord[] = rows.map((row, index) => ({
  id: `${row[0].toLowerCase()}-${String((index % 10) + 1).padStart(2, '0')}`,
  jlpt: row[0], structure: row[1], slots: row[2], example: row[3], meaning: row[4], verbForm: row[5], generatorReady: row[6] ?? false, note: row[7],
}))

const ACTIVE_KEY = 'kanji-quest-active-sentence-patterns-v1'

export function loadActiveSentencePatternIds() {
  const defaults = sentencePatternCatalog.filter(pattern => pattern.generatorReady).map(pattern => pattern.id)
  if (typeof window === 'undefined') return defaults
  try { const saved = window.localStorage.getItem(ACTIVE_KEY); return saved ? (JSON.parse(saved) as string[]).filter(id => sentencePatternCatalog.some(pattern => pattern.id === id && pattern.generatorReady)) : defaults } catch { return defaults }
}

export function saveActiveSentencePatternIds(ids: string[]) {
  if (typeof window !== 'undefined') window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(ids))
}
