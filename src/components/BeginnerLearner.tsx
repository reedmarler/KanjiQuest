import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { getBeginnerDeck, type BeginnerCharacter, type BeginnerScript } from '../data/beginnerMnemonics'
import { recordAnswer } from '../lib/studyRecord'
import { hiraganaWordBank, katakanaWordBank, type UnderstandingWord } from '../data/beginnerUnderstandingWords'
import { speakJapanese, stopSpeaking } from '../lib/speech'
import { SPEECH_SPEEDS } from '../lib/speechSpeeds'
import { loadNumberMap, MASTERY_STORAGE_PREFIX, MASTERY_TARGET, storageKey } from '../lib/beginnerMastery'
import { BeginnerFinalChallenge } from './BeginnerFinalChallenge'
import { AppBackButton, AppDashboardButton } from './AppBackButton'
import { getStrokeOrderAnimationDuration, StrokeOrderAnimation } from './StrokeOrderAnimation'
import { TraceCanvas } from './TraceCanvas'

/** How many words the writing part of a row quiz shows. */
const QUIZ_TRACE_WORDS = 2

/** How many listen-and-select questions a row quiz asks, before the writing
 *  part. Drawn independently of the trace words below, so the two parts of
 *  the quiz do not have to share one small pool. */
const QUIZ_LISTENING_WORDS = 5
const QUIZ_LISTENING_OPTIONS = 4

/** Single kana still need a slower pace than whole words: with no surrounding
 *  word to give the ear a beat, even a normal learning-speed clip can feel
 *  rushed. Beginner recordings are preferred when available; browser speech
 *  remains the fallback for anything not recorded yet. */
const SINGLE_CHARACTER_SPEECH_RATE = 0.5
const COMPLETION_WRITING_DURATION_SCALE = 0.1625
const ROW_TAB_DRAG_THRESHOLD_PX = 12

/** The app's normal <meta name="theme-color">, matching --bg in App.css —
 *  restored whenever the kana card (below) isn't on screen. */
const DEFAULT_THEME_COLOR = '#0f0e17'
/** Middle stop of the kana card's own light/dark gradients in App.css
 *  (--preview-page-bg), used as a single representative color since Safari's
 *  status-bar/toolbar tint only takes a flat color, not a gradient. */
const ALPHA_PREVIEW_THEME_COLOR_LIGHT = '#fff7fa'
const ALPHA_PREVIEW_THEME_COLOR_DARK = '#1c2036'

const WORD_PICTURE: Record<string, string> = {
  あい: '❤️',
  いえ: '🏠',
  うえ: '⬆️',
  あお: '🔵',
  あう: '🤝',
  おい: '👦',
  かお: '🙂',
  いか: '🦑',
  あか: '🔴',
  かき: '🟠',
  きく: '👂',
  こえ: '🗣️',
  けいこ: '🥋',
  さけ: '🍶',
  あさ: '🌅',
  さかな: '🐟',
  くさ: '🌱',
  すし: '🍣',
  せかい: '🌍',
  そら: '☁️',
  うそ: '🤥',
  たこ: '🐙',
  いち: '1',
  くつ: '👟',
  て: '✋',
  とけい: '🕒',
  なつ: '☀️',
  いぬ: '🐶',
  ねこ: '🐱',
  きのう: '📅',
  はな: '🌸',
  はと: '🕊️',
  ひと: '🧍',
  ふね: '⛵',
  へた: '😅',
  へや: '🚪',
  ほし: '⭐',
  まつ: '🌲',
  みみ: '👂',
  むし: '🐞',
  め: '👁️',
  くも: '☁️',
  もも: '🍑',
  やま: '⛰️',
  ゆき: '❄️',
  よむ: '📖',
  よる: '🌙',
  さくら: '🌸',
  とり: '🐦',
  くるま: '🚗',
  これ: '👉',
  そと: '🏞️',
  わたし: '🧍',
  かわ: '🌊',
  ほん: '📕',
  こころ: '💗',
  ふゆ: '☃️',
  アイ: '👁️',
  エア: '💨',
  ウエア: '👕',
  イカ: '🦑',
  カカオ: '🍫',
  ココア: '☕',
  スシ: '🍣',
  サケ: '🍶',
  スカイ: '☁️',
  タコ: '🐙',
  テスト: '📝',
  トイ: '🧸',
  ナス: '🍆',
  ネコ: '🐱',
  ニコニコ: '😊',
  ハト: '🕊️',
  フネ: '⛵',
  ホシ: '⭐',
  メモ: '📝',
  ママ: '👩',
  ミニ: '🔹',
  ヤマ: '⛰️',
  ユニ: '🎓',
  ヨコ: '↔️',
  リス: '🐿️',
  ラテ: '☕',
  ルス: '🏠',
  ワイン: '🍷',
  カワ: '🌊',
  オン: '🔛',
  かぎ: '🔑',
  えいが: '🎬',
  りんご: '🍎',
  げた: '🩴',
  ごま: '⚫',
  ぐみ: '🍬',
  かぜ: '💨',
  ひざ: '🦵',
  じかん: '🕐',
  みず: '💧',
  ぞう: '🐘',
  ざる: '🧺',
  だれ: '❓',
  うで: '💪',
  まど: '🪟',
  つづく: '➡️',
  はなぢ: '🩸',
  ちぢむ: '↘️',
  ばら: '🌹',
  くび: '👤',
  ぶた: '🐷',
  かべ: '🧱',
  ぼうし: '👒',
  ぱぱ: '👨',
  ぴかぴか: '✨',
  ぷにぷに: '🫧',
  ぺこぺこ: '🍽️',
  ぽかぽか: '♨️',
  ガム: '🍬',
  ギア: '⚙️',
  グミ: '🍬',
  ゲタ: '🩴',
  ゴマ: '⚫',
  ザル: '🧺',
  ジム: '🏋️',
  ズル: '🃏',
  ゼロ: '0',
  ゾウ: '🐘',
  ダム: '🌊',
  ヅラ: '💇',
  デモ: '📣',
  ドア: '🚪',
  ダンス: '💃',
  バス: '🚌',
  ビル: '🏢',
  ブタ: '🐷',
  ベル: '🔔',
  ボタン: '🔘',
  パン: '🍞',
  ピザ: '🍕',
  プロ: '🏅',
  ペン: '🖊️',
  ポスト: '📮',
}

