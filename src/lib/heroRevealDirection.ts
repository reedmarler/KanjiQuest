export const HERO_REVEAL_DIRECTIONS = [
  'ltr',
  'rtl',
  'ttb',
  'btt',
  'center',
] as const

export type HeroRevealDirection = (typeof HERO_REVEAL_DIRECTIONS)[number]

export function revealDirectionForKey(stepKey: string): HeroRevealDirection {
  let hash = 0
  for (let i = 0; i < stepKey.length; i++) {
    hash = (hash + stepKey.charCodeAt(i) * (i + 3)) % HERO_REVEAL_DIRECTIONS.length
  }
  return HERO_REVEAL_DIRECTIONS[hash]
}
