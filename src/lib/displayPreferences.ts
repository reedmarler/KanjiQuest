export const APP_FURIGANA_DEFAULT_KEY = 'kanji-quest-app-furigana-default-v1'
export const APP_ENGLISH_DEFAULT_KEY = 'kanji-quest-app-english-default-v1'

export function loadBooleanPreference(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback

  try {
    const stored = window.localStorage.getItem(key)
    return stored === null ? fallback : stored === 'true'
  } catch {
    return fallback
  }
}

export function hasBooleanPreference(key: string) {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

export function saveBooleanPreference(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // Display preferences can safely remain in memory when storage is unavailable.
  }
}

export function loadDisplayPreference(key: string, appDefault: boolean) {
  return loadBooleanPreference(key, appDefault)
}
