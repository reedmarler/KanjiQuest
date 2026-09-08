const ACCOUNT_SYNC_STORAGE_KEY = 'kanji-quest-account-sync-v1'

export type AccountSyncStatus = 'local-only' | 'ready-to-connect' | 'signed-in'

export type AccountSyncState = {
  status: AccountSyncStatus
  provider: 'supabase' | null
  userId: string | null
  email: string | null
  lastSyncedAt: number | null
}

export const DEFAULT_ACCOUNT_SYNC_STATE: AccountSyncState = {
  status: 'local-only',
  provider: null,
  userId: null,
  email: null,
  lastSyncedAt: null,
}

export function isAccountSyncConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

function isAccountSyncState(value: unknown): value is Partial<AccountSyncState> {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<AccountSyncState>
  return !state.status || ['local-only', 'ready-to-connect', 'signed-in'].includes(state.status)
}

export function loadAccountSyncState(): AccountSyncState {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(ACCOUNT_SYNC_STORAGE_KEY) ?? 'null')
    if (!isAccountSyncState(parsed)) return DEFAULT_ACCOUNT_SYNC_STATE
    return {
      status: parsed.status ?? DEFAULT_ACCOUNT_SYNC_STATE.status,
      provider: parsed.provider === 'supabase' ? 'supabase' : null,
      userId: typeof parsed.userId === 'string' ? parsed.userId : null,
      email: typeof parsed.email === 'string' ? parsed.email : null,
      lastSyncedAt: typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null,
    }
  } catch {
    return DEFAULT_ACCOUNT_SYNC_STATE
  }
}

export function saveAccountSyncState(state: AccountSyncState) {
  window.localStorage.setItem(ACCOUNT_SYNC_STORAGE_KEY, JSON.stringify(state))
}

export function accountSyncStatusText(state = loadAccountSyncState()) {
  if (state.status === 'signed-in' && state.email) return `Signed in as ${state.email}`
  if (isAccountSyncConfigured()) return 'Optional cloud sync is ready to connect.'
  return 'Progress stays local until cloud sync is connected.'
}
