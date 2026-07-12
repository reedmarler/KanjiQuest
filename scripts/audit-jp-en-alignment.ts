import { buildHeroSteps } from '../src/lib/heroSequence'
import { getHeroEnglish } from '../src/lib/heroSentenceGloss'
import { frameToJapanese } from '../src/lib/heroSentenceNatural'
import { formatHeroEnglishObject } from '../src/lib/heroWordFit'
import { buildHeroEnglishTrack } from '../src/lib/heroEnglishTrack'
import { findMasuVerbBase, parseMasuPredicate } from '../src/lib/heroPredicateConjugation'
import { roleForTemplate } from '../src/lib/heroPhraseRole'
import type { HeroSentenceFrame } from '../src/data/heroSentences'

const PREFIX_ENGLISH: Record<string, string> = {
  昨日: 'Yesterday,',
  今朝: 'This morning,',
  先週: 'Last week,',
  週末: 'This weekend,',
}

const steps = buildHeroSteps({ wrongIds: [], dueIds: [], newIds: [] }, {}, 'N5')

function subjectEn(frame: HeroSentenceFrame): string {
  const map: Record<string, string> = {
    私: 'I',
    彼: 'he',
    彼女: 'she',
    先生: 'my teacher',
    友達: 'my friend',
  }
  const who = map[frame.subject] ?? frame.subject.toLowerCase()
  const also = frame.topicParticle === 'も' ? ' also' : ''
  return who + also
}

function expectedObjectInEn(frame: HeroSentenceFrame): string {
  return formatHeroEnglishObject(frame)
}

function predicateBase(frame: HeroSentenceFrame): string | null {
  return findMasuVerbBase(frame.predicate) ?? parseMasuPredicate(frame.predicate)?.stem + 'ます' ?? null
}

const issues: string[] = []

for (let i = 1; i < Math.min(80, steps.length); i++) {
  const step = steps[i]
  const prev = steps[i - 1]
  const frame = step.frame
  const prevFrame = prev.frame
  const jp = frameToJapanese(frame)
  const en = getHeroEnglish(frame)
  const prevEn = getHeroEnglish(prevFrame)

  const changed = step.changed.filter((s) => frame[s] !== prevFrame[s])

  for (const slot of changed) {
    if (slot === 'word') {
      const obj = expectedObjectInEn(frame)
      if (obj && !en.toLowerCase().includes(obj.toLowerCase())) {
        issues.push(`[${i}] WORD slot: JP object ${frame.word}→"${obj}" missing in EN: ${en}`)
      }
    }

    if (slot === 'prefix' && frame.prefix) {
      const lead = PREFIX_ENGLISH[frame.prefix] ?? frame.prefix
      const key = lead.replace(/,$/, '').toLowerCase()
      if (!en.toLowerCase().includes(key.split(',')[0])) {
        issues.push(`[${i}] PREFIX: ${frame.prefix} not in EN: ${en}`)
      }
    }

    if (slot === 'predicate') {
      const base = predicateBase(frame)
      const role = roleForTemplate({
        id: '',
        objectParticle: frame.objectParticle,
        predicate: frame.predicate,
        wordLength: 0,
        words: [],
      })
      if (!role) {
        issues.push(`[${i}] PREDICATE role null: ${frame.predicate} | ${jp}`)
      }
      if (base === '食べます' && !/\b(ate|eat|eating|didn't eat)\b/i.test(en)) {
        issues.push(`[${i}] PREDICATE eat: ${jp} => ${en}`)
      }
      if (base === '借ります' && !/\b(borrow|borrowed|didn't borrow)\b/i.test(en)) {
        issues.push(`[${i}] PREDICATE borrow: ${jp} => ${en}`)
      }
      if (base === '読みます' && !/\b(read|reading|didn't read)\b/i.test(en)) {
        issues.push(`[${i}] PREDICATE read: ${jp} => ${en}`)
      }
      if (base === '聞きます' && !/\b(listen|listened|didn't listen)\b/i.test(en)) {
        issues.push(`[${i}] PREDICATE listen: ${jp} => ${en}`)
      }
      if (base === '見ます' && !/\b(watch|watched|see|saw|didn't watch)\b/i.test(en)) {
        issues.push(`[${i}] PREDICATE watch: ${jp} => ${en}`)
      }
    }

    if (slot === 'modifier' && frame.modifier) {
      const teMarkers: Record<string, RegExp> = {
        '図書館に行って、': /library/i,
        '友達と会って、': /friend/i,
        '本を読んでから、': /reading a book|read a book/i,
        '仕事が終わってから、': /work ended|after work/i,
        '音楽を聞きながら、': /listening to music|while listening/i,
        '京都に行って、': /Kyoto/i,
      }
      const re = teMarkers[frame.modifier]
      if (re && !re.test(en)) {
        issues.push(`[${i}] MODIFIER: ${frame.modifier} not reflected: ${jp} => ${en}`)
      }
    }

    if (slot === 'subject') {
      const subj = subjectEn(frame)
      if (subj && !en.toLowerCase().includes(subj.replace(' also', '').toLowerCase())) {
        issues.push(`[${i}] SUBJECT: ${frame.subject} not in EN: ${en}`)
      }
    }
  }

  const track = buildHeroEnglishTrack(
    frame,
    prevFrame,
    false,
    changed,
    changed.length === 1 ? changed : [],
    `step-${i}`,
    true,
  )

  if (track.mode === 'partial' && changed.length === 1) {
    const slot = changed[0]
    const assembled = track.before + track.reel.text + track.after
    if (assembled !== en) {
      issues.push(`[${i}] PARTIAL mismatch slot=${slot}: assembled="${assembled}" full="${en}"`)
    }
    if (slot === 'word') {
      const nextObj = expectedObjectInEn(frame)
      if (nextObj && !track.reel.text.toLowerCase().includes(nextObj.toLowerCase())) {
        issues.push(`[${i}] PARTIAL word reel wrong: reel="${track.reel.text}" expected obj="${nextObj}"`)
      }
    }
  }

  if (track.mode === 'blur' && changed.length === 1 && changed[0] === 'word') {
    const nextObj = expectedObjectInEn(frame)
    const prevObj = expectedObjectInEn(prevFrame)
    if (nextObj !== prevObj) {
      issues.push(`[${i}] WORD swap fell back to blur: ${prevObj} -> ${nextObj}`)
    }
  }
}

console.log(`Alignment issues (first 80 steps): ${issues.length}`)
for (const line of issues) console.log(line)

console.log('\n--- Step-by-step sample (first 25) ---')
for (let i = 1; i < 25; i++) {
  const step = steps[i]
  const prev = steps[i - 1]
  const changed = step.changed.filter((s) => step.frame[s] !== prev.frame[s])
  console.log(`\n#${i} [${changed.join(',')}]`)
  console.log('  JP:', frameToJapanese(step.frame))
  console.log('  EN:', getHeroEnglish(step.frame))
  if (changed.length === 1 && changed[0] === 'predicate') {
    console.log('  pred:', prev.frame.predicate, '->', step.frame.predicate)
  }
}