/** Lazily created and reused — a single offscreen canvas is all
 *  measureGlyphCenterOffset below ever needs, and creating a fresh one per
 *  character/resize would be wasteful. */
let glyphMeasureCanvas: HTMLCanvasElement | null = null

/**
 * How far to vertically shift a kana glyph (an inline-text span,
 * line-height: 1) so its actual ink sits centered where the browser laid
 * out its line box, rather than centered within the box's full font
 * metrics — the same mismatch TraceCanvas's guideFit corrects for the
 * printed guide, worked out here via a canvas measurement of the live font
 * instead of a hand-tuned constant. That constant (this card's old
 * margin-top: -1.4rem) was tuned by eye for あ alone and visibly wrong on
 * most other characters, whose ascenders/descenders sit very differently
 * within the font's own em-box.
 *
 * Applied as a transform, not a margin: this card's flex column centers
 * the glyph and the "Tap to listen" label below it as one group
 * (justify-content: center on the column), so a margin large enough to
 * matter here would also drag that label around with it. A transform
 * repositions only the rendered glyph — it does not participate in layout
 * at all, so it cannot disturb the label's position.
 *
 * fontBoundingBox* describes the font's own box (the same for every
 * character at a given size — matches the line-height: 1 box the browser
 * actually lays out); actualBoundingBox* describes this specific glyph's
 * ink within it. The offset needed is the gap between the two boxes'
 * centers.
 */
function measureGlyphCenterOffset(char: string, fontPx: number): number {
  glyphMeasureCanvas ??= document.createElement('canvas')
  const ctx = glyphMeasureCanvas.getContext('2d')
  if (!ctx) return 0
  ctx.font = `400 ${fontPx}px 'Klee One', 'Noto Sans JP', sans-serif`
  const metrics = ctx.measureText(char)
  const fontAscent = metrics.fontBoundingBoxAscent
  const fontDescent = metrics.fontBoundingBoxDescent
  const inkAscent = metrics.actualBoundingBoxAscent
  const inkDescent = metrics.actualBoundingBoxDescent
  if (![fontAscent, fontDescent, inkAscent, inkDescent].every(Number.isFinite)) return 0
  return ((fontDescent - fontAscent) + (inkAscent - inkDescent)) / 2
}

function shuffled<T>(items: readonly T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  }
  return copy
}

/** Words usable once `rows[0..rowIndex]` are learned, preferring ones that
 *  actually exercise a character from the row just finished so the quiz
 *  tests new content rather than only what was already known. Always
 *  returns exactly `count` words: an early row can have fewer than `count`
 *  distinct eligible words, so once the pool is exhausted this tops up by
 *  cycling back through it rather than shortchanging the quiz. */
function pickQuizWords(
  rows: { characters: BeginnerCharacter[] }[],
  rowIndex: number,
  wordBank: readonly UnderstandingWord[],
  count: number,
): UnderstandingWord[] {
  const available = new Set(rows.slice(0, rowIndex + 1).flatMap((r) => r.characters.map((c) => c.char)))
  const newChars = new Set(rows[rowIndex]!.characters.map((c) => c.char))
  const eligible = wordBank.filter((entry) => [...entry.word].every((ch) => available.has(ch)))
  const preferred = eligible.filter((entry) => [...entry.word].some((ch) => newChars.has(ch)))
  const pool = shuffled(preferred.length >= count ? preferred : eligible)
  if (pool.length === 0) return []
  if (pool.length >= count) return pool.slice(0, count)
  return Array.from({ length: count }, (_, index) => pool[index % pool.length]!)
}

function pickListeningOptions(
  rows: { characters: BeginnerCharacter[] }[],
  rowIndex: number,
  wordBank: readonly UnderstandingWord[],
  correct: UnderstandingWord,
  count: number,
): UnderstandingWord[] {
  const available = new Set(rows.slice(0, rowIndex + 1).flatMap((r) => r.characters.map((c) => c.char)))
  const distractors = shuffled(wordBank.filter((entry) => (
    entry.word !== correct.word && [...entry.word].every((ch) => available.has(ch))
  )))
  const fallbackDistractors = shuffled(wordBank.filter((entry) => (
    entry.word !== correct.word && !distractors.some((option) => option.word === entry.word)
  )))
  const options = [correct, ...distractors, ...fallbackDistractors].slice(0, count)
  return shuffled(options)
}

function BeginnerWordExample({
  word,
  script,
  durationScale = 1,
}: {
  word: string
  script: BeginnerScript
  durationScale?: number
}) {
  if (script !== 'kanji') {
    return <StrokeOrderAnimation word={word} size="hero" durationScale={durationScale} />
  }
  return (
    <div className="beginner-static-word-example" lang="ja" aria-label={word}>
      {[...word].map((ch, index) => (
        <span key={`${ch}-${index}`}>{ch}</span>
      ))}
    </div>
  )
}

function meaningOverlay(word: UnderstandingWord) {
  const picture = WORD_PICTURE[word.word]
  return (
    <p className="beginner-quiz-meaning beginner-quiz-meaning--in-write-box">
      {picture && <span className="beginner-quiz-picture" aria-hidden="true">{picture}</span>}
      <span>{word.meaning}</span>
    </p>
  )
}

