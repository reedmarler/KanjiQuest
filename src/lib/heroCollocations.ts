import { heroObjectPhrase } from './heroVocabPhrases'
import type { HeroPhraseRole } from './heroPhraseRole'
import { roleFitsVerbObject } from './heroWordVerbFit'

export interface HeroWordCollocations {
  /** Predicate-ready English fragment (no leading "about") */
  roles: Partial<Record<HeroPhraseRole, string>>
  /** Topic-comment subject label, e.g. "Economics" */
  topic?: string
  /** Use "are" instead of "is" for topic-comment sentences */
  topicPlural?: boolean
}

const FOOD_RE =
  /pizza|sushi|ramen|coffee|tea|juice|milk|bread|cake|salad|lunch|burger|chocolate|fish|meat|rice|egg|vegetables|fruit|boxed lunch|hamburgers/
const PLACE_RE =
  /kyoto|tokyo|osaka|park|station|airport|school|office|hotel|restaurant|beach|classroom|bank|hospital|library|museum|zoo|shrine|harbor|island|town|village|market|garden|theater|aquarium|amusement|the (classroom|bank|hospital|library|zoo|harbor|market|garden|theater|office|station|airport|park|beach|bus|street)/
const MEDIA_RE =
  /movie|manga|book|music|anime|drama|radio|newspaper|magazine|novel|map|dictionary|letter|writing|literature|song|pictures|photos|dramas/
const PEOPLE_RE = /my (friend|teacher|sweetheart|parents)/
const ABSTRACT_RE =
  /politics|philosophy|society|economy|religion|architecture|industry|technology|research|education|international|exchange|art|civilization|concept|essence|theory|structure|insight|compromise|tendency|contradiction|responsibility|emotion|comparison|concentration|failure|competition|objectivity|discussion|condition|culture|history|grammar|vocabulary|pronunciation|tradition|experience|nature|scenery|customs|hobbies|talent|environment/
const ACTIVITY_RE =
  /travel|shopping|walk|golf|tennis|baseball|practice|games|math|science|conversation|studying abroad|spending time with family|cooking|sightseeing|memories/

