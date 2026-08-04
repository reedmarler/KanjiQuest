import { useMemo, useState } from 'react'
import { kanjiReadings } from '../data/kanjiReadings.generated'
import { kanjiFocusSets, type KanjiFocusSet } from '../data/kanjiFocusSets'
import { getQuestById } from '../data/questCampaign'
import { vocabFocusSets } from '../data/vocabFocusSets'
import { kanjiLabEntries, type KanjiLabEntry } from '../lib/kanjiLabCatalog'
import type { JlptLevel } from '../lib/types'

interface KanjiLabProps {
  onBack: () => void
  questId?: string
  onQuestComplete?: () => void
}

const levels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const retryDistance = 5
type KanjiStudyMode = 'paths' | 'levels'

function ContextWord({ word, character }: { word: string; character: string }) {
  return (
    <>
      {[...word].map((part, partIndex) => (
        <span key={part + partIndex} className={part === character ? 'kanji-learning-word-target' : ''}>{part}</span>
      ))}
    </>
  )
}

function shuffled<T>(items: readonly T[]) {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!]
  }
  return next
}

/** One random starting example per kanji; word variants stay in More Examples. */
function uniqueKanjiOrder(entries: readonly KanjiLabEntry[]) {
  const firstEntryByCharacter = new Map<string, KanjiLabEntry>()
  for (const entry of shuffled(entries)) {
    if (!firstEntryByCharacter.has(entry.character)) firstEntryByCharacter.set(entry.character, entry)
  }
  return shuffled([...firstEntryByCharacter.values()])
}

function entriesForPath(path: KanjiFocusSet) {
  const entryByCharacter = new Map<string, KanjiLabEntry>()
  for (const entry of kanjiLabEntries) {
    if (!path.characters.includes(entry.character) || entryByCharacter.has(entry.character)) continue
    entryByCharacter.set(entry.character, entry)
  }
  return shuffled(path.characters.flatMap((character) => {
    const entry = entryByCharacter.get(character)
    return entry ? [entry] : []
  }))
}

function entriesForQuest(questId?: string) {
  const quest = getQuestById(questId)
  const vocabulary = vocabFocusSets.find((set) => set.id === quest?.vocabularySetId)
  if (!quest || !vocabulary) return []

  const seenCharacters = new Set<string>()
  return vocabulary.cards.flatMap((word) => [...word.front].flatMap((character) => {
    if (seenCharacters.has(character)) return []
    const source = kanjiLabEntries.find((entry) => entry.character === character)
    if (!source) return []
    seenCharacters.add(character)
    return [{
      ...source,
      example: { word: word.front, reading: word.reading, meaning: word.back },
    }]
  }))
}

