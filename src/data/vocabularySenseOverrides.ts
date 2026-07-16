import type { StudyCard } from '../lib/types'
import { getImportedVocabularyMetadata } from './vocabularyMetadata.generated'
import type { ImportedVocabularyCategory } from './vocabularyMetadata.generated'

export interface VocabularySenseMetadata {
  category: ImportedVocabularyCategory
  tags: readonly string[]
}

/**
 * Reading-specific corrections for written forms whose unrelated senses were
 * collapsed by the spreadsheet's Japanese-only key.
 */
const SENSE_METADATA: Record<string,VocabularySenseMetadata> = {
  '表|omote': { category:'Places', tags:['Front','Surface','Exterior','RelativeLocation','Noun'] },
  '表|hyou': { category:'Objects', tags:['Table','Chart','Document','Noun'] },
  '人気|ninki': { category:'Objects', tags:['Popularity','Reputation','Abstract','Noun'] },
  '人気|hitoke': { category:'Objects', tags:['HumanPresence','SignOfPeople','Abstract','Noun'] },
  '身|mi': { category:'Objects', tags:['Body','BodyPart','Self','Noun'] },
  '体|karada': { category:'Objects', tags:['Body','BodyPart','Health','Noun'] },
  '方|kata': { category:'Function Words', tags:['PersonReference','Polite','Respectful','Noun','RequiresModifier'] },
  '方|hou': { category:'Places', tags:['Direction','Side','Alternative','RelativeLocation','Noun'] },
  '〜方|kata': { category:'Function Words', tags:['Method','WayOfDoing','NounSuffix','Expression'] },
  '者|mono': { category:'Function Words', tags:['PersonReference','Noun','RequiresModifier'] },
}

// These words have one generator-safe classification regardless of whether
// their stored reading is romaji or kana. 家庭 is an abstract household, not a
// place one travels to; 通り is a street noun, not the grammar sense "as / in
// accordance with" found first in some dictionary entries.
const WORD_METADATA: Record<string,VocabularySenseMetadata> = {
  '家庭': { category:'Objects', tags:['Household','Family','Abstract','Noun'] },
  '通り': { category:'Places', tags:['Street','Road','Route','Urban','Noun'] },
}

function senseKey(word: string, reading?: string) {
  return `${word.trim()}|${reading?.trim().toLowerCase() ?? ''}`
}

export function getVocabularyMetadata(word: string, reading?: string): VocabularySenseMetadata | undefined {
  const metadata = SENSE_METADATA[senseKey(word,reading)] ?? WORD_METADATA[word.trim()] ?? getImportedVocabularyMetadata(word)
  if (!metadata) return undefined
  if (metadata.tags.some(tag => tag.replace(/[-_\s]/g,'').toLowerCase() === 'bodypart')) return { ...metadata, category:'Objects' }
  return metadata
}

export const additionalVocabularySenseCards: StudyCard[] = [
  { id:'vocab-sense-omote-hyou', type:'vocab', front:'表', reading:'hyou', back:'table / chart', jlpt:'N3', hint:'Separate from 表（omote）: front or surface' },
  { id:'vocab-sense-ninki-hitoke', type:'vocab', front:'人気', reading:'hitoke', back:'human presence / sign of people', jlpt:'N1', hint:'Separate from 人気（ninki）: popularity' },
  { id:'vocab-sense-kata-hou', type:'vocab', front:'方', reading:'hou', back:'direction / side / alternative', jlpt:'N4', hint:'Separate from 方（kata）: person (polite)' },
  { id:'vocab-sense-kata-method', type:'vocab', front:'〜方', reading:'kata', back:'way of doing / how to', jlpt:'N4', hint:'Attach to a verb stem: 読み方' },
]
