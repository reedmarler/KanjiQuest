// 1x is the centered video-speed-picker baseline. Below it steps down to 0.1x
// and above it widens out (1.25/1.5/2/2.5/3x). What "1x"
// actually *feels* like is defined in RotatingHeroSentence's base duration
// constants as (prior 1x) / 0.7 — i.e. 30% slower than the previous 1x —
// with every other step's real-world speed scaled off that same baseline.
export const HERO_PLAYBACK_RATES = [
  0.1, 0.3, 0.5, 0.7, 0.9, 1, 1.25, 1.5, 2, 2.5, 3,
] as const
export type HeroPlaybackRate = typeof HERO_PLAYBACK_RATES[number]
export const HERO_SPEED_STORAGE_KEY = 'kanji-quest-hero-playback-rate-v3'
