import { useMemo } from 'react'
import { QUESTS } from '../data/questCampaign'
import {
  completedQuestSteps,
  isQuestComplete,
  QUEST_STEPS,
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
// art, "FEATURED QUEST", the quest symbol and title, and the Continue frame.
// The raindrop finial is still drawn live so it can respond to quest progress,
// while the dashboard keeps the rest of the panel visually clean.

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
  const stepsDone = complete ? QUEST_STEPS.length : completedQuestSteps(questProgress, quest.id)
  const dropLit = stepsDone >= QUEST_STEPS.length - 1

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

      <div className="featured-quest-trail" aria-hidden="true">
        <span className={`featured-quest-drop${dropLit ? ' is-lit' : ''}`}>
          <svg viewBox="0 0 24 30" aria-hidden="true">
            <path d="M12 1C12 1 3.5 14 3.5 19.5A8.5 8.5 0 0 0 20.5 19.5C20.5 14 12 1 12 1Z" />
            <ellipse cx="9.4" cy="20.4" rx="2.3" ry="3.3" />
          </svg>
        </span>
      </div>

      <button
        type="button"
        className="featured-quest-cta"
        onClick={onContinueStudy}
        aria-label={complete ? 'Replay a quest' : 'Continue quest'}
      />
    </section>
  )
}
