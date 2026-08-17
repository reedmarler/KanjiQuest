import { useEffect, useMemo, useState } from 'react'
import { vocabFocusSets, type VocabFocusSet } from '../data/vocabFocusSets'
import { getVocabExampleSentence } from '../lib/vocabExampleSentence'
import { FuriganaSegment } from './FuriganaText'
import { SpeakableCue, SpeakableWord, useSpeakable } from './SpeakableWord'
import { spokenTextForCard, spokenTextForWord } from '../lib/spokenText'

interface FocusedVocabPracticeProps {
  onBack: () => void
  onDashboard?: () => void
  initialTopicId?: string
  onQuestComplete?: () => void
  questTitle?: string
}

/** Matches the app's other mobile breakpoints (e.g. Kanji Lab's phone layout). */
function useIsMobile(maxWidth = 720) {
  const query = `(max-width: ${maxWidth}px)`
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setIsMobile(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return isMobile
}

function shuffled<T>(items: readonly T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  }
  return copy
}

function VocabBackButton({ onBack, questMode, hasPrevious }: { onBack: () => void; questMode: boolean; hasPrevious: boolean }) {
  const destination = questMode ? 'Quest' : 'Dashboard'
  const label = hasPrevious ? 'Previous word' : `Back to ${destination}`
  return (
    <button type="button" className="vocab-back-arrow" onClick={onBack} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
  )
}

function newSession(previousTopicId?: string, initialTopicId?: string) {
  const requestedTopic = initialTopicId ? vocabFocusSets.find((topic) => topic.id === initialTopicId) : undefined
  if (requestedTopic) return { topic: requestedTopic, cards: shuffled(requestedTopic.cards) }
  const topics = shuffled(vocabFocusSets)
  if (previousTopicId && topics[0]?.id === previousTopicId && topics.length > 1) {
    ;[topics[0], topics[1]] = [topics[1]!, topics[0]!]
  }
  const topic = topics[0]!
  return { topic, cards: shuffled(topic.cards) }
}

