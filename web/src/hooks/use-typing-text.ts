import { useEffect, useRef, useState } from "react"

export function useTypingText(
  fullText: string,
  isActive: boolean,
  speed = 6
) {
  const [displayed, setDisplayed] = useState("")
  const lastFullTextRef = useRef(fullText)

  useEffect(() => {
    // Si el texto completo crece (streaming), NO resetear
    if (fullText.startsWith(lastFullTextRef.current)) {
      lastFullTextRef.current = fullText
      return
    }

    // Si cambia completamente (nuevo mensaje), resetear
    lastFullTextRef.current = fullText
    setDisplayed("")
  }, [fullText])

  useEffect(() => {
    if (!isActive) {
      setDisplayed(fullText)
      return
    }

    if (displayed.length >= fullText.length) return

    const interval = setInterval(() => {
      setDisplayed((prev) => {
        const nextLength = prev.length + 1
        return fullText.slice(0, nextLength)
      })
    }, speed)

    return () => clearInterval(interval)
  }, [fullText, displayed, isActive, speed])

  return displayed
}
