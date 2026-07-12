/** True while the outgoing surface should stay visible (before/during swap reveal). */
export function heroReelShowsPreviousText(options: {
  needsChange: boolean
  isSettled: boolean
  inHold: boolean
  inHighlight: boolean
  inCycle: boolean
  inSwap: boolean
  swapContentRevealed?: boolean
  pendingCycle: boolean
}): boolean {
  const {
    needsChange,
    isSettled,
    inHold,
    inHighlight,
    inCycle,
    inSwap,
    swapContentRevealed = true,
    pendingCycle,
  } = options

  if (!needsChange || isSettled) return false

  if (pendingCycle || inHold || inHighlight) return true
  if (inCycle && !inSwap) return true
  if (inSwap && !swapContentRevealed) return true

  return false
}

/** Track position: outgoing cell visible until the roll begins */
export function heroReelTrackShowsOutgoing(options: {
  needsChange: boolean
  isSettled: boolean
  inHold: boolean
  inHighlight: boolean
  inCycle: boolean
  inSwap: boolean
  inShrink: boolean
  inUnhighlight: boolean
  pendingCycle: boolean
  /** HeroWordReel: false until the CSS roll transition starts */
  swapRollStarted?: boolean
}): boolean {
  const {
    needsChange,
    isSettled,
    inHold,
    inHighlight,
    inCycle,
    inSwap,
    inShrink,
    inUnhighlight,
    pendingCycle,
    swapRollStarted = true,
  } = options

  if (!needsChange || isSettled) return false

  if (pendingCycle || inHold || inHighlight) return true
  if (inCycle && !inSwap) return true
  if (inSwap && !swapRollStarted) return true
  if (inShrink || inUnhighlight) return false

  return false
}

export function heroReelPendingCycle(
  needsChange: boolean,
  isSettled: boolean,
  settledKey: string,
  stepKey: string,
  phase: string,
): boolean {
  return needsChange && !isSettled && phase === 'settled' && settledKey !== stepKey
}
