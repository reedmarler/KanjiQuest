const KANJI_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]/

export function hasKanji(text: string): boolean {
  return KANJI_RE.test(text)
}

type TextRun = { kanji: boolean; text: string }

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
      if (remaining.startsWith(run.text)) {
        remaining = remaining.slice(run.text.length)
      }
      continue
    }

    const nextLiteral = runs.slice(i + 1).find((r) => !r.kanji)
    let kanjiReading: string

    if (nextLiteral && remaining.includes(nextLiteral.text)) {
      const pos = remaining.indexOf(nextLiteral.text)
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

/** Renders text with furigana above kanji only — kana and punctuation stay plain. */
export function FuriganaSegment({ text, reading, className = '' }: FuriganaSegmentProps) {
  if (!reading || !hasKanji(text)) {
    return <span className={className}>{text}</span>
  }

  const runs = splitRuns(text)
  const kanjiReadings = kanjiReadingsForRuns(runs, reading)

  return (
    <span className={className}>
      {runs.map((run, i) => renderKanjiRun(run, i, kanjiReadings.get(i)))}
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

export function filledGapParts(sentence: string, gapWord: string): [string, string, string] {
  const [before, after = ''] = sentence.split('___')
  return [before, gapWord, after]
}
