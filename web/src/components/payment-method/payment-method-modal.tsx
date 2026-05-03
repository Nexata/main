import { useState } from "react";
import { Check, Copy, CreditCard, Landmark, Mail, Timer } from "lucide-react";
import { AsyncConfirmButton } from "@/components/async-confirm-button/async-confirm-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useGetPaymentMpCheckout } from "@/lib/admin";
import { formatAmount, useCurrencyStore } from "@/lib/currency.store";
import type { Language } from "@/lib/user";
import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime";

type PaymentMethodModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string | null;
  amount: string | number | null;
  redirect?: string;
  usdArsQuote?: number | null;
};

const TRANSFER_ALIAS = "luka.rs";
const TRANSFER_EMAIL = "lukacerrutti2002@gmail.com";

function getCopy() {
  if (getLocale() === "en") {
    return {
      title: "Choose payment method",
      subtitle: "Mercado Pago redirects you to checkout. Bank transfer keeps the base amount without the 5% Mercado Pago surcharge.",
      mpTitle: "Mercado Pago",
      mpDescription: "Pay by card or with your Mercado Pago account. A 5% processing surcharge is added at checkout.",
      mpButton: "Continue to Mercado Pago",
      transferTitle: "Bank transfer",
      transferDescription: "Transfer the invoice amount directly and send the receipt for manual confirmation.",
      noSurcharge: "No 5% Mercado Pago surcharge",
      amountLabel: "Amount to transfer",
      aliasLabel: "Alias",
      emailLabel: "Send receipt to",
      pending: "The invoice will remain pending until the payment is reviewed and marked as paid manually.",
      copied: "Copied",
      copy: "Copy",
    };
  }

  return {
    title: "Elegí cómo pagar",
    subtitle: "Mercado Pago te redirige al checkout. La transferencia mantiene el monto base sin el recargo del 5% de Mercado Pago.",
    mpTitle: "Mercado Pago",
    mpDescription: "Pagá con tarjeta o con tu cuenta de Mercado Pago. En el checkout se suma un recargo de procesamiento del 5%.",
    mpButton: "Continuar a Mercado Pago",
    transferTitle: "Transferencia",
    transferDescription: "Transferí el monto de la factura directamente y enviá el comprobante para confirmación manual.",
    noSurcharge: "Sin recargo del 5% de Mercado Pago",
    amountLabel: "Monto a transferir",
    aliasLabel: "Alias",
    emailLabel: "Enviar comprobante a",
    pending: "La factura seguirá pendiente hasta que el pago sea revisado y marcado como pagado manualmente.",
    copied: "Copiado",
    copy: "Copiar",
  };
}

export function PaymentMethodModal({
  open,
  onOpenChange,
  billId,
  amount,
  redirect,
  usdArsQuote,
}: PaymentMethodModalProps) {
  const getCheckout = useGetPaymentMpCheckout();
  const showARS = useCurrencyStore((s) => s.showARS);
  const [copied, setCopied] = useState<"alias" | "email" | null>(null);
  const copy = getCopy();
  const numericAmount = amount === null ? null : Number(amount);
  const formattedAmount =
    numericAmount === null || Number.isNaN(numericAmount)
      ? "-"
      : formatAmount(numericAmount, showARS, usdArsQuote ?? null);

  const handleMercadoPago = async () => {
    if (!billId) return;

    const checkout = await getCheckout(billId, redirect, getLocale() as Language);
    if (checkout?.init_point) window.open(checkout.init_point, "_self");
  };

  const handleCopy = async (kind: "alias" | "email", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  };

  const CopyRow = ({
    label,
    value,
    kind,
  }: {
    label: string;
    value: string;
    kind: "alias" | "email";
  }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium tabular-nums">{value}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 cursor-pointer"
        onClick={() => handleCopy(kind, value)}
      >
        {copied === kind ? (
          <Check className="mr-2 h-4 w-4 text-emerald-600" />
        ) : (
          <Copy className="mr-2 h-4 w-4" />
        )}
        {copied === kind ? copy.copied : copy.copy}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[95vw] sm:w-[620px]
          min-w-[95vw] sm:min-w-[620px]
          max-w-[95vw] sm:max-w-[620px]
          max-h-[85dvh] sm:max-h-[90vh]
          overflow-y-auto
          px-6 sm:px-8
          py-5 sm:py-6
          mt-[env(safe-area-inset-top)]
        "
      >
        <DialogHeader className="space-y-0">
          <h2 className="text-lg font-semibold tracking-tight">{copy.title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{copy.subtitle}</p>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col justify-between rounded-xl border border-border bg-muted/40 p-5 transition-colors hover:bg-muted/50">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard className="h-4.5 w-4.5 text-primary" />
                </span>
                <h3 className="font-medium">{copy.mpTitle}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {copy.mpDescription}
              </p>
            </div>
            <AsyncConfirmButton
              onClick={handleMercadoPago}
              disabled={!billId}
              variant="outline"
              className="mt-5 w-full"
            >
              {copy.mpButton}
            </AsyncConfirmButton>
          </div>

          <div className="relative flex flex-col justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 ring-1 ring-emerald-500/20">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
                  <Landmark className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </span>
                <h3 className="font-medium">{copy.transferTitle}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {copy.transferDescription}
              </p>
              <span className="mt-3 inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400">
                {copy.noSurcharge}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded-lg border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">{copy.amountLabel}</p>
                <p className="text-lg font-bold tabular-nums">{formattedAmount}</p>
              </div>
              <CopyRow label={copy.aliasLabel} value={TRANSFER_ALIAS} kind="alias" />
              <CopyRow label={copy.emailLabel} value={TRANSFER_EMAIL} kind="email" />
              <div
                className={cn(
                  "flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed",
                  "text-amber-700 dark:text-amber-300",
                )}
              >
                <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {copy.pending} <Mail className="inline h-3.5 w-3.5 align-[-2px]" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
