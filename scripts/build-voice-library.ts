/**
 * One command that builds the whole audio library.
 *
 * Runs the three steps in order — vocabulary, hero sentences, then banking
 * the results into public/audio/ — and stops at a confirmation prompt with
 * the exact character count before anything is billed.
 *
 * Requires the TTS service to already be running (make-voice.cmd starts it
 * for you on Windows; otherwise `uvicorn app:app --port 8001` in
 * backend/tts_service).
 *
 * Usage:
 *   npm run build:voice                      # asks before spending
 *   npm run build:voice -- --sentences=1000  # bigger hero pool
 *   npm run build:voice -- --words=all       # every study card, not just focus sets
 *   npm run build:voice -- --yes             # skip the confirmation
 */
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'

const args = process.argv.slice(2)
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const assumeYes = args.includes('--yes')

const sentences = Number(flag('sentences') ?? 500)
const wordScope = flag('words') ?? 'focus'
const serviceUrl = flag('service') ?? process.env.TTS_API_URL ?? 'http://127.0.0.1:8001'
const adminToken = process.env.TTS_ADMIN_TOKEN ?? ''

function run(label: string, script: string, scriptArgs: string[]) {
  console.log(`\n──────── ${label} ────────`)
  const result = spawnSync('npx', ['tsx', script, ...scriptArgs], {
    stdio: 'inherit',
    env: { ...process.env, TTS_API_URL: serviceUrl },
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    console.error(`\n${label} failed. Nothing further was run.`)
    process.exit(result.status ?? 1)
  }
}

/** Reads the character totals the two dry-runs print, so the confirmation
 *  quotes a real number rather than an estimate. */
function dryRunCharacters(script: string, scriptArgs: string[]) {
  const result = spawnSync('npx', ['tsx', script, ...scriptArgs, '--dry-run'], {
    encoding: 'utf8',
    env: { ...process.env, TTS_API_URL: serviceUrl },
    shell: process.platform === 'win32',
  })
  const match = /characters\s+([\d,]+)/.exec(result.stdout ?? '')
  if (result.status !== 0 || !match) {
    console.error(result.stdout ?? '')
    console.error(result.stderr ?? '')
    throw new Error(`Could not price ${script}`)
  }
  return Number(match[1]!.replace(/,/g, ''))
}

// --- Preflight ------------------------------------------------------------

const health = await fetch(`${serviceUrl}/health`).catch(() => null)
if (!health?.ok) {
  console.error(`No TTS service at ${serviceUrl}.`)
  console.error('Start it first:  cd backend/tts_service && uvicorn app:app --port 8001')
  process.exit(1)
}

const status = await health.json() as { provider: string; cache_only?: boolean; budget?: { limit: number } }
console.log(`service   ${serviceUrl}`)
console.log(`provider  ${status.provider}`)

if (status.cache_only) {
  console.error('\nThe service is in cache-only mode, so it will refuse to render anything new.')
  console.error('Set TTS_CACHE_ONLY=false, restart it, and run this again.')
  process.exit(1)
}

if (!adminToken) {
  console.error('\nSet TTS_ADMIN_TOKEN (the same value the service is running with).')
  console.error('Without it the last step cannot copy the audio into public/audio/.')
  process.exit(1)
}

// --- Price it before spending anything ------------------------------------

const wordChars = dryRunCharacters('scripts/generate-audio.ts', [`--scope=${wordScope}`])
const sentenceChars = dryRunCharacters('scripts/prewarm-audio.ts', [`--count=${sentences}`])
const total = wordChars + sentenceChars

console.log('\n════════════ what this will cost ════════════')
console.log(`vocabulary (${wordScope})      ${wordChars.toLocaleString().padStart(8)} characters`)
console.log(`hero sentences (${sentences})  ${sentenceChars.toLocaleString().padStart(8)} characters`)
console.log(`total                    ${total.toLocaleString().padStart(8)} characters`)
console.log('')
console.log(`credits   ${total.toLocaleString()} on multilingual_v2, ${Math.round(total / 2).toLocaleString()} on flash/turbo`)
console.log(`           Starter ($6) allows 30,000/month, Creator ($22) 121,000`)
if (status.budget?.limit) console.log(`budget    service is capped at ${status.budget.limit.toLocaleString()} characters this month`)
console.log('═════════════════════════════════════════════')

if (!assumeYes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question('\nRender this? Anything but "yes" cancels: ')).trim().toLowerCase()
  rl.close()
  if (answer !== 'yes') {
    console.log('Cancelled. Nothing was rendered and nothing was billed.')
    process.exit(0)
  }
}

// --- Do it ----------------------------------------------------------------

run('1/3  vocabulary', 'scripts/generate-audio.ts', [`--scope=${wordScope}`])
run('2/3  hero sentences', 'scripts/prewarm-audio.ts', [`--count=${sentences}`])
run('3/3  banking into public/audio', 'scripts/harvest-audio.ts', [])

console.log('\n════════════════════════════════════════════')
console.log('Done. The audio is in public/audio/.')
console.log('')
console.log('Keep it:')
console.log('  git add public/audio && git commit -m "Add voice audio" && git push')
console.log('')
console.log('Then stop the service. To make sure nothing can ever bill you again,')
console.log('restart it with TTS_CACHE_ONLY=true, or just leave it off — the')
console.log('committed clips play on their own.')
