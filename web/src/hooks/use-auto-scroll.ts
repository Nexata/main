import { useEffect, useRef, useState } from "react"

const ACTIVATION_THRESHOLD = 50
const MIN_SCROLL_UP_THRESHOLD = 10

export function useAutoScroll(dependencies: React.DependencyList) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const previousScrollTop = useRef<number | null>(null)
  const isProgrammaticScroll = useRef(false)

  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  const scrollToBottom = () => {
    const el = containerRef.current
    if (!el) return

    isProgrammaticScroll.current = true

    el.scrollTo({
      top: el.scrollHeight,
      behavior: "smooth",
    })

    // unlock after animation settles
    setTimeout(() => { isProgrammaticScroll.current = false }, 120)
  }

  const handleScroll = () => {
    const el = containerRef.current
    if (!el || isProgrammaticScroll.current) return

    const { scrollTop, scrollHeight, clientHeight } = el
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const prev = previousScrollTop.current ?? scrollTop

    const scrollUpDistance = prev - scrollTop
    const isScrollingUp = scrollUpDistance > MIN_SCROLL_UP_THRESHOLD

    let nextShouldAuto = shouldAutoScroll

    if (isScrollingUp) nextShouldAuto = false
    else if (distanceFromBottom < ACTIVATION_THRESHOLD) nextShouldAuto = true


    if (nextShouldAuto !== shouldAutoScroll) setShouldAutoScroll(nextShouldAuto)

    previousScrollTop.current = scrollTop
  }

  const handleTouchStart = () => { setShouldAutoScroll(false) }

  useEffect(() => {
    previousScrollTop.current = containerRef.current?.scrollTop ?? 0
  }, [])

  useEffect(() => {
    if (shouldAutoScroll) scrollToBottom()
    // eslint-disable-next-line
  }, dependencies)

  return {
    containerRef,
    scrollToBottom,
    handleScroll,
    shouldAutoScroll,
    handleTouchStart,
  }
}
