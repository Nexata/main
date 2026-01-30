import { useEffect, useState } from "react"

export function useTypingText(fullText: string, isActive: boolean, speed = 12) {
  const [displayed, setDisplayed] = useState("")

  useEffect(() => {
    if (!isActive) {
      setDisplayed(fullText)
      return
    }

    let i = 0
    setDisplayed("")

    const interval = setInterval(() => {
      i++
      setDisplayed(fullText.slice(0, i))

      if (i >= fullText.length) {
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [fullText, isActive, speed])

  return displayed
}
