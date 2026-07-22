import { vocabPracticeExercises } from '../data/vocabPractice'
import { ChoiceDrill } from './ChoiceDrill'

interface VocabPracticeProps {
  onBack: () => void
}

export function VocabPractice({ onBack }: VocabPracticeProps) {
  return (
    <ChoiceDrill
      pool={vocabPracticeExercises}
      badgeLabel="Vocab"
      eyebrow="Choose the word that fits"
      finishMark="語"
      finishTitle="Vocab practice complete"
      finishNoun="word choices"
      storagePrefix="kanji-quest-vocab-practice"
      onBack={onBack}
    />
  )
}
