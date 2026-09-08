import type { CSSProperties } from 'react'
import { DAILY_GOALS, type DailyGoalId, useDailyGoals } from '../lib/dailyGoals'
import { AppBackButton } from './AppBackButton'

export function DailyGoalsPage({
  onBack,
  onOpenGoal,
}: {
  onBack: () => void
  onOpenGoal: (id: DailyGoalId) => void
}) {
  const { doneCount, percent, toggleGoal, completeGoal, isDone } = useDailyGoals()

  return (
    <main className="account-page">
      <header className="account-page-heading">
        <AppBackButton onClick={onBack} aria-label="Back" />
        <small>Today</small>
        <h1>Daily quests</h1>
        <p>{doneCount}/{DAILY_GOALS.length} done</p>
      </header>

      <div className="account-goal-meter" aria-hidden="true">
        <i style={{ '--progress-pct': `${percent}%` } as CSSProperties} />
      </div>

      <section className="account-goal-list" aria-label="Daily quests">
        {DAILY_GOALS.map((goal) => {
          const done = isDone(goal.id)
          return (
            <article key={goal.id} className={`account-goal-card${done ? ' is-done' : ''}`}>
              <button
                type="button"
                className="account-goal-check"
                onClick={() => toggleGoal(goal.id)}
                aria-pressed={done}
                aria-label={done ? `Mark ${goal.title} as not done` : `Mark ${goal.title} as done`}
              >
                <span aria-hidden="true">{done ? '✓' : ''}</span>
              </button>
              <button
                type="button"
                className="account-goal-open"
                onClick={() => {
                  completeGoal(goal.id)
                  onOpenGoal(goal.id)
                }}
              >
                <span className="account-goal-mark" aria-hidden="true">{goal.mark}</span>
                <span>
                  <b>{goal.title}</b>
                  <small>{goal.detail}</small>
                </span>
                <em>Go</em>
              </button>
            </article>
          )
        })}
      </section>
    </main>
  )
}
