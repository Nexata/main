import { useTypingText } from "@/hooks/use-typing-text"
import { useEffect, useState } from "react"

interface TypingTextProps {
  text: string
  isActive: boolean
  speed?: number
  className?: string
}

export function TypingText({
  text,
  isActive,
  speed = 4,
  className = "",
}: TypingTextProps) {
  const displayed = useTypingText(text, isActive, speed)
  const [visible, setVisible] = useState(false)

  // Activar fade cuando empieza a mostrarse texto
  useEffect(() => {
    if (displayed.length > 0) {
      setVisible(true)
    }
  }, [displayed])

  // Resetear fade cuando cambia completamente el mensaje
  useEffect(() => {
    setVisible(false)
  }, [text])

  return (
    <div
      key={text}
      className={
        "transition-all duration-1000 ease-out " +
        (visible ? "opacity-100 translate-y-0 " : "opacity-0 translate-y-1 ") +
        className
      }
    >
      {displayed}
    </div>
  )
}
