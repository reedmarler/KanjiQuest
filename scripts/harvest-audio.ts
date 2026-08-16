/**
 * Promotes clips the service has already synthesized into permanent files.
 *
 * The service caches everything it renders, but that cache lives on the
 * server's disk — it is wiped when an ephemeral host restarts, and it is not
 * in this repo. Anything paid for there is rented, not owned.
 *
 * This copies those clips into public/audio/ and adds them to the manifest,
 * which makes them part of the app: committed, deployed as static files, free
 * to play forever, and unaffected by the server going away. Run it whenever
 * you want to bank what the hero generator has produced since last time.
 *
 * Usage:
 *   TTS_ADMIN_TOKEN=... npm run harvest:audio
 *   TTS_ADMIN_TOKEN=... npm run harvest:audio -- --service=https://your-space.hf.space
 *   TTS_ADMIN_TOKEN=... npm run harvest:audio -- --dry-run
 *
 * The service only exposes these endpoints when TTS_ADMIN_TOKEN is set on it,
 * and the token here must match.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const AUDIO_DIR = path.resolve(import.meta.dirname, '../public/audio')
const MANIFEST_PATH = path.join(AUDIO_DIR, 'manifest.json')

/** Only clips rendered at natural speed are usable: the app slows playback
 *  itself, and a natively-slow clip would be slowed twice. */
const NATURAL_SPEED = 1

const args = process.argv.slice(2)
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const dryRun = args.includes('--dry-run')

const serviceUrl = flag('service') ?? process.env.TTS_API_URL ?? 'http://127.0.0.1:8001'
const adminToken = flag('token') ?? process.env.TTS_ADMIN_TOKEN ?? ''

if (!adminToken) {
  console.error('Set TTS_ADMIN_TOKEN (same value the service runs with).')
  process.exit(1)
}

const headers = { 'X-Admin-Token': adminToken }

/** Same digest generate-audio.ts and staticAudio.ts use. */
const keyFor = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)

interface CacheEntry { key: string; text?: string; speed?: number; media_type?: string }

const response = await fetch(`${serviceUrl}/cache/entries`, { headers })
if (!response.ok) {
  console.error(`${response.status} from ${serviceUrl}/cache/entries — is TTS_ADMIN_TOKEN set on the service?`)
  process.exit(1)
}

const { entries } = await response.json() as { entries: CacheEntry[] }
const usable = entries.filter((e) => e.text && Math.abs((e.speed ?? 1) - NATURAL_SPEED) < 0.001)

mkdirSync(AUDIO_DIR, { recursive: true })

const manifest: { voice: string; ext: string; speeds: Record<string, number>; keys: string[] } =
  existsSync(MANIFEST_PATH)
    ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    : { voice: '(harvested)', ext: 'mp3', speeds: { natural: NATURAL_SPEED }, keys: [] }

const known = new Set(manifest.keys)
let added = 0
let already = 0
let failed = 0

console.log(`${entries.length} cached clips, ${usable.length} at natural speed`)
if (dryRun) {
  const fresh = usable.filter((e) => !known.has(keyFor(e.text!.trim())))
  console.log(`${fresh.length} new, ${usable.length - fresh.length} already banked`)
  fresh.slice(0, 10).forEach((e) => console.log(`   + ${e.text}`))
  if (fresh.length > 10) console.log(`   … and ${fresh.length - 10} more`)
  process.exit(0)
}

for (const entry of usable) {
  const text = entry.text!.trim()
  const key = keyFor(text)
  const ext = entry.media_type?.includes('mpeg') ? 'mp3' : entry.media_type?.includes('ogg') ? 'ogg' : 'wav'
  const target = path.join(AUDIO_DIR, `${key}-natural.${ext}`)

  if (existsSync(target)) { already += 1; known.add(key); continue }

  try {
    const clip = await fetch(`${serviceUrl}/cache/audio/${entry.key}`, { headers })
    if (!clip.ok) throw new Error(`${clip.status}`)
    writeFileSync(target, Buffer.from(await clip.arrayBuffer()))
    manifest.ext = ext
    known.add(key)
    added += 1
  } catch (error) {
    console.error(`  ✗ ${text}: ${(error as Error).message}`)
    failed += 1
  }
}

manifest.keys = [...known].sort()
writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest)}\n`)

console.log(`\nbanked ${added} new, ${already} already had, ${failed} failed`)
console.log(`manifest now covers ${manifest.keys.length} texts`)
if (added) console.log('\nCommit public/audio/ to keep them.')
if (failed) process.exitCode = 1
