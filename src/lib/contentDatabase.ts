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

function repairKnownCategoryErrors(record: ContentRecord): ContentRecord {
  if (record.kind !== 'vocabulary') return record
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

export function loadContentDatabase(): ContentRecord[] {
  // Outside the browser (build scripts such as generate:vocab-examples) there
  // is no localStorage, but the committed seed file still holds the reviewed
  // records. Returning it here is what lets offline generation see the same
  // approved vocabulary the app does, instead of falling back to bare defaults.
  if (!storageAvailable()) return seedRecords()
  try {
    const stored = window.localStorage.getItem(DATABASE_KEY)
    if (!stored) {
      const seed = seedRecords()
      if (!seed.length) return []
      window.localStorage.setItem(DATABASE_KEY, JSON.stringify(seed))
      return seed
    }
    const parsed = JSON.parse(stored) as ContentRecord[]
    const migrated = parsed.map(record => {
      const repaired = repairKnownCategoryErrors(record)
      if (repaired.kind !== 'vocabulary' || repaired.preferredTranslation?.trim()) return repaired
      return { ...repaired, preferredTranslation:inferPreferredTranslation(repaired.japanese,repaired.english,repaired.reading) }
    })
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
