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
const KANJI_CHARACTER_RE = /[\u3400-\u4DBF\u4E00-\u9FFF]/u
const KANJI_DEFINITION_FALLBACKS: Readonly<Record<string, string>> = {
  '札': 'tag · ticket',
  '券': 'ticket · coupon',
}

function ContextWord({ word, character }: { word: string; character: string }) {
  return (
    <>
      {[...word].map((part, partIndex) => (
        <span key={part + partIndex} className={part === character ? 'kanji-learning-word-target' : ''}>{part}</span>
      ))}
    </>
  )
}

function QuestExampleWord({ word, character, reading }: { word: string; character: string; reading: string }) {
  const characters = [...word]
  const anchorIndex = characters.indexOf(character)
  const characterReadings = questWordCharacterReadings(word, reading)

  const renderCharacters = (start: number, end: number) => characters.slice(start, end).map((part, offset) => {
    const index = start + offset
    return (
      <span className="quest-kanji-example-character" key={`${part}-${index}`}>
        {characterReadings[index] && <small className="quest-kanji-expanded-reading">{characterReadings[index]}</small>}
        <span>{part}</span>
      </span>
    )
  })

  if (anchorIndex < 0) return <strong className="kanji-learning-word-target">{character}</strong>

  return (
    <>
      <span className="quest-kanji-example-prefix">{renderCharacters(0, anchorIndex)}</span>
      <span className="quest-kanji-example-anchor">
        {characterReadings[anchorIndex] && <small className="quest-kanji-expanded-reading">{characterReadings[anchorIndex]}</small>}
        <strong className="kanji-learning-word-target">{character}</strong>
      </span>
      <span className="quest-kanji-example-suffix">{renderCharacters(anchorIndex + 1, characters.length)}</span>
    </>
  )
}

function QuestMainWord({ word, reading }: { word: string; reading: string }) {
  const characterReadings = questWordCharacterReadings(word, reading)

  return (
    <>
      {[...word].map((character, index) => (
        <span className="quest-kanji-main-character" key={`${character}-${index}`}>
          {characterReadings[index] && <small>{characterReadings[index]}</small>}
          <span>{character}</span>
        </span>
      ))}
    </>
  )
}

function normalizeKanaReading(reading: string) {
  return reading
    .replace(/[\u30A1-\u30F6]/g, (character) => String.fromCodePoint(character.codePointAt(0)! - 0x60))
    .replace(/[.\-]/g, '')
}

function voicedReadingVariants(reading: string) {
  const voicedInitials: Readonly<Record<string, readonly string[]>> = {
    か: ['が'], き: ['ぎ'], く: ['ぐ'], け: ['げ'], こ: ['ご'],
    さ: ['ざ'], し: ['じ'], す: ['ず'], せ: ['ぜ'], そ: ['ぞ'],
    た: ['だ'], ち: ['ぢ'], つ: ['づ'], て: ['で'], と: ['ど'],
    は: ['ば', 'ぱ'], ひ: ['び', 'ぴ'], ふ: ['ぶ', 'ぷ'], へ: ['べ', 'ぺ'], ほ: ['ぼ', 'ぽ'],
  }
  const firstCharacter = reading[0]
  return [reading, ...(voicedInitials[firstCharacter] ?? []).map((initial) => initial + reading.slice(1))]
}

