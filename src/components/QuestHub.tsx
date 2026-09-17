import { useState } from 'react'

const QUESTS_BY_DIFFICULTY = {
  Beginner: [1, 2, 3, 4],
  Intermediate: [5, 6, 7, 8],
  Advanced: [9, 10, 11, 12],
} as const

type QuestDifficulty = keyof typeof QUESTS_BY_DIFFICULTY

export function QuestHub() {
  const [difficulty, setDifficulty] = useState<QuestDifficulty>('Beginner')

  return (
    <main className="quest-skeleton-page">
      <header className="quest-skeleton-header">
        <h1>Quests</h1>
        <div className="quest-difficulty-toggle" role="group" aria-label="Quest difficulty">
          {(Object.keys(QUESTS_BY_DIFFICULTY) as QuestDifficulty[]).map((option) => (
            <button
              key={option}
              type="button"
              className={difficulty === option ? 'is-active' : ''}
              onClick={() => setDifficulty(option)}
              aria-pressed={difficulty === option}
            >
              {option}
            </button>
          ))}
        </div>
      </header>

      <section className="quest-skeleton-list" aria-label={`${difficulty} quests`}>
        {QUESTS_BY_DIFFICULTY[difficulty].map((questNumber) => (
          <article key={questNumber} className="quest-skeleton-card">
            <span>Quest {questNumber} ({difficulty})</span>
          </article>
        ))}
      </section>
    </main>
  )
}
