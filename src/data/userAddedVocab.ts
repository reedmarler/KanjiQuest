import type { JlptLevel, StudyCard } from '../lib/types'
import rawUserAddedVocab from './userAddedVocab.json'

interface UserAddedVocabRecord {
  id: string
  front: string
  reading?: string
  back: string
  jlpt?: JlptLevel
}

/**
 * Vocabulary added through Content Studio → Vocabulary Editor ("Add to
 * database"). The dev-server endpoint (see vite.config.ts) writes these records
 * to userAddedVocab.json on disk, so they are permanent, version-controlled,
 * and shared across browsers/devices. Merged into `allCards` alongside the seed
 * vocabulary, which is what surfaces them in the study decks and Vocab List.
 */
export const userAddedVocabCards: StudyCard[] = (rawUserAddedVocab as UserAddedVocabRecord[]).map((record) => ({
  id: record.id,
  type: 'vocab',
  front: record.front,
  reading: record.reading,
  back: record.back,
  jlpt: record.jlpt,
}))
