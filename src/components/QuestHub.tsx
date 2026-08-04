import type { CSSProperties } from 'react'
import { QUESTS } from '../data/questCampaign'

interface QuestHubProps {
  onBack: () => void
  onOpenVocab: (topicId: string) => void
  onOpenKanji: () => void
  onOpenGrammar: () => void
  onOpenScene: () => void
}

export function QuestHub({ onBack, onOpenVocab, onOpenKanji, onOpenGrammar, onOpenScene }: QuestHubProps) {
  const currentQuest = QUESTS[0]!

  return (
    <main className="quest-hub">
      <header className="quest-topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <span>Guided learning</span>
      </header>

      <section className="quest-hero" aria-labelledby="quest-title">
        <div>
          <span className="quest-eyebrow">CAMPAIGN I · EVERYDAY JAPAN</span>
          <h1 id="quest-title">Follow a path.<br /><em>Use Japanese for something.</em></h1>
          <p>Every step uses the same focused words, kanji, grammar, and story scene.</p>
        </div>
        <div className="quest-hero-mark" aria-hidden="true"><span>侍</span><small>YOUR JOURNEY</small></div>
      </section>

      <section className="quest-journey" aria-label="Campaign progress">
        <div className="quest-journey-heading"><div><span>JOURNEY</span><b>Everyday Japan</b></div><small>Quest 1 of {QUESTS.length}</small></div>
        <div className="quest-road" style={{ '--quest-position': '0%' } as CSSProperties}>
          <span className="quest-road-line" aria-hidden="true" />
          {QUESTS.map((quest, index) => <span key={quest.id} className={`quest-road-stop${index === 0 ? ' is-current' : ''}${index > 0 ? ' is-locked' : ''}`}>{quest.number}</span>)}
          <span className="quest-traveler" aria-label="Current position">侍</span><span className="quest-destination" aria-label="Campaign destination">鳥居</span>
        </div>
      </section>

      <section className="quest-current" aria-labelledby="current-quest-title">
        <div className="quest-current-intro">
          <span>YOUR NEXT QUEST · {currentQuest.level}</span><h2 id="current-quest-title">Quest {currentQuest.number}: {currentQuest.title}</h2><p>{currentQuest.subtitle}</p>
          <div className="quest-grammar-chips" aria-label="Grammar targets">{currentQuest.grammar.map((item) => <span key={item}>{item}</span>)}</div>
        </div>
        <aside className="quest-scene"><span>{currentQuest.storyTitle}</span><strong lang="ja">{currentQuest.storyJapanese}</strong><small>{currentQuest.storyEnglish}</small></aside>
      </section>

      <section className="quest-steps" aria-labelledby="quest-steps-title">
        <div className="quest-section-heading"><div><span>QUEST LOOP</span><h2 id="quest-steps-title">Build the scene, then understand it.</h2></div><button type="button" className="btn btn-primary" onClick={() => onOpenVocab(currentQuest.vocabularySetId)}>Continue quest →</button></div>
        <div className="quest-step-grid">
          <button type="button" className="quest-step is-next" onClick={() => onOpenVocab(currentQuest.vocabularySetId)}><span>01</span><b>Prepare</b><small>Learn 15 words: {currentQuest.vocabularyTheme}.</small></button>
          <button type="button" className="quest-step" onClick={onOpenKanji}><span>02</span><b>Read the kanji</b><small>Only kanji from this 15-word set.</small></button>
          <button type="button" className="quest-step" onClick={onOpenGrammar}><span>03</span><b>Use the grammar</b><small>Use these words in this quest’s grammar.</small></button>
          <button type="button" className="quest-step" onClick={onOpenScene}><span>04</span><b>Read the scene</b><small>Read the connected scene you prepared for.</small></button>
          <div className="quest-step quest-step-checkpoint"><span>05</span><b>Checkpoint</b><small>Coming next: a mixed review that completes the quest.</small></div>
        </div>
      </section>

      <section className="quest-map" aria-labelledby="quest-map-title">
        <div className="quest-section-heading"><div><span>CAMPAIGN MAP</span><h2 id="quest-map-title">What comes next</h2></div></div>
        <ol>{QUESTS.map((quest, index) => <li key={quest.id} className={index === 0 ? 'is-current' : ''}><span>{String(quest.number).padStart(2, '0')}</span><div><b>{quest.title}</b><small>{quest.vocabularyTheme} · {quest.grammar[0]}</small></div><em>{index === 0 ? 'Current' : 'Locked'}</em></li>)}</ol>
      </section>
    </main>
  )
}
