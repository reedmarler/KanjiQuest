import { useMemo, useRef, useState, type FormEvent } from 'react'
import {
  displayProfilePhoto,
  formatMemberSince,
  readProfilePhoto,
  TAGLINE_MAX,
  useUserProfile,
} from '../lib/userProfile'
import { loadProgress, loadStats } from '../lib/storage'
import { isLearned } from '../lib/srs'
import { isQuestComplete, loadQuestProgress } from '../lib/questProgress'
import { QUESTS } from '../data/questCampaign'
import { accountSyncStatusText, isAccountSyncConfigured, loadAccountSyncState } from '../lib/accountSync'
import { AppBackButton } from './AppBackButton'

type ProfileStat = { label: string; value: string }

function useProfileStats(): ProfileStat[] {
  return useMemo(() => {
    const stats = loadStats()
    const cardsLearned = Object.values(loadProgress()).filter(isLearned).length
    const questProgress = loadQuestProgress()
    const questsCleared = QUESTS.filter((quest) => isQuestComplete(questProgress, quest.id)).length
    return [
      { label: 'Day streak', value: String(stats.streak) },
      { label: 'Cards learned', value: cardsLearned.toLocaleString() },
      { label: 'Reviews', value: stats.totalReviews.toLocaleString() },
      { label: 'Quests cleared', value: `${questsCleared}/${QUESTS.length}` },
    ]
  }, [])
}

export function ProfilePage({ onBack }: { onBack: () => void }) {
  const [profile, updateProfile] = useUserProfile()
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(profile.name)
  const [editingTagline, setEditingTagline] = useState(false)
  const [draftTagline, setDraftTagline] = useState(profile.tagline)
  const photoRef = useRef<HTMLInputElement | null>(null)
  const stats = useProfileStats()
  const memberSince = formatMemberSince(profile.createdAt)
  const syncState = useMemo(() => loadAccountSyncState(), [])
  const syncLabel = syncState.status === 'signed-in'
    ? 'Signed in'
    : isAccountSyncConfigured() ? 'Ready to connect' : 'Local only'

  function startRename() {
    setDraftName(profile.name)
    setEditingName(true)
  }

  function saveName(event?: FormEvent) {
    event?.preventDefault()
    updateProfile({ name: draftName })
    setEditingName(false)
  }

  function startTagline() {
    setDraftTagline(profile.tagline)
    setEditingTagline(true)
  }

  function saveTagline(event?: FormEvent) {
    event?.preventDefault()
    updateProfile({ tagline: draftTagline })
    setEditingTagline(false)
  }

  async function changePhoto(file: File | undefined) {
    if (!file) return
    updateProfile({ photo: await readProfilePhoto(file) })
  }

  return (
    <main className="account-page profile-page">
      <header className="account-page-heading">
        <AppBackButton onClick={onBack} aria-label="Back" />
        <small>You</small>
        <h1>Profile</h1>
      </header>

      <section className="profile-hero">
        <button
          type="button"
          className="profile-hero-photo"
          onClick={() => photoRef.current?.click()}
          aria-label="Change profile picture"
        >
          <img src={displayProfilePhoto(profile.photo)} alt="" />
          <span aria-hidden="true">Change</span>
        </button>

        <div className="profile-hero-identity">
          <span className="profile-hero-label">Name</span>
          {editingName ? (
            <form className="profile-hero-name-form" onSubmit={saveName}>
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => saveName()}
                autoFocus
                maxLength={32}
                aria-label="In-app name"
              />
            </form>
          ) : (
            <button type="button" className="profile-hero-name" onClick={startRename}>
              <b>{profile.name}</b>
              <em>Edit</em>
            </button>
          )}

          {editingTagline ? (
            <form className="profile-hero-tagline-form" onSubmit={saveTagline}>
              <input
                value={draftTagline}
                onChange={(event) => setDraftTagline(event.target.value)}
                onBlur={() => saveTagline()}
                autoFocus
                maxLength={TAGLINE_MAX}
                placeholder="Add a tagline"
                aria-label="Profile tagline"
              />
            </form>
          ) : (
            <button
              type="button"
              className={`profile-hero-tagline${profile.tagline ? '' : ' is-empty'}`}
              onClick={startTagline}
            >
              {profile.tagline || 'Add a tagline'}
            </button>
          )}

          {memberSince && <p className="profile-hero-since">Member since {memberSince}</p>}
        </div>
      </section>

      <section className="profile-stats" aria-label="Your progress">
        {stats.map((stat) => (
          <article key={stat.label}>
            <b>{stat.value}</b>
            <span>{stat.label}</span>
          </article>
        ))}
      </section>

      <section className="profile-fields" aria-label="Account">
        <article>
          <span>Device</span>
          <small>This browser</small>
        </article>
        <article>
          <span>Sync</span>
          <small>{syncLabel}</small>
        </article>
        <p className="profile-fields-note">{accountSyncStatusText(syncState)}</p>
      </section>

      <input
        ref={photoRef}
        className="dashboard-profile-file"
        type="file"
        accept="image/*"
        onChange={(event) => {
          void changePhoto(event.currentTarget.files?.[0])
          event.currentTarget.value = ''
        }}
      />
    </main>
  )
}
