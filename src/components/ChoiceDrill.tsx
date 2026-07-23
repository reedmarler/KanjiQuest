import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DRILL_LEVELS } from '../lib/drillExercises'
import type { DrillExercise, DrillJlptLevel } from '../lib/drillExercises'
import { FuriganaSegment } from './FuriganaText'
import { shuffle } from '../lib/quiz'

const MAX_HINTS = 2
const DEFAULT_SESSION_SIZE = 15

function fitFixedTextBox(element: HTMLElement | null, maximumSize: number, minimumSize: number) {
  if (!element) return

  element.style.fontSize = `${maximumSize}px`

  for (let size = maximumSize; size > minimumSize; size -= 1) {
    if (element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1) {
      return
    }

    element.style.fontSize = `${size - 1}px`
  }
}

export interface ChoiceDrillProps {
  /** Every exercise available; the level picker filters this pool. */
  pool: DrillExercise[]
  /** Shown in the level-picker badge, e.g. "Grammar" or "Vocab". */
  badgeLabel: string
  /** Instruction above the sentence. */
  eyebrow: string
  /** Japanese mark on the completion card. */
  finishMark: string
  finishTitle: string
  /** Plural noun for the score line, e.g. "grammar choices". */
  finishNoun: string
  /** Namespaces the saved preferences so each drill remembers its own settings. */
  storagePrefix: string
  /** Vocab can generate a fresh set when an endless pass ends. */
  onLoadNextPool?: () => Promise<DrillExercise[]>
  isFavorite: (exercise: DrillExercise) => boolean
  onToggleFavorite: (exercise: DrillExercise) => void
  onBack: () => void
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

function loadLevelPreference(key: string): DrillJlptLevel[] {
  const fallback: DrillJlptLevel[] = ['N5']
  if (typeof window === 'undefined') return fallback

  try {
    const stored = window.localStorage.getItem(key)
    if (!stored) return fallback
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return fallback
    const levels = DRILL_LEVELS.filter((level) => parsed.includes(level))
    return levels.length ? [...levels] : fallback
  } catch {
    return fallback
  }
}

function saveLevelPreference(key: string, levels: DrillJlptLevel[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(levels))
  } catch {
    // Practice preferences can safely remain in memory when storage is unavailable.
  }
}

function initialAvailableLevels(key: string, availableLevels: DrillJlptLevel[]) {
  const stored = loadLevelPreference(key)
  const selected = stored.filter((level) => availableLevels.includes(level))
  return selected.length ? selected : [availableLevels[0] ?? 'N5']
}

function buildPracticeSession(pool: DrillExercise[], levels: readonly DrillJlptLevel[]) {
  return shuffle(pool.filter((item) => levels.includes(item.jlpt))).slice(0, DEFAULT_SESSION_SIZE)
}

/**
 * Fill-the-blank multiple-choice drill shared by Grammar and Vocab practice.
 * Styling reuses the `grammar-*` classes, which are the drill's visual system
 * rather than anything grammar-specific.
 */