function questWordCharacterReadings(word: string, reading: string) {
  const characters = [...word]
  const spoken = normalizeKanaReading(reading)
  const memo = new Map<string, string[] | null>()

  const splitReading = (wordIndex: number, readingIndex: number): string[] | null => {
    const memoKey = `${wordIndex}:${readingIndex}`
    if (memo.has(memoKey)) return memo.get(memoKey) ?? null
    if (wordIndex === characters.length) return readingIndex === spoken.length ? [] : null

    const character = characters[wordIndex]
    if (!KANJI_CHARACTER_RE.test(character)) {
      const kana = normalizeKanaReading(character)
      if (!spoken.startsWith(kana, readingIndex)) return null
      const tail = splitReading(wordIndex + 1, readingIndex + kana.length)
      const result = tail ? ['', ...tail] : null
      memo.set(memoKey, result)
      return result
    }

    const dictionaryEntry = kanjiReadings[character]
    const candidates = [...new Set([...(dictionaryEntry?.on ?? []), ...(dictionaryEntry?.kun ?? [])]
      .map(normalizeKanaReading)
      .filter(Boolean))]
      .sort((left, right) => right.length - left.length)

    for (const candidate of candidates) {
      for (const variant of voicedReadingVariants(candidate)) {
        if (!spoken.startsWith(variant, readingIndex)) continue
        const tail = splitReading(wordIndex + 1, readingIndex + variant.length)
        if (tail) {
          const result = [spoken.slice(readingIndex, readingIndex + variant.length), ...tail]
          memo.set(memoKey, result)
          return result
        }
      }
    }

    memo.set(memoKey, null)
    return null
  }

  const segmented = splitReading(0, 0)
  if (segmented) return segmented

  const splitFromEnd = (wordIndex: number, readingEnd: number): string[] | null => {
    if (wordIndex < 0) return readingEnd === 0 ? [] : null
    const character = characters[wordIndex]

    if (!KANJI_CHARACTER_RE.test(character)) {
      const kana = normalizeKanaReading(character)
      if (!spoken.slice(0, readingEnd).endsWith(kana)) return null
      const head = splitFromEnd(wordIndex - 1, readingEnd - kana.length)
      return head ? [...head, ''] : null
    }

    if (wordIndex === 0 && readingEnd > 0) return [spoken.slice(0, readingEnd)]

    const dictionaryEntry = kanjiReadings[character]
    const candidates = [...new Set([...(dictionaryEntry?.on ?? []), ...(dictionaryEntry?.kun ?? [])]
      .map(normalizeKanaReading)
      .filter(Boolean))]
      .sort((left, right) => right.length - left.length)

    for (const candidate of candidates) {
      for (const variant of voicedReadingVariants(candidate)) {
        if (!spoken.slice(0, readingEnd).endsWith(variant)) continue
        const start = readingEnd - variant.length
        const head = splitFromEnd(wordIndex - 1, start)
        if (head) return [...head, spoken.slice(start, readingEnd)]
      }
    }

    return null
  }

  const segmentedFromEnd = splitFromEnd(characters.length - 1, spoken.length)
  if (segmentedFromEnd) return segmentedFromEnd

  return characters.map((character) => {
    if (!KANJI_CHARACTER_RE.test(character)) return ''
    const dictionaryEntry = kanjiReadings[character]
    return [...(dictionaryEntry?.on ?? []), ...(dictionaryEntry?.kun ?? [])]
      .map(normalizeKanaReading)
      .find((candidate) => candidate && spoken.includes(candidate)) ?? ''
  })
}

