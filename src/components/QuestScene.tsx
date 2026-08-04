import { useState } from 'react'
import { getQuestById } from '../data/questCampaign'

interface QuestSceneProps {
  questId?: string
  onBack: () => void
}

export function QuestScene({ questId, onBack }: QuestSceneProps) {
  const quest = getQuestById(questId)
  const [englishVisible, setEnglishVisible] = useState(false)

  if (!quest?.scene.length) return null

  return (
    <main className="quest-scene-reader">
      <header className="quest-topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Quest</button>
        <button type="button" className={`btn btn-ghost${englishVisible ? ' is-active' : ''}`} onClick={() => setEnglishVisible((visible) => !visible)}>
          {englishVisible ? 'Hide English' : 'Show English'}
        </button>
      </header>
      <section className="quest-scene-reader-card">
        <span>QUEST {String(quest.number).padStart(2, '0')} · STORY SCENE</span>
        <h1>{quest.title}</h1>
        <p>Everything here uses the words and grammar you just practiced.</p>
        <ol>
          {quest.scene.map((line, index) => (
            <li key={line.japanese}>
              <small>{String(index + 1).padStart(2, '0')}</small>
              <strong lang="ja">{line.japanese}</strong>
              <em className={englishVisible ? 'is-visible' : ''}>{line.english}</em>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-primary" onClick={onBack}>Back to quest</button>
      </section>
    </main>
  )
}