export function ChoiceDrill({
  pool,
  badgeLabel,
  eyebrow,
  finishMark,
  finishTitle,
  finishNoun,
  storagePrefix,
  onLoadNextPool,
  isFavorite,
  onToggleFavorite,
  onBack,
}: ChoiceDrillProps) {
  const furiganaKey = `${storagePrefix}-show-furigana-v1`
  const levelsKey = `${storagePrefix}-levels-v1`
  const infiniteKey = `${storagePrefix}-infinite-v1`
  const fastModeKey = `${storagePrefix}-fast-mode-v1`

  const levelCounts = useMemo(
    () =>
      Object.fromEntries(
        DRILL_LEVELS.map((level) => [level, pool.filter((item) => item.jlpt === level).length]),
      ) as Record<DrillJlptLevel, number>,
    [pool],
  )
  const availableLevels = useMemo(
    () => DRILL_LEVELS.filter((level) => levelCounts[level] > 0),
    [levelCounts],
  )

  const [levels, setLevels] = useState<DrillJlptLevel[]>(() => initialAvailableLevels(levelsKey, availableLevels))
  const [pendingLevels, setPendingLevels] = useState<DrillJlptLevel[]>(levels)
  const [levelMenuOpen, setLevelMenuOpen] = useState(false)
  const levelPickerRef = useRef<HTMLDivElement>(null)
  // Shuffled once per visit (and again on restart or a level change) so the same
  // sentences don't always show up in the same fixed order every time.
  const [exercises, setExercises] = useState(() =>
    buildPracticeSession(pool, initialAvailableLevels(levelsKey, availableLevels)),
  )
  const [sessionPool, setSessionPool] = useState(pool)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const [loadingNextPool, setLoadingNextPool] = useState(false)
  const [infiniteCompletedCount, setInfiniteCompletedCount] = useState(0)
  const [showFurigana, setShowFurigana] = useState(() => loadBooleanPreference(furiganaKey, true))
  const [infiniteMode, setInfiniteMode] = useState(() => loadBooleanPreference(infiniteKey, false))
  const [fastMode, setFastMode] = useState(() => loadBooleanPreference(fastModeKey, false))
  const [eliminatedOptions, setEliminatedOptions] = useState<Set<string>>(new Set())
  const [hintCount, setHintCount] = useState(0)
  const [gapWidth, setGapWidth] = useState<number | null>(null)
  const sentenceFrameRef = useRef<HTMLDivElement>(null)
  const gapMeasureRef = useRef<HTMLDivElement>(null)

  const exercise = exercises[currentIndex] ?? exercises[0] ?? pool[0]
  const isCorrect = selected === exercise.answer
  const progress = ((currentIndex + 1) / (exercises.length || 1)) * 100
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

  useLayoutEffect(() => {
    fitFixedTextBox(sentenceFrameRef.current, 26, 13)
  }, [answered, exercise.id, gapWidth, previewWord, showFurigana])

  useEffect(() => {
    if (!levelMenuOpen) return
    setPendingLevels(levels)

    const closeLevelMenu = (event: PointerEvent) => {
      if (!levelPickerRef.current?.contains(event.target as Node)) {
        setLevelMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeLevelMenu)
    return () => document.removeEventListener('pointerdown', closeLevelMenu)
  }, [levelMenuOpen, levels])


  function togglePendingLevel(level: DrillJlptLevel) {
    if (!availableLevels.includes(level)) return
    setPendingLevels((current) => {
      const next = current.includes(level)
        ? current.filter((item) => item !== level)
        : availableLevels.filter((item) => item === level || current.includes(item))
      return next.length ? next : current
    })
  }

  async function applyPendingLevels() {
    const next = pendingLevels.filter((level) => availableLevels.includes(level))
    if (!next.length) return
    setLevelMenuOpen(false)
    setLevels(next)
    saveLevelPreference(levelsKey, next)
    if (!onLoadNextPool) {
      startSession(next, sessionPool)
      return
    }

    setLoadingNextPool(true)
    try {
      const nextPool = await onLoadNextPool()
      setSessionPool(nextPool)
      startSession(next, nextPool)
    } finally {
      setLoadingNextPool(false)
    }
  }

  /** Restart the run against `nextLevels`, reshuffled. */
  function startSession(nextLevels: DrillJlptLevel[], sourcePool = sessionPool) {
    setExercises(buildPracticeSession(sourcePool, nextLevels))
    setCurrentIndex(0)
    setSelected(null)
    setAnswered(false)
    setCorrectCount(0)
    setFinished(false)
    setInfiniteCompletedCount(0)
    setEliminatedOptions(new Set())
    setHintCount(0)
  }

  function toggleInfiniteMode() {
    setInfiniteMode((enabled) => {
      const next = !enabled
      saveBooleanPreference(infiniteKey, next)
      return next
    })
  }

  function toggleFastMode() {
    setFastMode((enabled) => {
      const next = !enabled
      saveBooleanPreference(fastModeKey, next)
      return next
    })
  }

  function toggleFurigana() {
    setShowFurigana((shown) => {
      const next = !shown
      saveBooleanPreference(furiganaKey, next)
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
    if (fastMode) {
      setSelected(option)
      setAnswered(true)
      if (option === exercise.answer) setCorrectCount((count) => count + 1)
      return
    }
    setSelected((current) => (current === option ? null : option))
  }

  function clearSelection() {
    if (answered) return
    setSelected(null)
  }

  async function advanceToNextExercise() {
    if (loadingNextPool) return
    if (currentIndex + 1 >= exercises.length) {
      if (!infiniteMode) {
        setFinished(true)
        return
      }
      if (onLoadNextPool) {
        setInfiniteCompletedCount((count) => count + 1)
        setLoadingNextPool(true)
        try {
          const nextPool = await onLoadNextPool()
          const nextExercises = buildPracticeSession(nextPool, levels)
          if (nextExercises.length) {
            setSessionPool(nextPool)
            setExercises(nextExercises)
            setCurrentIndex(0)
          }
        } finally {
          setLoadingNextPool(false)
        }
        setSelected(null)
        setAnswered(false)
        setEliminatedOptions(new Set())
        setHintCount(0)
        return
      }
      // Grammar has a fixed curated pool, so it still receives a reshuffled pass.
      setExercises((items) => [
        ...items,
        ...buildPracticeSession(sessionPool, levels),
      ])
    }
    setInfiniteCompletedCount((count) => infiniteMode ? count + 1 : count)
    setCurrentIndex((index) => index + 1)
    setSelected(null)
    setAnswered(false)
    setEliminatedOptions(new Set())
    setHintCount(0)
  }

  function goToPreviousExercise() {
    if (currentIndex === 0 || loadingNextPool) return
    setCurrentIndex((index) => Math.max(0, index - 1))
    setSelected(null)
    setAnswered(false)
    setEliminatedOptions(new Set())
    setHintCount(0)
  }

  async function continuePractice() {
    if (!selected || loadingNextPool) return
    if (!answered) {
      setAnswered(true)
      if (selected === exercise.answer) setCorrectCount((count) => count + 1)
      return
    }

    await advanceToNextExercise()
  }

  function restart() {
    startSession(levels)
  }

  if (loadingNextPool) {
    return (
      <div className="practice-loading">
        <button className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <section className="practice-loading-card" role="status" aria-live="polite">
          <span className="practice-loading-mark">{finishMark}</span>
          <h1>{badgeLabel}</h1>
          <p>Generating another fresh practice set</p>
          <div className="practice-loading-bar" aria-label="Generating a new practice set">
            <span className="is-indeterminate" />
          </div>
        </section>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="grammar-practice-view">
        <button className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <section className="grammar-finish-card">
          <span className="grammar-finish-mark">{finishMark}</span>
          <h1>{finishTitle}</h1>
          <p>You got <strong>{correctCount}</strong> of {exercises.length} {finishNoun} right.</p>
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
          {infiniteMode ? `${infiniteCompletedCount + 1} / ∞` : `${currentIndex + 1} / ${exercises.length}`}
        </span>
        <div className="builder-top-controls">
          <button
            type="button"
            className={`builder-infinite-toggle${infiniteMode ? ' is-active' : ''}`}
            onClick={toggleInfiniteMode}
            aria-pressed={infiniteMode}
            aria-label={
              infiniteMode
                ? `Turn off endless ${badgeLabel.toLowerCase()} practice`
                : `Keep ${badgeLabel.toLowerCase()} practice going indefinitely`
            }
            title={infiniteMode ? 'Endless practice on' : 'Keep practicing without an ending'}
          >
            ∞
          </button>
          <button
            type="button"
            className={`builder-fast-toggle${fastMode ? ' is-active' : ''}`}
            onClick={toggleFastMode}
            aria-pressed={fastMode}
            aria-label={fastMode ? 'Turn off fast mode' : 'Turn on fast mode: checks your answer the instant you pick it'}
            title={fastMode ? 'Fast mode on — picking an answer checks it instantly' : 'Fast mode: skip the Check button and blitz through questions'}
          >
            ⚡
          </button>
          <div className="builder-level-picker" ref={levelPickerRef}>
            <button
              type="button"
              className="study-type-badge builder-level-trigger"
              aria-expanded={levelMenuOpen}
              aria-haspopup="true"
              onClick={() => setLevelMenuOpen((open) => !open)}
            >
              <span>{badgeLabel}</span>
              <span className="jlpt-badge">{levels.join(' + ')}</span>
              <span className="builder-level-chevron" aria-hidden="true" />
            </button>
            {levelMenuOpen && (
              <div className="builder-level-menu" role="group" aria-label={`${badgeLabel} JLPT levels`}>
                <span className="builder-level-menu-label">Practice levels</span>
                {DRILL_LEVELS.map((level) => {
                  const enabled = availableLevels.includes(level)
                  const isSelected = pendingLevels.includes(level)

                  return (
                    <button
                      key={level}
                      type="button"
                      className={`builder-level-option${isSelected ? ' is-selected' : ''}`}
                      aria-pressed={isSelected}
                      disabled={!enabled}
                      onClick={() => togglePendingLevel(level)}
                    >
                      <span className="builder-level-check" aria-hidden="true" />
                      <strong>{level}</strong>
                      <small>{enabled ? 'Ready' : 'Soon'}</small>
                    </button>
                  )
                })}
                <button
                  type="button"
                  className="builder-level-save"
                  onClick={() => void applyPendingLevels()}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="study-progress-bar">
        <div className="study-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <main className="grammar-choice-card">
        <div className="drill-answer-top-actions">
          <button
            type="button"
            className="sentence-back-button"
            onClick={goToPreviousExercise}
            disabled={currentIndex === 0 || loadingNextPool}
            title={currentIndex === 0 ? 'First sentence' : 'Go back to the previous sentence'}
          >
            <svg className="sentence-back-icon" viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="15 5 8 12 15 19" />
            </svg>
          </button>
          <div className="sentence-top-right-actions">
            <button
              type="button"
              className="sentence-new-button"
              onClick={() => void advanceToNextExercise()}
              disabled={answered || loadingNextPool}
              title={answered ? 'Answer shown' : 'Move to the next sentence'}
            >
              ↻
            </button>
            <button
              type="button"
              className={`sentence-favorite-button${isFavorite(exercise) ? ' is-favorite' : ''}`}
              onClick={() => onToggleFavorite(exercise)}
              aria-label={isFavorite(exercise) ? 'Remove sentence from favorites' : 'Add sentence to favorites'}
              aria-pressed={isFavorite(exercise)}
              title={isFavorite(exercise) ? 'Remove from favorite sentences' : 'Add to favorite sentences'}
            >
              {isFavorite(exercise) ? '★' : '☆'}
            </button>
          </div>
        </div>
        <div className="grammar-eyebrow">{eyebrow}</div>

        <p className="grammar-english-clue">“{exercise.english}”</p>

        <div className="grammar-sentence-frame" lang="ja" ref={sentenceFrameRef}>
          {exercise.promptFurigana
            ? exercise.promptFurigana.before.map((part, index) => (
                <FuriganaSegment key={`before-${index}-${part.text}`} text={part.text} reading={part.reading} />
              ))
            : <FuriganaSegment text={promptParts[0]} reading={promptReadingParts[0]} />}
          <span
            className={`grammar-gap${previewWord ? ' is-filled' : ''}${answered ? (isCorrect ? ' is-correct' : ' is-wrong') : ''}`}
            style={gapWidth ? { width: `${gapWidth}px` } : undefined}
          >
            {/* A non-breaking space keeps the blank's line box — a plain space gets
                collapsed inside the flex row, leaving the underline stranded mid-sentence. */}
            {previewWord ? <FuriganaSegment text={previewWord} reading={previewReading} /> : ' '}
          </span>
          {exercise.promptFurigana
            ? exercise.promptFurigana.after.map((part, index) => (
                <FuriganaSegment key={`after-${index}-${part.text}`} text={part.text} reading={part.reading} />
              ))
            : <FuriganaSegment text={promptParts[1]} reading={promptReadingParts[1]} />}
          <div className="grammar-gap-measure" aria-hidden="true" ref={gapMeasureRef}>
            {exercise.options.map((option, optionIndex) => (
              <span key={option} className="grammar-gap">
                <FuriganaSegment text={option} reading={exercise.optionReadings[optionIndex]} />
              </span>
            ))}
          </div>
        </div>

        <div className="grammar-options" aria-label={`${badgeLabel} answers`}>
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
