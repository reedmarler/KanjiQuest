import type { QuestProgress } from '../lib/questProgress'

type DashboardQuestCardProps = {
  questProgress: QuestProgress
  progressPct: number
  questsCleared: number
  wrongCount: number
  onContinueStudy: () => void
  onOpenQuests: () => void
  onOpenStudyTools: () => void
}

export function DashboardQuestCard({ onOpenQuests }: DashboardQuestCardProps) {
  return (
    <section className="featured-quest" aria-label="Quests">
      <h2 className="featured-quest-title">Quests</h2>
      <button type="button" className="featured-quest-cta" onClick={onOpenQuests}>Open quests</button>
    </section>
  )
}
