/**
 * Pre-renders the app's fixed vocabulary audio into public/audio/.
 *
 * The hero sentence generator builds novel text at runtime, so its output can
 * never be pre-rendered. Everything else — vocab words, kanji example words —
 * is a known, finite list, and that list is what this script speaks once and
 * commits. The result ships as static files with the site: no TTS service has
 * to be running in production, and a metered provider is charged exactly once
 * per clip no matter how many people listen.
 *
 * Talks to the TTS service rather than a provider API directly, so the
 * provider credential stays server-side and whichever engine is configured
 * (local checkpoint or hosted clone) is what gets rendered.
 *
 * Usage:
 *   # with the TTS service running (see backend/tts_service/README.md)
 *   npm run generate:audio -- --scope=focus     # 342 focus-set words
 *   npm run generate:audio -- --scope=examples  # vocab example sentences only
 *   npm run generate:audio -- --scope=beginner  # beginner-zone quiz word bank only
 *   npm run generate:audio -- --scope=all       # every study card + example sentences (default)
 *   npm run generate:audio -- --dry-run         # count and price it, render nothing
 *   npm run generate:audio -- --redo-short      # re-cut already-rendered 1-2 char clips
 *
 * Re-running skips clips already on disk, so it is resumable and safe to run
 * again after adding content — only the new words are billed. --redo-short
 * is the one exception: combine it with a --scope to re-bill and overwrite
 * that scope's 1-2 character clips even though they already exist, for ones
 * rendered before the trailing-pause padding below existed.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { allCards } from '../src/data'
import { hiraganaWordBank, katakanaWordBank } from '../src/data/beginnerUnderstandingWords'
import { vocabFocusSets } from '../src/data/vocabFocusSets'
import { kanjiLabEntries } from '../src/lib/kanjiLabCatalog'
import { spokenTextForCard, spokenTextForWord } from '../src/lib/spokenText'
import { getVocabExampleSentence } from '../src/lib/vocabExampleSentence'

const AUDIO_DIR = path.resolve(import.meta.dirname, '../public/audio')
const MANIFEST_PATH = path.join(AUDIO_DIR, 'manifest.json')

/** Must stay in sync with SPEECH_SPEEDS in src/lib/speechSpeeds.ts. */
const ALL_SPEEDS = { natural: 1, learning: 0.65 } as const
type SpeedName = keyof typeof ALL_SPEEDS

const args = process.argv.slice(2)
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const has = (name: string) => args.includes(`--${name}`)

const scope = (flag('scope') ?? 'all') as 'focus' | 'kanji' | 'examples' | 'beginner' | 'all'
const serviceUrl = flag('service') ?? process.env.TTS_API_URL ?? 'http://127.0.0.1:8001'
const voiceId = flag('voice') ?? process.env.TTS_VOICE_ID ?? ''
const dryRun = has('dry-run')
const prune = has('prune')
const redoShort = has('redo-short')

// The 🐢 button slows the natural clip with the audio element's playbackRate,
// so one render covers both buttons — half the clips, half the credits, half
// the repo. --both-speeds renders a natively slowed take too, which
// re-articulates rather than stretching and is a little crisper for
// listening practice.
const SPEEDS: Partial<Record<SpeedName, number>> = has('both-speeds')
  ? ALL_SPEEDS
  : { natural: ALL_SPEEDS.natural }

/** Same digest the browser computes in src/lib/staticAudio.ts. */
function keyFor(text: string) {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)
}

function collectTexts(): string[] {
  const texts: string[] = []

  // spokenTextForCard is the same resolution the app's listen buttons use.
  // It has to be: clips are keyed by a hash of the spoken text, so rendering
  // anything else produces files the app will never ask for. It also keeps
  // romaji readings out — roughly half the vocabulary stores "jikan" rather
  // than じかん, and a hosted engine reads that as an English word.
  if (scope === 'focus' || scope === 'all') {
    for (const set of vocabFocusSets) {
      for (const card of set.cards) texts.push(spokenTextForCard(card))
    }
  }
  if (scope === 'kanji' || scope === 'all') {
    for (const entry of kanjiLabEntries) texts.push(spokenTextForWord(entry.example.word, entry.example.reading))
  }
  if (scope === 'all' || scope === 'examples') {
    for (const card of allCards) {
      if (scope === 'all') texts.push(spokenTextForCard(card))
      if (card.type !== 'vocab') continue
      const example = getVocabExampleSentence(card)
      if (example) texts.push(spokenTextForWord(example.japanese, example.reading))
    }
  }
  if (scope === 'all' || scope === 'beginner') {
    for (const word of hiraganaWordBank) texts.push(spokenTextForWord(word.word))
    for (const word of katakanaWordBank) texts.push(spokenTextForWord(word.word))
  }

  return [...new Set(texts.map((t) => t.trim()).filter(Boolean))]
}

/**
 * Silent framing for isolated short text (single kana, 2-character words).
 * With nothing around it, a hosted engine has no sentence to pace against —
 * it either clips the vowel short or, worse, guesses at what word the
 * fragment might belong to and hallucinates a syllable onto the end (はと
 * alone came back as "hatoku"). next_text alone signals "a sentence-final
 * full stop follows" without embedding the word mid-sentence — a full
 * previous_text carrier phrase ("This is the word ___") made the model
 * speak it at fast, fluent, conversational pace instead of the isolated,
 * clearly-enunciated one a flashcard needs. previous_text/next_text are
 * never spoken or billed, so `text` alone is still what gets rendered.
 * Longer text already reads as a complete phrase and needs none of this.
 */
