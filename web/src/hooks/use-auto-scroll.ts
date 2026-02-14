import { useEffect, useRef, useState } from "react"

const ACTIVATION_THRESHOLD = 50
const MIN_SCROLL_UP_THRESHOLD = 10
const ANIMATION_DURATION = 180 // ms — suave pero responsivo

export function useAutoScroll(dependencies: React.DependencyList) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const previousScrollTop = useRef(0)
  const rafId = useRef<number | null>(null)
  const animationStart = useRef<number>(0)

  const isProgrammaticScroll = useRef(false)

  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  /* ------------------------ easing (smooth native feel) ------------------------ */

  const easeOutCubic = (t: number) =>
    1 - Math.pow(1 - t, 3)

  /* ---------------------------- animated scroll ---------------------------- */

  const animateScroll = (
    start: number,
    end: number,
    startTime: number
  ) => {
    const el = containerRef.current
    if (!el) return

    const elapsed = performance.now() - startTime
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1)

    const eased = easeOutCubic(progress)

    el.scrollTop =
      start + (end - start) * eased

    if (progress < 1) {
      rafId.current = requestAnimationFrame(() =>
        animateScroll(start, end, startTime)
      )
    } else {
      isProgrammaticScroll.current = false
    }
  }

  /* ----------------------------- SCROLL BOTTOM ----------------------------- */

  const scrollToBottom = (animated = false) => {
    const el = containerRef.current
    if (!el) return

    const target =
      el.scrollHeight - el.clientHeight

    if (Math.abs(el.scrollTop - target) < 1) return

    if (rafId.current)
      cancelAnimationFrame(rafId.current)

    isProgrammaticScroll.current = true

    if (!animated) {
      el.scrollTop = target
      isProgrammaticScroll.current = false
      return
    }

    animationStart.current = performance.now()

    animateScroll(
      el.scrollTop,
      target,
      animationStart.current
    )
  }

  /* ------------------------------- SCROLL EVT ------------------------------ */

  const handleScroll = () => {
    const el = containerRef.current
    if (!el || isProgrammaticScroll.current) return

    const { scrollTop, scrollHeight, clientHeight } = el

    const distanceFromBottom =
      scrollHeight - scrollTop - clientHeight

    const scrollUpDistance =
      previousScrollTop.current - scrollTop

    const isScrollingUp =
      scrollUpDistance > MIN_SCROLL_UP_THRESHOLD

    let next = shouldAutoScroll

    if (isScrollingUp) next = false
    else if (distanceFromBottom < ACTIVATION_THRESHOLD)
      next = true

    if (next !== shouldAutoScroll)
      setShouldAutoScroll(next)

    previousScrollTop.current = scrollTop
  }

  /* ------------------------------ TOUCH CANCEL ----------------------------- */

  const handleTouchStart = () => {
    setShouldAutoScroll(false)
  }

  /* ------------------------------ INIT STATE ------------------------------- */

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    previousScrollTop.current = el.scrollTop
  }, [])

  /* ------------------------------ AUTO SCROLL ------------------------------ */

  useEffect(() => {
    if (!shouldAutoScroll) return

    // streaming → ultra soft animated scroll
    scrollToBottom(true)

    // eslint-disable-next-line
  }, dependencies)

  return {
    containerRef,
    scrollToBottom: () => scrollToBottom(true),
    handleScroll,
    shouldAutoScroll,
    handleTouchStart,
  }
}
