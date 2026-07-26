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
  ['N5','Place に AnimateSubject が いる',['Place','に','AnimateSubject','が','いる'],'公園に子供がいる','existence of a person or animal','いる',true],
  ['N5','Place に InanimateObject が ある',['Place','に','InanimateObject','が','ある'],'教室に机がある','existence of an inanimate object','ある',true],
  ['N5','Time に Subject が Verb',['Time','に','Subject','が','Verb'],'八時に父が来る','event occurring at a specific time','dictionary',true,'Initially constrained to 来る and times that naturally accept に.'],
  ['N5','Object は Place に ある',['Object','は','Place','に','ある'],'本は教室にある','location of an inanimate object','ある',true],
  ['N5','Subject は Origin から 来る',['Subject','は','Origin','から','来る'],'私は大阪から来る','geographical origin','dictionary',true],
  ['N5','Subject は Endpoint まで MovementVerb',['Subject','は','Endpoint','まで','MovementVerb'],'私は駅まで歩く','endpoint of movement','dictionary',true],
  ['N5','Object が Adjective',['Object','が','Adjective'],'この本が面白い','adjective description with が focus','adjective predicate',true],
  ['N5','Subject は Recipient に Verb',['Subject','は','Recipient','に','Verb'],'私は友達に電話する','action directed toward a recipient','dictionary',true,'Normalized from Subject は Object に Verb because this slot is a recipient.'],
  ['N5','Subject は Recipient に Object を Verb',['Subject','は','Recipient','に','Object','を','Verb'],'私は先生に本を見せる','showing or transfer to a recipient','dictionary',true,'Normalized to match the supplied Japanese example.'],
  ['N5','Subject は Destination へ PortableObject を 持って行く',['Subject','は','Destination','へ','PortableObject','を','持って行く'],'私は学校へ弁当を持って行く','carrying something to a destination','dictionary',true],
  ['N5','Subject は PossessableObject が ほしい',['Subject','は','PossessableObject','が','ほしい'],'私は新しい本がほしい','wanting a possessable noun','predicate',true],
  ['N5','Subject は Origin から Destination まで MovementVerb',['Subject','は','Origin','から','Destination','まで','MovementVerb'],'私は家から学校まで歩く','movement between two places','dictionary',true],
  ['N5','Subject も Verb',['Subject','も','Verb'],'私も行く','adding another subject','dictionary',true,'Requires an implied or explicit prior discourse context.'],
  ['N5','Subject は Object しか Verbない',['Subject','は','Object','しか','Verbない'],'私は水しか飲みません','nothing but / only','negative polite + しか',true],
  ['N5','Subject は Location で Verb',['Subject','は','Location','で','Verb'],'私は会社で働く','action happening at a location, no object','dictionary',true],
  ['N5','Subject は Location に Verb',['Subject','は','Location','に','Verb'],'私は東京に住む','residing or staying at a location','dictionary',true],
  ['N5','Location に Subject が いる/ある',['Location','に','Subject','が','Verb'],'公園に子供がいる','existence of a person, animal, or thing at a location','いる/ある',true],

  ['N4','Subject は Object を Verbたい',['Subject','は','Object','を','Verbたい'],'本を読みたい','desire to do','masu-stem + たい',true],
  ['N4','Subject は Object を Verbている',['Subject','は','Object','を','Verbている'],'本を読んでいる','ongoing or resulting state','te-form + いる',true],
  ['N4','Subject は Object を Verbた',['Subject','は','Object','を','Verbた'],'本を読んだ','plain past action','ta-form',true],
  ['N4','Subject は Object を Verbない',['Subject','は','Object','を','Verbない'],'本を読まない','plain negative action','nai-form',true],
  ['N4','Subject は Verbなければならない',['Subject','は','Verbなければならない'],'勉強しなければならない','must do','negative conditional',true],
  ['N4','Subject は Verbてもいい',['Subject','は','Verbてもいい'],'食べてもいい','permission to do','te-form',true],
  ['N4','Subject は Verbてはいけない',['Subject','は','Verbてはいけない'],'入ってはいけない','prohibition','te-form',true],
  ['N4','Subject は Destination へ Verbたことがある',['Subject','は','Destination','へ','Verbたことがある'],'日本へ行ったことがある','past experience','ta-form',true,'Destination is optional; other verbs may take an object instead.'],
  ['N4','Subject は Object を Verbながら MainVerb',['Subject','は','Object','を','Verbながら','MainVerb'],'音楽を聞きながら勉強する','two simultaneous actions','masu-stem + ながら',true],
  ['N4','Subject は Verb始める',['Subject','は','Verb始める'],'勉強し始める','begin to do','masu-stem + 始める',true],
  ['N4','Place で Subject が Verbている',['Place','で','Subject','が','Verbている'],'図書館で学生が勉強している','ongoing action at a compatible location','te-form + いる',true],
  ['N4','Time (に) Subject が Verbた',['Time','(に)','Subject','が','Verbた'],'昨日先生が来た','completed event at a time','ta-form',true,'The generator omits に for relative times such as 昨日.'],
  ['N4','Object を Verbてから MainVerb',['Object','を','Verbてから','MainVerb'],'朝ご飯を食べてから学校へ行く','sequence of actions','te-form + から',true],
  ['N4','Destination へ PurposeVerbに行く',['Destination','へ','PurposeVerbに','行く'],'公園へ遊びに行く','movement with a purpose','masu-stem + に行く',true],
  ['N4','Subject が Object を Verbてくれる',['Subject','が','Object','を','Verbてくれる'],'先生が本を貸してくれる','someone acts for the speaker','te-form + くれる',true],
  ['N4','Helper に Object を Verbてもらう',['Helper','に','Object','を','Verbてもらう'],'先生に日本語を教えてもらう','receive someone’s helpful action','te-form + もらう',true],
  ['N4','Subject は Recipient に Object を Verbてあげる',['Subject','は','Recipient','に','Object','を','Verbてあげる'],'私は友達に本を貸してあげる','act for a recipient','te-form + あげる',true,'Recipient was made explicit to match the supplied example.'],
  ['N4','CauseClause から ResultClause',['CauseClause','から','ResultClause'],'雨が降っているから家にいる','reason and logical result','plain form + から',true],
  ['N4','Property1 し Property2',['Property1','し','Property2'],'安いし便利だ','multiple properties or reasons','plain form + し',true],
  ['N4','Subject は Object が PotentialVerb',['Subject','は','Object','が','PotentialVerb'],'私は漢字が読める','ability','potential form',true,'Uses 読める, not the incorrect 読められる.'],
  ['N4','Subject は FirstVerb dictionary 前に MainVerb',['Subject','は','FirstVerb','前に','MainVerb'],'本を読む前にお茶を飲みます','before doing X, do Y','dictionary form + 前に',true],
  ['N4','Subject は FirstVerbた後で MainVerb',['Subject','は','FirstVerbた','後で','MainVerb'],'本を読んだ後でお茶を飲みます','after doing X, do Y','past plain + 後で',true],
  ['N4','Subject は FirstVerbたり SecondVerbたりする',['Subject','は','FirstVerbたり','SecondVerbたり','する'],'本を読んだりお茶を飲んだりします','do things such as X and Y','たり-form + たり-form + する',true],
  ['N4','Subject は Object を Verbことができる',['Subject','は','Object','を','Verbことができる'],'私は本を読むことができます','can do','dictionary form + ことができる',true],
  ['N4','Subject は Object を Verbなくてもいい',['Subject','は','Object','を','Verbなくてもいい'],'本を読まなくてもいいです','do not have to do','nai-form + なくてもいい',true],

  ['N3','Subject は Verbようにする',['Subject','は','Verbようにする'],'毎日勉強するようにする','make an effort or habit','plain form + ようにする',true],
  ['N3','Subject は Verbことにする',['Subject','は','Verbことにする'],'日本へ行くことにする','decide to do','plain form + ことにする',true],
  ['N3','Subject は Verbようになる',['Subject','は','Verbようになる'],'漢字が読めるようになる','change in ability or habit','plain/potential + ようになる',true],
  ['N3','Subject は Object を Verbてしまう',['Subject','は','Object','を','Verbてしまう'],'宿題を忘れてしまう','completion or regret','te-form + しまう',true],
  ['N3','Subject は Verbておく',['Subject','は','Verbておく'],'予約しておく','do in preparation','te-form + おく',true],
  ['N3','Condition-ば Result',['Conditionば','Result'],'雨が降れば行かない','conditional if','ba-form',true],
  ['N3','Condition-たら Result',['Conditionたら','Result'],'時間があったら行く','conditional when/if','tara-form',true],
  ['N3','Clause のに Contrasting result',['Clause','のに','Contrasting result'],'勉強したのに忘れた','although or despite','plain form + のに',true],
  ['N3','Reason clause ので Result',['Reason clause','ので','Result'],'雨なので家にいる','because or since','plain/na/noun + ので',true],
  ['N3','Purpose clause ために Main clause',['Purpose clause','ために','Main clause'],'日本へ行くために勉強する','in order to','dictionary form + ために',true],
  ['N3','Activityている間に Main clause',['Activityている','間に','Main clause'],'母が買い物をしている間に宿題をする','while (bounded window)','te-form + いる + 間に',true],
  ['N3','Conditionうちに Main clause',['Conditionうちに','Main clause'],'温かいうちに食べる','while / before it is too late','plain form + うちに',true],
  ['N3','Subject は Verbたばかりです',['Subject','は','Verbたばかりです'],'今起きたばかりです','just did','ta-form + ばかり',true],
  ['N3','Subject は Object を Verb終わる',['Subject','は','Object','を','Verb終わる'],'宿題をし終わる','finish doing','masu-stem + 終わる',true],
  ['N3','Subject は Object を Verb続ける',['Subject','は','Object','を','Verb続ける'],'勉強し続ける','continue doing','masu-stem + 続ける',true],
  ['N3','Cause おかげで Positive result',['Cause','おかげで','Positive result'],'先生のおかげで合格した','thanks to','noun/plain form + おかげで',true],
  ['N3','Cause せいで Negative result',['Cause','せいで','Negative result'],'雨のせいで遅れた','because of (blame)','noun/plain form + せいで',true],
  ['N3','Subject は Object を Verbたまま Result',['Subject','は','Object','を','Verbたまま','Result'],'電気をつけたまま寝た','leaving a state as-is','ta-form + まま',true],
  ['N3','Subject は Verbつつ MainVerb',['Subject','は','Verbつつ','MainVerb'],'テレビを見つつ勉強する','while (formal)','masu-stem + つつ',true],
  ['N3','Clause と思う',['Clause','と思う'],'明日は雨だと思う','I think that','plain form + と思う',true],
  ['N3','Clause らしい',['Clause','らしい'],'明日は雨らしい','apparently (hearsay from outside info)','plain form + らしい',true],
  ['N3','Clause そうだ',['Clause','そうだ'],'明日は雨だそうだ','I heard that (hearsay)','plain form + そうだ',true],
  ['N3','Clause ようだ',['Clause','ようだ'],'彼は忙しいようだ','seems (speaker\'s own judgment)','plain form + ようだ',true],
  ['N3','A は B より Adjective',['A','は','B','より','Adjective'],'犬は猫より大きい','more than (comparison)','noun + より',true],
  ['N3','A は B ほど Adjective ない',['A','は','B','ほど','Adjectiveない'],'私は彼ほど上手ではない','not as much as','noun + ほど + negative',true],
  ['N3','Subject は Object だけ Verb',['Subject','は','Object','だけ','Verb'],'水だけ飲む','only','noun + だけ',true],
  ['N3','Topicなら Advice',['Topicなら','Advice'],'日本へ行くならパスポートが必要だ','if it is the case that (topic conditional)','plain form + なら',true],
  ['N3','Conditionと Automatic result',['Conditionと','Automatic result'],'春になると桜が咲く','whenever (automatic result)','dictionary form + と',true],
  ['N3','Subject は Aとか Bとか が好き',['Subject','は','Aとか','Bとか','が好き'],'すしとか天ぷらとかが好きだ','things like (informal listing)','noun + とか',true],
  ['N3','Subject は A や B を Verb',['Subject','は','A','や','B','を','Verb'],'りんごやバナナを食べる','and (partial listing)','noun + や',true],
  ['N3','Subject は Object を Verbてみる',['Subject','は','Object','を','Verbてみる'],'料理を作ってみる','try doing','te-form + みる',true],
  ['N3','Activityている間 Concurrent action',['Activityている','間','Concurrent action'],'子供が寝ている間家事をしていた','during (the whole span)','te-form + いる + 間',true],
  ['N3','Subject は Verbなくなる',['Subject','は','Verbなくなる'],'漢字を書かなくなった','no longer do','nai-stem + なくなる',true],
  ['N3','Extreme predicateくらい Degree',['Extreme predicateくらい','Degree'],'泣きたいくらい嬉しい','to the extent that (degree)','plain form + くらい',true],
  ['N3','Subject は Object ばかり Verb',['Subject','は','Object','ばかり','Verb'],'ゲームばかりしている','only / nothing but (habitual)','noun + ばかり',true],
  ['N3','Causeあまり Result',['Causeあまり','Result'],'嬉しさのあまり泣いてしまった','so much that','noun/plain form + あまり',true],
  ['N3','Subject は 「Quote」と言う',['Subject','は','「Quote」と言う'],'先生は「頑張って」と言った','say that (quotation)','quote + と言う',true],
  ['N3','Object は Adjective-stemそうだ',['Object','は','Adjective-stem','そうだ'],'このケーキは美味しそうだ','looks like (appearance)','i-adjective stem + そう',true],
  ['N3','Subject は Verbないでください',['Subject','は','Verbないでください'],'心配しないでください','please do not','nai-stem + ないでください',true],

  ['N2','Clause わけではない',['Clause','わけではない'],'嫌いなわけではない','it does not mean that','plain form + わけではない',true],
  ['N2','Clause わけにはいかない',['Clause','わけにはいかない'],'行くわけにはいかない','cannot reasonably or socially do','dictionary form + わけにはいかない',true],
  ['N2','Clause ことになる',['Clause','ことになる'],'転勤することになった','it has been decided that','dictionary form + ことになる',true],
  ['N2','Verb ことはない',['Verb','ことはない'],'心配することはない','there is no need to','dictionary form + ことはない',true],
  ['N2','Clause に違いない',['Clause','に違いない'],'彼が犯人に違いない','must certainly be','plain/noun + に違いない',true,'Normalized from 本当に違いない so the template has a complete proposition.'],
  ['N2','Clause はずだ',['Clause','はずだ'],'彼は来るはずだ','expected or supposed to','plain form + はずだ',true],
  ['N2','Clause ものだ',['Clause','ものだ'],'人生は難しいものだ','general truth or recollection','plain form + ものだ',true],
  ['N2','Noun のような Noun',['Noun','のような','Noun'],'鳥のような声','noun resembling another noun','noun + のような',true],
  ['N2','Verbない ように MainVerb',['Verbない','ように','MainVerb'],'忘れないように書く','do so that something occurs/does not occur','plain form + ように',true],
  ['N2','Subject は Verbところだ',['Subject','は','Verbところだ'],'今帰るところだ','about to, in the middle of, or just did','dictionary/ている/た + ところだ',true],
  ['N2','Subject は Verbべきだ',['Subject','は','Verbべきだ'],'学生は勉強するべきだ','should do','dictionary form + べきだ',true],
  ['N2','Change1につれて Change2',['Change1につれて','Change2'],'年を取るにつれて体が弱くなる','as / along with a change','dictionary form + につれて',true],
  ['N2','Subject は Object さえ Verbない',['Subject','は','Object','さえ','Verbない'],'漢字さえ読めない','even (emphatic)','noun + さえ',true],
  ['N2','Subject こそ Predicate',['Subject','こそ','Predicate'],'あなたこそ天才だ','precisely / it is X that','noun + こそ',true],
  ['N2','Subject は Xばかりか Yも Verb',['Subject','は','Xばかりか','Yも','Verb'],'彼は英語ばかりか中国語も話せる','not only X but also Y','noun + ばかりか',true],
  ['N2','Subject は Verbべきではない',['Subject','は','Verbべきではない'],'学生は諦めるべきではない','should not do','dictionary form + べきではない',true],
  ['N2','Clause というわけではない',['Clause','というわけではない'],'嫌いというわけではない','it is not that (softened)','plain form + というわけではない',true],
  ['N2','Subject は Verbかねます',['Subject','は','Verbかねます'],'賛成しかねます','cannot do (polite refusal)','masu-stem + かねます',true],
  ['N2','Clause にもかかわらず Result',['Clause','にもかかわらず','Result'],'雨にもかかわらず試合は続いた','despite','plain form + にもかかわらず',true],
  ['N2','Clauseくせに Criticism',['Clauseくせに','Criticism'],'下手なくせに教えたがる','even though (critical)','plain form + くせに',true],
  ['N2','Expectationどころか Reality',['Expectationどころか','Reality'],'上手どころか下手だ','far from','noun/plain form + どころか',true],
  ['N2','Verbたとたん Unexpected result',['Verbたとたん','Unexpected result'],'家を出たとたん雨が降り出した','the moment that','ta-form + とたん',true],
  ['N2','Verb次第 Immediate result',['Verb次第','Immediate result'],'着き次第連絡する','as soon as','masu-stem + 次第',true],
  ['N2','Verbて以来 Ongoing result',['Verbて以来','Ongoing result'],'日本に来て以来ずっと忙しい','ever since','te-form + 以来',true],
  ['N2','Verbたうえで Subsequent action',['Verbたうえで','Subsequent action'],'よく考えたうえで決める','after doing (as a basis)','ta-form + うえで',true],
  ['N2','Verbている最中に Interruption',['Verbている最中に','Interruption'],'食事をしている最中に電話が鳴った','right in the middle of','te-form + いる + 最中に',true],
  ['N2','Reasonものだから Result',['Reasonものだから','Result'],'道が混んでいたものだから遅れた','because (excuse-giving)','plain form + ものだから',true],
  ['N2','Noun/Clause おそれがある',['Noun/Clauseおそれがある'],'台風が来るおそれがある','there is a risk of','dictionary form + おそれがある',true],
  ['N2','Evidenceことから Conclusion',['Evidenceことから','Conclusion'],'顔色が悪いことから体調が悪いと分かった','judging from / because','plain form + ことから',true],
  ['N2','Clauseとはいえ Result',['Clauseとはいえ','Result'],'安いとはいえ品質は良い','though (formal contrast)','plain form + とはいえ',true],
  ['N2','Stateながら Contrast',['Stateながら','Contrast'],'狭いながらも楽しい家だ','although (concessive)','plain/i-adjective + ながら',true],
  ['N2','Condition限り Result',['Condition限り','Result'],'生きている限り頑張る','as long as','plain form + 限り',true],
  ['N2','A は B に比べて Difference',['A','は','B','に比べて','Difference'],'今年は去年に比べて暑い','compared with','noun + に比べて',true],
  ['N2','Subject は Topic に対して Reaction',['Subject','は','Topic','に対して','Reaction'],'彼はその意見に対して反対した','toward / in response to','noun + に対して',true],
  ['N2','Subject は Object すら Verbない',['Subject','は','Object','すら','Verbない'],'名前すら知らない','even (formal emphasis)','noun + すら',true],
  ['N2','Clause はずがない',['Clause','はずがない'],'彼が来るはずがない','there is no way that','plain form + はずがない',true],
  ['N2','Subject は Verbようとする',['Subject','は','Verbようとする'],'ドアを開けようとする','try to / be about to','volitional + とする',true],

  ['N1','Subject は Verbざるを得ない',['Subject','は','Verbざるを得ない'],'行かざるを得ない','cannot avoid doing','nai-stem + ざるを得ない',true],
  ['N1','Noun にほかならない',['Noun','にほかならない'],'成功は努力の結果にほかならない','nothing other than','noun + にほかならない',true,'Normalized to a complete noun assertion.'],
  ['N1','Clause ものの Result',['Clause','ものの','Result'],'勉強したものの忘れた','although','plain form + ものの',true],
  ['N1','Clause かねない',['Clause','かねない'],'事故になりかねない','might result in something negative','masu-stem + かねない',true],
  ['N1','Verbないことには Result',['Verbないことには','Result'],'食べないことには始まらない','unless something is done','nai-form + ことには',true],
  ['N1','Noun に至るまで',['Noun','に至るまで'],'子供に至るまで知っている','extending even to','noun + に至るまで',true],
  ['N1','Noun ならでは の Noun',['Noun','ならではの','Noun'],'日本ならではの文化','unique or characteristic of','noun + ならでは',true],
  ['N1','Noun に即して Verb',['Noun','に即して','Verb'],'現実に即して考える','in accordance with','noun + に即して',true],
  ['N1','Topic をめぐって Verb',['Topic','をめぐって','Verb'],'問題をめぐって議論する','concerning or surrounding a topic','noun + をめぐって',true],
  ['N1','Event に際して Main clause',['Event','に際して','Main clause'],'出発に際して挨拶する','on the occasion of','noun/dictionary + に際して',true],
  ['N1','Conditionとすれば Result',['Conditionとすれば','Result'],'日本へ行くとすれば準備が必要だ','if / supposing','dictionary form + とすれば',true],
  ['N1','Basis に応じて Result',['Basis','に応じて','Result'],'天気に応じて予定が変わる','according to / depending on','noun + に応じて',true],
  ['N1','Generalization とは限らない',['Generalization','とは限らない'],'高いものがいいとは限らない','not necessarily','plain form + とは限らない',true],
]

const levelCounts = new Map<JlptLevel,number>()

export const sentencePatternCatalog: SentencePatternRecord[] = rows.map((row) => {
  const number=(levelCounts.get(row[0]) ?? 0)+1
  levelCounts.set(row[0],number)
  return {
    id:`${row[0].toLowerCase()}-${String(number).padStart(2,'0')}`,
    jlpt:row[0],structure:row[1],slots:row[2],example:row[3],meaning:row[4],verbForm:row[5],generatorReady:row[6] ?? false,note:row[7],
  }
})

const ACTIVE_KEY = 'kanji-quest-active-sentence-patterns-v1'

export function loadActiveSentencePatternIds() {
  const defaults = sentencePatternCatalog.filter(pattern => pattern.generatorReady).map(pattern => pattern.id)
  if (typeof window === 'undefined') return defaults
  try { const saved = window.localStorage.getItem(ACTIVE_KEY); return saved ? (JSON.parse(saved) as string[]).filter(id => sentencePatternCatalog.some(pattern => pattern.id === id && pattern.generatorReady)) : defaults } catch { return defaults }
}

export function saveActiveSentencePatternIds(ids: string[]) {
  if (typeof window !== 'undefined') window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(ids))
}
