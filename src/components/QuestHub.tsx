import { useEffect, useMemo, useRef, useState } from 'react'
import { CAMPAIGN_ARCS, CAMPAIGN_GOAL, QUESTS, isQuestUnlocked, type QuestDefinition } from '../data/questCampaign'
import { completedQuestSteps, isQuestComplete, QUEST_STEPS, type QuestProgress, type QuestStep } from '../lib/questProgress'
import { earnedRelics } from '../lib/relics'

interface QuestHubProps {
  onOpenInkRoad: () => void
  onOpenVocab: (topicId: string, questId: string) => void
  onOpenKanji: (questId: string) => void
  onOpenGrammar: (questId: string) => void
  onOpenScene: (questId: string) => void
  onOpenCheckpoint: (questId: string) => void
  progress: QuestProgress
}

const STEP_DETAILS: ReadonlyArray<{ id: QuestStep; number: string; title: string }> = [
  { id: 'vocab', number: '01', title: 'Prepare' },
  { id: 'kanji', number: '02', title: 'Read kanji' },
  { id: 'grammar', number: '03', title: 'Use grammar' },
  { id: 'scene', number: '04', title: 'Read scene' },
  { id: 'checkpoint', number: '05', title: 'Guardian battle' },
]

export function QuestHub({ onOpenInkRoad, onOpenVocab, onOpenKanji, onOpenGrammar, onOpenScene, onOpenCheckpoint, progress }: QuestHubProps) {
  const questComplete = useMemo(() => (questId: string) => isQuestComplete(progress, questId), [progress])
  const unlocked = useMemo(() => QUESTS.filter((quest) => isQuestUnlocked(quest, questComplete)), [questComplete])
  const frontier = unlocked.find((quest) => !questComplete(quest.id)) ?? null

  const [openQuestId, setOpenQuestId] = useState<string | null>(null)
  const openQuest = QUESTS.find((quest) => quest.id === openQuestId) ?? null

  const clearedCount = QUESTS.filter((quest) => questComplete(quest.id)).length
  const relicCount = earnedRelics(progress).length

  /*
   * The only "movement" this menu shows: when a quest flips to complete, its
   * stop settles with a small pop and the one after it pings awake a moment
   * later. Walking the road itself is what the study screens are for — this
   * is just the map noticing that you did.
   */
  const [justCleared, setJustCleared] = useState<string | null>(null)
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null)
  const prevProgress = useRef(progress)

  useEffect(() => {
    const prev = prevProgress.current
    prevProgress.current = progress
    if (prev === progress) return

    const cleared = QUESTS.find((quest) => !isQuestComplete(prev, quest.id) && isQuestComplete(progress, quest.id))
    if (!cleared) return
    setJustCleared(cleared.id)

    const next = QUESTS.find((quest) => quest.number === cleared.number + 1)
    if (!next) return
    const timer = window.setTimeout(() => setJustUnlocked(next.id), 550)
    return () => window.clearTimeout(timer)
  }, [progress])

  const openStep = (quest: QuestDefinition, step: QuestStep) => {
    if (step === 'vocab') onOpenVocab(quest.vocabularySetId, quest.id)
    else if (step === 'kanji') onOpenKanji(quest.id)
    else if (step === 'grammar') onOpenGrammar(quest.id)
    else if (step === 'scene') onOpenScene(quest.id)
    else onOpenCheckpoint(quest.id)
  }

  return (
    <main className="quest-hub quest-hub-simple">
      <header className="quest-topbar">
        <span>{clearedCount} / {QUESTS.length} quests complete</span>
        {/* The map is a preview sitting beside this list, not a replacement:
            the point is to compare walking a road against reading a list. */}
        <button type="button" className="quest-topbar-preview" onClick={onOpenInkRoad}>
          Ink Road <small>preview</small>
        </button>
      </header>

      <section className="journey-goal" aria-labelledby="journey-goal-title">
        <span className="journey-goal-mark" aria-hidden="true">{CAMPAIGN_GOAL.mark}</span>
        <div className="journey-goal-copy">
          <span className="journey-goal-eyebrow">THE JOURNEY</span>
          <h1 id="journey-goal-title">{CAMPAIGN_GOAL.title}<small lang="ja">{CAMPAIGN_GOAL.japanese}</small></h1>
          <p>{CAMPAIGN_GOAL.premise} Villagers, shopkeepers, and lords along the road are offering rewards to whoever helps.</p>
          <div className="journey-goal-track" role="img" aria-label={`${relicCount} of ${QUESTS.length} seals recovered`}>
            <div className="journey-goal-fill" style={{ width: `${(relicCount / QUESTS.length) * 100}%` }} />
          </div>
          <div className="journey-goal-tally">
            <b>{relicCount}</b><span>of {QUESTS.length} seals recovered</span>
          </div>
        </div>
      </section>

      {/* One continuous road for the whole campaign — tapping any open stop
          is the only way in, so nothing about a quest loads until you ask
          for it. Arc gates sit inline on the road rather than as their own
          boxed sections, so it still reads as one path, not twelve errands. */}
      <ol className="journey-path" aria-label="Quest path">
        {QUESTS.map((quest, index) => {
          const isOpen = isQuestUnlocked(quest, questComplete)
          const done = questComplete(quest.id)
          const isCurrent = frontier?.id === quest.id
          const isFinale = quest.number === QUESTS.length
          const previousArcId = index > 0 ? QUESTS[index - 1]!.arcId : null
          const gate = quest.arcId !== previousArcId ? CAMPAIGN_ARCS.find((arc) => arc.id === quest.arcId) : undefined

          return (
            <li key={quest.id}>
              {gate && (
                <div className="quest-path-gate">
                  <span className="quest-path-gate-mark" aria-hidden="true">{gate.mark}</span>
                  <div className="quest-path-gate-copy">
                    <b>{gate.title}</b>
                    <small>{gate.subtitle}</small>
                  </div>
                </div>
              )}
              <button
                type="button"
                disabled={!isOpen}
                onClick={() => setOpenQuestId(quest.id)}
                aria-pressed={openQuestId === quest.id}
                onAnimationEnd={() => {
                  if (justCleared === quest.id) setJustCleared(null)
                  if (justUnlocked === quest.id) setJustUnlocked(null)
                }}
                className={`journey-stop${done ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}${isFinale ? ' is-finale' : ''}${justCleared === quest.id ? ' is-just-cleared' : ''}${justUnlocked === quest.id ? ' is-just-unlocked' : ''}`}
              >
                <span className="journey-stop-dot" aria-hidden="true">{done ? '✓' : quest.number}</span>
                <span className="journey-stop-copy">
                  <b>{isOpen ? quest.title : 'Sealed'}</b>
                  <small>{isOpen ? `${quest.level} · ${quest.guardian.name}` : quest.level}</small>
                </span>
                {isFinale && <span className="journey-stop-flag">FINALE</span>}
              </button>
            </li>
          )
        })}
      </ol>

      {openQuest && (
        <QuestSheet
          quest={openQuest}
          progress={progress}
          onClose={() => setOpenQuestId(null)}
          onOpenStep={(step) => openStep(openQuest, step)}
        />
      )}
    </main>
  )
}

