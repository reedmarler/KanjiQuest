import { useEffect, useState } from 'react'
import { CLINIC_LANE_CHAPTER, type QuestGateCheck } from '../data/questChapters'
import { FuriganaSegment } from './FuriganaText'
import { speakJapanese, stopSpeaking } from '../lib/speech'
import {
  chapterRoadProgress,
  clearRoadGate,
  loadQuestRoadProgress,
} from '../lib/questProgress'

type GatePhase = 'arrival' | 'workbench' | 'checks' | 'clear'
type CheckFeedback = 'correct' | 'wrong' | null

const chapter = CLINIC_LANE_CHAPTER

function checkLabel(check: QuestGateCheck) {
  if (check.kind === 'reading') return 'SEE'
  if (check.kind === 'audio-object') return 'HEAR'
  return 'USE'
}

export function QuestHub() {
  const [roadProgress, setRoadProgress] = useState(loadQuestRoadProgress)
  const initialChapterProgress = chapterRoadProgress(roadProgress, chapter.id)
  const [gateIndex, setGateIndex] = useState(() => Math.min(initialChapterProgress.currentGateIndex, chapter.gates.length - 1))
  const [phase, setPhase] = useState<GatePhase>('arrival')
  const [furiganaVisible, setFuriganaVisible] = useState(false)
  const [englishVisible, setEnglishVisible] = useState(false)
  const [pictureMode, setPictureMode] = useState(false)
  const [checkIndex, setCheckIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<CheckFeedback>(null)
  const [lastClearWasFirst, setLastClearWasFirst] = useState(false)

  const gate = chapter.gates[gateIndex]!
  const savedChapter = chapterRoadProgress(roadProgress, chapter.id)
  const gateWasCleared = savedChapter.clearedGateIds.includes(gate.id)
  const currentCheck = gate.checks[checkIndex]!
  const chapterComplete = savedChapter.clearedGateIds.length === chapter.gates.length

  useEffect(() => () => stopSpeaking(), [])

  function resetGate(nextIndex: number) {
    stopSpeaking()
    setGateIndex(nextIndex)
    setPhase('arrival')
    setFuriganaVisible(false)
    setEnglishVisible(false)
    setPictureMode(false)
    setCheckIndex(0)
    setSelectedAnswer(null)
    setFeedback(null)
    setLastClearWasFirst(false)
  }

  function startChecks() {
    setCheckIndex(0)
    setSelectedAnswer(null)
    setFeedback(null)
    setPhase('checks')
  }

  function finishGate() {
    const result = clearRoadGate(
      roadProgress,
      chapter.id,
      gate.id,
      gateIndex,
      chapter.gates.length,
      gate.firstClearReward,
    )
    setRoadProgress(result.progress)
    setLastClearWasFirst(result.firstClear)
    setFuriganaVisible(false)
    setPhase('clear')
  }

  function advanceCheck() {
    if (!selectedAnswer) return

    if (feedback === 'wrong') {
      setSelectedAnswer(null)
      setFeedback(null)
      return
    }

    if (feedback === 'correct') {
      if (checkIndex === gate.checks.length - 1) {
        finishGate()
        return
      }
      setCheckIndex((index) => index + 1)
      setSelectedAnswer(null)
      setFeedback(null)
      return
    }

    setFeedback(selectedAnswer === currentCheck.answer ? 'correct' : 'wrong')
  }

  function continueRoad() {
    if (gate.nextGateId) {
      const nextIndex = chapter.gates.findIndex((item) => item.id === gate.nextGateId)
      resetGate(nextIndex >= 0 ? nextIndex : gateIndex)
      return
    }
    resetGate(0)
  }

  return (
    <main className="road-quest" data-phase={phase}>
      <header className="road-quest-board">
        <div>
          <span className="road-quest-eyebrow">{chapter.titleJp}</span>
          <h1>{chapter.title}</h1>
          <p>{chapter.atmosphere}</p>
        </div>
        <div className="road-quest-souls" aria-label={`${roadProgress.souls} souls`}>
          <img src="/quest-soul-icon.jpg" alt="" />
          <span lang="ja">魂</span>
          <strong>{roadProgress.souls}</strong>
        </div>
      </header>

      <nav className="road-quest-gates" aria-label="Clinic Lane gates">
        {chapter.gates.map((item, index) => {
          const cleared = savedChapter.clearedGateIds.includes(item.id)
          const unlocked = index <= savedChapter.currentGateIndex
          return (
            <button
              key={item.id}
              type="button"
              className={`${index === gateIndex ? 'is-current' : ''}${cleared ? ' is-cleared' : ''}`}
              disabled={!unlocked}
              onClick={() => resetGate(index)}
              aria-current={index === gateIndex ? 'step' : undefined}
              aria-label={`${item.placeLabel}${cleared ? ', cleared' : unlocked ? ', open' : ', locked'}`}
            >
              <i aria-hidden="true">{cleared ? '✓' : unlocked ? index + 1 : '·'}</i>
              <span>{item.objectLabel}</span>
            </button>
          )
        })}
      </nav>

      {phase !== 'clear' && (
        <section className={`road-quest-scene${pictureMode ? ' is-picture' : ''}`} aria-labelledby="gate-object">
          <img
            src={pictureMode ? gate.pictureStillKey : gate.pictureKey}
            alt={gate.pictureAlt}
          />
          <div className="road-quest-scene-shade" />
          <div className="road-quest-place">
            <span>GATE {gateIndex + 1} · {gate.placeLabel}</span>
            <strong>{pictureMode ? '絵 · another look' : 'ARRIVAL'}</strong>
          </div>
          <div className="road-quest-object">
            <span>{gate.objectLabel}</span>
            <h2 id="gate-object" lang="ja">
              {furiganaVisible
                ? <FuriganaSegment text={gate.objectText} reading={gate.readingUsedHere} />
                : gate.objectText}
            </h2>
            {englishVisible && <p>{gate.gloss}</p>}
          </div>
        </section>
      )}

      {phase !== 'clear' && (
        <div className="road-quest-controls" aria-label="Gate display controls">
          <button
            type="button"
            className={`control-chip control-chip-compact app-display-toggle${furiganaVisible ? ' is-active' : ''}`}
            onClick={() => setFuriganaVisible((visible) => !visible)}
            aria-pressed={furiganaVisible}
            title="Peek at furigana"
          >
            ふり
          </button>
          <button
            type="button"
            className={`control-chip control-chip-compact app-display-toggle${englishVisible ? ' is-active' : ''}`}
            onClick={() => setEnglishVisible((visible) => !visible)}
            aria-pressed={englishVisible}
            title="English"
          >
            EN
          </button>
          <button
            type="button"
            className="control-icon-button control-speaker-button"
            onClick={() => speakJapanese(gate.audioKey)}
            aria-label="Play the line from this place"
            title="Play the line from this place"
          >
            <span aria-hidden="true">音</span>
          </button>
          <button
            type="button"
            className={`control-chip control-chip-compact app-display-toggle road-quest-picture-toggle${pictureMode ? ' is-active' : ''}`}
            onClick={() => setPictureMode((visible) => !visible)}
            aria-pressed={pictureMode}
            title="Show another view of this place"
          >
            絵
          </button>
        </div>
      )}

      {phase === 'arrival' && (
        <section className="road-quest-arrival">
          <div>
            <span>THE ROAD STOPS HERE</span>
            <p lang="ja">
              {furiganaVisible
                ? <FuriganaSegment text={gate.sceneSentence} reading={gate.sceneSentenceReading} />
                : gate.sceneSentence}
            </p>
            {englishVisible && <small>{gate.sceneSentenceEn}</small>}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setPhase('workbench')}>
            Study this sign
          </button>
        </section>
      )}

      {phase === 'workbench' && (
        <section className="road-quest-workbench" aria-labelledby="workbench-title">
          <header>
            <div>
              <span>WORKBENCH · THIS SIGN ONLY</span>
              <h2 id="workbench-title">Read what is in front of you</h2>
            </div>
            {gate.echoFrom && <b className="road-quest-echo">ECHO · {gate.echoFrom}</b>}
          </header>

          <div className="road-quest-word-study">
            <span>WORD</span>
            <strong lang="ja"><FuriganaSegment text={gate.objectText} reading={gate.readingUsedHere} /></strong>
            <p>{gate.gloss}</p>
          </div>

          <div className="road-quest-pieces" aria-label="Kanji used on this sign">
            {gate.pieces.map((piece) => (
              <article key={`${piece.kanji}-${piece.reading}`}>
                <strong lang="ja"><FuriganaSegment text={piece.kanji} reading={piece.reading} /></strong>
                <span>{piece.meaning}</span>
              </article>
            ))}
          </div>

          <div className="road-quest-line-study">
            <span>LINE FROM THIS PLACE</span>
            <p lang="ja"><FuriganaSegment text={gate.sceneSentence} reading={gate.sceneSentenceReading} /></p>
            <small>{gate.sceneSentenceEn}</small>
          </div>

          <button type="button" className="btn btn-primary" onClick={startChecks}>
            Check the gate
          </button>
        </section>
      )}

      {phase === 'checks' && (
        <section className="road-quest-check" aria-labelledby="gate-check-title">
          <header>
            <span>{checkLabel(currentCheck)} · CHECK {checkIndex + 1} OF {gate.checks.length}</span>
            <div aria-hidden="true">
              {gate.checks.map((check, index) => <i key={check.id} className={index <= checkIndex ? 'is-active' : ''} />)}
            </div>
          </header>

          <h2 id="gate-check-title">{currentCheck.prompt}</h2>
          {currentCheck.kind === 'reading' && <p className="road-quest-check-object" lang="ja">{gate.objectText}</p>}
          {currentCheck.kind === 'cloze' && <p className="road-quest-check-cloze" lang="ja">{currentCheck.displayText}</p>}
          {currentCheck.kind === 'audio-object' && (
            <button
              type="button"
              className="road-quest-listen"
              onClick={() => speakJapanese(gate.readingUsedHere)}
              aria-label="Play the reading"
            >
              <span aria-hidden="true">音</span>
              <b>Play reading</b>
            </button>
          )}

          <div className="road-quest-answers">
            {currentCheck.options.map((option) => {
              const selected = selectedAnswer === option
              const answerClass = feedback && selected
                ? option === currentCheck.answer ? ' is-correct' : ' is-wrong'
                : selected ? ' is-selected' : ''
              return (
                <button
                  key={option}
                  type="button"
                  className={answerClass}
                  disabled={feedback !== null}
                  onClick={() => setSelectedAnswer(option)}
                  lang="ja"
                >
                  {option}
                </button>
              )
            })}
          </div>

          <div className={`road-quest-check-action${feedback ? ` is-${feedback}` : ''}`} aria-live="polite">
            <p>
              {feedback === 'correct' && <><strong>The sign answers.</strong><span>Same object, one step closer.</span></>}
              {feedback === 'wrong' && <><strong>Not this reading.</strong><span>Look at the same sign and try once more.</span></>}
              {!feedback && <><strong>{gateWasCleared ? 'Practice clear' : 'The way stays shut'}</strong><span>Pass all three checks to continue.</span></>}
            </p>
            <button type="button" className="btn btn-primary" disabled={!selectedAnswer} onClick={advanceCheck}>
              {feedback === 'correct'
                ? checkIndex === gate.checks.length - 1 ? 'Open the gate' : 'Next check'
                : feedback === 'wrong' ? 'Try again' : 'Check'}
            </button>
          </div>
        </section>
      )}

      {phase === 'clear' && (
        <section className="road-quest-clear" aria-labelledby="gate-clear-title">
          <span>{lastClearWasFirst ? 'FIRST CLEAR' : 'ROAD PRACTICE'}</span>
          <div className="road-quest-clear-sign">
            <small>READABLE</small>
            <h2 id="gate-clear-title" lang="ja">{gate.objectText}</h2>
            <p>{gate.readingUsedHere} · {gate.gloss}</p>
          </div>

          <div className="road-quest-clear-companion">
            <img className="road-quest-chibi" src="/quest-mascot-battle.png" alt="The Kanji Quest guide celebrating beside the open road" />
            <div className={`road-quest-reward${lastClearWasFirst ? ' is-earned' : ''}`}>
              <img src="/quest-soul-icon.jpg" alt="" />
              <span lang="ja">魂</span>
              <strong>{lastClearWasFirst ? `+${gate.firstClearReward}` : 'Earned'}</strong>
              <small>{lastClearWasFirst ? 'First-clear reward' : 'First clear already paid'}</small>
            </div>
          </div>

          <p className="road-quest-clear-copy">
            {gate.nextGateId
              ? 'The reading stays. The next lantern comes into view.'
              : 'Clinic Lane is open from end to end.'}
          </p>
          <button type="button" className="btn btn-primary" onClick={continueRoad}>
            {gate.nextGateId ? 'Walk to the next gate' : chapterComplete ? 'Review the road' : 'Return to the road'}
          </button>
        </section>
      )}
    </main>
  )
}
