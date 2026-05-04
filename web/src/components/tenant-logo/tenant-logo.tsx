import { motion } from "framer-motion";
import { useState, type SyntheticEvent } from "react";
import { cn } from "@/lib/utils";

type TenantLogoProps = {
  loading: boolean;
  logoUrl?: string | null;
  displayName?: string | null;
  squareClassName?: string;
};

export function TenantLogo({
  loading,
  logoUrl,
  displayName,
  squareClassName,
}: TenantLogoProps) {
  const [squareLogoUrl, setSquareLogoUrl] = useState<string | null>(null);

  if (loading) {
    return (
      <div
        className="h-7 w-24 bg-muted rounded animate-pulse opacity-70"
        style={{ minWidth: 96 }}
      />
    );
  }

  if (!logoUrl) return null;

  const isSquare = squareLogoUrl === logoUrl;

  function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    const ratio = img.naturalWidth / img.naturalHeight;

    setSquareLogoUrl(ratio >= 0.8 && ratio <= 1.25 ? logoUrl ?? null : null);
  }

  return (
    <motion.img
      src={logoUrl}
      alt={displayName ?? "Company"}
      className={cn("h-7 w-auto object-contain opacity-80", isSquare && squareClassName)}
      onLoad={handleLoad}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4, ease: "easeInOut", delay: 0.2 }}
    />
  );
}