function speechContext(text: string): { next_text?: string } {
  if ([...text].length > 2) return {}
  return { next_text: '。' }
}

async function synthesize(text: string, speed: number): Promise<{ audio: Buffer; ext: string }> {
  const response = await fetch(`${serviceUrl}/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speed, voice_id: voiceId, ...speechContext(text) }),
  })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${JSON.stringify(text)}`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  const ext = contentType.includes('mpeg') ? 'mp3' : contentType.includes('ogg') ? 'ogg' : 'wav'
  return { audio: Buffer.from(await response.arrayBuffer()), ext }
}

const texts = collectTexts()

// What this run will *actually* pay for — a clip already on disk is a skip
// unless --redo-short reclaims it, so pricing off every text in the scope
// (as if starting from zero) wildly overstates the real cost on any rerun.
const owed = texts.flatMap((text) =>
  (Object.keys(SPEEDS) as SpeedName[])
    .filter((speedName) => {
      const key = keyFor(text)
      const existing = ['mp3', 'wav', 'ogg'].some((ext) => existsSync(path.join(AUDIO_DIR, `${key}-${speedName}.${ext}`)))
      return !existing || (redoShort && [...text].length <= 2)
    })
    .map((speedName) => ({ text, speedName })))
// previous_text/next_text aren't spoken, so ElevenLabs doesn't bill for
// them — only the actual synthesized text counts.
const owedCharacters = owed.reduce((sum, { text }) => sum + [...text].length, 0)

console.log(`scope           ${scope}`)
console.log(`unique texts    ${texts.length.toLocaleString()}`)
console.log(`clips already cached ${(texts.length * Object.keys(SPEEDS).length - owed.length).toLocaleString()}`)
console.log(`clips to actually render ${owed.length.toLocaleString()} (${Object.keys(SPEEDS).join(' + ')})`)
console.log(`characters to bill ${owedCharacters.toLocaleString()}`)
console.log(`credits         ${owedCharacters.toLocaleString()} at 1/char, ` +
  `${(owedCharacters / 2).toLocaleString()} at 0.5/char (turbo/flash)`)

if (dryRun) {
  console.log('\n--dry-run: nothing rendered.')
  process.exit(0)
}

mkdirSync(AUDIO_DIR, { recursive: true })

let rendered = 0
let skipped = 0
let failed = 0
let extension = 'mp3'
const done: string[] = []

for (const [index, text] of texts.entries()) {
  const key = keyFor(text)
  let complete = true

  for (const [speedName, speed] of Object.entries(SPEEDS) as [SpeedName, number][]) {
    // Any existing extension counts as a hit, so switching providers doesn't
    // silently re-bill everything. --redo-short bypasses that hit for very
    // short texts specifically, so an already-rendered clip that clipped its
    // vowel short (no surrounding context to pace against) can be re-cut with
    // textToSpeak's trailing pause instead of living with the old take.
    const existing = ['mp3', 'wav', 'ogg'].find((ext) => existsSync(path.join(AUDIO_DIR, `${key}-${speedName}.${ext}`)))
    if (existing && !(redoShort && [...text].length <= 2)) {
      extension = existing
      skipped += 1
      continue
    }

    try {
      const { audio, ext } = await synthesize(text, speed)
      extension = ext
      writeFileSync(path.join(AUDIO_DIR, `${key}-${speedName}.${ext}`), audio)
      rendered += 1
    } catch (error) {
      console.error(`  ✗ ${text} (${speedName}): ${(error as Error).message}`)
      failed += 1
      complete = false
    }
  }

  if (complete) done.push(key)
  if ((index + 1) % 100 === 0) {
    console.log(`  ${index + 1}/${texts.length} — ${rendered} rendered, ${skipped} cached, ${failed} failed`)
  }
}

// This run only ever covers one scope's worth of texts, so a key rendered by
// an earlier run (a different scope, or a re-render after adding content)
// would otherwise vanish the moment a narrower scope runs afterward. Keep any
// previously published key whose files are still on disk, and let this run's
// results add to that rather than replace it.
let previousKeys: string[] = []
if (existsSync(MANIFEST_PATH)) {
  try {
    const previous = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { keys?: string[] }
    previousKeys = (previous.keys ?? []).filter((key) =>
      Object.keys(SPEEDS).every((speedName) => existsSync(path.join(AUDIO_DIR, `${key}-${speedName}.${extension}`))))
  } catch {
    // A missing or corrupt manifest just means nothing carries forward.
  }
}

// Only keys with every speed present go in the manifest: a partial entry would
// have the client confidently request a file that isn't there.
const manifest = {
  voice: voiceId || '(service default)',
  ext: extension,
  speeds: SPEEDS,
  keys: [...new Set([...previousKeys, ...done])].sort(),
}
writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest)}\n`)

if (prune) {
  const wanted = new Set(manifest.keys.flatMap((key) => Object.keys(SPEEDS).map((s) => `${key}-${s}.${extension}`)))
  for (const file of readdirSync(AUDIO_DIR)) {
    if (file === 'manifest.json' || wanted.has(file)) continue
    unlinkSync(path.join(AUDIO_DIR, file))
    console.log(`  pruned ${file}`)
  }
}

console.log(`\nrendered ${rendered}, cached ${skipped}, failed ${failed}`)
console.log(`manifest: ${manifest.keys.length} playable texts -> ${path.relative(process.cwd(), MANIFEST_PATH)}`)
if (failed) process.exitCode = 1
