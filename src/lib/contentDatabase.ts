import type { JlptLevel } from './types'
import { inferPreferredTranslation } from '../data/preferredVocabularyTranslations'
import seedContentDatabase from '../data/seedContentDatabase.json'

export type ContentStatus = 'draft' | 'approved' | 'disabled'
export type ContentKind = 'verb' | 'vocabulary' | 'pattern'

export interface ContentRecord {
  id: string
  sourceId?: string
  kind: ContentKind
  japanese: string
  reading: string
  english: string
  preferredTranslation?: string
  jlpt?: JlptLevel
  category: string
  categories?: string[]
  tags: string[]
  status: ContentStatus
  source: 'kanji-quest' | 'manual' | 'generated'
  verbClass?: string
  transitivity?: 'transitive' | 'intransitive'
  allowedRoles: string[]
  approvedAt?: string
  reviewedAt?: string
  updatedAt: string
}

const DATABASE_KEY = 'kanji-quest-content-database-v1'
const DATABASE_EVENT = 'kanji-quest-content-database-change'

function storageAvailable() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

const senseRepairs: Record<string,{ category:string; english:string; preferredTranslation?:string; tags:string[] }> = {
  '表|omote': { category:'Places', english:'front / surface / outside', tags:['front','surface','exterior','relative-location','noun'] },
  '表|hyou': { category:'Objects', english:'table / chart / spreadsheet', preferredTranslation:'chart', tags:['table','chart','document','readable','noun'] },
  '表|ひょう': { category:'Objects', english:'table / chart / spreadsheet', preferredTranslation:'chart', tags:['table','chart','document','readable','noun'] },
  '人気|ninki': { category:'Objects', english:'popularity / popular', tags:['popularity','reputation','abstract','noun'] },
  '身|mi': { category:'Objects', english:'body / oneself', tags:['body','body-part','self','noun'] },
  '体|karada': { category:'Objects', english:'body', tags:['body','body-part','health','noun'] },
  '方|kata': { category:'Function Words', english:'person (polite; requires a modifier)', tags:['person-reference','polite','respectful','noun','requires-modifier'] },
  '者|mono': { category:'Function Words', english:'person (requires a modifier)', tags:['person-reference','noun','requires-modifier'] },
}

const wordRepairs: Record<string,{ category:string; english:string; preferredTranslation:string; tags:string[] }> = {
  '家庭': { category:'Objects', english:'household / family / home life', preferredTranslation:'household', tags:['household','family','abstract','noun'] },
  '通り': { category:'Places', english:'street / road / avenue', preferredTranslation:'street', tags:['street','road','route','urban','noun'] },
  '私自身': { category:'People & Living Things', english:'myself / I personally', preferredTranslation:'I', tags:['person','pronoun','speaker','human'] },
  '本人': { category:'People & Living Things', english:'the person himself or herself', preferredTranslation:'the person', tags:['person','individual','human'] },
  'ご飯': { category:'Food & Drink', english:'rice / meal', preferredTranslation:'meal', tags:['rice','meal','staple-food','edible'] },
  '男性': { category:'People & Living Things', english:'man / male person', preferredTranslation:'man', tags:['person','man','male','adult','human'] },
}

/**
 * Readings the source data records wrongly, as opposed to merely in romaji.
 *
 * Romaji readings are fine — they normalise to kana before rendering — but
 * these two normalise to the wrong kana: 十 was "juutoo" (じゅうとお rather
 * than じゅう) and 客観 was "kakkyoku" (かっきょく rather than きゃっかん). A
 * wrong reading renders as wrong furigana, which teaches the mistake.
 */
const readingRepairs: Record<string,string> = { '十':'じゅう', '客観':'きゃっかん' }

/**
 * Glosses for records the source data left as "Meaning needed".
 *
 * Only the ones that are ordinary vocabulary. The rest of that set is grammar —
 * しか, ばかり, ておく, なければならない — which has no noun gloss to give and is
 * excluded from generation anyway; inventing one would only let a particle into
 * a noun slot.
 */
