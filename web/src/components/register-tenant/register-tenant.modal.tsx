import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { infoToast } from "@/components/info-toast/info-toast";
import { checkSlugAvailable, requestTenantCreation } from "@/lib/public-tenant";
import type { Language } from "@/lib/user";
import { Loader2, Check, X, Building2, Mail, Globe, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

type RegisterTenantModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
};

const SLUG_REGEX = /^[a-z0-9]{2,16}$/;

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);
}

export default function RegisterTenantModal({
  open,
  onOpenChange,
  language,
}: RegisterTenantModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Derive slug from display name if user hasn't manually edited it
  useEffect(() => {
    if (!slugTouched) {
      setSlug(deriveSlug(displayName));
    }
  }, [displayName, slugTouched]);

  // Debounced slug availability check
  useEffect(() => {
    if (!slug || !SLUG_REGEX.test(slug)) {
      setSlugStatus("idle");
      return;
    }

    setSlugStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const available = await checkSlugAvailable(slug);
        setSlugStatus(available ? "available" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug]);

  const reset = useCallback(() => {
    setDisplayName("");
    setEmail("");
    setSlug("");
    setSlugTouched(false);
    setSlugStatus("idle");
    setSubmitting(false);
    setSubmitted(false);
    setShowAdvanced(false);
  }, []);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) reset();
      onOpenChange(value);
    },
    [onOpenChange, reset],
  );

  const isValidEmail = email.includes("@") && email.includes(".");
  const isValidSlug = SLUG_REGEX.test(slug);
  const canSubmit =
    isValidEmail &&
    isValidSlug &&
    slugStatus !== "taken" &&
    slugStatus !== "checking" &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    const toastId = infoToast.loading({
      title: language === "es" ? "Creando organización..." : "Creating organization...",
      description: language === "es" ? "Enviando email de confirmación" : "Sending confirmation email",
    });

    try {
      await requestTenantCreation({
        displayName: displayName.trim(),
        email: email.trim(),
        slug,
        language,
      });

      infoToast.success(toastId, {
        title: language === "es" ? "Email enviado" : "Email sent",
        description:
          language === "es"
            ? "Revisá tu bandeja de entrada para confirmar"
            : "Check your inbox to confirm",
      });

      setSubmitted(true);
    } catch {
      infoToast.error(toastId, {
        title: language === "es" ? "Error al crear" : "Creation failed",
        description:
          language === "es"
            ? "Intentá de nuevo más tarde"
            : "Please try again later",
      });
      setSubmitting(false);
    }
  };

  const labels =
    language === "es"
      ? {
          title: "Empezá gratis",
          description: "Creá tu organización en Nexata. Te enviaremos un email para confirmar.",
          orgName: "Nombre de la organización",
          orgPlaceholder: "Mi Empresa",
          email: "Email",
          emailPlaceholder: "tu@empresa.com",
          slug: "Identificador",
          slugAvailable: "Disponible",
          slugTaken: "No disponible",
          slugChecking: "Verificando...",
          slugHint: "Solo letras minúsculas y números, 2-16 caracteres",
           submit: "Crear organización",
           advancedOptions: "Opciones avanzadas",
           successTitle: "Revisá tu email",
          successDescription:
            "Te enviamos un enlace de confirmación. El enlace expira en 1 hora.",
          close: "Cerrar",
        }
      : {
          title: "Start for free",
          description: "Create your organization on Nexata. We'll send a confirmation email.",
          orgName: "Organization name",
          orgPlaceholder: "My Company",
          email: "Email",
          emailPlaceholder: "you@company.com",
          slug: "Identifier",
          slugAvailable: "Available",
          slugTaken: "Not available",
          slugChecking: "Checking...",
          slugHint: "Lowercase letters and numbers only, 2-16 characters",
           submit: "Create organization",
           advancedOptions: "Advanced options",
           successTitle: "Check your email",
          successDescription:
            "We sent you a confirmation link. The link expires in 1 hour.",
          close: "Close",
        };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <DialogTitle className="text-center text-lg">
                {labels.successTitle}
              </DialogTitle>
              <DialogDescription className="text-center">
                {labels.successDescription}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => handleOpenChange(false)}
              >
                {labels.close}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center text-lg">
                {labels.title}
              </DialogTitle>
              <DialogDescription className="text-center">
                {labels.description}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              {/* Organization Name */}
              <div className="grid gap-1.5">
                <Label htmlFor="register-org-name">
                  <Building2 className="h-3.5 w-3.5" />
                  {labels.orgName}
                </Label>
                <Input
                  id="register-org-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={labels.orgPlaceholder}
                  maxLength={64}
                  autoFocus
                />
              </div>

              {/* Email */}
              <div className="grid gap-1.5">
                <Label htmlFor="register-email">
                  <Mail className="h-3.5 w-3.5" />
                  {labels.email}
                </Label>
                <Input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={labels.emailPlaceholder}
                />
              </div>

              {/* Advanced Options (Slug) */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                  {labels.advancedOptions}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-1.5 pt-3">
                    <Label htmlFor="register-slug">
                      <Globe className="h-3.5 w-3.5" />
                      {labels.slug}
                    </Label>
                    <div className="relative">
                      <Input
                        id="register-slug"
                        value={slug}
                        onChange={(e) => {
                          setSlugTouched(true);
                          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16));
                        }}
                        placeholder="mi-empresa"
                        maxLength={16}
                        className="pr-8"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {slugStatus === "checking" && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {slugStatus === "available" && (
                          <Check className="h-4 w-4 text-emerald-500" />
                        )}
                        {slugStatus === "taken" && (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{labels.slugHint}</span>
                      {slugStatus === "available" && (
                        <span className="text-xs text-emerald-500 font-medium">{labels.slugAvailable}</span>
                      )}
                      {slugStatus === "taken" && (
                        <span className="text-xs text-destructive font-medium">{labels.slugTaken}</span>
                      )}
                      {slugStatus === "checking" && (
                        <span className="text-xs text-muted-foreground">{labels.slugChecking}</span>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <DialogFooter>
              <Button
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="w-full sm:w-auto"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {labels.submit}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
