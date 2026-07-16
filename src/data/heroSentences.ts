import type { HeroSegment, PosFills } from '../lib/posSentenceEngine'

export type HeroSlot =
  | 'prefix'
  | 'subject'
  | 'topicParticle'
  | 'modifier'
  | 'word'
  | 'objectParticle'
  | 'bridge'
  | 'predicate'

export interface HeroSentenceFrame {
  /** Curated sentence id (1–200) when using the vocab rotator */
  curatedId?: number
  /** POS template id (1–150) when using the new sentence engine */
  templateId?: number
  fills?: PosFills
  segments?: HeroSegment[]
  /** Exact translation supplied by the structured sentence generator. */
  generatedEnglish?: string
  generatedPatternId?: string
  generatedReading?: string
  /** Curated lead clause — conditionals, time adverbs (もし…、昨日) */
  prefix: string
  subject: string
  topicParticle: string
  modifier: string
  word: string
  objectParticle: string
  /** Mid-sentence connector clause (て-form, が…ので) */
  bridge: string
  predicate: string
}

export function isPosFrame(frame: HeroSentenceFrame): boolean {
  return Boolean(frame.segments && frame.segments.length > 0)
}

export interface HeroTemplate {
  id: string
  objectParticle: string
  predicate: string
  wordLength: number
  /** Optional lead clause before 私は */
  prefix?: string
  /** Optional adverb placed after the topic particle */
  modifier?: string
  /** Connector between the word slot and closing predicate */
  bridge?: string
  /** Curated words that make grammatical sense with this pattern */
  words: readonly string[]
  /** Vocab word is the sentence topic — no 私は prefix (e.g. 経済は重要です) */
  topicComment?: boolean
}

export function isTopicCommentTemplate(template: HeroTemplate): boolean {
  return template.topicComment === true
}

/** Subjects grouped by character length for length-matched reel swaps */
export const HERO_SUBJECTS_BY_LENGTH: Record<number, readonly string[]> = {
  1: ['私', '彼'],
  2: ['彼女', '友達', '先生', '母', '兄', '姉'],
  3: ['みんな', '父さん', '母さん', '兄さん'],
}

export const HERO_SUBJECTS = [
  ...HERO_SUBJECTS_BY_LENGTH[1],
  ...HERO_SUBJECTS_BY_LENGTH[2],
  ...HERO_SUBJECTS_BY_LENGTH[3],
] as const

/** Fixed reel widths — minimum chars when empty */
export const HERO_SLOT_WIDTHS = {
  prefix: 2,
  subject: 1,
  topicParticle: 1,
  modifier: 1,
  word: 1,
  objectParticle: 1,
  bridge: 2,
  predicate: 2,
} as const

export const HERO_SUBJECT_SLOT_WIDTH = HERO_SLOT_WIDTHS.subject
export const HERO_MODIFIER_SLOT_WIDTH = HERO_SLOT_WIDTHS.modifier
export const HERO_WORD_SLOT_WIDTH = HERO_SLOT_WIDTHS.word

export function templateTransitionKey(template: HeroTemplate): string {
  const mod = charLength(template.modifier ?? '')
  const band = template.wordLength <= 4 ? 'w4' : `w${template.wordLength}`
  return `${band}-${mod}`
}

export function templateLane(template: HeroTemplate) {
  return {
    wordLength: template.wordLength,
    modifierLength: charLength(template.modifier ?? ''),
    predicateLength: charLength(template.predicate),
  }
}

