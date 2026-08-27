import { useMemo, useState } from 'react'
import { pictureVocabulary, type PictureVocabularyEntry } from '../data/pictureVocabulary'
import { AppBackButton } from './AppBackButton'

type PictureScript = 'hiragana' | 'kanji'
type PictureLength = 1 | 2 | 3 | 4
type PictureCategory = PictureVocabularyEntry['category']
type PictureCategoryChoice = 'all' | PictureCategory

interface PicturePrompt {
  text: string
  meaning: string
  image: string
  category: PictureVocabularyEntry['category']
}

const ROUNDS = 10
const CHOICE_COUNT = 4
const CATEGORY_OPTIONS: Array<{ value: PictureCategoryChoice, label: string, icon: string }> = [
  { value: 'all', label: 'All', icon: '✦' },
  { value: 'animals', label: 'Animals', icon: '🐾' },
  { value: 'body', label: 'Body', icon: '✋' },
  { value: 'food', label: 'Food', icon: '🍙' },
  { value: 'nature', label: 'Nature', icon: '🍃' },
  { value: 'objects', label: 'Objects', icon: '🎒' },
  { value: 'people', label: 'People', icon: '人' },
  { value: 'places', label: 'Places', icon: '⛩️' },
  { value: 'transport', label: 'Transport', icon: '🚃' },
]

function shuffled<T>(items: readonly T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  }
  return copy
}

function buildPool(script: PictureScript, length: PictureLength, category: PictureCategoryChoice = 'all') {
  return pictureVocabulary.flatMap((entry) => {
    const text = script === 'hiragana' ? entry.kana : entry.kanji
    if (!text || [...text].length !== length || (category !== 'all' && entry.category !== category)) return []
    return [{ text, meaning: entry.meaning, image: entry.image, category: entry.category }]
  })
}

function compatibleLengths(script: PictureScript, category: PictureCategoryChoice) {
  return ([1, 2, 3, 4] as const).filter(
    (length) => buildPool(script, length, category).length >= CHOICE_COUNT,
  )
}

function closestLength(current: PictureLength, choices: readonly PictureLength[]) {
  return choices.reduce((closest, candidate) => (
    Math.abs(candidate - current) < Math.abs(closest - current) ? candidate : closest
  ))
}

interface PicturePracticeProps {
  onBack: () => void
}

