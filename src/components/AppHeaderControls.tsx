import { displayProfilePhoto } from '../lib/userProfile'

/**
 * Profile + settings pair used on the main hub tabs on phones. Desktop puts
 * the same actions inside the primary nav, so these stay hidden there.
 */
export function AppHeaderControls({
  hideUser = false,
  profileOpen = false,
  settingsOpen = false,
  profileName: _profileName,
  profilePhoto,
  onProfile,
  onSettings,
}: {
  hideUser?: boolean
  profileOpen?: boolean
  settingsOpen?: boolean
  profileName: string
  profilePhoto: string | null
  onProfile: () => void
  onSettings: () => void
}) {
  return (
    <>
      <button
        type="button"
        className={`dashboard-profile-placeholder${profileOpen ? ' is-active' : ''}${hideUser ? ' is-hidden' : ''}`}
        onClick={onProfile}
        aria-label="Open user menu"
        aria-expanded={profileOpen}
        aria-controls="dashboard-profile-menu"
        title="User menu"
        tabIndex={hideUser ? -1 : undefined}
      >
        <img src={displayProfilePhoto(profilePhoto)} alt="" />
      </button>
      <button
        type="button"
        className={`dashboard-page-settings control-icon-button control-settings-button${settingsOpen ? ' is-active' : ''}`}
        onClick={onSettings}
        aria-label={settingsOpen ? 'Hide settings' : 'Show settings'}
        aria-expanded={settingsOpen}
        title={settingsOpen ? 'Hide settings' : 'Show settings'}
      >
        <span aria-hidden="true">&#9881;</span>
      </button>
    </>
  )
}
