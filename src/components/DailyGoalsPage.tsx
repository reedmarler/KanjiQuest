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
  const { goals, doneCount, percent, toggleGoal, completeGoal, isDone } = useDailyGoals()
  const total = DAILY_GOALS.length
  const remaining = total - doneCount
  const allDone = remaining === 0

  return (
    <main className="account-page daily-quests-page">
      <header className="account-page-heading">
        <AppBackButton onClick={onBack} aria-label="Back" />
        <small>Today</small>
        <h1>Daily quests</h1>
      </header>

      <section className="daily-quests-hero">
        <div
          className={`daily-quests-ring${allDone ? ' is-complete' : ''}`}
          style={{ '--progress-pct': `${percent}%` } as CSSProperties}
          aria-hidden="true"
        >
          <b>
            {doneCount}
            <i>/{total}</i>
          </b>
        </div>
        <div className="daily-quests-hero-copy">
          <p>{allDone ? 'All done — see you tomorrow.' : `${remaining} quest${remaining === 1 ? '' : 's'} left today.`}</p>
          <div className="daily-quests-meter" aria-hidden="true">
            <i style={{ '--progress-pct': `${percent}%` } as CSSProperties} />
          </div>
        </div>
      </section>

      <section className="daily-quests-board" aria-label="Daily quests">
        {goals.map((goal) => {
          const done = isDone(goal.id)
          return (
            <article key={goal.id} className={`daily-quest-row${done ? ' is-done' : ''}`}>
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
                onClick={() => {
                  completeGoal(goal.id)
                  onOpenGoal(goal.id)
                }}
              >
                <span className="daily-quest-mark" aria-hidden="true">{goal.mark}</span>
                <span className="daily-quest-text">
                  <b>{goal.title}</b>
                  <small>{goal.detail}</small>
                </span>
                <em>{done ? 'Again' : 'Go'}</em>
              </button>
            </article>
          )
        })}
      </section>
    </main>
  )
}
