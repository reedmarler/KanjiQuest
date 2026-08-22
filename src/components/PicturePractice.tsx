import { useMemo, useState } from 'react'

type PictureScript = 'hiragana' | 'kanji'
type PictureLength = 1 | 2 | 3 | 4

interface PicturePrompt {
  text: string
  meaning: string
  image: string
}

const ROUNDS = 10
const CHOICE_COUNT = 4

const HIRAGANA_PICTURES: PicturePrompt[] = [
  { text: 'え', meaning: 'picture', image: '🖼️' },
  { text: 'て', meaning: 'hand', image: '✋' },
  { text: 'め', meaning: 'eye', image: '👁️' },
  { text: 'き', meaning: 'tree', image: '🌳' },
  { text: 'あい', meaning: 'love', image: '❤️' },
  { text: 'いえ', meaning: 'house', image: '🏠' },
  { text: 'あお', meaning: 'blue', image: '🔵' },
  { text: 'かお', meaning: 'face', image: '🙂' },
  { text: 'あか', meaning: 'red', image: '🔴' },
  { text: 'くつ', meaning: 'shoes', image: '👟' },
  { text: 'はな', meaning: 'flower', image: '🌸' },
  { text: 'ほし', meaning: 'star', image: '⭐' },
  { text: 'そら', meaning: 'sky', image: '☁️' },
  { text: 'ゆき', meaning: 'snow', image: '❄️' },
  { text: 'かわ', meaning: 'river', image: '🌊' },
  { text: 'とり', meaning: 'bird', image: '🐦' },
  { text: 'さかな', meaning: 'fish', image: '🐟' },
  { text: 'とけい', meaning: 'clock', image: '🕒' },
  { text: 'くるま', meaning: 'car', image: '🚗' },
  { text: 'こころ', meaning: 'heart', image: '💗' },
  { text: 'さくら', meaning: 'cherry blossom', image: '🌸' },
  { text: 'わたし', meaning: 'I / me', image: '🧍' },
]

const KANJI_PICTURES: PicturePrompt[] = [
  { text: '一', meaning: 'one', image: '1' },
  { text: '山', meaning: 'mountain', image: '⛰️' },
  { text: '水', meaning: 'water', image: '💧' },
  { text: '火', meaning: 'fire', image: '🔥' },
  { text: '木', meaning: 'tree', image: '🌳' },
  { text: '手', meaning: 'hand', image: '✋' },
  { text: '本', meaning: 'book', image: '📘' },
  { text: '雨', meaning: 'rain', image: '🌧️' },
  { text: '電話', meaning: 'phone', image: '☎️' },
  { text: '学校', meaning: 'school', image: '🏫' },
  { text: '先生', meaning: 'teacher', image: '🧑‍🏫' },
  { text: '電車', meaning: 'train', image: '🚃' },
  { text: '時間', meaning: 'time', image: '🕒' },
  { text: '日本', meaning: 'Japan', image: '🗾' },
  { text: '図書館', meaning: 'library', image: '📚' },
  { text: '自転車', meaning: 'bicycle', image: '🚲' },
  { text: '新幹線', meaning: 'bullet train', image: '🚄' },
  { text: '美術館', meaning: 'art museum', image: '🏛️' },
  { text: '郵便局', meaning: 'post office', image: '🏣' },
  { text: '消防車', meaning: 'fire engine', image: '🚒' },
  { text: '救急車', meaning: 'ambulance', image: '🚑' },
  { text: '運動会', meaning: 'sports day', image: '🏃' },
  { text: '飛行機', meaning: 'airplane', image: '✈️' },
]

function shuffled<T>(items: readonly T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  }
  return copy
}

function buildPool(script: PictureScript, length: PictureLength) {
  const source = script === 'hiragana' ? HIRAGANA_PICTURES : KANJI_PICTURES
  return source.filter((entry) => [...entry.text].length === length)
}

interface PicturePracticeProps {
  onBack: () => void
}