export const HERO_TEMPLATES: HeroTemplate[] = [
  {
    id: 'suki-2',
    objectParticle: 'が',
    predicate: '好きです',
    wordLength: 2,
    words: ['ピザ', '映画', '漫画', '音楽', '旅行', '京都', '東京', '大阪', '公園', '家族', '文化', '魚', '肉', '花', '山', '川', '歌', '春', '夏', '秋', '冬'],
  },
  {
    id: 'suki-3',
    objectParticle: 'が',
    predicate: '好きです',
    wordLength: 3,
    words: ['ラーメン', '日本語', 'ゴルフ', 'ホテル', '温泉', '神社', '数学', '科学'],
  },
  {
    id: 'suki-4',
    objectParticle: 'が',
    predicate: '好きです',
    wordLength: 4,
    words: ['コーヒー', 'プレゼント', '誕生日'],
  },
  {
    id: 'suki-5',
    objectParticle: 'が',
    predicate: '好きです',
    wordLength: 5,
    words: ['レストラン'],
  },
  {
    id: 'suki-6',
    objectParticle: 'が',
    predicate: '好きです',
    wordLength: 6,
    words: ['チョコレート'],
  },
  {
    id: 'tabe-2',
    objectParticle: 'を',
    predicate: '食べます',
    wordLength: 2,
    words: ['ピザ', '寿司', '弁当', '魚', '肉', '米', '卵', '野菜', '果物'],
  },
  {
    id: 'tabe-4',
    objectParticle: 'を',
    predicate: '食べます',
    wordLength: 4,
    words: ['ラーメン', 'ハンバーガー'],
  },
  {
    id: 'tabe-daily-2',
    objectParticle: 'を',
    predicate: '食べます',
    wordLength: 2,
    modifier: '毎日',
    words: ['寿司', '弁当', 'パン'],
  },
  {
    id: 'tabe-daily-3',
    objectParticle: 'を',
    predicate: '食べます',
    wordLength: 3,
    modifier: '毎日',
    words: ['ラーメン', 'サラダ'],
  },
  {
    id: 'tabe-want-3',
    objectParticle: 'を',
    predicate: '食べたいです',
    wordLength: 3,
    words: ['ラーメン', 'ケーキ'],
  },
  {
    id: 'nomu-3',
    objectParticle: 'を',
    predicate: '飲みます',
    wordLength: 3,
    words: ['ジュース', 'ミルク'],
  },
  {
    id: 'nomu-4',
    objectParticle: 'を',
    predicate: '飲みます',
    wordLength: 4,
    words: ['コーヒー'],
  },
  {
    id: 'yomi-2',
    objectParticle: 'を',
    predicate: '読みます',
    wordLength: 2,
    words: ['漫画', '新聞', '本', '雑誌', '地図', '辞書', '手紙'],
  },
  {
    id: 'yomi-often-2',
    objectParticle: 'を',
    predicate: '読みます',
    wordLength: 2,
    modifier: 'よく',
    words: ['漫画', '新聞', '本'],
  },
  {
    id: 'yomi-often-3',
    objectParticle: 'を',
    predicate: '読みます',
    wordLength: 2,
    modifier: 'よく',
    words: ['小説', '雑誌'],
  },
  {
    id: 'benkyo-2',
    objectParticle: 'を',
    predicate: '勉強します',
    wordLength: 2,
    words: ['漢字', '歴史', '文学', '哲学', '政治', '社会', '経済', '文化', '芸術', '教育', '研究', '技術'],
  },
  {
    id: 'benkyo-3',
    objectParticle: 'を',
    predicate: '勉強します',
    wordLength: 3,
    modifier: '毎日',
    words: ['日本語', '数学', '科学'],
  },
  {
    id: 'benkyo-nitsuite-2',
    objectParticle: 'について',
    predicate: '勉強します',
    wordLength: 2,
    words: ['経済', '政治', '歴史', '文化', '文学', '哲学', '社会', '教育', '研究', '国際'],
  },
  {
    id: 'benkyo-nitsuite-3',
    objectParticle: 'について',
    predicate: '勉強します',
    wordLength: 3,
    words: ['日本語', '数学', '科学'],
  },
  /* topic-comment — 経済は重要です */
  {
    id: 'topic-juyo-2',
    objectParticle: 'は',
    predicate: '重要です',
    wordLength: 2,
    topicComment: true,
    words: ['経済', '政治', '社会', '文化', '歴史', '教育', '研究', '文学', '哲学', '宗教', '技術', '産業', '国際', '芸術'],
  },
  {
    id: 'topic-juyo-3',
    objectParticle: 'は',
    predicate: '重要です',
    wordLength: 3,
    topicComment: true,
    words: ['日本語', '数学', '科学'],
  },
  {
    id: 'topic-muzukashii-2',
    objectParticle: 'は',
    predicate: '難しいです',
    wordLength: 2,
    topicComment: true,
    words: ['政治', '経済', '哲学', '漢字', '科学', '文学', '宗教', '矛盾'],
  },
  {
    id: 'topic-omoshiroi-2',
    objectParticle: 'は',
    predicate: '面白いです',
    wordLength: 2,
    topicComment: true,
    words: ['歴史', '文化', '文学', '哲学', '研究', '芸術', '経済', '政治'],
  },
  {
    id: 'topic-henka-2',
    objectParticle: 'は',
    predicate: '変化しています',
    wordLength: 2,
    topicComment: true,
    words: ['社会', '経済', '技術', '産業', '文化', '国際', '教育'],
  },
  /* interest — 私は経済に興味があります */
  {
    id: 'kyoumi-2',
    objectParticle: 'に',
    predicate: '興味があります',
    wordLength: 2,
    words: ['経済', '政治', '文学', '哲学', '芸術', '教育', '研究', '国際', '交流', '歴史', '文化'],
  },
  {
    id: 'kyoumi-3',
    objectParticle: 'に',
    predicate: '興味があります',
    wordLength: 3,
    words: ['日本語', '数学', '科学'],
  },
  /* think / read about */
  {
    id: 'kangaeru-nitsuite-2',
    objectParticle: 'について',
    predicate: '考えます',
    wordLength: 2,
    words: ['経済', '政治', '社会', '哲学', '文化', '歴史', '教育', '研究'],
  },
  {
    id: 'yomu-nitsuite-2',
    objectParticle: 'について',
    predicate: '読みます',
    wordLength: 2,
    words: ['歴史', '文化', '文学', '哲学', '政治', '経済', '社会'],
  },
  {
    id: 'iku-2',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 2,
    words: ['京都', '東京', '大阪', '公園', '駅', '空港', '銀行', '病院', '図書館', '美術館', '動物園', '港', '島', '町', '村'],
  },
  {
    id: 'iku-3',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 3,
    words: ['ホテル', 'デート'],
  },
  {
    id: 'iku-soon-2',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 2,
    modifier: '今から',
    words: ['京都', '東京', '大阪', '公園', '駅'],
  },
  {
    id: 'iku-want-3',
    objectParticle: 'に',
    predicate: '行きたいです',
    wordLength: 3,
    words: ['ホテル', 'デート'],
  },
  {
    id: 'iku-5',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 5,
    words: ['レストラン'],
  },
  {
    id: 'hoshi-1',
    objectParticle: 'が',
    predicate: '欲しいです',
    wordLength: 1,
    words: ['車', '本', '犬', '猫'],
  },
  {
    id: 'hoshi-3',
    objectParticle: 'が',
    predicate: '欲しいです',
    wordLength: 3,
    words: ['かばん'],
  },
  {
    id: 'hoshi-4',
    objectParticle: 'が',
    predicate: '欲しいです',
    wordLength: 4,
    words: ['パソコン'],
  },
  /* watch */
  {
    id: 'miru-2',
    objectParticle: 'を',
    predicate: '見ます',
    wordLength: 2,
    words: ['映画', '野球'],
  },
  {
    id: 'miru-3',
    objectParticle: 'を',
    predicate: '見ます',
    wordLength: 3,
    words: ['ドラマ', 'アニメ'],
  },
  {
    id: 'mitai-3',
    objectParticle: 'を',
    predicate: '見たいです',
    wordLength: 3,
    words: ['ドラマ', 'アニメ'],
  },
  /* buy */
  {
    id: 'kai-2',
    objectParticle: 'を',
    predicate: '買います',
    wordLength: 2,
    words: ['本', '雑誌', '弁当', '切符', 'プレゼント'],
  },
  {
    id: 'kaitai-2',
    objectParticle: 'を',
    predicate: '買いたいです',
    wordLength: 2,
    words: ['本', '雑誌'],
  },
  /* make / cook */
  {
    id: 'tsukuru-2',
    objectParticle: 'を',
    predicate: '作ります',
    wordLength: 2,
    words: ['料理', '寿司', '弁当'],
  },
  /* listen */
  {
    id: 'kiku-3',
    objectParticle: 'を',
    predicate: '聞きます',
    wordLength: 3,
    words: ['音楽', 'ラジオ'],
  },
  /* can do */
  {
    id: 'dekiru-2',
    objectParticle: 'が',
    predicate: 'できます',
    wordLength: 2,
    words: ['漢字', '料理'],
  },
  {
    id: 'dekiru-3',
    objectParticle: 'が',
    predicate: 'できます',
    wordLength: 3,
    words: ['日本語'],
  },
  /* want to learn about */
  {
    id: 'shiri-2',
    objectParticle: 'について',
    predicate: '知りたいです',
    wordLength: 2,
    words: ['京都', '東京', '大阪', '旅行', '歴史', '経済', '政治', '社会', '文化', '哲学', '文学', '教育', '研究', '国際', '芸術'],
  },
  {
    id: 'shiri-3',
    objectParticle: 'について',
    predicate: '知りたいです',
    wordLength: 3,
    words: ['日本語', '数学', '科学'],
  },
  /* eat at a place */
  {
    id: 'de-tabe-2',
    objectParticle: 'で',
    predicate: '食べます',
    wordLength: 2,
    words: ['学校', '会社', '公園'],
  },
  {
    id: 'de-tabe-5',
    objectParticle: 'で',
    predicate: '食べます',
    wordLength: 5,
    words: ['レストラン'],
  },
  /* really like */
  {
    id: 'totemo-suki-2',
    objectParticle: 'が',
    predicate: '好きです',
    wordLength: 2,
    modifier: 'とても',
    words: ['映画', '音楽', '旅行', '漫画'],
  },
  {
    id: 'totemo-suki-3',
    objectParticle: 'が',
    predicate: '好きです',
    wordLength: 3,
    modifier: 'とても',
    words: ['日本語'],
  },
  /* sometimes drink */
  {
    id: 'tokidoki-nomu-3',
    objectParticle: 'を',
    predicate: '飲みます',
    wordLength: 3,
    modifier: '時々',
    words: ['ジュース', 'ミルク'],
  },
  {
    id: 'tokidoki-nomu-4',
    objectParticle: 'を',
    predicate: '飲みます',
    wordLength: 4,
    modifier: '時々',
    words: ['コーヒー'],
  },
  /* go together */
  {
    id: 'issho-iku-2',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 2,
    modifier: '一緒に',
    words: ['京都', '東京', '公園', '駅'],
  },
  {
    id: 'issho-iku-3',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 3,
    modifier: '一緒に',
    words: ['ホテル', 'デート'],
  },
  /* play sports */
  {
    id: 'suru-2',
    objectParticle: 'を',
    predicate: 'します',
    wordLength: 2,
    words: ['野球', '散歩', '買い物'],
  },
  {
    id: 'suru-3',
    objectParticle: 'を',
    predicate: 'します',
    wordLength: 3,
    words: ['ゴルフ', 'テニス'],
  },
  /* daily watch */
  {
    id: 'mainichi-miru-2',
    objectParticle: 'を',
    predicate: '見ます',
    wordLength: 2,
    modifier: '毎日',
    words: ['映画', '漫画'],
  },
  /* often listen */
  {
    id: 'yoku-kiku-3',
    objectParticle: 'を',
    predicate: '聞きます',
    wordLength: 3,
    modifier: 'よく',
    words: ['音楽', 'ラジオ'],
  },
  /* want computer etc */
  {
    id: 'hoshi-totemo-1',
    objectParticle: 'が',
    predicate: '欲しいです',
    wordLength: 1,
    modifier: 'とても',
    words: ['車', '犬', '猫'],
  },
  /* interesting / fun / skill */
  {
    id: 'omoshiroi-2',
    objectParticle: 'が',
    predicate: '面白いです',
    wordLength: 2,
    words: ['映画', '漫画', '本', '歴史'],
  },
  {
    id: 'tanoshii-3',
    objectParticle: 'が',
    predicate: '楽しいです',
    wordLength: 3,
    words: ['旅行', 'テニス', 'ゴルフ'],
  },
  {
    id: 'jozu-3',
    objectParticle: 'が',
    predicate: '上手です',
    wordLength: 3,
    words: ['日本語'],
  },
  {
    id: 'heta-2',
    objectParticle: 'が',
    predicate: '下手です',
    wordLength: 2,
    words: ['料理', '漢字'],
  },
  /* take photos */
  {
    id: 'toru-2',
    objectParticle: 'を',
    predicate: '撮ります',
    wordLength: 2,
    words: ['写真'],
  },
  /* weekend activities */
  {
    id: 'shuumatsu-suru-3',
    objectParticle: 'を',
    predicate: 'します',
    wordLength: 3,
    modifier: '週末',
    words: ['ゴルフ', 'テニス'],
  },
  {
    id: 'shuumatsu-iku-2',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 2,
    modifier: '週末',
    words: ['京都', '公園', '大阪'],
  },
  /* afternoon plans */
  {
    id: 'gogo-nomu-3',
    objectParticle: 'を',
    predicate: '飲みます',
    wordLength: 3,
    modifier: '午後',
    words: ['ジュース', 'ミルク'],
  },
  {
    id: 'gogo-iku-3',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 3,
    modifier: '午後',
    words: ['ホテル', 'デート'],
  },
  /* tea / morning drink */
  {
    id: 'asa-nomu-2',
    objectParticle: 'を',
    predicate: '飲みます',
    wordLength: 2,
    modifier: '今朝',
    words: ['お茶'],
  },
  /* learn about */
  {
    id: 'shiri-2-culture',
    objectParticle: 'について',
    predicate: '知りたいです',
    wordLength: 2,
    words: ['文化', '歴史', '京都', '旅行', '経済', '政治', '哲学', '社会'],
  },
  /* meet someone */
  {
    id: 'au-2',
    objectParticle: 'に',
    predicate: '会います',
    wordLength: 2,
    words: ['友達', '先生', '恋人', '両親'],
  },
  /* speak a language */
  {
    id: 'hanasu-3',
    objectParticle: 'を',
    predicate: '話します',
    wordLength: 3,
    words: ['日本語'],
  },
  /* wait for someone */
  {
    id: 'matsu-2',
    objectParticle: 'を',
    predicate: '待ちます',
    wordLength: 2,
    words: ['友達', '先生', '恋人', '両親'],
  },
  /* use / ride */
  {
    id: 'tsukau-2',
    objectParticle: 'を',
    predicate: '使います',
    wordLength: 2,
    words: ['車', '電車'],
  },

  /* ── Complex / natural patterns ── */

  /* 私は電車で会社に行きます */
  {
    id: 'densha-de-iku-2',
    modifier: '電車で',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 2,
    words: ['会社', '学校', '駅', '公園', '図書館', '病院', '銀行', '京都', '東京', '大阪'],
  },
  {
    id: 'basu-de-iku-2',
    modifier: 'バスで',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 2,
    words: ['会社', '学校', '駅', '公園', '病院', '海'],
  },
  /* 私は友達と京都に行きます */
  {
    id: 'tomodachi-iku-2',
    modifier: '友達と',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 2,
    words: ['公園', '駅', '京都', '大阪', '図書館', '海', '美術館'],
  },
  {
    id: 'tomodachi-iku-3',
    modifier: '友達と',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 3,
    words: ['レストラン', '美術館', '動物園', '博物館'],
  },
  /* 私は友達と映画を見に行きます */
  {
    id: 'tomodachi-mi-2',
    modifier: '友達と',
    objectParticle: 'を',
    predicate: '見に行きます',
    wordLength: 2,
    words: ['映画', '試合'],
  },
  {
    id: 'tomodachi-mi-3',
    modifier: '友達と',
    objectParticle: 'を',
    predicate: '見に行きます',
    wordLength: 3,
    words: ['ドラマ', 'アニメ'],
  },
  /* 私は図書館へ本を借りに行きます */
  {
    id: 'toshokan-kari-2',
    modifier: '図書館へ',
    objectParticle: 'を',
    predicate: '借りに行きます',
    wordLength: 2,
    words: ['本', '雑誌', '小説'],
  },
  /* 私は図書館で本を読みます */
  {
    id: 'toshokan-de-yomu-2',
    modifier: '図書館で',
    objectParticle: 'を',
    predicate: '読みます',
    wordLength: 2,
    words: ['本', '雑誌', '小説', '新聞'],
  },
  /* 私は会社で弁当を食べます */
  {
    id: 'kaisha-de-tabe-2',
    modifier: '会社で',
    objectParticle: 'を',
    predicate: '食べます',
    wordLength: 2,
    words: ['弁当', '料理', '寿司'],
  },
  /* 私は経済が大切だと思います */
  {
    id: 'ga-juyou-omou-2',
    objectParticle: 'が',
    predicate: '大切だと思います',
    wordLength: 2,
    words: ['経済', '政治', '教育', '研究', '文化', '歴史', '社会', '環境', '健康', '仕事'],
  },
  {
    id: 'ga-muzukashii-omou-2',
    objectParticle: 'が',
    predicate: '難しいと思います',
    wordLength: 2,
    words: ['漢字', '政治', '哲学', '科学', '文学', '数学'],
  },
  {
    id: 'ga-omoshiroi-omou-2',
    objectParticle: 'が',
    predicate: '面白いと思います',
    wordLength: 2,
    words: ['歴史', '文化', '文学', '哲学', '経済', '映画'],
  },
  /* 私は日本語が話せるようになりたいです */
  {
    id: 'hanaseru-naritai-3',
    objectParticle: 'が',
    predicate: '話せるようになりたいです',
    wordLength: 3,
    words: ['日本語'],
  },
  {
    id: 'yomeru-naritai-2',
    objectParticle: 'が',
    predicate: '読めるようになりたいです',
    wordLength: 2,
    words: ['漢字'],
  },
  /* 私は毎日漢字を勉強し続けています */
  {
    id: 'tsuzukeru-benkyo-2',
    modifier: '毎日',
    objectParticle: 'を',
    predicate: '勉強し続けています',
    wordLength: 2,
    words: ['漢字', '歴史', '文学', '政治', '経済'],
  },
  {
    id: 'tsuzukeru-benkyo-3',
    modifier: '毎日',
    objectParticle: 'を',
    predicate: '勉強し続けています',
    wordLength: 3,
    words: ['日本語', '数学', '科学'],
  },
  /* 私は最近は経済に興味があります */
  {
    id: 'saikin-kyoumi-2',
    modifier: '最近は',
    objectParticle: 'に',
    predicate: '興味があります',
    wordLength: 2,
    words: ['経済', '政治', '文化', '歴史', '哲学', '芸術', '社会', '教育'],
  },
  /* 私はもうすぐ駅に行きます */
  {
    id: 'mousugu-iku-2',
    modifier: 'もうすぐ',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 2,
    words: ['駅', '公園', '京都', '会社', '学校', '病院'],
  },
  /* 私は旅行の経験があります */
  {
    id: 'keiken-ga-aru-2',
    objectParticle: 'の',
    predicate: '経験があります',
    wordLength: 2,
    words: ['旅行', '留学', '仕事', '研究'],
  },
  /* 私は駅で友達に会います */
  {
    id: 'eki-de-au-2',
    modifier: '駅で',
    objectParticle: 'に',
    predicate: '会います',
    wordLength: 2,
    words: ['友達', '先生', '恋人', '両親'],
  },
  /* 私は駅で友達を待ちます */
  {
    id: 'eki-de-matsu-2',
    modifier: '駅で',
    objectParticle: 'を',
    predicate: '待ちます',
    wordLength: 2,
    words: ['友達', '先生', '恋人', '両親'],
  },
  /* 私は寿司を食べたいと思います */
  {
    id: 'tabetai-omou-2',
    objectParticle: 'を',
    predicate: '食べたいと思います',
    wordLength: 2,
    words: ['寿司', '魚', '肉', '弁当', '料理'],
  },
  {
    id: 'ikitai-omou-2',
    objectParticle: 'に',
    predicate: '行きたいと思います',
    wordLength: 2,
    words: ['京都', '海', '公園', '大阪', '温泉', '神社'],
  },
  {
    id: 'ikitai-omou-3',
    objectParticle: 'に',
    predicate: '行きたいと思います',
    wordLength: 3,
    words: ['レストラン', '美術館', '動物園'],
  },
  /* 私は毎日漢字を復習しなければなりません */
  {
    id: 'fukushuu-nakereba-2',
    modifier: '毎日',
    objectParticle: 'を',
    predicate: '復習しなければなりません',
    wordLength: 2,
    words: ['漢字', '歴史', '文学'],
  },
  /* 私は公園で散歩をします */
  {
    id: 'kouen-sanpo-2',
    modifier: '公園で',
    objectParticle: 'を',
    predicate: 'します',
    wordLength: 2,
    words: ['散歩'],
  },
  /* ── Conditionals (もし…ば / …たら) — vocab still swaps in に/を slot ── */
  {
    id: 'cond-mosh-jikan-ikitai-2',
    prefix: 'もし時間があれば、',
    objectParticle: 'に',
    predicate: '行きたいです',
    wordLength: 2,
    words: ['京都', '海', '公園', '大阪', '温泉', '神社'],
  },
  {
    id: 'cond-okane-ikitai-2',
    prefix: 'お金があれば、',
    objectParticle: 'に',
    predicate: '行きたいです',
    wordLength: 2,
    words: ['京都', '海', '温泉', '公園', '旅行'],
  },
  {
    id: 'cond-tenki-iku-2',
    prefix: '天気が良ければ、',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 2,
    words: ['公園', '海', '山', '京都', '温泉'],
  },
  {
    id: 'cond-shigoto-owattara-2',
    prefix: '仕事が終わったら、',
    objectParticle: 'に',
    predicate: '行きます',
    wordLength: 2,
    words: ['家', '駅', '公園', '海', '学校'],
  },
  {
    id: 'cond-jikan-mitai-2',
    prefix: '時間があったら、',
    objectParticle: 'を',
    predicate: '見たいです',
    wordLength: 2,
    words: ['映画', '漫画', '写真', 'ドラマ'],
  },
  /* ── Past tense narratives ── */
  {
    id: 'past-kinou-tabeta-2',
    prefix: '昨日',
    objectParticle: 'を',
    predicate: '食べました',
    wordLength: 2,
    words: ['寿司', '弁当', '魚', '肉', '卵', '米'],
  },
  {
    id: 'past-kesa-nonda-2',
    prefix: '今朝',
    objectParticle: 'を',
    predicate: '飲みました',
    wordLength: 2,
    words: ['紅茶', '水', 'ビール', 'コーヒー'],
  },
  {
    id: 'past-kinou-itta-2',
    prefix: '昨日',
    objectParticle: 'に',
    predicate: '行きました',
    wordLength: 2,
    words: ['京都', '海', '公園', '大阪', '学校', '駅'],
  },
  {
    id: 'past-senshuu-yonda-2',
    prefix: '先週',
    objectParticle: 'を',
    predicate: '読みました',
    wordLength: 2,
    words: ['本', '新聞', '雑誌', '漫画', '小説'],
  },
  {
    id: 'past-kinou-mita-2',
    prefix: '昨日',
    objectParticle: 'を',
    predicate: '見ました',
    wordLength: 2,
    words: ['映画', '写真', 'テレビ', 'ドラマ'],
  },
  {
    id: 'past-weekend-fun-2',
    prefix: '週末',
    objectParticle: 'に行って、',
    predicate: '楽しかったです',
    wordLength: 2,
    words: ['京都', '海', '公園', '温泉', '大阪'],
  },
  /* ── Multi-clause (て-form / ので / が…が) ── */
  {
    id: 'past-tosho-yonde-karita-2',
    prefix: '昨日',
    modifier: '図書館に行って、',
    objectParticle: 'を',
    predicate: '借りました',
    wordLength: 2,
    words: ['本', '雑誌', '小説', '漫画'],
  },
  {
    id: 'past-eki-tsuita-denwa-2',
    modifier: '駅に着いてから、',
    objectParticle: 'に',
    predicate: '電話しました',
    wordLength: 2,
    words: ['友達', '先生', '恋人', '両親'],
  },
  {
    id: 'past-kyoto-itte-mita-2',
    prefix: '先週',
    modifier: '京都に行って、',
    objectParticle: 'を',
    predicate: '見ました',
    wordLength: 2,
    words: ['映画', '神社', '寺', '写真'],
  },
  {
    id: 'multi-taisetsu-ga-benkyou-2',
    bridge: 'が大切だと思いますが、',
    objectParticle: '',
    predicate: 'もっと勉強したいです',
    wordLength: 2,
    words: ['経済', '政治', '歴史', '漢字', '科学', '数学'],
  },
  {
    id: 'multi-suki-node-iku-2',
    bridge: 'が好きなので、',
    objectParticle: '',
    predicate: 'よく行きます',
    wordLength: 2,
    words: ['海', '公園', '京都', '温泉', '山', '大阪'],
  },
  {
    id: 'multi-muzukashii-node-2',
    bridge: '難しいと思うので、',
    objectParticle: 'は',
    topicComment: true,
    predicate: '毎日練習しています',
    wordLength: 2,
    words: ['漢字', '日本語', '数学', '科学', '歴史'],
  },
  {
    id: 'multi-nagara-benkyou-2',
    modifier: '音楽を聞きながら、',
    objectParticle: 'を',
    predicate: '勉強します',
    wordLength: 2,
    words: ['漢字', '日本語', '数学', '歴史', '科学'],
  },
  {
    id: 'multi-yonde-kara-iku-2',
    modifier: '本を読んでから、',
    objectParticle: 'に',
    predicate: '行きました',
    wordLength: 2,
    words: ['京都', '公園', '海', '大阪', '温泉'],
  },

  /* ── More ので / が…が / て-form chains ── */
  {
    id: 'multi-omoshiroi-node-yomu-2',
    bridge: 'が面白いので、',
    objectParticle: '',
    predicate: 'よく読みます',
    wordLength: 2,
    words: ['歴史', '文化', '文学', '哲学', '漫画', '本'],
  },
  {
    id: 'multi-tanoshii-node-iku-2',
    bridge: 'が楽しいので、',
    objectParticle: '',
    predicate: 'よく行きます',
    wordLength: 2,
    words: ['旅行', '海', '公園', '京都', '温泉', '大阪'],
  },
  {
    id: 'multi-kyoumi-node-2',
    bridge: 'に興味があるので、',
    objectParticle: '',
    predicate: 'もっと勉強したいです',
    wordLength: 2,
    words: ['経済', '政治', '歴史', '文化', '哲学', '文学', '教育', '研究'],
  },
  {
    id: 'multi-muzukashii-node-2b',
    bridge: 'とても難しいので、',
    objectParticle: 'は',
    topicComment: true,
    predicate: '毎日練習しています',
    wordLength: 2,
    words: ['漢字', '日本語', '数学', '科学', '歴史'],
  },
  {
    id: 'multi-omoshiroi-ga-benkyou-2',
    bridge: '面白いと思いますが、',
    objectParticle: 'は',
    topicComment: true,
    predicate: 'もっと勉強したいです',
    wordLength: 2,
    words: ['歴史', '文化', '文学', '哲学', '経済', '政治'],
  },
  {
    id: 'multi-ame-node-yonda-2',
    prefix: '雨が降ったので、',
    modifier: '家で',
    objectParticle: 'を',
    predicate: '読みました',
    wordLength: 2,
    words: ['本', '漫画', '新聞', '雑誌'],
  },
  {
    id: 'multi-jikan-nai-node-2',
    prefix: '時間がないので、',
    objectParticle: 'を',
    predicate: '読みます',
    wordLength: 2,
    words: ['本', '漫画', '新聞'],
  },
  {
    id: 'multi-tomodachi-atte-mita-2',
    modifier: '友達と会って、',
    objectParticle: 'を',
    predicate: '見ました',
    wordLength: 2,
    words: ['映画', '写真', 'ドラマ'],
  },
  {
    id: 'multi-shigoto-owatte-itta-2',
    modifier: '仕事が終わってから、',
    objectParticle: 'に',
    predicate: '行きました',
    wordLength: 2,
    words: ['家', '駅', '公園', '海', '京都'],
  },

  /* ── Formal であり (N3+) ── */
  {
    id: 'multi-deari-kiso-2',
    bridge: '学問の基礎であり、',
    objectParticle: 'は',
    topicComment: true,
    predicate: '毎日勉強しています',
    wordLength: 2,
    words: ['歴史', '文学', '哲学', '数学', '科学'],
  },
  {
    id: 'multi-deari-kiban-2',
    bridge: '社会の基盤であり、',
    objectParticle: 'は',
    topicComment: true,
    predicate: 'もっと勉強したいです',
    wordLength: 2,
    words: ['経済', '政治', '教育', '文化', '産業'],
  },
  {
    id: 'multi-deari-koto-2',
    bridge: '日本の古都であり、',
    objectParticle: 'は',
    topicComment: true,
    predicate: '一度行きたいです',
    wordLength: 2,
    words: ['京都', '大阪', '東京'],
  },
  {
    id: 'multi-deari-mondai-2',
    bridge: '現代の課題であり、',
    objectParticle: 'は',
    topicComment: true,
    predicate: 'もっと考えたいです',
    wordLength: 2,
    words: ['経済', '政治', '社会', '環境', '教育', '研究'],
  },
]

