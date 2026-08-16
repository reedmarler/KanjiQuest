/**
 * The two learner-facing playback speeds.
 *
 * Kept in its own module because both the speech engine and the static-audio
 * lookup need them, and importing one from the other would be circular. The
 * generator script mirrors these values — changing one means re-rendering the
 * pre-generated clips, since the speed is baked into each filename.
 */

/** "Natural" is the voice's own pace; "learning" is slow enough to pick out
 *  mora boundaries without the artefacts of stretching much further. */
export const SPEECH_SPEEDS = { natural: 1, learning: 0.65 } as const
export type SpeechSpeed = keyof typeof SPEECH_SPEEDS
