export const HERO_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const
export type HeroPlaybackRate = typeof HERO_PLAYBACK_RATES[number]
export const HERO_SPEED_STORAGE_KEY = 'kanji-quest-hero-playback-rate-v2'
