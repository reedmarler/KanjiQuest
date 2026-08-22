import { useEffect, useMemo, useState } from 'react'
import { getBeginnerDeck, type BeginnerCharacter, type BeginnerScript } from '../data/beginnerMnemonics'
import { hiraganaWordBank, katakanaWordBank, type UnderstandingWord } from '../data/beginnerUnderstandingWords'
import { speakJapanese } from '../lib/speech'
import { SPEECH_SPEEDS } from '../lib/speechSpeeds'
import { BeginnerFinalChallenge } from './BeginnerFinalChallenge'
import { AppBackButton } from './AppBackButton'
import { getStrokeOrderAnimationDuration, StrokeOrderAnimation } from './StrokeOrderAnimation'
import { TraceCanvas } from './TraceCanvas'

/** How many words the writing part of a row quiz shows between its two
 *  listen-and-select questions. */
const QUIZ_TRACE_WORDS = 2

/** Every listen button in this view forces the browser's own voice rather
 *  than the app's usual ElevenLabs clips — the hosted voice, tuned for
 *  fluent sentences, handled bare hiragana and hiragana-only words badly
 *  (clipped, then mispronounced, then just wrong) no matter how the
 *  request was tuned. A single character also gets no surrounding word to
 *  give the ear a beat to catch it in, so it needs to be slower than the
 *  pace a whole word reads fine at. */
const SINGLE_CHARACTER_SPEECH_RATE = 0.5
const COMPLETION_WRITING_DURATION_SCALE = 0.1625

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
 *  tests new content rather than only what was already known. */
function pickQuizWords(rows: { characters: BeginnerCharacter[] }[], rowIndex: number, wordBank: readonly UnderstandingWord[]): UnderstandingWord[] {
  const available = new Set(rows.slice(0, rowIndex + 1).flatMap((r) => r.characters.map((c) => c.char)))
  const newChars = new Set(rows[rowIndex]!.characters.map((c) => c.char))
  const eligible = wordBank.filter((entry) => [...entry.word].every((ch) => available.has(ch)))
  const preferred = eligible.filter((entry) => [...entry.word].some((ch) => newChars.has(ch)))
  const pool = preferred.length >= QUIZ_TRACE_WORDS + 1 ? preferred : eligible
  return shuffled(pool).slice(0, QUIZ_TRACE_WORDS + 1)
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
}

/**
 * Mastery is per character and survives reloads, because a beginner working
 * through 46 characters will not do it in one sitting. Keyed by script so the
 * three decks never overwrite each other.
 */
const MASTERY_STORAGE_PREFIX = 'kq-beginner-mastery-'

/** How many correct recalls in a row retire a character from the row. */
const MASTERY_TARGET = 2

function storageKey(prefix: string, script: BeginnerScript) {
  return `${prefix}${script}`
}

