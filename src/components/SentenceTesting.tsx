import { useMemo, useState } from 'react'
import { sentencePatternCatalog } from '../data/sentencePatternCatalog'
import { generatePreviewSentence, type GeneratedPreviewSentence } from '../lib/sentenceGeneratorPreview'
import { selectMostDiverse, SentenceDiversityTracker } from '../lib/sentenceDiversity'
import {
  complexityDetails,
  complexityForPattern,
  GENERATION_COMPLEXITIES,
  patternsForComplexity,
  type GenerationComplexity,
} from '../lib/generationComplexity'
import { FuriganaSentence } from './FuriganaText'

const DEFAULT_BATCH_SIZE = 15
const BATCH_SIZE_OPTIONS = [15, 100] as const
type BatchSize = typeof BATCH_SIZE_OPTIONS[number]

function makeBatch(levels: readonly GenerationComplexity[], seed: number, batchSize: BatchSize): GeneratedPreviewSentence[] {
  const tracker = new SentenceDiversityTracker()
  return Array.from({ length: batchSize }, (_, index) => {
    const complexity = levels[index % levels.length]!
    const patterns = patternsForComplexity(complexity)
    const pattern = patterns[(Math.floor(index / levels.length) + seed) % patterns.length]
    if (!pattern) throw new Error(`No templates are mapped to generation complexity ${complexity}`)
    const baseSeed = seed * batchSize + index + 1
    const candidates = Array.from({ length: 10 }, (_, attempt) =>
      generatePreviewSentence(pattern.jlpt, baseSeed + attempt * 997, undefined, pattern.id, true),
    )
    const sentence = selectMostDiverse(candidates, tracker)
    if (!sentence) throw new Error(`Could not generate a sentence for ${pattern.id}`)
    tracker.add(sentence)
    return sentence
  })
}

function SentenceText({ sentence, showFurigana }: { sentence: GeneratedPreviewSentence; showFurigana: boolean }) {
  if (!showFurigana || !sentence.furigana.length) return <>{sentence.japanese}</>
  return (
    <FuriganaSentence
      segments={sentence.furigana.map((part) => part.text)}
      readings={sentence.furigana.map((part) => part.slot && part.reading !== part.text ? part.reading : undefined)}
    />
  )
}

