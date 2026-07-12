import type { HeroSentenceFrame, HeroTemplate } from '../data/heroSentences'
import { HERO_TEMPLATES } from '../data/heroSentences'
import { getHeroCollocation, hasHeroCollocation, heroTopicLabel } from './heroCollocations'
import { findMasuVerbBase } from './heroPredicateConjugation'
import { naturalVerbObject, wordFitsPredicate } from './heroWordVerbFit'
import { heroObjectPhrase } from './heroVocabPhrases'
import { roleForTemplate } from './heroPhraseRole'
import { wordAllowedForTemplate } from './heroSentenceNatural'

export { HERO_OBJECT_PHRASES } from './heroVocabPhrases'

export function wordFitsTemplate(
  word: string,
  template: HeroTemplate,
  frame?: HeroSentenceFrame,
): boolean {
  if (!wordAllowedForTemplate(word, template)) return false
  const role = roleForTemplate(template)
  if (!role) return false
  if (role === 'topic') return Boolean(heroTopicLabel(word))
  if (!hasHeroCollocation(word, role)) return false

  const predicate = frame?.predicate ?? template.predicate
  const particle = frame?.objectParticle ?? template.objectParticle
  const modifier = frame?.modifier ?? template.modifier ?? ''
  return wordFitsPredicate(word, predicate, particle, modifier)
}

/** Natural English object phrase for the hero sentence */
export function formatHeroObject(word: string, frame: HeroSentenceFrame): string {
  const role = roleForFrame(frame)
  if (role === 'topic') {
    const topic = heroTopicLabel(word)
    return topic?.label ?? word
  }
  if (role) {
    const phrase = getHeroCollocation(word, role)
    if (phrase) return phrase
  }

  const phrase = heroObjectPhrase(word) ?? word
  const { predicate, objectParticle } = frame

  if (predicate === '会います' || predicate === '待ちます') {
    if (word === '友達') return 'my friend'
    if (word === '先生') return 'my teacher'
    if (word === '恋人') return 'my sweetheart'
    if (word === '両親') return 'my parents'
  }

  if (predicate === '電話しました') {
    if (word === '友達') return 'my friend'
    if (word === '先生') return 'my teacher'
    if (word === '恋人') return 'my sweetheart'
    if (word === '両親') return 'my parents'
  }

  if (predicate === '話します' && word === '日本語') return 'Japanese'

  if (predicate === 'できます') {
    if (word === '日本語') return 'Japanese'
    if (word === '漢字') return 'kanji'
    if (word === '料理') return 'cooking'
  }

  if (predicate === '撮ります' && word === '写真') return 'pictures'

  if (predicate === '使います') {
    if (word === '車') return 'a car'
    if (word === '電車') return 'the train'
  }

  if (objectParticle === 'について' && predicate === '勉強します') {
    return phrase
  }

  if (objectParticle === 'について' && predicate === '考えます') {
    return phrase
  }

  if (objectParticle === 'について' && predicate === '読みます') {
    return phrase
  }

  if (objectParticle === 'で' && predicate === '食べます') {
    if (phrase.startsWith('the ')) return phrase
    if (['school', 'Kyoto', 'Tokyo', 'Osaka'].includes(phrase)) return phrase
    return `the ${phrase}`
  }

  return phrase
}

/** English object phrase for gloss + inline word swaps — verb-aware */
export function formatHeroEnglishObject(frame: HeroSentenceFrame): string {
  const raw = formatHeroObject(frame.word, frame)
  const base = findMasuVerbBase(frame.predicate)
  if (!base) return raw
  return naturalVerbObject(frame.word, base, raw)
}

export function templateFamily(template: HeroTemplate): string {
  const { predicate, objectParticle, prefix, bridge } = template
  if (prefix) {
    if (
      prefix.includes('もし')
      || prefix.includes('ば')
      || prefix.includes('たら')
      || prefix.includes('ければ')
    ) {
      return 'conditional'
    }
    if (prefix.includes('ので')) return 'multi-clause'
    if (prefix === '昨日' || prefix === '今朝' || prefix === '先週' || prefix === '週末') {
      return 'past'
    }
  }
  if (bridge?.includes('であり')) return 'formal'
  if (bridge) return 'multi-clause'
  if (template.modifier?.includes('ながら') || template.modifier?.includes('てから')) {
    return 'multi-clause'
  }
  if (predicate === '好きです') return 'preference'
  if (predicate === '欲しいです') return 'desire'
  if (predicate === '重要です' || predicate === '難しいです' || predicate === '変化しています') return 'topic'
  if (predicate === '興味があります') return 'interest'
  if (predicate === '考えます') return 'think'
  if (predicate === '食べます' || predicate === '食べたいです') return 'eat'
  if (predicate === '飲みます') return 'drink'
  if (predicate === '読みます') return 'read'
  if (predicate === '行きます' || predicate === '行きたいです') return 'go'
  if (predicate === '見ます' || predicate === '見たいです') return 'watch'
  if (predicate === '買います' || predicate === '買いたいです') return 'buy'
  if (predicate === '作ります') return 'make'
  if (predicate === '聞きます') return 'listen'
  if (predicate === '勉強します') return 'study'
  if (predicate === '知りたいです') return 'learn'
  if (predicate === 'できます') return 'ability'
  if (predicate === 'します') return 'activity'
  if (predicate === '面白いです' || predicate === '楽しいです') return 'impression'
  if (predicate === '上手です' || predicate === '下手です') return 'skill'
  if (predicate === '撮ります') return 'photo'
  if (predicate === '会います') return 'meet'
  if (predicate === '話します') return 'speak'
  if (predicate === '待ちます') return 'wait'
  if (predicate === '使います') return 'use'
  if (objectParticle === 'で' && predicate === '食べます') return 'eat-at'
  if (predicate === '見に行きます' || predicate === '借りに行きます') return 'purpose'
  if (predicate === '大切だと思います' || predicate === '難しいと思います' || predicate === '面白いと思います') {
    return 'opinion'
  }
  if (predicate === '食べたいと思います' || predicate === '行きたいと思います') return 'wish-think'
  if (predicate === '話せるようになりたいです' || predicate === '読めるようになりたいです') return 'become-able'
  if (predicate === '勉強し続けています') return 'continue'
  if (predicate === '復習しなければなりません') return 'necessity'
  if (predicate === '経験があります') return 'experience'
  if (predicate === '食べました' || predicate === '飲みました' || predicate === '行きました'
    || predicate === '読みました' || predicate === '見ました' || predicate === '借りました'
    || predicate === '電話しました' || predicate === '楽しかったです') {
    return 'past'
  }
  if (predicate === 'もっと勉強したいです' || predicate === 'よく行きます'
    || predicate === '毎日練習しています' || predicate === 'よく読みます'
    || predicate === '毎日勉強しています' || predicate === '一度行きたいです'
    || predicate === 'もっと考えたいです') {
    return 'multi-clause'
  }
  if (template.modifier === '電車で' || template.modifier === 'バスで') return 'transport'
  return predicate
}

export function findTemplatesForWord(word: string): HeroTemplate[] {
  return HERO_TEMPLATES.filter((t) => wordFitsTemplate(word, t))
}

function roleForFrame(frame: HeroSentenceFrame) {
  const base = findMasuVerbBase(frame.predicate)
  const predicate = base === '借ります'
    ? '借りました'
    : (base ?? frame.predicate)

  return roleForTemplate({
    id: '',
    objectParticle: frame.objectParticle,
    predicate,
    wordLength: 0,
    words: [],
    topicComment: !frame.subject && frame.objectParticle === 'は',
  })
}