function loadNumberMap(key: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    // Written by us, but a hand-edited or half-written value should degrade to
    // "not learned yet" rather than crashing the deck on open.
    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

export function BeginnerLearner({ script, onBack }: BeginnerLearnerProps) {
  const deck = useMemo(() => getBeginnerDeck(script), [script])
  const [rowIndex, setRowIndex] = useState(0)
  const [mastery, setMastery] = useState<Record<string, number>>(() => loadNumberMap(storageKey(MASTERY_STORAGE_PREFIX, script)))
  // Rows the learner has already passed a quiz for, this session — not
  // persisted, so returning later re-quizzes a row, which is fine practice.
  const [quizzedRows, setQuizzedRows] = useState<Record<number, boolean>>({})
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [quizWords, setQuizWords] = useState<UnderstandingWord[] | null>(null)
  const [quizPhase, setQuizPhase] = useState<'listening' | 'trace'>('listening')
  const [listeningQuestionIndex, setListeningQuestionIndex] = useState(0)
  const [quizTraceIndex, setQuizTraceIndex] = useState(0)
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [listeningOptions, setListeningOptions] = useState<UnderstandingWord[]>([])
  const [listeningChoice, setListeningChoice] = useState<string | null>(null)
  const [completionWritingReplay, setCompletionWritingReplay] = useState(0)

  const row = deck.rows[rowIndex]!
  // The row's characters, shuffled once per row so the learner does not
  // simply memorise the chart order instead of the characters. cardIndex
  // walks through it; Next/Previous just move the pointer.
  const [cards, setCards] = useState<BeginnerCharacter[]>(() => deck.rows[0]!.characters)
  const [cardIndex, setCardIndex] = useState(0)
  const card = cards[cardIndex]

  useEffect(() => {
    window.localStorage.setItem(storageKey(MASTERY_STORAGE_PREFIX, script), JSON.stringify(mastery))
  }, [mastery, script])

  function openRow(index: number) {
    setRowIndex(index)
    setCards(deck.rows[index]!.characters)
    setCardIndex(0)
    setQuizWords(null)
    setCompletionWritingReplay(0)
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
    const pickedWords = pickQuizWords(deck.rows, index, wordBank)
    setQuizWords(pickedWords)
    setListeningOptions(shuffled(pickedWords))
    setListeningChoice(null)
    setListeningQuestionIndex(0)
    setQuizPhase('listening')
    setQuizTraceIndex(0)
    setQuizRevealed(false)
    setCompletionWritingReplay(0)
  }

  function advanceQuizTrace() {
    setQuizRevealed(false)
    const next = quizTraceIndex + 1
    if (next >= (quizWords?.length ?? 1) - 1) finishQuiz()
    else setQuizTraceIndex(next)
  }

  function goPreviousQuizTrace() {
    setQuizRevealed(false)
    setQuizTraceIndex((current) => Math.max(0, current - 1))
  }

  function finishQuiz() {
    setQuizzedRows((current) => ({ ...current, [rowIndex]: true }))
    setQuizWords(null)
  }

  function resetProgress() {
    if (!window.confirm(`Reset all ${deck.title} progress?`)) return
    window.localStorage.removeItem(storageKey(MASTERY_STORAGE_PREFIX, script))
    setMastery({})
    setQuizzedRows({})
    setChallengeOpen(false)
    openRow(0)
  }

  function goNext() {
    if (!card) return
    setMastery((current) => ({ ...current, [card.char]: MASTERY_TARGET }))
    setCardIndex((current) => current + 1)
  }

  function goPrevious() {
    setCardIndex((current) => Math.max(0, current - 1))
  }

  const rowComplete = cardIndex >= cards.length
  const nextRowIndex = rowIndex + 1 < deck.rows.length ? rowIndex + 1 : null
  const rowNeedsQuiz = !quizzedRows[rowIndex]
  const traceWords = quizWords?.slice(0, -1) ?? []
  const currentTraceWord = traceWords[quizTraceIndex]
  const listeningWord = listeningQuestionIndex === 1
    ? quizWords?.[quizWords.length - 1] ?? null
    : quizWords?.[0] ?? null

  return (
    <div className={`beginner-learner beginner-learner--${script}`}>
      <div className="beginner-learner-top">
        <AppBackButton onClick={onBack} aria-label="Back to Beginner Zone" />
        <span className="beginner-learner-title">{deck.title}</span>
        <div className="beginner-top-tools">
          <button type="button" className="beginner-reset-progress" onClick={resetProgress} aria-label={`Reset ${deck.title} progress`}>
            Progress reset
          </button>
        </div>
      </div>

      <div className="beginner-row-tabs" role="tablist" aria-label={`${deck.title} rows`}>
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
              onClick={() => openRow(index)}
              title={`${entry.label} — ${masteredCount}/${entry.characters.length} learned`}
            >
              <span>{entry.label}</span>
              <small>{masteredCount}/{entry.characters.length}</small>
            </button>
          )
        })}
      </div>

      {challengeOpen ? (
        <BeginnerFinalChallenge deck={deck} onExit={() => { setChallengeOpen(false); openRow(0) }} />
      ) : quizWords ? (
        quizPhase === 'listening' && listeningWord ? (
          <main className="beginner-card beginner-listening-check">
            <span className="beginner-listening-check-label">Listening word</span>
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
                return (
                  <button
                    key={option.word}
                    type="button"
                    className={`${selected ? ' is-selected' : ''}${selected && correct ? ' is-correct' : ''}${selected && !correct ? ' is-wrong' : ''}`}
                    onClick={() => setListeningChoice(option.word)}
                    aria-pressed={selected}
                  >
                    <span lang="ja" data-kana-count={Math.min([...option.word].length, 4)}>{option.word}</span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="btn btn-primary beginner-listening-continue"
              disabled={listeningChoice !== listeningWord.word}
              onClick={() => {
                if (listeningQuestionIndex === 0) {
                  setListeningChoice(null)
                  setListeningOptions(shuffled(quizWords))
                  setListeningQuestionIndex(1)
                } else {
                  setListeningChoice(null)
                  setQuizPhase('trace')
                }
              }}
            >
              {listeningQuestionIndex === 0 ? 'Next listening word' : 'Continue to writing'} &rarr;
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
          <div className="beginner-complete-actions">
            <button type="button" className="btn btn-ghost" onClick={() => openRow(rowIndex)}>&larr; Practice again</button>
            {rowNeedsQuiz ? (
              <button type="button" className="btn btn-primary" onClick={() => startQuiz(rowIndex)}>Start listening + writing &rarr;</button>
            ) : nextRowIndex === null ? (
              <button type="button" className="btn btn-primary" onClick={() => setChallengeOpen(true)}>Final challenge &rarr;</button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => openRow(nextRowIndex)}>
                Next: {deck.rows[nextRowIndex]!.label} &rarr;
              </button>
            )}
          </div>
        </main>
      ) : card ? (
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
      ) : null}
    </div>
  )
}
