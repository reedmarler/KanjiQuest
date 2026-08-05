import { useMemo, useState } from 'react'
import { buildAchievements, type AchievementCategory, type AchievementContext } from '../data/achievements'

interface AchievementsPanelProps extends AchievementContext {
  onBack: () => void
}

const CATEGORIES: readonly AchievementCategory[] = ['Journey', 'Knowledge', 'Reading', 'Battle']

export function AchievementsPanel({ onBack, ...context }: AchievementsPanelProps) {
  const [category, setCategory] = useState<AchievementCategory | 'All'>('All')
  const achievements = useMemo(() => buildAchievements(context), [context])
  const visible = category === 'All' ? achievements : achievements.filter((item) => item.category === category)
  const unlocked = achievements.filter((item) => item.progress >= item.target).length

  return (
    <main className="achievements-page">
      <header className="quest-topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <span>{unlocked} / {achievements.length} unlocked</span>
      </header>

      <section className="achievements-hero">
        <div className="achievements-crest" aria-hidden="true">誉</div>
        <div><span>YOUR LEGEND</span><h1>Achievements</h1><p>Knowledge leaves a trail. Every quest, story, and hard-won reading adds to it.</p></div>
        <strong>{Math.round((unlocked / achievements.length) * 100)}%</strong>
      </section>

      <nav className="achievement-filters" aria-label="Achievement categories">
        {(['All', ...CATEGORIES] as const).map((item) => (
          <button key={item} type="button" className={category === item ? 'is-active' : ''} onClick={() => setCategory(item)}>{item}</button>
        ))}
      </nav>

      <section className="achievement-grid" aria-label={`${category} achievements`}>
        {visible.map((achievement) => {
          const earned = achievement.progress >= achievement.target
          const progress = Math.min(achievement.progress, achievement.target)
          return (
            <article key={achievement.id} className={`achievement-card${earned ? ' is-earned' : ''}`}>
              <span className="achievement-icon" aria-hidden="true">{achievement.icon}</span>
              <div className="achievement-copy">
                <small>{achievement.category}</small><h2>{achievement.title}</h2><p>{achievement.description}</p>
                <div className="achievement-progress"><span style={{ width: `${(progress / achievement.target) * 100}%` }} /></div>
                <footer><span>{earned ? 'Unlocked' : `${progress} / ${achievement.target}`}</span><em>{achievement.reward}</em></footer>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
