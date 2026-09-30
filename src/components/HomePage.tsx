import { useState } from 'react'

type HomePageProps = {
  learnedCount: number
  onBegin: () => void
  onContinue: () => void
  onOpenStudy: () => void
  onOpenBeginner: () => void
  onOpenHero: () => void
}

type Audience = 'new' | 'returning'

// Mock of the two Home states. The new-user panel is a slot for the intro
// experience; the returning-user panel resumes where the learner left off.
// The preview switch is a design aid and should be removed once the states
// are driven purely by progress.
export function HomePage({ learnedCount, onBegin, onContinue, onOpenStudy, onOpenBeginner, onOpenHero }: HomePageProps) {
  const [preview, setPreview] = useState<Audience | null>(null)
  const audience: Audience = preview ?? (learnedCount === 0 ? 'new' : 'returning')

  return (
    <main className="home-page">
      <div className="home-preview" role="group" aria-label="Preview Home state">
        {(['new', 'returning'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={audience === option ? 'is-active' : ''}
            aria-pressed={audience === option}
            onClick={() => setPreview(option)}
          >
            {option === 'new' ? 'New user' : 'Returning'}
          </button>
        ))}
      </div>

      <h1 className="home-title">Kanji Quest</h1>

      {audience === 'new' ? (
        <section className="home-panel" aria-label="Welcome">
          <div className="home-intro-slot">Intro goes here</div>
          <p className="home-lede">Learn Japanese from the first character.</p>
          <button type="button" className="btn btn-primary home-primary" onClick={onBegin}>Begin</button>
        </section>
      ) : (
        <section className="home-panel" aria-label="Welcome back">
          <p className="home-lede">Welcome back. You have learned <b>{learnedCount}</b> {learnedCount === 1 ? 'card' : 'cards'}.</p>
          <button type="button" className="btn btn-primary home-primary" onClick={onContinue}>Continue</button>
          <div className="home-shortcuts">
            <button type="button" onClick={onOpenStudy}>Study</button>
            <button type="button" onClick={onOpenBeginner}>Beginner</button>
            <button type="button" onClick={onOpenHero}>Hero</button>
          </div>
        </section>
      )}
    </main>
  )
}
