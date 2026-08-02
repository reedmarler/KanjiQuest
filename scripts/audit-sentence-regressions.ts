import { GENERATION_COMPLEXITIES, patternsForComplexity, type GenerationComplexity } from '../src/lib/generationComplexity'
import { generateCategorySentence } from '../src/lib/categorySentenceEngine'
import type { GeneratedPreviewSentence } from '../src/lib/sentenceGeneratorPreview'
import type { JlptLevel } from '../src/lib/types'

type Violation = {
  rule: string
  complexity: GenerationComplexity
  patternId: string
  seed: number
  japanese: string
  english: string
}

const seedsPerPattern = Number(process.argv.find((arg) => arg.startsWith('--seeds='))?.split('=')[1] ?? 150)
const maxSamplesPerRule = 8

const exactBadSentences = new Map<string, string>([
  ['選手は空港へ通います', '通う should not choose one-off destinations like airports.'],
  ['森に娘がいます', 'Ordinary person-existence sentences should avoid bare nature locations.'],
  ['教室に切手があります', 'Small objects should prefer plausible storage/default locations.'],
  ['ごみが必要です', '必要だ should only use useful/needed nouns.'],
  ['靴は銀行にあります', 'Object existence should avoid arbitrary institutional locations.'],
  ['伯父は玄関で野菜を食べます', '食べる should choose eating-compatible locations.'],
  ['選手は教室へ逃げます', '逃げる should choose plausible refuge/escape destinations.'],
  ['他人が豊かです', 'Context-dependent 他人 should not be used with personal-state adjectives.'],
  ['部長は父親に電話を送ります', '送る should not use 電話 as a sent object; use 電話する for phone calls.'],
  ['体系が少ないです', '少ない should describe countable/measurable quantities, not systems/frameworks.'],
  ['犬は皿がほしいです', 'Animal ほしい subjects should prefer food, water, bones, or toys.'],
  ['森に学生がいます', 'Ordinary person-existence sentences should prefer expected human locations over bare forest settings.'],
])

const routineAttendanceTags = new Set(['school', 'education', 'university', 'office', 'hospital', 'workplace'])
const personExistenceExcludedLocationTags = new Set(['forest', 'mountain', 'river', 'lake', 'beach', 'ocean', 'island'])
const eatingLocationTags = new Set(['restaurant', 'cafe', 'cafeteria', 'house', 'home', 'kitchen', 'dining-room', 'room', 'school', 'classroom', 'office', 'workplace', 'park', 'hotel', 'eating-location'])
const fleeingDestinationTags = new Set(['building', 'house', 'home', 'apartment', 'room', 'forest', 'mountain', 'park', 'outdoor', 'station'])
const usefulNeededWords = new Set(['時間', 'お金', '許可', '情報', '道具', '休み', '経験', '知識', '協力', '説明', '準備', '練習', '資料', '証拠', '許可証', 'パスポート', '切符', 'チケット', '地図', '鍵', '薬'])
const mailableTags = new Set(['book', 'document', 'notebook', 'magazine', 'newspaper', 'letter', 'box', 'bag', 'package', 'parcel'])
const sukunaiCompatibleWords = new Set(['人', '人々', '時間', 'お金', '問題', '機会', '車', '木'])
const animalHoshiiTags = new Set(['food', 'fruit', 'vegetable', 'meat', 'seafood', 'fish', 'rice', 'bread', 'noodles', 'soup', 'dessert', 'snack', 'candy', 'ice-cream', 'edible', 'drink', 'drinkable', 'beverage', 'water', 'bone', 'toy', 'pet-toy'])
const animalSubjectTags = new Set(['animal', 'dog', 'cat', 'bird', 'fish', 'pet'])
const studySubjects = new Set(['日本語', '英語', '中国語', '外国語', '漢字', '単語', '語彙', '文法', '発音', '数学', '歴史', '科学'])
const sendableItems = new Set(['手紙', 'はがき', '小包', '荷物', '箱', '書類', '資料', 'メール'])
const findableLostItems = new Set(['鍵', '財布', '手紙', '切符', 'チケット', '携帯電話', '電話', 'かばん', '傘'])

