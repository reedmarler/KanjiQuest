import type { HeroSentenceFrame } from '../data/heroSentences'
import { isPosFrame } from '../data/heroSentences'

/** Non-swappable glue between slots (は, を, に, …) — used to detect pattern changes */
export function posLiteralGlue(frame: HeroSentenceFrame): string {
  if (!isPosFrame(frame)) return ''
  return (frame.segments ?? [])
    .filter((s) => !s.swappable)
    .map((s) => s.text)
    .join('\u0000')
}

export function posLiteralsChanged(
  prevFrame: HeroSentenceFrame,
  frame: HeroSentenceFrame,
): boolean {
  if (!isPosFrame(prevFrame) || !isPosFrame(frame)) return false
  return posLiteralGlue(prevFrame) !== posLiteralGlue(frame)
}
