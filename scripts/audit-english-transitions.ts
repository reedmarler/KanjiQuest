import { CURATED_HERO_SENTENCES } from '../src/data/curatedHeroSentences'
import { curatedToFrame } from '../src/lib/curatedSentenceEngine'
import { buildHeroEnglishTrack } from '../src/lib/heroEnglishTrack'
import { getCuratedEnglish } from '../src/lib/curatedSentenceEngine'
import { sanitizeHeroEnglishGloss } from '../src/lib/heroEnglishNormalize'

function assembled(partial: Extract<ReturnType<typeof buildHeroEnglishTrack>, { mode: 'partial' }>): string {
  return partial.before + partial.reel.text + partial.after
}

let issues = 0
let partialCount = 0
let blurCount = 0

for (const sentence of CURATED_HERO_SENTENCES) {
  for (const neighborId of sentence.neighbors) {
    const neighbor = CURATED_HERO_SENTENCES.find((s) => s.id === neighborId)
    if (!neighbor) continue

    const prevFrame = curatedToFrame(sentence)
    const frame = curatedToFrame(neighbor)
    const prevEn = getCuratedEnglish(sentence.id)
    const en = getCuratedEnglish(neighbor.id)

    if (prevEn.includes('.') || en.includes('.')) {
      console.log(`PERIOD: ${sentence.id}→${neighborId}: "${prevEn}" → "${en}"`)
      issues++
    }

    const prevSegs = prevFrame.segments ?? []
    const prevMap = new Map(prevSegs.map((s) => [s.key, s.text]))
    const highlighted = (frame.segments ?? [])
      .filter((s) => s.swappable && prevMap.get(s.key) !== s.text)
      .map((s) => s.key)
    const changed = highlighted

    const track = buildHeroEnglishTrack(
      frame,
      prevFrame,
      false,
      changed,
      highlighted,
      `${sentence.id}-${neighborId}`,
      true,
    )

    if (track.mode === 'partial') {
      partialCount++
      const line = assembled(track)
      const normalized = sanitizeHeroEnglishGloss(line)
      if (normalized !== en) {
        console.log(`PARTIAL MISMATCH ${sentence.id}→${neighborId} [${highlighted.join(',')}]`)
        console.log(`  expected: "${en}"`)
        console.log(`  got:      "${normalized}"`)
        console.log(`  parts:    "${track.before}" | "${track.reel.text}" | "${track.after}"`)
        issues++
      }
      if (/\s{2,}/.test(line) || line.includes(' .')) {
        console.log(`SPACING ${sentence.id}→${neighborId}: "${line}"`)
        issues++
      }
    } else if (track.mode === 'blur') {
      blurCount++
    }
  }
}

console.log(`\nPartial: ${partialCount}, Blur: ${blurCount}, Issues: ${issues}`)
