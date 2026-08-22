import { pictureVocabulary } from '../src/data/pictureVocabulary.ts'

const SELECTABLE_LENGTHS = [1, 2, 3, 4] as const
const MIN_POOL_SIZE = 12
const HIRAGANA_RE = /^[ぁ-ゖー]+$/u
const KANJI_RE = /^\p{Script=Han}+$/u

type PictureMode = 'kana' | 'kanji'

interface SelectablePrompt {
  answer: string
  image: string
  meaning: string
}

const errors: string[] = []

function duplicates(values: readonly string[]) {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated]
}

function buildPool(mode: PictureMode, length: number): SelectablePrompt[] {
  return pictureVocabulary.flatMap((entry) => {
    const answer = mode === 'kana' ? entry.kana : entry.kanji
    if (!answer || [...answer].length !== length) return []
    return [{ answer, image: entry.image, meaning: entry.meaning }]
  })
}

for (const [index, entry] of pictureVocabulary.entries()) {
  const label = `Entry ${index + 1} (${entry.kana || 'missing kana'})`
  if (!entry.kana.trim()) errors.push(`${label}: kana is required.`)
  if (!HIRAGANA_RE.test(entry.kana)) errors.push(`${label}: kana must contain only hiragana or the long-vowel mark.`)
  if (entry.kanji && !KANJI_RE.test(entry.kanji)) errors.push(`${label}: kanji must contain only kanji characters.`)
  if (!entry.meaning.trim()) errors.push(`${label}: meaning is required.`)
  if (!entry.image.trim()) errors.push(`${label}: image is required.`)

  const kanaSelectable = SELECTABLE_LENGTHS.includes([...entry.kana].length as 1 | 2 | 3 | 4)
  const kanjiSelectable = entry.kanji
    ? SELECTABLE_LENGTHS.includes([...entry.kanji].length as 1 | 2 | 3 | 4)
    : false
  if (!kanaSelectable && !kanjiSelectable) {
    errors.push(`${label}: entry cannot appear in any 1-4 character pool.`)
  }
}

const duplicateKana = duplicates(pictureVocabulary.map((entry) => entry.kana))
if (duplicateKana.length) errors.push(`Duplicate kana answers: ${duplicateKana.join(', ')}`)

const duplicateKanji = duplicates(pictureVocabulary.flatMap((entry) => entry.kanji ? [entry.kanji] : []))
if (duplicateKanji.length) errors.push(`Duplicate kanji answers: ${duplicateKanji.join(', ')}`)

const summary: Array<{ mode: PictureMode, length: number, prompts: number }> = []

for (const mode of ['kana', 'kanji'] as const) {
  for (const length of SELECTABLE_LENGTHS) {
    const pool = buildPool(mode, length)
    summary.push({ mode, length, prompts: pool.length })

    if (pool.length < MIN_POOL_SIZE) {
      errors.push(`${mode} ${length}: ${pool.length} prompts; at least ${MIN_POOL_SIZE} are required.`)
    }

    const repeatedAnswers = duplicates(pool.map((prompt) => prompt.answer))
    if (repeatedAnswers.length) {
      errors.push(`${mode} ${length}: duplicate answers ${repeatedAnswers.join(', ')}`)
    }

    const repeatedImages = duplicates(pool.map((prompt) => prompt.image))
    if (repeatedImages.length) {
      errors.push(`${mode} ${length}: duplicate images ${repeatedImages.join(', ')}`)
    }
  }
}

console.table(summary)
console.log(`Validated ${pictureVocabulary.length} picture vocabulary entries.`)

if (errors.length) {
  console.error('\nPicture vocabulary validation failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('Picture vocabulary validation passed.')
}