export function KanjiLab({ onBack, questId, onQuestComplete }: KanjiLabProps) {
  const quest = getQuestById(questId)
  const questEntries = useMemo(() => entriesForQuest(questId), [questId])
  const questMode = Boolean(quest && questEntries.length)
  const [mode, setMode] = useState<KanjiStudyMode>('paths')
  const [path, setPath] = useState(() => shuffled(kanjiFocusSets)[0]!)
  const [level, setLevel] = useState<JlptLevel>('N5')
  const [entries, setEntries] = useState(() => questEntries.length ? questEntries : entriesForPath(path))
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [exampleOffset, setExampleOffset] = useState(0)
  const [completed, setCompleted] = useState(false)
  const entry = entries[index % entries.length]
  const card = entry?.card
  const characterReadings = entry ? kanjiReadings[entry.character] : undefined
  const allExamples = useMemo(() => {
    if (!entry) return []
    return questMode
      ? questEntries.filter((candidate) => candidate.character === entry.character)
      : kanjiLabEntries.filter((candidate) => candidate.character === entry.character)
  }, [entry, questEntries, questMode])
  const relatedExamples = useMemo(() => {
    if (!entry || !allExamples.length) return []
    const currentExample = allExamples.findIndex((candidate) => candidate.example.word === entry.example.word)
    const start = currentExample < 0 ? 0 : currentExample
    return Array.from(
      { length: Math.min(3, allExamples.length) },
      (_, offset) => allExamples[(start + exampleOffset + offset) % allExamples.length]!,
    )
  }, [allExamples, entry, exampleOffset])
  const hasMoreExamples = allExamples.length > relatedExamples.length

  function chooseLevel(nextLevel: JlptLevel) {
    setMode('levels')
    setLevel(nextLevel)
    setEntries(uniqueKanjiOrder(kanjiLabEntries.filter((entry) => entry.card.jlpt === nextLevel)))
    setIndex(0)
    setRevealed(false)
    setExampleOffset(0)
  }

  function choosePath(nextPath: KanjiFocusSet) {
    setMode('paths')
    setPath(nextPath)
    setEntries(entriesForPath(nextPath))
    setIndex(0)
    setRevealed(false)
    setExampleOffset(0)
  }

  function chooseNextPath() {
    const choices = shuffled(kanjiFocusSets.filter((candidate) => candidate.id !== path.id))
    if (choices[0]) choosePath(choices[0])
  }

  function nextCard(knewIt = false) {
    if (questMode) {
      if (index + 1 >= entries.length) {
        setCompleted(true)
        return
      }
      setIndex((current) => current + 1)
      setRevealed(false)
      setExampleOffset(0)
      return
    }

    if (!knewIt && entry) {
      const currentIndex = index % entries.length
      const desiredInsertAt = currentIndex + retryDistance
      const insertAt = desiredInsertAt <= entries.length
        ? desiredInsertAt
        : desiredInsertAt % entries.length
      const insertShiftsTheNextCard = insertAt <= currentIndex

      setEntries((currentEntries) => {
        // Revisit after several other cards: soon enough to reinforce it, but
        // never as an immediate repeat.
        return [
          ...currentEntries.slice(0, insertAt),
          entry,
          ...currentEntries.slice(insertAt),
        ]
      })
      setIndex((currentIndex + 1 + (insertShiftsTheNextCard ? 1 : 0)) % (entries.length + 1))
    } else {
      setIndex((current) => (current + 1) % entries.length)
    }
    setRevealed(false)
    setExampleOffset(0)
  }

  if (!card || !entry) return null

  if (questMode && completed) {
    return (
      <div className="grammar-practice-view kanji-lab kanji-lab-paths">
        <div className="study-top grammar-study-top"><button type="button" className="btn btn-ghost" onClick={onBack}>← Quest</button></div>
        <main className="focused-vocab-complete">
          <span className="focused-vocab-complete-mark">漢</span>
          <h2>Kanji step complete</h2>
          <p>You read the kanji from the {quest?.vocabularyTheme} word set.</p>
          <button type="button" className="btn btn-primary" onClick={onQuestComplete ?? onBack}>Use the grammar →</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setIndex(0); setCompleted(false); setRevealed(false) }}>Study these kanji again</button>
        </main>
      </div>
    )
  }

  return (
    <div className={'grammar-practice-view kanji-lab' + (mode === 'paths' ? ' kanji-lab-paths' : '')}>
      <div className="study-top grammar-study-top">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <span className="study-progress">{index + 1} / {entries.length}</span>
        <span className="study-type-badge">
          <span>{questMode ? 'Quest Kanji' : 'Kanji'}</span>
          <span className="jlpt-badge">{questMode ? quest?.level : mode === 'paths' ? 'Path' : level}</span>
        </span>
      </div>
      <div className="study-progress-bar">
        <div className="study-progress-fill" style={{ width: ((index + 1) / entries.length) * 100 + '%' }} />
      </div>

      <section className="kanji-study-navigation">
        {questMode ? (
          <div className="kanji-path-heading">
            <div><span>QUEST KANJI</span><h2>{quest?.title}</h2><p>{quest?.vocabularyTheme} — only the kanji from this quest’s vocabulary.</p></div>
          </div>
        ) : (<>
        <div className="kanji-study-mode-tabs" role="tablist" aria-label="Kanji study mode">
          <button type="button" role="tab" aria-selected={mode === 'paths'} className={mode === 'paths' ? 'active' : ''} onClick={() => choosePath(path)}>
            Kanji Paths
          </button>
          <button type="button" role="tab" aria-selected={mode === 'levels'} className={mode === 'levels' ? 'active' : ''} onClick={() => chooseLevel(level)}>
            JLPT Explorer
          </button>
        </div>
        {mode === 'paths' ? (
          <div className="kanji-path-heading">
            <div>
              <span>15-CHARACTER PATH</span>
              <h2>{path.title}</h2>
              <p>{path.description}</p>
            </div>
            <button type="button" onClick={chooseNextPath}>New path</button>
          </div>
        ) : (
          <div className="kanji-level-tabs">
            {levels.map((item) => (
              <button key={item} type="button" className={item === level ? 'active' : ''} onClick={() => chooseLevel(item)}>
                {item}
              </button>
            ))}
          </div>
        )}</>)}
      </section>

      <main className={'grammar-choice-card kanji-learning-card' + (revealed ? ' is-revealed' : '')}>
        <div className="kanji-learning-meta">
          {hasMoreExamples && (
            <button
              type="button"
              className="btn btn-ghost kanji-learning-more-examples"
              onClick={() => setExampleOffset((offset) => (offset + relatedExamples.length) % allExamples.length)}
            >
              More examples
            </button>
          )}
        </div>
        <p className="kanji-learning-character" lang="ja">{card.front}</p>
        <p className={'kanji-learning-character-reading' + (revealed ? ' is-revealed' : '')} lang="ja" aria-hidden={!revealed}>
          {characterReadings?.on.length ? <span>{characterReadings.on.join('・')}</span> : null}
          {characterReadings?.kun.length ? <span>{characterReadings.kun.join('・')}</span> : null}
        </p>
        <div className="kanji-learning-divider" aria-hidden="true" />

        <div className="kanji-learning-answer">
          <div className={'kanji-learning-examples example-count-' + relatedExamples.length + (revealed ? ' is-revealed' : '')} lang="ja">
            {relatedExamples.map((example) => (
              <div key={example.character + example.example.word}>
                <small>{example.example.reading}</small>
                <b><ContextWord word={example.example.word} character={entry.character} /></b>
                <span>{example.example.meaning}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="kanji-learning-controls">
          <div className="kanji-learning-reveal-row">
            <button
              type="button"
              className="btn btn-primary kanji-learning-reveal"
              onClick={() => setRevealed((isRevealed) => !isRevealed)}
            >
              {revealed ? 'Hide' : 'Reveal'}
            </button>
          </div>
          <div className="kanji-learning-actions">
            <button type="button" className="btn btn-ghost" onClick={() => nextCard(false)}>Study again</button>
            <button type="button" className="btn kanji-learning-easy" onClick={() => nextCard(true)}>Too Easy</button>
          </div>
        </div>
      </main>
    </div>
  )
}
