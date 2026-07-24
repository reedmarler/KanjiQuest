import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toHiragana, toRomaji } from 'wanakana'
import { AnswerReveal } from './AnswerReveal'
import { FuriganaSegment, hasKanji } from './FuriganaText'
import { shuffle } from '../lib/quiz'
import type { SentenceExercise } from '../data/sentenceExercises'
import { complexityDetails, GENERATION_COMPLEXITIES, type GenerationComplexity } from '../lib/generationComplexity'

const SPEECH_RATES = [0.9, 0.75, 0.6] as const
const HIDE_WORDS_STORAGE_KEY = 'kanji-quest-sentence-builder-hide-words-v1'
const SHOW_FURIGANA_STORAGE_KEY = 'kanji-quest-sentence-builder-show-furigana-v1'
const SPLIT_PARTICLES_STORAGE_KEY = 'kanji-quest-sentence-builder-split-particles-v1'
const FAST_MODE_STORAGE_KEY = 'kanji-quest-sentence-builder-fast-mode-v1'
const PARTICLE_SUFFIXES = ['から', 'まで', 'は', 'を', 'が', 'に', 'で', 'へ', 'と', 'も', 'の', 'や', 'か'] as const

interface BuilderTile {
  id: string
  word: string
  reading?: string
  meaning?: string
  isParticle: boolean
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

function fitFixedTextBox(element: HTMLElement | null, maximumSize: number, minimumSize: number) {
  if (!element) return

  element.style.fontSize = `${maximumSize}px`

  for (let size = maximumSize; size > minimumSize; size--) {
    if (element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1) {
      return
    }

    element.style.fontSize = `${size - 1}px`
  }
}

function fitContainedText(
  element: HTMLElement | null,
  container: HTMLElement | null,
  maximumSize: number,
  minimumSize: number,
) {
  if (!element || !container) return

  element.style.fontSize = `${maximumSize}px`
  const styles = window.getComputedStyle(container)
  const availableHeight =
    container.clientHeight - Number.parseFloat(styles.paddingTop) - Number.parseFloat(styles.paddingBottom)
  const availableWidth =
    container.clientWidth - Number.parseFloat(styles.paddingLeft) - Number.parseFloat(styles.paddingRight)

  for (let size = maximumSize; size > minimumSize; size--) {
    if (element.scrollHeight <= availableHeight + 1 && element.scrollWidth <= availableWidth + 1) {
      return
    }

    element.style.fontSize = `${size - 1}px`
  }
}

function fitWordBank(bank: HTMLDivElement | null) {
  if (!bank) return

  const tiles = Array.from(bank.querySelectorAll<HTMLElement>('.word-bank-tile'))
  // A second row keeps long sentences compact, so use a slightly smaller
  // starting size while keeping every word easy to read.
  let size = 20

  for (; size >= 11; size--) {
    tiles.forEach((tile) => {
      tile.style.fontSize = `${size}px`
    })

    const fits =
      bank.scrollHeight <= bank.clientHeight + 1 &&
      bank.scrollWidth <= bank.clientWidth + 1 &&
      tiles.every((tile) => tile.scrollHeight <= tile.clientHeight + 1 && tile.scrollWidth <= tile.clientWidth + 1)

    if (fits) return
  }

  tiles.forEach((tile) => {
    tile.style.fontSize = '11px'
  })
}

/** Trailing 。 gives away that a tile ends the sentence, so word-bank tiles never show it. */
function stripTrailingPeriod(text: string): string {
  return text.replace(/。+$/u, '')
}

function particleReading(surface: string, reading: string) {
  const pronunciations: Record<string, string[]> = {
    は: ['は', 'わ'],
    へ: ['へ', 'え'],
    を: ['を', 'お'],
  }

  return (pronunciations[surface] ?? [surface]).find((value) => reading.endsWith(value)) ?? surface
}

function splitParticleTiles(word: string, reading: string | undefined, meaning: string | undefined, index: number): BuilderTile[] {
  const punctuation = word.match(/[。！？!?、,]*$/u)?.[0] ?? ''
  let remainingWord = word.slice(0, word.length - punctuation.length)
  let remainingReading = reading ?? word
  const particles: BuilderTile[] = []

  while (remainingWord.length > 1) {
    const particle = PARTICLE_SUFFIXES.find((candidate) => remainingWord.endsWith(candidate))
    if (!particle || remainingWord.length === particle.length) break

    const suffixReading = particleReading(particle, remainingReading)
    remainingWord = remainingWord.slice(0, -particle.length)
    if (remainingReading.endsWith(suffixReading)) {
      remainingReading = remainingReading.slice(0, -suffixReading.length)
    }

    particles.unshift({
      id: `${index}-particle-${particles.length}`,
      word: particle,
      reading: suffixReading,
      isParticle: true,
    })
  }

  if (!particles.length) {
    return [{ id: `${index}-word`, word, reading, meaning, isParticle: false }]
  }

  const lastParticle = particles.at(-1)!
  lastParticle.word += punctuation
  lastParticle.reading += punctuation

  return [
    { id: `${index}-word`, word: remainingWord, reading: remainingReading, meaning, isParticle: false },
    ...particles,
  ]
}

interface SentenceBuilderViewProps {
  exercise: SentenceExercise
  current: number
  total: number
  onResult: (correct: boolean) => void
  onPrevious: () => void
  onSkip: () => void
  onExit: () => void
  selectedLevels: readonly GenerationComplexity[]
  enabledLevels: readonly GenerationComplexity[]
  onApplyLevels: (levels: readonly GenerationComplexity[]) => void
  infiniteMode: boolean
  onToggleInfiniteMode: () => void
  isFavorite: boolean
  onToggleFavorite: () => void
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
  onPrevious,
  onSkip,
  onExit,
  selectedLevels,
  enabledLevels,
  onApplyLevels,
  infiniteMode,
  onToggleInfiniteMode,
  isFavorite,
  onToggleFavorite,
}: SentenceBuilderViewProps) {
  const segments = exercise.segments ?? []
  const readings = exercise.segmentReadings
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<BuilderTile[]>([])
  const [hideJapanese, setHideJapanese] = useState(() =>
    loadBooleanPreference(HIDE_WORDS_STORAGE_KEY, false),
  )
  const [showFurigana, setShowFurigana] = useState(() =>
    loadBooleanPreference(SHOW_FURIGANA_STORAGE_KEY, true),
  )
  const [splitParticles, setSplitParticles] = useState(() =>
    loadBooleanPreference(SPLIT_PARTICLES_STORAGE_KEY, false),
  )
  const [fastMode, setFastMode] = useState(() =>
    loadBooleanPreference(FAST_MODE_STORAGE_KEY, false),
  )
  const [showRomajiLegend, setShowRomajiLegend] = useState(true)
  const [levelMenuOpen, setLevelMenuOpen] = useState(false)
  const [pendingLevels, setPendingLevels] = useState<GenerationComplexity[]>(() => [...selectedLevels])
  const [answered, setAnswered] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechRate, setSpeechRate] = useState<(typeof SPEECH_RATES)[number]>(0.9)
  const viewRef = useRef<HTMLDivElement>(null)
  const entryRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const englishPromptRef = useRef<HTMLParagraphElement>(null)
  const wordBankRef = useRef<HTMLDivElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const levelPickerRef = useRef<HTMLDivElement>(null)
  const checkScrollPositionRef = useRef({ x: 0, y: 0 })
  const inputBoxCenterRef = useRef<number | null>(null)
  const tiles = segments.flatMap((word, index) => {
    const displayWord = stripTrailingPeriod(word)
    const displayReading = readings?.[index] ? stripTrailingPeriod(readings[index]) : readings?.[index]

    return splitParticles
      ? splitParticleTiles(displayWord, displayReading, exercise.segmentMeanings?.[index], index)
      : [{ id: `${index}-word`, word: displayWord, reading: displayReading, meaning: exercise.segmentMeanings?.[index], isParticle: false }]
  })
  const shuffled = useMemo(() => shuffle(tiles), [exercise.id, splitParticles])

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
  const pickedIndexes = new Set(picked.map((tile) => tile.id))
  const correctRomaji = (readings ?? segments).map(romajiForSegment).join(' ')
  const showRomajiFeedback = answered && isRomajiAnswer(draft)
  const romajiAnswerParts = romajiDisplayPartsByWord(draft, correctRomaji)
  const shouldReserveHelperFurigana = (tile: BuilderTile) =>
    Boolean(tile.reading) && !hasKanji(tile.word)
  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window

  const handleSpeak = () => {
    if (!speechSupported) return

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(segments.join(''))
    const japaneseVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith('ja'))

    utterance.lang = 'ja-JP'
    utterance.rate = speechRate
    if (japaneseVoice) utterance.voice = japaneseVoice
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.cancel()
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const handleCycleSpeechRate = () => {
    const currentIndex = SPEECH_RATES.indexOf(speechRate)
    setSpeechRate(SPEECH_RATES[(currentIndex + 1) % SPEECH_RATES.length])

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

  const handlePick = (tile: BuilderTile) => {
    if (answered || pickedIndexes.has(tile.id)) return
    setDraft((prev) => prev + tile.word)
    setPicked((prev) => [...prev, tile])
  }

  const handleHint = () => {
    if (answered) return

    const nextTile = tiles.find((tile) => !pickedIndexes.has(tile.id))
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

  const handleRemovePicked = (tileId: string) => {
    if (answered) return

    const remaining = picked.filter((tile) => tile.id !== tileId)
    setPicked(remaining)
    setDraft(remaining.map((tile) => tile.word).join(''))
  }

  const handleToggleParticleMode = () => {
    setSplitParticles((enabled) => !enabled)
    if (!answered) {
      setDraft('')
      setPicked([])
    }
  }

  const handleCheck = () => {
    if (!draft.trim()) return
    checkScrollPositionRef.current = { x: window.scrollX, y: window.scrollY }

    const inputBox = picked.length > 0 ? entryRef.current : textareaRef.current
    const inputRect = inputBox?.getBoundingClientRect()
    inputBoxCenterRef.current = inputRect ? (inputRect.top + inputRect.bottom) / 2 : null

    setAnswered(true)
  }

  const handleToggleFastMode = () => {
    setFastMode((enabled) => {
      const next = !enabled
      saveBooleanPreference(FAST_MODE_STORAGE_KEY, next)
      return next
    })
  }

  // Fast mode: once every tile has been placed, check immediately instead of
  // waiting for the learner to also press the Check button.
  useEffect(() => {
    if (!fastMode || answered || tiles.length === 0) return
    if (picked.length !== tiles.length) return

    handleCheck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fastMode, picked.length, tiles.length, answered])

  const handleAnswerKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.target instanceof HTMLButtonElement) return

    event.preventDefault()
    event.stopPropagation()
    handleCheck()
  }

  const handleViewKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.target instanceof HTMLButtonElement) return

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

  useLayoutEffect(() => {
    fitContainedText(
      englishPromptRef.current,
      englishPromptRef.current?.parentElement ?? null,
      19,
      11,
    )
    fitWordBank(wordBankRef.current)

    if (!answered) {
      fitFixedTextBox(picked.length > 0 ? entryRef.current : textareaRef.current, 24, 8)
      return
    }

    const answerText = feedbackRef.current?.querySelector<HTMLElement>('.sentence-answer-gloss') ?? null
    fitContainedText(answerText, feedbackRef.current, 24, 12)

    if (feedbackRef.current) {
      feedbackRef.current.style.position = ''
      feedbackRef.current.style.top = ''

      const targetCenter = inputBoxCenterRef.current
      if (targetCenter !== null && !showRomajiFeedback) {
        const contentEl = answerText ?? feedbackRef.current
        const contentRect = contentEl.getBoundingClientRect()
        const contentCenter = (contentRect.top + contentRect.bottom) / 2

        // getBoundingClientRect returns post-zoom viewport px, but `top` is
        // applied in pre-zoom px. Divide by the ancestor zoom so the visual
        // shift matches the measured delta exactly.
        const gauge = feedbackRef.current.parentElement ?? feedbackRef.current
        const zoom = gauge.getBoundingClientRect().width / gauge.offsetWidth || 1
        const delta = (targetCenter - contentCenter) / zoom

        feedbackRef.current.style.position = 'relative'
        feedbackRef.current.style.top = `${delta}px`
      }
    }
  }, [answered, draft, exercise.id, picked.length, showFurigana, showRomajiFeedback, splitParticles, tiles.length])

  useEffect(() => {
    if (picked.length > 0 && !answered) {
      entryRef.current?.focus({ preventScroll: true })
    }
  }, [answered, picked.length])

  useEffect(() => {
    if (!levelMenuOpen) return
    setPendingLevels([...selectedLevels])

    const closeLevelMenu = (event: PointerEvent) => {
      if (!levelPickerRef.current?.contains(event.target as Node)) {
        setLevelMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeLevelMenu)
    return () => document.removeEventListener('pointerdown', closeLevelMenu)
  }, [levelMenuOpen, selectedLevels])

  function togglePendingLevel(level: GenerationComplexity) {
    if (!enabledLevels.includes(level)) return
    setPendingLevels((current) => {
      const next = current.includes(level)
        ? current.filter((item) => item !== level)
        : GENERATION_COMPLEXITIES.filter((item) => item === level || current.includes(item))
      return next.length ? next : current
    })
  }

  function applyPendingLevels() {
    const next = pendingLevels.filter((level) => enabledLevels.includes(level))
    if (!next.length) return
    setLevelMenuOpen(false)
    onApplyLevels(next)
  }

  useEffect(() => {
    saveBooleanPreference(HIDE_WORDS_STORAGE_KEY, hideJapanese)
  }, [hideJapanese])

  useEffect(() => {
    saveBooleanPreference(SHOW_FURIGANA_STORAGE_KEY, showFurigana)
  }, [showFurigana])

  useEffect(() => {
    saveBooleanPreference(SPLIT_PARTICLES_STORAGE_KEY, splitParticles)
  }, [splitParticles])

  useEffect(() => {
    setIsSpeaking(false)
    if (!speechSupported) return

    window.speechSynthesis.cancel()
    return () => window.speechSynthesis.cancel()
  }, [exercise.id, speechSupported])

  return (
    <div
      className={`study-view sentence-view ${showFurigana ? '' : 'is-furigana-hidden'}`.trim()}
      onKeyDown={handleViewKeyDown}
      ref={viewRef}
      tabIndex={-1}
    >
      <div className="study-top">
        <button className="btn btn-ghost" onClick={onExit}>← Exit</button>
        <span className="study-progress">{infiniteMode ? `${current + 1} / ∞` : `${current + 1} / ${total}`}</span>
        <div className="builder-top-controls">
          <button
            type="button"
            className={`builder-infinite-toggle${infiniteMode ? ' is-active' : ''}`}
            onClick={(event) => { onToggleInfiniteMode(); event.currentTarget.blur() }}
            aria-pressed={infiniteMode}
            aria-label={infiniteMode ? 'Turn off infinite Sentence Builder mode' : 'Keep Sentence Builder going indefinitely'}
            title={infiniteMode ? 'Infinite practice on' : 'Keep practicing without an ending'}
          >
            ∞
          </button>
          <button
            type="button"
            className={`builder-fast-toggle${fastMode ? ' is-active' : ''}`}
            onClick={(event) => { handleToggleFastMode(); event.currentTarget.blur() }}
            aria-pressed={fastMode}
            aria-label={fastMode ? 'Turn off fast mode' : 'Turn on fast mode: checks your sentence the instant every tile is placed'}
            title={fastMode ? 'Fast mode on — the sentence checks itself the moment it is complete' : 'Fast mode: skip the Check button and blitz through sentences'}
          >
            ⚡
          </button>
          <button
            type="button"
            className={`builder-particle-toggle${splitParticles ? ' is-active' : ''}`}
            onClick={(event) => { handleToggleParticleMode(); event.currentTarget.blur() }}
            aria-pressed={splitParticles}
            aria-label={splitParticles ? 'Turn off splitting particles into separate tiles' : 'Split Japanese particles into separate word tiles'}
            title={splitParticles ? 'Particles are split into their own tiles' : 'Split Japanese particles into separate word tiles'}
          >
            を
          </button>
          <div className="builder-level-picker" ref={levelPickerRef}>
          <button
            type="button"
            className="study-type-badge builder-level-trigger"
            aria-expanded={levelMenuOpen}
            aria-haspopup="true"
            onClick={() => setLevelMenuOpen((open) => !open)}
          >
            <span>Sentence Builder</span>
            <span className="jlpt-badge">{selectedLevels.map((level) => complexityDetails[level].shortLabel).join(' + ')}</span>
            <span className="builder-level-chevron" aria-hidden="true" />
          </button>
          {levelMenuOpen && (
            <div className="builder-level-menu" role="group" aria-label="Sentence Builder complexity levels">
              <span className="builder-level-menu-label">Generation complexity</span>
              {GENERATION_COMPLEXITIES.map((level) => {
                const enabled = enabledLevels.includes(level)
                const selected = pendingLevels.includes(level)

                return (
                  <button
                    key={level}
                    type="button"
                    className={`builder-level-option${selected ? ' is-selected' : ''}`}
                    aria-pressed={selected}
                    disabled={!enabled}
                    onClick={() => togglePendingLevel(level)}
                  >
                    <span className="builder-level-check" aria-hidden="true" />
                    <strong>Level {level}</strong>
                    <small>{enabled ? complexityDetails[level].label.split(' · ')[1] : 'Soon'}</small>
                  </button>
                )
              })}
              <button
                type="button"
                className="builder-level-save"
                onClick={applyPendingLevels}
              >
                Save
              </button>
            </div>
          )}
          </div>
        </div>
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
        <div className="sentence-header-actions">
          <button
            type="button"
            className="sentence-back-button"
            onClick={onPrevious}
            disabled={current === 0}
            title={current === 0 ? 'First sentence' : 'Go back to the previous sentence'}
          >
            <svg className="sentence-back-icon" viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="15 5 8 12 15 19" />
            </svg>
          </button>
          <div className="sentence-top-right-actions">
            <button className="sentence-new-button" onClick={onSkip}>
              ↻
            </button>
            <button
              type="button"
              className={`sentence-favorite-button${isFavorite ? ' is-favorite' : ''}`}
              onClick={onToggleFavorite}
              aria-label={isFavorite ? 'Remove sentence from favorites' : 'Add sentence to favorites'}
              aria-pressed={isFavorite}
              title={isFavorite ? 'Remove from favorite sentences' : 'Add to favorite sentences'}
            >
              {isFavorite ? '★' : '☆'}
            </button>
          </div>
        </div>
        <p className="sentence-builder-help">Click the words or type the sentence</p>
        {!answered && (
          <>
            <div className="sentence-builder-panel">
              <div className="sentence-builder-inner-outline">
              <div className="sentence-translation-shell">
                <div className="sentence-translation-prompt" aria-label="Sentence to translate">
                  <p ref={englishPromptRef}>{exercise.english}</p>
                </div>
              </div>

            <div ref={wordBankRef} className={`sentence-word-bank ${hideJapanese ? 'is-blurred' : ''}`}>
              {shuffled.map((tile) => {
                const isUsed = pickedIndexes.has(tile.id)

                return (
                  <button
                    key={tile.id}
                    className={`word-bank-tile${tile.isParticle ? ' is-particle' : ''}${isUsed ? ' is-used' : ''}`}
                    onClick={() => handlePick(tile)}
                    disabled={isUsed}
                  >
                    <span className="word-bank-text">
                      {shouldReserveHelperFurigana(tile) && (
                        <span className="word-bank-furigana-spacer" aria-hidden="true">
                          {tile.reading}
                        </span>
                      )}
                      <FuriganaSegment
                        text={tile.word}
                        reading={tile.reading}
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
                  <button
                    key={tile.id}
                    type="button"
                    className="sentence-built-tile"
                    onClick={() => handleRemovePicked(tile.id)}
                    aria-label={`Return ${tile.word} to the word bank`}
                    title="Return word to bank"
                  >
                    <FuriganaSegment
                      text={tile.word}
                      reading={tile.reading}
                    />
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
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
                <div className="sentence-translation-prompt" aria-label="Sentence to translate">
                  <p ref={englishPromptRef}>{exercise.english}</p>
                </div>
              </div>

              <div ref={feedbackRef} className={`sentence-feedback has-audio ${isCorrect ? 'correct' : 'wrong'}`}>
                <AnswerReveal gloss={answerGloss} />
                {speechSupported && (
                  <div className="sentence-audio-controls">
                    <button
                      type="button"
                      className={`sentence-speak-button${isSpeaking ? ' is-speaking' : ''}`}
                      onClick={handleSpeak}
                      aria-label={isSpeaking ? 'Stop Japanese sentence audio' : 'Play correct Japanese sentence'}
                      aria-pressed={isSpeaking}
                      title={isSpeaking ? 'Stop audio' : 'Listen to the correct Japanese sentence'}
                    >
                      <span aria-hidden="true">{isSpeaking ? '■' : '🔊'}</span>
                      <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
                    </button>
                    <button
                      type="button"
                      className="sentence-speed-button"
                      onClick={handleCycleSpeechRate}
                      aria-label={`Playback speed ${speechRate} times. Click to change speed.`}
                      title="Change playback speed"
                    >
                      {speechRate}×
                    </button>
                  </div>
                )}
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
          <div className="sentence-actions-row sentence-builder-actions">
            <button className="btn btn-secondary" disabled>
              Clear
            </button>
            <button className="btn btn-secondary" disabled>
              Hint
            </button>
            <button className="btn btn-secondary" disabled>
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
      </div>
    </div>
  )
}
