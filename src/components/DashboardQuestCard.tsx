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

// The illustrated panel (/quest-art/featured-quest.jpg) bakes in the frame,
// art, and Continue frame while the transparent layers below keep the card tappable.

export function DashboardQuestCard({
  onContinueStudy,
  onOpenQuests,
}: DashboardQuestCardProps) {
  return (
    <section
      className="featured-quest"
      aria-label="Featured quest: Clinic Lane"
    >
      <img className="featured-quest-art" src="/quest-art/featured-quest.jpg" alt="" />

      <button
        type="button"
        className="featured-quest-open"
        onClick={onOpenQuests}
        aria-label="Open Clinic Lane"
      />

      <button
        type="button"
        className="featured-quest-cta"
        onClick={onContinueStudy}
        aria-label="Continue Clinic Lane"
      />
    </section>
  )
}
