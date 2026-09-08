import { GENERATION_COMPLEXITIES, type GenerationComplexity } from '../lib/generationComplexity'
import { COMPLEXITY_DISPLAY } from './Dashboard'
import { AppBackButton } from './AppBackButton'

type SettingsPageProps = {
  onBack: () => void
  complexity: GenerationComplexity
  onComplexityChange: (level: GenerationComplexity) => void
  furiganaOn: boolean
  englishOn: boolean
  speechOn: boolean
  speechSupported: boolean
  onToggleFurigana: () => void
  onToggleEnglish: () => void
  onToggleSpeech: () => void
}

/**
 * Full-page home for the study settings that used to live only in the gear
 * popover. The popover stays for quick tweaks; this is where the profile menu's
 * "Learning settings" now goes.
 */
export function SettingsPage({
  onBack,
  complexity,
  onComplexityChange,
  furiganaOn,
  englishOn,
  speechOn,
  speechSupported,
  onToggleFurigana,
  onToggleEnglish,
  onToggleSpeech,
}: SettingsPageProps) {
  return (
    <main className="account-page settings-page">
      <header className="account-page-heading">
        <AppBackButton onClick={onBack} aria-label="Back" />
        <small>Preferences</small>
        <h1>Learning settings</h1>
      </header>

      <section className="settings-block" aria-label="Sentence difficulty">
        <span className="settings-block-label">Sentence difficulty</span>
        <div className="control-segmented control-segmented-difficulty" role="group" aria-label="Sentence difficulty">
          {GENERATION_COMPLEXITIES.map((level) => (
            <button
              key={level}
              type="button"
              data-difficulty={level}
              className={`control-segment${complexity === level ? ' is-active' : ''}`}
              onClick={() => onComplexityChange(level)}
              aria-pressed={complexity === level}
              aria-label={`${COMPLEXITY_DISPLAY[level].level} ${COMPLEXITY_DISPLAY[level].name}: ${COMPLEXITY_DISPLAY[level].description}`}
              title={COMPLEXITY_DISPLAY[level].description}
            >
              <span className="control-level-code">{COMPLEXITY_DISPLAY[level].level}</span>
              <span className="control-level-name">{COMPLEXITY_DISPLAY[level].name}</span>
            </button>
          ))}
        </div>
        <p className="settings-block-hint">{COMPLEXITY_DISPLAY[complexity].description}</p>
      </section>

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
        <div className="dashboard-profile-toggle-row">
          <span>Voice</span>
          {!speechSupported && <small>Unavailable</small>}
          <button
            type="button"
            className={`dashboard-profile-switch${speechOn ? ' is-on' : ''}`}
            onClick={onToggleSpeech}
            disabled={!speechSupported}
            aria-pressed={speechOn}
            aria-label={`Voice ${speechOn ? 'on' : 'off'}`}
          >
            <i />
          </button>
        </div>
      </section>
    </main>
  )
}
