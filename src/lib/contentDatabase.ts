import type { JlptLevel } from './types'
import { inferPreferredTranslation } from '../data/preferredVocabularyTranslations'

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

const senseRepairs: Record<string,{ category:string; english:string; tags:string[] }> = {
  '表|omote': { category:'Places', english:'front / surface / outside', tags:['front','surface','exterior','relative-location','noun'] },
  '人気|ninki': { category:'Objects', english:'popularity / popular', tags:['popularity','reputation','abstract','noun'] },
  '身|mi': { category:'Objects', english:'body / oneself', tags:['body','body-part','self','noun'] },
  '体|karada': { category:'Objects', english:'body', tags:['body','body-part','health','noun'] },
  '方|kata': { category:'Function Words', english:'person (polite; requires a modifier)', tags:['person-reference','polite','respectful','noun','requires-modifier'] },
  '者|mono': { category:'Function Words', english:'person (requires a modifier)', tags:['person-reference','noun','requires-modifier'] },
}

function repairKnownCategoryErrors(record: ContentRecord): ContentRecord {
  if (record.kind !== 'vocabulary') return record
  const senseRepair=senseRepairs[`${record.japanese}|${record.reading.trim().toLowerCase()}`]
  if (senseRepair) return { ...record, english:senseRepair.english, category:senseRepair.category, categories:[senseRepair.category], tags:[...senseRepair.tags], allowedRoles:[senseRepair.category] }
  const tags = record.tags.map(tag => tag.trim().replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase().replace(/[_\s]+/g,'-'))
  if (!tags.some(tag => ['body-part','bodypart','blood','anatomy'].includes(tag))) return record
  return { ...record, category:'Objects', categories:['Objects'], allowedRoles:['Objects'] }
}

export function loadContentDatabase(): ContentRecord[] {
  if (!storageAvailable()) return []
  try {
    const stored = window.localStorage.getItem(DATABASE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as ContentRecord[]
    const migrated = parsed.map(record => {
      const repaired = repairKnownCategoryErrors(record)
      if (repaired.kind !== 'vocabulary' || repaired.preferredTranslation?.trim()) return repaired
      return { ...repaired, preferredTranslation:inferPreferredTranslation(repaired.japanese,repaired.english) }
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
