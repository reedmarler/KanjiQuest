import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createProgressBackupPayload, progressEntriesFromBackup, restoreProgressBackup, type ProgressBackupPayload } from './progressBackup'
import { getSupabaseClient } from './supabaseClient'

const ACCOUNT_SYNC_STORAGE_KEY = 'kanji-quest-account-sync-v1'
const CLOUD_PROGRESS_TABLE = 'user_progress'

export type AccountSyncStatus = 'local-only' | 'ready-to-connect' | 'signed-in'

export type AccountSyncState = {
  status: AccountSyncStatus
  provider: 'supabase' | null
  userId: string | null
  email: string | null
  lastSyncedAt: number | null
}

export type CloudProgressRow = {
  user_id: string
  progress_json: ProgressBackupPayload
  updated_at: string
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

function accountSyncStateFromUser(user: User | null): AccountSyncState {
  if (!user) return { ...DEFAULT_ACCOUNT_SYNC_STATE, status: isAccountSyncConfigured() ? 'ready-to-connect' : 'local-only' }
  return {
    status: 'signed-in',
    provider: 'supabase',
    userId: user.id,
    email: user.email ?? null,
    lastSyncedAt: loadAccountSyncState().lastSyncedAt,
  }
}

export function accountSyncStatusText(state = loadAccountSyncState()) {
  if (state.status === 'signed-in' && state.email) return `Signed in as ${state.email}`
  if (isAccountSyncConfigured()) return 'Optional cloud sync is ready to connect.'
  return 'Progress stays local until cloud sync is connected.'
}

export function accountSyncRedirectUrl() {
  return window.location.origin + window.location.pathname
}

async function getSignedInUser() {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Cloud sync is not configured yet.')
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Sign in before syncing progress.')
  return { supabase, user: data.user }
}

export async function signInWithProvider(provider: 'google' | 'apple') {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Cloud sync is not configured yet.')
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: accountSyncRedirectUrl() },
  })
  if (error) throw error
}

export async function sendEmailSignIn(email: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Cloud sync is not configured yet.')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: accountSyncRedirectUrl() },
  })
  if (error) throw error
}

export async function signOutOfAccount() {
  const supabase = getSupabaseClient()
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  saveAccountSyncState({ ...DEFAULT_ACCOUNT_SYNC_STATE, status: 'ready-to-connect' })
}

export async function uploadLocalProgressToCloud() {
  const { supabase, user } = await getSignedInUser()
  const payload = createProgressBackupPayload()
  const updatedAt = new Date().toISOString()
  const { error } = await supabase
    .from(CLOUD_PROGRESS_TABLE)
    .upsert({ user_id: user.id, progress_json: payload, updated_at: updatedAt }, { onConflict: 'user_id' })
  if (error) throw error
  saveAccountSyncState({ ...accountSyncStateFromUser(user), lastSyncedAt: Date.parse(updatedAt) })
}

export async function loadCloudProgress() {
  const { supabase, user } = await getSignedInUser()
  const { data, error } = await supabase
    .from(CLOUD_PROGRESS_TABLE)
    .select('user_id, progress_json, updated_at')
    .eq('user_id', user.id)
    .maybeSingle<CloudProgressRow>()
  if (error) throw error
  return data
}

export async function restoreCloudProgressToDevice() {
  const row = await loadCloudProgress()
  if (!row?.progress_json) throw new Error('No cloud backup was found for this account.')
  restoreProgressBackup(progressEntriesFromBackup(row.progress_json))
}

export function useAccountSync() {
  const configured = isAccountSyncConfigured()
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [syncState, setSyncState] = useState(loadAccountSyncState)

  const applySession = useCallback((session: Session | null) => {
    const next = accountSyncStateFromUser(session?.user ?? null)
    saveAccountSyncState(next)
    setSyncState(next)
  }, [])

  useEffect(() => {
    if (!supabase) {
      const next = { ...DEFAULT_ACCOUNT_SYNC_STATE, status: configured ? 'ready-to-connect' as const : 'local-only' as const }
      saveAccountSyncState(next)
      setSyncState(next)
      return
    }

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) applySession(data.session)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session) => {
      applySession(session)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [applySession, configured, supabase])

  return { configured, syncState }
}