export const HERO_TOPIC_PARTICLES = ['は', 'も'] as const

export const SWAPS_PER_TEMPLATE = 24

export interface HeroStep {
  frame: HeroSentenceFrame
  /** Segment keys or legacy slot names that changed this step */
  changed: string[]
  slotWidths: typeof HERO_SLOT_WIDTHS
  templateRefresh: boolean
}

export function getChangedSlots(
  prev: HeroSentenceFrame,
  curr: HeroSentenceFrame,
): string[] {
  if (isPosFrame(curr) && curr.segments) {
    const prevSegs = prev.segments ?? []
    const prevMap = new Map(prevSegs.map((s) => [s.key, s.text]))
    const changed = curr.segments
      .filter((s) => s.swappable && prevMap.get(s.key) !== s.text)
      .map((s) => s.key)
    return changed.length > 0 ? changed : ['N']
  }

  const slots: string[] = []
  if (prev.prefix !== curr.prefix) slots.push('prefix')
  if (prev.subject !== curr.subject) slots.push('subject')
  if (prev.topicParticle !== curr.topicParticle) slots.push('topicParticle')
  if (prev.modifier !== curr.modifier) slots.push('modifier')
  if (prev.word !== curr.word) slots.push('word')
  if (prev.objectParticle !== curr.objectParticle) slots.push('objectParticle')
  if (prev.bridge !== curr.bridge) slots.push('bridge')
  if (prev.predicate !== curr.predicate) slots.push('predicate')
  return slots.length > 0 ? slots : ['word']
}

export function charLength(text: string): number {
  return [...text].length
}

/** Char width for a single slot value — tight fit to actual glyphs */
export function heroSlotCharsFor(_slot: HeroSlot, text: string): number {
  return charLength(text)
}

/** Slot width in chars — fits longest value in the pair */
export function heroSlotChars(_slot: HeroSlot, ...words: string[]): number {
  return words.reduce((max, w) => Math.max(max, charLength(w)), 0)
}

/** @deprecated Use heroSlotChars('word', ...) */
export function heroWordSlotChars(...words: string[]): number {
  return heroSlotChars('word', ...words)
}

/** Width per character in the word slot (em) */
export const HERO_CHAR_WIDTH_EM = 1
