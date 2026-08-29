import { useMemo, useState } from 'react'
import { kanjiReadings } from '../data/kanjiReadings.generated'
import { kanjiFocusSets, type KanjiFocusSet } from '../data/kanjiFocusSets'
import { getQuestById } from '../data/questCampaign'
import { vocabFocusSets } from '../data/vocabFocusSets'
import { kanjiLabEntries, type KanjiLabEntry } from '../lib/kanjiLabCatalog'
import type { JlptLevel } from '../lib/types'
import { SpeakableCue, SpeakableWord, useSpeakable } from './SpeakableWord'
import { spokenTextForCard, spokenTextForWord } from '../lib/spokenText'
import { loadKanjiNotes, saveKanjiNotes, setKanjiNote, type KanjiNotes } from '../lib/kanjiNotes'
import { AppBackButton, AppDashboardButton } from './AppBackButton'

interface KanjiLabProps {
  onBack: () => void
  onDashboard?: () => void
  questId?: string
  onQuestComplete?: () => void
}

const levels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const retryDistance = 5
type KanjiStudyMode = 'paths' | 'levels'
type KanjiCompoundLength = 1 | 2 | 3 | 4
type PathStudyTarget = 'words' | 'kanji'
const KANJI_CHARACTER_RE = /[\u3400-\u4DBF\u4E00-\u9FFF]/u
const LEARNER_READING_OVERRIDES: Readonly<Record<string, { on: string[]; kun: string[] }>> = {
  '悪': { on: ['アク', 'オ'], kun: ['わるい'] },
}

function readingSoundKey(reading: string) {
  return [...reading.normalize('NFKC')]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint >= 0x30a1 && codePoint <= 0x30f6
        ? String.fromCodePoint(codePoint - 0x60)
        : character
    })
    .join('')
}

