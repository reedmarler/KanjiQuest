import { useEffect, useMemo, useRef, useState } from 'react'
import { getBeginnerDeck } from '../data/beginnerMnemonics'
import { hiraganaWordBank } from '../data/beginnerUnderstandingWords'

/**
 * Recognition under time pressure, which is a different skill from the
 * Beginner Zone's write-it-out drills: the character flashes for a fixed
 * window and then disappears, so the learner has to read it at a glance
 * rather than puzzle it out from stroke shapes still sitting on screen.
 */
const LEVELS = [
  { id: 'relaxed', label: 'Relaxed', flashMs: 1200 },
  { id: 'steady', label: 'Steady', flashMs: 700 },
  { id: 'quick', label: 'Quick', flashMs: 400 },
  { id: 'blink', label: 'Blink', flashMs: 200 },
] as const

type LevelId = (typeof LEVELS)[number]['id']
/** 1 kana drills single characters; 2 kana only ever flashes real two-kana
 *  words, so the speed drill doubles as vocabulary rather than showing
 *  meaningless pairs. */
type Mode = 'single' | 'word'

const ROUNDS = 10
const CHOICE_COUNT = 4
/** Beat between the flash ending and the choices appearing, so the answer
 *  can't be read off the screen while picking. */
const SETTLE_MS = 220
/** Blank beat after Next before the character appears, so the flash never
 *  lands on the same instant as the click that asked for it. */
const LEAD_IN_MS = 400

interface Prompt {
  /** What flashes on screen and what the learner has to identify. */
  text: string
  /** Shown under the answer once picked — the word's meaning. Single kana
   *  carry no gloss: spelling out the romaji hands over the very reading the
   *  drill is training. */
  gloss: string
}

function shuffled<T>(items: readonly T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  }
  return copy
}

function buildPool(mode: Mode): Prompt[] {
  if (mode === 'word') {
    return hiraganaWordBank
      .filter((entry) => [...entry.word].length === 2)
      .map((entry) => ({ text: entry.word, gloss: entry.meaning }))
  }
  return getBeginnerDeck('hiragana').rows
    .flatMap((row) => row.characters)
    .map((entry) => ({ text: entry.char, gloss: '' }))
}

type Phase = 'idle' | 'lead' | 'flash' | 'choosing' | 'answered' | 'done'

interface BeginnerSpeedRunProps {
  onBack: () => void
}

