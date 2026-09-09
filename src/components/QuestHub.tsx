import { useEffect, useMemo, useRef, useState } from 'react'
import { CAMPAIGN_GOAL, QUESTS, getArcById, isQuestUnlocked, type QuestDefinition } from '../data/questCampaign'
import { completedQuestSteps, isQuestComplete, QUEST_STEPS, type QuestProgress, type QuestStep } from '../lib/questProgress'
import { earnedRelics } from '../lib/relics'

interface QuestHubProps {
  onOpenInkRoad: () => void
  onOpenVocab: (topicId: string, questId: string) => void
  onOpenKanji: (questId: string) => void
  onOpenGrammar: (questId: string) => void
  onOpenScene: (questId: string) => void
  onOpenCheckpoint: (questId: string) => void
  progress: QuestProgress
}

/**
 * The five things a quest asks of you, each as a single kanji so the hub can
 * show what a quest involves without a line of prose per stop: 語 learn the
 * words, 漢 read its kanji, 文 drill its grammar, 話 read the scene, 戦 face
 * the guardian.
 */
const STEP_DETAILS: ReadonlyArray<{ id: QuestStep; number: string; title: string; glyph: string }> = [
  { id: 'vocab', number: '01', title: 'Prepare', glyph: '語' },
  { id: 'kanji', number: '02', title: 'Read kanji', glyph: '漢' },
  { id: 'grammar', number: '03', title: 'Use grammar', glyph: '文' },
  { id: 'scene', number: '04', title: 'Read scene', glyph: '話' },
  { id: 'checkpoint', number: '05', title: 'Guardian battle', glyph: '戦' },
]