export function PicturePractice({ onBack }: PicturePracticeProps) {
  const [script, setScript] = useState<PictureScript>('hiragana')
  const [length, setLength] = useState<PictureLength>(2)
  const [category, setCategory] = useState<PictureCategoryChoice>('all')
  const [round, setRound] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [prompt, setPrompt] = useState<PicturePrompt | null>(null)
  const [choices, setChoices] = useState<PicturePrompt[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSnapshot, setSettingsSnapshot] = useState<{
    script: PictureScript
    length: PictureLength
    category: PictureCategoryChoice
  } | null>(null)

  const pool = useMemo(() => buildPool(script, length, category), [script, length, category])
  const ready = pool.length >= CHOICE_COUNT
  const categoryLabel = CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? 'All'

  function askRound(nextRound: number, sourcePool = pool) {
    const answer = sourcePool[Math.floor(Math.random() * sourcePool.length)]!
    const sameCategory = shuffled(sourcePool.filter(
      (entry) => entry.text !== answer.text && entry.category === answer.category,
    ))
    const fallback = shuffled(sourcePool.filter(
      (entry) => entry.text !== answer.text && entry.category !== answer.category,
    ))
    const distractors = [...sameCategory, ...fallback].slice(0, CHOICE_COUNT - 1)
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

  function openSettings() {
    setSettingsSnapshot({ script, length, category })
    setSettingsOpen(true)
  }

  function closeSettings() {
    const changed = settingsSnapshot?.script !== script
      || settingsSnapshot?.length !== length
      || settingsSnapshot?.category !== category
    setSettingsOpen(false)
    setSettingsSnapshot(null)
    if (changed && ready) {
      setCorrect(0)
      askRound(1, pool)
    }
  }

  function cancelSettings() {
    if (settingsSnapshot) {
      setScript(settingsSnapshot.script)
      setLength(settingsSnapshot.length)
      setCategory(settingsSnapshot.category)
    }
    setSettingsOpen(false)
    setSettingsSnapshot(null)
  }

  function changeSettings(nextScript: PictureScript, nextLength: PictureLength) {
    if (buildPool(nextScript, nextLength, category).length < CHOICE_COUNT) return
    setScript(nextScript)
    setLength(nextLength)
  }

  function chooseScript(nextScript: PictureScript) {
    const lengths = compatibleLengths(nextScript, category)
    if (lengths.length === 0) return
    setScript(nextScript)
    setLength(lengths.includes(length) ? length : closestLength(length, lengths))
  }

  function chooseCategory(nextCategory: PictureCategoryChoice) {
    if (nextCategory === 'all') {
      setCategory('all')
      return
    }

    let nextScript = script
    let lengths = compatibleLengths(nextScript, nextCategory)
    if (lengths.length === 0) {
      nextScript = script === 'hiragana' ? 'kanji' : 'hiragana'
      lengths = compatibleLengths(nextScript, nextCategory)
    }
    if (lengths.length === 0) return

    setCategory(nextCategory)
    setScript(nextScript)
    setLength(lengths.includes(length) ? length : closestLength(length, lengths))
  }

  function resetSetup(nextScript = script, nextLength = length, nextCategory = category) {
    setScript(nextScript)
    setLength(nextLength)
    setCategory(nextCategory)
    setRound(0)
    setCorrect(0)
    setPrompt(null)
    setChoices([])
    setSelected(null)
    setPicked(null)
    setDone(false)
    setSettingsOpen(false)
    setSettingsSnapshot(null)
  }

  return (
    <div className="beginner-learner picture-practice">
      <div className="beginner-learner-top">
        <AppBackButton onClick={onBack} aria-label="Back to Dashboard" />
        <span className="beginner-learner-title">Picture Mode</span>
        {round > 0 && !done ? (
          <button type="button" className="beginner-speedrun-header-settings" onClick={openSettings}>Settings</button>
        ) : <span />}
      </div>

      {round === 0 ? (
        <main className="beginner-card picture-practice-setup" aria-label="Picture practice settings">
          <div className="picture-setup-controls">
            <fieldset className="picture-setup-field">
              <legend>Category</legend>
              <div className="picture-category-options" role="group" aria-label="Picture category">
                {CATEGORY_OPTIONS.map((option) => (
                  <button key={option.value} type="button" className={category === option.value ? 'is-active' : ''} onClick={() => chooseCategory(option.value)} aria-pressed={category === option.value} title={option.label}>
                    <span aria-hidden="true">{option.icon}</span>
                    <small>{option.label}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="picture-setup-field">
              <legend>Writing</legend>
              <div className="picture-segmented beginner-speedrun-script-selector">
                <button type="button" className={script === 'hiragana' ? 'is-active' : ''} onClick={() => chooseScript('hiragana')} aria-pressed={script === 'hiragana'} disabled={compatibleLengths('hiragana', category).length === 0}>
                  <span lang="ja">あ</span> Hiragana
                </button>
                <button type="button" className={script === 'kanji' ? 'is-active' : ''} onClick={() => chooseScript('kanji')} aria-pressed={script === 'kanji'} disabled={compatibleLengths('kanji', category).length === 0}>
                  <span lang="ja">漢</span> Kanji
                </button>
              </div>
            </fieldset>

            <fieldset className="picture-setup-field">
              <legend>{script === 'hiragana' ? 'Kana' : 'Kanji'} per answer</legend>
              <div className="picture-count-selector beginner-speedrun-count-selector picture-practice-count-selector">
                {([1, 2, 3, 4] as const).map((item) => (
                  <button key={item} type="button" className={length === item ? 'is-active' : ''} onClick={() => changeSettings(script, item)} aria-pressed={length === item} aria-label={`${item} ${script === 'hiragana' ? 'kana' : 'kanji'}`} disabled={buildPool(script, item, category).length < CHOICE_COUNT}>
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {!ready && <p className="picture-practice-note">More pictures are needed for this setting.</p>}
          <button type="button" className="btn btn-primary beginner-action-btn-green picture-setup-start" onClick={start} disabled={!ready}>
            Start
          </button>
        </main>
      ) : done ? (
        <main className="beginner-card beginner-card-complete">
          <span className="beginner-complete-mark" aria-hidden="true">絵</span>
          <h2>{correct === ROUNDS ? 'Perfect match' : 'Picture run complete'}</h2>
          <p className="beginner-challenge-score">{correct} / {ROUNDS}</p>
          <p>{script === 'hiragana' ? 'Hiragana' : 'Kanji'} · {length} {script === 'hiragana' ? 'kana' : 'kanji'} · {categoryLabel}</p>
          <button type="button" className="btn btn-primary" onClick={start}>Run it again</button>
          <button type="button" className="btn btn-ghost" onClick={() => resetSetup()}>Change settings</button>
        </main>
      ) : (
        <main className="beginner-card beginner-challenge picture-practice-card">
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

          {settingsOpen && (
            <div className="beginner-speedrun-settings-backdrop">
              <section className="beginner-speedrun-settings" role="dialog" aria-modal="true" aria-label="Picture mode settings">
                <header>
                  <b>Picture settings</b>
                  <button type="button" onClick={cancelSettings} aria-label="Close settings">&times;</button>
                </header>

                <div className="picture-setup-controls">
                  <fieldset className="picture-setup-field">
                    <legend>Category</legend>
                    <div className="picture-category-options" role="group" aria-label="Picture category">
                      {CATEGORY_OPTIONS.map((option) => (
                        <button key={option.value} type="button" className={category === option.value ? 'is-active' : ''} onClick={() => chooseCategory(option.value)} aria-pressed={category === option.value} title={option.label}>
                          <span aria-hidden="true">{option.icon}</span>
                          <small>{option.label}</small>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="picture-setup-field">
                    <legend>Writing</legend>
                    <div className="picture-segmented beginner-speedrun-script-selector">
                      <button type="button" className={script === 'hiragana' ? 'is-active' : ''} onClick={() => chooseScript('hiragana')} aria-pressed={script === 'hiragana'} disabled={compatibleLengths('hiragana', category).length === 0}><span lang="ja">あ</span> Hiragana</button>
                      <button type="button" className={script === 'kanji' ? 'is-active' : ''} onClick={() => chooseScript('kanji')} aria-pressed={script === 'kanji'} disabled={compatibleLengths('kanji', category).length === 0}><span lang="ja">漢</span> Kanji</button>
                    </div>
                  </fieldset>

                  <fieldset className="picture-setup-field">
                    <legend>{script === 'hiragana' ? 'Kana' : 'Kanji'} per answer</legend>
                    <div className="picture-count-selector picture-practice-count-selector">
                      {([1, 2, 3, 4] as const).map((item) => (
                        <button key={item} type="button" className={length === item ? 'is-active' : ''} onClick={() => changeSettings(script, item)} aria-pressed={length === item} disabled={buildPool(script, item, category).length < CHOICE_COUNT}>{item}</button>
                      ))}
                    </div>
                  </fieldset>
                  {!ready && <p className="picture-practice-note">More pictures are needed for this setting.</p>}
                </div>

                <footer>
                  <button type="button" className="btn btn-ghost" onClick={() => resetSetup()}>Quit run</button>
                  <button type="button" className="btn btn-primary beginner-action-btn-green" onClick={closeSettings} disabled={!ready}>Done</button>
                </footer>
              </section>
            </div>
          )}
        </main>
      )}
    </div>
  )
}
