import { useMemo, useState, type CSSProperties } from 'react'
import { CAMPAIGN_ARCS, QUESTS, isQuestUnlocked } from '../data/questCampaign'
import { completedQuestSteps, isQuestComplete, QUEST_STEPS, type QuestProgress, type QuestStep } from '../lib/questProgress'
import { earnedRelics } from '../lib/relics'
import { GuardianSprite, hasGuardianSprite } from './GuardianSprite'

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
  // Land the player on the furthest quest they can actually play rather than
  // always resetting them to the top of the campaign.
  const furthest = unlocked.find((quest) => !questComplete(quest.id)) ?? unlocked[unlocked.length - 1] ?? QUESTS[0]!
  const [selectedId, setSelectedId] = useState(furthest.id)
  const selected = QUESTS.find((quest) => quest.id === selectedId) ?? furthest

  const relics = earnedRelics(progress)
  const clearedCount = QUESTS.filter((quest) => questComplete(quest.id)).length
  const completed = completedQuestSteps(progress, selected.id)
  const finished = isQuestComplete(progress, selected.id)
  const nextStep = QUEST_STEPS.find((step) => !progress[selected.id]?.[step]) ?? 'checkpoint'

  const openStep = (step: QuestStep) => {
    if (step === 'vocab') onOpenVocab(selected.vocabularySetId, selected.id)
    else if (step === 'kanji') onOpenKanji(selected.id)
    else if (step === 'grammar') onOpenGrammar(selected.id)
    else if (step === 'scene') onOpenScene(selected.id)
    else onOpenCheckpoint(selected.id)
  }

  return (
    <main className="quest-hub">
      <header className="quest-topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <span>{clearedCount} / {QUESTS.length} seals recovered</span>
      </header>

      <section className="quest-campaign-bar" aria-labelledby="quest-title">
        <div>
          <span>YOUR STORY</span>
          <h1 id="quest-title">The Inkbound Road</h1>
          <p>Yōkai have stolen the seals of everyday speech. Recover them before the guardians learn to speak beyond you.</p>
        </div>
        <div className="quest-campaign-progress"><span>侍</span><b>{clearedCount} / {QUESTS.length}</b><small>quests cleared</small></div>
      </section>

      {relics.length > 0 && (
        <section className="quest-relic-shelf" aria-label="Relics earned">
          <div className="quest-relic-shelf-head"><span>RELICS CARRIED</span><small>Active in every guardian battle</small></div>
          <div className="quest-relic-row">
            {relics.map((relic) => (
              <article key={relic.perk} className={`quest-relic-chip${relic.perk === 'lantern-flame' ? ' is-legendary' : ''}`} title={relic.description}>
                <span aria-hidden="true">{relic.mark}</span>
                <div><b>{relic.title}</b><small>{relic.description}</small></div>
              </article>
            ))}
          </div>
        </section>
      )}

      {CAMPAIGN_ARCS.map((arc) => {
        const arcQuests = QUESTS.filter((quest) => quest.arcId === arc.id)
        const arcCleared = arcQuests.filter((quest) => questComplete(quest.id)).length
        const arcOpen = arcQuests.some((quest) => isQuestUnlocked(quest, questComplete))
        return (
          <section key={arc.id} className={`quest-arc${arcOpen ? '' : ' is-sealed'}`} aria-label={arc.title}>
            <header className="quest-arc-head">
              <span className="quest-arc-mark" aria-hidden="true">{arc.mark}</span>
              <div>
                <small>{arc.subtitle}</small>
                <h2>{arc.title} <em lang="ja">{arc.japanese}</em></h2>
                <p>{arcOpen ? arc.blurb : 'Clear the road before this to light the way here.'}</p>
              </div>
              <b>{arcCleared} / {arcQuests.length}</b>
            </header>
            <div className="quest-arc-road" style={{ '--quest-position': `${(arcCleared / arcQuests.length) * 100}%` } as CSSProperties}>
              <span className="quest-road-line" aria-hidden="true" />
              {arcQuests.map((quest) => {
                const isOpen = isQuestUnlocked(quest, questComplete)
                const done = questComplete(quest.id)
                const isSelected = quest.id === selected.id
                return (
                  <button
                    key={quest.id}
                    type="button"
                    disabled={!isOpen}
                    onClick={() => setSelectedId(quest.id)}
                    className={`quest-road-stop${done ? ' is-done' : ''}${isSelected ? ' is-current' : ''}${isOpen ? '' : ' is-locked'}`}
                    aria-label={`Quest ${quest.number}: ${isOpen ? quest.title : 'locked'}`}
                    aria-pressed={isSelected}
                  >
                    {done ? '✓' : isOpen ? quest.number : '鍵'}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      <section className="quest-current quest-current-compact" aria-labelledby="current-quest-title">
        <div className="quest-current-intro">
          <span>QUEST {String(selected.number).padStart(2, '0')} · {selected.level}</span>
          <h2 id="current-quest-title">{selected.title}</h2><p>{selected.subtitle}</p>
          <div className="quest-grammar-chips" aria-label="Grammar targets">{selected.grammar.map((item) => <span key={item}>{item}</span>)}</div>
          <div className={`quest-earned-reward-preview${finished ? ' is-earned' : ''}`}>
            <span className="quest-earned-reward-mark" aria-hidden="true">{selected.reward.mark}</span>
            <div><small>{finished ? 'RELIC EARNED · ACTIVE' : 'QUEST REWARD'}</small><b>{selected.reward.name}</b><p><strong>{selected.reward.perkTitle}:</strong> {selected.reward.perkDescription}</p></div>
          </div>
        </div>
        <aside className="quest-guardian-card">
          <span>QUEST GUARDIAN</span>
          {hasGuardianSprite(selected.id)
            ? <div className="quest-guardian-card-sprite"><GuardianSprite questId={selected.id} label={`${selected.guardian.name}, ${selected.guardian.title}`} /></div>
            : selected.guardian.portrait
              ? <img src={selected.guardian.portrait} alt={`${selected.guardian.name}, ${selected.guardian.title}`} />
              : <strong>{selected.guardian.mark}</strong>}
          <b>{selected.guardian.name}</b>
          <small>{selected.guardian.title}</small>
          {selected.guardian.phases && <span className="quest-guardian-phases">{selected.guardian.phases.length} phases</span>}
          <em>{finished ? 'Defeated' : 'Defeat to claim relic'}</em>
        </aside>
      </section>

      <section className="quest-steps quest-steps-compact" aria-labelledby="quest-steps-title">
        <div className="quest-section-heading">
          <div><span>QUEST STEPS · {completed} / {QUEST_STEPS.length}</span><h2 id="quest-steps-title">{finished ? 'Quest complete' : `Next: ${STEP_DETAILS.find((step) => step.id === nextStep)?.title}`}</h2></div>
          <button type="button" className="btn btn-primary" onClick={() => openStep(nextStep)}>{finished ? 'Review quest' : 'Continue →'}</button>
        </div>
        <div className="quest-step-grid">
          {STEP_DETAILS.map((step) => {
            const isDone = Boolean(progress[selected.id]?.[step.id])
            const isNext = !finished && step.id === nextStep
            const isAvailable = isDone || isNext
            return (
              <button key={step.id} type="button" disabled={!isAvailable} className={`quest-step${isDone ? ' is-done' : ''}${isNext ? ' is-next' : ''}`} onClick={() => openStep(step.id)}>
                <span>{isDone ? '✓' : step.number}</span><b>{step.title}</b><small>{isDone ? 'Complete' : isAvailable ? step.description : 'Complete the previous step first.'}</small>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}
