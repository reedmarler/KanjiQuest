import { useState } from 'react'
import { getQuestById } from '../data/questCampaign'
import { FuriganaSegment } from './FuriganaText'

interface QuestSceneProps {
  questId?: string
  onBack: () => void
  onContinue: (furiganaFree: boolean) => void
}

export function QuestScene({ questId, onBack, onContinue }: QuestSceneProps) {
  const quest = getQuestById(questId)
  const [englishVisible, setEnglishVisible] = useState(false)
  const [furiganaVisible, setFuriganaVisible] = useState(false)
  const [furiganaUsed, setFuriganaUsed] = useState(false)

  if (!quest?.scene.length) return null

  return (
    <main className="quest-scene-reader">
      <header className="quest-topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Quest</button>
        <div className="quest-reader-toggles">
          <button type="button" className={`btn btn-ghost${furiganaVisible ? ' is-active' : ''}`} onClick={() => { setFuriganaVisible((visible) => !visible); setFuriganaUsed(true) }}>
            {furiganaVisible ? 'Hide Furigana' : 'Show Furigana'}
          </button>
          <button type="button" className={`btn btn-ghost${englishVisible ? ' is-active' : ''}`} onClick={() => setEnglishVisible((visible) => !visible)}>
            {englishVisible ? 'Hide English' : 'Show English'}
          </button>
        </div>
      </header>
      <section className="quest-scene-reader-card">
        <span>QUEST {String(quest.number).padStart(2, '0')} · STORY SCENE</span>
        <h1>{quest.title}</h1>
        <p>Read it as a small passage. Turn on support only when you need it.</p>
        <p className={`quest-reading-paragraph${furiganaVisible ? ' is-furigana-visible' : ''}`} lang="ja">
          {quest.scene.map((line) => (
            <span key={line.japanese}>
              {furiganaVisible
                ? <FuriganaSegment text={line.japanese} reading={line.reading} />
                : line.japanese}
            </span>
          ))}
        </p>
        <p className={`quest-reading-english${englishVisible ? ' is-visible' : ''}`}>
          {quest.scene.map((line) => line.english).join(' ')}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => onContinue(!furiganaUsed)}>Face the guardian →</button>
      </section>
    </main>
  )
}
