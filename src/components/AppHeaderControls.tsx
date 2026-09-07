/**
 * The same profile-placeholder + settings pair the Dashboard shows in its
 * top corners, reused on the other main tabs (Quests, Study Tools, Beginner
 * Zone, More) in place of a back button — those tabs are reached from the
 * bottom nav now, so a way back up the stack isn't needed there.
 */
export function AppHeaderControls() {
  return (
    <>
      <button
        type="button"
        className="dashboard-profile-placeholder"
        aria-label="User profile"
        title="User profile"
      >
        <span aria-hidden="true">U</span>
      </button>
      <button
        type="button"
        className="dashboard-page-settings control-icon-button control-settings-button"
        aria-label="Settings"
        title="Settings"
      >
        <span aria-hidden="true">&#9881;</span>
      </button>
    </>
  )
}
