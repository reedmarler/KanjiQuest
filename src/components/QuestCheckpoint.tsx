import { useMemo, useState } from 'react'
import { getQuestById, type GuardianAttack, type GuardianBattleStyle } from '../data/questCampaign'
import type { DrillExercise } from '../lib/drillExercises'
import { kitsuneLuckChance, perfectEdgeThreshold, twinStrikeInterval, type RelicLoadout } from '../lib/relics'
import { GuardianSprite, hasGuardianSprite } from './GuardianSprite'
import { AppBackButton } from './AppBackButton'

interface QuestCheckpointProps {
  questId?: string
  onBack: () => void
  onDashboard?: () => void
  onComplete: () => void
  loadout: RelicLoadout
  onBattleResult: (result: { won: boolean; perfect: boolean }) => void
}

type BattlePhase = 'intro' | 'question' | 'feedback' | 'phase-break' | 'victory' | 'defeat' | 'review'
/** How a landed hit reads on screen — each tier has its own animation. */
type StrikeTier = 'strike' | 'critical' | 'ultimate'
const BASE_HEALTH = 3

export function QuestCheckpoint({ questId, onBack, onDashboard, onComplete, loadout, onBattleResult }: QuestCheckpointProps) {
  const quest = getQuestById(questId)
  const maxPlayerHealth = BASE_HEALTH + (loadout.ironWill ? 1 : 0)
  const guardianMaxHealth = quest?.guardian.health ?? BASE_HEALTH
  const phases = useMemo(
    () => quest?.guardian.phases ?? [{ name: quest?.guardian.name ?? '', mark: quest?.guardian.mark ?? '', taunt: '' }],
    [quest],
  )
  const guardianAttacks = quest?.guardian.attacks ?? []

  const [phase, setPhase] = useState<BattlePhase>('intro')
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [playerHealth, setPlayerHealth] = useState(maxPlayerHealth)
  const [guardianHealth, setGuardianHealth] = useState(guardianMaxHealth)
  const [missed, setMissed] = useState<DrillExercise[]>([])
  const [lastHitCorrect, setLastHitCorrect] = useState(false)
  const [strikeTier, setStrikeTier] = useState<StrikeTier>('strike')
  const [lastHitBlocked, setLastHitBlocked] = useState(false)
  const [blockReason, setBlockReason] = useState<'dawn-guard' | 'fox-luck' | 'stone' | null>(null)
  const [dawnGuardUsed, setDawnGuardUsed] = useState(false)
  const [changeFateUsed, setChangeFateUsed] = useState(false)
  const [echoUsed, setEchoUsed] = useState(false)
  const [streak, setStreak] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [attempt, setAttempt] = useState(1)
  const [healedNote, setHealedNote] = useState(false)
  const [lastAttack, setLastAttack] = useState<GuardianAttack | null>(null)
  const [pendingPhaseIndex, setPendingPhaseIndex] = useState(0)
  const [echoQueue, setEchoQueue] = useState<DrillExercise[]>([])
  const [rerollBump, setRerollBump] = useState(0)

  if (!quest?.grammarDrills.length) return null
  const drills = quest.grammarDrills
  const guardianBattleStyle = quest.guardian.battleStyle
  // Boss health can exceed the drill count, so questions cycle rather than
  // running out — the battle ends when a health bar empties, not the list.
  const exercise = echoQueue[0] ?? drills[(index + rerollBump) % drills.length]!

  const phaseSize = Math.ceil(guardianMaxHealth / phases.length)
  const phaseIndexFor = (health: number) =>
    health <= 0 ? phases.length - 1 : Math.min(phases.length - 1, phases.length - Math.ceil(health / phaseSize))
  const activePhase = phases[phaseIndexFor(guardianHealth)]!
  const isFinalPhase = phaseIndexFor(guardianHealth) === phases.length - 1

  // Clear Path burns one wrong option off the opening question. Cheap enough
  // to recompute inline, and it must not be a hook — this sits below the
  // early return above, where a conditional hook would break render order.
  const clearPathActive = loadout.clearPath && index === 0 && echoQueue.length === 0
  const droppedOption = clearPathActive ? exercise.options.find((option) => option !== exercise.answer) : undefined
  const visibleOptions = droppedOption ? exercise.options.filter((option) => option !== droppedOption) : exercise.options

  function beginBattle() {
    setIndex(0)
    setSelected(null)
    setPlayerHealth(maxPlayerHealth)
    setGuardianHealth(guardianMaxHealth)
    setMissed([])
    setLastHitCorrect(false)
    setStrikeTier('strike')
    setLastHitBlocked(false)
    setBlockReason(null)
    setDawnGuardUsed(false)
    setChangeFateUsed(false)
    setEchoUsed(false)
    setStreak(0)
    setCorrectCount(0)
    setHealedNote(false)
    setLastAttack(null)
    setEchoQueue([])
    setRerollBump(0)
    setPhase('question')
  }

  function strike() {
    if (!selected || phase !== 'question') return
    const correct = selected === exercise.answer
    setHealedNote(false)

    if (correct) {
      const nextStreak = streak + 1
      const nextCorrect = correctCount + 1
      let damage = 1
      let tier: StrikeTier = 'strike'
      // Twin Strike and Perfect Edge both add a point of damage; either one
      // reads as a critical, and a killing blow always reads as the ultimate.
      if (loadout.twinStrike && nextCorrect % twinStrikeInterval(loadout) === 0) { damage += 1; tier = 'critical' }
      if (loadout.perfectEdge && nextStreak >= perfectEdgeThreshold(loadout)) { damage += 1; tier = 'critical' }
      const remaining = Math.max(0, guardianHealth - damage)
      if (remaining === 0) tier = 'ultimate'

      setStreak(nextStreak)
      setCorrectCount(nextCorrect)
      setGuardianHealth(remaining)
      setStrikeTier(tier)
      setLastHitCorrect(true)
      setLastHitBlocked(false)
      setBlockReason(null)

      // Second Wind tops a heart back up on a two-answer streak.
      if (loadout.secondWind && nextStreak > 0 && nextStreak % 2 === 0 && playerHealth < maxPlayerHealth) {
        setPlayerHealth((health) => Math.min(maxPlayerHealth, health + 1))
        setHealedNote(true)
      }
      setPhase('feedback')
      return
    }

    // Wrong answer — walk the mitigations in order before taking a heart.
    const foxSaved = loadout.kitsuneLuck && Math.random() < kitsuneLuckChance(loadout)
    const dawnSaved = !foxSaved && loadout.dawnGuard && !dawnGuardUsed
    const stoneSaved = !foxSaved && !dawnSaved && loadout.mountainStance && playerHealth === 1 && guardianHealth < guardianMaxHealth
    const blocked = foxSaved || dawnSaved || stoneSaved

    if (dawnSaved) setDawnGuardUsed(true)
    if (!blocked) setPlayerHealth((health) => Math.max(0, health - 1))
    if (!blocked) {
      const attacks = guardianAttacks
      setLastAttack(attacks.length ? attacks[Math.floor(Math.random() * attacks.length)]! : null)
    }

    setStreak(0)
    setLastHitCorrect(false)
    setLastHitBlocked(blocked)
    setBlockReason(foxSaved ? 'fox-luck' : dawnSaved ? 'dawn-guard' : stoneSaved ? 'stone' : null)
    setMissed((items) => (items.some((item) => item.id === exercise.id) ? items : [...items, exercise]))
    // Echo Ward puts the first miss back in the queue for one more attempt.
    if (loadout.wardEcho && !echoUsed && echoQueue.length === 0) {
      setEchoUsed(true)
      setEchoQueue([exercise])
    }
    setPhase('feedback')
  }

  function advanceQuestion() {
    setSelected(null)
    if (echoQueue.length > 0) setEchoQueue((queue) => queue.slice(1))
    else setIndex((value) => value + 1)
    setPhase('question')
  }

  function continueBattle() {
    if (guardianHealth <= 0) {
      onBattleResult({ won: true, perfect: missed.length === 0 })
      setPhase('victory')
      return
    }
    if (playerHealth <= 0) {
      onBattleResult({ won: false, perfect: false })
      setPhase('defeat')
      return
    }
    // A cleared phase gets its own beat before the next question.
    const nextPhaseIndex = phaseIndexFor(guardianHealth)
    if (phases.length > 1 && lastHitCorrect && nextPhaseIndex > pendingPhaseIndex) {
      setPendingPhaseIndex(nextPhaseIndex)
      setPhase('phase-break')
      return
    }
    advanceQuestion()
  }

  function rerollQuestion() {
    if (changeFateUsed || phase !== 'question') return
    setChangeFateUsed(true)
    setSelected(null)
    setRerollBump((value) => value + 1)
  }

  function prepareRematch() {
    setAttempt((value) => value + 1)
    setPendingPhaseIndex(0)
    beginBattle()
  }

  // Camera shake scales with what just landed — a guardian counter rattles
  // the arena too, so taking a hit reads as physical rather than passive.
  const shakeClass = phase !== 'feedback' ? ''
    : lastHitCorrect
      ? strikeTier === 'ultimate' ? ' is-shake-ultimate' : strikeTier === 'critical' ? ' is-shake-heavy' : ' is-shake-light'
      : lastHitBlocked ? '' : ' is-shake-heavy'

  const playerState = phase === 'feedback'
    ? lastHitCorrect ? (strikeTier === 'ultimate' ? 'ultimate' : strikeTier === 'critical' ? 'critical' : 'attacking') : lastHitBlocked ? 'guarded' : 'hit'
    : undefined
  const guardianState = phase === 'feedback'
    ? lastHitCorrect ? (strikeTier === 'ultimate' ? 'ultimate-hit' : strikeTier === 'critical' ? 'critical-hit' : 'hit') : 'attacking'
    : undefined

  return (
    <main className="quest-checkpoint quest-battle-page">
      <header className="quest-topbar">
        <AppBackButton onClick={onBack} aria-label="Back to Quest" />
        {onDashboard && <button type="button" className="btn btn-ghost" onClick={onDashboard}>Dashboard</button>}
        {phase !== 'intro' && <span>{`Battle · Attempt ${attempt}`}</span>}
      </header>

      {phase === 'intro' && (
        <section className="quest-checkpoint-card quest-battle-intro quest-gate-intro">
          <span>QUEST {String(quest.number).padStart(2, '0')} · THE GUARDIAN GATE</span>
          <div className="quest-gate-scene" aria-label={`${quest.guardian.name} waits beyond the gate`}>
            <img className="quest-gate-art" src="/quest-guardian-gate.png" alt="The Kanji Quest samurai faces the guardian beyond a shrine gate" />
            {guardianBattleStyle && quest.guardian.portrait && (
              <img className={`quest-gate-featured-guardian is-${guardianBattleStyle}`} src={quest.guardian.portrait} alt="" />
            )}
          </div>
          <div className={`quest-gate-brief${loadout.relics.length ? '' : ' has-no-relic'}`}>
            <div className="quest-gate-identity">
              <small>GUARDIAN</small>
              <strong><span lang="ja">{quest.guardian.japanese}</span> {quest.guardian.name}</strong>
              <em>{quest.guardian.title}</em>
              <span className="quest-gate-stats">{guardianMaxHealth} seals{phases.length > 1 ? ` · ${phases.length} phases` : ''}</span>
            </div>
            <p className="quest-gate-objective"><small>YOUR OBJECTIVE</small><span>{quest.guardian.lore}</span></p>
            {loadout.relics.length > 0 && (
              <div className="quest-gate-relics">
                <small>RELICS CARRIED</small>
                <div>{loadout.relics.map((relic) => <span key={relic.perk} title={relic.description}>{relic.mark} {relic.title}</span>)}</div>
              </div>
            )}
          </div>
          <div className="quest-gate-battle-guide">
            <small>BREAK THE SEAL</small>
            <div><span><b>1</b> Correct → strike</span><span><b>2</b> Wrong → counter</span><span><b>3</b> Empty the seal bar</span></div>
          </div>
          <button type="button" className="btn btn-primary" onClick={beginBattle}>Draw your blade →</button>
        </section>
      )}

      {(phase === 'question' || phase === 'feedback') && (
        <section className="quest-battle-card">
          <div className={`quest-battle-arena${guardianBattleStyle ? ` is-guardian-${guardianBattleStyle}` : ''}${isFinalPhase && phases.length > 1 ? ' is-final-phase' : ''}${shakeClass}`} aria-label="Guardian battle">
            {/* Charge glow telegraphs that the next clean hit ends the fight. */}
            {phase === 'question' && guardianHealth === 1 && <span className="quest-ultimate-charge" aria-hidden="true" />}
            {phase === 'feedback' && lastHitCorrect && strikeTier !== 'strike' && (
              <span className={`quest-impact-flare${strikeTier === 'ultimate' ? ' is-ultimate' : ''}`} aria-hidden="true" />
            )}
            {phase === 'feedback' && lastHitCorrect && (
              <span className="quest-speed-lines" aria-hidden="true"><i /><i /><i /><i /></span>
            )}
            {phase === 'feedback' && !lastHitCorrect && !lastHitBlocked && guardianBattleStyle && (
              <GuardianAttackEffect style={guardianBattleStyle} />
            )}
            <Fighter
              name="You" mark="侍" portrait="/quest-mascot-battle.png"
              health={playerHealth} maxHealth={maxPlayerHealth} side="player" state={playerState}
            />
            <div className={`quest-battle-clash${phase === 'feedback' ? (strikeTier === 'ultimate' && lastHitCorrect ? ' kanji-ultimate' : strikeTier === 'critical' && lastHitCorrect ? ' kanji-critical' : lastHitCorrect ? ' player-strike' : ' guardian-strike') : ''}`}>
              {phase === 'feedback' && lastHitCorrect && strikeTier !== 'strike' ? (strikeTier === 'ultimate' ? '斬' : '連') : '対'}
            </div>
            <Fighter
              name={activePhase.name || quest.guardian.name} mark={activePhase.mark || quest.guardian.mark} portrait={quest.guardian.portrait}
              health={guardianHealth} maxHealth={guardianMaxHealth} side="guardian" state={guardianState} tier={strikeTier}
              spriteQuestId={quest.id} phaseIndex={phaseIndexFor(guardianHealth)} guardianStyle={guardianBattleStyle}
            />
          </div>

          {streak >= 2 && phase === 'question' && (
            <div className="quest-combo-meter" aria-live="polite"><b>{streak}</b><small>answer streak</small>
              {loadout.perfectEdge && <em>{streak + 1 >= perfectEdgeThreshold(loadout) ? 'Perfect Edge ready' : 'Building Perfect Edge'}</em>}
            </div>
          )}

          <div className="quest-relic-tray" aria-label="Relic status">
            {loadout.dawnGuard && <span className={dawnGuardUsed ? 'is-spent' : ''}>灯 Dawn Guard</span>}
            {loadout.wardEcho && <span className={echoUsed ? 'is-spent' : ''}>響 Echo Ward</span>}
            {loadout.changeFate && (
              <button type="button" disabled={changeFateUsed || phase !== 'question'} onClick={rerollQuestion} className={changeFateUsed ? 'is-spent' : 'is-usable'}>
                護 {changeFateUsed ? 'Fate spent' : 'Change Fate'}
              </button>
            )}
          </div>

          <div className="quest-battle-question">
            {echoQueue.length > 0 && <span className="quest-echo-flag">響 Echo Ward · second chance</span>}
            <p className="quest-checkpoint-clue">“{exercise.english}”</p>
            <p className="quest-checkpoint-prompt" lang="ja">{exercise.prompt}</p>
            {loadout.trueSight && <p className="quest-truth-hint">真 {exercise.pattern} — {exercise.meaning}</p>}
            <div className="quest-checkpoint-options">
              {visibleOptions.map((option) => {
                const state = phase === 'question'
                  ? option === selected ? ' is-selected' : ''
                  : option === exercise.answer ? ' is-correct' : option === selected ? ' is-wrong' : ''
                return <button key={option} type="button" className={state} disabled={phase === 'feedback'} onClick={() => setSelected(option)}>{option}</button>
              })}
            </div>
            <div className={`quest-battle-action-slot${phase === 'feedback' ? ' is-feedback' : ''}`}>
              {phase === 'feedback' && (
                <span className={`quest-battle-action-message${lastHitCorrect ? ' is-correct' : lastHitBlocked ? ' is-blocked' : ' is-wrong'}`}>
                  {lastHitCorrect
                    ? strikeTier === 'ultimate' ? 'KANJI SLASH! The final seal shatters.'
                      : strikeTier === 'critical' ? 'DOUBLE STRIKE! The seal splits twice over.'
                      : 'Clean strike. The guardian’s seal cracks.'
                    : blockReason === 'fox-luck' ? `Fox Luck turns the blow aside. The correct form was ${exercise.answer}.`
                      : blockReason === 'dawn-guard' ? `The Morning Lantern blocks the counter. The correct form was ${exercise.answer}.`
                      : blockReason === 'stone' ? `Stone Stance holds your last heart. The correct form was ${exercise.answer}.`
                      : `${lastAttack ? `${lastAttack.name}（${lastAttack.japanese}）— ${lastAttack.flavor} ` : 'The guardian counters. '}The correct form was ${exercise.answer}.`}
                  {healedNote && <em className="quest-heal-note"> Second Wind restores a heart.</em>}
                </span>
              )}
              <button
                type="button"
                className={`btn btn-primary quest-checkpoint-next${phase === 'question' && guardianHealth === 1 ? ' is-ultimate-ready' : ''}`}
                disabled={phase === 'question' && !selected}
                onClick={phase === 'question' ? strike : continueBattle}
              >
                {phase === 'question' ? guardianHealth === 1 ? 'Kanji Slash' : 'Attack' : guardianHealth <= 0 ? 'Claim victory →' : 'Continue →'}
              </button>
            </div>
          </div>
        </section>
      )}

      {phase === 'phase-break' && (
        <section className="quest-checkpoint-card quest-phase-break">
          <span>PHASE {pendingPhaseIndex + 1} OF {phases.length}</span>
          <div className="quest-phase-mark" aria-hidden="true">{phases[pendingPhaseIndex]?.mark}</div>
          <h1>{phases[pendingPhaseIndex]?.name}</h1>
          <p>{phases[pendingPhaseIndex]?.taunt}</p>
          <button type="button" className="btn btn-primary" onClick={advanceQuestion}>Hold your stance →</button>
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

function Fighter({ name, mark, portrait, health, maxHealth, side, state, tier, spriteQuestId, phaseIndex, guardianStyle }: {
  name: string; mark: string; portrait?: string; health: number; maxHealth: number
  side: 'player' | 'guardian'
  state?: 'attacking' | 'critical' | 'hit' | 'guarded' | 'ultimate' | 'ultimate-hit' | 'critical-hit'
  tier?: StrikeTier
  /** Quest id selects which yōkai SVG to draw for the guardian. */
  spriteQuestId?: string
  phaseIndex?: number
  guardianStyle?: GuardianBattleStyle
}) {
  const useSprite = side === 'guardian' && !portrait && hasGuardianSprite(spriteQuestId)
  // The guardian's own recoil animation is driven by the sprite, so map the
  // battle state onto the sprite's vocabulary rather than the portrait's.
  const spriteState = state === 'ultimate-hit' ? 'ultimate-hit'
    : state === 'critical-hit' ? 'critical-hit'
    : state === 'hit' ? 'hit'
    : state === 'attacking' ? 'attacking'
    : undefined
  const overlays = side === 'guardian' && (
    <>
      {state === 'ultimate-hit' && <KanjiSlashEffect />}
      {state === 'critical-hit' && <DoubleStrikeEffect />}
    </>
  )

  return (
    <div className={`quest-fighter quest-fighter-${side}${guardianStyle ? ` has-featured-art is-${guardianStyle}` : ''}${state ? ` is-${state}` : ''}`}>
      <div className="quest-fighter-name"><b>{name}</b><span>{health} / {maxHealth}</span></div>
      <div className="quest-health"><span style={{ width: `${(health / maxHealth) * 100}%` }} /></div>
      {useSprite
        ? <div className="quest-fighter-sprite-shell">
            <GuardianSprite questId={spriteQuestId!} label={name} state={spriteState} phase={phaseIndex} />
            {overlays}
          </div>
        : portrait
          ? <div className="quest-fighter-portrait-shell">
              <img className="quest-fighter-portrait" src={portrait} alt="" />
              {overlays}
            </div>
          : <div className="quest-fighter-mark-shell">
              <div className="quest-fighter-mark" aria-hidden="true">{mark}</div>
              {overlays}
            </div>}
      {tier === 'ultimate' && side === 'guardian' && state === 'ultimate-hit' && <span className="quest-shockwave" aria-hidden="true" />}
    </div>
  )
}

function KanjiSlashEffect() {
  return <div className="quest-kanji-slash" aria-hidden="true"><i className="slash-one" /><i className="slash-two" /><b>斬</b><i className="slash-final" /><span /><span /><span /><span /></div>
}

function DoubleStrikeEffect() {
  return <div className="quest-double-strike" aria-hidden="true"><i /><i /><b>連</b></div>
}

function GuardianAttackEffect({ style }: { style: GuardianBattleStyle }) {
  return <div className={`quest-guardian-attack is-${style}`} aria-hidden="true"><i /><i /><span /><span /><span /></div>
}
