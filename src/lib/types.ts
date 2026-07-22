export type CardType = 'hiragana' | 'katakana' | 'vocab' | 'kanji' | 'reading' | 'grammar'

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export interface StudyCard {
  id: string
  type: CardType
  front: string
  reading?: string
  back: string
  hint?: string
  /** Full sentence or card English translation (reading quiz, etc.) */
  english?: string
  jlpt?: JlptLevel
  sentence?: string
  highlight?: string
  distractors?: string[]
}

export interface CardProgress {
  id: string
  easeFactor: number
  interval: number
  repetitions: number
  nextReview: number
  lastReviewed: number
  correct: number
  incorrect: number
}

export interface AppStats {
  streak: number
  lastStudyDate: string | null
  totalReviews: number
  cardsLearned: number
}

export type StudyMode = 'hiragana' | 'katakana' | 'vocab' | 'kanji' | 'reading' | 'grammar' | 'review'