function questKanjiParts(word: string) {
  const characters = [...new Set([...word].filter((character) => KANJI_CHARACTER_RE.test(character)))]
  const usedWords = new Set([word])

  return characters.map((character) => {
    const candidates = new Map<string, KanjiLabEntry>()
    for (const candidate of kanjiLabEntries) {
      if (candidate.character !== character || usedWords.has(candidate.example.word)) continue
      if (!candidates.has(candidate.example.word)) candidates.set(candidate.example.word, candidate)
    }
    const examples = [...candidates.values()]
      .sort((left, right) => {
        const leftLength = [...left.example.word].length
        const rightLength = [...right.example.word].length
        const leftUseful = leftLength >= 2 && leftLength <= 4 ? 0 : 1
        const rightUseful = rightLength >= 2 && rightLength <= 4 ? 0 : 1
        return leftUseful - rightUseful || leftLength - rightLength
      })
      .slice(0, characters.length >= 3 ? 1 : 2)
    examples.forEach((example) => usedWords.add(example.example.word))
    const definitionSource = kanjiLabEntries.find((candidate) => candidate.character === character && candidate.card.front === character)
      ?? kanjiLabEntries.find((candidate) => candidate.character === character)
    const definition = KANJI_DEFINITION_FALLBACKS[character]
      ?? definitionSource?.card.back.split(';')[0]
      ?? definitionSource?.example.meaning.split(';')[0]
      ?? 'definition coming soon'
    return { character, examples, definition }
  })
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

function entriesForQuest(questId?: string): KanjiLabEntry[] {
  const quest = getQuestById(questId)
  const vocabulary = vocabFocusSets.find((set) => set.id === quest?.vocabularySetId)
  if (!quest || !vocabulary) return []

  // A Quest reinforces vocabulary words. A compound such as 玄関 stays one
  // card with one reading instead of being split into separate 玄 and 関 cards.
  return vocabulary.cards.flatMap((word) => {
    const source = [...word.front]
      .map((character) => kanjiLabEntries.find((entry) => entry.character === character))
      .find(Boolean)
    if (!source) return []
    return [{
      ...source,
      character: word.front,
      card: {
        ...source.card,
        id: `quest-kanji-${quest.id}-${word.id}`,
        front: word.front,
        reading: word.reading ?? '',
        back: word.back,
      },
      example: { word: word.front, reading: word.reading ?? '', meaning: word.back },
    }]
  })
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
  const characterReadings = !questMode && entry ? kanjiReadings[entry.character] : undefined
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
  const questParts = useMemo(() => entry && questMode ? questKanjiParts(entry.character) : [], [entry, questMode])

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

  function previousCard() {
    if (completed) {
      setCompleted(false)
      setRevealed(false)
      return
    }
    if (index > 0) {
      setIndex((current) => current - 1)
      setRevealed(false)
      setExampleOffset(0)
      return
    }
    onBack()
  }

  if (!card || !entry) return null

  if (questMode && completed) {
    return (
      <div className="grammar-practice-view kanji-lab kanji-lab-paths">
        <div className="study-top grammar-study-top"><button type="button" className="vocab-back-arrow" onClick={previousCard} aria-label="Previous kanji" title="Previous kanji"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button></div>
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

  if (questMode) {
    const mainWordCharacters = [...card.front]
    const mainWordCharacterReadings = questWordCharacterReadings(card.front, entry.example.reading)

    return (
      <div className="grammar-practice-view kanji-lab kanji-lab-paths quest-kanji-study">
        <div className="study-top grammar-study-top">
          <button type="button" className="vocab-back-arrow" onClick={previousCard} aria-label={index > 0 ? 'Previous kanji' : 'Back to Quest'} title={index > 0 ? 'Previous kanji' : 'Back to Quest'}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <span className="study-progress">{index + 1} / {entries.length}</span>
          <span className="study-type-badge"><span>Quest Kanji</span><span className="jlpt-badge">{quest?.level}</span></span>
        </div>
        <div className="study-progress-bar"><div className="study-progress-fill" style={{ width: ((index + 1) / entries.length) * 100 + '%' }} /></div>
        <section className="kanji-study-navigation kanji-armory-navigation">
          <div className="kanji-path-heading"><span className="kanji-armory-mark" aria-hidden="true">{quest?.symbol}</span><div><h2>{quest?.title}</h2></div></div>
        </section>

        <main className={`grammar-choice-card kanji-learning-card quest-kanji-card${revealed ? ' is-revealed' : ''}`}>
          <p className="quest-kanji-word" lang="ja">
            <QuestMainWord word={card.front} reading={entry.example.reading} />
          </p>
          <div className="kanji-learning-divider" aria-hidden="true" />
          <div className={`quest-kanji-word-answer${revealed ? ' is-revealed' : ''}`} aria-hidden={!revealed}>
            <span>{entry.example.meaning}</span>
          </div>
          <div className={`quest-kanji-parts part-count-${questParts.length}${questParts.length === 1 ? ' is-single' : ''}${revealed ? ' is-revealed' : ''}`}>
            {questParts.map((part) => {
              const examples = part.examples.length ? part.examples.slice(0, 2) : [undefined]
              const mainWordIndex = mainWordCharacters.indexOf(part.character)
              const partReading = mainWordIndex >= 0 ? mainWordCharacterReadings[mainWordIndex] ?? '' : ''
              const exampleColumns = examples.length === 2
                ? examples.map((example) => {
                  const length = example ? [...example.example.word].length : 1
                  return `minmax(0, ${1 + Math.max(0, length - 2) * 0.22}fr)`
                }).join(' ')
                : undefined
              return (
                <article key={part.character} className={part.examples.length ? '' : 'has-no-examples'}>
                  <div className={`quest-kanji-expanded-examples example-count-${examples.length}`} style={exampleColumns ? { gridTemplateColumns: exampleColumns } : undefined}>
                    {examples.map((example, exampleIndex) => {
                      const wordLength = example ? [...example.example.word].length : 1
                      return (
                        <div className="quest-kanji-expanded-example" key={example?.example.word ?? `${part.character}-${exampleIndex}`}>
                          <div className={`quest-kanji-expanded-word word-length-${Math.min(wordLength, 5)}`} lang="ja">
                            {example
                              ? <QuestExampleWord word={example.example.word} character={part.character} reading={example.example.reading} />
                              : <><span className="quest-kanji-example-anchor">{partReading && <small className="quest-kanji-expanded-reading">{partReading}</small>}<strong>{part.character}</strong></span><span className="is-definition">{part.definition}</span></>}
                          </div>
                          <em className="quest-kanji-expanded-meaning">{example?.example.meaning.split(';')[0] ?? ''}</em>
                        </div>
                      )
                    })}
                  </div>
                </article>
              )
            })}
          </div>
          <div className="kanji-learning-controls">
            <div className="kanji-learning-reveal-row"><button type="button" className="btn btn-primary kanji-learning-reveal" onClick={() => setRevealed((value) => !value)}>{revealed ? 'Hide examples' : 'Show examples'}</button></div>
            <div className="kanji-learning-actions"><button type="button" className="btn btn-ghost" onClick={() => nextCard(false)}>Review again</button><button type="button" className="btn kanji-learning-easy" onClick={() => nextCard(true)}>Next word</button></div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={'grammar-practice-view kanji-lab' + (mode === 'paths' ? ' kanji-lab-paths' : '')}>
      <div className="study-top grammar-study-top">
        <button type="button" className="vocab-back-arrow" onClick={previousCard} aria-label={index > 0 ? 'Previous kanji' : 'Back to Dashboard'} title={index > 0 ? 'Previous kanji' : 'Back to Dashboard'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <span className="study-progress">{index + 1} / {entries.length}</span>
        <span className="study-type-badge">
          <span>{questMode ? 'Quest Kanji' : 'Kanji'}</span>
          <span className="jlpt-badge">{questMode ? quest?.level : mode === 'paths' ? 'Path' : level}</span>
        </span>
      </div>
      <div className="study-progress-bar">
        <div className="study-progress-fill" style={{ width: ((index + 1) / entries.length) * 100 + '%' }} />
      </div>

      <section className="kanji-study-navigation kanji-armory-navigation">
        {questMode ? (
          <div className="kanji-path-heading">
            <span className="kanji-armory-mark" aria-hidden="true">漢</span>
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
            <span className="kanji-armory-mark" aria-hidden="true">漢</span>
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
          {questMode
            ? <span>{entry.example.reading}</span>
            : <>
                {characterReadings?.on.length ? <span>{characterReadings.on.join('・')}</span> : null}
                {characterReadings?.kun.length ? <span>{characterReadings.kun.join('・')}</span> : null}
              </>}
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
