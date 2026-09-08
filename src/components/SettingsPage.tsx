import { AppBackButton } from './AppBackButton'

type SettingsPageProps = {
  onBack: () => void
  furiganaOn: boolean
  englishOn: boolean
  onToggleFurigana: () => void
  onToggleEnglish: () => void
}

/**
 * Full-page home for the study settings that used to live only in the gear
 * popover. The popover stays for quick tweaks; this is where the profile menu's
 * "Learning settings" now goes.
 */
export function SettingsPage({
  onBack,
  furiganaOn,
  englishOn,
  onToggleFurigana,
  onToggleEnglish,
}: SettingsPageProps) {
  return (
    <main className="account-page settings-page">
      <header className="account-page-heading">
        <AppBackButton onClick={onBack} aria-label="Back" />
        <small>Preferences</small>
        <h1>Learning settings</h1>
      </header>

      <section className="dashboard-profile-section settings-toggle-list" aria-label="Reading defaults">
        <span className="dashboard-profile-section-label">Reading defaults</span>
        <div className="dashboard-profile-toggle-row">
          <span>Furigana default</span>
          <button
            type="button"
            className={`dashboard-profile-switch${furiganaOn ? ' is-on' : ''}`}
            onClick={onToggleFurigana}
            aria-pressed={furiganaOn}
            aria-label={`Furigana default ${furiganaOn ? 'on' : 'off'}`}
          >
            <i />
          </button>
        </div>
        <div className="dashboard-profile-toggle-row">
          <span>English default</span>
          <button
            type="button"
            className={`dashboard-profile-switch${englishOn ? ' is-on' : ''}`}
            onClick={onToggleEnglish}
            aria-pressed={englishOn}
            aria-label={`English default ${englishOn ? 'on' : 'off'}`}
          >
            <i />
          </button>
        </div>
      </section>
    </main>
  )
}
