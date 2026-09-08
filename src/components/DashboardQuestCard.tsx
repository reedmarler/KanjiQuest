import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { QUESTS } from '../data/questCampaign'
import {
  completedQuestSteps,
  isQuestComplete,
  QUEST_STEPS,
  type QuestProgress,
  type QuestStep,
} from '../lib/questProgress'
import { useDailyGoals } from '../lib/dailyGoals'

type DashboardQuestCardProps = {
  questProgress: QuestProgress
  progressPct: number
  questsCleared: number
  wrongCount: number
  onContinueStudy: () => void
  onOpenQuests: () => void
  onOpenStudyTools: () => void
}

// One short line naming the step that's up next.
const QUEST_STEP_PREVIEW: Record<QuestStep, { title: string; hint: string }> = {
  vocab: { title: 'Prepare', hint: 'Learn the words for this scene.' },
  kanji: { title: 'Read kanji', hint: 'The kanji from those same words.' },
  grammar: { title: 'Use grammar', hint: 'The forms this scene runs on.' },
  scene: { title: 'Read the scene', hint: 'Read the story you prepared for.' },
  checkpoint: { title: 'Guardian battle', hint: 'Prove it and break the seal.' },
}

const SESSION_KEY = 'kq-dashboard-quest-steps'

/** A muted torii-and-road still that sits behind the card content. */
function QuestScene() {
  return (
    <svg
      className="dashboard-quest-scene"
      viewBox="0 0 400 128"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dq-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--kyogre-light)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--kyogre)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="128" fill="url(#dq-sky)" />
      <path d="M0 104 Q90 80 190 96 T400 88 V128 H0 Z" fill="var(--surface-2)" opacity="0.55" />
      <path d="M148 128 L184 60 H216 L252 128 Z" fill="var(--surface)" opacity="0.6" />
      <path
        d="M148 128 L184 60 M252 128 L216 60"
        stroke="var(--text-muted)"
        strokeOpacity="0.16"
        strokeWidth="1.5"
      />
      <g stroke="var(--sakura)" strokeOpacity="0.32" strokeWidth="4" fill="none" strokeLinecap="round">
        <path d="M300 40 H368" />
        <path d="M295 53 H373" />
        <path d="M312 53 V100" />
        <path d="M356 53 V100" />
      </g>
    </svg>
  )
}

