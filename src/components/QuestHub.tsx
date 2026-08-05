import type { CSSProperties } from 'react'
import { QUESTS } from '../data/questCampaign'
import { completedQuestSteps, isQuestComplete, QUEST_STEPS, type QuestProgress, type QuestStep } from '../lib/questProgress'

interface QuestHubProps {
  onBack: () => void
  onOpenVocab: (topicId: string) => void
  onOpenKanji: () => void
  onOpenGrammar: () => void
  onOpenScene: () => void
  onOpenCheckpoint: () => void
  progress: QuestProgress
}

const STEP_DETAILS: ReadonlyArray<{ id: QuestStep; number: string; title: string; description: string }> = [
  { id: 'vocab', number: '01', title: 'Prepare', description: '15 words for this morning.' },
  { id: 'kanji', number: '02', title: 'Read kanji', description: 'Kanji from those same words.' },
  { id: 'grammar', number: '03', title: 'Use grammar', description: 'Forms inside this morning’s scene.' },
  { id: 'scene', number: '04', title: 'Read scene', description: 'Read the story you prepared for.' },
  { id: 'checkpoint', number: '05', title: 'Guardian battle', description: 'Prove mastery and break the seal.' },
]

export function QuestHub({ onBack, onOpenVocab, onOpenKanji, onOpenGrammar, onOpenScene, onOpenCheckpoint, progress }: QuestHubProps) {
  const currentQuest = QUESTS[0]!
  const completed = completedQuestSteps(progress, currentQuest.id)
  const finished = isQuestComplete(progress, currentQuest.id)
  const nextStep = QUEST_STEPS.find((step) => !progress[currentQuest.id]?.[step]) ?? 'checkpoint'
  const openStep = (step: QuestStep) => {
    if (step === 'vocab') onOpenVocab(currentQuest.vocabularySetId)
    else if (step === 'kanji') onOpenKanji()
    else if (step === 'grammar') onOpenGrammar()
    else if (step === 'scene') onOpenScene()
    else onOpenCheckpoint()
  }

  return (
    <main className="quest-hub">
      <header className="quest-topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <span>Campaign I · The Inkbound Road</span>
      </header>

      <section className="quest-campaign-bar" aria-labelledby="quest-title">
        <div><span>YOUR STORY</span><h1 id="quest-title">The Inkbound Road</h1><p>Yōkai have stolen six language seals. Recover them before the guardians learn to speak beyond you.</p></div>
        <div className="quest-campaign-progress"><span>侍</span><b>{completed} / {QUEST_STEPS.length}</b><small>steps complete</small></div>
      </section>

      <section className="quest-journey quest-journey-compact" aria-label="Campaign progress">
        <div className="quest-road" style={{ '--quest-position': `${(completed / QUEST_STEPS.length) * 100}%` } as CSSProperties}>
          <span className="quest-road-line" aria-hidden="true" />
          {QUESTS.map((quest, index) => <span key={quest.id} className={`quest-road-stop${index === 0 ? ' is-current' : ''}${index > 0 ? ' is-locked' : ''}`}>{quest.number}</span>)}
          <span className="quest-traveler" aria-label="Current position">侍</span><span className="quest-destination" aria-label="Campaign destination">鳥居</span>
        </div>
      </section>

      <section className="quest-current quest-current-compact" aria-labelledby="current-quest-title">
        <div className="quest-current-intro">
          <span>QUEST {String(currentQuest.number).padStart(2, '0')} · {currentQuest.level}</span>
          <h2 id="current-quest-title">{currentQuest.title}</h2><p>{currentQuest.subtitle}</p>
          <div className="quest-grammar-chips" aria-label="Grammar targets">{currentQuest.grammar.map((item) => <span key={item}>{item}</span>)}</div>
          <div className={`quest-earned-reward-preview${finished ? ' is-earned' : ''}`}>
            <span className="quest-earned-reward-mark" aria-hidden="true">{currentQuest.reward.mark}</span>
            <div><small>{finished ? 'RELIC EARNED · ACTIVE' : 'QUEST REWARD'}</small><b>{currentQuest.reward.name}</b><p><strong>{currentQuest.reward.perkTitle}:</strong> {currentQuest.reward.perkDescription}</p></div>
          </div>
        </div>
        <aside className="quest-guardian-card">
          <span>QUEST GUARDIAN</span>
          {currentQuest.guardian.portrait
            ? <img src={currentQuest.guardian.portrait} alt={`${currentQuest.guardian.name}, ${currentQuest.guardian.title}`} />
            : <strong>{currentQuest.guardian.mark}</strong>}
          <b>{currentQuest.guardian.name}</b>
          <small>{currentQuest.guardian.title}</small>
          <em>{finished ? 'Defeated' : 'Defeat to claim relic'}</em>
        </aside>
      </section>

      <section className="quest-steps quest-steps-compact" aria-labelledby="quest-steps-title">
        <div className="quest-section-heading"><div><span>QUEST STEPS</span><h2 id="quest-steps-title">{finished ? 'Quest complete' : `Next: ${STEP_DETAILS.find((step) => step.id === nextStep)?.title}`}</h2></div><button type="button" className="btn btn-primary" onClick={() => openStep(nextStep)}>{finished ? 'Review quest' : 'Continue →'}</button></div>
        <div className="quest-step-grid">
          {STEP_DETAILS.map((step) => {
            const isDone = Boolean(progress[currentQuest.id]?.[step.id])
            const isNext = !finished && step.id === nextStep
            const isAvailable = isDone || isNext
            return <button key={step.id} type="button" disabled={!isAvailable} className={`quest-step${isDone ? ' is-done' : ''}${isNext ? ' is-next' : ''}`} onClick={() => openStep(step.id)}><span>{isDone ? '✓' : step.number}</span><b>{step.title}</b><small>{isDone ? 'Complete' : isAvailable ? step.description : 'Complete the previous step first.'}</small></button>
          })}
        </div>
      </section>
    </main>
  )
}
