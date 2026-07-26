/**
 * Shared machinery for fill-the-blank multiple-choice drills.
 *
 * Grammar Practice and Vocab Practice work identically — take a curated sentence,
 * blank out one segment, and offer four choices that all fit grammatically so the
 * English clue is what disambiguates them. Only the content differs, so the
 * derivation lives here and each data module supplies its own sentences.
 */

/** JLPT remains catalog metadata; learner-facing difficulty uses generation complexity. */
export type DrillJlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export const DRILL_LEVELS: readonly DrillJlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

/** A choice is either kana-only text or a [text, reading] pair for furigana. */
export type DrillOption = string | readonly [text: string, reading: string]

export interface DrillSource {
  id: string
  jlpt: DrillJlptLevel
  english: string
  segments: string[]
  readings: string[]
}

export interface DrillFocus {
  /** Which segment becomes the blank. */
  segmentIndex: number
  /** Short label for the pattern or word class being tested. */
  pattern: string
  meaning: string
  /** Text shown in place of the segment; must contain ___ for the blank. */
  replacement?: string
  /** Kana for everything in `replacement` except the ___ itself. */
  replacementReading?: string
  /** Overrides the answer when the blank is only part of the segment. */
  answer?: string
  /** Purposeful alternatives; without these, other sentences' answers are used. */
  options?: readonly DrillOption[]
}

export interface DrillExercise {
  id: string
  jlpt: DrillJlptLevel
  /** How much grammatical structure the underlying sentence coordinates. */
  complexity?: 1 | 2 | 3 | 4 | 5
  prompt: string
  /** Hiragana for `prompt`, split on the same ___ marker. */
  promptReading?: string
  /** Original sentence pieces on either side of the blank, for exact ruby placement. */
  promptFurigana?: {
    before: Array<{ text: string; reading?: string }>
    after: Array<{ text: string; reading?: string }>
  }
  answer: string
  answerReading?: string
  options: string[]
  /** Parallel to `options` — undefined entries have no kanji to gloss. */
  optionReadings: (string | undefined)[]
  english: string
  pattern: string
  meaning: string
  /** Which sentence slot the blank tests (e.g. 'subject', 'object') — lets the
   * session picker balance variety instead of drawing whichever slot happens
   * to dominate the pool. Undefined for exercise types that don't track it. */
  blankSlot?: string
}

interface Choice {
  text: string
  reading: string | undefined
}

/** Trailing 。 gives away that a choice ends the sentence, so answers never show it. */
export function stripTrailingPeriod(text: string): string {
  return text.replace(/。+$/u, '')
}

function rotate<T>(items: readonly T[], offset: number): T[] {
  const shift = items.length ? offset % items.length : 0
  return [...items.slice(shift), ...items.slice(0, shift)]
}

function toChoice(option: DrillOption): Choice {
  if (typeof option === 'string') return { text: stripTrailingPeriod(option), reading: undefined }
  return { text: stripTrailingPeriod(option[0]), reading: stripTrailingPeriod(option[1]) }
}

/** Build the playable drill set from curated sentences and their blanked segment. */
export function buildDrillExercises(
  sources: readonly { source: DrillSource; focus: DrillFocus }[],
): DrillExercise[] {
  return sources.map(({ source, focus }, index) => {
    const { segments, readings } = source
    const answer = stripTrailingPeriod(focus.answer ?? segments[focus.segmentIndex])

    const explicitChoices = focus.options?.map(toChoice)
    // A hand-written option list already carries the answer's reading; otherwise the
    // whole segment is the answer, so its own reading applies.
    const answerReading = focus.answer
      ? explicitChoices?.find((choice) => choice.text === answer)?.reading
      : stripTrailingPeriod(readings[focus.segmentIndex])

    // Without an explicit list, borrow other sentences' answers so the distractors
    // are always the same kind of thing being tested.
    const borrowedChoices = rotate(sources, index + 3)
      .map(({ source: other, focus: otherFocus }) => {
        const text = other.segments[otherFocus.segmentIndex]
        const reading = other.readings[otherFocus.segmentIndex]
        return {
          text: text ? stripTrailingPeriod(text) : '',
          reading: reading ? stripTrailingPeriod(reading) : undefined,
        }
      })
      .filter(
        (choice, choiceIndex, all) =>
          choice.text &&
          choice.text !== answer &&
          all.findIndex((other) => other.text === choice.text) === choiceIndex,
      )
      .slice(0, 3)

    const choices = explicitChoices
      ? rotate(explicitChoices, index)
      : rotate([{ text: answer, reading: answerReading }, ...borrowedChoices], index)

    const prompt = segments
      .map((segment, segmentIndex) =>
        segmentIndex === focus.segmentIndex ? focus.replacement ?? '___' : segment,
      )
      .join('')
    const promptReading = segments
      .map((segment, segmentIndex) => {
        if (segmentIndex !== focus.segmentIndex) return readings[segmentIndex] ?? segment
        return focus.replacement ? `${focus.replacementReading ?? ''}___` : '___'
      })
      .join('')

    return {
      id: source.id,
      jlpt: source.jlpt,
      prompt,
      promptReading,
      answer,
      answerReading,
      options: choices.map((choice) => choice.text),
      optionReadings: choices.map((choice) => choice.reading),
      english: source.english,
      pattern: focus.pattern,
      meaning: focus.meaning,
    }
  })
}
