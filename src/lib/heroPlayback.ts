// 1x was reduced 40% (to 0.6x) and every other step scaled by that same
// 0.6 factor, so the whole ladder shifted down proportionally rather than
// just the one value.
export const HERO_PLAYBACK_RATES = [0.06, 0.12, 0.18, 0.24, 0.3, 0.45, 0.6, 0.75, 0.9] as const
export type HeroPlaybackRate = typeof HERO_PLAYBACK_RATES[number]
export const HERO_SPEED_STORAGE_KEY = 'kanji-quest-hero-playback-rate-v2'
