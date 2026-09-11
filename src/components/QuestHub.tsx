import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CAMPAIGN_GOAL, QUESTS, getArcById, isQuestUnlocked, type QuestDefinition } from '../data/questCampaign'
import { completedQuestSteps, isQuestComplete, QUEST_STEPS, type QuestProgress, type QuestStep } from '../lib/questProgress'
import { earnedRelics } from '../lib/relics'
import { displayProfilePhoto, useUserProfile } from '../lib/userProfile'

interface QuestHubProps {
  onOpenInkRoad: () => void
  onOpenVocab: (topicId: string, questId: string) => void
  onOpenKanji: (questId: string) => void
  onOpenGrammar: (questId: string) => void
  onOpenPictures: (questId: string) => void
  onOpenScene: (questId: string) => void
  onOpenCheckpoint: (questId: string) => void
  onOpenProfile: () => void
  onOpenSettings: () => void
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

export function QuestHub({ onOpenInkRoad, onOpenVocab, onOpenKanji, onOpenGrammar, onOpenPictures, onOpenScene, onOpenCheckpoint, onOpenProfile, onOpenSettings, progress }: QuestHubProps) {
  const questComplete = useMemo(() => (questId: string) => isQuestComplete(progress, questId), [progress])
  const unlocked = useMemo(() => QUESTS.filter((quest) => isQuestUnlocked(quest, questComplete)), [questComplete])
  const frontier = unlocked.find((quest) => !questComplete(quest.id)) ?? null
  const featuredQuest = frontier ?? QUESTS[QUESTS.length - 1]!

  const [openQuestId, setOpenQuestId] = useState<string | null>(null)
  const openQuest = QUESTS.find((quest) => quest.id === openQuestId) ?? null
  const [mobileChallengeOpen, setMobileChallengeOpen] = useState(false)

  const relicCount = earnedRelics(progress).length
  const [userProfile] = useUserProfile()

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
    setOpenQuestId(null)
    if (step === 'vocab') onOpenVocab(quest.vocabularySetId, quest.id)
    else if (step === 'kanji') onOpenKanji(quest.id)
    else if (step === 'grammar') onOpenGrammar(quest.id)
    else if (step === 'scene') onOpenScene(quest.id)
    else onOpenCheckpoint(quest.id)
  }

