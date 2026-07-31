// 1x is a normal video-speed-picker baseline: below it steps in flat 0.1
// intervals down to 0.1x, above it widens out (1.25/1.5/2/3x). What "1x"
// actually *feels* like is not the original 1x, though: it's defined in
// RotatingHeroSentence's base duration constants as (old 1x) * 0.6 — i.e.
// as slow as the old 0.6x step used to be — with every other step's
// real-world speed scaled off that same redefined baseline.
export const HERO_PLAYBACK_RATES = [
  0.1, 0.3, 0.5, 0.7, 0.9, 1, 1.25, 1.5, 2, 3,
] as const
export type HeroPlaybackRate = typeof HERO_PLAYBACK_RATES[number]
export const HERO_SPEED_STORAGE_KEY = 'kanji-quest-hero-playback-rate-v2'