/** Hand-reviewed collocations — overrides auto-derived phrases */
const MANUAL_COLLOCATIONS: Record<string, HeroWordCollocations> = {
  旅行: {
    roles: { like: 'to travel', want: 'to travel', fun: 'traveling', learnAbout: 'travel' },
    topic: 'Travel',
  },
  家族: {
    roles: { like: 'spending time with family' },
    topic: 'Family time',
  },
  文化: {
    roles: {
      like: 'learning about culture',
      study: 'culture',
      studyAbout: 'culture',
      learnAbout: 'culture',
      thinkAbout: 'culture',
      readAbout: 'culture',
      interest: 'culture',
      impression: 'culture',
    },
    topic: 'Culture',
  },
  歴史: {
    roles: {
      like: 'history',
      study: 'history',
      studyAbout: 'history',
      learnAbout: 'history',
      thinkAbout: 'history',
      readAbout: 'history',
      interest: 'history',
      impression: 'history',
      read: 'history books',
    },
    topic: 'History',
  },
  経済: {
    roles: {
      study: 'economics',
      studyAbout: 'economics',
      learnAbout: 'economics',
      thinkAbout: 'economics',
      readAbout: 'economics',
      interest: 'economics',
    },
    topic: 'Economics',
  },
  政治: {
    roles: {
      studyAbout: 'politics',
      learnAbout: 'politics',
      thinkAbout: 'politics',
      readAbout: 'politics',
      interest: 'politics',
      impression: 'politics',
    },
    topic: 'Politics',
  },
  社会: {
    roles: {
      studyAbout: 'society',
      learnAbout: 'society',
      thinkAbout: 'society',
      readAbout: 'society',
      interest: 'society',
    },
    topic: 'Society',
  },
  哲学: {
    roles: {
      study: 'philosophy',
      studyAbout: 'philosophy',
      learnAbout: 'philosophy',
      thinkAbout: 'philosophy',
      readAbout: 'philosophy',
      interest: 'philosophy',
      impression: 'philosophy',
    },
    topic: 'Philosophy',
  },
  文学: {
    roles: {
      study: 'literature',
      studyAbout: 'literature',
      learnAbout: 'literature',
      thinkAbout: 'literature',
      readAbout: 'literature',
      interest: 'literature',
      impression: 'literature',
      read: 'literature',
    },
    topic: 'Literature',
  },
  国際: {
    roles: {
      studyAbout: 'international relations',
      learnAbout: 'international relations',
      thinkAbout: 'international relations',
      readAbout: 'international relations',
      interest: 'international relations',
    },
    topic: 'International relations',
  },
  教育: {
    roles: {
      studyAbout: 'education',
      learnAbout: 'education',
      thinkAbout: 'education',
      interest: 'education',
    },
    topic: 'Education',
  },
  研究: {
    roles: {
      studyAbout: 'research',
      learnAbout: 'research',
      thinkAbout: 'research',
      interest: 'research',
      impression: 'research',
    },
    topic: 'Research',
  },
  技術: {
    roles: {
      studyAbout: 'technology',
      learnAbout: 'technology',
      thinkAbout: 'technology',
      interest: 'technology',
    },
    topic: 'Technology',
  },
  産業: {
    roles: {
      studyAbout: 'industry',
      learnAbout: 'industry',
      thinkAbout: 'industry',
      interest: 'industry',
    },
    topic: 'Industry',
  },
  芸術: {
    roles: {
      studyAbout: 'art',
      learnAbout: 'art',
      thinkAbout: 'art',
      interest: 'art',
      impression: 'art',
    },
    topic: 'Art',
  },
  宗教: {
    roles: {
      studyAbout: 'religion',
      learnAbout: 'religion',
      thinkAbout: 'religion',
      interest: 'religion',
    },
    topic: 'Religion',
  },
  交流: {
    roles: {
      learnAbout: 'cultural exchange',
      thinkAbout: 'cultural exchange',
      interest: 'cultural exchange',
    },
    topic: 'Cultural exchange',
  },
  建築: {
    roles: {
      studyAbout: 'architecture',
      learnAbout: 'architecture',
      interest: 'architecture',
      impression: 'architecture',
    },
    topic: 'Architecture',
  },
  日本語: {
    roles: {
      like: 'Japanese',
      study: 'Japanese',
      studyAbout: 'Japanese',
      learnAbout: 'Japanese',
      interest: 'Japanese',
      skillGood: 'Japanese',
      skillBad: 'Japanese',
      ability: 'Japanese',
      speak: 'Japanese',
      listen: 'Japanese music',
    },
    topic: 'Japanese',
  },
  漢字: {
    roles: {
      study: 'kanji',
      skillGood: 'kanji',
      skillBad: 'kanji',
      ability: 'kanji',
    },
    topic: 'Kanji',
  },
  数学: {
    roles: { study: 'math', studyAbout: 'math', learnAbout: 'math', interest: 'math' },
    topic: 'Math',
  },
  科学: {
    roles: { study: 'science', studyAbout: 'science', learnAbout: 'science', interest: 'science' },
    topic: 'Science',
  },
  料理: {
    roles: {
      like: 'cooking',
      make: 'food',
      skillGood: 'cooking',
      skillBad: 'cooking',
      ability: 'cooking',
    },
    topic: 'Cooking',
  },
  地図: { roles: { read: 'a map', buy: 'a map', use: 'a map' } },
  写真: { roles: { takePhoto: 'photos', read: 'photo books', watch: 'photos' } },
  小説: { roles: { read: 'novels', buy: 'novels' } },
  新聞: { roles: { read: 'the newspaper', buy: 'the newspaper' } },
  雑誌: { roles: { read: 'magazines', buy: 'magazines' } },
  漫画: { roles: { read: 'manga', watch: 'anime', buy: 'manga' } },
  本: { roles: { read: 'books', buy: 'books' } },
  映画: { roles: { watch: 'movies', buy: 'movies' } },
  ドラマ: { roles: { watch: 'dramas' } },
  アニメ: { roles: { watch: 'anime' } },
  デート: { roles: { go: 'on a date', want: 'to go on a date' } },
  海: { roles: { go: 'to the beach', like: 'the beach' } },
  留学: {
    roles: { learnAbout: 'studying abroad', interest: 'studying abroad' },
    topic: 'Studying abroad',
  },
  経験: {
    roles: { learnAbout: 'gaining experience', thinkAbout: 'experience' },
    topic: 'Experience',
  },
  環境: {
    roles: { learnAbout: 'the environment', thinkAbout: 'the environment', interest: 'the environment' },
    topic: 'The environment',
  },
  自然: {
    roles: { like: 'nature', learnAbout: 'nature', impression: 'nature' },
    topic: 'Nature',
  },
  伝統: {
    roles: { learnAbout: 'tradition', thinkAbout: 'tradition', interest: 'tradition' },
    topic: 'Tradition',
  },
  友達: { roles: { meet: 'my friend', wait: 'my friend' } },
  先生: { roles: { meet: 'my teacher', wait: 'my teacher' } },
  恋人: { roles: { meet: 'my sweetheart', wait: 'my sweetheart' } },
  両親: { roles: { meet: 'my parents', wait: 'my parents' } },
  車: { roles: { want: 'a car', use: 'a car' } },
  電車: { roles: { use: 'the train', go: 'by train' } },
  // N2 core vocabulary
  妥協: {
    roles: { thinkAbout: 'compromise', learnAbout: 'compromise' },
    topic: 'Compromise',
  },
  傾向: {
    roles: { thinkAbout: 'trends', learnAbout: 'trends' },
    topic: 'Trends',
    topicPlural: true,
  },
  矛盾: {
    roles: { thinkAbout: 'contradictions', learnAbout: 'contradictions' },
    topic: 'Contradictions',
    topicPlural: true,
  },
  概念: {
    roles: { studyAbout: 'concepts', learnAbout: 'concepts', thinkAbout: 'concepts' },
    topic: 'Concepts',
    topicPlural: true,
  },
  本質: {
    roles: {
      studyAbout: 'the nature of things',
      thinkAbout: 'what things are really about',
      learnAbout: 'the essence of things',
    },
    topic: 'Essence',
  },
  責任: {
    roles: { thinkAbout: 'responsibility', learnAbout: 'responsibility' },
    topic: 'Responsibility',
  },
  感情: {
    roles: { thinkAbout: 'emotions', learnAbout: 'emotions' },
    topic: 'Emotions',
    topicPlural: true,
  },
  比較: {
    roles: { thinkAbout: 'comparison', learnAbout: 'comparison' },
    topic: 'Comparison',
  },
  集中: {
    roles: { thinkAbout: 'focus', learnAbout: 'staying focused' },
    topic: 'Focus',
  },
  失敗: {
    roles: { thinkAbout: 'failure', learnAbout: 'failure' },
    topic: 'Failure',
  },
  競争: {
    roles: { thinkAbout: 'competition', learnAbout: 'competition' },
    topic: 'Competition',
  },
  条件: {
    roles: { thinkAbout: 'conditions', learnAbout: 'conditions' },
    topic: 'Conditions',
    topicPlural: true,
  },
  客観: {
    roles: { thinkAbout: 'objectivity', learnAbout: 'objectivity' },
    topic: 'Objectivity',
  },
  協議: {
    roles: { thinkAbout: 'negotiations', learnAbout: 'negotiations' },
    topic: 'Negotiations',
    topicPlural: true,
  },
  適応: {
    roles: { thinkAbout: 'adaptation', learnAbout: 'adaptation' },
    topic: 'Adaptation',
  },
  依存: {
    roles: { thinkAbout: 'dependence', learnAbout: 'dependence' },
    topic: 'Dependence',
  },
  寛容: {
    roles: { thinkAbout: 'tolerance', learnAbout: 'tolerance' },
    topic: 'Tolerance',
  },
  郷愁: {
    roles: { thinkAbout: 'nostalgia', learnAbout: 'nostalgia', impression: 'nostalgia' },
    topic: 'Nostalgia',
  },
  仕事: {
    roles: { interest: 'work', learnAbout: 'work', thinkAbout: 'work' },
    topic: 'Work',
  },
  健康: {
    roles: { thinkAbout: 'health', interest: 'health' },
    topic: 'Health',
  },
  温泉: { roles: { go: 'hot springs', like: 'hot springs' } },
  神社: { roles: { go: 'shrines', like: 'shrines' } },
}

