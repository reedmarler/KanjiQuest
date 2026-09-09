import { useEffect, useState, type FormEvent } from 'react'
import {
  accountSyncStatusText,
  loadCloudProgress,
  restoreCloudProgressToDevice,
  sendEmailSignIn,
  signInWithProvider,
  signOutOfAccount,
  uploadLocalProgressToCloud,
  useAccountSync,
} from '../lib/accountSync'
import { exportProgressBackup, progressBackupStats } from '../lib/progressBackup'
import { AppBackButton } from './AppBackButton'

function formatBackupSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BackupSyncPage({ onBack }: { onBack: () => void }) {
  const { configured: syncConfigured, syncState } = useAccountSync()
  const progressStats = progressBackupStats()
  const signedIn = syncState.status === 'signed-in'
  const syncActionDisabled = !syncConfigured || !signedIn
  const [email, setEmail] = useState('')
  const [cloudSummary, setCloudSummary] = useState('No cloud backup loaded yet.')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!signedIn) {
      setCloudSummary(syncConfigured ? 'Sign in to check for a cloud backup.' : 'Connect Supabase to enable cloud backup.')
      return
    }
    let mounted = true
    loadCloudProgress()
      .then((row) => {
        if (!mounted) return
        setCloudSummary(row
          ? `Cloud backup from ${new Date(row.updated_at).toLocaleString()}`
          : 'No cloud backup found for this account yet.')
      })
      .catch((error: unknown) => {
        if (mounted) setCloudSummary(error instanceof Error ? error.message : 'Could not check cloud backup.')
      })
    return () => { mounted = false }
  }, [signedIn, syncConfigured])

  async function runAction(label: string, action: () => Promise<void>, success: string) {
    setBusy(label)
    setMessage('')
    try {
      await action()
      setMessage(success)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  function submitEmail(event: FormEvent) {
    event.preventDefault()
    void runAction(
      'email',
      () => sendEmailSignIn(email.trim()),
      'Check your email for a Kanji Quest sign-in link.',
    )
  }

  function restoreCloudBackup() {
    const confirmed = window.confirm('Restore cloud backup to this device? This replaces local progress and reloads the app.')
    if (!confirmed) return
    void runAction('restore', restoreCloudProgressToDevice, 'Cloud progress restored.')
  }

  return (
    <main className="account-page backup-sync-page">
      <header className="account-page-heading">
        <AppBackButton onClick={onBack} aria-label="Back" />
        <small>Account</small>
        <h1>Backup & Sync</h1>
        <p>{accountSyncStatusText(syncState)}</p>
      </header>

      <section className="backup-sync-status" aria-label="Local progress">
        <div className="backup-sync-status-mark" aria-hidden="true">保</div>
        <div>
          <span>Local progress</span>
          <b>Saved on this device</b>
          <small>{progressStats.entries} entries · {formatBackupSize(progressStats.bytes)}</small>
        </div>
      </section>

      <section className="backup-sync-panel" aria-label="Cloud sign in">
        <span className="settings-block-label">Cloud backup</span>
        <p>Sign-in stays optional. This device keeps working locally, and cloud backup only turns on when you connect an account.</p>
        {signedIn && syncState.email && <p className="backup-sync-signed-in">Signed in as {syncState.email}</p>}
        <div className="backup-sync-auth-grid">
          <button type="button" disabled={!syncConfigured || Boolean(busy)} onClick={() => void runAction('google', () => signInWithProvider('google'), 'Opening Google sign-in...')}>Continue with Google</button>
          <button type="button" disabled={!syncConfigured || Boolean(busy)} onClick={() => void runAction('apple', () => signInWithProvider('apple'), 'Opening Apple sign-in...')}>Continue with Apple</button>
        </div>
        <form className="backup-sync-email-form" onSubmit={submitEmail}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            disabled={!syncConfigured || Boolean(busy)}
            aria-label="Email address"
          />
          <button type="submit" disabled={!syncConfigured || Boolean(busy) || !email.trim()}>Email sign in</button>
        </form>
        {signedIn && (
          <button type="button" className="backup-sync-secondary" disabled={Boolean(busy)} onClick={() => void runAction('signout', signOutOfAccount, 'Signed out. Local progress is still on this device.')}>
            Sign out
          </button>
        )}
      </section>

      <section className="backup-sync-panel" aria-label="First sync choices">
        <span className="settings-block-label">First sync</span>
        <p>{cloudSummary}</p>
        <div className="backup-sync-choice-grid">
          <button type="button" disabled={syncActionDisabled || Boolean(busy)} onClick={() => void runAction('upload', uploadLocalProgressToCloud, 'This device is backed up to the cloud.')}>
            <b>Upload this device</b>
            <small>Use this browser as the source of truth.</small>
          </button>
          <button type="button" disabled={syncActionDisabled || Boolean(busy)} onClick={restoreCloudBackup}>
            <b>Restore cloud backup</b>
            <small>Replace this device with cloud progress.</small>
          </button>
        </div>
        {message && <p className="backup-sync-message">{message}</p>}
      </section>

      <section className="backup-sync-panel" aria-label="Manual backup">
        <span className="settings-block-label">Manual backup</span>
        <button type="button" className="backup-sync-export" onClick={exportProgressBackup}>
          Export progress file
        </button>
      </section>
    </main>
  )
}
