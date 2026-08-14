import { useMemo, useState } from 'react'
import { QUESTS, isQuestUnlocked } from '../data/questCampaign'
import { completedQuestSteps, isQuestComplete, QUEST_STEPS, type QuestProgress, type QuestStep } from '../lib/questProgress'
import { earnedRelics } from '../lib/relics'

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
        <button type="button" className="btn btn-ghost" onClick={onBack}>Back to dashboard</button>
        <span>{clearedCount} / {QUESTS.length} quests complete</span>
      </header>

      <section className="quest-focus" aria-labelledby="current-quest-title">
        <div className="quest-focus-copy">
          <header>
            <span>QUEST {String(selected.number).padStart(2, '0')}</span>
            <small>{selected.level} · {completed} of {QUEST_STEPS.length} steps</small>
          </header>
          <h1 id="current-quest-title">{selected.title}</h1>
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

      <section className="quest-picker" aria-labelledby="quest-road-title">
        <header><div><span>THE INKBOUND ROAD</span><h2 id="quest-road-title">Choose a quest</h2></div><small>{clearedCount} of {QUESTS.length} cleared</small></header>
        <div className="quest-picker-grid">
          {QUESTS.map((quest) => {
            const isOpen = isQuestUnlocked(quest, questComplete)
            const done = questComplete(quest.id)
            const isSelected = quest.id === selected.id
            return (
              <button key={quest.id} type="button" disabled={!isOpen} onClick={() => setSelectedId(quest.id)} className={`quest-picker-item${done ? ' is-done' : ''}${isSelected ? ' is-current' : ''}`} aria-pressed={isSelected}>
                <span>{done ? '✓' : quest.number}</span>
                <div><b>{isOpen ? quest.title : `Quest ${quest.number}`}</b><small>{done ? 'Complete' : isOpen ? quest.level : 'Locked'}</small></div>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}
