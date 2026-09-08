import { accountSyncStatusText, isAccountSyncConfigured, loadAccountSyncState } from '../lib/accountSync'
import { exportProgressBackup, progressBackupStats } from '../lib/progressBackup'
import { AppBackButton } from './AppBackButton'

function formatBackupSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BackupSyncPage({ onBack }: { onBack: () => void }) {
  const syncState = loadAccountSyncState()
  const syncConfigured = isAccountSyncConfigured()
  const progressStats = progressBackupStats()
  const syncActionDisabled = !syncConfigured || syncState.status !== 'signed-in'

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
        <p>Sign-in will stay optional. When cloud sync is connected, this screen can back up progress without changing the local-first app.</p>
        <div className="backup-sync-auth-grid">
          <button type="button" disabled={!syncConfigured}>Continue with Google</button>
          <button type="button" disabled={!syncConfigured}>Continue with Apple</button>
          <button type="button" disabled={!syncConfigured}>Email sign in</button>
        </div>
      </section>

      <section className="backup-sync-panel" aria-label="First sync choices">
        <span className="settings-block-label">First sync</span>
        <div className="backup-sync-choice-grid">
          <button type="button" disabled={syncActionDisabled}>
            <b>Upload this device</b>
            <small>Use this browser as the source of truth.</small>
          </button>
          <button type="button" disabled={syncActionDisabled}>
            <b>Restore cloud backup</b>
            <small>Replace this device with cloud progress.</small>
          </button>
        </div>
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
