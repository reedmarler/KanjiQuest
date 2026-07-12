export type KanjiLabMode =
  | 'learn'
  | 'recognize'
  | 'read'
  | 'recall'
  | 'breakdown'
  | 'context'
  | 'mixed'

export interface KanjiRadical {
  char: string
  meaning: string
}

export interface KanjiCompound {
  word: string
  reading: string
  meaning: string
}

export interface KanjiDetail {
  id: string
  radicals: KanjiRadical[]
  mnemonic: string
  compounds: KanjiCompound[]
  onyomi: string[]
  kunyomi: string[]
  contextSentence?: string
  contextReading?: string
}

export interface KanjiLabSession {
  cards: import('./types').StudyCard[]
  modes: KanjiLabMode[]
}

export const KANJI_MODE_INFO: Record<
  Exclude<KanjiLabMode, 'mixed'>,
  { label: string; emoji: string; description: string }
> = {
  learn: {
    label: 'Learn',
    emoji: '📖',
    description: 'See radicals, mnemonics, and example words before quizzing',
  },
  recognize: {
    label: 'Recognize',
    emoji: '👁',
    description: 'See the kanji — pick the meaning',
  },
  read: {
    label: 'Read',
    emoji: '🔊',
    description: 'See the kanji — pick the correct reading',
  },
  recall: {
    label: 'Recall',
    emoji: '🧠',
    description: 'See the meaning — pick the kanji',
  },
  breakdown: {
    label: 'Breakdown',
    emoji: '🧩',
    description: 'Study the parts, then recall the meaning',
  },
  context: {
    label: 'In Context',
    emoji: '📝',
    description: 'See a real word — pick how the kanji is read',
  },
}

export const JLPT_LEVELS = ['All', 'N5', 'N4', 'N3', 'N2', 'N1'] as const
export type JlptFilter = (typeof JLPT_LEVELS)[number]
