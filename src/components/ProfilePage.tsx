import { useRef, useState, type FormEvent } from 'react'
import { profileInitial, readProfilePhoto, useUserProfile } from '../lib/userProfile'
import { AppBackButton } from './AppBackButton'

export function ProfilePage({ onBack }: { onBack: () => void }) {
  const [profile, updateProfile] = useUserProfile()
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(profile.name)
  const photoRef = useRef<HTMLInputElement | null>(null)

  function startRename() {
    setDraftName(profile.name)
    setEditingName(true)
  }

  function saveName(event?: FormEvent) {
    event?.preventDefault()
    updateProfile({ name: draftName })
    setEditingName(false)
  }

  async function changePhoto(file: File | undefined) {
    if (!file) return
    updateProfile({ photo: await readProfilePhoto(file) })
  }

  return (
    <main className="account-page">
      <header className="account-page-heading">
        <AppBackButton onClick={onBack} aria-label="Back" />
        <small>Account</small>
        <h1>Profile</h1>
      </header>

      <section className="account-profile-card">
        <button
          type="button"
          className="account-profile-photo"
          onClick={() => photoRef.current?.click()}
          aria-label={profile.photo ? 'Change profile picture' : 'Add a profile picture'}
        >
          {profile.photo
            ? <img src={profile.photo} alt="" />
            : <span aria-hidden="true">{profileInitial(profile.name)}</span>}
          <small>{profile.photo ? 'Change' : 'Add photo'}</small>
        </button>

        {editingName ? (
          <form className="account-profile-name-form" onSubmit={saveName}>
            <label>
              <span>Name</span>
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => saveName()}
                autoFocus
                maxLength={32}
                aria-label="In-app name"
              />
            </label>
          </form>
        ) : (
          <button type="button" className="account-profile-name" onClick={startRename}>
            <small>Name</small>
            <b>{profile.name}</b>
          </button>
        )}
      </section>

      <section className="account-profile-fields" aria-label="Profile details">
        <article>
          <span>Device</span>
          <small>This browser</small>
        </article>
        <article>
          <span>Sync</span>
          <small>Local only</small>
        </article>
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
