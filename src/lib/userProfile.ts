import { useCallback, useEffect, useRef, useState } from 'react'

const PROFILE_STORAGE_KEY = 'kanji-quest-user-profile-v1'
const PROFILE_EVENT = 'kanji-quest-user-profile-change'
const DEFAULT_NAME = 'Reed'
export const DEFAULT_PROFILE_PHOTO = '/apple-touch-icon.png'
const PHOTO_SIZE = 256

export type UserProfile = {
  name: string
  photo: string | null
  /** Free-text status line the learner can set on the profile page. */
  tagline: string
  /** Epoch ms of the first time this profile was written; drives "Member since". */
  createdAt: number
}

export const TAGLINE_MAX = 60

const DEFAULT_PROFILE: UserProfile = {
  name: DEFAULT_NAME,
  photo: null,
  tagline: '',
  createdAt: 0,
}

function isStoredProfile(value: unknown): value is Partial<UserProfile> {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<UserProfile>
  return typeof profile.name === 'string' && (profile.photo == null || typeof profile.photo === 'string')
}

export function loadUserProfile(): UserProfile {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) ?? 'null')
    if (!isStoredProfile(parsed)) return { ...DEFAULT_PROFILE, createdAt: Date.now() }
    return {
      name: (parsed.name ?? '').trim() || DEFAULT_NAME,
      photo: parsed.photo ?? null,
      tagline: typeof parsed.tagline === 'string' ? parsed.tagline.slice(0, TAGLINE_MAX) : '',
      // Back-fill for profiles saved before this field existed, so the date is
      // stable from here on rather than jumping every render.
      createdAt: typeof parsed.createdAt === 'number' && parsed.createdAt > 0 ? parsed.createdAt : Date.now(),
    }
  } catch {
    return { ...DEFAULT_PROFILE, createdAt: Date.now() }
  }
}

export function formatMemberSince(createdAt: number): string {
  if (!createdAt) return ''
  try {
    return new Date(createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}

function saveUserProfile(profile: UserProfile) {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // A full store should not break renaming in this session.
  }
  window.dispatchEvent(new Event(PROFILE_EVENT))
}

export function profileInitial(name: string) {
  return (name.trim()[0] || '?').toUpperCase()
}

export function displayProfilePhoto(photo: string | null) {
  return photo || DEFAULT_PROFILE_PHOTO
}

export async function readProfilePhoto(file: File) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image()
      next.onload = () => resolve(next)
      next.onerror = () => reject(new Error('That image could not be opened.'))
      next.src = objectUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = PHOTO_SIZE
    canvas.height = PHOTO_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not process that image.')
    const edge = Math.min(image.width, image.height)
    const sx = (image.width - edge) / 2
    const sy = (image.height - edge) / 2
    context.drawImage(image, sx, sy, edge, edge, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function useUserProfile() {
  const [profile, setProfile] = useState(loadUserProfile)
  // Mirrors the current profile so updateProfile can merge a partial without a
  // functional setState updater — the persistence side effect (which dispatches
  // a DOM event other subscribers react to) must run in the caller's event
  // handler, never inside a render-phase updater.
  const profileRef = useRef(profile)
  profileRef.current = profile

  useEffect(() => {
    function sync() {
      setProfile(loadUserProfile())
    }
    window.addEventListener(PROFILE_EVENT, sync)
    return () => window.removeEventListener(PROFILE_EVENT, sync)
  }, [])

  const updateProfile = useCallback((partial: Partial<UserProfile>) => {
    const current = profileRef.current
    const next: UserProfile = {
      name: (partial.name ?? current.name).trim() || DEFAULT_NAME,
      photo: partial.photo === undefined ? current.photo : partial.photo,
      tagline: (partial.tagline === undefined ? current.tagline : partial.tagline).trim().slice(0, TAGLINE_MAX),
      createdAt: current.createdAt || Date.now(),
    }
    profileRef.current = next
    setProfile(next)
    saveUserProfile(next)
  }, [])

  return [profile, updateProfile] as const
}
