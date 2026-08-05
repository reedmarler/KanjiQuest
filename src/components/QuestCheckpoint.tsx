import { useState } from 'react'
import { getQuestById } from '../data/questCampaign'
import type { DrillExercise } from '../lib/drillExercises'

interface QuestCheckpointProps {
  questId?: string
  onBack: () => void
  onComplete: () => void
  hasDawnGuard: boolean
  onBattleResult: (result: { won: boolean; perfect: boolean }) => void
}

type BattlePhase = 'intro' | 'question' | 'feedback' | 'victory' | 'defeat' | 'review'
const MAX_HEALTH = 3

export function QuestCheckpoint({ questId, onBack, onComplete, hasDawnGuard, onBattleResult }: QuestCheckpointProps) {
  const quest = getQuestById(questId)
  const [phase, setPhase] = useState<BattlePhase>('intro')
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [playerHealth, setPlayerHealth] = useState(MAX_HEALTH)
  const [guardianHealth, setGuardianHealth] = useState(MAX_HEALTH)
  const [missed, setMissed] = useState<DrillExercise[]>([])
  const [lastHitCorrect, setLastHitCorrect] = useState(false)
  const [lastHitBlocked, setLastHitBlocked] = useState(false)
  const [dawnGuardUsed, setDawnGuardUsed] = useState(false)
  const [attempt, setAttempt] = useState(1)

  if (!quest?.grammarDrills.length) return null
  const drillCount = quest.grammarDrills.length
  const exercise = quest.grammarDrills[index] ?? quest.grammarDrills[0]!

  function beginBattle() {
    setIndex(0)
    setSelected(null)
    setPlayerHealth(MAX_HEALTH)
    setGuardianHealth(MAX_HEALTH)
    setMissed([])
    setLastHitCorrect(false)
    setLastHitBlocked(false)
    setDawnGuardUsed(false)
    setPhase('question')
  }

  function strike() {
    if (!selected || phase !== 'question') return
    const correct = selected === exercise.answer
    const blocked = !correct && hasDawnGuard && !dawnGuardUsed
    setLastHitCorrect(correct)
    setLastHitBlocked(blocked)
    if (correct) setGuardianHealth((health) => Math.max(0, health - 1))
    else {
      if (blocked) setDawnGuardUsed(true)
      else setPlayerHealth((health) => Math.max(0, health - 1))
      setMissed((items) => items.some((item) => item.id === exercise.id) ? items : [...items, exercise])
    }
    setPhase('feedback')
  }

  function continueBattle() {
    if (guardianHealth <= 0) {
      onBattleResult({ won: true, perfect: missed.length === 0 })
      setPhase('victory')
      return
    }
    const nextIndex = index + 1
    if (playerHealth <= 0 || nextIndex >= drillCount) {
      onBattleResult({ won: false, perfect: false })
      setPhase('defeat')
      return
    }
    setIndex(nextIndex)
    setSelected(null)
    setPhase('question')
  }

  function prepareRematch() {
    setAttempt((value) => value + 1)
    beginBattle()
  }

  return (
    <main className="quest-checkpoint quest-battle-page">
      <header className="quest-topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Quest</button>
        <span>{phase === 'intro' ? 'Guardian gate' : `Battle · Attempt ${attempt}`}</span>
      </header>

      {phase === 'intro' && (
        <section className="quest-checkpoint-card quest-battle-intro">
          <span>QUEST {String(quest.number).padStart(2, '0')} · GUARDIAN</span>
          <div className="quest-guardian-seal" aria-hidden="true">{quest.guardian.mark}</div>
          <p className="quest-guardian-japanese" lang="ja">{quest.guardian.japanese}</p>
          <h1>{quest.guardian.name}</h1><strong>{quest.guardian.title}</strong>
          <p>{quest.guardian.lore}</p>
          <div className="quest-battle-rules"><span>Correct answer = strike</span><span>Wrong answer = take damage</span><span>3 strikes = victory</span></div>
          {hasDawnGuard && <div className="quest-equipped-relic"><b>灯 Morning Lantern equipped</b><span>Blocks the first wrong answer in this guardian battle.</span></div>}
          <button type="button" className="btn btn-primary" onClick={beginBattle}>Draw your blade →</button>
        </section>
      )}

      {(phase === 'question' || phase === 'feedback') && (
        <section className="quest-battle-card">
          <div className="quest-battle-arena" aria-label="Guardian battle">
            <Fighter
              name="You"
              mark="侍"
              portrait="/quest-mascot-battle.png"
              health={playerHealth}
              side="player"
              state={phase === 'feedback' ? lastHitCorrect ? 'attacking' : lastHitBlocked ? 'guarded' : 'hit' : undefined}
            />
            <div className={`quest-battle-clash${phase === 'feedback' ? lastHitCorrect ? ' player-strike' : ' guardian-strike' : ''}`}>対</div>
            <Fighter
              name={quest.guardian.name}
              mark={quest.guardian.mark}
              portrait={quest.guardian.portrait}
              health={guardianHealth}
              side="guardian"
              state={phase === 'feedback' ? lastHitCorrect ? 'hit' : 'attacking' : undefined}
            />
          </div>

          {hasDawnGuard && <div className={`quest-active-relic${dawnGuardUsed ? ' is-spent' : ''}`}><span>灯</span><b>Dawn Guard</b><small>{dawnGuardUsed ? 'Used this battle' : 'Ready · blocks one mistake'}</small></div>}

          <div className="quest-battle-question">
            <header><span>KNOWLEDGE STRIKE {index + 1}</span><small>Choose, then attack.</small></header>
            <p className="quest-checkpoint-clue">“{exercise.english}”</p>
            <p className="quest-checkpoint-prompt" lang="ja">{exercise.prompt}</p>
            <div className="quest-checkpoint-options">
              {exercise.options.map((option) => {
                const state = phase === 'question'
                  ? option === selected ? ' is-selected' : ''
                  : option === exercise.answer ? ' is-correct' : option === selected ? ' is-wrong' : ''
                return <button key={option} type="button" className={state} disabled={phase === 'feedback'} onClick={() => setSelected(option)}>{option}</button>
              })}
            </div>
            {phase === 'question' ? (
              <button type="button" className="btn btn-primary quest-checkpoint-next" disabled={!selected} onClick={strike}>Attack</button>
            ) : (
              <div className={`quest-checkpoint-result${lastHitCorrect ? ' is-correct' : lastHitBlocked ? ' is-blocked' : ' is-wrong'}`}>
                <span>{lastHitCorrect ? 'Clean strike. The guardian’s seal cracks.' : lastHitBlocked ? `The Morning Lantern blocks the counter. The correct form was ${exercise.answer}.` : `The guardian counters. The correct form was ${exercise.answer}.`}</span>
                <button type="button" className="btn btn-primary" onClick={continueBattle}>Continue →</button>
              </div>
            )}
          </div>
        </section>
      )}

      {phase === 'defeat' && (
        <section className="quest-checkpoint-card quest-battle-ending is-defeat">
          <span>THE SEAL HOLDS</span><div className="quest-guardian-seal">影</div>
          <h1>The guardian was stronger this time.</h1>
          <p>You do not lose quest progress. Review the forms that broke your defense, then return for a rematch.</p>
          <button type="button" className="btn btn-primary" onClick={() => setPhase('review')}>Study weak points →</button>
        </section>
      )}

      {phase === 'review' && (
        <section className="quest-checkpoint-card quest-battle-review">
          <span>BEFORE THE REMATCH</span><h1>Sharpen the forms you missed</h1>
          <div className="quest-review-list">
            {missed.map((item) => <article key={item.id}><small>{item.pattern}</small><p lang="ja">{item.prompt.replace('___', item.answer)}</p><span>{item.meaning}</span></article>)}
          </div>
          <button type="button" className="btn btn-primary" onClick={prepareRematch}>Challenge again →</button>
        </section>
      )}

      {phase === 'victory' && (
        <section className="quest-checkpoint-card quest-reward-card quest-battle-ending is-victory">
          <span>GUARDIAN DEFEATED</span><div className="quest-reward-mark">{quest.reward.mark}</div>
          <h1>{quest.reward.name} restored</h1>
          <p><b>{quest.reward.perkTitle} unlocked.</b> {quest.reward.perkDescription} The words return to the story, and the road ahead opens.</p>
          <strong>{missed.length === 0 ? 'Flawless victory' : `Victory on attempt ${attempt}`}</strong>
          <button type="button" className="btn btn-primary" onClick={onComplete}>Claim reward →</button>
        </section>
      )}
    </main>
  )
}

function Fighter({ name, mark, portrait, health, side, state }: { name: string; mark: string; portrait?: string; health: number; side: 'player' | 'guardian'; state?: 'attacking' | 'hit' | 'guarded' }) {
  return (
    <div className={`quest-fighter quest-fighter-${side}${state ? ` is-${state}` : ''}`}>
      <div className="quest-fighter-name"><b>{name}</b><span>{health} / {MAX_HEALTH}</span></div>
      <div className="quest-health"><span style={{ width: `${(health / MAX_HEALTH) * 100}%` }} /></div>
      {portrait
        ? <div className="quest-fighter-portrait-shell"><img className="quest-fighter-portrait" src={portrait} alt="" /></div>
        : <div className="quest-fighter-mark" aria-hidden="true">{mark}</div>}
    </div>
  )
}
