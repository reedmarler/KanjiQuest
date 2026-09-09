import { useEffect, useRef } from 'react'

const MIN_DISTANCE = 64
const MAX_DURATION_MS = 700
/** How much more horizontal than vertical the gesture must be to count. */
const HORIZONTAL_RATIO = 2

function shouldIgnoreTarget(node: EventTarget | null): boolean {
  let element = node instanceof Element ? node : null
  while (element) {
    const tag = element.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (element.getAttribute('contenteditable') === 'true') return true
    if (element.getAttribute('data-noswipe') !== null) return true
    // A control or region that scrolls sideways owns the horizontal axis.
    if (element.scrollWidth > element.clientWidth + 4) {
      const overflowX = getComputedStyle(element).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll') return true
    }
    element = element.parentElement
  }
  return false
}

/**
 * Left/right swipe across the page body. `onSwipe(1)` for a leftward swipe
 * (advance), `onSwipe(-1)` for a rightward one — the same direction sense a
 * pager has. Vertical scrolls, multi-touch, and anything that started on a
 * form field or a sideways-scrolling element are left alone.
 */
export function useSwipeNav(enabled: boolean, onSwipe: (direction: 1 | -1) => void) {
  const onSwipeRef = useRef(onSwipe)
  onSwipeRef.current = onSwipe

  useEffect(() => {
    if (!enabled) return

    let startX = 0
    let startY = 0
    let startTime = 0
    let tracking = false

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || shouldIgnoreTarget(event.target)) {
        tracking = false
        return
      }
      const touch = event.touches[0]!
      startX = touch.clientX
      startY = touch.clientY
      startTime = Date.now()
      tracking = true
    }

    const onEnd = (event: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const touch = event.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (Date.now() - startTime > MAX_DURATION_MS) return
      if (Math.abs(dx) < MIN_DISTANCE) return
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return
      onSwipeRef.current(dx < 0 ? 1 : -1)
    }

    const onCancel = () => {
      tracking = false
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onCancel)
    }
  }, [enabled])
}
