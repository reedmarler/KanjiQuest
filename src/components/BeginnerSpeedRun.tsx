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
  { id: 'relaxed', label: 'Slow', flashMs: 1200 },
  { id: 'steady', label: 'Quick', flashMs: 700 },
  { id: 'quick', label: 'Fast', flashMs: 400 },
  { id: 'blink', label: 'Hyper', flashMs: 200 },
  { id: 'hyper', label: 'Turbo', flashMs: 75 },
] as const

type LevelId = (typeof LEVELS)[number]['id']
/** 1 kana drills single characters; 2 kana only ever flashes real two-kana
 *  words, so the speed drill doubles as vocabulary rather than showing
 *  meaningless pairs. */
type SpeedScript = 'hiragana' | 'kanji'
type CharacterCount = 1 | 2 | 3 | 4

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

const ONE_KANA_WORDS: Prompt[] = [
  { text: 'え', gloss: 'picture' },
  { text: 'て', gloss: 'hand' },
  { text: 'め', gloss: 'eye' },
  { text: 'き', gloss: 'tree' },
]

const TWO_KANJI_WORDS: Prompt[] = [
  { text: '日本', gloss: 'Japan' },
  { text: '学校', gloss: 'school' },
  { text: '先生', gloss: 'teacher' },
  { text: '電話', gloss: 'phone' },
  { text: '電車', gloss: 'train' },
  { text: '時間', gloss: 'time' },
  { text: '火山', gloss: 'volcano' },
  { text: '大人', gloss: 'adult' },
  { text: '人口', gloss: 'population' },
  { text: '上下', gloss: 'up and down' },
]

const THREE_KANJI_WORDS: Prompt[] = [
  { text: '図書館', gloss: 'library' },
  { text: '新幹線', gloss: 'bullet train' },
  { text: '自転車', gloss: 'bicycle' },
  { text: '美術館', gloss: 'art museum' },
  { text: '郵便局', gloss: 'post office' },
  { text: '消防車', gloss: 'fire engine' },
  { text: '救急車', gloss: 'ambulance' },
  { text: '運動会', gloss: 'sports day' },
  { text: '飛行機', gloss: 'airplane' },
]

const FOUR_KANJI_WORDS: Prompt[] = [
  { text: '天気予報', gloss: 'weather forecast' },
  { text: '電話番号', gloss: 'phone number' },
  { text: '日本料理', gloss: 'Japanese cuisine' },
  { text: '高等学校', gloss: 'high school' },
  { text: '交通事故', gloss: 'traffic accident' },
  { text: '大学生活', gloss: 'college life' },
  { text: '世界一周', gloss: 'around the world' },
  { text: '四字熟語', gloss: 'four-character idiom' },
]

const FOUR_KANA_WORDS: Prompt[] = [
  { text: 'ひこうき', gloss: 'airplane' },
  { text: 'ともだち', gloss: 'friend' },
  { text: 'くだもの', gloss: 'fruit' },
  { text: 'おとうと', gloss: 'younger brother' },
  { text: 'いもうと', gloss: 'younger sister' },
  { text: 'ものさし', gloss: 'ruler' },
  { text: 'たてもの', gloss: 'building' },
  { text: 'おおきい', gloss: 'big' },
  { text: 'ちいさい', gloss: 'small' },
  { text: 'おいしい', gloss: 'delicious' },
]

function shuffled<T>(items: readonly T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  }
  return copy
}

function buildPool(script: SpeedScript, count: CharacterCount): Prompt[] {
  if (script === 'kanji') {
    if (count === 4) return FOUR_KANJI_WORDS
    if (count === 3) return THREE_KANJI_WORDS
    if (count === 2) return TWO_KANJI_WORDS
    return getBeginnerDeck('kanji').rows
      .flatMap((row) => row.characters)
      .map((entry) => ({ text: entry.char, gloss: entry.meaning ?? '' }))
  }

  if (count > 1) {
    if (count === 4) return FOUR_KANA_WORDS
    return hiraganaWordBank
      .filter((entry) => [...entry.word].length === count)
      .map((entry) => ({ text: entry.word, gloss: entry.meaning }))
  }
  return ONE_KANA_WORDS
}

type Phase = 'idle' | 'lead' | 'flash' | 'choosing' | 'answered' | 'done'

interface BeginnerSpeedRunProps {
  onBack: () => void
}

