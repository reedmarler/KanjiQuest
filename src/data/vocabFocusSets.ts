import type { JlptLevel, StudyCard } from '../lib/types'

type TopicWord = readonly [word: string, reading: string, meaning: string, jlpt?: JlptLevel]

export interface VocabFocusSet {
  id: string
  title: string
  description: string
  cards: StudyCard[]
}

function makeSet(id: string, title: string, description: string, words: readonly TopicWord[]): VocabFocusSet {
  return {
    id,
    title,
    description,
    cards: words.map(([front, reading, back, jlpt = 'N5'], index) => ({
      id: `vocab-focus-${id}-${String(index + 1).padStart(2, '0')}`,
      type: 'vocab',
      front,
      reading,
      back,
      jlpt,
    })),
  }
}

/**
 * Fifteen-word paths make vocabulary study feel purposeful: each group shares
 * a situation, then the next run deliberately moves to another situation.
 */
export const vocabFocusSets: readonly VocabFocusSet[] = [
  makeSet('home', 'Home & routine', 'Things you see and do at home.', [
    ['布団', 'ふとん', 'futon'], ['棚', 'たな', 'shelf'], ['鏡', 'かがみ', 'mirror'],
    ['電気', 'でんき', 'light; electricity'], ['冷凍庫', 'れいとうこ', 'freezer'],
    ['洗面所', 'せんめんじょ', 'washroom'], ['歯ブラシ', 'はぶらし', 'toothbrush'],
    ['石けん', 'せっけん', 'soap'], ['洗濯', 'せんたく', 'laundry'],
    ['掃除', 'そうじ', 'cleaning'], ['片付け', 'かたづけ', 'tidying up'],
    ['ゴミ箱', 'ごみばこ', 'trash can'], ['毛布', 'もうふ', 'blanket'],
    ['玄関', 'げんかん', 'entryway'], ['留守', 'るす', 'absence; not at home'],
  ]),
  makeSet('food', 'Food & dining', 'Food, drinks, and restaurant basics.', [
    ['ご飯', 'ごはん', 'cooked rice; meal'], ['味噌汁', 'みそしる', 'miso soup'],
    ['箸', 'はし', 'chopsticks'], ['皿', 'さら', 'plate'], ['茶碗', 'ちゃわん', 'rice bowl'],
    ['注文', 'ちゅうもん', 'order'], ['店員', 'てんいん', 'store clerk'],
    ['会計', 'かいけい', 'bill; checkout'], ['水', 'みず', 'water'],
    ['お茶', 'おちゃ', 'tea'], ['牛乳', 'ぎゅうにゅう', 'milk'],
    ['魚', 'さかな', 'fish'], ['豆腐', 'とうふ', 'tofu'], ['味', 'あじ', 'taste; flavor'],
    ['満腹', 'まんぷく', 'full; satisfied'],
  ]),
  makeSet('shopping', 'Shopping & money', 'Useful words for buying everyday things.', [
    ['値段', 'ねだん', 'price'], ['商品', 'しょうひん', 'product; item'],
    ['売り場', 'うりば', 'sales floor'], ['割引', 'わりびき', 'discount'],
    ['税込み', 'ぜいこみ', 'tax included'], ['お釣り', 'おつり', 'change'],
    ['領収書', 'りょうしゅうしょ', 'receipt'], ['袋', 'ふくろ', 'bag'],
    ['現金', 'げんきん', 'cash'], ['小銭', 'こぜに', 'coins; small change'],
    ['紙幣', 'しへい', 'banknote'], ['支払う', 'しはらう', 'to pay'],
    ['選ぶ', 'えらぶ', 'to choose'], ['試着', 'しちゃく', 'trying on clothes'],
    ['返品', 'へんぴん', 'returning an item'],
  ],),
  makeSet('travel', 'Travel & transport', 'Getting around and asking for help.', [
    ['改札', 'かいさつ', 'ticket gate'], ['ホーム', 'ほーむ', 'platform'],
    ['路線', 'ろせん', 'train line; route'], ['片道', 'かたみち', 'one way'],
    ['往復', 'おうふく', 'round trip'], ['乗車券', 'じょうしゃけん', 'train ticket'],
    ['運転手', 'うんてんしゅ', 'driver'], ['信号', 'しんごう', 'traffic light'],
    ['横断歩道', 'おうだんほどう', 'crosswalk'], ['出口', 'でぐち', 'exit'],
    ['入口', 'いりぐち', 'entrance'], ['道順', 'みちじゅん', 'directions; route'],
    ['目的地', 'もくてきち', 'destination'], ['荷物', 'にもつ', 'luggage'],
    ['忘れ物', 'わすれもの', 'lost item'],
  ]),
  makeSet('school', 'School & study', 'Words for lessons, homework, and progress.', [
    ['教科書', 'きょうかしょ', 'textbook'], ['ノート', 'のーと', 'notebook'],
    ['辞書', 'じしょ', 'dictionary'], ['宿題', 'しゅくだい', 'homework'],
    ['予習', 'よしゅう', 'preparation for a lesson'], ['復習', 'ふくしゅう', 'review'],
    ['成績', 'せいせき', 'grades; results'], ['合格', 'ごうかく', 'passing an exam'],
    ['不合格', 'ふごうかく', 'failing an exam'], ['出席', 'しゅっせき', 'attendance'],
    ['欠席', 'けっせき', 'absence'], ['黒板', 'こくばん', 'blackboard'],
    ['提出', 'ていしゅつ', 'submission'], ['覚える', 'おぼえる', 'to memorize'],
    ['理解する', 'りかいする', 'to understand'],
  ]),
  makeSet('work', 'Work & office', 'Everyday workplace vocabulary.', [
    ['会社', 'かいしゃ', 'company'], ['社員', 'しゃいん', 'employee'],
    ['上司', 'じょうし', 'boss; supervisor'], ['同僚', 'どうりょう', 'coworker'],
    ['会議', 'かいぎ', 'meeting'], ['資料', 'しりょう', 'materials; document'],
    ['締め切り', 'しめきり', 'deadline'], ['休憩', 'きゅうけい', 'break'],
    ['出張', 'しゅっちょう', 'business trip'], ['残業', 'ざんぎょう', 'overtime'],
    ['連絡', 'れんらく', 'contact'], ['予定表', 'よていひょう', 'schedule'],
    ['印刷', 'いんさつ', 'printing'], ['会議室', 'かいぎしつ', 'meeting room'],
    ['報告する', 'ほうこくする', 'to report'],
  ]),
  makeSet('health', 'Health & body', 'Useful vocabulary for feeling unwell or caring for yourself.', [
    ['体', 'からだ', 'body'], ['頭', 'あたま', 'head'], ['顔', 'かお', 'face'],
    ['目', 'め', 'eye'], ['耳', 'みみ', 'ear'], ['口', 'くち', 'mouth'],
    ['手', 'て', 'hand'], ['足', 'あし', 'foot; leg'], ['熱', 'ねつ', 'fever'],
    ['痛み', 'いたみ', 'pain'], ['薬', 'くすり', 'medicine'], ['医者', 'いしゃ', 'doctor'],
    ['看護師', 'かんごし', 'nurse'], ['予約', 'よやく', 'appointment; reservation'],
    ['休む', 'やすむ', 'to rest'],
  ]),
  makeSet('city', 'City & community', 'Places and services around town.', [
    ['市役所', 'しやくしょ', 'city hall'], ['図書館', 'としょかん', 'library'],
    ['美術館', 'びじゅつかん', 'art museum'], ['公園', 'こうえん', 'park'],
    ['郵便局', 'ゆうびんきょく', 'post office'], ['警察署', 'けいさつしょ', 'police station'],
    ['消防署', 'しょうぼうしょ', 'fire station'], ['薬局', 'やっきょく', 'pharmacy'],
    ['美容院', 'びよういん', 'hair salon'], ['駐車場', 'ちゅうしゃじょう', 'parking lot'],
    ['交差点', 'こうさてん', 'intersection'], ['歩道', 'ほどう', 'sidewalk'],
    ['商店街', 'しょうてんがい', 'shopping street'], ['近所', 'きんじょ', 'neighborhood'],
    ['案内所', 'あんないじょ', 'information desk'],
  ]),
  makeSet('nature', 'Nature & weather', 'Words for talking about the outdoors.', [
    ['山', 'やま', 'mountain'], ['森', 'もり', 'forest'], ['湖', 'みずうみ', 'lake'],
    ['島', 'しま', 'island'], ['海岸', 'かいがん', 'coast'], ['花', 'はな', 'flower'],
    ['草', 'くさ', 'grass'], ['木', 'き', 'tree'], ['葉', 'は', 'leaf'],
    ['雲', 'くも', 'cloud'], ['雷', 'かみなり', 'thunder'], ['台風', 'たいふう', 'typhoon'],
    ['温度', 'おんど', 'temperature'], ['晴れ', 'はれ', 'sunny weather'],
    ['曇り', 'くもり', 'cloudy weather'],
  ]),
  makeSet('feelings', 'Feelings & relationships', 'Words for people, emotions, and social life.', [
    ['親', 'おや', 'parent'], ['兄弟', 'きょうだい', 'siblings'], ['夫婦', 'ふうふ', 'married couple'],
    ['友人', 'ゆうじん', 'friend'], ['仲間', 'なかま', 'companion; group member'],
    ['安心', 'あんしん', 'relief; peace of mind'], ['心配', 'しんぱい', 'worry'],
    ['緊張', 'きんちょう', 'nervousness'], ['感動', 'かんどう', 'being moved'],
    ['失望', 'しつぼう', 'disappointment'], ['誇り', 'ほこり', 'pride'], ['感謝', 'かんしゃ', 'gratitude'],
    ['信頼', 'しんらい', 'trust'], ['約束', 'やくそく', 'promise'],
    ['助ける', 'たすける', 'to help; save'],
  ]),
  makeSet('technology', 'Technology & media', 'Words for modern everyday Japanese.', [
    ['携帯電話', 'けいたいでんわ', 'mobile phone'], ['画面', 'がめん', 'screen'],
    ['写真', 'しゃしん', 'photo'], ['動画', 'どうが', 'video'], ['音楽', 'おんがく', 'music'],
    ['映画', 'えいが', 'movie'], ['番組', 'ばんぐみ', 'program; show'],
    ['新聞', 'しんぶん', 'newspaper'], ['ニュース', 'にゅーす', 'news'],
    ['メール', 'めーる', 'email'], ['返信', 'へんしん', 'reply'], ['検索', 'けんさく', 'search'],
    ['保存', 'ほぞん', 'save; storage'], ['充電', 'じゅうでん', 'charging'],
    ['故障', 'こしょう', 'breakdown; malfunction'],
  ]),
  makeSet('time', 'Plans & time', 'Talk about timing, plans, and the near future.', [
    ['午前', 'ごぜん', 'morning; a.m.'], ['午後', 'ごご', 'afternoon; p.m.'],
    ['週末', 'しゅうまつ', 'weekend'], ['休日', 'きゅうじつ', 'day off; holiday'],
    ['期間', 'きかん', 'period; duration'], ['時間', 'じかん', 'time; hour'],
    ['予定', 'よてい', 'plan; schedule'], ['都合', 'つごう', 'convenience; circumstances'],
    ['間に合う', 'まにあう', 'to be in time'], ['遅れる', 'おくれる', 'to be late'],
    ['始まる', 'はじまる', 'to begin'], ['終わる', 'おわる', 'to end'],
    ['続く', 'つづく', 'to continue'], ['変更', 'へんこう', 'change; alteration'],
    ['決定', 'けってい', 'decision'],
  ]),
]

export const vocabFocusCards: StudyCard[] = vocabFocusSets.flatMap((set) => set.cards)