export function SentenceTesting({ onBack }: { onBack: () => void }) {
  const [levels, setLevels] = useState<GenerationComplexity[]>([1])
  const [pendingLevels, setPendingLevels] = useState<GenerationComplexity[]>([1])
  const [menuOpen, setMenuOpen] = useState(false)
  const [showEnglish, setShowEnglish] = useState(true)
  const [showFurigana, setShowFurigana] = useState(true)
  const [batchSeed, setBatchSeed] = useState(1)
  const [batchSize, setBatchSize] = useState<BatchSize>(DEFAULT_BATCH_SIZE)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  const sentences = useMemo(() => makeBatch(levels, batchSeed, batchSize), [levels, batchSeed, batchSize])

  async function copyAll() {
    const text = sentences.map((sentence) => `${sentence.japanese}\n${sentence.english}`).join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('copied')
    } catch {
      // Clipboard API can be blocked by permissions policy (e.g. in some
      // embedded/sandboxed views) even on a direct click; a hidden textarea
      // + execCommand fallback still works there.
      try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(textarea)
        setCopyStatus(ok ? 'copied' : 'error')
      } catch {
        setCopyStatus('error')
      }
    }
    setTimeout(() => setCopyStatus('idle'), 2000)
  }

  function togglePendingLevel(level: GenerationComplexity) {
    setPendingLevels((current) => {
      if (current.includes(level)) return current.length === 1 ? current : current.filter((item) => item !== level)
      return GENERATION_COMPLEXITIES.filter((item) => [...current, level].includes(item))
    })
  }

  function applyLevels() {
    setLevels(pendingLevels)
    setBatchSeed((seed) => seed + 1)
    setMenuOpen(false)
  }

  return (
    <section className="sentence-testing" aria-labelledby="sentence-testing-title">
      <header className="sentence-testing-top">
        <button type="button" className="btn btn-ghost sentence-testing-back" onClick={onBack}>← Dashboard</button>
        <div className="sentence-testing-controls">
          <button
            type="button"
            className="builder-infinite-toggle"
            aria-pressed={showEnglish}
            aria-label={showEnglish ? 'Hide English translations' : 'Show English translations'}
            title={showEnglish ? 'Hide English translations' : 'Show English translations'}
            onClick={() => setShowEnglish((shown) => !shown)}
          >
            EN
          </button>
          <button
            type="button"
            className="builder-infinite-toggle sentence-testing-furigana-toggle"
            aria-pressed={showFurigana}
            aria-label={showFurigana ? 'Hide furigana' : 'Show furigana'}
            title={showFurigana ? 'Hide furigana' : 'Show furigana'}
            onClick={() => setShowFurigana((shown) => !shown)}
          >
            ふ
          </button>
          <div className="builder-level-picker">
            <button
              type="button"
              className="study-type-badge builder-level-trigger"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span>Sentence testing</span>
              <span className="jlpt-badge">{levels.map((level) => complexityDetails[level].shortLabel).join(' + ')}</span>
              <span className="builder-level-chevron" aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="builder-level-menu sentence-testing-level-menu" role="group" aria-label="Sentence testing complexity levels">
                <span className="builder-level-menu-label">Sentence levels</span>
                {GENERATION_COMPLEXITIES.map((level) => {
                  const selected = pendingLevels.includes(level)
                  return (
                    <button
                      key={level}
                      type="button"
                      className={`builder-level-option${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => togglePendingLevel(level)}
                    >
                      <span className="builder-level-check" aria-hidden="true" />
                      <strong>Level {level}</strong>
                      <small>{complexityDetails[level].label.split(' · ')[1]}</small>
                    </button>
                  )
                })}
                <button type="button" className="builder-level-save" onClick={applyLevels}>Generate {batchSize}</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="sentence-testing-intro">
        <div>
          <span className="sentence-testing-kicker">SENTENCE TESTING</span>
          <h1 id="sentence-testing-title">Explore generated sentences</h1>
          <p>Generate focused or large review batches, grouped by the grammatical complexity the generator must coordinate.</p>
        </div>
        <div className="sentence-testing-actions">
          <div className="sentence-testing-batch-size" role="group" aria-label="Sentence batch size">
            {BATCH_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                className={batchSize === size ? 'is-selected' : ''}
                aria-pressed={batchSize === size}
                onClick={() => {
                  setBatchSize(size)
                  setBatchSeed((seed) => seed + 1)
                }}
              >
                {size}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost sentence-testing-copy-all" onClick={copyAll}>
            {copyStatus === 'copied' ? 'Copied ✓' : copyStatus === 'error' ? 'Copy failed' : 'Copy all'}
          </button>
          <button type="button" className="btn btn-primary sentence-testing-generate" onClick={() => setBatchSeed((seed) => seed + 1)}>
            Generate {batchSize} more ↻
          </button>
        </div>
      </div>

      <div className="sentence-testing-summary" aria-live="polite">
        <span><b>{sentences.length}</b> sentences</span>
        <span><b>{levels.map((level) => `L${level}`).join(' + ')}</b> complexity</span>
      </div>

      <div className="sentence-testing-list">
        {sentences.map((sentence, index) => (
          <article className="sentence-testing-card" key={`${batchSeed}-${index}-${sentence.frameId}`}>
            <header>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <small>{complexityDetails[complexityForPattern(sentence.frameId)].shortLabel} · {sentence.frameId.toUpperCase()}</small>
            </header>
            <p className="sentence-testing-japanese" lang="ja"><SentenceText sentence={sentence} showFurigana={showFurigana} /></p>
            {showEnglish && <p className="sentence-testing-english">{sentence.english}</p>}
            <footer>
              <span>{sentencePatternCatalog.find((pattern) => pattern.id === sentence.frameId)?.structure ?? sentence.grammar[0]?.meaning}</span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  )
}
