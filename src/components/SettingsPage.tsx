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
        <h1>Settings</h1>
      </header>

      <section className="dashboard-profile-section settings-toggle-list" aria-label="App-Wide Defaults">
        <span className="dashboard-profile-section-label">App-Wide Defaults</span>
        <button
          type="button"
          className="dashboard-profile-toggle-row"
          onClick={onToggleFurigana}
          aria-pressed={furiganaOn}
          aria-label={`Furigana ${furiganaOn ? 'on' : 'off'}`}
        >
          <span className="dashboard-profile-toggle-label">Furigana</span>
          <span className={`control-chip control-chip-compact app-display-toggle dashboard-profile-display-toggle${furiganaOn ? ' is-active' : ''}`} aria-hidden="true">
            &#12405;&#12426;
          </span>
        </button>
        <button
          type="button"
          className="dashboard-profile-toggle-row"
          onClick={onToggleEnglish}
          aria-pressed={englishOn}
          aria-label={`English ${englishOn ? 'on' : 'off'}`}
        >
          <span className="dashboard-profile-toggle-label">English</span>
          <span className={`control-chip control-chip-compact app-display-toggle dashboard-profile-display-toggle${englishOn ? ' is-active' : ''}`} aria-hidden="true">
            EN
          </span>
        </button>
      </section>
    </main>
  )
}
