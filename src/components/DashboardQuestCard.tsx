import { useMemo } from 'react'
import { QUESTS } from '../data/questCampaign'
import {
  isQuestComplete,
  type QuestProgress,
} from '../lib/questProgress'

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
  questProgress,
  onContinueStudy,
  onOpenQuests,
}: DashboardQuestCardProps) {
  const nextQuest = useMemo(
    () => QUESTS.find((quest) => !isQuestComplete(questProgress, quest.id)),
    [questProgress],
  )

  const complete = !nextQuest
  const quest = nextQuest ?? QUESTS[QUESTS.length - 1]!

  return (
    <section
      className="featured-quest"
      aria-label={complete ? 'Campaign complete' : `Featured quest: ${quest.title}`}
    >
      <img className="featured-quest-art" src="/quest-art/featured-quest.jpg" alt="" />

      <button
        type="button"
        className="featured-quest-open"
        onClick={onOpenQuests}
        aria-label={complete ? 'Open the campaign map' : `Open quest ${quest.number}: ${quest.title}`}
      />

      <button
        type="button"
        className="featured-quest-cta"
        onClick={onContinueStudy}
        aria-label={complete ? 'Replay a quest' : 'Continue quest'}
      />
    </section>
  )
}
