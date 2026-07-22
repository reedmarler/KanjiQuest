import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { GRAMMAR_LEVELS, grammarPracticeExercises } from '../data/grammarPractice'
import type { GrammarJlptLevel } from '../data/grammarPractice'
import { FuriganaSegment } from './FuriganaText'
import { shuffle } from '../lib/quiz'

const SHOW_FURIGANA_STORAGE_KEY = 'kanji-quest-grammar-practice-show-furigana-v1'
const LEVELS_STORAGE_KEY = 'kanji-quest-grammar-practice-levels-v1'
const INFINITE_STORAGE_KEY = 'kanji-quest-grammar-practice-infinite-v1'
const MAX_HINTS = 2

interface GrammarPracticeProps {
  onBack: () => void
}

const levelCounts = Object.fromEntries(
  GRAMMAR_LEVELS.map((level) => [level, grammarPracticeExercises.filter((item) => item.jlpt === level).length]),
) as Record<GrammarJlptLevel, number>

function loadLevelPreference(): GrammarJlptLevel[] {
  const fallback: GrammarJlptLevel[] = ['N5']
  if (typeof window === 'undefined') return fallback

  try {
    const stored = window.localStorage.getItem(LEVELS_STORAGE_KEY)
    if (!stored) return fallback
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return fallback
    const levels = GRAMMAR_LEVELS.filter((level) => parsed.includes(level))
    return levels.length ? [...levels] : fallback
  } catch {
    return fallback
  }
}

function saveLevelPreference(levels: GrammarJlptLevel[]) {
  try {
    window.localStorage.setItem(LEVELS_STORAGE_KEY, JSON.stringify(levels))
  } catch {
    // Practice preferences can safely remain in memory when storage is unavailable.
  }
}

function loadBooleanPreference(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback

  try {
    const stored = window.localStorage.getItem(key)
    return stored === null ? fallback : stored === 'true'
  } catch {
    return fallback
  }
}

function saveBooleanPreference(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // Display preferences can safely remain in memory when storage is unavailable.
  }
}

