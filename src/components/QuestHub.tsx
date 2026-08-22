import { useMemo, useState } from 'react'
import { CAMPAIGN_ARCS, CAMPAIGN_GOAL, QUESTS, isQuestUnlocked } from '../data/questCampaign'
import { completedQuestSteps, isQuestComplete, QUEST_STEPS, type QuestProgress, type QuestStep } from '../lib/questProgress'
import { earnedRelics } from '../lib/relics'
import { AppBackButton } from './AppBackButton'

interface QuestHubProps {
  onBack: () => void
  onOpenVocab: (topicId: string, questId: string) => void
  onOpenKanji: (questId: string) => void
  onOpenGrammar: (questId: string) => void
  onOpenScene: (questId: string) => void
  onOpenCheckpoint: (questId: string) => void
  progress: QuestProgress
}

const STEP_DETAILS: ReadonlyArray<{ id: QuestStep; number: string; title: string; description: string }> = [
  { id: 'vocab', number: '01', title: 'Prepare', description: '15 words for this scene.' },
  { id: 'kanji', number: '02', title: 'Read kanji', description: 'Kanji from those same words.' },
  { id: 'grammar', number: '03', title: 'Use grammar', description: 'Forms inside this scene.' },
  { id: 'scene', number: '04', title: 'Read scene', description: 'Read the story you prepared for.' },
  { id: 'checkpoint', number: '05', title: 'Guardian battle', description: 'Prove mastery and break the seal.' },
]