export function FocusedVocabPractice({ onBack, onDashboard, initialTopicId, onQuestComplete, questTitle }: FocusedVocabPracticeProps) {
  const isMobile = useIsMobile()
  const [session, setSession] = useState(() => newSession(undefined, initialTopicId))
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [known, setKnown] = useState(0)
  const [completed, setCompleted] = useState(false)
  const card = session.cards[index]
  const example = useMemo(() => (card ? getVocabExampleSentence(card) : undefined), [card])
  const exampleSpeech = useSpeakable(
    example ? spokenTextForWord(example.japanese, example.reading) : '',
    !revealed,
  )

  function nextCard(knew = false) {
    if (knew) setKnown((count) => count + 1)
    if (index + 1 >= session.cards.length) {
      setCompleted(true)
      return
    }
    setIndex((current) => current + 1)
    setRevealed(false)
  }

  function previousCard() {
    if (completed) {
      setCompleted(false)
      setRevealed(false)
      return
    }
    if (index > 0) {
      setIndex((current) => current - 1)
      setRevealed(false)
      return
    }
    onBack()
  }

  function loadNextTopic() {
    setSession(newSession(session.topic.id))
    setIndex(0)
    setRevealed(false)
    setKnown(0)
    setCompleted(false)
  }

  function replayTopic() {
    setSession((current) => ({ ...current, cards: shuffled(current.cards) }))
    setIndex(0)
    setRevealed(false)
    setKnown(0)
    setCompleted(false)
  }

  // Kanji Lab's phone layout: reuse its prompt and control structure so Vocab
  // and Kanji behave like two decks in the same study system.
  if (isMobile) {
    return (
      <div className="grammar-practice-view kanji-lab kanji-lab-paths standard-kanji-study focused-vocab-practice-mobile">
        <div className="study-top grammar-study-top">
          <VocabBackButton onBack={previousCard} questMode={Boolean(questTitle)} hasPrevious={completed || index > 0} />
          {onDashboard && <button type="button" className="btn btn-ghost" onClick={onDashboard}>Dashboard</button>}
          <span className="study-progress">{Math.min(index + 1, session.cards.length)} / {session.cards.length}</span>
          <span className="study-type-badge">
            <span>Vocab</span>
            <span className="jlpt-badge">Path</span>
          </span>
        </div>
        <div className="study-progress-bar">
          <div className="study-progress-fill" style={{ width: `${((index + 1) / session.cards.length) * 100}%` }} />
        </div>

        <section className="kanji-study-navigation kanji-armory-navigation standard-kanji-navigation">
          <div className="kanji-path-heading">
            <div>
              <span>{questTitle ? 'QUEST VOCABULARY' : '15-WORD PATH'}</span>
              <h2>{questTitle ?? session.topic.title}</h2>
              <p>{questTitle ? `${session.topic.cards.length} words for this quest’s story.` : session.topic.description}</p>
            </div>
            {!questTitle && <button type="button" onClick={loadNextTopic}>New topic</button>}
          </div>
        </section>

        {completed ? (
          <main className="grammar-choice-card kanji-learning-card focused-vocab-complete">
            <span className="focused-vocab-complete-mark">語</span>
            <h2>Set complete</h2>
            <p>You got through all 15 words in {session.topic.title}. {known} felt easy.</p>
            <button type="button" className="btn btn-primary" onClick={onQuestComplete ?? loadNextTopic}>
              {onQuestComplete ? 'Read the kanji →' : 'New topic →'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={replayTopic}>Replay this set</button>
          </main>
        ) : card ? (
          <main className={`grammar-choice-card kanji-learning-card standard-kanji-card main-word-length-${Math.min([...card.front].length, 4)}${revealed ? ' is-revealed' : ''}`}>
            <div className="kanji-learning-meta">
              <span>{known} easy this set</span>
            </div>
            <div className="standard-kanji-prompt focused-vocab-standard-prompt">
              <p className="kanji-learning-character standard-kanji-compound-word" lang="ja">
                <SpeakableWord text={spokenTextForCard(card)}>{card.front}</SpeakableWord>
              </p>
              <p className={'kanji-learning-character-reading focused-vocab-standard-reading' + (revealed ? ' is-revealed' : '')} lang="ja" aria-hidden={!revealed}>
                <span>{card.reading}</span>
              </p>
              <div className="kanji-learning-divider" aria-hidden="true" />
              <div className={`quest-kanji-word-answer standard-kanji-main-meaning${revealed ? ' is-revealed' : ''}`} aria-hidden={!revealed}>
                <span>{card.back}</span>
              </div>
            </div>

            <div className="kanji-learning-answer standard-kanji-answer focused-vocab-standard-answer">
              {example && (
                <div
                  className={`focused-vocab-example${revealed ? ' is-revealed' : ''}${exampleSpeech.live ? ' is-speakable' : ''}${exampleSpeech.isSpeaking ? ' is-speaking' : ''}`}
                  aria-hidden={!revealed}
                  {...exampleSpeech.triggerProps}
                >
                  <span className="focused-vocab-example-en">{example.english}</span>
                  <div className="focused-vocab-example-jp-wrap">
                    <span className="focused-vocab-example-jp" lang="ja">
                      {example.segments.map((segment, index) => (
                        <FuriganaSegment key={index} text={segment.text} reading={segment.reading} />
                      ))}
                    </span>
                  </div>
                  {exampleSpeech.live && <SpeakableCue className="speakable-cue-corner" />}
                </div>
              )}
            </div>

            <div className="kanji-learning-controls standard-kanji-controls">
              <div className="standard-kanji-utility-row focused-vocab-standard-utility-row">
                <button
                  type="button"
                  className="btn btn-primary kanji-learning-reveal"
                  onClick={() => setRevealed((current) => !current)}
                >
                  {revealed ? 'Hide answer' : 'Reveal answer'}
                </button>
              </div>
              <div className="standard-kanji-action-row">
                <button type="button" className="btn btn-ghost standard-kanji-review" onClick={() => nextCard(false)}>Study again</button>
                <button type="button" className="btn kanji-learning-easy" onClick={() => nextCard(true)}>Too Easy</button>
              </div>
            </div>
          </main>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grammar-practice-view focused-vocab-practice">
      <header className="focused-vocab-top">
        <VocabBackButton onBack={previousCard} questMode={Boolean(questTitle)} hasPrevious={completed || index > 0} />
        <span>{questTitle ?? 'Focused vocab'}</span>
        {onDashboard && <button type="button" className="btn btn-ghost" onClick={onDashboard}>Dashboard</button>}
        {!questTitle && <button type="button" className="focused-vocab-change-topic" onClick={loadNextTopic}>New topic</button>}
      </header>

      <section className="focused-vocab-topic" aria-labelledby="focused-vocab-topic-title">
        <span>{questTitle ? 'QUEST VOCABULARY' : '15-WORD PATH'}</span>
        <h1 id="focused-vocab-topic-title">{questTitle ?? session.topic.title}</h1>
        <p>{questTitle ? `${session.topic.cards.length} words for this quest’s story.` : session.topic.description}</p>
      </section>

      {completed ? (
        <section className="focused-vocab-complete">
          <span className="focused-vocab-complete-mark">語</span>
          <h2>Set complete</h2>
          <p>You got through all 15 words in {session.topic.title}. {known} felt easy.</p>
          <button type="button" className="btn btn-primary" onClick={onQuestComplete ?? loadNextTopic}>
            {onQuestComplete ? 'Read the kanji →' : 'New topic →'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={replayTopic}>Replay this set</button>
        </section>
      ) : card ? (
        <>
          <div className="focused-vocab-progress" aria-label={`Word ${index + 1} of ${session.cards.length}`}>
            <span style={{ width: `${((index + 1) / session.cards.length) * 100}%` }} />
          </div>
          <main className={`focused-vocab-card${revealed ? ' is-revealed' : ''}`}>
            <div className="focused-vocab-card-meta">
              <span>{index + 1} / {session.cards.length}</span>
              <span>{known} easy this set</span>
            </div>
            <p className="focused-vocab-word" lang="ja">
              <SpeakableWord text={spokenTextForCard(card)}>{card.front}</SpeakableWord>
            </p>
            <div className="focused-vocab-answer" aria-live="polite">
              <p className={revealed ? 'is-visible' : ''} lang="ja" aria-hidden={!revealed}>{card.reading}</p>
              <strong className={revealed ? 'is-visible' : ''} aria-hidden={!revealed}>{card.back}</strong>
            </div>
            {example && (
              <div
                className={`focused-vocab-example${revealed ? ' is-visible' : ''}${exampleSpeech.live ? ' is-speakable' : ''}${exampleSpeech.isSpeaking ? ' is-speaking' : ''}`}
                aria-hidden={!revealed}
                {...exampleSpeech.triggerProps}
              >
                <span className="focused-vocab-example-en">{example.english}</span>
                <div className="focused-vocab-example-jp-wrap">
                  <span className="focused-vocab-example-jp" lang="ja">
                    {example.segments.map((segment, index) => (
                      <FuriganaSegment key={index} text={segment.text} reading={segment.reading} />
                    ))}
                  </span>
                </div>
                {exampleSpeech.live && <SpeakableCue className="speakable-cue-corner" />}
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary focused-vocab-reveal"
              onClick={() => setRevealed((current) => !current)}
            >
              {revealed ? 'Hide answer' : 'Reveal answer'}
            </button>
            <div className="focused-vocab-actions">
              <button type="button" className="btn btn-ghost" onClick={() => nextCard(false)}>Study again</button>
              <button type="button" className="btn focused-vocab-easy" onClick={() => nextCard(true)}>I knew it</button>
            </div>
          </main>
        </>
      ) : null}
    </div>
  )
}

export type { VocabFocusSet }