const missingGlossRepairs: Record<string,{ category: string; english: string; preferredTranslation: string; tags: string[] }> = {
  'タバコ': { category:'Objects', english:'cigarette / tobacco', preferredTranslation:'cigarette', tags:['cigarette','tobacco','object','n5'] },
  'インターネット': { category:'Objects', english:'the internet', preferredTranslation:'the internet', tags:['internet','technology','object','n4'] },
  'イギリス': { category:'Places', english:'the United Kingdom / Britain', preferredTranslation:'Britain', tags:['country','place','n5'] },
  'フランス': { category:'Places', english:'France', preferredTranslation:'France', tags:['country','place','n5'] },
  'やめる': { category:'Actions', english:'to quit / to stop doing', preferredTranslation:'quit', tags:['verb','ichidan','transitive','n4'] },
  'つながる': { category:'Actions', english:'to be connected', preferredTranslation:'connect', tags:['verb','godan','intransitive','n3'] },
  'まとめる': { category:'Actions', english:'to gather together / to summarise', preferredTranslation:'summarise', tags:['verb','ichidan','transitive','n3'] },
  'つらい': { category:'Descriptors', english:'painful / tough', preferredTranslation:'tough', tags:['painful','difficult','i-adjective','n3'] },
  'すぐ': { category:'Descriptors', english:'immediately / right away', preferredTranslation:'immediately', tags:['immediately','adverb','n5'] },
  'すべて': { category:'Descriptors', english:'all / everything', preferredTranslation:'all', tags:['all','quantity','n3'] },
  'いろんな': { category:'Descriptors', english:'various / all sorts of', preferredTranslation:'various', tags:['various','noun-modifier','n4'] },
  'たまたま': { category:'Descriptors', english:'by chance / as it happens', preferredTranslation:'by chance', tags:['by-chance','adverb','n2'] },
}

/**
 * Tags that ran into the next record's headword during import: 覚える carried
 * `n5開く`, 政治 carried `n3-池`. The JLPT prefix is the real tag; the kanji is
 * a neighbouring entry that leaked in.
 */
function repairTag(tag: string): string {
  const match = /^(n[1-5])-?[぀-ヿ一-鿿]+$/.exec(tag)
  return match ? match[1]! : tag
}

function repairKnownCategoryErrors(record: ContentRecord): ContentRecord {
  if (record.kind !== 'vocabulary') return record
  const repairedReading = readingRepairs[record.japanese] ?? record.reading
  const repairedTags = record.tags.map(repairTag)
  if (repairedReading !== record.reading || repairedTags.some((tag,index) => tag !== record.tags[index])) {
    record = { ...record, reading:repairedReading, tags:repairedTags }
  }
  const missingGloss = /meaning needed/i.test(record.english ?? '') ? missingGlossRepairs[record.japanese] : undefined
  if (missingGloss) {
    return { ...record, english:missingGloss.english, preferredTranslation:missingGloss.preferredTranslation, category:missingGloss.category, categories:[missingGloss.category], tags:[...missingGloss.tags], allowedRoles:[missingGloss.category] }
  }
  const senseRepair=senseRepairs[`${record.japanese}|${record.reading.trim().toLowerCase()}`] ?? wordRepairs[record.japanese]
  if (senseRepair) return { ...record, english:senseRepair.english, preferredTranslation:senseRepair.preferredTranslation ?? record.preferredTranslation, category:senseRepair.category, categories:[senseRepair.category], tags:[...senseRepair.tags], allowedRoles:[senseRepair.category] }
  const tags = record.tags.map(tag => tag.trim().replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase().replace(/[_\s]+/g,'-'))
  if (!tags.some(tag => ['body-part','bodypart','blood','anatomy'].includes(tag))) return record
  return { ...record, category:'Objects', categories:['Objects'], allowedRoles:['Objects'] }
}