interface BeginnerLearnerProps {
  script: BeginnerScript
  onBack: () => void
  onDashboard: () => void
  /** Opens straight into this row instead of the first one — used by the
   *  kana charts, which link each character to its row in the learner. */
  initialRowIndex?: number
  /** Which character within that row to open on. The row still plays through
   *  in full afterwards, just starting here and wrapping around — tapping つ
   *  in the た row goes to つ, て, と, た, ち rather than jumping to た. */
  initialCharIndex?: number
  /** Opens the script's kana chart, when one exists (hiragana, katakana) —
   *  a quicker way back than going through the Beginner Zone hub. */
  onOpenChart?: () => void
  /** Opens the matching row quiz from the kana practice card. */
  onOpenQuiz?: () => void
  /** Jumps to the other kana script's practice, when one exists — hiragana
   *  offers カナ, katakana offers かな. Passed the row and in-row character
   *  index currently on screen, so the caller can land the switch on the
   *  same kana (e.g. さ → サ) instead of always reopening at row 0. The
   *  caller is expected to remount this component (e.g. a `key` tied to
   *  script) since mastery and row position are loaded once, at mount, for
   *  whichever script started it. */
  onSwitchScript?: (rowIndex: number, charIndex: number) => void
  /** Starts on the row quiz instead of character practice. */
  startWithQuiz?: boolean
  /** Initial kana preview palette. The in-card toggle can still change it. */
  defaultPreviewDark?: boolean
}

