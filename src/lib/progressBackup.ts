export type ProgressBackupPayload = {
  app: 'Kanji Quest'
  version: string
  exportedAt: string
  localStorage: Record<string, string>
}

const BACKUP_VERSION = '0.0.0'

function isKanjiQuestStorageKey(key: string) {
  return key.startsWith('kanji-quest') || key.startsWith('kq-beginner')
}

export function kanjiQuestStorageSnapshot() {
  const snapshot: Record<string, string> = {}
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key || !isKanjiQuestStorageKey(key)) continue
    const value = window.localStorage.getItem(key)
    if (value !== null) snapshot[key] = value
  }
  return snapshot
}

export function progressBackupStats(snapshot = kanjiQuestStorageSnapshot()) {
  const entries = Object.keys(snapshot).length
  const bytes = new Blob([JSON.stringify(snapshot)]).size
  return { entries, bytes }
}

export function exportProgressBackup() {
  const payload: ProgressBackupPayload = {
    app: 'Kanji Quest',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    localStorage: kanjiQuestStorageSnapshot(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `kanji-quest-progress-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function progressEntriesFromBackup(parsed: unknown) {
  if (
    !parsed
    || typeof parsed !== 'object'
    || !('localStorage' in parsed)
    || !parsed.localStorage
    || typeof parsed.localStorage !== 'object'
  ) {
    throw new Error('That file does not look like a Kanji Quest progress export.')
  }

  const entries = Object.entries(parsed.localStorage as Record<string, unknown>)
    .filter(([key, value]) => isKanjiQuestStorageKey(key) && typeof value === 'string')

  if (entries.length === 0) throw new Error('No Kanji Quest progress data was found in that file.')
  return entries as Array<[string, string]>
}

export async function readProgressBackup(file: File) {
  return progressEntriesFromBackup(JSON.parse(await file.text()))
}

export function restoreProgressBackup(entries: Array<[string, string]>) {
  entries.forEach(([key, value]) => window.localStorage.setItem(key, value))
  window.location.reload()
}