function uniqueCharacterReadings(readings?: { on: string[]; kun: string[] }) {
  const seen = new Set<string>()
  const unique = (items: string[]) => items.filter((reading) => {
    const key = readingSoundKey(reading)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    on: unique(readings?.on ?? []),
    kun: unique(readings?.kun ?? []),
  }
}

function exampleDisplayWord(word: string, character: string) {
  const variants = word.split(/[/／]/).map((variant) => variant.trim()).filter(Boolean)
  return variants.find((variant) => variant.includes(character)) ?? variants[0] ?? word
}

/** The example card itself is the listen target.
 *
 *  Nothing may be inserted into this subtree: the furigana is placed by
 *  direct-child selectors, the spans are matched with :first-child and
 *  :last-child, and the card is a fixed three-row grid. So the existing
 *  element takes the handlers, and the cue is positioned out of flow. */
function SpeakableExample({ text, children }: { text: string; children: React.ReactNode }) {
  const speak = useSpeakable(text)
  return (
    <div
      className={`quest-kanji-expanded-example${speak.live ? ' is-speakable' : ''}${speak.isSpeaking ? ' is-speaking' : ''}`}
      {...speak.triggerProps}
    >
      {children}
      {speak.live && <SpeakableCue className="speakable-cue-corner" />}
    </div>
  )
}

function QuestExampleWord({ word, character, reading }: { word: string; character: string; reading: string }) {
  const displayWord = exampleDisplayWord(word, character)
  const characters = [...displayWord]
  const anchorIndex = characters.indexOf(character)
  const characterReadings = questWordCharacterReadings(displayWord, reading)

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

function exampleWordFitUnits(word: string, character: string) {
  const characters = [...word]
  const anchorIndex = Math.max(0, characters.indexOf(character))
  const longestSide = Math.max(anchorIndex, characters.length - anchorIndex - 1)

  return longestSide * 2 + 1
}

function paginateExamples(examples: readonly KanjiLabEntry[]) {
  const pages: KanjiLabEntry[][] = []
  const remaining = [...examples]
  const columnSpan = (example: KanjiLabEntry) => {
    const fitUnits = exampleWordFitUnits(exampleDisplayWord(example.example.word, example.character), example.character)
    if (fitUnits <= 5) return 1
    if (fitUnits <= 7) return 2
    return 3
  }

  while (remaining.length) {
    const page: KanjiLabEntry[] = []
    let availableColumns = 3

    while (page.length < 3) {
      const nextIndex = remaining.findIndex((example) => columnSpan(example) <= availableColumns)
      if (nextIndex < 0) break
      const [nextExample] = remaining.splice(nextIndex, 1)
      page.push(nextExample)
      availableColumns -= columnSpan(nextExample)
    }

    pages.push(page)
  }

  return pages
}

function uniqueExampleWords(examples: readonly KanjiLabEntry[], character: string) {
  const seenWords = new Set<string>()
  return examples.filter((example) => {
    const word = exampleDisplayWord(example.example.word, character).trim()
    if (!word || seenWords.has(word)) return false
    seenWords.add(word)
    return true
  })
}

/**
 * Round-robin the examples across every kanji in the prompt so a two-kanji word
 * such as 感動 shows a 動 word before it spends a second slot on 感.
 */
function interleaveExamplesByCharacter(
  source: readonly KanjiLabEntry[],
  characters: readonly string[],
  keepExample: (candidate: KanjiLabEntry) => boolean,
) {
  const byCharacter = characters.map((character) => uniqueExampleWords(
    source.filter((candidate) => candidate.character === character && keepExample(candidate)),
    character,
  ))
  const deepestList = Math.max(0, ...byCharacter.map((examples) => examples.length))
  const seenWords = new Set<string>()
  const mixed: KanjiLabEntry[] = []

  for (let rank = 0; rank < deepestList; rank += 1) {
    for (const examples of byCharacter) {
      const example = examples[rank]
      if (!example || seenWords.has(example.example.word)) continue
      seenWords.add(example.example.word)
      mixed.push(example)
    }
  }

  return mixed
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
  const voicedVariants = [reading, ...(voicedInitials[firstCharacter] ?? []).map((initial) => initial + reading.slice(1))]

  return [...new Set(voicedVariants.flatMap((variant) => (
    ['つ', 'ち', 'く', 'き'].includes(variant.at(-1) ?? '')
      ? [variant, `${variant.slice(0, -1)}っ`]
      : [variant]
  )))]
}

function questWordCharacterReadings(word: string, reading: string) {
  const characters = [...word]
  const spoken = normalizeKanaReading(reading)
  const memo = new Map<string, string[] | null>()
  const keepKanjiReadingsOnly = (readings: string[]) => characters.map((character, index) => (
    KANJI_CHARACTER_RE.test(character) ? readings[index] ?? '' : ''
  ))

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

    const minimumRemainingLength = characters.slice(wordIndex + 1).reduce((total, nextCharacter) => (
      total + (KANJI_CHARACTER_RE.test(nextCharacter) ? 1 : normalizeKanaReading(nextCharacter).length)
    ), 0)
    const maximumIrregularLength = spoken.length - readingIndex - minimumRemainingLength
    for (let irregularLength = 1; irregularLength <= maximumIrregularLength; irregularLength += 1) {
      const tail = splitReading(wordIndex + 1, readingIndex + irregularLength)
      if (!tail) continue
      const result = [spoken.slice(readingIndex, readingIndex + irregularLength), ...tail]
      memo.set(memoKey, result)
      return result
    }

    memo.set(memoKey, null)
    return null
  }

  const segmented = splitReading(0, 0)
  if (segmented) return keepKanjiReadingsOnly(segmented)

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
  if (segmentedFromEnd) return keepKanjiReadingsOnly(segmentedFromEnd)

  return characters.map((character) => {
    if (!KANJI_CHARACTER_RE.test(character)) return ''
    const dictionaryEntry = kanjiReadings[character]
    return [...(dictionaryEntry?.on ?? []), ...(dictionaryEntry?.kun ?? [])]
      .map(normalizeKanaReading)
      .find((candidate) => candidate && spoken.includes(candidate)) ?? ''
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

function kanjiCount(word: string) {
  return [...word].filter((character) => KANJI_CHARACTER_RE.test(character)).length
}

function compoundEntries(source: readonly KanjiLabEntry[], length: Exclude<KanjiCompoundLength, 1>) {
  const words = new Set<string>()
  return shuffled(source).flatMap((entry) => {
    if (kanjiCount(entry.example.word) !== length || words.has(entry.example.word)) return []
    words.add(entry.example.word)
    return [{
      ...entry,
      card: {
        ...entry.card,
        id: `kanji-compound-${length}-${entry.card.id}-${entry.example.word}`,
        front: entry.example.word,
        reading: entry.example.reading,
        back: entry.example.meaning,
      },
    }]
  })
}

function pathWordEntries(path: KanjiFocusSet) {
  const vocabulary = vocabFocusSets.find((set) => set.id === path.id)
  if (!vocabulary) return []

  return shuffled(vocabulary.cards).flatMap((word) => {
    const source = kanjiLabEntries.find((entry) => entry.example.word === word.front)
      ?? [...word.front]
        .map((character) => kanjiLabEntries.find((entry) => entry.character === character))
        .find(Boolean)
    if (!source) return []
    const reading = word.reading ?? source.example.reading
    return [{
      ...source,
      card: {
        ...source.card,
        id: `kanji-path-word-${path.id}-${word.id}`,
        front: word.front,
        reading,
        back: word.back,
      },
      example: { word: word.front, reading, meaning: word.back },
    }]
  })
}

function pathKanjiEntries(path: KanjiFocusSet) {
  const vocabulary = vocabFocusSets.find((set) => set.id === path.id)
  if (!vocabulary) return []
  const pathCharacters = new Set(path.characters)

  return vocabulary.cards.flatMap((word) => [...new Set([...word.front].filter((character) => pathCharacters.has(character)))].flatMap((character) => {
    const source = kanjiLabEntries.find((entry) => entry.character === character)
    if (!source) return []
    const reading = word.reading ?? source.example.reading
    return [{
      ...source,
      character,
      card: {
        ...source.card,
        id: `kanji-path-character-${path.id}-${word.id}-${character}`,
        front: character,
      },
      example: { word: word.front, reading, meaning: word.back },
    }]
  }))
}

function levelHasCompoundLength(level: JlptLevel, length: KanjiCompoundLength) {
  if (length === 1) return true
  return kanjiLabEntries.some((entry) => entry.card.jlpt === level && kanjiCount(entry.example.word) === length)
}

function entriesForPath(path: KanjiFocusSet, target: PathStudyTarget) {
  return target === 'kanji' ? uniqueKanjiOrder(pathKanjiEntries(path)) : pathWordEntries(path)
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

export function KanjiLab({ onBack, onDashboard, questId, onQuestComplete }: KanjiLabProps) {
  const quest = getQuestById(questId)
  const questEntries = useMemo(() => entriesForQuest(questId), [questId])
  const questMode = Boolean(quest && questEntries.length)
  const [mode, setMode] = useState<KanjiStudyMode>('paths')
  const [compoundLength, setCompoundLength] = useState<KanjiCompoundLength>(1)
  const [path, setPath] = useState(() => shuffled(kanjiFocusSets)[0]!)
  const [pathStudyTarget, setPathStudyTarget] = useState<PathStudyTarget>('words')
  const [level, setLevel] = useState<JlptLevel>('N5')
  const [openTopPicker, setOpenTopPicker] = useState<'path' | 'level' | null>(null)
  const [entries, setEntries] = useState(() => questEntries.length ? questEntries : entriesForPath(path, 'words'))
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [furiganaVisible, setFuriganaVisible] = useState(true)
  const [englishVisible, setEnglishVisible] = useState(true)
  const [notes, setNotes] = useState<KanjiNotes>(loadKanjiNotes)
  const [notesOpen, setNotesOpen] = useState(false)
  const [exampleOffset, setExampleOffset] = useState(0)
  const [completed, setCompleted] = useState(false)
  const entry = entries[index % entries.length]
  const card = entry?.card
  // Quest cards are vocabulary words, so they read like the word deck.
  const wordDeckMode = questMode || (mode === 'paths' ? pathStudyTarget === 'words' : compoundLength > 1)
  const characterReadings = !questMode && !wordDeckMode && entry
    ? LEARNER_READING_OVERRIDES[entry.character] ?? kanjiReadings[entry.character]
    : undefined
  const displayedCharacterReadings = uniqueCharacterReadings(characterReadings)
  const noteSubject = card?.front ?? ''
  const noteText = notes[noteSubject]?.text ?? ''

  function writeNote(text: string) {
    if (!entry || !noteSubject) return
    const next = setKanjiNote(notes, {
      subject: noteSubject,
      character: entry.character,
      reading: wordDeckMode ? entry.example.reading : undefined,
    }, text)
    setNotes(next)
    saveKanjiNotes(next)
  }
  const mainMeaning = wordDeckMode
    ? entry?.example.meaning.split(';')[0]?.trim() ?? ''
    : entry?.isCurated || (mode === 'paths' && pathStudyTarget === 'kanji')
      ? entry.card.back.split(';')[0]?.trim() ?? ''
      : ''
  const allExamples = useMemo(() => {
    if (!entry) return []
    const isDifferentFromMainWord = (candidate: KanjiLabEntry) => candidate.example.word !== entry.card.front
    if (mode === 'paths' && pathStudyTarget === 'kanji') {
      return uniqueExampleWords(pathKanjiEntries(path).filter((candidate) => candidate.character === entry.character && isDifferentFromMainWord(candidate)), entry.character)
    }
    // A word deck anchors on every kanji in the prompt, so 感動 can offer a 動
    // word instead of filling all three slots with 感 words.
    const promptKanji = [...new Set([...entry.card.front].filter((character) => KANJI_CHARACTER_RE.test(character)))]
    const anchors = wordDeckMode && promptKanji.length ? promptKanji : [entry.character]
    return interleaveExamplesByCharacter(kanjiLabEntries, anchors, isDifferentFromMainWord)
  }, [entry, mode, path, pathStudyTarget, wordDeckMode])
  const examplePages = useMemo(() => {
    if (!entry || !allExamples.length) return []
    const currentExample = allExamples.findIndex((candidate) => candidate.example.word === entry.example.word)
    const start = currentExample < 0 ? 0 : currentExample
    const orderedExamples = [...allExamples.slice(start), ...allExamples.slice(0, start)]
    return paginateExamples(orderedExamples)
  }, [allExamples, entry])
  const relatedExamples = examplePages[exampleOffset % examplePages.length] ?? []
  const hasMoreExamples = examplePages.length > 1
  const longestRelatedExampleIndex = entry && relatedExamples.length === 3
    ? relatedExamples.reduce((longestIndex, example, exampleIndex) => {
      const longest = relatedExamples[longestIndex]!
      const exampleLength = [...exampleDisplayWord(example.example.word, example.character)].length
      const longestLength = [...exampleDisplayWord(longest.example.word, longest.character)].length
      return exampleLength > longestLength ? exampleIndex : longestIndex
    }, 0)
    : -1

  function chooseLevel(nextLevel: JlptLevel) {
    setMode('levels')
    setLevel(nextLevel)
    const levelEntries = kanjiLabEntries.filter((entry) => entry.card.jlpt === nextLevel)
    const nextLength = levelHasCompoundLength(nextLevel, compoundLength) ? compoundLength : 1
    const nextEntries = nextLength === 1
      ? uniqueKanjiOrder(levelEntries)
      : compoundEntries(levelEntries, nextLength)
    setCompoundLength(nextLength)
    setEntries(nextEntries)
    setIndex(0)
    setRevealed(false)
    setExampleOffset(0)
  }

  function choosePath(nextPath: KanjiFocusSet) {
    setMode('paths')
    setPath(nextPath)
    setCompoundLength(1)
    setEntries(entriesForPath(nextPath, pathStudyTarget))
    setIndex(0)
    setRevealed(false)
    setExampleOffset(0)
  }

  function choosePathStudyTarget(nextTarget: PathStudyTarget) {
    setPathStudyTarget(nextTarget)
    setEntries(entriesForPath(path, nextTarget))
    setIndex(0)
    setRevealed(false)
    setExampleOffset(0)
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

  function chooseCompoundLength(nextLength: KanjiCompoundLength) {
    const isAvailable = levelHasCompoundLength(level, nextLength)
    if (!isAvailable) return
    setCompoundLength(nextLength)
    const levelEntries = kanjiLabEntries.filter((candidate) => candidate.card.jlpt === level)
    const nextEntries = nextLength === 1
      ? uniqueKanjiOrder(levelEntries)
      : compoundEntries(levelEntries, nextLength)
    setEntries(nextEntries)
    setIndex(0)
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

  function compoundLengthPicker() {
    return (
      <div className="kanji-compound-length-tabs" role="group" aria-label="Kanji per word">
        <span>Kanji per word</span>
        {[1, 2, 3, 4].map((length) => {
          const nextLength = length as KanjiCompoundLength
          const isAvailable = levelHasCompoundLength(level, nextLength)
          return (
            <button
              key={length}
              type="button"
              className={compoundLength === length ? 'active' : ''}
              aria-pressed={compoundLength === length}
              disabled={!isAvailable}
              onClick={() => chooseCompoundLength(nextLength)}
            >
              {length}
            </button>
          )
        })}
      </div>
    )
  }

  if (!card || !entry) return null

  if (questMode && completed) {
    return (
      <div className="grammar-practice-view kanji-lab kanji-lab-paths">
        <div className="study-top grammar-study-top"><button type="button" className="vocab-back-arrow" onClick={previousCard} aria-label="Previous kanji" title="Previous kanji"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>{onDashboard && <button type="button" className="btn btn-ghost" onClick={onDashboard}>Dashboard</button>}</div>
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
    <div className="grammar-practice-view kanji-lab kanji-lab-paths standard-kanji-study">
      <div className="study-top grammar-study-top">
        <div className="app-nav-actions">
          <AppBackButton
            onClick={onBack}
            aria-label={questMode ? 'Back to Quest' : 'Back to Study Tools'}
          />
          {onDashboard && <AppDashboardButton onClick={onDashboard} />}
        </div>
        <span className="study-progress">{index + 1} / {entries.length}</span>
        {/* A quest fixes its own deck, so the path and level pickers would be
            levers that quietly abandon the quest. It gets an identity badge
            in their place. */}
        {questMode ? (
          <span className="study-type-badge"><span>Quest Kanji</span><span className="jlpt-badge">{quest?.level}</span></span>
        ) : (
        <div
          className="standard-kanji-top-modes standard-kanji-top-selectors"
          aria-label="Kanji study selection"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpenTopPicker(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpenTopPicker(null)
          }}
        >
          <div className="standard-kanji-top-picker is-path">
            <button
              type="button"
              className={`standard-kanji-top-picker-trigger${mode === 'paths' ? ' active' : ''}`}
              aria-haspopup="menu"
              aria-expanded={openTopPicker === 'path'}
              onClick={() => setOpenTopPicker((current) => current === 'path' ? null : 'path')}
            >
              <span>Path</span>
              <strong><span className="standard-kanji-path-symbol" aria-hidden="true">{path.symbol}</span><span>{path.title}</span></strong>
            </button>
            {openTopPicker === 'path' && (
              <div className="standard-kanji-top-menu path-menu" role="menu" aria-label="Choose a Kanji path">
                {kanjiFocusSets.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={candidate.id === path.id}
                    className={candidate.id === path.id ? 'is-selected' : ''}
                    onClick={() => { choosePath(candidate); setOpenTopPicker(null) }}
                  >
                    <span className="standard-kanji-path-symbol" aria-hidden="true">{candidate.symbol}</span>
                    <span>{candidate.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="standard-kanji-top-picker is-level">
            <button
              type="button"
              className={`standard-kanji-top-picker-trigger${mode === 'levels' ? ' active' : ''}`}
              aria-haspopup="menu"
              aria-expanded={openTopPicker === 'level'}
              onClick={() => setOpenTopPicker((current) => current === 'level' ? null : 'level')}
            >
              <span>JLPT</span>
              <strong>{level}</strong>
            </button>
            {openTopPicker === 'level' && (
              <div className="standard-kanji-top-menu level-menu" role="menu" aria-label="Choose a JLPT level">
                {levels.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="menuitemradio"
                    aria-checked={mode === 'levels' && item === level}
                    className={mode === 'levels' && item === level ? 'is-selected' : ''}
                    onClick={() => { chooseLevel(item); setOpenTopPicker(null) }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
      </div>
      <div className="study-progress-bar">
        <div className="study-progress-fill" style={{ width: ((index + 1) / entries.length) * 100 + '%' }} />
      </div>

      <section className="kanji-study-navigation kanji-armory-navigation standard-kanji-navigation">
        {questMode ? (
          <div className="kanji-path-heading">
            <span className="kanji-armory-mark" aria-hidden="true">漢</span>
            <div><span>QUEST KANJI</span><h2>{quest?.title}</h2><p>{quest?.vocabularyTheme} — only the kanji from this quest’s vocabulary.</p></div>
          </div>
        ) : (<>
        {mode === 'paths' ? (
          <div className="kanji-path-heading">
            <span className="kanji-armory-mark" aria-hidden="true">{path.symbol}</span>
            <div>
              <h2>{path.title}</h2>
              <p>{path.description}</p>
            </div>
            <div className="kanji-compound-length-tabs kanji-path-study-tabs" role="group" aria-label="Path study mode">
              <span>Study</span>
              <button type="button" className={pathStudyTarget === 'words' ? 'active' : ''} aria-pressed={pathStudyTarget === 'words'} onClick={() => choosePathStudyTarget('words')}>Words</button>
              <button type="button" className={pathStudyTarget === 'kanji' ? 'active' : ''} aria-pressed={pathStudyTarget === 'kanji'} onClick={() => choosePathStudyTarget('kanji')}>Kanji</button>
            </div>
          </div>
        ) : (<>
          <div className="kanji-path-heading kanji-level-heading">
            <span className="kanji-armory-mark" aria-hidden="true">{String.fromCodePoint(0x6f22)}</span>
            <div>
              <h2>{level} Kanji</h2>
              <p>Study kanji grouped by Japanese Language Proficiency Test level.</p>
            </div>
            {compoundLengthPicker()}
          </div>
        </>)}</>)}
      </section>

      <main className={'grammar-choice-card kanji-learning-card standard-kanji-card main-word-length-' + Math.min([...card.front].length, 4) + (revealed ? ' is-revealed' : '') + (hasMoreExamples ? ' has-more-examples' : '')}>
        <div className="kanji-learning-meta">
          {hasMoreExamples && (
            <button
              type="button"
              className="btn btn-ghost kanji-learning-more-examples"
              onClick={() => setExampleOffset((offset) => (offset + 1) % examplePages.length)}
            >
              More examples
            </button>
          )}
        </div>
        <div className="standard-kanji-prompt">
          <p className={'kanji-learning-character-reading standard-kanji-main-reading' + (!wordDeckMode && revealed && furiganaVisible ? ' is-revealed' : '')} lang="ja" aria-hidden={wordDeckMode || !revealed || !furiganaVisible}>
            {!wordDeckMode && (<>
              {displayedCharacterReadings.on.length ? <span>{displayedCharacterReadings.on.join('・')}</span> : null}
              {displayedCharacterReadings.kun.length ? <span>{displayedCharacterReadings.kun.join('・')}</span> : null}
            </>)}
          </p>
          {/* Speak the kana, not the written form: it is unambiguous, and it
              matches the string generate-audio.ts pre-renders, so a
              pre-rendered clip is actually found. A lone kanji has no single
              reading, so the kanji deck speaks its example word instead. */}
          <p className={`kanji-learning-character${wordDeckMode ? ' standard-kanji-compound-word' : ''}${revealed && furiganaVisible ? ' is-furigana-visible' : ''}`} lang="ja">
            <SpeakableWord text={wordDeckMode ? spokenTextForCard(card) : (entry.example.reading || entry.example.word)}>
              {wordDeckMode ? <QuestMainWord word={card.front} reading={entry.example.reading} /> : card.front}
            </SpeakableWord>
          </p>
          <div className="kanji-learning-divider" aria-hidden="true" />
          <div className={`quest-kanji-word-answer standard-kanji-main-meaning${revealed && englishVisible && mainMeaning ? ' is-revealed' : ''}`} aria-hidden={!revealed || !englishVisible || !mainMeaning}>
            {mainMeaning && <span>{mainMeaning}</span>}
          </div>
        </div>

        <div className="kanji-learning-answer standard-kanji-answer">
          <div className={`quest-kanji-parts standard-kanji-parts part-count-${relatedExamples.length}${relatedExamples.length === 1 ? ' is-single' : ''}${revealed ? ' is-revealed' : ''}${furiganaVisible ? ' is-furigana-visible' : ''}${englishVisible ? ' is-english-visible' : ''}`}>
            {relatedExamples.map((example, exampleIndex) => {
              const wordLength = [...exampleDisplayWord(example.example.word, example.character)].length
              return (
                <article className={exampleIndex === longestRelatedExampleIndex ? 'is-longest-example' : undefined} key={example.character + example.example.word}>
                  <div className="quest-kanji-expanded-examples example-count-1">
                    <SpeakableExample text={spokenTextForWord(example.example.word, example.example.reading)}>
                      <div
                        className={`quest-kanji-expanded-word word-length-${Math.min(wordLength, 5)}`}
                        lang="ja"
                      >
                        <QuestExampleWord word={example.example.word} character={example.character} reading={example.example.reading} />
                      </div>
                      <em className="quest-kanji-expanded-meaning">{example.example.meaning.split(';')[0]}</em>
                    </SpeakableExample>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
        {notesOpen && (
          <div className="kanji-note-panel" role="group" aria-label={`Notes on ${noteSubject}`}>
            <div className="kanji-note-panel-top">
              <strong lang="ja">{noteSubject}</strong>
              <button type="button" className="btn btn-ghost kanji-note-done" onClick={() => setNotesOpen(false)}>Done</button>
            </div>
            <textarea
              className="kanji-note-input"
              value={noteText}
              onChange={(event) => writeNote(event.target.value)}
              placeholder="What do you want to remember about this one?"
              rows={4}
              autoFocus
            />
            <small className="kanji-note-hint">Saved on this device as you type.</small>
          </div>
        )}

        <div className="kanji-learning-controls standard-kanji-controls">
          <div className="standard-kanji-utility-row">
            <div className="standard-kanji-dashboard-toggles control-group control-group-primary-options" role="group" aria-label="Display options">
              <button
                type="button"
                className={`control-chip control-chip-compact app-display-toggle${furiganaVisible ? ' is-active' : ''}`}
                aria-pressed={furiganaVisible}
                aria-label="Toggle furigana"
                title="Furigana"
                onClick={() => setFuriganaVisible((isVisible) => !isVisible)}
              >
                ふり
              </button>
              <button
                type="button"
                className={`control-chip control-chip-compact app-display-toggle${englishVisible ? ' is-active' : ''}`}
                aria-pressed={englishVisible}
                aria-label="Toggle English translation"
                title="English"
                onClick={() => setEnglishVisible((isVisible) => !isVisible)}
              >
                EN
              </button>
              {/* Thoughts land against whatever is on the card, written where
                  they occur rather than kept until somewhere to file them. */}
              <button
                type="button"
                className={`control-chip control-chip-compact app-display-toggle kanji-note-toggle${noteText ? ' has-note' : ''}${notesOpen ? ' is-active' : ''}`}
                aria-pressed={notesOpen}
                aria-label={noteText ? `Edit your note on ${noteSubject}` : `Write a note on ${noteSubject}`}
                title="Notes"
                onClick={() => setNotesOpen((isOpen) => !isOpen)}
              >
                Notes
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary kanji-learning-reveal"
              onClick={() => setRevealed((isRevealed) => !isRevealed)}
            >
              {revealed ? 'Hide examples' : 'Show examples'}
            </button>
          </div>
          <div className="standard-kanji-action-row">
            <button type="button" className="btn btn-ghost standard-kanji-review" onClick={previousCard} disabled={index === 0}>Previous word</button>
            <button type="button" className="btn kanji-learning-easy" onClick={() => nextCard(true)}>Next word</button>
          </div>
        </div>
      </main>
    </div>
  )
}