export function QuestHub({ onOpenInkRoad, onOpenVocab, onOpenKanji, onOpenGrammar, onOpenScene, onOpenCheckpoint, progress }: QuestHubProps) {
  const questComplete = useMemo(() => (questId: string) => isQuestComplete(progress, questId), [progress])
  const unlocked = useMemo(() => QUESTS.filter((quest) => isQuestUnlocked(quest, questComplete)), [questComplete])
  const frontier = unlocked.find((quest) => !questComplete(quest.id)) ?? null

  const [openQuestId, setOpenQuestId] = useState<string | null>(null)
  const openQuest = QUESTS.find((quest) => quest.id === openQuestId) ?? null

  const relicCount = earnedRelics(progress).length

  /*
   * The only "movement" this menu shows: when a quest flips to complete, its
   * stop settles with a small pop and the one after it pings awake a moment
   * later. Walking the road itself is what the study screens are for — this
   * is just the map noticing that you did.
   */
  const [justCleared, setJustCleared] = useState<string | null>(null)
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null)
  const prevProgress = useRef(progress)

  useEffect(() => {
    const prev = prevProgress.current
    prevProgress.current = progress
    if (prev === progress) return

    const cleared = QUESTS.find((quest) => !isQuestComplete(prev, quest.id) && isQuestComplete(progress, quest.id))
    if (!cleared) return
    setJustCleared(cleared.id)

    const next = QUESTS.find((quest) => quest.number === cleared.number + 1)
    if (!next) return
    const timer = window.setTimeout(() => setJustUnlocked(next.id), 550)
    return () => window.clearTimeout(timer)
  }, [progress])

  const openStep = (quest: QuestDefinition, step: QuestStep) => {
    if (step === 'vocab') onOpenVocab(quest.vocabularySetId, quest.id)
    else if (step === 'kanji') onOpenKanji(quest.id)
    else if (step === 'grammar') onOpenGrammar(quest.id)
    else if (step === 'scene') onOpenScene(quest.id)
    else onOpenCheckpoint(quest.id)
  }

  return (
    <main className="quest-hub quest-trail-page">
      {/* Header is a picture, not a sentence: the lantern mark, how much of it
          is relit, and a shortcut to the illustrated map. */}
      <header className="quest-trail-goal">
        <span className="quest-trail-goal-mark" aria-hidden="true">{CAMPAIGN_GOAL.mark}</span>
        <div
          className="quest-trail-goal-meter"
          role="img"
          aria-label={`${CAMPAIGN_GOAL.title}: ${relicCount} of ${QUESTS.length} seals recovered`}
        >
          <i style={{ width: `${(relicCount / QUESTS.length) * 100}%` }} />
        </div>
        <b className="quest-trail-goal-count" aria-hidden="true">{relicCount}<span>/{QUESTS.length}</span></b>
        <button type="button" className="quest-trail-map-link" onClick={onOpenInkRoad} aria-label="Preview the illustrated Ink Road map">
          <span aria-hidden="true">&#x26E9;</span>
        </button>
      </header>

      {/* One continuous road for the whole campaign. Each stop shows its own
          kanji, the guardian waiting there, and which of its five steps are
          done — enough to pick where to go without reading a brief. Tapping
          one opens its sheet; nothing else loads until then. */}
      <ol className="quest-trail" aria-label="Quest path">
        {QUESTS.map((quest, index) => {
          const isOpen = isQuestUnlocked(quest, questComplete)
          const done = questComplete(quest.id)
          const isCurrent = frontier?.id === quest.id
          const isFinale = quest.number === QUESTS.length
          const previousArcId = index > 0 ? QUESTS[index - 1]!.arcId : null
          const gate = quest.arcId !== previousArcId ? getArcById(quest.arcId) : undefined
          const stepsDone = STEP_DETAILS.filter((step) => progress[quest.id]?.[step.id]).length

          return (
            <li key={quest.id}>
              {gate && (
                <div className="quest-trail-gate" role="separator" aria-label={gate.title}>
                  <span aria-hidden="true">{gate.mark}</span>
                </div>
              )}
              <button
                type="button"
                disabled={!isOpen}
                onClick={() => setOpenQuestId(quest.id)}
                aria-pressed={openQuestId === quest.id}
                aria-label={isOpen
                  ? `${quest.title}, ${quest.level}, ${stepsDone} of ${STEP_DETAILS.length} steps done${done ? ', complete' : isCurrent ? ', current' : ''}`
                  : `Quest ${quest.number}, locked`}
                onAnimationEnd={() => {
                  if (justCleared === quest.id) setJustCleared(null)
                  if (justUnlocked === quest.id) setJustUnlocked(null)
                }}
                className={`quest-trail-stop${done ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}${isFinale ? ' is-finale' : ''}${!isOpen ? ' is-locked' : ''}${justCleared === quest.id ? ' is-just-cleared' : ''}${justUnlocked === quest.id ? ' is-just-unlocked' : ''}`}
              >
                <span className="quest-trail-node" aria-hidden="true">{done ? '✓' : quest.number}</span>

                <span className="quest-trail-symbol" aria-hidden="true">
                  <span className="quest-trail-symbol-kanji" lang="ja" data-len={quest.symbol.length}>
                    {isOpen ? quest.symbol : '🔒'}
                  </span>
                  {isOpen && (
                    <span className="quest-trail-guardian">
                      {quest.guardian.portrait
                        ? <img src={quest.guardian.portrait} alt="" />
                        : <span lang="ja">{quest.guardian.mark}</span>}
                    </span>
                  )}
                  {isFinale && <span className="quest-trail-finale" aria-hidden="true">&#x2605;</span>}
                </span>

                <span className="quest-trail-steps" aria-hidden="true">
                  {STEP_DETAILS.map((step, stepIndex) => (
                    <i
                      key={step.id}
                      className={`quest-trail-step${isOpen && stepIndex < stepsDone ? ' is-done' : ''}${isOpen && stepIndex === stepsDone && !done ? ' is-next' : ''}`}
                      lang="ja"
                    >
                      {isOpen ? step.glyph : ''}
                    </i>
                  ))}
                </span>

                <span className={`quest-trail-level lvl-${quest.level}`} aria-hidden="true">{quest.level}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {openQuest && (
        <QuestSheet
          quest={openQuest}
          progress={progress}
          onClose={() => setOpenQuestId(null)}
          onOpenStep={(step) => openStep(openQuest, step)}
        />
      )}
    </main>
  )
}

function QuestSheet({
  quest,
  progress,
  onClose,
  onOpenStep,
}: {
  quest: QuestDefinition
  progress: QuestProgress
  onClose: () => void
  onOpenStep: (step: QuestStep) => void
}) {
  const completed = completedQuestSteps(progress, quest.id)
  const finished = isQuestComplete(progress, quest.id)
  const nextStep = QUEST_STEPS.find((step) => !progress[quest.id]?.[step]) ?? 'checkpoint'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div className="quest-sheet-backdrop" onClick={onClose}>
      <div
        className="quest-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="quest-sheet-head">
          <span>QUEST {String(quest.number).padStart(2, '0')} · {quest.level} · {completed}/{STEP_DETAILS.length} steps</span>
          <button type="button" className="quest-sheet-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <h2 id="quest-sheet-title">{quest.title}<small lang="ja">{quest.symbol}</small></h2>
        <p className="quest-sheet-subtitle">{quest.subtitle}</p>

        <div className="quest-sheet-patron">
          <span className="quest-sheet-patron-role">{quest.patron.role} asks</span>
          <p>“{quest.patron.request}”</p>
          <span className="quest-sheet-patron-name">— {quest.patron.name}</span>
        </div>

        <div className="quest-sheet-threat">
          <span className="quest-sheet-threat-portrait">
            {quest.guardian.portrait
              ? <img src={quest.guardian.portrait} alt="" />
              : <strong aria-hidden="true">{quest.guardian.mark}</strong>}
          </span>
          <div className="quest-sheet-threat-copy">
            <small>{finished ? 'DEFEATED' : 'GUARDIAN'}</small>
            <b>{quest.guardian.name}</b>
            <span>{quest.guardian.title}</span>
          </div>
        </div>

        <div className="quest-sheet-steps" role="group" aria-label={`${completed} of ${STEP_DETAILS.length} steps complete`}>
          {STEP_DETAILS.map((step) => {
            const isDone = Boolean(progress[quest.id]?.[step.id])
            const isNext = !finished && step.id === nextStep
            return (
              <button
                key={step.id}
                type="button"
                disabled={!(isDone || isNext)}
                className={`quest-sheet-pip${isDone ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}
                title={step.title}
                aria-label={`${step.title}${isDone ? ', complete' : isNext ? ', up next' : ', locked'}`}
                onClick={() => onOpenStep(step.id)}
              >
                {isDone ? '✓' : step.number}
              </button>
            )
          })}
        </div>

        <div className="quest-sheet-footer">
          <div className="quest-sheet-reward">
            <span aria-hidden="true">{quest.reward.mark}</span>
            <div>
              <small>{finished ? 'RELIC RECOVERED' : 'REWARD'}</small>
              <b>{quest.reward.name}</b>
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => onOpenStep(nextStep)}>
            {finished ? 'Review' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