export function BeginnerSpeedRun({ onBack }: BeginnerSpeedRunProps) {
  const [script, setScript] = useState<SpeedScript>('hiragana')
  const [characterCount, setCharacterCount] = useState<CharacterCount>(1)
  const [level, setLevel] = useState<LevelId>('steady')
  const [phase, setPhase] = useState<Phase>('idle')
  const [round, setRound] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [choices, setChoices] = useState<Prompt[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const pool = useMemo(() => buildPool(script, characterCount), [script, characterCount])
  const flashMs = LEVELS.find((entry) => entry.id === level)!.flashMs
  const setupPreview = script === 'hiragana'
    ? characterCount === 1
      ? { text: 'き', image: '🌳', meaning: 'tree' }
      : characterCount === 2
        ? { text: 'ほし', image: '⭐', meaning: 'star' }
        : characterCount === 3
          ? { text: 'さかな', image: '🐟', meaning: 'fish' }
          : { text: 'ひこうき', image: '✈️', meaning: 'airplane' }
    : characterCount === 1
      ? { text: '木', image: '🌳', meaning: 'tree' }
      : characterCount === 2
        ? { text: '日本', image: '🗾', meaning: 'Japan' }
        : characterCount === 3
          ? { text: '新幹線', image: '🚄', meaning: 'bullet train' }
          : { text: '天気予報', image: '🌤️', meaning: 'weather forecast' }

  // Any pending flash/settle timer must die with the component (or with a
  // restart), otherwise a stale timer advances a run that no longer exists.
  function clearTimers() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  useEffect(() => clearTimers, [])

  function scheduleFlash(duration = flashMs) {
    timersRef.current.push(setTimeout(() => setPhase('flash'), LEAD_IN_MS))
    timersRef.current.push(setTimeout(() => setPhase('choosing'), LEAD_IN_MS + duration + SETTLE_MS))
  }

  function askRound(nextRound: number) {
    clearTimers()
    const answer = pool[Math.floor(Math.random() * pool.length)]!
    const distractors = shuffled(pool.filter((entry) => entry.text !== answer.text)).slice(0, CHOICE_COUNT - 1)
    setPrompt(answer)
    setChoices(shuffled([answer, ...distractors]))
    setPicked(null)
    setRound(nextRound)
    setPhase('lead')
    scheduleFlash()
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
    setSettingsOpen(false)
    setPhase('idle')
    setRound(0)
    setCorrect(0)
    setPrompt(null)
    setPicked(null)
  }

  function selectLevel(nextLevel: LevelId) {
    setLevel(nextLevel)
    if (settingsOpen) return
    if (phase !== 'lead' && phase !== 'flash') return
    clearTimers()
    setPhase('lead')
    scheduleFlash(LEVELS.find((entry) => entry.id === nextLevel)!.flashMs)
  }

  function adjustLevel(direction: -1 | 1) {
    const currentIndex = LEVELS.findIndex((entry) => entry.id === level)
    const nextIndex = Math.max(0, Math.min(LEVELS.length - 1, currentIndex + direction))
    selectLevel(LEVELS[nextIndex]!.id)
  }

  function reflash() {
    if (!prompt || phase !== 'choosing') return
    clearTimers()
    setPhase('lead')
    scheduleFlash()
  }

  function openSettings() {
    if (phase === 'lead' || phase === 'flash') {
      clearTimers()
      setPhase('lead')
    }
    setSettingsOpen(true)
  }

  function closeSettings() {
    setSettingsOpen(false)
    if (phase === 'lead') scheduleFlash()
  }

  return (
    <div className="beginner-learner">
      <div className="beginner-learner-top">
        <button type="button" className="beginner-back" onClick={onBack} aria-label="Back to Beginner Zone">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          <span>Back</span>
        </button>
        <span className="beginner-learner-title">{phase === 'idle' ? '' : 'Speed Run'}</span>
        {phase === 'idle' || phase === 'done' ? (
          <span />
        ) : (
          <button type="button" className="beginner-speedrun-header-settings" onClick={openSettings}>
            Settings
          </button>
        )}
      </div>

      {phase === 'idle' ? (
        <main className="beginner-card picture-practice-setup beginner-speedrun-setup" aria-label="Speed run settings">
          <div className="picture-setup-preview beginner-speedrun-setup-preview" aria-hidden="true">
            <b lang="ja">{setupPreview.text}</b>
            <span>{setupPreview.image}</span>
            <small>{setupPreview.meaning}</small>
          </div>

          <div className="picture-setup-controls">
            <fieldset className="picture-setup-field">
              <legend>Writing</legend>
              <div className="picture-segmented beginner-speedrun-script-selector">
                <button type="button" className={script === 'hiragana' ? 'is-active' : ''} onClick={() => setScript('hiragana')} aria-pressed={script === 'hiragana'}>
                  <span lang="ja">あ</span> Hiragana
                </button>
                <button type="button" className={script === 'kanji' ? 'is-active' : ''} onClick={() => setScript('kanji')} aria-pressed={script === 'kanji'}>
                  <span lang="ja">漢</span> Kanji
                </button>
              </div>
            </fieldset>

            <fieldset className="picture-setup-field">
              <legend>{script === 'hiragana' ? 'Kana' : 'Kanji'} per flash</legend>
              <div className="picture-count-selector beginner-speedrun-count-selector">
                {([1, 2, 3, 4] as const).map((count) => (
                  <button key={count} type="button" className={characterCount === count ? 'is-active' : ''} onClick={() => setCharacterCount(count)} aria-pressed={characterCount === count}>
                    {count}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="picture-setup-field">
              <legend>Flash speed</legend>
              <div className="picture-count-selector beginner-speedrun-speed-selector">
                {LEVELS.map((entry) => (
                  <button key={entry.id} type="button" className={level === entry.id ? 'is-active' : ''} onClick={() => selectLevel(entry.id)} aria-pressed={level === entry.id}>
                    <b>{entry.label}</b>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <button type="button" className="btn btn-primary beginner-action-btn-green picture-setup-start" onClick={start}>
            Start
          </button>
        </main>
      ) : phase === 'done' ? (
        <main className="beginner-card beginner-card-complete">
          <span className="beginner-complete-mark" aria-hidden="true">{correct === ROUNDS ? '🏆' : '⚡'}</span>
          <h2>{correct === ROUNDS ? 'Flawless' : 'Run complete'}</h2>
          <p className="beginner-challenge-score">{correct} / {ROUNDS}</p>
          <p>{LEVELS.find((entry) => entry.id === level)!.label} · {characterCount} {script === 'hiragana' ? 'kana' : 'kanji'}</p>
          <button type="button" className="btn btn-primary" onClick={start}>Run it again</button>
          <button type="button" className="btn btn-ghost" onClick={quitToSetup}>Change settings</button>
        </main>
      ) : (
        <main className="beginner-card beginner-speedrun-play">
          <div className="beginner-challenge-top">
            <div className="beginner-speedrun-adjuster" aria-label="Flash speed">
              <button type="button" onClick={() => adjustLevel(-1)} disabled={level === LEVELS[0].id} aria-label="Slower">&minus;</button>
              <span>{LEVELS.find((entry) => entry.id === level)!.label}</span>
              <button type="button" onClick={() => adjustLevel(1)} disabled={level === LEVELS[LEVELS.length - 1].id} aria-label="Faster">+</button>
            </div>
            <button
              type="button"
              className="beginner-speedrun-quit beginner-speedrun-reflash"
              onClick={reflash}
              disabled={phase !== 'choosing'}
              aria-label="Reflash word"
            >
              <span aria-hidden="true">&#8635;</span>
              Reflash
            </button>
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
            ) : phase === 'answered' ? (
              <span className={`beginner-speedrun-answer${picked === prompt?.text ? ' is-correct' : ' is-wrong'}`}>
                <b lang="ja">{prompt?.text}</b>
                {prompt?.gloss && <small>{prompt.gloss}</small>}
              </span>
            ) : (
              <span className="beginner-speedrun-stage-hint">
                {phase === 'lead'
                  ? 'Ready…'
                  : 'What was it?'}
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
            <span className="beginner-speedrun-gloss" />
            <button
              type="button"
              className="btn btn-primary beginner-action-btn beginner-action-btn-green"
              onClick={next}
              disabled={phase !== 'answered'}
            >
              {round >= ROUNDS ? 'See result →' : 'Next →'}
            </button>
          </div>

          {settingsOpen && (
            <div className="beginner-speedrun-settings-backdrop">
              <section className="beginner-speedrun-settings" role="dialog" aria-modal="true" aria-label="Speed run settings">
                <header>
                  <b>Run settings</b>
                  <button type="button" onClick={closeSettings} aria-label="Close settings">&times;</button>
                </header>

                <div className="picture-setup-controls">
                  <fieldset className="picture-setup-field">
                    <legend>Writing</legend>
                    <div className="picture-segmented beginner-speedrun-script-selector">
                      <button type="button" className={script === 'hiragana' ? 'is-active' : ''} onClick={() => setScript('hiragana')} aria-pressed={script === 'hiragana'}><span lang="ja">あ</span> Hiragana</button>
                      <button type="button" className={script === 'kanji' ? 'is-active' : ''} onClick={() => setScript('kanji')} aria-pressed={script === 'kanji'}><span lang="ja">漢</span> Kanji</button>
                    </div>
                  </fieldset>

                  <fieldset className="picture-setup-field">
                    <legend>{script === 'hiragana' ? 'Kana' : 'Kanji'} per flash</legend>
                    <div className="picture-count-selector beginner-speedrun-count-selector">
                      {([1, 2, 3, 4] as const).map((count) => (
                        <button key={count} type="button" className={characterCount === count ? 'is-active' : ''} onClick={() => setCharacterCount(count)} aria-pressed={characterCount === count}>{count}</button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="picture-setup-field">
                    <legend>Flash speed</legend>
                    <div className="picture-count-selector beginner-speedrun-speed-selector">
                      {LEVELS.map((entry) => (
                        <button key={entry.id} type="button" className={level === entry.id ? 'is-active' : ''} onClick={() => selectLevel(entry.id)} aria-pressed={level === entry.id}><b>{entry.label}</b></button>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <footer>
                  <button type="button" className="btn btn-ghost" onClick={quitToSetup}>Quit run</button>
                  <button type="button" className="btn btn-primary beginner-action-btn-green" onClick={closeSettings}>Done</button>
                </footer>
              </section>
            </div>
          )}
        </main>
      )}
    </div>
  )
}
