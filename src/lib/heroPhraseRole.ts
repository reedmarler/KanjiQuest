import type { HeroTemplate } from '../data/heroSentences'
import { isTopicCommentTemplate } from '../data/heroSentences'

/** How a vocab word slots into a hero sentence template */
export type HeroPhraseRole =
  | 'like'
  | 'want'
  | 'eat'
  | 'drink'
  | 'read'
  | 'go'
  | 'watch'
  | 'buy'
  | 'make'
  | 'listen'
  | 'study'
  | 'studyAbout'
  | 'learnAbout'
  | 'thinkAbout'
  | 'readAbout'
  | 'interest'
  | 'topic'
  | 'impression'
  | 'fun'
  | 'skillGood'
  | 'skillBad'
  | 'ability'
  | 'activity'
  | 'eatAt'
  | 'meet'
  | 'wait'
  | 'use'
  | 'speak'
  | 'takePhoto'

export function roleForTemplate(template: HeroTemplate): HeroPhraseRole | null {
  const { predicate, objectParticle } = template

  if (isTopicCommentTemplate(template)) {
    if (predicate === '重要です' || predicate === '難しいです' || predicate === '変化しています') {
      return 'topic'
    }
    if (predicate === '面白いです') return 'impression'
    return null
  }

  if (predicate === '好きです') return 'like'
  if (predicate === '欲しいです') return 'want'
  if (predicate === '食べます' || predicate === '食べたいです') {
    return objectParticle === 'で' ? 'eatAt' : 'eat'
  }
  if (predicate === '飲みます') return 'drink'
  if (predicate === '飲みました' || predicate === '飲みたいです') return 'drink'
  if (predicate === '読みます') {
    return objectParticle === 'について' ? 'readAbout' : 'read'
  }
  if (predicate === '読みました' || predicate === '読みたいです') return 'read'
  if (predicate === '行きます' || predicate === '行きたいです') return 'go'
  if (predicate === '行きました') return 'go'
  if (predicate === '見ます' || predicate === '見たいです') return 'watch'
  if (predicate === '見ました') return 'watch'
  if (predicate === '買います' || predicate === '買いたいです') return 'buy'
  if (predicate === '買いました') return 'buy'
  if (predicate === '作ります') return 'make'
  if (predicate === '作りました' || predicate === '作りたいです') return 'make'
  if (predicate === '聞きます') return 'listen'
  if (predicate === '聞きました' || predicate === '聞きたいです') return 'listen'
  if (predicate === '勉強します') {
    return objectParticle === 'について' ? 'studyAbout' : 'study'
  }
  if (predicate === '勉強しました') return 'study'
  if (predicate === '知りたいです') return 'learnAbout'
  if (predicate === '興味があります') return 'interest'
  if (predicate === '考えます') return 'thinkAbout'
  if (predicate === '面白いです') return 'impression'
  if (predicate === '楽しいです') return 'fun'
  if (predicate === '上手です') return 'skillGood'
  if (predicate === '下手です') return 'skillBad'
  if (predicate === 'できます') return 'ability'
  if (predicate === 'します') return 'activity'
  if (predicate === '会います') return 'meet'
  if (predicate === '会いました' || predicate === '会いたいです') return 'meet'
  if (predicate === '待ちます') return 'wait'
  if (predicate === '待ちました') return 'wait'
  if (predicate === '使います') return 'use'
  if (predicate === '話します') return 'speak'
  if (predicate === '撮ります') return 'takePhoto'
  if (predicate === '撮りたいです') return 'takePhoto'
  if (predicate === '借ります' || predicate === '借りました') return 'read'

  if (predicate === '見に行きます') return 'watch'
  if (predicate === '借りに行きます') return 'read'
  if (predicate === '大切だと思います' || predicate === '難しいと思います' || predicate === '面白いと思います') {
    return 'thinkAbout'
  }
  if (predicate === '食べたいと思います' || predicate === '行きたいと思います') return 'want'
  if (predicate === '話せるようになりたいです' || predicate === '読めるようになりたいです') return 'ability'
  if (predicate === '勉強し続けています') return 'study'
  if (predicate === '復習しなければなりません') return 'study'
  if (predicate === '経験があります') return 'interest'

  if (predicate === '食べました') return 'eat'
  if (predicate === '飲みました') return 'drink'
  if (predicate === '行きました') return 'go'
  if (predicate === '読みました') return 'read'
  if (predicate === '見ました') return 'watch'
  if (predicate === '借りました') return 'read'
  if (predicate === '電話しました') return 'meet'
  if (predicate === '楽しかったです') return 'fun'
  if (predicate === 'もっと勉強したいです') return 'study'
  if (predicate === 'よく行きます') return 'go'
  if (predicate === 'よく読みます') return 'read'
  if (predicate === '毎日練習しています') return 'study'
  if (predicate === '毎日勉強しています') return 'study'
  if (predicate === '一度行きたいです') return 'go'
  if (predicate === 'もっと考えたいです') return 'thinkAbout'

  return null
}
