import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Fade timings — kept in step with the CSS transitions on .quest-begin-intro.
const INTRO_VIDEO_FADE_MS = 340
const INTRO_REVEAL_FADE_MS = 460

/**
 * The full-screen "setting off" clip that plays between choosing a quest step
 * and the step loading. It never gates: the clip ending, any tap, or a stall
 * starts the exit. The exit is a crossfade — the video dips to black, the
 * next screen mounts behind it, then the black lifts.
 *
 * Rendered by App (inside withMobileNav, not a route branch) so the instance
 * survives the navigation and can hold the black over the freshly mounted
 * screen while it fades away.
 */
export function QuestBeginIntro({
  onNavigate,
  onFinish,
}: {
  onNavigate: () => void
  onFinish: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const navRef = useRef(onNavigate)
  navRef.current = onNavigate
  const finRef = useRef(onFinish)
  finRef.current = onFinish

  // 'play' → clip is running · 'out' → video fading to black · 'in' → black
  // lifting off the now-mounted next screen.
  const [phase, setPhase] = useState<'play' | 'out' | 'in'>('play')
  const leave = useCallback(() => setPhase((current) => (current === 'play' ? 'out' : current)), [])

  useEffect(() => {
    // Hard ceiling so a clip that never fires 'ended' (decode failure, tab
    // backgrounded mid-play) still hands off.
    const timer = window.setTimeout(leave, 6500)
    videoRef.current?.play().catch(leave)
    return () => window.clearTimeout(timer)
  }, [leave])

  useEffect(() => {
    if (phase === 'out') {
      const timer = window.setTimeout(() => {
        navRef.current()
        setPhase('in')
      }, INTRO_VIDEO_FADE_MS)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'in') {
      const timer = window.setTimeout(() => finRef.current(), INTRO_REVEAL_FADE_MS)
      return () => window.clearTimeout(timer)
    }
  }, [phase])

  return createPortal(
    <div className={`quest-begin-intro is-${phase}`} role="dialog" aria-label="Beginning quest" onClick={leave}>
      <video
        ref={videoRef}
        className="quest-begin-video"
        src="/quest-begin.mp4"
        autoPlay
        playsInline
        preload="auto"
        onEnded={leave}
        onError={leave}
      />
      {phase === 'play' && (
        <button type="button" className="quest-begin-skip" onClick={leave}>Skip</button>
      )}
    </div>,
    document.body,
  )
}
