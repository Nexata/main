import { motion } from "framer-motion";

type TenantLogoProps = {
  loading: boolean;
  logoUrl?: string | null;
  displayName?: string | null;
};

export function TenantLogo({
  loading,
  logoUrl,
  displayName,
}: TenantLogoProps) {
  if (loading) {
    return (
      <div
        className="h-7 w-24 bg-muted rounded animate-pulse opacity-70"
        style={{ minWidth: 96 }}
      />
    );
  }

  if (!logoUrl) return null;

  return (
    <motion.img
      src={logoUrl}
      alt={displayName ?? "Company"}
      className="h-7 w-auto object-contain opacity-80"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4, ease: "easeInOut", delay: 0.2 }}
    />
  );
}
