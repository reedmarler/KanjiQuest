import { useMemo, useState } from 'react'
import { allCards } from '../data'
import { INK_ROAD_WAYPOINTS, WAYPOINT_NAMES, lookFor, shrineTokenId } from '../data/inkRoad'
import { recordAnswer } from '../lib/studyRecord'
import { seededRandom } from '../lib/inkRoadCamera'
import type { StudyCard } from '../lib/types'
import { AppBackButton } from './AppBackButton'

/**
 * The trial at a region's shrine.
 *
 * Every stop teaches its own thread-set and says so; this asks for the region
 * with no warning of what is coming, which is the only point on the road where
 * the learner finds out what actually stuck. It adds no material of its own —
 * the questions are the region's own cards, asked in ways the stops did not.
 *
 * Passing is not a stored flag. The shrine owns one token card in the same
 * scheduler as everything else, and only a pass inks it, so the map reads the
 * trial exactly the way it reads a kanji: derived, and eventually due again.
 */

const QUESTION_COUNT = 12

/** Matches the waypoint clearing threshold, so the whole road is judged alike. */
const PASS_MARK = 0.8

type Ask = 'meaning' | 'reading' | 'reverse'

interface Question {
  cardId: string
  ask: Ask
  /** The card itself, for the list of what to go back to. */
  subject: string
  prompt: string
  answer: string
  options: string[]
}

const PROMPT: Record<Ask, string> = {
  meaning: 'What does this mean?',
  reading: 'How is this read?',
  reverse: 'Which one is this?',
}

function distractors(pool: readonly string[], answer: string, random: () => number): string[] {
  const others = [...new Set(pool)].filter((value) => value && value !== answer)
  const picked: string[] = []
  while (picked.length < 3 && others.length) {
    picked.push(...others.splice(Math.floor(random() * others.length), 1))
  }
  return picked
}

function buildQuestions(cards: readonly StudyCard[], seed: number): Question[] {
  const random = seededRandom(seed)
  const meanings = cards.map((card) => card.back)
  const readings = cards.map((card) => card.reading ?? '').filter(Boolean)
  const fronts = cards.map((card) => card.front)

  const pool = [...cards].sort(() => random() - 0.5).slice(0, QUESTION_COUNT)

  return pool.flatMap((card) => {
    const asks: Ask[] = card.reading ? ['meaning', 'reading', 'reverse'] : ['meaning', 'reverse']
    const ask = asks[Math.floor(random() * asks.length)]!

    const answer = ask === 'meaning' ? card.back : ask === 'reading' ? card.reading! : card.front
    const source = ask === 'meaning' ? meanings : ask === 'reading' ? readings : fronts
    const wrong = distractors(source, answer, random)
    if (wrong.length < 3) return []

    return [{
      cardId: card.id,
      ask,
      subject: card.front,
      prompt: ask === 'reverse' ? card.back : card.front,
      answer,
      options: [answer, ...wrong].sort(() => random() - 0.5),
    }]
  })
}

interface ShrineTrialProps {
  regionId: string
  onBack: () => void
  /** Back to the road, whether the trial was passed or not. */
  onDone: () => void
}

