import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toHiragana, toRomaji } from 'wanakana'
import { AnswerReveal } from './AnswerReveal'
import { FuriganaSegment, hasKanji } from './FuriganaText'
import { shuffle } from '../lib/quiz'
import type { SentenceExercise } from '../data/sentenceExercises'

interface SentenceBuilderViewProps {
  exercise: SentenceExercise
  current: number
  total: number
  onResult: (correct: boolean) => void
  onSkip: () => void
  onExit: () => void
}

function normalizeSentenceAnswer(value: string): string {
  return toHiragana(value.toLowerCase())
    .replace(/[\s。、，．！？!?.,'’"“”\-ー]/g, '')
}

function normalizeRomajiAnswer(value: string): string {
  return toRomaji(toHiragana(value.toLowerCase()))
    .replace(/[\s。、，．！？!?.,'’"“”\-]/g, '')
}

function isRomajiAnswer(value: string): boolean {
  return /[a-z]/i.test(value) && !/[\u3040-\u30ff\u3400-\u9fff]/.test(value)
}

function wrongAnswerParts(answer: string, expected: string) {
  let start = 0

  while (start < answer.length && start < expected.length && answer[start] === expected[start]) {
    start++
  }

  let answerEnd = answer.length
  let expectedEnd = expected.length

  while (
    answerEnd > start &&
    expectedEnd > start &&
    answer[answerEnd - 1] === expected[expectedEnd - 1]
  ) {
    answerEnd--
    expectedEnd--
  }

  return {
    before: answer.slice(0, start),
    wrong: answer.slice(start, answerEnd),
    after: answer.slice(answerEnd),
  }
}

function romajiDisplayValue(value: string): string {
  return toRomaji(toHiragana(value.toLowerCase()))
}

function romajiForSegment(segment: string): string {
  return toRomaji(
    segment
      .replace(/([をがはにへでともの])([。！？!?.,、，．]*)$/u, ' $1$2')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function romajiDisplayParts(answer: string, expected: string) {
  const display = romajiDisplayValue(answer)
  const comparableChars: { char: string; index: number }[] = []

  for (let i = 0; i < display.length; i++) {
    const char = display[i]

    if (!/[\s。、，．！？!?.,'’"“”\-]/.test(char)) {
      comparableChars.push({ char, index: i })
    }
  }

  const normalizedAnswer = comparableChars.map((item) => item.char).join('')
  const normalizedExpected = normalizeRomajiAnswer(expected)
  const wrongParts = wrongAnswerParts(normalizedAnswer, normalizedExpected)
  const wrongStart = wrongParts.before.length
  const wrongEnd = wrongStart + wrongParts.wrong.length
  const displayStart = comparableChars[wrongStart]?.index ?? display.length
  const displayEnd =
    wrongEnd > wrongStart
      ? (comparableChars[wrongEnd - 1]?.index ?? display.length - 1) + 1
      : displayStart

  return {
    before: display.slice(0, displayStart),
    wrong: display.slice(displayStart, displayEnd),
    after: display.slice(displayEnd),
  }
}

type RomajiDisplayPart = {
  text: string
  wrong: boolean
  missing?: boolean
}

function romajiWord(value: string): string {
  return value.replace(/[。、，．！？!?.,'’"“”\-]/g, '')
}

function editDistance(left: string, right: string): number {
  const distances = Array.from({ length: left.length + 1 }, () =>
    Array(right.length + 1).fill(0) as number[],
  )

  for (let i = 0; i <= left.length; i++) distances[i][0] = i
  for (let j = 0; j <= right.length; j++) distances[0][j] = j

  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      distances[i][j] =
        left[i - 1] === right[j - 1]
          ? distances[i - 1][j - 1]
          : Math.min(distances[i - 1][j], distances[i][j - 1], distances[i - 1][j - 1]) + 1
    }
  }

  return distances[left.length][right.length]
}

function isNearRomajiWord(answer: string, expected: string): boolean {
  if (!answer || !expected) return false
  const distance = editDistance(answer, expected)
  const maxDistance = Math.max(1, Math.floor(Math.max(answer.length, expected.length) * 0.35))

  return distance <= maxDistance
}

function romajiWordPairs(answerWords: string[], expectedWords: string[]) {
  const pairs: [number, number][] = []
  let expectedStart = 0

  for (let answerIndex = 0; answerIndex < answerWords.length; answerIndex++) {
    let bestExpected = -1
    let bestDistance = Number.POSITIVE_INFINITY

    for (let expectedIndex = expectedStart; expectedIndex < expectedWords.length; expectedIndex++) {
      if (!isNearRomajiWord(answerWords[answerIndex], expectedWords[expectedIndex])) continue

      const distance = editDistance(answerWords[answerIndex], expectedWords[expectedIndex])

      if (distance < bestDistance) {
        bestDistance = distance
        bestExpected = expectedIndex
      }
    }

    if (bestExpected !== -1) {
      pairs.push([answerIndex, bestExpected])
      expectedStart = bestExpected + 1
    }
  }

  return pairs
}

function markRomajiWord(answer: string, expected?: string): RomajiDisplayPart[] {
  if (!expected) return [{ text: answer, wrong: Boolean(answer.trim()) }]

  const parts = romajiDisplayParts(answer, expected)
  const normalizedAnswer = normalizeRomajiAnswer(answer)
  const normalizedExpected = normalizeRomajiAnswer(expected)
  const missingStart = parts.before.length
  const missingEnd = normalizedExpected.length - parts.after.length
  const missing = !parts.wrong && normalizedAnswer !== normalizedExpected
    ? normalizedExpected.slice(missingStart, missingEnd)
    : ''

  return [
    { text: parts.before, wrong: false },
    { text: parts.wrong, wrong: true },
    { text: missing, wrong: true, missing: true },
    { text: parts.after, wrong: false },
  ].filter((part) => part.text.length > 0)
}

function romajiDisplayPartsByWord(answer: string, expected: string): RomajiDisplayPart[] {
  const display = romajiDisplayValue(answer)
  const tokens = display.split(/(\s+)/)
  const answerWordTokens = tokens
    .map((text, tokenIndex) => ({ text, tokenIndex, word: romajiWord(text) }))
    .filter((token) => token.word.trim())
  const expectedWords = expected
    .split(/\s+/)
    .map(romajiWord)
    .filter(Boolean)
  const answerWords = answerWordTokens.map((token) => token.word)
  const pairs = romajiWordPairs(
    answerWords,
    expectedWords,
  )
  const matchedAnswerIndexes = new Set(pairs.map(([answerIndex]) => answerIndex))
  const markedWords = new Map<number, RomajiDisplayPart[]>()
  let previousAnswer = 0
  let previousExpected = 0

  for (const [answerIndex, expectedIndex] of [...pairs, [answerWordTokens.length, expectedWords.length] as [number, number]]) {
    for (let i = previousAnswer; i < answerIndex; i++) {
      const expectedWord = expectedWords[previousExpected + i - previousAnswer]
      markedWords.set(i, markRomajiWord(answerWordTokens[i].text, expectedWord))
    }

    if (answerIndex < answerWordTokens.length && matchedAnswerIndexes.has(answerIndex)) {
      markedWords.set(answerIndex, markRomajiWord(answerWordTokens[answerIndex].text, expectedWords[expectedIndex]))
    }

    previousAnswer = answerIndex + 1
    previousExpected = expectedIndex + 1
  }

  let wordIndex = 0

  return tokens.flatMap((token) => {
    if (/^\s+$/.test(token) || !romajiWord(token)) return [{ text: token, wrong: false }]

    const parts = markedWords.get(wordIndex) ?? [{ text: token, wrong: Boolean(token.trim()) }]
    wordIndex++
    return parts
  })
}

export function SentenceBuilderView({
  exercise,
  current,
  total,
  onResult,
  onSkip,
  onExit,
}: SentenceBuilderViewProps) {
  const segments = exercise.segments ?? []
  const readings = exercise.segmentReadings
  const tiles = segments.map((word, index) => ({ word, index }))
  const shuffled = useMemo(() => shuffle(tiles), [exercise.id, segments.join('|')])
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<typeof tiles>([])
  const [hideJapanese, setHideJapanese] = useState(false)
  const [showFurigana, setShowFurigana] = useState(true)
  const [showRomajiLegend, setShowRomajiLegend] = useState(true)
  const [answered, setAnswered] = useState(false)
  const viewRef = useRef<HTMLDivElement>(null)
  const entryRef = useRef<HTMLDivElement>(null)
  const checkScrollPositionRef = useRef({ x: 0, y: 0 })

  const isCorrect =
    answered &&
    [
      segments.join(''),
      (readings ?? segments).join(''),
    ].some((answer) => normalizeSentenceAnswer(draft) === normalizeSentenceAnswer(answer))

  const answerGloss = {
    segments,
    readings,
  }
  const pickedIndexes = new Set(picked.map((tile) => tile.index))
  const correctRomaji = (readings ?? segments).map(romajiForSegment).join(' ')
  const showRomajiFeedback = answered && isRomajiAnswer(draft)
  const romajiAnswerParts = romajiDisplayPartsByWord(draft, correctRomaji)
  const shouldReserveHelperFurigana = (tile: (typeof tiles)[number]) =>
    Boolean(readings?.[tile.index]) && !hasKanji(tile.word)

  const handlePick = (tile: (typeof tiles)[number]) => {
    if (answered || pickedIndexes.has(tile.index)) return
    setDraft((prev) => prev + tile.word)
    setPicked((prev) => [...prev, tile])
  }

  const handleHint = () => {
    if (answered) return

    const nextTile = tiles.find((tile) => !pickedIndexes.has(tile.index))
    if (!nextTile) return

    setDraft((prev) => prev + nextTile.word)
    setPicked((prev) => [...prev, nextTile])
  }

  const handleType = (value: string) => {
    setDraft(value)
    setPicked([])
  }

  const handleClear = () => {
    if (answered || draft.length === 0) return
    setDraft('')
    setPicked([])
  }

  const handleCheck = () => {
    if (!draft.trim()) return
    checkScrollPositionRef.current = { x: window.scrollX, y: window.scrollY }
    setAnswered(true)
  }

  const handleAnswerKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return

    event.preventDefault()
    event.stopPropagation()
    handleCheck()
  }

  const handleViewKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return

    event.preventDefault()

    if (answered) {
      onResult(isCorrect)
      return
    }

    handleCheck()
  }

  useLayoutEffect(() => {
    viewRef.current?.focus({ preventScroll: true })

    if (answered) {
      const { x, y } = checkScrollPositionRef.current
      window.scrollTo(x, y)
    }
  }, [answered])

  useEffect(() => {
    if (picked.length > 0 && !answered) {
      entryRef.current?.focus({ preventScroll: true })
    }
  }, [answered, picked.length])

  return (
    <div
      className={`study-view sentence-view ${showFurigana ? '' : 'is-furigana-hidden'}`.trim()}
      onKeyDown={handleViewKeyDown}
      ref={viewRef}
      tabIndex={-1}
    >
      <div className="study-top">
        <button className="btn btn-ghost" onClick={onExit}>← Exit</button>
        <span className="study-progress">{current + 1} / {total}</span>
        <span className="study-type-badge">
          Sentence Builder {exercise.jlpt && <span className="jlpt-badge">{exercise.jlpt}</span>}
        </span>
      </div>

      <div className="study-progress-bar">
        <div className="study-progress-fill" style={{ width: `${((current + 1) / total) * 100}%` }} />
      </div>

      <div className="sentence-card">
        <p className="sentence-prompt">
          <span>Sentence Builder</span>
          <span>/</span>
          <span>文章作り</span>
        </p>
        <p className="sentence-builder-help">Click the words or type the sentence</p>
        {!answered && (
          <>
            <div className="sentence-builder-panel">
              <div className="sentence-builder-inner-outline">
              <div className="sentence-translation-shell">
                <button className="sentence-new-button" onClick={onSkip}>
                  New Sentence
                </button>
                <div className="sentence-translation-prompt" aria-label="Sentence to translate">
                  <p>{exercise.english}</p>
                </div>
              </div>

            <div className={`sentence-word-bank ${hideJapanese ? 'is-blurred' : ''}`}>
              {shuffled.map((tile) => {
                const isUsed = pickedIndexes.has(tile.index)

                return (
                  <button
                    key={tile.index}
                    className={`word-bank-tile ${isUsed ? 'is-used' : ''}`}
                    onClick={() => handlePick(tile)}
                    disabled={isUsed}
                  >
                    <span className="word-bank-text">
                      {shouldReserveHelperFurigana(tile) && (
                        <span className="word-bank-furigana-spacer" aria-hidden="true">
                          {readings?.[tile.index]}
                        </span>
                      )}
                      <FuriganaSegment
                        text={tile.word}
                        reading={readings?.[tile.index]}
                      />
                    </span>
                  </button>
                )
              })}
            </div>

            {picked.length > 0 && (
              <div
                className="sentence-built sentence-built-input sentence-built-entries"
                aria-label="Japanese sentence answer"
                ref={entryRef}
                onKeyDown={handleAnswerKeyDown}
                tabIndex={0}
              >
                {picked.map((tile) => (
                  <FuriganaSegment
                    key={`${tile.word}-${tile.index}`}
                    text={tile.word}
                    reading={readings?.[tile.index]}
                  />
                ))}
              </div>
            )}
            <textarea
              className={`sentence-built sentence-built-input ${picked.length > 0 ? 'sentence-built-hidden-input' : ''}`}
              value={draft}
              onChange={(event) => handleType(event.target.value)}
              onKeyDown={handleAnswerKeyDown}
              placeholder="Build or type the sentence here…"
              aria-label="Japanese sentence answer"
              rows={2}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
              </div>
            <div className="sentence-check-row">
              <button className="btn btn-primary sentence-inline-check" onClick={handleCheck} disabled={!draft.trim()}>
                Check / かくにん / 確認
              </button>
            </div>

            </div>

            <div className="sentence-actions-row sentence-builder-actions">
              <button className="btn btn-secondary" onClick={handleClear} disabled={draft.length === 0}>
                Clear
              </button>
              <button className="btn btn-secondary" onClick={handleHint} disabled={picked.length >= tiles.length}>
                Hint
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setHideJapanese((hidden) => !hidden)}
                aria-pressed={hideJapanese}
              >
                {hideJapanese ? 'Show Words' : 'Hide Words'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowFurigana((shown) => !shown)}
                aria-pressed={showFurigana}
              >
                {showFurigana ? 'Hide Furigana' : 'Show Furigana'}
              </button>
            </div>
          </>
        )}

        {answered && (
          <>
          <div className="sentence-builder-panel">
            <div className="sentence-builder-inner-outline">
              <div className="sentence-translation-shell">
                <button className="sentence-new-button is-placeholder" disabled aria-hidden="true" tabIndex={-1}>
                  New Sentence
                </button>
                <div className="sentence-translation-prompt" aria-label="Sentence to translate">
                  <p>{exercise.english}</p>
                </div>
              </div>

              <div className={`sentence-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
                <AnswerReveal gloss={answerGloss} />
              </div>
              {!showRomajiFeedback && <div className="sentence-answer-layout-spacer" aria-hidden="true" />}
              {showRomajiFeedback && (
                <div className="sentence-romaji-feedback">
                  <p>
                    <span>Correct romaji</span>
                    <b>{correctRomaji}</b>
                  </p>
                  <p>
                    <span>Your answer</span>
                    <b>
                      {romajiAnswerParts.map((part, index) =>
                        part.missing ? (
                          <span className="romaji-missing" key={`${part.text}-${index}`}>
                            {part.text}
                          </span>
                        ) : part.wrong ? (
                          <mark key={`${part.text}-${index}`}>{part.text}</mark>
                        ) : (
                          <span className={part.text.trim() ? 'romaji-match' : undefined} key={`${part.text}-${index}`}>
                            {part.text}
                          </span>
                        ),
                      )}
                    </b>
                  </p>
                  <div className={`sentence-romaji-key-row ${showRomajiLegend ? '' : 'is-collapsed'}`.trim()}>
                    {showRomajiLegend && (
                      <div className="sentence-romaji-key" aria-label="Romaji highlighting key">
                        <span><i className="romaji-key-match" /> Correct</span>
                        <span><i className="romaji-key-wrong" /> Incorrect</span>
                        <span><i className="romaji-key-missing" /> Missing, added</span>
                      </div>
                    )}
                    <button
                      className="sentence-romaji-key-toggle"
                      onClick={() => setShowRomajiLegend((shown) => !shown)}
                      aria-label={showRomajiLegend ? 'Hide legend' : 'Show legend'}
                    >
                      {showRomajiLegend ? '×' : '?'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="sentence-check-row">
              <button className="btn btn-primary sentence-inline-check" onClick={() => onResult(isCorrect)}>
                Continue
              </button>
            </div>
          </div>
          <div className="sentence-actions-row sentence-builder-actions is-placeholder" aria-hidden="true">
            <button className="btn btn-secondary" disabled>
              Clear
            </button>
            <button className="btn btn-secondary" disabled>
              Hint
            </button>
            <button className="btn btn-secondary" disabled>
              Hide Words
            </button>
            <button className="btn btn-secondary" disabled>
              Hide Furigana
            </button>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