export function QuestHub({ onBack, onOpenVocab, onOpenKanji, onOpenGrammar, onOpenScene, onOpenCheckpoint, progress }: QuestHubProps) {
  const questComplete = useMemo(() => (questId: string) => isQuestComplete(progress, questId), [progress])
  const unlocked = useMemo(() => QUESTS.filter((quest) => isQuestUnlocked(quest, questComplete)), [questComplete])
  const furthest = unlocked.find((quest) => !questComplete(quest.id)) ?? unlocked[unlocked.length - 1] ?? QUESTS[0]!
  const [selectedId, setSelectedId] = useState(furthest.id)
  const selected = QUESTS.find((quest) => quest.id === selectedId) ?? furthest

  const clearedCount = QUESTS.filter((quest) => questComplete(quest.id)).length
  const relicCount = earnedRelics(progress).length
  const completed = completedQuestSteps(progress, selected.id)
  const finished = isQuestComplete(progress, selected.id)
  const nextStep = QUEST_STEPS.find((step) => !progress[selected.id]?.[step]) ?? 'checkpoint'
  const currentStep = STEP_DETAILS.find((step) => step.id === nextStep) ?? STEP_DETAILS[0]

  const openStep = (step: QuestStep) => {
    if (step === 'vocab') onOpenVocab(selected.vocabularySetId, selected.id)
    else if (step === 'kanji') onOpenKanji(selected.id)
    else if (step === 'grammar') onOpenGrammar(selected.id)
    else if (step === 'scene') onOpenScene(selected.id)
    else onOpenCheckpoint(selected.id)
  }

  return (
    <main className="quest-hub quest-hub-simple">
      <header className="quest-topbar">
        <AppBackButton onClick={onBack} aria-label="Back to Dashboard" />
        <span>{clearedCount} / {QUESTS.length} quests complete</span>
      </header>

      {/* Why any of this matters. The relics were already the goal mechanically
          — nothing on screen ever said so, which left twelve quests looking
          like a to-do list rather than a road to somewhere. */}
      <section className="journey-goal" aria-labelledby="journey-goal-title">
        <span className="journey-goal-mark" aria-hidden="true">{CAMPAIGN_GOAL.mark}</span>
        <div className="journey-goal-copy">
          <span className="journey-goal-eyebrow">THE JOURNEY</span>
          <h1 id="journey-goal-title">{CAMPAIGN_GOAL.title}<small lang="ja">{CAMPAIGN_GOAL.japanese}</small></h1>
          <p>{CAMPAIGN_GOAL.premise} <b>{CAMPAIGN_GOAL.promise}</b></p>
          <div className="journey-goal-track" role="img" aria-label={`${relicCount} of ${QUESTS.length} seals recovered`}>
            <div className="journey-goal-fill" style={{ width: `${(relicCount / QUESTS.length) * 100}%` }} />
          </div>
          <div className="journey-goal-tally">
            <b>{relicCount}</b><span>of {QUESTS.length} seals recovered</span>
          </div>
        </div>
      </section>

      <section className="quest-focus" aria-labelledby="current-quest-title">
        <div className="quest-focus-copy">
          <header>
            <span>QUEST {String(selected.number).padStart(2, '0')}</span>
            <small>{selected.level} · {completed} of {QUEST_STEPS.length} steps</small>
          </header>
          <h2 id="current-quest-title">{selected.title}</h2>
          <p>{selected.subtitle}</p>

          <div className="quest-focus-meta">
            <span>{selected.vocabularyTheme}</span>
            <span>{selected.grammar.length} grammar forms</span>
            <span>{relicCount} relics carried</span>
          </div>

          <div className="quest-next-action">
            <div><small>{finished ? 'QUEST COMPLETE' : 'UP NEXT'}</small><b>{finished ? 'Review this quest' : currentStep.title}</b></div>
            <button type="button" className="btn btn-primary" onClick={() => openStep(nextStep)}>{finished ? 'Review' : 'Continue'}</button>
          </div>

          <div className="quest-step-list" aria-label="Quest steps">
            {STEP_DETAILS.map((step) => {
              const isDone = Boolean(progress[selected.id]?.[step.id])
              const isNext = !finished && step.id === nextStep
              const isAvailable = isDone || isNext
              return (
                <button key={step.id} type="button" disabled={!isAvailable} className={`quest-step-row${isDone ? ' is-done' : ''}${isNext ? ' is-next' : ''}`} onClick={() => openStep(step.id)}>
                  <span>{isDone ? '✓' : step.number}</span>
                  <b>{step.title}</b>
                  <small>{isDone ? 'Complete' : isNext ? step.description : 'Locked'}</small>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="quest-focus-guardian">
          <div className="quest-focus-guardian-copy"><small>{finished ? 'DEFEATED' : 'GUARDIAN'}</small><b>{selected.guardian.name}</b><span>{selected.guardian.title}</span></div>
          {selected.guardian.portrait
            ? <img src={selected.guardian.portrait} alt={`${selected.guardian.name}, ${selected.guardian.title}`} />
            : <strong aria-hidden="true">{selected.guardian.mark}</strong>}
          <footer><small>{finished ? 'RELIC RECOVERED' : 'REWARD'}</small><b>{selected.reward.name}</b></footer>
        </aside>
      </section>

      {/* The road, told as chapters. A flat grid of twelve made every quest
          look like a separate errand; grouping them under each arc's own lore
          gives the list a shape and a direction. */}
      <section className="journey-road" aria-labelledby="journey-road-title">
        <h2 id="journey-road-title" className="journey-road-title">The road ahead</h2>
        {CAMPAIGN_ARCS.map((arc) => {
          const arcQuests = QUESTS.filter((quest) => quest.arcId === arc.id)
          const arcCleared = arcQuests.filter((quest) => questComplete(quest.id)).length
          const arcOpen = arcQuests.some((quest) => isQuestUnlocked(quest, questComplete))

          return (
            <article key={arc.id} className={`journey-chapter${arcOpen ? '' : ' is-sealed'}${arcCleared === arcQuests.length ? ' is-cleared' : ''}`}>
              <header className="journey-chapter-header">
                <span className="journey-chapter-mark" aria-hidden="true">{arc.mark}</span>
                <div>
                  <span className="journey-chapter-eyebrow">{arc.subtitle}</span>
                  <h3>{arc.title}<small lang="ja">{arc.japanese}</small></h3>
                  <p>{arc.blurb}</p>
                </div>
                <small className="journey-chapter-count">{arcCleared}/{arcQuests.length}</small>
              </header>

              <ol className="journey-path">
                {arcQuests.map((quest) => {
                  const isOpen = isQuestUnlocked(quest, questComplete)
                  const done = questComplete(quest.id)
                  const isSelected = quest.id === selected.id
                  const isFinale = quest.number === QUESTS.length

                  return (
                    <li key={quest.id}>
                      <button
                        type="button"
                        disabled={!isOpen}
                        onClick={() => setSelectedId(quest.id)}
                        aria-pressed={isSelected}
                        className={`journey-stop${done ? ' is-done' : ''}${isSelected ? ' is-current' : ''}${isFinale ? ' is-finale' : ''}`}
                      >
                        <span className="journey-stop-dot" aria-hidden="true">{done ? '✓' : quest.number}</span>
                        <span className="journey-stop-copy">
                          <b>{isOpen ? quest.title : 'Sealed'}</b>
                          {/* Naming the guardian is what turns a row into a
                              stop on a road with something waiting on it. */}
                          <small>{isOpen ? `${quest.level} · ${quest.guardian.name}` : quest.level}</small>
                        </span>
                        {isFinale && <span className="journey-stop-flag">FINALE</span>}
                      </button>
                    </li>
                  )
                })}
              </ol>
            </article>
          )
        })}
      </section>
    </main>
  )
}