function QuestSheet({
  quest,
  progress,
  onClose,
  onOpenStep,
}: {
  quest: QuestDefinition
  progress: QuestProgress
  onClose: () => void
  onOpenStep: (step: QuestStep) => void
}) {
  const completed = completedQuestSteps(progress, quest.id)
  const finished = isQuestComplete(progress, quest.id)
  const nextStep = QUEST_STEPS.find((step) => !progress[quest.id]?.[step]) ?? 'checkpoint'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div className="quest-sheet-backdrop" onClick={onClose}>
      <div
        className="quest-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="quest-sheet-head">
          <span>QUEST {String(quest.number).padStart(2, '0')} · {quest.level} · {completed}/{STEP_DETAILS.length} steps</span>
          <button type="button" className="quest-sheet-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <h2 id="quest-sheet-title">{quest.title}<small lang="ja">{quest.symbol}</small></h2>
        <p className="quest-sheet-subtitle">{quest.subtitle}</p>

        <div className="quest-sheet-patron">
          <span className="quest-sheet-patron-role">{quest.patron.role} asks</span>
          <p>“{quest.patron.request}”</p>
          <span className="quest-sheet-patron-name">— {quest.patron.name}</span>
        </div>

        <div className="quest-sheet-threat">
          <span className="quest-sheet-threat-portrait">
            {quest.guardian.portrait
              ? <img src={quest.guardian.portrait} alt="" />
              : <strong aria-hidden="true">{quest.guardian.mark}</strong>}
          </span>
          <div className="quest-sheet-threat-copy">
            <small>{finished ? 'DEFEATED' : 'GUARDIAN'}</small>
            <b>{quest.guardian.name}</b>
            <span>{quest.guardian.title}</span>
          </div>
        </div>

        <div className="quest-sheet-steps" role="group" aria-label={`${completed} of ${STEP_DETAILS.length} steps complete`}>
          {STEP_DETAILS.map((step) => {
            const isDone = Boolean(progress[quest.id]?.[step.id])
            const isNext = !finished && step.id === nextStep
            return (
              <button
                key={step.id}
                type="button"
                disabled={!(isDone || isNext)}
                className={`quest-sheet-pip${isDone ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}
                title={step.title}
                aria-label={`${step.title}${isDone ? ', complete' : isNext ? ', up next' : ', locked'}`}
                onClick={() => onOpenStep(step.id)}
              >
                {isDone ? '✓' : step.number}
              </button>
            )
          })}
        </div>

        <div className="quest-sheet-footer">
          <div className="quest-sheet-reward">
            <span aria-hidden="true">{quest.reward.mark}</span>
            <div>
              <small>{finished ? 'RELIC RECOVERED' : 'REWARD'}</small>
              <b>{quest.reward.name}</b>
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => onOpenStep(nextStep)}>
            {finished ? 'Review' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
