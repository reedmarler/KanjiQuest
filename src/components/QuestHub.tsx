import { useMemo } from 'react'
import { QUESTS, isQuestUnlocked } from '../data/questCampaign'
import { isQuestComplete, type QuestProgress } from '../lib/questProgress'

interface QuestHubProps {
  onOpenCheckpoint: (questId: string) => void
  progress: QuestProgress
}

export function QuestHub({ onOpenCheckpoint, progress }: QuestHubProps) {
  const questComplete = useMemo(() => (questId: string) => isQuestComplete(progress, questId), [progress])
  const completedCount = QUESTS.filter((quest) => questComplete(quest.id)).length
  const currentQuest = QUESTS.find((quest) => isQuestUnlocked(quest, questComplete) && !questComplete(quest.id))

  return (
    <main className="simple-quest-hub">
      <header className="simple-quest-hero">
        <img src="/quest-art/featured-quest.jpg" alt="A traveler on a Japanese mountain path" />
        <div className="simple-quest-hero-copy">
          <span>QUICK PRACTICE</span>
          <h1>Quests</h1>
          <p>Short Japanese challenges, one topic at a time.</p>
        </div>
      </header>

      <section className="simple-quest-summary" aria-label={`${completedCount} of ${QUESTS.length} quests complete`}>
        <div>
          <strong>{completedCount}</strong>
          <span>completed</span>
        </div>
        <div className="simple-quest-summary-track" aria-hidden="true">
          <i style={{ width: `${(completedCount / QUESTS.length) * 100}%` }} />
        </div>
        <b>{QUESTS.length - completedCount} left</b>
      </section>

      <section className="simple-quest-list" aria-label="Available quests">
        {QUESTS.map((quest) => {
          const unlocked = isQuestUnlocked(quest, questComplete)
          const complete = questComplete(quest.id)
          const current = currentQuest?.id === quest.id

          return (
            <article key={quest.id} className={`simple-quest-row${current ? ' is-current' : ''}${complete ? ' is-complete' : ''}`}>
              <span className="simple-quest-symbol" lang="ja" aria-hidden="true">{complete ? '済' : quest.symbol}</span>
              <div className="simple-quest-copy">
                <span>QUEST {String(quest.number).padStart(2, '0')} · {quest.level}</span>
                <h2>{quest.title}</h2>
                <p>{quest.vocabularyTheme}</p>
              </div>
              <button
                type="button"
                disabled={!unlocked}
                className="simple-quest-start"
                onClick={() => onOpenCheckpoint(quest.id)}
                aria-label={unlocked ? `${complete ? 'Replay' : 'Start'} ${quest.title}` : `${quest.title} is locked`}
              >
                {!unlocked ? 'Locked' : complete ? 'Replay' : current ? 'Start' : 'Open'}
              </button>
            </article>
          )
        })}
      </section>
    </main>
  )
}
