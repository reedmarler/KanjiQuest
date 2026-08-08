const KANJI_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]/

export function hasKanji(text: string): boolean {
  return KANJI_RE.test(text)
}

type TextRun = { kanji: boolean; text: string }

function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (character) =>
    String.fromCodePoint(character.codePointAt(0)! - 0x60),
  )
}

function matchingKanaRunLength(remaining: string, text: string, start = 0): number | null {
  const normalizedRemaining = katakanaToHiragana(remaining)
  const normalizedText = katakanaToHiragana(text)
  if (start + normalizedText.length > normalizedRemaining.length) return null

  for (let index = 0; index < normalizedText.length; index += 1) {
    const written = normalizedText[index]
    const spoken = normalizedRemaining[start + index]
    const isParticlePronunciation = (written === 'は' && spoken === 'わ')
      || (written === 'へ' && spoken === 'え')
    if (written !== spoken && !isParticlePronunciation) return null
  }

  return normalizedText.length
}

/**
 * Finds where the next literal kana run starts within `remaining`. The search
 * starts at index 1, not 0: this is only ever called to locate the literal
 * that follows a kanji run, and a kanji run always contributes at least one
 * kana of its own reading — starting at 0 lets a stray は/わ (or へ/え) match
 * inside the kanji's own reading and swallow it, e.g. 私 (わたし) followed by
 * は matching the わ in わたし itself instead of the real particle after it.
 */
function kanaRunIndex(remaining: string, text: string): number {
  const normalizedRemaining = katakanaToHiragana(remaining)
  for (let index = 1; index < normalizedRemaining.length; index += 1) {
    if (matchingKanaRunLength(remaining, text, index) !== null) return index
  }
  return -1
}

function splitRuns(text: string): TextRun[] {
  if (!text) return []

  const runs: TextRun[] = []
  let current = ''
  let isKanji: boolean | null = null

  for (const ch of text) {
    const k = KANJI_RE.test(ch)
    if (isKanji === null) {
      isKanji = k
      current = ch
    } else if (k === isKanji) {
      current += ch
    } else {
      runs.push({ kanji: isKanji, text: current })
      isKanji = k
      current = ch
    }
  }

  runs.push({ kanji: isKanji!, text: current })
  return runs
}

/** Map each kanji run index to the kana reading that belongs above it only. */
function kanjiReadingsForRuns(runs: TextRun[], reading: string): Map<number, string> {
  const result = new Map<number, string>()
  let remaining = reading

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]

    if (!run.kanji) {
      const literalLength = matchingKanaRunLength(remaining, run.text)
      if (literalLength !== null) {
        remaining = remaining.slice(literalLength)
      }
      continue
    }

    const nextLiteral = runs.slice(i + 1).find((r) => !r.kanji)
    let kanjiReading: string

    const pos = nextLiteral ? kanaRunIndex(remaining, nextLiteral.text) : -1
    if (pos >= 0) {
      kanjiReading = remaining.slice(0, pos)
      remaining = remaining.slice(pos)
    } else {
      kanjiReading = remaining
      remaining = ''
    }

    result.set(i, kanjiReading)
  }

  return result
}

interface FuriganaSegmentProps {
  text: string
  reading?: string
  className?: string
}

export interface FuriganaRun {
  text: string
  reading?: string
}

/** Returns the same kanji-to-reading runs that the visible ruby renderer uses. */
export function getFuriganaRuns(text: string, reading?: string): FuriganaRun[] {
  if (!reading || !hasKanji(text)) return [{ text }]

  const runs = splitRuns(text)
  const kanjiReadings = kanjiReadingsForRuns(runs, reading)
  return runs.map((run, index) => ({
    text: run.text,
    reading: run.kanji ? kanjiReadings.get(index) : undefined,
  }))
}

/** Renders text with furigana above kanji only — kana and punctuation stay plain. */
export function FuriganaSegment({ text, reading, className = '' }: FuriganaSegmentProps) {
  return (
    <span className={className}>
      {getFuriganaRuns(text, reading).map((run, index) =>
        renderKanjiRun({ kanji: hasKanji(run.text), text: run.text }, index, run.reading),
      )}
    </span>
  )
}

function renderKanjiRun(run: TextRun, i: number, kanjiReading?: string) {
  if (!run.kanji) {
    return <span key={`${run.text}-${i}`}>{run.text}</span>
  }

  if (!kanjiReading) {
    return <span key={`${run.text}-${i}`}>{run.text}</span>
  }

  return (
    <ruby key={`${run.text}-${i}`} className="furigana-ruby">
      {run.text}
      <rt>{kanjiReading}</rt>
    </ruby>
  )
}

interface FuriganaGlossSegmentProps {
  text: string
  reading?: string
  meaning?: string
  className?: string
}

/** Furigana above kanji with an English gloss centered below kanji segments. */
export function FuriganaGlossSegment({
  text,
  reading,
  meaning,
  className = '',
}: FuriganaGlossSegmentProps) {
  if (!text) return null

  const showGloss = Boolean(meaning?.trim())

  if (!reading || !hasKanji(text)) {
    if (!showGloss) {
      return <span className={className}>{text}</span>
    }

    return (
      <span className={`gloss-segment ${className}`.trim()}>
        <span className="gloss-segment-jp">{text}</span>
        <span className="gloss-segment-en">{meaning}</span>
      </span>
    )
  }

  const runs = splitRuns(text)
  const kanjiReadings = kanjiReadingsForRuns(runs, reading)

  return (
    <span className={`gloss-segment ${className}`.trim()}>
      <span className="gloss-segment-jp">
        {runs.map((run, i) => renderKanjiRun(run, i, kanjiReadings.get(i)))}
      </span>
      {showGloss && <span className="gloss-segment-en">{meaning}</span>}
    </span>
  )
}

interface FuriganaGlossSentenceProps {
  segments: string[]
  readings?: (string | undefined)[]
  meanings?: (string | undefined)[]
  className?: string
  segmentClassName?: string
}

/** Sentence with furigana above kanji and English glosses below kanji words. */
export function FuriganaGlossSentence({
  segments,
  readings,
  meanings,
  className = '',
  segmentClassName = '',
}: FuriganaGlossSentenceProps) {
  return (
    <span className={`furigana-gloss-sentence ${className}`.trim()}>
      {segments.map((seg, i) => (
        <FuriganaGlossSegment
          key={`${seg}-${i}`}
          text={seg}
          reading={readings?.[i]}
          meaning={meanings?.[i]}
          className={segmentClassName}
        />
      ))}
    </span>
  )
}

interface FuriganaSentenceProps {
  segments: string[]
  readings?: (string | undefined)[]
  className?: string
  segmentClassName?: string
}

/** Renders ordered segments as one sentence with per-word furigana. */
export function FuriganaSentence({
  segments,
  readings,
  className = '',
  segmentClassName = '',
}: FuriganaSentenceProps) {
  return (
    <span className={`furigana-sentence ${className}`.trim()}>
      {segments.map((seg, i) => (
        <FuriganaSegment
          key={`${seg}-${i}`}
          text={seg}
          reading={readings?.[i]}
          className={segmentClassName}
        />
      ))}
    </span>
  )
}

export function readingForSegment(
  word: string,
  segments: string[],
  readings?: string[],
): string | undefined {
  const index = segments.indexOf(word)
  if (index === -1 || !readings) return undefined
  return readings[index]
}