export function PicturePractice({ onBack }: PicturePracticeProps) {
  const [script, setScript] = useState<PictureScript>('hiragana')
  const [length, setLength] = useState<PictureLength>(2)
  const [round, setRound] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [prompt, setPrompt] = useState<PicturePrompt | null>(null)
  const [choices, setChoices] = useState<PicturePrompt[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const pool = useMemo(() => buildPool(script, length), [script, length])
  const ready = pool.length >= CHOICE_COUNT
  const setupPreview = script === 'hiragana'
    ? { text: 'さくら', meaning: 'cherry blossom', image: '🌸' }
    : { text: '新幹線', meaning: 'bullet train', image: '🚄' }

  function askRound(nextRound: number) {
    const answer = pool[Math.floor(Math.random() * pool.length)]!
    const distractors = shuffled(pool.filter((entry) => entry.text !== answer.text)).slice(0, CHOICE_COUNT - 1)
    setPrompt(answer)
    setChoices(shuffled([answer, ...distractors]))
    setSelected(null)
    setPicked(null)
    setRound(nextRound)
    setDone(false)
  }

  function start() {
    if (!ready) return
    setCorrect(0)
    askRound(1)
  }

  function submit() {
    if (!selected || picked) return
    setPicked(selected)
    if (selected === prompt?.text) setCorrect((current) => current + 1)
  }

  function next() {
    if (round >= ROUNDS) {
      setDone(true)
      return
    }
    askRound(round + 1)
  }

  function resetSetup(nextScript = script, nextLength = length) {
    setScript(nextScript)
    setLength(nextLength)
    setRound(0)
    setCorrect(0)
    setPrompt(null)
    setChoices([])
    setSelected(null)
    setPicked(null)
    setDone(false)
  }

  return (
    <div className="beginner-learner picture-practice">
      <div className="beginner-learner-top">
        <button type="button" className="beginner-back" onClick={onBack} aria-label="Back to dashboard">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          <span>Back</span>
        </button>
        <span className="beginner-learner-title">{round > 0 ? 'Picture Mode' : ''}</span>
        {round > 0 && !done ? (
          <span className="beginner-streak" title="Correct so far">
            <span aria-hidden="true">絵</span>
            <b>{correct}</b>
          </span>
        ) : <span />}
      </div>

      {round === 0 ? (
        <main className="beginner-card picture-practice-setup" aria-label="Picture practice settings">
          <div className="picture-setup-preview" aria-hidden="true">
            <b lang="ja">{setupPreview.text}</b>
            <span>{setupPreview.image}</span>
            <small>{setupPreview.meaning}</small>
          </div>

          <div className="picture-setup-controls">
            <fieldset className="picture-setup-field">
              <legend>Writing</legend>
              <div className="picture-segmented">
                <button type="button" className={script === 'hiragana' ? 'is-active' : ''} onClick={() => resetSetup('hiragana', length)} aria-pressed={script === 'hiragana'}>
                  <span lang="ja">あ</span> Hiragana
                </button>
                <button type="button" className={script === 'kanji' ? 'is-active' : ''} onClick={() => resetSetup('kanji', length)} aria-pressed={script === 'kanji'}>
                  <span lang="ja">漢</span> Kanji
                </button>
              </div>
            </fieldset>

            <fieldset className="picture-setup-field">
              <legend>{script === 'hiragana' ? 'Kana' : 'Kanji'} per answer</legend>
              <div className="picture-count-selector">
                {([1, 2, 3, 4] as const).map((item) => (
                  <button key={item} type="button" className={length === item ? 'is-active' : ''} onClick={() => resetSetup(script, item)} aria-pressed={length === item} aria-label={`${item} ${script === 'hiragana' ? 'kana' : 'kanji'}`}>
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {!ready && <p className="picture-practice-note">More pictures are needed for this setting.</p>}
          <button type="button" className="btn btn-primary beginner-action-btn-green picture-setup-start" onClick={start} disabled={!ready}>
            Start {ROUNDS} rounds →
          </button>
        </main>
      ) : done ? (
        <main className="beginner-card beginner-card-complete">
          <span className="beginner-complete-mark" aria-hidden="true">絵</span>
          <h2>{correct === ROUNDS ? 'Perfect match' : 'Picture run complete'}</h2>
          <p className="beginner-challenge-score">{correct} / {ROUNDS}</p>
          <p>{script === 'hiragana' ? 'Hiragana' : 'Kanji'} · {length} {script === 'hiragana' ? 'kana' : 'kanji'}</p>
          <button type="button" className="btn btn-primary" onClick={start}>Run it again</button>
          <button type="button" className="btn btn-ghost" onClick={() => resetSetup()}>Change settings</button>
        </main>
      ) : (
        <main className="beginner-card beginner-challenge picture-practice-card">
          <div className="beginner-challenge-top">
            <span className="beginner-write-label">Round {round} of {ROUNDS}</span>
            <button type="button" className="beginner-speedrun-quit" onClick={() => resetSetup()}>Quit</button>
          </div>

          <div className={`picture-practice-answer${picked ? ' is-visible' : ''}`} lang="ja" aria-live="polite">
            {picked ? prompt?.text : '\u00a0'}
          </div>

          <div className="picture-practice-image" role="img" aria-label={prompt?.meaning}>
            <span>{prompt?.image}</span>
          </div>

          <div className={`picture-practice-meaning${picked ? ' is-visible' : ''}`} aria-live="polite">
            {picked ? prompt?.meaning : '\u00a0'}
          </div>

          <div className="beginner-challenge-choices">
            {choices.map((choice) => {
              const isAnswer = choice.text === prompt?.text
              const state = picked
                ? isAnswer ? ' is-correct' : choice.text === picked ? ' is-wrong' : ' is-dimmed'
                : choice.text === selected ? ' is-selected' : ''
              return (
                <button
                  key={choice.text}
                  type="button"
                  className={`beginner-challenge-choice${state}`}
                  onClick={() => setSelected(choice.text)}
                  disabled={Boolean(picked)}
                  aria-pressed={choice.text === selected}
                  lang="ja"
                >
                  {choice.text}
                </button>
              )
            })}
          </div>

          <div className="beginner-speedrun-footer">
            {!picked ? (
              <button type="button" className="btn btn-primary beginner-action-btn beginner-action-btn-green picture-practice-action" onClick={submit} disabled={!selected}>
                Submit
              </button>
            ) : (
              <button type="button" className="btn btn-primary beginner-action-btn beginner-action-btn-green picture-practice-action" onClick={next}>
                {round >= ROUNDS ? 'See result →' : 'Next →'}
              </button>
            )}
          </div>
        </main>
      )}
    </div>
  )
}
