import type { CSSProperties } from 'react'
import { DAILY_GOALS, type DailyGoalId, useDailyGoals } from '../lib/dailyGoals'
import { loadStats } from '../lib/storage'
import { AppBackButton } from './AppBackButton'

export function DailyGoalsPage({
  onBack,
  onOpenGoal,
}: {
  onBack: () => void
  onOpenGoal: (id: DailyGoalId) => void
}) {
  const { goals, doneCount, percent, toggleGoal, completeGoal, isDone } = useDailyGoals()
  const total = DAILY_GOALS.length
  const remaining = total - doneCount
  const allDone = remaining === 0
  const nextGoal = goals.find((goal) => !isDone(goal.id))
  const streak = loadStats().streak

  function openGoal(id: DailyGoalId) {
    completeGoal(id)
    onOpenGoal(id)
  }

  return (
    <main className="account-page daily-quests-page">
      <header className="account-page-heading">
        <AppBackButton onClick={onBack} aria-label="Back" />
        <h1>Daily quests</h1>
      </header>

      <section className={`daily-quests-hero${allDone ? ' is-complete' : ''}`}>
        <div
          className={`daily-quests-ring${allDone ? ' is-complete' : ''}`}
          style={{ '--progress-pct': `${percent}%` } as CSSProperties}
          aria-hidden="true"
        >
          <span>{allDone ? '完' : '日'}</span>
        </div>
        <div className="daily-quests-hero-copy">
          <small>{allDone ? 'Daily seal earned' : `${doneCount} of ${total} complete`}</small>
          <h2>{allDone ? 'Route complete' : `${remaining} stop${remaining === 1 ? '' : 's'} to go`}</h2>
          <p>
            {allDone
              ? 'Come back tomorrow for a fresh route.'
              : streak > 0
                ? `Keep your ${streak}-day rhythm moving.`
                : 'Complete the route and start your rhythm.'}
          </p>
          <div className="daily-quests-meter" aria-hidden="true">
            <i style={{ '--progress-pct': `${percent}%` } as CSSProperties} />
          </div>
          {nextGoal && (
            <button type="button" className="daily-quests-continue" onClick={() => openGoal(nextGoal.id)}>
              <span>Continue route</span>
              <b aria-hidden="true">&rarr;</b>
            </button>
          )}
        </div>
      </section>

      <section className="daily-quests-route" aria-label="Daily quests">
        <header className="daily-quests-route-heading">
          <div>
            <span>DAILY ROUTE</span>
            <h2>Five small wins</h2>
          </div>
          <b>{doneCount}/{total}</b>
        </header>
        <div className="daily-quests-board">
          {goals.map((goal, index) => {
            const done = isDone(goal.id)
            const isNext = goal.id === nextGoal?.id
            return (
              <article key={goal.id} className={`daily-quest-row${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}>
                <span className="daily-quest-step" aria-hidden="true">{done ? '✓' : String(index + 1).padStart(2, '0')}</span>
                <button
                  type="button"
                  className="daily-quest-check"
                  onClick={() => toggleGoal(goal.id)}
                  aria-pressed={done}
                  aria-label={done ? `Mark ${goal.title} as not done` : `Mark ${goal.title} as done`}
                >
                  <span aria-hidden="true">{done ? '✓' : ''}</span>
                </button>
                <button
                  type="button"
                  className="daily-quest-open"
                  onClick={() => openGoal(goal.id)}
                >
                  <span className="daily-quest-mark" aria-hidden="true">{goal.mark}</span>
                  <span className="daily-quest-text">
                    <b>{goal.title}</b>
                    <small>{goal.detail}</small>
                  </span>
                  <em>{done ? 'Replay' : isNext ? 'Start' : 'Open'}</em>
                </button>
              </article>
            )
          })}
        </div>
      </section>

      <section className={`daily-quests-reward${allDone ? ' is-earned' : ''}`} aria-live="polite">
        <span className="daily-quests-reward-mark" aria-hidden="true">{allDone ? '完' : '印'}</span>
        <div>
          <small>{allDone ? 'EARNED' : 'ROUTE REWARD'}</small>
          <b>{allDone ? 'Daily seal collected' : 'Daily completion seal'}</b>
          <p>{allDone ? 'Your full route is complete.' : `${remaining} quest${remaining === 1 ? '' : 's'} remaining to unlock it.`}</p>
        </div>
      </section>
    </main>
  )
}
