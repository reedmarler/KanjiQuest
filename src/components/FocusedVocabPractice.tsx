import { useMemo, useState } from 'react'
import { vocabFocusSets, type VocabFocusSet } from '../data/vocabFocusSets'
import { getVocabExampleSentence } from '../lib/vocabExampleSentence'
import { FuriganaSegment } from './FuriganaText'
import { SpeakableCue, SpeakableWord, useSpeakable } from './SpeakableWord'
import { spokenTextForCard, spokenTextForWord } from '../lib/spokenText'
import { AppBackButton, AppDashboardButton } from './AppBackButton'
import { recordAnswer, recordSeen } from '../lib/studyRecord'

interface FocusedVocabPracticeProps {
  onBack: () => void
  onDashboard: () => void
  initialTopicId?: string
  onQuestComplete?: () => void
  questTitle?: string
}

function shuffled<T>(items: readonly T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  }
  return copy
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
  const [session, setSession] = useState(() => newSession(undefined, initialTopicId))
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [furiganaVisible, setFuriganaVisible] = useState(true)
  const [englishVisible, setEnglishVisible] = useState(true)
  const [completed, setCompleted] = useState(false)
  const card = session.cards[index]
  const example = useMemo(() => (card ? getVocabExampleSentence(card) : undefined), [card])
  const exampleSpeech = useSpeakable(
    example ? spokenTextForWord(example.japanese, example.reading) : '',
    !revealed,
  )

  function nextCard() {
    if (index + 1 >= session.cards.length) {
      setCompleted(true)
      return
    }
    setIndex((current) => current + 1)
    setRevealed(false)
  }

  /*
   * Skipping past a word without looking is evidence of exposure and nothing
   * more, so it records a first sighting rather than a pass. Grading only
   * appears once the answer is showing — there is nothing to be honest about
   * until the learner has seen what they were trying to recall.
   */
  function skipCard() {
    if (card) recordSeen(card.id)
    nextCard()
  }

  function gradeCard(knew: boolean) {
    if (card) recordAnswer(card.id, knew ? 'good' : 'again')
    nextCard()
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
    setCompleted(false)
  }

  function replayTopic() {
    setSession((current) => ({ ...current, cards: shuffled(current.cards) }))
    setIndex(0)
    setRevealed(false)
    setCompleted(false)
  }

  // Kanji Lab's phone layout: reuse its prompt and control structure so Vocab
  // and Kanji behave like two decks in the same study system.
  return (
    <div className="grammar-practice-view kanji-lab kanji-lab-paths standard-kanji-study focused-vocab-practice-standard">
      <div className="study-top grammar-study-top">
        <div className="app-nav-actions">
          <AppBackButton onClick={onBack} aria-label={questTitle ? 'Back to Quest' : 'Back to Study Tools'} />
          <AppDashboardButton onClick={onDashboard} />
        </div>
        <span className="study-progress">{Math.min(index + 1, session.cards.length)} / {session.cards.length}</span>
        <span className="study-type-badge">
          <span>Vocab</span>
          <span className="jlpt-badge">Path</span>
        </span>
      </div>
      <div className="study-progress-bar">
        <div className="study-progress-fill" style={{ width: `${((index + 1) / session.cards.length) * 100}%` }} />
      </div>

      <section className="kanji-study-navigation">
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
          <p>You got through all 15 words in {session.topic.title}.</p>
          <button type="button" className="btn btn-primary" onClick={onQuestComplete ?? loadNextTopic}>
            {onQuestComplete ? 'Read the kanji →' : 'New topic →'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={replayTopic}>Replay this set</button>
        </main>
      ) : card ? (
        <main className={`grammar-choice-card kanji-learning-card standard-kanji-card main-word-length-${Math.min([...card.front].length, 4)}${revealed ? ' is-revealed' : ''}`}>
          <div className="standard-kanji-prompt focused-vocab-standard-prompt">
            <p className={`kanji-learning-character standard-kanji-compound-word focused-vocab-main-word${revealed && furiganaVisible ? ' is-furigana-visible' : ''}`} lang="ja">
              <SpeakableWord text={spokenTextForCard(card)}>
                <FuriganaSegment text={card.front} reading={spokenTextForCard(card)} className="focused-vocab-main-furigana" />
              </SpeakableWord>
            </p>
            <div className="kanji-learning-divider" aria-hidden="true" />
            <div className={`quest-kanji-word-answer standard-kanji-main-meaning${revealed && englishVisible ? ' is-revealed' : ''}`} aria-hidden={!revealed || !englishVisible}>
              <span>{card.back}</span>
            </div>
          </div>

          <div className="kanji-learning-answer standard-kanji-answer focused-vocab-standard-answer">
            {example && (
              <div
                className={`focused-vocab-example${revealed ? ' is-revealed' : ''}${furiganaVisible ? ' is-furigana-visible' : ''}${englishVisible ? ' is-english-visible' : ''}${exampleSpeech.live ? ' is-speakable' : ''}${exampleSpeech.isSpeaking ? ' is-speaking' : ''}`}
                aria-hidden={!revealed}
                {...exampleSpeech.triggerProps}
              >
                <div className="focused-vocab-example-jp-wrap">
                  <span className="focused-vocab-example-jp" lang="ja">
                    {example.segments.map((segment, index) => (
                      <FuriganaSegment key={index} text={segment.text} reading={segment.reading} />
                    ))}
                  </span>
                </div>
                <span className="focused-vocab-example-en" aria-hidden={!englishVisible}>{example.english}</span>
                {exampleSpeech.live && <SpeakableCue className="speakable-cue-corner" />}
              </div>
            )}
          </div>

          <div className="kanji-learning-controls standard-kanji-controls">
            <div className="standard-kanji-utility-row">
              <div className="standard-kanji-display-toggles" role="group" aria-label="Display options">
                <button
                  type="button"
                  className={`btn standard-kanji-furigana-toggle${furiganaVisible ? ' is-active' : ''}`}
                  aria-pressed={furiganaVisible}
                  onClick={() => setFuriganaVisible((isVisible) => !isVisible)}
                >
                  Furigana
                </button>
                <button
                  type="button"
                  className={`btn standard-kanji-english-toggle${englishVisible ? ' is-active' : ''}`}
                  aria-pressed={englishVisible}
                  onClick={() => setEnglishVisible((isVisible) => !isVisible)}
                >
                  English
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary kanji-learning-reveal"
                onClick={() => setRevealed((current) => !current)}
              >
                {revealed ? 'Hide examples' : 'Show examples'}
              </button>
            </div>
            <div className="standard-kanji-action-row">
              <button type="button" className="btn btn-ghost standard-kanji-review" onClick={previousCard} disabled={index === 0}>Previous word</button>
              {revealed ? (
                <div className="focused-vocab-grade" role="group" aria-label="Did you know this word?">
                  <button type="button" className="btn focused-vocab-again" onClick={() => gradeCard(false)}>Again</button>
                  <button type="button" className="btn kanji-learning-easy" onClick={() => gradeCard(true)}>Got it</button>
                </div>
              ) : (
                <button type="button" className="btn kanji-learning-easy" onClick={skipCard}>Next word</button>
              )}
            </div>
          </div>
        </main>
      ) : null}
    </div>
  )
}

export type { VocabFocusSet }
