import type { StudyCard } from '../lib/types'

/**
 * Verbs not already covered elsewhere in the deck, added from a user-curated
 * list spanning communication, thinking, daily life, movement, work/school,
 * social, cooking, business, and emotion categories.
 */
export const vocabVerbCards: StudyCard[] = [
  // Communication
  { id: 'vocab-verb-shoutaisuru', type: 'vocab', front: '招待する', reading: 'shoutai suru', back: 'to invite', jlpt: 'N3' },
  { id: 'vocab-verb-shoukaisuru', type: 'vocab', front: '紹介する', reading: 'shoukai suru', back: 'to introduce', jlpt: 'N4' },
  { id: 'vocab-verb-meireisuru', type: 'vocab', front: '命令する', reading: 'meirei suru', back: 'to order; to command', jlpt: 'N2' },
  { id: 'vocab-verb-yakusokusuru', type: 'vocab', front: '約束する', reading: 'yakusoku suru', back: 'to promise', jlpt: 'N4' },
  { id: 'vocab-verb-shitsumonsuru', type: 'vocab', front: '質問する', reading: 'shitsumon suru', back: 'to ask a question', jlpt: 'N4' },
  { id: 'vocab-verb-henjisuru', type: 'vocab', front: '返事する', reading: 'henji suru', back: 'to reply', jlpt: 'N4' },
  { id: 'vocab-verb-chuuisuru', type: 'vocab', front: '注意する', reading: 'chuui suru', back: 'to warn; to be careful', jlpt: 'N3' },
  { id: 'vocab-verb-sasou', type: 'vocab', front: '誘う', reading: 'sasou', back: 'to invite', jlpt: 'N3' },
  { id: 'vocab-verb-kyokasuru', type: 'vocab', front: '許可する', reading: 'kyoka suru', back: 'to permit; to allow', jlpt: 'N2' },
  { id: 'vocab-verb-kyohisuru', type: 'vocab', front: '拒否する', reading: 'kyohi suru', back: 'to reject; to refuse', jlpt: 'N2' },

  // Thinking / Mental
  { id: 'vocab-verb-souzousuru', type: 'vocab', front: '想像する', reading: 'souzou suru', back: 'to imagine', jlpt: 'N3' },
  { id: 'vocab-verb-utagau', type: 'vocab', front: '疑う', reading: 'utagau', back: 'to doubt', jlpt: 'N3' },
  { id: 'vocab-verb-nattokusuru', type: 'vocab', front: '納得する', reading: 'nattoku suru', back: 'to be convinced; to understand', jlpt: 'N2' },
  { id: 'vocab-verb-kitaisuru', type: 'vocab', front: '期待する', reading: 'kitai suru', back: 'to expect', jlpt: 'N3' },
  { id: 'vocab-verb-sonkeisuru', type: 'vocab', front: '尊敬する', reading: 'sonkei suru', back: 'to respect', jlpt: 'N3' },
  { id: 'vocab-verb-shinraisuru', type: 'vocab', front: '信頼する', reading: 'shinrai suru', back: 'to trust', jlpt: 'N2' },
  { id: 'vocab-verb-koukaisuru', type: 'vocab', front: '後悔する', reading: 'koukai suru', back: 'to regret', jlpt: 'N2' },
  { id: 'vocab-verb-shinpaisuru', type: 'vocab', front: '心配する', reading: 'shinpai suru', back: 'to worry', jlpt: 'N4' },
  { id: 'vocab-verb-hanseisuru', type: 'vocab', front: '反省する', reading: 'hansei suru', back: 'to reflect (on one’s conduct)', jlpt: 'N2' },
  { id: 'vocab-verb-handangatsuku', type: 'vocab', front: '判断がつく', reading: 'handan ga tsuku', back: 'to be able to judge', jlpt: 'N1' },

  // Daily life
  { id: 'vocab-verb-soujisuru', type: 'vocab', front: '掃除する', reading: 'souji suru', back: 'to clean', jlpt: 'N4' },
  { id: 'vocab-verb-shuurisuru', type: 'vocab', front: '修理する', reading: 'shuuri suru', back: 'to repair', jlpt: 'N3' },
  { id: 'vocab-verb-seirisuru', type: 'vocab', front: '整理する', reading: 'seiri suru', back: 'to organize; to sort out', jlpt: 'N3' },
  { id: 'vocab-verb-katazuku', type: 'vocab', front: '片づく', reading: 'かたづく', back: 'to be put away; to be tidied up', jlpt: 'N2' },
  { id: 'vocab-verb-kawaku', type: 'vocab', front: '乾く', reading: 'kawaku', back: 'to dry (intransitive)', jlpt: 'N3' },
  { id: 'vocab-verb-kawakasu', type: 'vocab', front: '乾かす', reading: 'kawakasu', back: 'to dry something', jlpt: 'N3' },
  { id: 'vocab-verb-tatamu', type: 'vocab', front: '畳む', reading: 'tatamu', back: 'to fold', jlpt: 'N2' },
  { id: 'vocab-verb-kaishisuru', type: 'vocab', front: '開始する', reading: 'kaishi suru', back: 'to start', jlpt: 'N3' },
  { id: 'vocab-verb-shuuryousuru', type: 'vocab', front: '終了する', reading: 'shuuryou suru', back: 'to finish; to end', jlpt: 'N3' },
  { id: 'vocab-verb-kesu', type: 'vocab', front: '消す', reading: 'kesu', back: 'to turn off; to erase', jlpt: 'N4' },
  { id: 'vocab-verb-tsukeru-switch', type: 'vocab', front: '点ける', reading: 'tsukeru', back: 'to turn on', jlpt: 'N4' },
  { id: 'vocab-verb-shimeru', type: 'vocab', front: '閉める', reading: 'shimeru', back: 'to close (transitive)', jlpt: 'N4' },
  { id: 'vocab-verb-tojiru', type: 'vocab', front: '閉じる', reading: 'tojiru', back: 'to close', jlpt: 'N3' },
  { id: 'vocab-verb-kowareru', type: 'vocab', front: '壊れる', reading: 'kowareru', back: 'to break (intransitive)', jlpt: 'N3' },
  { id: 'vocab-verb-kowasu', type: 'vocab', front: '壊す', reading: 'kowasu', back: 'to break (transitive)', jlpt: 'N3' },

  // Movement
  { id: 'vocab-verb-touchakusuru', type: 'vocab', front: '到着する', reading: 'touchaku suru', back: 'to arrive', jlpt: 'N4' },
  { id: 'vocab-verb-shuppatsusuru', type: 'vocab', front: '出発する', reading: 'shuppatsu suru', back: 'to depart', jlpt: 'N4' },
  { id: 'vocab-verb-hikkosu', type: 'vocab', front: '引っ越す', reading: 'hikkosu', back: 'to move house', jlpt: 'N3' },
  { id: 'vocab-verb-yoru', type: 'vocab', front: '寄る', reading: 'yoru', back: 'to stop by', jlpt: 'N3' },
  { id: 'vocab-verb-watasu', type: 'vocab', front: '渡す', reading: 'watasu', back: 'to hand over', jlpt: 'N4' },
  { id: 'vocab-verb-oriru', type: 'vocab', front: '降りる', reading: 'oriru', back: 'to get off', jlpt: 'N4' },
  { id: 'vocab-verb-noboru', type: 'vocab', front: '昇る', reading: 'noboru', back: 'to ascend', jlpt: 'N2' },
  { id: 'vocab-verb-shinnyuusuru', type: 'vocab', front: '進入する', reading: 'shinnyuu suru', back: 'to enter', jlpt: 'N1' },
  { id: 'vocab-verb-saru', type: 'vocab', front: '去る', reading: 'saru', back: 'to leave', jlpt: 'N2' },

  // Work / School
  { id: 'vocab-verb-teishutsusuru', type: 'vocab', front: '提出する', reading: 'teishutsu suru', back: 'to submit', jlpt: 'N3' },
  { id: 'vocab-verb-konseisuru', type: 'vocab', front: '完成する', reading: 'kansei suru', back: 'to complete', jlpt: 'N3' },
  { id: 'vocab-verb-insatsusuru', type: 'vocab', front: '印刷する', reading: 'insatsu suru', back: 'to print', jlpt: 'N3' },
  { id: 'vocab-verb-hozonsuru', type: 'vocab', front: '保存する', reading: 'hozon suru', back: 'to save', jlpt: 'N3' },
  { id: 'vocab-verb-henshuusuru', type: 'vocab', front: '編集する', reading: 'henshuu suru', back: 'to edit', jlpt: 'N2' },
  { id: 'vocab-verb-kanrisuru', type: 'vocab', front: '管理する', reading: 'kanri suru', back: 'to manage', jlpt: 'N3' },
  { id: 'vocab-verb-saiyousuru', type: 'vocab', front: '採用する', reading: 'saiyou suru', back: 'to hire', jlpt: 'N2' },
  { id: 'vocab-verb-yatou', type: 'vocab', front: '雇う', reading: 'yatou', back: 'to employ', jlpt: 'N2' },
  { id: 'vocab-verb-kaiketsusuru', type: 'vocab', front: '解決する', reading: 'kaiketsu suru', back: 'to solve', jlpt: 'N3' },
  { id: 'vocab-verb-kirokusuru', type: 'vocab', front: '記録する', reading: 'kiroku suru', back: 'to record', jlpt: 'N3' },

  // Social
  { id: 'vocab-verb-tazuneru', type: 'vocab', front: '訪ねる', reading: 'tazuneru', back: 'to visit', jlpt: 'N3' },
  { id: 'vocab-verb-houmonsuru', type: 'vocab', front: '訪問する', reading: 'houmon suru', back: 'to visit', jlpt: 'N3' },
  { id: 'vocab-verb-sewasuru', type: 'vocab', front: '世話する', reading: 'sewa suru', back: 'to take care of', jlpt: 'N3' },
  { id: 'vocab-verb-kyouryokusuru', type: 'vocab', front: '協力する', reading: 'kyouryoku suru', back: 'to cooperate', jlpt: 'N3' },
  { id: 'vocab-verb-ouensuru', type: 'vocab', front: '応援する', reading: 'ouen suru', back: 'to support; to cheer for', jlpt: 'N3' },
  { id: 'vocab-verb-sonchousuru', type: 'vocab', front: '尊重する', reading: 'sonchou suru', back: 'to respect (a value or opinion)', jlpt: 'N2' },
  { id: 'vocab-verb-hagemu', type: 'vocab', front: '励む', reading: 'hagemu', back: 'to work hard at', jlpt: 'N2' },

  // Cooking
  { id: 'vocab-verb-kizamu', type: 'vocab', front: '刻む', reading: 'kizamu', back: 'to chop', jlpt: 'N2' },
  { id: 'vocab-verb-muku', type: 'vocab', front: 'むく', reading: 'muku', back: 'to peel', jlpt: 'N2' },
  { id: 'vocab-verb-kiriwakeru', type: 'vocab', front: '切り分ける', reading: 'kiriwakeru', back: 'to cut into pieces', jlpt: 'N2' },
  { id: 'vocab-verb-sosogu', type: 'vocab', front: '注ぐ', reading: 'sosogu', back: 'to pour', jlpt: 'N2' },
  { id: 'vocab-verb-ajitsukesuru', type: 'vocab', front: '味付けする', reading: 'ajitsuke suru', back: 'to season', jlpt: 'N2' },
  { id: 'vocab-verb-atatameru', type: 'vocab', front: '温める', reading: 'atatameru', back: 'to heat up', jlpt: 'N3' },
  { id: 'vocab-verb-hiyasu', type: 'vocab', front: '冷やす', reading: 'hiyasu', back: 'to cool', jlpt: 'N3' },

  // Business / Formal
  { id: 'vocab-verb-shouninsuru', type: 'vocab', front: '承認する', reading: 'shounin suru', back: 'to approve', jlpt: 'N1' },
  { id: 'vocab-verb-keiyakusuru', type: 'vocab', front: '契約する', reading: 'keiyaku suru', back: 'to contract', jlpt: 'N2' },
  { id: 'vocab-verb-shinseisuru', type: 'vocab', front: '申請する', reading: 'shinsei suru', back: 'to apply', jlpt: 'N2' },
  { id: 'vocab-verb-teiansuru', type: 'vocab', front: '提案する', reading: 'teian suru', back: 'to propose', jlpt: 'N2' },
  { id: 'vocab-verb-renkeisuru', type: 'vocab', front: '連携する', reading: 'renkei suru', back: 'to coordinate', jlpt: 'N1' },
  { id: 'vocab-verb-kaisaisuru', type: 'vocab', front: '開催する', reading: 'kaisai suru', back: 'to hold (an event)', jlpt: 'N2' },
  { id: 'vocab-verb-jisshisuru', type: 'vocab', front: '実施する', reading: 'jisshi suru', back: 'to carry out', jlpt: 'N2' },
  { id: 'vocab-verb-happyousuru', type: 'vocab', front: '発表する', reading: 'happyou suru', back: 'to announce', jlpt: 'N3' },
  { id: 'vocab-verb-kaizensuru', type: 'vocab', front: '改善する', reading: 'kaizen suru', back: 'to improve', jlpt: 'N2' },
  { id: 'vocab-verb-kaisetsusuru', type: 'vocab', front: '解説する', reading: 'kaisetsu suru', back: 'to explain in detail', jlpt: 'N2' },

  // Emotion / State
  { id: 'vocab-verb-odorokaseru', type: 'vocab', front: '驚かせる', reading: 'odorokaseru', back: 'to surprise someone', jlpt: 'N3' },
  { id: 'vocab-verb-yorokobaseru', type: 'vocab', front: '喜ばせる', reading: 'yorokobaseru', back: 'to make someone happy', jlpt: 'N3' },
  { id: 'vocab-verb-anshinsuru', type: 'vocab', front: '安心する', reading: 'anshin suru', back: 'to feel relieved', jlpt: 'N3' },
  { id: 'vocab-verb-kinchousuru', type: 'vocab', front: '緊張する', reading: 'kinchou suru', back: 'to be nervous', jlpt: 'N3' },
  { id: 'vocab-verb-gakkarisuru', type: 'vocab', front: 'がっかりする', reading: 'gakkari suru', back: 'to be disappointed', jlpt: 'N3' },
  { id: 'vocab-verb-kandousuru', type: 'vocab', front: '感動する', reading: 'kandou suru', back: 'to be moved', jlpt: 'N3' },
  { id: 'vocab-verb-kanshasuru', type: 'vocab', front: '感謝する', reading: 'kansha suru', back: 'to be grateful', jlpt: 'N3' },
  { id: 'vocab-verb-manzokusuru', type: 'vocab', front: '満足する', reading: 'manzoku suru', back: 'to be satisfied', jlpt: 'N3' },
]
