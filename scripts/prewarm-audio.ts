/**
 * Fills the audio library with hero-generator sentences, on purpose.
 *
 * The generator writes novel sentences at runtime, so they can't be listed in
 * advance the way vocabulary can. This runs the same generator the app runs,
 * collects what it produces, and has the TTS service speak each line — turning
 * an unbounded live cost into one deliberate batch you choose the size of.
 *
 * Pair it with TTS_CACHE_ONLY on the service: the app then plays the real
 * voice for anything in the library and the browser voice for anything else,
 * and can never spend money on its own.
 *
 * The spoken text must match what the app speaks byte for byte or the clips
 * are unreachable, so the reading is assembled exactly as
 * RotatingHeroSentence does it rather than re-derived here.
 *
 * Usage:
 *   uvicorn app:app --host 127.0.0.1 --port 8001     # in another terminal
 *   npm run prewarm:audio -- --count=500 --dry-run
 *   npm run prewarm:audio -- --count=500
 *   npm run prewarm:audio -- --count=500 --levels=N5,N4
 *
 * Then bank them:
 *   TTS_ADMIN_TOKEN=... npm run harvest:audio
 */
import { buildHeroSteps, type HeroSwapFocus } from '../src/lib/heroSequence'
import { spokenSegmentText } from '../src/lib/heroSentenceGloss'
import type { JlptLevel } from '../src/lib/types'
import type { WrongPool } from '../src/lib/wrongPool'

const ALL_LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
/** Mirrors the app's grammar-focus modes, so drill sentences are covered too. */
const FOCUSES: (HeroSwapFocus | undefined)[] = [undefined, 'verb', 'noun', 'adjective']

const args = process.argv.slice(2)
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const dryRun = args.includes('--dry-run')

const count = Number(flag('count') ?? 500)
const levels = (flag('levels')?.split(',') as JlptLevel[] | undefined)?.filter((l) => ALL_LEVELS.includes(l))
  ?? ALL_LEVELS
const serviceUrl = flag('service') ?? process.env.TTS_API_URL ?? 'http://127.0.0.1:8001'
const voiceId = flag('voice') ?? process.env.TTS_VOICE_ID ?? ''
/** The service caps a single request at 400 characters. */
const MAX_TEXT_LENGTH = 400

/** Exactly how RotatingHeroSentence builds what it sends to the voice. */
function spokenText(step: { frame?: { segments?: { text: string; reading?: string }[] } }) {
  return (step.frame?.segments ?? [])
    .map((segment) => spokenSegmentText(segment))
    .join('')
}

function collectSentences(target: number) {
  const found = new Set<string>()
  // Walk seeds outward rather than sampling randomly: the same seeds produce
  // the same stream, so a re-run extends the library instead of scattering
  // new one-off sentences no future run will ever hit again.
  for (let seed = 0; found.size < target && seed < 5000; seed += 1) {
    for (const level of levels) {
      for (const focus of FOCUSES) {
        let steps
        try {
          steps = buildHeroSteps({} as WrongPool, {}, level, seed, 12, focus)
        } catch {
          continue
        }
        for (const step of steps) {
          const text = spokenText(step).trim()
          if (text && text.length <= MAX_TEXT_LENGTH) found.add(text)
          if (found.size >= target) return [...found]
        }
      }
    }
  }
  return [...found]
}

const sentences = collectSentences(count)
const characters = sentences.reduce((sum, s) => sum + [...s].length, 0)

console.log(`levels        ${levels.join(', ')}`)
console.log(`sentences     ${sentences.length.toLocaleString()}${sentences.length < count ? ` (asked for ${count}; generator exhausted)` : ''}`)
console.log(`characters    ${characters.toLocaleString()}`)
console.log(`credits       ${characters.toLocaleString()} at 1/char, ${Math.round(characters / 2).toLocaleString()} at 0.5/char (turbo/flash)`)
console.log(`average       ${(characters / Math.max(1, sentences.length)).toFixed(1)} chars/sentence`)

if (dryRun) {
  console.log('\nsample:')
  sentences.slice(0, 8).forEach((s) => console.log(`   ${s}`))
  console.log('\n--dry-run: nothing synthesized.')
  process.exit(0)
}

let spoken = 0
let failed = 0

for (const [index, text] of sentences.entries()) {
  try {
    // Natural speed only: the app slows playback itself, so a natively-slow
    // clip would be slowed twice. The service caches whatever it renders,
    // which is what harvest:audio later promotes to permanent files.
    const response = await fetch(`${serviceUrl}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speed: 1, voice_id: voiceId }),
    })
    if (response.status === 402) {
      console.error('\nMonthly budget reached — stopping. Raise TTS_MONTHLY_CHARACTER_BUDGET to continue.')
      break
    }
    if (!response.ok) throw new Error(`${response.status}`)
    await response.arrayBuffer()
    spoken += 1
  } catch (error) {
    console.error(`  ✗ ${text}: ${(error as Error).message}`)
    failed += 1
  }

  if ((index + 1) % 50 === 0) console.log(`  ${index + 1}/${sentences.length} — ${spoken} spoken, ${failed} failed`)
}

console.log(`\nspoken ${spoken}, failed ${failed}`)
console.log('\nNow bank them permanently:')
console.log('  TTS_ADMIN_TOKEN=... npm run harvest:audio')
if (failed) process.exitCode = 1
