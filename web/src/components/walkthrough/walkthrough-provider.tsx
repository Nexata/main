import { useEffect, useRef } from "react";
import { useWalkthrough } from "@/hooks/use-walkthrough";
import "./walkthrough.css";

interface WalkthroughProviderProps {
  isAdmin: boolean;
  isReady: boolean;
}

export function WalkthroughProvider({ isAdmin, isReady }: WalkthroughProviderProps) {
  const { start, isCompleted } = useWalkthrough(isAdmin);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!isReady || isCompleted || hasStarted.current) return;

    // Small delay to ensure all DOM elements with data-tour attributes are rendered
    const timeout = setTimeout(() => {
      hasStarted.current = true;
      start();
    }, 800);

    return () => clearTimeout(timeout);
  }, [isReady, isCompleted, start]);

  return null;
}