function stripArticle(gloss: string): string {
  return gloss.replace(/^the /, '').replace(/^a /, '').replace(/^an /, '')
}

function normalizeHeroGloss(gloss: string): string {
  return gloss
    .split(';')[0]
    ?.split('/')[0]
    ?.trim()
    .replace(/^(n\.|v\.|p\.|aux\.|cp\.|i-adj\.|adj\.|na-adj\.|adv\.|conj\.|interj\.|pron\.|disc\.|adn\.)\s*/i, '')
    .replace(/^to\s+/i, '')
    .trim()
    .toLowerCase()
}

function isUnusableHeroGloss(g: string): boolean {
  if (!g || g.length < 2) return true
  return /^(case |conj\.|disc\.|copula|polite|assertion|passive|not |question|reason |end up )/i.test(g)
}

function topicFromGloss(gloss: string): string {
  const bare = stripArticle(gloss)
  return bare.charAt(0).toUpperCase() + bare.slice(1)
}

function deriveCollocations(word: string, gloss: string): HeroWordCollocations | null {
  const g = normalizeHeroGloss(gloss)
  if (isUnusableHeroGloss(g)) return null

  const roles: Partial<Record<HeroPhraseRole, string>> = {}
  const topic = topicFromGloss(g)
  const bare = stripArticle(g)

  if (FOOD_RE.test(g)) {
    roles.like = g
    roles.eat = g
    roles.want = g
    roles.buy = g
    roles.make = g
    roles.drink = /coffee|tea|juice|milk/.test(g) ? g : undefined
    return { roles, topic }
  }

  if (PLACE_RE.test(g) || ['kyoto', 'tokyo', 'osaka'].includes(g)) {
    roles.go = g.startsWith('the ') || /^[A-Z]/.test(gloss) ? g : `the ${bare}`
    roles.like = roles.go
    roles.eatAt = roles.go
    roles.learnAbout = bare
    roles.interest = bare
    return { roles, topic }
  }

  if (PEOPLE_RE.test(g) || ['友達', '先生', '恋人', '両親'].includes(word)) {
    roles.meet = g
    roles.wait = g
    return { roles, topic }
  }

  if (MEDIA_RE.test(g)) {
    roles.like = g
    const readOnly =
      /novel|magazine|newspaper|literature|writing|letter|dictionary|book|grammar|vocabulary|history|philosophy|economics|politics|comic|manga/i.test(
        g,
      )
    const watchOnly =
      /movie|drama|anime|television|photo|picture|baseball|tennis|golf|film/i.test(g)
    const musicOnly = /music|radio|song/i.test(g)

    if (readOnly || (!watchOnly && !musicOnly)) roles.read = g
    if (watchOnly) roles.watch = g
    if (musicOnly) roles.listen = g.includes('music') ? g : `to ${g}`
    if (/manga|comic/i.test(g)) roles.watch = g
    roles.buy = g
    if (!watchOnly) {
      roles.study = bare
      roles.studyAbout = bare
      roles.learnAbout = bare
    }
    roles.impression = g
    return { roles, topic }
  }

  if (ACTIVITY_RE.test(g)) {
    roles.like = g
    roles.fun = g
    roles.activity = g
    roles.learnAbout = bare
    roles.interest = bare
    if (g === 'traveling' || g === 'travel') {
      roles.like = 'to travel'
      roles.want = 'to travel'
    }
    return { roles, topic }
  }

  if (ABSTRACT_RE.test(g)) {
    roles.studyAbout = bare
    roles.learnAbout = bare
    roles.thinkAbout = bare
    roles.readAbout = bare
    roles.interest = bare
    roles.impression = bare
    if (/philosophy|literature|history|culture|math|science|japanese|kanji|grammar|economics|politics/.test(g)) {
      roles.study = bare
    }
    return { roles, topic }
  }

  if (g.startsWith('a ') || g.startsWith('the ')) {
    roles.want = g
    roles.buy = g
    roles.use = g
    return { roles, topic }
  }

  // Single concrete nouns
  if (word.length <= 4) {
    roles.like = g
    roles.want = `a ${bare}`
    roles.interest = bare
    roles.learnAbout = bare
    return { roles, topic }
  }

  // Generic content words from auto-generated vocabulary glosses
  roles.like = g
  roles.interest = bare
  roles.learnAbout = bare
  roles.thinkAbout = bare
  roles.studyAbout = bare
  roles.impression = g
  if (g.includes(' ')) {
    roles.like = bare
  }
  return { roles, topic }
}