export function ShrineTrial({ regionId, onBack, onDone }: ShrineTrialProps) {
  const look = lookFor(regionId)
  const shrineName = WAYPOINT_NAMES[`${regionId}-shrine`] ?? 'Shrine'

  const cards = useMemo(() => {
    const byId = new Map(allCards.map((card) => [card.id, card]))
    const threads = INK_ROAD_WAYPOINTS
      .filter((waypoint) => waypoint.regionId === regionId && waypoint.kind === 'stop')
      .flatMap((waypoint) => waypoint.threads)
    return [...new Set(threads)].map((id) => byId.get(id)).filter((card): card is StudyCard => Boolean(card))
  }, [regionId])

  const [attempt, setAttempt] = useState(1)
  const questions = useMemo(() => buildQuestions(cards, 4207 + attempt * 31), [attempt, cards])

  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [missed, setMissed] = useState<string[]>([])
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  const question = questions[index]
  const total = questions.length

  function choose(option: string) {
    if (picked || !question) return
    setPicked(option)

    const right = option === question.answer
    // The trial grades the region's own cards, so failing one here genuinely
    // costs its ink — the map does not need to be told the trial went badly.
    recordAnswer(question.cardId, right ? 'good' : 'again')
    if (right) setCorrect((count) => count + 1)
    /*
     * What to go back to is the card, not the question: a reverse question
     * prompts with the meaning, so listing prompts sent the learner back to
     * "sa" and "he" rather than to さ and へ.
     */
    else setMissed((current) => [...current, question.subject])
  }

  function next() {
    if (!question) return
    if (index + 1 >= total) {
      const passed = correct / (total || 1) >= PASS_MARK
      recordAnswer(shrineTokenId(regionId), passed ? 'good' : 'again')
      setDone(true)
      return
    }
    setIndex((current) => current + 1)
    setPicked(null)
  }

  function again() {
    setAttempt((count) => count + 1)
    setIndex(0)
    setPicked(null)
    setMissed([])
    setCorrect(0)
    setDone(false)
  }

  if (!total) {
    return (
      <main className="shrine-trial">
        <header className="quest-topbar">
          <AppBackButton onClick={onBack} aria-label="Back to the road" />
        </header>
        <section className="shrine-trial-card">
          <h2>{shrineName}</h2>
          <p>There is nothing here to ask yet — this region has no cards the trial can draw on.</p>
          <button type="button" className="btn btn-primary" onClick={onDone}>Back to the road</button>
        </section>
      </main>
    )
  }

  const score = correct / total
  const passed = score >= PASS_MARK

  return (
    <main className="shrine-trial">
      <header className="quest-topbar">
        <AppBackButton onClick={onBack} aria-label="Back to the road" />
        <span lang="ja">{look.japanese}</span>
        {!done && <span className="shrine-trial-count">{index + 1} / {total}</span>}
      </header>

      {done ? (
        <section className={`shrine-trial-card${passed ? ' is-passed' : ''}`}>
          <span className="shrine-trial-mark" aria-hidden="true">{passed ? '⛩' : '霧'}</span>
          <h2>{passed ? 'The way opens' : 'The fog holds'}</h2>
          <p className="shrine-trial-score">{correct} of {total}</p>
          {passed ? (
            <p>The shrine is sealed and the road north is clear.</p>
          ) : (
            <>
              <p>{PASS_MARK * 100}% opens the way. These are what let you down:</p>
              <ul className="shrine-trial-missed" lang="ja">
                {[...new Set(missed)].slice(0, 3).map((thread) => <li key={thread}>{thread}</li>)}
              </ul>
            </>
          )}
          <div className="shrine-trial-actions">
            {!passed && <button type="button" className="btn btn-primary" onClick={again}>Try again</button>}
            <button type="button" className={`btn${passed ? ' btn-primary' : ' btn-ghost'}`} onClick={onDone}>
              Back to the road
            </button>
          </div>
        </section>
      ) : (
        <section className="shrine-trial-card">
          <span className="shrine-trial-ask">{PROMPT[question!.ask]}</span>
          <p className="shrine-trial-prompt" lang={question!.ask === 'reverse' ? undefined : 'ja'}>{question!.prompt}</p>
          <div className="shrine-trial-options" role="group">
            {question!.options.map((option) => {
              const state = !picked ? '' : option === question!.answer ? ' is-correct' : option === picked ? ' is-wrong' : ''
              return (
                <button key={option} type="button" className={`btn shrine-trial-option${state}`} onClick={() => choose(option)}>
                  {option}
                </button>
              )
            })}
          </div>
          <button type="button" className="btn btn-primary" disabled={!picked} onClick={next}>
            {index + 1 >= total ? 'Finish' : 'Next'}
          </button>
        </section>
      )}
    </main>
  )
}