function tags(sentence: GeneratedPreviewSentence, slotName: string): Set<string> {
  return new Set(sentence.slots[slotName]?.tags ?? [])
}

function hasAny(values: Set<string>, allowed: Set<string>): boolean {
  for (const value of values) {
    const normalized = value.startsWith('matched:') ? value.slice('matched:'.length) : value
    if (allowed.has(normalized)) return true
  }
  return false
}

function addViolation(violations: Violation[], sentence: GeneratedPreviewSentence, complexity: GenerationComplexity, seed: number, rule: string) {
  violations.push({
    rule,
    complexity,
    patternId: sentence.frameId,
    seed,
    japanese: sentence.japanese,
    english: sentence.english,
  })
}

function checkSentence(sentence: GeneratedPreviewSentence, complexity: GenerationComplexity, seed: number): Violation[] {
  const violations: Violation[] = []
  const verb = sentence.slots.verb

  const exactRule = exactBadSentences.get(sentence.japanese)
  if (exactRule) addViolation(violations, sentence, complexity, seed, `exact bad sentence: ${exactRule}`)

  if (/(をを|にに|がが|はは|へへ|でで|とと)/u.test(sentence.japanese)) {
    addViolation(violations, sentence, complexity, seed, 'possible doubled particle')
  }

  if (/undefined|null|\[[A-Za-z0-9_ -]+\]/u.test(sentence.japanese) || /undefined|null/u.test(sentence.english)) {
    addViolation(violations, sentence, complexity, seed, 'placeholder/null leaked into output')
  }

  if (!/^[A-Z]/.test(sentence.english) || !/[.!?]$/.test(sentence.english)) {
    addViolation(violations, sentence, complexity, seed, 'English gloss capitalization/punctuation')
  }

  if (verb?.dictionaryForm === '通う' && !hasAny(tags(sentence, 'destination'), routineAttendanceTags)) {
    addViolation(violations, sentence, complexity, seed, '通う destination is not routine-attendance compatible')
  }

  if (verb?.dictionaryForm === '逃げる' && !hasAny(tags(sentence, 'destination'), fleeingDestinationTags)) {
    addViolation(violations, sentence, complexity, seed, '逃げる destination is not escape/refuge compatible')
  }

  if (verb?.dictionaryForm === '食べる' && sentence.slots.location && !hasAny(tags(sentence, 'location'), eatingLocationTags)) {
    addViolation(violations, sentence, complexity, seed, '食べる location is not eating-compatible')
  }

  if (verb?.dictionaryForm === 'いる' && sentence.slots.location) {
    const locationTags = tags(sentence, 'location')
    if ([...locationTags].some((tag) => personExistenceExcludedLocationTags.has(tag) || (tag.startsWith('matched:') && personExistenceExcludedLocationTags.has(tag.slice('matched:'.length))))) {
      addViolation(violations, sentence, complexity, seed, 'いる person-existence location is bare nature')
    }
  }

  if (sentence.japanese.includes('必要')) {
    const candidate = sentence.slots.subject ?? sentence.slots.object ?? sentence.slots.item
    if (candidate && !usefulNeededWords.has(candidate.dictionaryForm)) {
      addViolation(violations, sentence, complexity, seed, '必要だ used with a noun outside the useful-needed allowlist')
    }
  }

  if (verb?.dictionaryForm === '送る' && sentence.slots.object && !hasAny(tags(sentence, 'object'), mailableTags)) {
    addViolation(violations, sentence, complexity, seed, '送る object is not mailable/shippable')
  }

  if (verb?.dictionaryForm === '勉強する' && sentence.slots.object && !studySubjects.has(sentence.slots.object.dictionaryForm)) {
    addViolation(violations, sentence, complexity, seed, '勉強する object is not a field of study')
  }

  if (verb?.dictionaryForm === '送る' && sentence.slots.object && !sendableItems.has(sentence.slots.object.dictionaryForm)) {
    addViolation(violations, sentence, complexity, seed, '送る object is outside the reviewed sendable-item set')
  }

  if (verb?.dictionaryForm === '見つける' && sentence.slots.object && !findableLostItems.has(sentence.slots.object.dictionaryForm)) {
    addViolation(violations, sentence, complexity, seed, '見つける object is not a plausible lost item')
  }

  if (/\bgo(?:es)? to the inside\b/i.test(sentence.english)) {
    addViolation(violations, sentence, complexity, seed, 'English movement gloss has an invalid "to the inside" phrase')
  }

  if (sentence.slots.adjective?.dictionaryForm === '少ない') {
    const candidate = sentence.slots.subject ?? sentence.slots.object
    if (candidate && !sukunaiCompatibleWords.has(candidate.dictionaryForm)) {
      addViolation(violations, sentence, complexity, seed, '少ない used with a noun outside the countable quantity allowlist')
    }
  }

  if (sentence.slots.predicate?.dictionaryForm === 'ほしい') {
    const subjectTags = tags(sentence, 'subject')
    const objectTags = tags(sentence, 'object')
    const animalSubject = [...subjectTags].some((tag) => animalSubjectTags.has(tag) || (tag.startsWith('matched:') && animalSubjectTags.has(tag.slice('matched:'.length))))
    if (animalSubject && !hasAny(objectTags, animalHoshiiTags)) {
      addViolation(violations, sentence, complexity, seed, 'animal ほしい object is not animal-plausible')
    }
  }

  if (sentence.slots.subject?.dictionaryForm === '他人' || sentence.japanese.includes('他人が豊か')) {
    addViolation(violations, sentence, complexity, seed, 'context-dependent 他人 leaked into generated sentence')
  }

  return violations
}

