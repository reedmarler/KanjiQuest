import { useState } from 'react'
import { getQuestById } from '../data/questCampaign'
import { FuriganaSegment } from './FuriganaText'

interface QuestSceneProps {
  questId?: string
  onBack: () => void
  onDashboard?: () => void
  onContinue: (furiganaFree: boolean) => void
}

export function QuestScene({ questId, onBack, onDashboard, onContinue }: QuestSceneProps) {
  const quest = getQuestById(questId)
  const [englishVisible, setEnglishVisible] = useState(false)
  const [furiganaVisible, setFuriganaVisible] = useState(false)
  const [furiganaUsed, setFuriganaUsed] = useState(false)
  const [vertical, setVertical] = useState(false)

  if (!quest?.scene.length) return null

  return (
    <main className="quest-scene-reader">
      <header className="quest-topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Quest</button>
        {onDashboard && <button type="button" className="btn btn-ghost" onClick={onDashboard}>Dashboard</button>}
        <div className="quest-reader-toggles">
          <button type="button" className={`btn btn-ghost${furiganaVisible ? ' is-active' : ''}`} onClick={() => { setFuriganaVisible((visible) => !visible); setFuriganaUsed(true) }}>
            {furiganaVisible ? 'Hide Furigana' : 'Show Furigana'}
          </button>
          <button type="button" className={`btn btn-ghost${englishVisible ? ' is-active' : ''}`} onClick={() => setEnglishVisible((visible) => !visible)}>
            {englishVisible ? 'Hide English' : 'Show English'}
          </button>
          <button type="button" className={`btn btn-ghost${vertical ? ' is-active' : ''}`} onClick={() => setVertical((visible) => !visible)}>
            {vertical ? 'Horizontal' : 'Vertical'}
          </button>
        </div>
      </header>
      <section className="quest-scene-reader-card quest-book-reader">
        <header className="quest-book-heading"><span>QUEST {String(quest.number).padStart(2, '0')} · READING</span><h1>{quest.title}</h1><button type="button" className="btn btn-primary quest-book-continue" onClick={() => onContinue(!furiganaUsed)}>Approach the gate →</button></header>
        <article className={`quest-book-page${vertical ? ' is-vertical' : ''}`}>
          <span className="quest-book-page-number">一</span>
          <p className={`quest-reading-paragraph${furiganaVisible ? ' is-furigana-visible' : ''}`} lang="ja">
            {quest.scene.map((line) => (
              <span key={line.japanese}>
                <FuriganaSegment text={line.japanese} reading={line.reading} />
              </span>
            ))}
          </p>
          <p className={`quest-reading-english${englishVisible ? ' is-visible' : ''}`}>
            {quest.scene.map((line) => line.english).join(' ')}
          </p>
        </article>
        <footer className="quest-book-footer"><small>{quest.storyTitle} · Read the whole passage before entering the gate.</small></footer>
      </section>
    </main>
  )
}
