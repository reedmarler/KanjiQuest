import { useMemo, useState } from 'react'
import { generatePreviewSentence } from '../lib/sentenceGeneratorPreview'
import type { JlptLevel } from '../lib/types'

interface SentenceGeneratorPreviewProps {
  onBack: () => void
}

type PreviewLevel = Extract<JlptLevel, 'N5' | 'N4'>

export function SentenceGeneratorPreview({ onBack }: SentenceGeneratorPreviewProps) {
  const [level, setLevel] = useState<PreviewLevel>('N5')
  const [seed, setSeed] = useState(1)
  const [history, setHistory] = useState<ReturnType<typeof generatePreviewSentence>[]>([])

  const sentence = useMemo(
    () => generatePreviewSentence(level, seed, history.at(-1)),
    [level, seed, history],
  )

  function rotate() {
    setHistory((prev) => [...prev.slice(-4), sentence])
    setSeed((n) => n + 1)
  }

  function changeLevel(next: PreviewLevel) {
    setLevel(next)
    setHistory([])
    setSeed((n) => n + 11)
  }

  return (
    <div className="sentence-generator-preview">
      <button type="button" className="back-button" onClick={onBack}>
        ← Dashboard
      </button>

      <section className="generator-preview-card">
        <div className="generator-preview-header">
          <span className="generator-preview-kicker">New sentence generator preview</span>
          <h1>Japanese Sentence Rotation</h1>
          <p>
            This is the new frame + vocab + rules engine shown plainly, before it is wired into
            the dashboard animation.
          </p>
        </div>

        <div className="generator-preview-controls">
          {(['N5', 'N4'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`hero-level-btn${level === option ? ' is-active' : ''}`}
              onClick={() => changeLevel(option)}
            >
              {option}
            </button>
          ))}
          <button type="button" className="primary-button" onClick={rotate}>
            Rotate / Generate
          </button>
        </div>

        <div className="generator-sentence-card">
          <div className="generator-frame-id">{sentence.frameId}</div>
          <div className="generator-japanese">
            {sentence.furigana.map((part, index) => (
              <ruby key={`${part.text}-${index}`}>
                {part.text}
                {part.slot && <rt>{part.reading}</rt>}
              </ruby>
            ))}
          </div>
          <div className="generator-reading">{sentence.reading}</div>
          <div className="generator-english">{sentence.english}</div>
        </div>

        <div className="generator-preview-grid">
          <section className="generator-detail-panel">
            <h2>Slots swapped</h2>
            <div className="generator-slot-list">
              {Object.entries(sentence.slots).map(([name, slot]) => (
                <div key={name} className="generator-slot-row">
                  <span className="generator-slot-name">{name}</span>
                  <span className="generator-slot-main">
                    {slot.surface}
                    <small>
                      {slot.pos} · {slot.jlpt}
                      {slot.conjugation ? ` · ${slot.conjugation}` : ''}
                    </small>
                  </span>
                  <span className="generator-slot-english">{slot.english}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="generator-detail-panel">
            <h2>Grammar / validation</h2>
            <ul>
              {sentence.grammar.map((point) => (
                <li key={point.pattern}>
                  <strong>{point.pattern}</strong> ({point.jlpt}) — {point.meaning}
                </li>
              ))}
              {sentence.validation.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  )
}