  return (
    <main className="quest-hub quest-trail-page">
      <MobileQuestLanding
        quest={featuredQuest}
        progress={progress}
        profileName={userProfile.name}
        profilePhoto={userProfile.photo}
        onOpenInkRoad={onOpenInkRoad}
        onOpenProfile={onOpenProfile}
        onOpenQuest={() => setOpenQuestId(featuredQuest.id)}
        onOpenSettings={onOpenSettings}
        onOpenChallenge={() => setMobileChallengeOpen(true)}
      />
      {mobileChallengeOpen && (
        <MobileQuestChallengeScreen
          quest={featuredQuest}
          profileName={userProfile.name}
          profilePhoto={userProfile.photo}
          onOpenInkRoad={onOpenInkRoad}
          onOpenProfile={onOpenProfile}
          onOpenQuest={() => setOpenQuestId(featuredQuest.id)}
          onOpenSettings={onOpenSettings}
          progress={progress}
          onOpenStep={(step) => openStep(featuredQuest, step)}
          onOpenPictures={() => onOpenPictures(featuredQuest.id)}
        />
      )}

      {/* The samurai's eyes across the top — the campaign's face before its
          map. */}
      <div className="quest-trail-banner" aria-hidden="true">
        <img src="/quest-banner-eyes.jpg" alt="" />
      </div>

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
                  {isOpen
                    ? (quest.guardian.portrait
                        ? <img className="quest-trail-enemy" src={quest.guardian.portrait} alt="" loading="lazy" />
                        : <span className="quest-trail-enemy-mark" lang="ja">{quest.guardian.mark}</span>)
                    : <span className="quest-trail-symbol-locked">&#x1F512;</span>}
                  {isOpen && (
                    <span className="quest-trail-tag" lang="ja" data-len={quest.symbol.length}>{quest.symbol}</span>
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

function MobileQuestLanding({
  quest,
  progress,
  profileName,
  profilePhoto,
  onOpenInkRoad,
  onOpenProfile,
  onOpenQuest,
  onOpenSettings,
  onOpenChallenge,
}: {
  quest: QuestDefinition
  progress: QuestProgress
  profileName: string
  profilePhoto: string | null
  onOpenInkRoad: () => void
  onOpenProfile: () => void
  onOpenQuest: () => void
  onOpenSettings: () => void
  onOpenChallenge: () => void
}) {
  const nextStep = QUEST_STEPS.find((step) => !progress[quest.id]?.[step]) ?? 'checkpoint'

  return (
    <section className="quest-mobile-landing" aria-label="Featured quest">
      <div className="quest-mobile-frame">
        <img className="quest-mobile-art" src="/quest-mobile-landing.jpg" alt={`${quest.title} featured quest`} />
        <button type="button" className="quest-mobile-profile-button" onClick={onOpenProfile} aria-label="Open profile">
          <img src={displayProfilePhoto(profilePhoto)} alt="" />
        </button>
        <div className="quest-mobile-player-panel">
          <button type="button" className="quest-mobile-name-button" onClick={onOpenProfile}>
            {profileName}
          </button>
          <span className="quest-mobile-level">Lv.1</span>
          <span className="quest-mobile-live-xp" role="img" aria-label="0 of 100 XP">
            <i />
          </span>
          <small>0 / 100 XP</small>
        </div>
        <div className="quest-mobile-soul-balance" aria-label="1240 souls">
          <span lang="ja" aria-hidden="true">魂</span>
          <b>1240</b>
        </div>
        <div className="quest-mobile-motto-cover" aria-hidden="true" />
        <button type="button" className="quest-mobile-hit quest-mobile-hit-ink" onClick={onOpenInkRoad} aria-label="Open Ink Road map" />
        <button type="button" className="quest-mobile-hit quest-mobile-hit-shop" onClick={onOpenQuest} aria-label="Open quest rewards" />
        <button type="button" className="quest-mobile-hit quest-mobile-hit-settings" onClick={onOpenSettings} aria-label="Open settings" />
        <button type="button" className="quest-mobile-hit quest-mobile-hit-challenge" onClick={onOpenChallenge} aria-label={`Open ${quest.title} challenge`} data-next-step={nextStep} />
      </div>
    </section>
  )
}

function MobileQuestChallengeScreen({
  quest,
  profileName,
  profilePhoto,
  onOpenInkRoad,
  onOpenProfile,
  onOpenQuest,
  onOpenSettings,
  progress,
  onOpenStep,
  onOpenPictures,
}: {
  quest: QuestDefinition
  profileName: string
  profilePhoto: string | null
  onOpenInkRoad: () => void
  onOpenProfile: () => void
  onOpenQuest: () => void
  onOpenSettings: () => void
  progress: QuestProgress
  onOpenStep: (step: QuestStep) => void
  onOpenPictures: () => void
}) {
  const stepsDone = completedQuestSteps(progress, quest.id)
  const activeStep = QUEST_STEPS.find((step) => !progress[quest.id]?.[step]) ?? 'checkpoint'
  const showProgress = stepsDone > 0 && !isQuestComplete(progress, quest.id)
  const progressPercent = `${Math.round((stepsDone / QUEST_STEPS.length) * 100)}%`

  return (
    <section className="quest-mobile-challenge-screen" aria-label={`${quest.title} challenge steps`}>
      <div className="quest-mobile-challenge-frame">
        <img className="quest-mobile-challenge-art" src="/quest-mobile-challenge.jpg?v=3" alt={`${quest.title} challenge steps`} />
        <div className="quest-mobile-shared-header" aria-hidden="true" />
        <div className="quest-mobile-soul-balance" aria-label="1240 souls">
          <span lang="ja" aria-hidden="true">魂</span>
          <b>1240</b>
        </div>
        <button type="button" className="quest-mobile-profile-button" onClick={onOpenProfile} aria-label="Open profile">
          <img src={displayProfilePhoto(profilePhoto)} alt="" />
        </button>
        <div className="quest-mobile-player-panel">
          <button type="button" className="quest-mobile-name-button" onClick={onOpenProfile}>
            {profileName}
          </button>
          <span className="quest-mobile-level">Lv.1</span>
          <span className="quest-mobile-live-xp" role="img" aria-label="0 of 100 XP">
            <i />
          </span>
          <small>0 / 100 XP</small>
        </div>
        <button type="button" className="quest-mobile-hit quest-mobile-hit-ink" onClick={onOpenInkRoad} aria-label="Open Ink Road map" />
        <button type="button" className="quest-mobile-hit quest-mobile-hit-shop" onClick={onOpenQuest} aria-label="Open quest rewards" />
        <button type="button" className="quest-mobile-hit quest-mobile-hit-settings" onClick={onOpenSettings} aria-label="Open settings" />
        <button type="button" className="quest-mobile-challenge-row quest-mobile-challenge-row-vocab" onClick={() => onOpenStep('vocab')} aria-label="Open words practice" />
        <button type="button" className="quest-mobile-challenge-row quest-mobile-challenge-row-kanji" onClick={() => onOpenStep('kanji')} aria-label="Open kanji practice" />
        <button type="button" className="quest-mobile-challenge-row quest-mobile-challenge-row-sentences" onClick={() => onOpenStep('grammar')} aria-label="Open sentence practice" />
        <button type="button" className="quest-mobile-challenge-row quest-mobile-challenge-row-pictures" onClick={onOpenPictures} aria-label="Open picture mode" />
        <button type="button" className="quest-mobile-challenge-row quest-mobile-challenge-row-battle" onClick={() => onOpenStep('checkpoint')} aria-label="Open battle challenge" />
        {showProgress && (
          <span
            className={`quest-mobile-step-progress quest-mobile-step-progress-${activeStep}`}
            style={{ '--quest-mobile-step-progress': progressPercent } as CSSProperties}
            role="progressbar"
            aria-label={`${stepsDone} of ${QUEST_STEPS.length} quest steps complete`}
            aria-valuemin={0}
            aria-valuemax={QUEST_STEPS.length}
            aria-valuenow={stepsDone}
          />
        )}
      </div>
    </section>
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