export function BeginnerLearner({ script, onBack, onDashboard, initialRowIndex = 0, initialCharIndex = 0, onOpenChart, onOpenQuiz, onSwitchScript, startWithQuiz = false, defaultPreviewDark = true }: BeginnerLearnerProps) {
  const deck = useMemo(() => getBeginnerDeck(script), [script])
  const startRowIndex = Math.min(Math.max(initialRowIndex, 0), deck.rows.length - 1)
  const [rowIndex, setRowIndex] = useState(startRowIndex)
  const [mastery, setMastery] = useState<Record<string, number>>(() => loadNumberMap(storageKey(MASTERY_STORAGE_PREFIX, script)))
  // Rows the learner has already passed a quiz for, this session — not
  // persisted, so returning later re-quizzes a row, which is fine practice.
  const [quizzedRows, setQuizzedRows] = useState<Record<number, boolean>>({})
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [quizListeningWords, setQuizListeningWords] = useState<UnderstandingWord[] | null>(null)
  const [quizTraceWords, setQuizTraceWords] = useState<UnderstandingWord[]>([])
  const [quizPhase, setQuizPhase] = useState<'listening' | 'trace'>('listening')
  const [listeningIndex, setListeningIndex] = useState(0)
  const [quizTraceIndex, setQuizTraceIndex] = useState(0)
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [listeningOptions, setListeningOptions] = useState<UnderstandingWord[]>([])
  const [listeningChoice, setListeningChoice] = useState<string | null>(null)
  const [completionWritingReplay, setCompletionWritingReplay] = useState(0)

  const row = deck.rows[rowIndex]!
  // cardIndex walks through `cards`; Next/Previous just move the pointer.
  // Opening from a chart tap on a specific character rotates the row to
  // start there instead of at the row's own first character — the rest of
  // the row still follows in its usual order, wrapping back to the start.
  const [cards, setCards] = useState<BeginnerCharacter[]>(() => {
    const characters = deck.rows[startRowIndex]!.characters
    const offset = ((initialCharIndex % characters.length) + characters.length) % characters.length
    return offset === 0 ? characters : [...characters.slice(offset), ...characters.slice(0, offset)]
  })
  const [cardIndex, setCardIndex] = useState(0)
  const card = cards[cardIndex]
  // `cards` may be rotated (see above), so cardIndex alone doesn't say where
  // the current character actually sits in the row — onSwitchScript needs
  // that real position to reopen the other script on the same kana.
  const currentRowCharIndex = card ? Math.max(0, row.characters.findIndex((entry) => entry.char === card.char)) : 0
  /*
   * The lighter, illustrated restyle first tried on just あ, now the look
   * for every hiragana and katakana character's main practice card — kanji
   * keeps the original dark UI (no equivalent design exists for it yet),
   * and so do the row-complete/quiz screens below, which this flag does
   * not touch.
   */
  const isKanaPreview = script === 'hiragana' || script === 'katakana'
  const otherScriptLabel = script === 'hiragana' ? 'カナ' : 'かな'
  const otherScriptName = script === 'hiragana' ? 'Katakana' : 'Hiragana'
  // Trying the Hiragana Chart page's own sakura palette on this card, one
  // character at a time — あ only for now, to evaluate before it spreads to
  // the rest of the row. See the "Sakura preview" block in App.css.
  const isSakuraPreview = script === 'hiragana' && card?.char === 'あ'
  // The badge that would hold a future streak counter doubles, for now, as a
  // dark/light toggle for just this preview card's own palette — it does not
  // touch the rest of the app's (permanently dark) theme.
  const [previewDark, setPreviewDark] = useState(defaultPreviewDark)
  // "Tap to listen" spells out the read card's tap target for a first-timer;
  // once they've actually used it, the hint text is redundant clutter, so it
  // collapses down to just the speaker icon from then on.
  const [hasTappedListen, setHasTappedListen] = useState(false)

  // Mobile Safari tints its status bar and bottom toolbar from the page's
  // <meta name="theme-color">, not from what the page actually paints there
  // — without updating it, those bars stay the app's default dark color (or
  // white) behind this card's pink/purple gradient instead of blending into
  // it. Split into two effects so toggling previewDark just updates the
  // color in place, while leaving the preview (isKanaPreview turning false)
  // is the only thing that restores the app default.
  useEffect(() => {
    if (!isKanaPreview) return
    document.getElementById('theme-color-meta')?.setAttribute('content', previewDark ? ALPHA_PREVIEW_THEME_COLOR_DARK : ALPHA_PREVIEW_THEME_COLOR_LIGHT)
  }, [isKanaPreview, previewDark])

  useEffect(() => {
    if (!isKanaPreview) return
    return () => {
      document.getElementById('theme-color-meta')?.setAttribute('content', DEFAULT_THEME_COLOR)
    }
  }, [isKanaPreview])

  useEffect(() => {
    window.localStorage.setItem(storageKey(MASTERY_STORAGE_PREFIX, script), JSON.stringify(mastery))
  }, [mastery, script])

  // Recenters the read card's glyph on its real ink (measureGlyphCenterOffset
  // above) and shrinks it to fit when it's a two-character yōon combo (きゃ,
  // しゃ, …) — at full size those wrapped onto two lines and blew the whole
  // card's height out. Runs before paint so there's no visible jump, and
  // again on resize since the glyph's font-size is a vw-based clamp() in
  // App.css.
  const glyphRef = useRef<HTMLSpanElement | null>(null)
  const [glyphOffset, setGlyphOffset] = useState(0)
  const [glyphScale, setGlyphScale] = useState(1)
  const rowTabsRef = useRef<HTMLDivElement | null>(null)
  const rowTabDragRef = useRef({
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
    suppressClick: false,
    dragging: false,
  })
  const [rowTabsDragging, setRowTabsDragging] = useState(false)
  useLayoutEffect(() => {
    const el = glyphRef.current
    const parent = el?.parentElement
    if (!isKanaPreview || !el || !parent || !card) return
    const recompute = () => {
      // Reset first so this measures the glyph's own natural size, not a
      // scale left over from the previous character.
      el.style.transform = 'none'
      const fontPx = parseFloat(getComputedStyle(el).fontSize)
      setGlyphOffset(Number.isFinite(fontPx) ? measureGlyphCenterOffset(card.char, fontPx) : 0)
      const parentStyle = getComputedStyle(parent)
      const available = parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight)
      const natural = el.getBoundingClientRect().width
      setGlyphScale(natural > available ? (available / natural) * 0.94 : 1)
    }
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [isKanaPreview, card])

  // The write card's Clear button isn't actually a fixed distance from that
  // card's own edge — it's pinned to the canvas, which is centered and capped
  // at a width (TraceCanvas's stackWidthRem, itself dependent on character
  // count and viewport) that only sometimes equals the card's full width; on
  // any wider screen it drifts inward. Reproducing that math on this side
  // would mean duplicating all of it, so instead this just measures where
  // Clear actually landed and matches it, keeping Tap in that same corner
  // regardless of screen size or how many characters are on screen.
  const writeCardRef = useRef<HTMLDivElement | null>(null)
  const [replayInsetPx, setReplayInsetPx] = useState<number | null>(null)
  useLayoutEffect(() => {
    const write = writeCardRef.current
    const clear = write?.querySelector<HTMLElement>('.trace-canvas-clear')
    if (!isKanaPreview || !card || !write || !clear) return
    const recompute = () => {
      // getBoundingClientRect() reports final, already-zoomed screen pixels,
      // but an inline style="right: Npx" is a pre-zoom length that the
      // .app ancestor's own zoom (1.5 on desktop, see App.css) then scales
      // again on render — without dividing that back out here, the desktop
      // badge would land 1.5x further from the corner than it measured.
      const appEl = write.closest<HTMLElement>('.app')
      const zoom = appEl ? parseFloat(getComputedStyle(appEl).zoom) || 1 : 1
      setReplayInsetPx((write.getBoundingClientRect().right - clear.getBoundingClientRect().right) / zoom)
    }
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [isKanaPreview, card])

  function openRow(index: number) {
    setRowIndex(index)
    setCards(deck.rows[index]!.characters)
    setCardIndex(0)
    setQuizListeningWords(null)
    setCompletionWritingReplay(0)
  }

  function handleRowTabsPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Touch (and pen) scrolls this strip natively — real momentum, correct
    // axis handling, and the scroll-snap-type on the strip itself (App.css)
    // settles it on a tab boundary without any help from here. This drag
    // is only for a mouse, which has no native way to pan a horizontally
    // scrolling strip that isn't showing its own scrollbar to grab.
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    const tabs = rowTabsRef.current
    if (!tabs) return
    rowTabDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: tabs.scrollLeft,
      suppressClick: false,
      dragging: false,
    }
  }

  function handleRowTabsPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const tabs = rowTabsRef.current
    const drag = rowTabDragRef.current
    if (!tabs || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.startX
    if (Math.abs(deltaX) > ROW_TAB_DRAG_THRESHOLD_PX) {
      drag.dragging = true
      drag.suppressClick = true
      setRowTabsDragging(true)
      try {
        tabs.setPointerCapture(event.pointerId)
      } catch {
        // Native scrolling still works without pointer capture.
      }
    }
    if (!drag.dragging) return
    event.preventDefault()
    tabs.scrollLeft = drag.scrollLeft - deltaX
  }

  function settleRowTabs(tabs: HTMLDivElement) {
    const tabStops = Array.from(tabs.querySelectorAll<HTMLButtonElement>('.beginner-row-tab'))
      .map((button) => button.offsetLeft - tabs.offsetLeft)
    if (tabStops.length === 0) return
    const maxScroll = tabs.scrollWidth - tabs.clientWidth
    const nearest = tabStops.reduce((best, stop) => (
      Math.abs(stop - tabs.scrollLeft) < Math.abs(best - tabs.scrollLeft) ? stop : best
    ), tabStops[0]!)
    tabs.scrollTo({
      left: Math.max(0, Math.min(maxScroll, nearest)),
      behavior: 'smooth',
    })
  }

  function handleRowTabsPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const tabs = rowTabsRef.current
    const drag = rowTabDragRef.current
    if (drag.pointerId !== event.pointerId) return
    const wasDragging = drag.dragging
    drag.pointerId = -1
    drag.dragging = false
    setRowTabsDragging(false)
    try {
      tabs?.releasePointerCapture(event.pointerId)
    } catch {
      // Nothing to release if capture was unavailable.
    }
    if (tabs && wasDragging) settleRowTabs(tabs)
  }

  function handleRowTabClick(event: ReactMouseEvent<HTMLButtonElement>, index: number) {
    if (rowTabDragRef.current.suppressClick) {
      event.preventDefault()
      rowTabDragRef.current.suppressClick = false
      return
    }
    if (startWithQuiz) {
      startQuizRow(index)
      return
    }
    openRow(index)
  }

  function startQuiz(index: number) {
    const wordBank = script === 'katakana'
      ? katakanaWordBank
      : script === 'kanji'
        ? deck.rows.flatMap((entry) => entry.characters.map((character) => ({
            word: character.char,
            meaning: character.meaning ?? character.romaji,
          })))
        : hiraganaWordBank
    const listeningWords = pickQuizWords(deck.rows, index, wordBank, QUIZ_LISTENING_WORDS)
    setQuizListeningWords(listeningWords)
    setQuizTraceWords(pickQuizWords(deck.rows, index, wordBank, QUIZ_TRACE_WORDS))
    setListeningOptions(listeningWords[0]
      ? pickListeningOptions(deck.rows, index, wordBank, listeningWords[0], QUIZ_LISTENING_OPTIONS)
      : [])
    setListeningChoice(null)
    setListeningIndex(0)
    setQuizPhase('listening')
    setQuizTraceIndex(0)
    setQuizRevealed(false)
    setCompletionWritingReplay(0)
  }

  function startQuizRow(index: number) {
    const characters = deck.rows[index]!.characters
    setRowIndex(index)
    setCards(characters)
    setCardIndex(characters.length)
    startQuiz(index)
  }

  function advanceQuizTrace() {
    setQuizRevealed(false)
    const next = quizTraceIndex + 1
    if (next >= quizTraceWords.length) finishQuiz()
    else setQuizTraceIndex(next)
  }

  function goPreviousQuizTrace() {
    setQuizRevealed(false)
    setQuizTraceIndex((current) => Math.max(0, current - 1))
  }

  function finishQuiz() {
    setQuizzedRows((current) => ({ ...current, [rowIndex]: true }))
    setCardIndex(deck.rows[rowIndex]!.characters.length)
    setQuizListeningWords(null)
  }

  function goNext() {
    if (!card) return
    setMastery((current) => ({ ...current, [card.char]: MASTERY_TARGET }))
    /*
     * Moving on from a character is the learner saying they have it, and the
     * kana deck's own card ids are `hiragana-あ` — so the same click that
     * retires it from the row can put it into the scheduler, where the rest of
     * the app (and the map's ink) can finally see it.
     */
    if (script === 'hiragana' || script === 'katakana') recordAnswer(`${script}-${card.char}`, 'good')
    if (isKanaPreview && !startWithQuiz && cardIndex + 1 >= cards.length && nextRowIndex !== null) {
      openRow(nextRowIndex)
      return
    }
    setCardIndex((current) => current + 1)
  }

  function goPrevious() {
    setCardIndex((current) => Math.max(0, current - 1))
  }

  const rowComplete = cardIndex >= cards.length
  const nextRowIndex = rowIndex + 1 < deck.rows.length ? rowIndex + 1 : null
  const rowNeedsQuiz = (startWithQuiz || !isKanaPreview) && !quizzedRows[rowIndex]
  const showCompletionQuizPreview = startWithQuiz || !isKanaPreview
  const currentTraceWord = quizTraceWords[quizTraceIndex]
  const listeningWord = quizListeningWords?.[listeningIndex] ?? null
  const deckTitle = `${deck.title}${startWithQuiz ? ' Quiz' : ''}`

  useEffect(() => {
    if (!startWithQuiz) return
    startQuizRow(startRowIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startWithQuiz, startRowIndex, script])

  // Every screen that centres on hearing one word or character plays it the
  // moment it lands, instead of making a beginner hunt for the speaker
  // button first — the button stays, for replays.
  useEffect(() => {
    if (quizListeningWords || rowComplete || !card) return
    speakJapanese(card.char, {
      rate: SINGLE_CHARACTER_SPEECH_RATE,
      forceBrowser: true,
      beginnerRecordingKind: 'kana',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.char, quizListeningWords, rowComplete])

  useEffect(() => {
    if (quizPhase !== 'listening' || !listeningWord) return
    speakJapanese(listeningWord.word, {
      rate: SPEECH_SPEEDS.learning,
      forceBrowser: true,
      beginnerRecordingKind: 'word',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizPhase, listeningWord?.word, listeningIndex])

  useEffect(() => {
    if (quizPhase !== 'trace' || !currentTraceWord) return
    speakJapanese(currentTraceWord.word, {
      rate: SPEECH_SPEEDS.learning,
      forceBrowser: true,
      beginnerRecordingKind: 'word',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizPhase, currentTraceWord?.word, quizTraceIndex])

  // Leaving the learner mid-word should not keep talking.
  useEffect(() => stopSpeaking, [])

  return (
    <div className={`beginner-learner beginner-learner--${script}${isKanaPreview ? ' beginner-learner--preview-a' : ''}${isKanaPreview && previewDark ? ' beginner-learner--preview-a-dark' : ''}${isSakuraPreview ? ' beginner-learner--sakura-a' : ''}`}>
      {isKanaPreview ? (
        <>
          {/* Pinned to the page corner, exactly like every other back
              button in the app (including the Hiragana/Katakana Chart
              page's) — not enveloped into the title box below. */}
          {startWithQuiz ? (
            <div className="app-nav-actions">
              <AppBackButton onClick={onBack} aria-label="Back" />
              <AppDashboardButton onClick={onDashboard} />
            </div>
          ) : (
            <AppBackButton onClick={onBack} aria-label="Back" />
          )}
          {/* Pinned to the opposite corner, at the back button's own height. */}
          <button
            type="button"
            role="switch"
            className="preview-a-theme-toggle"
            onClick={() => setPreviewDark((value) => !value)}
            aria-checked={previewDark}
            aria-label={previewDark ? 'Turn off dark mode for this preview' : 'Turn on dark mode for this preview'}
          >
            {/* --sun/--moon name the animation slot (which one is on top
                when unchecked/checked), not the glyph in it — swapped so
                the moon shows in light mode and the sun in dark mode. */}
            <span className="preview-a-theme-toggle-icon preview-a-theme-toggle-icon--sun" aria-hidden="true">&#127769;</span>
            <span className="preview-a-theme-toggle-icon preview-a-theme-toggle-icon--moon" aria-hidden="true">&#9728;&#65039;</span>
          </button>
          {/* Same title + action-pills setup as the Hiragana/Katakana Chart
              page's own heading (EN, カナ/かな, Quiz) — Chart takes EN's
              spot since there's no romaji toggle here. */}
          <div className="preview-a-top">
            <span className="preview-a-title">{deckTitle}</span>
            <div className="preview-a-actions">
              {onOpenChart && (
                <button type="button" className="preview-a-header-btn" onClick={onOpenChart} aria-label={`Open the ${deck.title} chart`} title={`${deck.title} chart`}>
                  <span aria-hidden="true">▦</span>
                  <em>Chart</em>
                </button>
              )}
              {onSwitchScript && (
                <button
                  type="button"
                  className="preview-a-header-btn"
                  onClick={() => onSwitchScript(rowIndex, currentRowCharIndex)}
                  aria-label={`Switch to ${otherScriptName} practice`}
                  title={`Switch to ${otherScriptName}`}
                >
                  <span aria-hidden="true" lang="ja">{otherScriptLabel}</span>
                </button>
              )}
              {onOpenQuiz && (
                <button type="button" className="preview-a-header-btn" onClick={onOpenQuiz} aria-label={`Open the ${deck.title} quiz`} title={`${deck.title} quiz`}>
                  <em>Quiz</em>
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="beginner-learner-top">
          <div className="app-nav-actions">
            <AppBackButton onClick={onBack} aria-label="Back" />
            <AppDashboardButton onClick={onDashboard} />
          </div>
          <span className="beginner-learner-title">{deck.title}</span>
          <div className="beginner-top-tools">
            {onOpenChart && (
              <button type="button" className="beginner-open-chart" onClick={onOpenChart} aria-label={`Return to the ${deck.title} chart`}>
                {deck.title} Chart
              </button>
            )}
          </div>
        </div>
      )}

      <div
        ref={rowTabsRef}
        className={`beginner-row-tabs${rowTabsDragging ? ' is-dragging' : ''}`}
        role="tablist"
        aria-label={`${deck.title} rows`}
        onPointerDown={handleRowTabsPointerDown}
        onPointerMove={handleRowTabsPointerMove}
        onPointerUp={handleRowTabsPointerEnd}
        onPointerCancel={handleRowTabsPointerEnd}
        onPointerLeave={handleRowTabsPointerEnd}
      >
        {deck.rows.map((entry, index) => {
          const masteredCount = entry.characters.filter((c) => (mastery[c.char] ?? 0) >= MASTERY_TARGET).length
          const done = masteredCount === entry.characters.length
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={index === rowIndex}
              className={`beginner-row-tab${index === rowIndex ? ' is-active' : ''}${done ? ' is-done' : ''}`}
              onClick={(event) => handleRowTabClick(event, index)}
              title={`${entry.label} — ${masteredCount}/${entry.characters.length} learned`}
            >
              <span>{entry.label}</span>
              {/* Swapped for the row's romaji reading on hiragana/katakana's
                  kana card — kanji still shows the learned count
                  underneath, unchanged. */}
              <small>{isKanaPreview ? entry.characters[0]!.romaji : `${masteredCount}/${entry.characters.length}`}</small>
            </button>
          )
        })}
      </div>

      {challengeOpen ? (
        <BeginnerFinalChallenge deck={deck} onExit={() => { setChallengeOpen(false); openRow(0) }} />
      ) : quizListeningWords ? (
        quizPhase === 'listening' && listeningWord ? (
          <main className="beginner-card beginner-listening-check">
            <span className="beginner-listening-check-label">
              {listeningIndex + 1} / {quizListeningWords.length}
            </span>
            <p className="beginner-listening-check-hint">Pick the word you hear.</p>
            <button
              type="button"
              className="beginner-speak-btn beginner-speak-btn--quiz"
              onClick={() => speakJapanese(listeningWord.word, {
                rate: SPEECH_SPEEDS.learning,
                forceBrowser: true,
                beginnerRecordingKind: 'word',
              })}
              aria-label="Play the listening word"
            >
              <span aria-hidden="true">&#128266;</span>
              <em>Listen</em>
            </button>
            <div className="beginner-listening-options" aria-label="Choose the word you heard">
              {listeningOptions.map((option) => {
                const selected = listeningChoice === option.word
                const correct = option.word === listeningWord.word
                // The meaning stays hidden until an answer is made — this is
                // a listening check first, a vocabulary one second — then
                // shows on every option as feedback for what was heard.
                const revealed = listeningChoice !== null
                return (
                  <button
                    key={option.word}
                    type="button"
                    className={`${selected ? ' is-selected' : ''}${selected && correct ? ' is-correct' : ''}${selected && !correct ? ' is-wrong' : ''}`}
                    onClick={() => setListeningChoice(option.word)}
                    aria-pressed={selected}
                  >
                    <span lang="ja" data-kana-count={Math.min([...option.word].length, 4)}>{option.word}</span>
                    {revealed && <small className="beginner-listening-option-meaning">{option.meaning}</small>}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="btn btn-primary beginner-listening-continue"
              disabled={listeningChoice !== listeningWord.word}
              onClick={() => {
                const next = listeningIndex + 1
                if (next < quizListeningWords.length) {
                  setListeningChoice(null)
                  setListeningOptions(pickListeningOptions(
                    deck.rows,
                    rowIndex,
                    script === 'katakana' ? katakanaWordBank : script === 'kanji'
                      ? deck.rows.flatMap((entry) => entry.characters.map((character) => ({
                          word: character.char,
                          meaning: character.meaning ?? character.romaji,
                        })))
                      : hiraganaWordBank,
                    quizListeningWords[next]!,
                    QUIZ_LISTENING_OPTIONS,
                  ))
                  setListeningIndex(next)
                } else {
                  setListeningChoice(null)
                  setQuizPhase('trace')
                }
              }}
            >
              {listeningIndex + 1 < quizListeningWords.length ? 'Next' : 'Writing'} &rarr;
            </button>
          </main>
        ) : quizPhase === 'trace' && currentTraceWord ? (
          <main className="beginner-card beginner-word-writing-card">
            {/* Previous, the speaker, and Check meaning / Next word share one
                row. Hearing the word is the point of this screen, so the
                speaker is the prominent middle element and the two nav
                buttons flanking it are the same size as each other. */}
            <div className="beginner-top-actions beginner-top-actions--tight">
              <button
                type="button"
                className="btn btn-ghost beginner-action-btn beginner-quiz-nav-btn"
                onClick={goPreviousQuizTrace}
                disabled={quizTraceIndex === 0}
              >
                Previous
              </button>
              <div className="beginner-quiz-listen-group">
                <span className="beginner-quiz-replay-note" aria-hidden="true">&#8635; Tap to replay</span>
                <button
                  type="button"
                  className="beginner-speak-btn beginner-speak-btn--quiz"
                  onClick={() => speakJapanese(currentTraceWord.word, {
                    rate: SPEECH_SPEEDS.learning,
                    forceBrowser: true,
                    beginnerRecordingKind: 'word',
                  })}
                  aria-label={`Play the word ${currentTraceWord.word}`}
                >
                  <span aria-hidden="true">&#128266;</span>
                  <em>Listen</em>
                </button>
              </div>
              {quizRevealed ? (
                <button type="button" className="btn btn-primary beginner-action-btn beginner-action-btn-green beginner-quiz-nav-btn" onClick={advanceQuizTrace}>
                  Next word &rarr;
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary beginner-action-btn beginner-action-btn-green beginner-quiz-nav-btn"
                  onClick={() => setQuizRevealed(true)}
                >
                  Check meaning
                </button>
              )}
            </div>

            <div className="beginner-write-stack">
              <div className="beginner-quiz-example">
                <BeginnerWordExample
                  word={currentTraceWord.word}
                  script={script}
                  durationScale={2 / 3}
                />
              </div>
              <div className="beginner-write-section">
                <TraceCanvas
                  key={currentTraceWord.word}
                  char={currentTraceWord.word}
                  compactSingleCharacter={[...currentTraceWord.word].length === 1}
                  stackWidthRem={[...currentTraceWord.word].length === 1 ? 16 : Math.min([...currentTraceWord.word].length * 11, 32)}
                  overlay={quizRevealed ? meaningOverlay(currentTraceWord) : null}
                />
              </div>
            </div>
          </main>
        ) : null
      ) : rowComplete ? (
        <main className="beginner-card beginner-card-complete">
          <div
            key={`completion-writing-${completionWritingReplay}`}
            className={`beginner-complete-chars${completionWritingReplay > 0 ? ' is-writing' : ''}`}
            lang="ja"
          >
            {row.characters.map((entry, index) => (
              <button
                key={entry.char}
                type="button"
                onClick={() => speakJapanese(entry.char, {
                  rate: SINGLE_CHARACTER_SPEECH_RATE,
                  forceBrowser: true,
                  beginnerRecordingKind: 'kana',
                })}
                aria-label={`Hear ${entry.char}`}
              >
                {completionWritingReplay > 0 && script !== 'kanji' ? (
                  <StrokeOrderAnimation
                    word={entry.char}
                    durationScale={COMPLETION_WRITING_DURATION_SCALE}
                    startDelayMs={row.characters.slice(0, index).reduce(
                      (delay, previous) => delay
                        + getStrokeOrderAnimationDuration(previous.char, COMPLETION_WRITING_DURATION_SCALE)
                        + 180,
                      0,
                    )}
                    interactive={false}
                  />
                ) : (
                  <span style={{ animationDelay: `${index * 120}ms` }}>{entry.char}</span>
                )}
              </button>
            ))}
          </div>
          {showCompletionQuizPreview && (
            <div className="beginner-complete-quiz-preview">
              <span className="beginner-complete-quiz-kicker">{rowNeedsQuiz ? 'Next quiz' : 'Review row'}</span>
              <div className="beginner-complete-quiz-cue" aria-label="Listening and writing">
                <button
                  type="button"
                  className="beginner-complete-quiz-step"
                  onClick={() => speakJapanese(row.characters.map((entry) => entry.char).join('、'), {
                    rate: SINGLE_CHARACTER_SPEECH_RATE,
                    forceBrowser: true,
                    beginnerRecordingKind: 'row',
                  })}
                  aria-label="Hear all characters"
                >
                  <span className="beginner-complete-quiz-icon" aria-hidden="true">&#128266;</span>
                  <span>Listening</span>
                </button>
                <span className="beginner-complete-quiz-plus" aria-hidden="true">+</span>
                <button
                  type="button"
                  className="beginner-complete-quiz-step"
                  onClick={() => setCompletionWritingReplay((current) => current + 1)}
                  aria-label="Replay writing all characters"
                >
                  <span className="beginner-complete-quiz-icon beginner-complete-write-icon" aria-hidden="true">&#9998;</span>
                  <span>Writing</span>
                </button>
              </div>
            </div>
          )}
          <div className="beginner-complete-actions">
            <button type="button" className="btn btn-ghost" onClick={() => openRow(rowIndex)}>&larr; Practice again</button>
            {rowNeedsQuiz ? (
              <button type="button" className="btn btn-primary" onClick={() => startQuiz(rowIndex)}>Start listening + writing &rarr;</button>
            ) : nextRowIndex === null ? (
              <button type="button" className="btn btn-primary" onClick={() => setChallengeOpen(true)}>Final challenge &rarr;</button>
            ) : startWithQuiz ? (
              <button type="button" className="btn btn-primary" onClick={() => startQuizRow(nextRowIndex)}>
                Next quiz: {deck.rows[nextRowIndex]!.label} &rarr;
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => openRow(nextRowIndex)}>
                Next: {deck.rows[nextRowIndex]!.label} &rarr;
              </button>
            )}
          </div>
        </main>
      ) : card ? (
        isKanaPreview ? (
          <main className="beginner-card preview-a-card">
            <button
              type="button"
              className="preview-a-read"
              onClick={() => {
                setHasTappedListen(true)
                speakJapanese(card.char, {
                  rate: SINGLE_CHARACTER_SPEECH_RATE,
                  forceBrowser: true,
                  beginnerRecordingKind: 'kana',
                })
              }}
              aria-label={`Play the sound for ${card.char}`}
            >
              <span ref={glyphRef} className="preview-a-glyph" lang="ja" style={{ transform: `translateY(${glyphOffset * glyphScale}px) scale(${glyphScale})` }}>{card.char}</span>
              <span
                className={`preview-a-replay${hasTappedListen ? ' preview-a-replay--icon-only' : ''}`}
                style={replayInsetPx != null ? { right: `${replayInsetPx}px` } : undefined}
              >
                {!hasTappedListen && <span className="preview-a-replay-label">Tap</span>}
                <span className="preview-a-replay-icon" aria-hidden="true">&#128266;</span>
              </span>
            </button>

            <div className="preview-a-write" ref={writeCardRef}>
              {/* 18rem caps the canvas comfortably below this card's own
                  width on anything wider than a phone — without it, the
                  square would grow with the card's full width, and on a
                  tablet or desktop that means a canvas taller than the
                  screen. Below that width it just fills the card, same as
                  TraceCanvas's own presets (13rem compact / 21rem standard),
                  both narrower than this card would otherwise allow. The
                  gap this cap leaves on a wide screen is exactly why Tap
                  (above, on the read card) measures rather than assumes
                  where Clear ends up. Only for a single character, though: a
                  yōon row's card.char is two (きゃ), which on a phone stacks
                  vertically into two cells (TraceCanvas's own layout for any
                  multi-character word) — forcing that stack to also fill
                  the card's full width multiplies its height by the same
                  amount, producing a box several screens tall. Left at
                  TraceCanvas's own default there, which already handles
                  multi-character words sensibly (it's the same component
                  every other flashcard in the app uses for them).
                  guideFontRatio requests a guide bigger than the app-wide
                  default (0.82); guideFit measures the actual rendered ink
                  on whatever engine loads this page and centers + shrinks
                  to fit from that, rather than trusting a fixed offset
                  tuned against one browser and one character — a hand-tuned
                  guess here was clipping あ specifically on real phones
                  despite looking fine in every desktop check, before this
                  card applied to any other character. guideFitMargin pushes
                  how much of the box that fit is allowed to fill. */}
              <TraceCanvas
                key={card.char}
                char={card.char}
                stackWidthRem={[...card.char].length === 1 ? 18 : undefined}
                guideFontRatio={0.784}
                guideFit
                guideFitMargin={0.995}
              />
            </div>

            <div className="preview-a-nav">
              <button type="button" className="preview-a-nav-btn preview-a-nav-btn--prev" onClick={goPrevious} disabled={cardIndex === 0}>
                Previous
              </button>
              <button type="button" className="preview-a-nav-btn preview-a-nav-btn--next" onClick={goNext}>
                Next
              </button>
            </div>
          </main>
        ) : (
          <main className="beginner-card is-revealed">
            {/* Previous, a prominent speaker button, and Next sit above the
                writing area. Hearing the character is the point of this
                button, so it's bigger and louder than the nav buttons either
                side of it — Check moved into the tracing panel itself
                (compactCheck below) so this row stays about pronunciation,
                not scoring. */}
            <div className="beginner-top-actions">
              <button type="button" className="btn btn-ghost beginner-action-btn" onClick={goPrevious} disabled={cardIndex === 0}>Previous</button>
              <button
                type="button"
                className="beginner-speak-btn"
                // Slower than the app's usual "learning" pace — a single
                // character has no surrounding word to give the ear a beat to
                // catch it in, so the standard slowdown still reads as rushed
                // here even though it's plenty for whole words elsewhere.
                onClick={() => speakJapanese(card.char, {
                  rate: SINGLE_CHARACTER_SPEECH_RATE,
                  forceBrowser: true,
                  beginnerRecordingKind: 'kana',
                })}
                aria-label={`Play the sound for ${card.char}`}
              >
                &#128266;
              </button>
              <button type="button" className="btn btn-primary beginner-action-btn beginner-action-btn-green" onClick={goNext}>Next</button>
            </div>

            {/* Writing lives right under the character itself — trace it while
                it's fresh on screen, rather than as a separate mode to switch
                into. Keyed on the character so a fresh canvas loads per card.
                On desktop the example and the tracing box sit side by side,
                with tracing given most of the width since it's what you use. */}
            <div className="beginner-write-layout">
              <div className="beginner-char-listen">
                <BeginnerWordExample word={card.char} script={script} durationScale={2 / 3} />
              </div>
              <div className="beginner-write-section">
                <TraceCanvas key={card.char} char={card.char} />
              </div>
            </div>

            {card.meaning && (
              <div className="beginner-answer">
                <span className="beginner-meaning">{card.meaning}</span>
              </div>
            )}
          </main>
        )
      ) : null}
    </div>
  )
}
