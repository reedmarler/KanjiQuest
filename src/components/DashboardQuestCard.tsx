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
// Everything that tracks real progress — the region count, the trail nodes,
// the finial and the "steps left" line — is drawn live on top of a mask that
// hides the painted trail, so it stays true to the current quest.
const TRAIL_DOTS = Math.max(2, QUEST_STEPS.length - 2)

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
  const stepsLeft = QUEST_STEPS.length - stepsDone
  const questMinutes = Math.max(3, stepsLeft * 3)
  const arcQuests = QUESTS.filter((item) => item.arcId === quest.arcId)
  const arcCleared = arcQuests.filter((item) => isQuestComplete(questProgress, item.id)).length
  const dropLit = stepsDone >= QUEST_STEPS.length - 1

  const subtitle = complete
    ? 'Campaign complete'
    : `${stepsLeft === 1 ? '1 step left' : `${stepsLeft} steps left`} · ~${questMinutes} min`

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

      <div
        className="featured-quest-trail"
        role="img"
        aria-label={`${stepsDone} of ${QUEST_STEPS.length} steps done · ${arcCleared} of ${arcQuests.length} quests cleared in this region`}
      >
        <span className="featured-quest-count">{arcCleared}/{arcQuests.length}</span>
        <span className="featured-quest-line" />
        {Array.from({ length: TRAIL_DOTS }).map((_, index) => (
          <i
            key={index}
            className={`featured-quest-node${index < stepsDone ? ' is-done' : ''}`}
            style={{ left: `${31.7 + (index / (TRAIL_DOTS - 1)) * 37.7}%` }}
          />
        ))}
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
        aria-label={complete ? 'Replay a quest' : `Continue quest — ${subtitle}`}
      >
        <span className="featured-quest-cta-sub">{subtitle}</span>
      </button>
    </section>
  )
}