const collocationCache = new Map<string, HeroWordCollocations | null>()

function mergeCollocations(
  manual: HeroWordCollocations | undefined,
  derived: HeroWordCollocations | null,
): HeroWordCollocations | null {
  if (!manual && !derived) return null
  return {
    roles: { ...derived?.roles, ...manual?.roles },
    topic: manual?.topic ?? derived?.topic,
    topicPlural: manual?.topicPlural ?? derived?.topicPlural,
  }
}

export function getHeroCollocations(word: string): HeroWordCollocations | null {
  if (collocationCache.has(word)) return collocationCache.get(word) ?? null

  const gloss = heroObjectPhrase(word)
  const manual = MANUAL_COLLOCATIONS[word]
  const derived = gloss ? deriveCollocations(word, gloss) : null
  const merged = mergeCollocations(manual, derived)

  collocationCache.set(word, merged)
  return merged
}

export function getHeroCollocation(word: string, role: HeroPhraseRole): string | undefined {
  const entry = getHeroCollocations(word)
  if (!entry) return undefined
  return entry.roles[role]
}

export function hasHeroCollocation(word: string, role: HeroPhraseRole): boolean {
  if (!getHeroCollocation(word, role)) return false
  return roleFitsVerbObject(word, role)
}

export function hasAnyHeroCollocation(word: string): boolean {
  const entry = getHeroCollocations(word)
  if (!entry) return false
  return Object.keys(entry.roles).length > 0 || Boolean(entry.topic)
}

export function heroTopicLabel(word: string): { label: string; plural: boolean } | null {
  const entry = getHeroCollocations(word)
  if (!entry?.topic) return null
  return { label: entry.topic, plural: entry.topicPlural ?? false }
}
