import { useCallback, useEffect, useState } from 'react'

const PROFILE_STORAGE_KEY = 'kanji-quest-user-profile-v1'
const PROFILE_EVENT = 'kanji-quest-user-profile-change'
const DEFAULT_NAME = 'Reed'
const PHOTO_SIZE = 256

export type UserProfile = {
  name: string
  photo: string | null
}

const DEFAULT_PROFILE: UserProfile = {
  name: DEFAULT_NAME,
  photo: null,
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<UserProfile>
  return typeof profile.name === 'string' && (profile.photo === null || typeof profile.photo === 'string')
}

export function loadUserProfile(): UserProfile {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) ?? 'null')
    if (!isUserProfile(parsed)) return DEFAULT_PROFILE
    const name = parsed.name.trim() || DEFAULT_NAME
    return { name, photo: parsed.photo }
  } catch {
    return DEFAULT_PROFILE
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

  useEffect(() => {
    function sync() {
      setProfile(loadUserProfile())
    }
    window.addEventListener(PROFILE_EVENT, sync)
    return () => window.removeEventListener(PROFILE_EVENT, sync)
  }, [])

  const updateProfile = useCallback((partial: Partial<UserProfile>) => {
    setProfile((current) => {
      const next = {
        name: (partial.name ?? current.name).trim() || DEFAULT_NAME,
        photo: partial.photo === undefined ? current.photo : partial.photo,
      }
      saveUserProfile(next)
      return next
    })
  }, [])

  return [profile, updateProfile] as const
}
