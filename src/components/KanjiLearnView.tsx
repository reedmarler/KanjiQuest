import { getKanjiDetail } from '../data/kanjiDetails'
import { getKanaReadingsDisplay } from '../lib/kanaReading'
import { getKanjiWordForm } from '../lib/kanjiWordForm'
import type { KanjiRadical, KanjiCompound } from '../lib/kanjiTypes'
import type { StudyCard } from '../lib/types'
import { FuriganaSegment } from './FuriganaText'

interface KanjiLearnViewProps {
  card: StudyCard
  current: number
  total: number
  onNext: (quality: number) => void
  onExit: () => void
}

export function KanjiLearnView({ card, current, total, onNext, onExit }: KanjiLearnViewProps) {
  const detail = getKanjiDetail(card)
  const wordForm = getKanjiWordForm(card)
  const { kunyomi, onyomi } = getKanaReadingsDisplay(card)

  return (
    <div className="study-view kanji-learn-view">
      <div className="study-top">
        <button className="btn btn-ghost" onClick={onExit}>← Exit</button>
        <span className="study-progress">{current + 1} / {total}</span>
        <span className="study-type-badge">
          Learn {card.jlpt && <span className="jlpt-badge">{card.jlpt}</span>}
        </span>
      </div>

      <div className="study-progress-bar">
        <div className="study-progress-fill" style={{ width: `${((current + 1) / total) * 100}%` }} />
      </div>

      <div className="kanji-learn-card">
        {wordForm ? (
          <span className="kanji-learn-char kanji-quiz-word">
            <FuriganaSegment text={wordForm.word} reading={wordForm.kana} />
          </span>
        ) : (
          <span className="kanji-learn-char">{card.front}</span>
        )}
        <p className="kanji-learn-meaning">{card.back}</p>

        <div className="kanji-readings">
          {wordForm ? (
            <div className="reading-group">
              <span className="reading-type">Reading</span>
              <span className="reading-values">{wordForm.kana}</span>
            </div>
          ) : (
            <>
              {kunyomi.length > 0 && (
                <div className="reading-group">
                  <span className="reading-type">Kun</span>
                  <span className="reading-values">{kunyomi.join(' · ')}</span>
                </div>
              )}
              {onyomi.length > 0 && (
                <div className="reading-group">
                  <span className="reading-type">On</span>
                  <span className="reading-values">{onyomi.join(' · ')}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="kanji-radicals">
          <h3>Parts</h3>
          <div className="radical-list">
            {detail.radicals.map((r: KanjiRadical) => (
              <div key={r.char} className="radical-chip">
                <span className="radical-char">{r.char}</span>
                <span className="radical-meaning">{r.meaning}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="kanji-mnemonic">
          <h3>Mnemonic</h3>
          <p>{detail.mnemonic}</p>
        </div>

        {detail.compounds.length > 0 && (
          <div className="kanji-compounds">
            <h3>Example words</h3>
            <ul>
              {detail.compounds.map((c: KanjiCompound) => (
                <li key={c.word}>
                  <strong>{c.word}</strong>
                  <span className="compound-reading">{c.reading}</span>
                  <span className="compound-meaning">— {c.meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {detail.contextSentence && (
          <div className="kanji-context-preview">
            <h3>In a sentence</h3>
            <p className="context-sentence">{detail.contextSentence}</p>
          </div>
        )}
      </div>

      <div className="kanji-learn-actions">
        <button className="btn btn-secondary" onClick={() => onNext(1)}>
          Still learning
        </button>
        <button className="btn btn-primary btn-large" onClick={() => onNext(2)}>
          Got it — next
        </button>
      </div>
    </div>
  )
}
