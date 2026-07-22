import { grammarPracticeExercises } from '../data/grammarPractice'
import { ChoiceDrill } from './ChoiceDrill'

interface GrammarPracticeProps {
  onBack: () => void
}

export function GrammarPractice({ onBack }: GrammarPracticeProps) {
  return (
    <ChoiceDrill
      pool={grammarPracticeExercises}
      badgeLabel="Grammar"
      eyebrow="Choose the grammar that fits"
      finishMark="文法"
      finishTitle="Grammar practice complete"
      finishNoun="grammar choices"
      storagePrefix="kanji-quest-grammar-practice"
      onBack={onBack}
    />
  )
}
