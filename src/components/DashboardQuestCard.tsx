import { useMemo, type CSSProperties } from 'react'
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

/** The angular brackets that dress each corner of the gold frame. */
function FrameCorners() {
  return (
    <>
      <span className="featured-quest-corner featured-quest-corner-tl" aria-hidden="true" />
      <span className="featured-quest-corner featured-quest-corner-tr" aria-hidden="true" />
      <span className="featured-quest-corner featured-quest-corner-bl" aria-hidden="true" />
      <span className="featured-quest-corner featured-quest-corner-br" aria-hidden="true" />
    </>
  )
}

/**
 * The home page's featured-quest hero: a framed still from the next quest's
 * own art, a trail showing how far through its five steps you are, and one
 * Continue button. Falls back to a themed wash when the art file is absent.
 */
export function DashboardQuestCard({
  questProgress,
  onContinueStudy,
  onOpenQuests,
}: DashboardQuestCardProps) {
  const nextQuest = useMemo(
    () => QUESTS.find((quest) => !isQuestComplete(questProgress, quest.id)),
    [questProgress],
  )

  if (!nextQuest) {
    return (
      <section className="featured-quest is-complete" data-arc="done" aria-label="Campaign complete">
        <div className="featured-quest-frame">
          <span className="featured-quest-bg" aria-hidden="true" />
          <span className="featured-quest-veil" aria-hidden="true" />
          <FrameCorners />
          <span className="featured-quest-eyebrow">Campaign Complete</span>
          <button
            type="button"
            className="featured-quest-open"
            onClick={onOpenQuests}
            aria-label="Open the campaign map"
          >
            <span className="featured-quest-mark" aria-hidden="true" lang="ja">祝</span>
            <span className="featured-quest-title">
              <span className="featured-quest-wing" aria-hidden="true">&#8592;</span>
              Every seal is broken
              <span className="featured-quest-wing" aria-hidden="true">&#8594;</span>
            </span>
          </button>
          <button type="button" className="featured-quest-cta" onClick={onOpenQuests}>
            <b>Replay a quest</b>
            <small>All {QUESTS.length} quests cleared · open the map</small>
          </button>
        </div>
      </section>
    )
  }

  const stepsDone = completedQuestSteps(questProgress, nextQuest.id)
  const stepsLeft = QUEST_STEPS.length - stepsDone
  const questMinutes = Math.max(3, stepsLeft * 3)
  const arcQuests = QUESTS.filter((quest) => quest.arcId === nextQuest.arcId)
  const arcCleared = arcQuests.filter((quest) => isQuestComplete(questProgress, quest.id)).length
  const beadSteps = QUEST_STEPS.slice(0, -1)
  const trailPct = Math.min(1, stepsDone / (QUEST_STEPS.length - 1))
  const finialLit = stepsDone >= QUEST_STEPS.length - 1

  return (
    <section
      className="featured-quest"
      data-arc={nextQuest.arcId}
      aria-label={`Featured quest: ${nextQuest.title}`}
      style={{ '--featured-quest-art': `url("/quest-art/${nextQuest.id}.jpg")` } as CSSProperties}
    >
      <div className="featured-quest-frame">
        <span className="featured-quest-bg" aria-hidden="true" />
        <span className="featured-quest-veil" aria-hidden="true" />
        <FrameCorners />

        <span className="featured-quest-eyebrow">Featured Quest</span>

        <button
          type="button"
          className="featured-quest-open"
          onClick={onOpenQuests}
          aria-label={`Open quest ${nextQuest.number}: ${nextQuest.title}`}
        >
          <span className="featured-quest-mark" aria-hidden="true" lang="ja">{nextQuest.symbol}</span>
          <span className="featured-quest-title">
            <span className="featured-quest-wing" aria-hidden="true">&#8592;</span>
            {nextQuest.title}
            <span className="featured-quest-wing" aria-hidden="true">&#8594;</span>
          </span>
        </button>

        <div
          className="featured-quest-trail"
          role="img"
          aria-label={`${stepsDone} of ${QUEST_STEPS.length} quest steps done · region ${arcCleared} of ${arcQuests.length} cleared`}
          style={{ '--featured-quest-trail': String(trailPct) } as CSSProperties}
        >
          <span className="featured-quest-count">{arcCleared}/{arcQuests.length}</span>
          <span className="featured-quest-track">
            {beadSteps.map((step, index) => (
              <i
                key={step}
                className={`featured-quest-node${index < stepsDone ? ' is-done' : ''}${index === stepsDone ? ' is-next' : ''}`}
              />
            ))}
            <span className={`featured-quest-finial${finialLit ? ' is-lit' : ''}`} />
          </span>
        </div>

        <button type="button" className="featured-quest-cta" onClick={onContinueStudy}>
          <b>Continue Quest</b>
          <small>{stepsLeft === 1 ? '1 step left' : `${stepsLeft} steps left`} · ~{questMinutes} min</small>
        </button>
      </div>
    </section>
  )
}