export function GrammarPractice({ onBack }: GrammarPracticeProps) {
  const [levels, setLevels] = useState<GrammarJlptLevel[]>(loadLevelPreference)
  const [levelMenuOpen, setLevelMenuOpen] = useState(false)
  const levelPickerRef = useRef<HTMLDivElement>(null)
  // Shuffled once per visit (and again on restart or a level change) so the same
  // sentences don't always show up in the same fixed order every time.
  const [exercises, setExercises] = useState(() =>
    shuffle(grammarPracticeExercises.filter((item) => loadLevelPreference().includes(item.jlpt))),
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const [showFurigana, setShowFurigana] = useState(() =>
    loadBooleanPreference(SHOW_FURIGANA_STORAGE_KEY, true),
  )
  const [infiniteMode, setInfiniteMode] = useState(() =>
    loadBooleanPreference(INFINITE_STORAGE_KEY, false),
  )
  const [eliminatedOptions, setEliminatedOptions] = useState<Set<string>>(new Set())
  const [hintCount, setHintCount] = useState(0)
  const [gapWidth, setGapWidth] = useState<number | null>(null)
  const gapMeasureRef = useRef<HTMLDivElement>(null)

  const exercise = exercises[currentIndex] ?? exercises[0] ?? grammarPracticeExercises[0]
  const isCorrect = selected === exercise.answer
  // Infinite mode appends another shuffled pass at the end, so measure progress
  // within the current pass — otherwise the bar would lurch backwards each lap.
  const poolSize = useMemo(
    () => grammarPracticeExercises.filter((item) => levels.includes(item.jlpt)).length,
    [levels],
  )
  const passIndex = poolSize ? currentIndex % poolSize : currentIndex
  const progress = ((passIndex + 1) / (poolSize || 1)) * 100
  const promptParts = useMemo(() => exercise.prompt.split('___'), [exercise.prompt])
  const promptReadingParts = useMemo(
    () => (exercise.promptReading ?? '').split('___'),
    [exercise.promptReading],
  )
  // The gap always shows either the answer (once checked) or whatever the learner has picked so far.
  const previewWord = answered ? exercise.answer : selected
  const previewReading = answered
    ? exercise.answerReading
    : selected
      ? exercise.optionReadings[exercise.options.indexOf(selected)]
      : undefined

  // Reserve room for the longest of this question's options so picking an answer never
  // shifts the sentence around — the gap is sized up front for the widest possible word.
  useLayoutEffect(() => {
    const container = gapMeasureRef.current
    if (!container) return
    const widths = Array.from(container.children).map((el) => (el as HTMLElement).offsetWidth)
    // A couple of extra pixels absorbs sub-pixel rounding from offsetWidth so the
    // real gap never comes in a hair too narrow and wraps the text it's sized for.
    setGapWidth(widths.length ? Math.max(...widths) + 3 : null)
  }, [exercise.id])

  useEffect(() => {
    if (!levelMenuOpen) return

    const closeLevelMenu = (event: PointerEvent) => {
      if (!levelPickerRef.current?.contains(event.target as Node)) {
        setLevelMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeLevelMenu)
    return () => document.removeEventListener('pointerdown', closeLevelMenu)
  }, [levelMenuOpen])

  function toggleLevel(level: GrammarJlptLevel) {
    // Keep at least one level on — an empty set would leave nothing to practice.
    const next = levels.includes(level)
      ? levels.filter((item) => item !== level)
      : GRAMMAR_LEVELS.filter((item) => item === level || levels.includes(item))
    if (!next.length) return

    setLevels(next)
    saveLevelPreference(next)
    startSession(next)
  }

  /** Restart the run against `nextLevels`, reshuffled. */
  function startSession(nextLevels: GrammarJlptLevel[]) {
    setExercises(shuffle(grammarPracticeExercises.filter((item) => nextLevels.includes(item.jlpt))))
    setCurrentIndex(0)
    setSelected(null)
    setAnswered(false)
    setCorrectCount(0)
    setFinished(false)
    setEliminatedOptions(new Set())
    setHintCount(0)
  }

  function toggleInfiniteMode() {
    setInfiniteMode((enabled) => {
      const next = !enabled
      saveBooleanPreference(INFINITE_STORAGE_KEY, next)
      return next
    })
  }

  function toggleFurigana() {
    setShowFurigana((shown) => {
      const next = !shown
      saveBooleanPreference(SHOW_FURIGANA_STORAGE_KEY, next)
      return next
    })
  }

  function useHint() {
    if (answered || hintCount >= MAX_HINTS) return
    const wrongOptions = exercise.options.filter(
      (option) => option !== exercise.answer && !eliminatedOptions.has(option),
    )
    if (wrongOptions.length === 0) return

    const pick = wrongOptions[Math.floor(Math.random() * wrongOptions.length)]
    setEliminatedOptions((prev) => new Set(prev).add(pick))
    setHintCount((count) => count + 1)
    setSelected((current) => (current === pick ? null : current))
  }

  function choose(option: string) {
    if (answered || eliminatedOptions.has(option)) return
    setSelected((current) => (current === option ? null : option))
  }

  function clearSelection() {
    if (answered) return
    setSelected(null)
  }

  function continuePractice() {
    if (!selected) return
    if (!answered) {
      setAnswered(true)
      if (selected === exercise.answer) setCorrectCount((count) => count + 1)
      return
    }
    if (currentIndex + 1 >= exercises.length) {
      if (!infiniteMode) {
        setFinished(true)
        return
      }
      // Queue another reshuffled pass so practice never runs out.
      setExercises((items) => [
        ...items,
        ...shuffle(grammarPracticeExercises.filter((item) => levels.includes(item.jlpt))),
      ])
    }
    setCurrentIndex((index) => index + 1)
    setSelected(null)
    setAnswered(false)
    setEliminatedOptions(new Set())
    setHintCount(0)
  }

  function restart() {
    startSession(levels)
  }

  if (finished) {
    return (
      <div className="grammar-practice-view">
        <button className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <section className="grammar-finish-card">
          <span className="grammar-finish-mark">文法</span>
          <h1>Grammar practice complete</h1>
          <p>You got <strong>{correctCount}</strong> of {exercises.length} grammar choices right.</p>
          <div className="grammar-finish-actions">
            <button className="btn btn-primary" onClick={restart}>Practice again</button>
            <button className="btn btn-secondary" onClick={onBack}>Dashboard</button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={`grammar-practice-view${showFurigana ? '' : ' is-furigana-hidden'}`}>
      <div className="study-top grammar-study-top">
        <button className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <span className="study-progress">
          {infiniteMode ? `${currentIndex + 1} / ∞` : `${currentIndex + 1} / ${exercises.length}`}
        </span>
        <div className="builder-top-controls">
          <button
            type="button"
            className={`builder-infinite-toggle${infiniteMode ? ' is-active' : ''}`}
            onClick={toggleInfiniteMode}
            aria-pressed={infiniteMode}
            aria-label={infiniteMode ? 'Turn off endless grammar practice' : 'Keep grammar practice going indefinitely'}
            title={infiniteMode ? 'Endless practice on' : 'Keep practicing without an ending'}
          >
            ∞
          </button>
          <div className="builder-level-picker" ref={levelPickerRef}>
            <button
              type="button"
              className="study-type-badge builder-level-trigger"
              aria-expanded={levelMenuOpen}
              aria-haspopup="true"
              onClick={() => setLevelMenuOpen((open) => !open)}
            >
              <span>Grammar</span>
              <span className="jlpt-badge">{levels.join(' + ')}</span>
              <span className="builder-level-chevron" aria-hidden="true" />
            </button>
            {levelMenuOpen && (
              <div className="builder-level-menu" role="group" aria-label="Grammar JLPT levels">
                <span className="builder-level-menu-label">Practice levels</span>
                {GRAMMAR_LEVELS.map((level) => {
                  const isSelected = levels.includes(level)

                  return (
                    <button
                      key={level}
                      type="button"
                      className={`builder-level-option${isSelected ? ' is-selected' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => toggleLevel(level)}
                    >
                      <span className="builder-level-check" aria-hidden="true" />
                      <strong>{level}</strong>
                      <small>{levelCounts[level]} sentences</small>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="study-progress-bar">
        <div className="study-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <main className="grammar-choice-card">
        <div className="grammar-eyebrow">Choose the grammar that fits</div>

        <p className="grammar-english-clue">“{exercise.english}”</p>

        <div className="grammar-sentence-frame" lang="ja">
          <FuriganaSegment text={promptParts[0]} reading={promptReadingParts[0]} />
          <span
            className={`grammar-gap${previewWord ? ' is-filled' : ''}${answered ? (isCorrect ? ' is-correct' : ' is-wrong') : ''}`}
            style={gapWidth ? { width: `${gapWidth}px` } : undefined}
          >
            {previewWord ? <FuriganaSegment text={previewWord} reading={previewReading} /> : ' '}
          </span>
          <FuriganaSegment text={promptParts[1]} reading={promptReadingParts[1]} />
          <div className="grammar-gap-measure" aria-hidden="true" ref={gapMeasureRef}>
            {exercise.options.map((option, optionIndex) => (
              <span key={option} className="grammar-gap">
                <FuriganaSegment text={option} reading={exercise.optionReadings[optionIndex]} />
              </span>
            ))}
          </div>
        </div>

        <div className="grammar-options" aria-label="Grammar answers">
          {exercise.options.map((option, optionIndex) => {
            const isEliminated = !answered && eliminatedOptions.has(option)
            let className = 'grammar-option'
            if (answered) {
              if (option === exercise.answer) className += ' correct'
              else if (option === selected) className += ' wrong'
              else className += ' dimmed'
            } else if (isEliminated) {
              className += ' eliminated'
            } else if (option === selected) {
              className += ' selected'
            }
            return (
              <button
                key={option}
                type="button"
                className={className}
                onClick={() => choose(option)}
                disabled={answered || isEliminated}
              >
                <FuriganaSegment text={option} reading={exercise.optionReadings[optionIndex]} />
              </button>
            )
          })}
        </div>

        <div className="sentence-action-slot grammar-action-slot">
          <button
            className="btn btn-primary sentence-inline-check"
            onClick={continuePractice}
            disabled={!selected}
          >
            {answered ? 'Continue' : 'Check / かくにん / 確認'}
          </button>
        </div>

        <div className="sentence-actions-row sentence-builder-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={clearSelection}
            disabled={answered || !selected}
          >
            Clear
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={useHint}
            disabled={answered || hintCount >= MAX_HINTS}
          >
            Hint
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={toggleFurigana}
            aria-pressed={showFurigana}
          >
            {showFurigana ? 'Hide Furigana' : 'Show Furigana'}
          </button>
        </div>
      </main>
    </div>
  )
}