/**
 * Records shipped with the build. The reviewed database otherwise lives only in
 * the browser that created it, so a fresh install — a different machine, a
 * cleared cache — would generate sentences from the built-in catalog alone.
 * Seeding runs once; after that the stored copy is the source of truth and is
 * free to diverge.
 */
function seedRecords(): ContentRecord[] {
  const records = seedContentDatabase.records as unknown as ContentRecord[]
  return Array.isArray(records) ? records : []
}

/**
 * The repairs every record gets, whatever route it arrives by.
 *
 * This used to run only over records parsed back out of localStorage, so the
 * seed path and the no-storage path returned unrepaired data. The effect was a
 * silent split: the browser generated sentences from repaired records while
 * offline generation and the audit scripts — which have no localStorage and go
 * straight to the seed — saw the raw ones, and a fresh install saw raw records
 * until its first reload. Two sources of truth for the same vocabulary is
 * exactly the kind of divergence the audits exist to catch, and it made them
 * measure something other than what the app shows.
 */
function migrateRecords(records: ContentRecord[]): ContentRecord[] {
  return records.map(record => {
    const repaired = repairKnownCategoryErrors(record)
    if (repaired.kind !== 'vocabulary' || repaired.preferredTranslation?.trim()) return repaired
    return { ...repaired, preferredTranslation:inferPreferredTranslation(repaired.japanese,repaired.english,repaired.reading) }
  })
}

export function loadContentDatabase(): ContentRecord[] {
  // Outside the browser (build scripts such as generate:vocab-examples) there
  // is no localStorage, but the committed seed file still holds the reviewed
  // records. Returning it here is what lets offline generation see the same
  // approved vocabulary the app does, instead of falling back to bare defaults.
  if (!storageAvailable()) return migrateRecords(seedRecords())
  try {
    const stored = window.localStorage.getItem(DATABASE_KEY)
    if (!stored) {
      const seed = migrateRecords(seedRecords())
      if (!seed.length) return []
      window.localStorage.setItem(DATABASE_KEY, JSON.stringify(seed))
      return seed
    }
    const parsed = JSON.parse(stored) as ContentRecord[]
    const migrated = migrateRecords(parsed)
    if (JSON.stringify(migrated) !== JSON.stringify(parsed)) window.localStorage.setItem(DATABASE_KEY,JSON.stringify(migrated))
    return migrated
  } catch {
    return []
  }
}

export function saveContentDatabase(records: ContentRecord[]) {
  if (!storageAvailable()) return
  window.localStorage.setItem(DATABASE_KEY, JSON.stringify(records))
  window.dispatchEvent(new CustomEvent(DATABASE_EVENT, { detail: records }))
}

export function upsertContentRecord(record: ContentRecord) {
  upsertContentRecords([record])
  return record
}

export function upsertContentRecords(incoming: ContentRecord[]) {
  const records = loadContentDatabase()
  for (const record of incoming) {
    const match = records.findIndex(item => item.id === record.id || Boolean(record.sourceId && item.sourceId === record.sourceId))
    if (match >= 0) records[match] = record
    else records.push(record)
  }
  saveContentDatabase(records)
  return incoming
}

export function getApprovedContentRecords() {
  return loadContentDatabase().filter(record => record.status === 'approved')
}

export function disableContentRecord(id: string) {
  saveContentDatabase(loadContentDatabase().map(record => record.id === id
    ? { ...record, status: 'disabled' as const, updatedAt: new Date().toISOString() }
    : record))
}

export function subscribeToContentDatabase(listener: (records: ContentRecord[]) => void) {
  if (typeof window === 'undefined') return () => undefined
  const handle = (event: Event) => listener((event as CustomEvent<ContentRecord[]>).detail)
  window.addEventListener(DATABASE_EVENT, handle)
  return () => window.removeEventListener(DATABASE_EVENT, handle)
}

export function exportContentDatabase() {
  const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records: loadContentDatabase() }, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `kanji-quest-content-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
