/** Single source of truth — JS timeouts and CSS variables must match */
export const HERO_HIGHLIGHT_MS = 1800
export const HERO_WIDTH_EXPAND_MS = 700
export const HERO_WIDTH_SHRINK_MS = 700
export const HERO_SWAP_MS = 1200
/** Covers the paint boundary between starting the reel and its CSS transition. */
export const HERO_SWAP_SETTLE_MS = 34
/** Stable pause after unhighlight completes and before the next word begins. */
export const HERO_SENTENCE_REST_MS = 1200
/** Brief unhighlight — keep under 1s of non-accent text per full cycle */
export const HERO_UNHIGHLIGHT_MS = 1800
/** Outgoing reel fade — ends with the roll so unhighlight can start right after */
export const HERO_FADE_OUT_MS = HERO_SWAP_MS

/** Still frame before highlight on a new sentence — under 1s, non-accent */
export const HERO_DWELL_MS = 500

/** English unblur — slow enough to feel smooth, finishes before kanji unhighlight */
export const HERO_ENGLISH_UNBLUR_MS = 900

/** Buffer between English fully clear and kanji unhighlight (no post-shrink) */
export const HERO_ENGLISH_UNBLUR_LEAD_MS = 180

const HERO_MAX_ANIM_MS =
  HERO_HIGHLIGHT_MS +
  HERO_SWAP_MS +
  HERO_SWAP_SETTLE_MS +
  Math.max(HERO_WIDTH_EXPAND_MS, HERO_WIDTH_SHRINK_MS, HERO_UNHIGHLIGHT_MS)

/** @deprecated fixed step length — prefer heroStepCycleMs per step */
export const HERO_STEP_MS = HERO_MAX_ANIM_MS

/** @deprecated use HERO_STEP_MS */
export const HERO_CYCLE_MS = HERO_MAX_ANIM_MS

/** @deprecated use HERO_STEP_MS */
export const HERO_STEP_INTERVAL_MS = HERO_STEP_MS

/** @deprecated use HERO_DWELL_MS */
export const HERO_IDLE_MS = HERO_DWELL_MS

/** Kanji drill mode — show reading after the word appears */
export const HERO_DELAYED_FURIGANA_MS = 750

/** Word drill reel swap — shorter than sentence slots */
export const HERO_WORD_DRILL_SWAP_MS = 700

/** Time each kanji drill word stays on screen */
export const HERO_WORD_DRILL_MS = 4000

export const HERO_EASE = 'cubic-bezier(0.33, 1, 0.68, 1)'

/** Pre/post grow flags — must come from the Japanese reel, not English char counts */
export interface HeroResizeTiming {
  needsPreGrow: boolean
  needsPostShrink: boolean
}

export interface HeroStepCycleOptions {
  alreadyHighlighted?: boolean
  skipUnhighlight?: boolean
}

/** Highlight only before swap — width changes happen after the reel lands */
export function heroPreSwapMs(
  skipPreSwapSpacing: boolean,
  _needsPreGrow = false,
  alreadyHighlighted = false,
): number {
  if (skipPreSwapSpacing) {
    return alreadyHighlighted ? 0 : HERO_HIGHLIGHT_MS
  }

  return alreadyHighlighted ? 0 : HERO_HIGHLIGHT_MS
}

/** Grow/shrink runs during the swap roll — post-swap is unhighlight only */
export function heroPostSwapMs(
  skipPreSwapSpacing: boolean,
  _needsPostShrink: boolean,
  _needsPreGrow = false,
  skipUnhighlight = false,
): number {
  if (skipPreSwapSpacing) {
    return skipUnhighlight ? 0 : HERO_UNHIGHLIGHT_MS
  }

  return skipUnhighlight ? 0 : HERO_UNHIGHLIGHT_MS
}

export function heroPreSwapSpacingMs(
  skipPreSwapSpacing: boolean,
  needsPreGrow: boolean,
  alreadyHighlighted = false,
): number {
  if (skipPreSwapSpacing || !needsPreGrow) return 0
  return alreadyHighlighted
    ? HERO_WIDTH_EXPAND_MS
    : Math.max(HERO_HIGHLIGHT_MS, HERO_WIDTH_EXPAND_MS)
}

export function heroStepCycleMs(
  skipPreSwapSpacing: boolean,
  needsPreGrow = false,
  needsPostShrink = false,
  options: HeroStepCycleOptions = {},
): number {
  return (
    heroPreSwapMs(skipPreSwapSpacing, needsPreGrow, options.alreadyHighlighted) +
    HERO_SWAP_MS +
    HERO_SWAP_SETTLE_MS +
    heroPostSwapMs(
      skipPreSwapSpacing,
      needsPostShrink,
      needsPreGrow,
      options.skipUnhighlight,
    )
  )
}

/** Hold new sentences still before the highlight reel begins */
export function heroHoldBeforeCycleMs(templateRefresh: boolean): number {
  return templateRefresh ? HERO_DWELL_MS : 0
}

export function heroEnglishRevealMs(
  skipPreSwapSpacing: boolean,
  needsPreGrow = false,
): number {
  return heroPreSwapMs(skipPreSwapSpacing, needsPreGrow)
}

/** When English unblurs — as the kanji reel settles into the sentence */
export function heroEnglishClearMs(
  skipPreSwapSpacing: boolean,
  needsPreGrow = false,
): number {
  return heroEnglishRevealMs(skipPreSwapSpacing, needsPreGrow) + HERO_SWAP_MS
}

/** Ms after swap phase starts when English unblur should begin */
export function heroEnglishUnblurDelayMs(shrinking: boolean): number {
  const lead = shrinking ? 0 : HERO_ENGLISH_UNBLUR_LEAD_MS
  return Math.max(0, HERO_SWAP_MS - HERO_ENGLISH_UNBLUR_MS - lead)
}

export function heroSlotStyleVars(): Record<string, string> {
  return {
    '--hero-highlight-in-duration': `${HERO_HIGHLIGHT_MS}ms`,
    '--hero-width-grow-duration': `${HERO_WIDTH_EXPAND_MS}ms`,
    '--hero-width-shrink-duration': `${HERO_WIDTH_SHRINK_MS}ms`,
    '--hero-swap-duration': `${HERO_SWAP_MS}ms`,
    '--hero-unhighlight-duration': `${HERO_UNHIGHLIGHT_MS}ms`,
    '--hero-fade-out-duration': `${HERO_FADE_OUT_MS}ms`,
    '--hero-english-unblur-duration': `${HERO_ENGLISH_UNBLUR_MS}ms`,
    '--hero-ease': HERO_EASE,
  }
}