/** A single traveler bead threaded on a short cord. */
function TravelerBead({ className = '' }: { className?: string }) {
  return (
    <span className={`dashboard-quest-bead${className ? ` ${className}` : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 20">
        <line x1="1" y1="7" x2="23" y2="13" />
        <ellipse cx="12" cy="10" rx="5.4" ry="6.4" />
        <ellipse className="dashboard-quest-bead-glint" cx="10.2" cy="8" rx="1.3" ry="1.8" />
      </svg>
    </span>
  )
}

export function DashboardQuestCard({
  questProgress,
  progressPct,
  questsCleared,
  wrongCount,
  onContinueStudy,
  onOpenQuests,
  onOpenStudyTools,
}: DashboardQuestCardProps) {
  const { percent: dailyGoalPct } = useDailyGoals()
  const dailyDone = dailyGoalPct >= 100
  const [cordOpen, setCordOpen] = useState(false)
  const [beadLanded, setBeadLanded] = useState(false)

  const nextQuest = useMemo(
    () => QUESTS.find((quest) => !isQuestComplete(questProgress, quest.id)),
    [questProgress],
  )
  const stepsDone = nextQuest ? completedQuestSteps(questProgress, nextQuest.id) : 0
  const nextStep = nextQuest
    ? QUEST_STEPS.find((step) => !questProgress[nextQuest.id]?.[step]) ?? QUEST_STEPS[QUEST_STEPS.length - 1]!
    : undefined
  const stepsLeft = QUEST_STEPS.length - stepsDone
  const questMinutes = Math.max(3, stepsLeft * 3)
  const arcQuests = nextQuest ? QUESTS.filter((quest) => quest.arcId === nextQuest.arcId) : []
  const arcCleared = arcQuests.filter((quest) => isQuestComplete(questProgress, quest.id)).length

  // Play the bead-lands flourish once, when this quest gained a step since the
  // dashboard was last shown this session.
  useEffect(() => {
    if (!nextQuest) return
    let seen: Record<string, number> = {}
    try {
      seen = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}') as Record<string, number>
    } catch {
      seen = {}
    }
    const before = seen[nextQuest.id] ?? 0
    let timer: number | undefined
    if (stepsDone > before) {
      setBeadLanded(true)
      timer = window.setTimeout(() => setBeadLanded(false), 1500)
    }
    seen[nextQuest.id] = stepsDone
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(seen))
    } catch {
      /* private mode / full store — the flourish just won't fire */
    }
    return () => window.clearTimeout(timer)
  }, [nextQuest, stepsDone])

  const cordBeadCount = Math.max(1, Math.min(questsCleared, 6))

  if (!nextQuest) {
    return (
      <section className="dashboard-quest-card is-complete" aria-label="Campaign complete">
        <QuestScene />
        <div className="dashboard-quest-head">
          <span className="dashboard-quest-mark" aria-hidden="true" lang="ja">祝</span>
          <div className="dashboard-quest-id">
            <span className="dashboard-quest-eyebrow">Campaign</span>
            <b className="dashboard-quest-title">Every seal is broken</b>
            <span className="dashboard-quest-guardian">All {QUESTS.length} quests cleared</span>
          </div>
        </div>
        <button type="button" className="dashboard-quest-continue is-quiet" onClick={onOpenQuests}>
          <span className="dashboard-quest-continue-mark" aria-hidden="true" lang="ja">続</span>
          <span className="dashboard-quest-continue-copy">
            <b>Replay a quest</b>
            <small>Open the campaign map</small>
          </span>
          <span className="dashboard-quest-go" aria-hidden="true">&#8250;</span>
        </button>
      </section>
    )
  }

  const pathFraction = stepsDone / (QUEST_STEPS.length - 1)

  return (
    <section
      className={`dashboard-quest-card${dailyDone ? ' is-daily-done' : ''}${beadLanded ? ' is-fresh' : ''}`}
      aria-label="Next quest"
    >
      <QuestScene />

      <button
        type="button"
        className="dashboard-quest-head"
        onClick={onOpenQuests}
        aria-label={`Open quest: ${nextQuest.title}`}
      >
        <span className="dashboard-quest-mark" aria-hidden="true" lang="ja">{nextQuest.symbol}</span>
        <div className="dashboard-quest-id">
          <span className="dashboard-quest-eyebrow">Quest #{nextQuest.number} · {nextQuest.level}</span>
          <b className="dashboard-quest-title">{nextQuest.title}</b>
          <span className="dashboard-quest-sub">
            <span className="dashboard-quest-stamp" aria-hidden="true">{arcCleared}/{arcQuests.length}</span>
            <span className="dashboard-quest-guardian">
              Guardian · {nextQuest.guardian.name} · {nextQuest.guardian.title}
            </span>
          </span>
        </div>
        <span className="dashboard-quest-go" aria-hidden="true">&#8250;</span>
      </button>

      <button
        type="button"
        className="dashboard-quest-cord"
        onClick={() => setCordOpen((open) => !open)}
        aria-label={`${questsCleared} traveler beads earned`}
      >
        <span className="dashboard-quest-cord-beads" aria-hidden="true">
          {Array.from({ length: cordBeadCount }).map((_, index) => (
            <i key={index} className={questsCleared === 0 ? 'is-empty' : undefined} />
          ))}
        </span>
        {cordOpen && <span className="dashboard-quest-cord-count">{questsCleared}</span>}
      </button>

      <div
        className="dashboard-quest-path"
        role="img"
        aria-label={`${stepsDone} of ${QUEST_STEPS.length} steps done`}
        style={{ '--path-pct': String(pathFraction) } as CSSProperties}
      >
        {QUEST_STEPS.map((step, index) => {
          const done = index < stepsDone
          const isNext = index === stepsDone
          const isPrize = index === QUEST_STEPS.length - 1
          return (
            <span
              key={step}
              className={`dashboard-quest-node${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}${isPrize ? ' is-prize' : ''}`}
            >
              {isPrize && <TravelerBead className="dashboard-quest-node-bead" />}
            </span>
          )
        })}
      </div>

      <p className="dashboard-quest-upnext">
        <em>Up next</em>
        {nextStep
          ? <>{QUEST_STEP_PREVIEW[nextStep].title} — {QUEST_STEP_PREVIEW[nextStep].hint}</>
          : nextQuest.subtitle}
      </p>

      <button
        type="button"
        className={`dashboard-quest-continue${dailyDone ? ' is-quiet' : ''}`}
        onClick={onContinueStudy}
      >
        <span className="dashboard-quest-continue-mark" aria-hidden="true" lang="ja">続</span>
        <span className="dashboard-quest-continue-copy">
          <b>Continue Quest</b>
          <small>{stepsLeft === 1 ? '1 step left' : `${stepsLeft} steps left`} · ~{questMinutes} min</small>
        </span>
        <TravelerBead className="dashboard-quest-continue-bead" />
        <span className="dashboard-quest-go" aria-hidden="true">&#8250;</span>
      </button>

      <div className="dashboard-quest-stats">
        <button type="button" onClick={onOpenStudyTools}><b>{progressPct}%</b> cards</button>
        <button type="button" onClick={onOpenQuests}><b>{questsCleared}/{QUESTS.length}</b> quests</button>
        <button type="button" onClick={onOpenStudyTools}><b>{wrongCount}</b> review</button>
      </div>
    </section>
  )
}
