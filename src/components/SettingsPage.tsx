import { AppBackButton } from './AppBackButton'

type SettingsPageProps = {
  onBack: () => void
  furiganaOn: boolean
  englishOn: boolean
  onToggleFurigana: () => void
  onToggleEnglish: () => void
}

/**
 * Full-page home for the default reading preferences shared across tools.
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
        <h1>Settings</h1>
      </header>

      <section className="dashboard-profile-section settings-toggle-list" aria-label="Default Preferences">
        <span className="dashboard-profile-section-label">Default Preferences</span>
        <div className="dashboard-profile-toggle-row">
          <span>Furigana</span>
          <button
            type="button"
            className={`control-chip control-chip-compact app-display-toggle dashboard-profile-display-toggle${furiganaOn ? ' is-active' : ''}`}
            onClick={onToggleFurigana}
            aria-pressed={furiganaOn}
            aria-label={`Furigana ${furiganaOn ? 'on' : 'off'}`}
          >
            &#12405;&#12426;
          </button>
        </div>
        <div className="dashboard-profile-toggle-row">
          <span>English</span>
          <button
            type="button"
            className={`control-chip control-chip-compact app-display-toggle dashboard-profile-display-toggle${englishOn ? ' is-active' : ''}`}
            onClick={onToggleEnglish}
            aria-pressed={englishOn}
            aria-label={`English ${englishOn ? 'on' : 'off'}`}
          >
            EN
          </button>
        </div>
      </section>
    </main>
  )
}