export function BeginnerSpeedRun({ onBack }: BeginnerSpeedRunProps) {
  const [mode, setMode] = useState<Mode>('single')
  const [level, setLevel] = useState<LevelId>('steady')
  const [phase, setPhase] = useState<Phase>('idle')
  const [round, setRound] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [choices, setChoices] = useState<Prompt[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const pool = useMemo(() => buildPool(mode), [mode])
  const flashMs = LEVELS.find((entry) => entry.id === level)!.flashMs

  // Any pending flash/settle timer must die with the component (or with a
  // restart), otherwise a stale timer advances a run that no longer exists.
  function clearTimers() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  useEffect(() => clearTimers, [])

  function askRound(nextRound: number) {
    clearTimers()
    const answer = pool[Math.floor(Math.random() * pool.length)]!
    const distractors = shuffled(pool.filter((entry) => entry.text !== answer.text)).slice(0, CHOICE_COUNT - 1)
    setPrompt(answer)
    setChoices(shuffled([answer, ...distractors]))
    setPicked(null)
    setRound(nextRound)
    setPhase('lead')
    timersRef.current.push(setTimeout(() => setPhase('flash'), LEAD_IN_MS))
    timersRef.current.push(setTimeout(() => setPhase('choosing'), LEAD_IN_MS + flashMs + SETTLE_MS))
  }

  function start() {
    setCorrect(0)
    askRound(1)
  }

  function pick(text: string) {
    if (phase !== 'choosing') return
    setPicked(text)
    if (text === prompt?.text) setCorrect((current) => current + 1)
    setPhase('answered')
  }

  function next() {
    if (round >= ROUNDS) {
      setPhase('done')
      return
    }
    askRound(round + 1)
  }

  function quitToSetup() {
    clearTimers()
    setPhase('idle')
    setRound(0)
    setCorrect(0)
    setPrompt(null)
    setPicked(null)
  }

  return (
    <div className="beginner-learner">
      <div className="beginner-learner-top">
        <button type="button" className="beginner-back" onClick={onBack} aria-label="Back to Beginner Zone">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          <span>Back</span>
        </button>
        <span className="beginner-learner-title">Speed Run</span>
        {phase === 'idle' || phase === 'done' ? (
          <span />
        ) : (
          <span className="beginner-streak" title="Correct so far">
            <span aria-hidden="true">&#9889;</span>
            <b>{correct}</b>
          </span>
        )}
      </div>

      {phase === 'idle' ? (
        <main className="beginner-card beginner-speedrun-setup">
          <h2>Speed Run</h2>
          <p>A character flashes, then vanishes. Pick what you saw.</p>

          <div className="beginner-speedrun-group">
            <span className="beginner-write-label">Mode</span>
            <div className="beginner-speedrun-options">
              <button
                type="button"
                className={`beginner-speedrun-option${mode === 'single' ? ' is-active' : ''}`}
                onClick={() => setMode('single')}
              >
                <b lang="ja">あ</b>
                <span>1 kana</span>
              </button>
              <button
                type="button"
                className={`beginner-speedrun-option${mode === 'word' ? ' is-active' : ''}`}
                onClick={() => setMode('word')}
              >
                <b lang="ja">あお</b>
                <span>2 kana — real words</span>
              </button>
            </div>
          </div>

          <div className="beginner-speedrun-group">
            <span className="beginner-write-label">Speed</span>
            <div className="beginner-speedrun-options">
              {LEVELS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`beginner-speedrun-option${level === entry.id ? ' is-active' : ''}`}
                  onClick={() => setLevel(entry.id)}
                >
                  <b>{entry.label}</b>
                  <span>{entry.flashMs}ms</span>
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="btn btn-primary beginner-action-btn-green" onClick={start}>
            Start {ROUNDS} rounds &rarr;
          </button>
        </main>
      ) : phase === 'done' ? (
        <main className="beginner-card beginner-card-complete">
          <span className="beginner-complete-mark" aria-hidden="true">{correct === ROUNDS ? '🏆' : '⚡'}</span>
          <h2>{correct === ROUNDS ? 'Flawless' : 'Run complete'}</h2>
          <p className="beginner-challenge-score">{correct} / {ROUNDS}</p>
          <p>{LEVELS.find((entry) => entry.id === level)!.label} · {mode === 'word' ? '2 kana' : '1 kana'}</p>
          <button type="button" className="btn btn-primary" onClick={start}>Run it again</button>
          <button type="button" className="btn btn-ghost" onClick={quitToSetup}>Change settings</button>
        </main>
      ) : (
        <main className="beginner-card beginner-speedrun-play">
          <div className="beginner-challenge-top">
            <span className="beginner-write-label">Round {round} of {ROUNDS}</span>
            <button type="button" className="beginner-speedrun-quit" onClick={quitToSetup}>Quit</button>
          </div>

          <div className="beginner-speedrun-stage">
            {phase === 'flash' ? (
              <span
                className="beginner-speedrun-flash"
                lang="ja"
                style={{ animationDuration: `${flashMs}ms` }}
              >
                {prompt?.text}
              </span>
            ) : (
              <span className="beginner-speedrun-stage-hint">
                {phase === 'lead'
                  ? 'Ready…'
                  : phase === 'choosing'
                    ? 'What was it?'
                    : picked === prompt?.text ? 'Correct' : 'Not quite'}
              </span>
            )}
          </div>

          <div className="beginner-challenge-choices">
            {choices.map((choice) => {
              const isAnswer = choice.text === prompt?.text
              const state = phase !== 'answered'
                ? ''
                : isAnswer ? ' is-correct' : choice.text === picked ? ' is-wrong' : ' is-dimmed'
              return (
                <button
                  key={choice.text}
                  type="button"
                  className={`beginner-challenge-choice${state}`}
                  onClick={() => pick(choice.text)}
                  disabled={phase !== 'choosing'}
                  lang="ja"
                >
                  {choice.text}
                </button>
              )
            })}
          </div>

          <div className="beginner-speedrun-footer">
            <span className="beginner-speedrun-gloss">
              {phase === 'answered' && prompt?.gloss ? `${prompt.text} — ${prompt.gloss}` : ''}
            </span>
            <button
              type="button"
              className="btn btn-primary beginner-action-btn beginner-action-btn-green"
              onClick={next}
              disabled={phase !== 'answered'}
            >
              {round >= ROUNDS ? 'See result →' : 'Next →'}
            </button>
          </div>
        </main>
      )}
    </div>
  )
}