const totals = new Map<GenerationComplexity, { generated: number; nulls: number; patterns: Set<string> }>()
const violations: Violation[] = []

for (const complexity of GENERATION_COMPLEXITIES) {
  const patterns = patternsForComplexity(complexity)
  totals.set(complexity, { generated: 0, nulls: 0, patterns: new Set() })

  for (const pattern of patterns) {
    for (let offset = 0; offset < seedsPerPattern; offset += 1) {
      const seed = complexity * 1_000_000 + pattern.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) * 1_000 + offset
      const sentence = generateCategorySentence(seed, pattern.id, pattern.jlpt as JlptLevel)
      const total = totals.get(complexity)!
      if (!sentence) {
        total.nulls += 1
        continue
      }
      total.generated += 1
      total.patterns.add(sentence.frameId)
      violations.push(...checkSentence(sentence, complexity, seed))
    }
  }
}

const byRule = new Map<string, Violation[]>()
for (const violation of violations) {
  const bucket = byRule.get(violation.rule) ?? []
  bucket.push(violation)
  byRule.set(violation.rule, bucket)
}

console.log(`Sentence regression audit (${seedsPerPattern} seeds per generator-ready pattern)`)
console.log('')
for (const complexity of GENERATION_COMPLEXITIES) {
  const total = totals.get(complexity)!
  console.log(`L${complexity}: generated=${total.generated}, nulls=${total.nulls}, coveredPatterns=${total.patterns.size}`)
}
console.log('')

if (!violations.length) {
  console.log('PASS: no regression violations found.')
  process.exit(0)
}

console.log(`FAIL: ${violations.length} regression violation(s) across ${byRule.size} rule(s).`)
console.log('')
for (const [rule, samples] of byRule) {
  console.log(`${rule}: ${samples.length}`)
  for (const sample of samples.slice(0, maxSamplesPerRule)) {
    console.log(`  L${sample.complexity} ${sample.patternId} seed=${sample.seed}: ${sample.japanese} / ${sample.english}`)
  }
  if (samples.length > maxSamplesPerRule) console.log(`  ... ${samples.length - maxSamplesPerRule} more`)
  console.log('')
}

process.exit(1)
