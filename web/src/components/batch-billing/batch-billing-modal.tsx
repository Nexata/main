import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Loader2, Percent, Tag } from "lucide-react";
import { useState } from "react";
import { CurrencyToggle } from "@/components/currency-toggle/currency-toggle";
import { AsyncConfirmButton } from "@/components/async-confirm-button/async-confirm-button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  "admin.billing.batch.title" as batch_title,
  "admin.billing.batch.subtitle" as batch_subtitle,
  "admin.billing.batch.months_label" as batch_months_label,
  "admin.billing.batch.month_singular" as batch_month_singular,
  "admin.billing.batch.month_plural" as batch_month_plural,
  "admin.billing.batch.discount_label" as batch_discount_label,
  "admin.billing.batch.original_price" as batch_original_price,
  "admin.billing.batch.final_price" as batch_final_price,
  "admin.billing.batch.savings" as batch_savings,
  "admin.billing.batch.no_discount" as batch_no_discount,
  "admin.billing.batch.tier_label" as batch_tier_label,
  "admin.billing.batch.confirm_button" as batch_confirm_button,
  "admin.billing.batch.success_toast" as batch_success_toast,
  "admin.billing.batch.error_toast" as batch_error_toast,
} from "@/paraglide/messages.js";
import {
  useBatchBillingPreview,
  useSetBatchBilling,
  useGetPaymentMpCheckout,
} from "@/lib/admin";
import { useCurrencyStore, formatAmount } from "@/lib/currency.store";
import { infoToast } from "@/components/info-toast/info-toast";
import { extractErrorText } from "@/lib/error";
import { getLocale } from "@/paraglide/runtime";

type BatchBillingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usdArsQuote: number | null | undefined;
};

const MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24];

const DISCOUNT_TIERS = [
  { months: 3, rate: 5 },
  { months: 6, rate: 10 },
  { months: 9, rate: 15 },
  { months: 12, rate: 20 },
];

export function BatchBillingModal({
  open,
  onOpenChange,
  usdArsQuote,
}: BatchBillingModalProps) {
  const [months, setMonths] = useState(1);
  const { data: preview, isLoading: previewLoading } = useBatchBillingPreview(
    months,
    open,
  );
  const setBatch = useSetBatchBilling();
  const getCheckout = useGetPaymentMpCheckout();
  const showARS = useCurrencyStore((s) => s.showARS);
  const quote = (usdArsQuote as number | null | undefined) ?? null;

  const fmt = (usd: number) => formatAmount(usd, showARS, quote);

  const monthLabel = (n: number) =>
    n === 1 ? batch_month_singular({ months: String(n) }) : batch_month_plural({ months: String(n) });

  const handleConfirm = async () => {
    const toastId = infoToast.loading({ title: batch_confirm_button() });
    try {
      const res = await setBatch(months);
      infoToast.success(toastId, { title: batch_success_toast() });
      onOpenChange(false);

      if (res?.billId) {
        const redirect = `${import.meta.env.VITE_FRONT_URL}/adminsettings`;
        const language = getLocale();
        const checkout = await getCheckout(res.billId, redirect, language);
        if (checkout?.init_point) window.open(checkout.init_point, "_self");
      }
    } catch (error) {
      infoToast.error(toastId, { title: batch_error_toast(), description: extractErrorText(error) });
    }
  };

  const discountRate = preview?.discountRate ?? 0;
  const hasDiscount = discountRate > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[95vw] sm:w-[480px]
          min-w-[95vw] sm:min-w-[480px]
          max-w-[95vw] sm:max-w-[480px]
          max-h-[85dvh] sm:max-h-[90vh]
          overflow-y-auto
          px-6 sm:px-8
          py-5 sm:py-6
          mt-[env(safe-area-inset-top)]
        "
      >
        <DialogHeader className="space-y-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-lg font-semibold">{batch_title()}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {batch_subtitle()}
              </p>
            </div>
            <CurrencyToggle className="mt-0.5" />
          </div>
        </DialogHeader>

        {/* Discount tiers */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {DISCOUNT_TIERS.map((tier) => (
            <span
              key={tier.months}
              className={`
                inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors
                ${
                  months >= tier.months &&
                  (DISCOUNT_TIERS.find(
                    (t) => t.months > tier.months && months >= t.months,
                  ) === undefined)
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/25"
                    : "bg-muted text-muted-foreground"
                }
              `}
            >
              <Percent className="h-3 w-3" />
              {batch_tier_label({ months: String(tier.months), rate: String(tier.rate) })}
            </span>
          ))}
        </div>

        <Separator className="my-4" />

        {/* Month selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {batch_months_label()}
          </label>
          <Select
            value={String(months)}
            onValueChange={(v) => setMonths(Number(v))}
          >
            <SelectTrigger className="w-full h-9">
              <SelectValue>{monthLabel(months)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((m) => {
                const tierDiscount = DISCOUNT_TIERS.slice()
                  .reverse()
                  .find((t) => m >= t.months);
                return (
                  <SelectItem key={m} value={String(m)}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span>{monthLabel(m)}</span>
                      {tierDiscount ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          -{tierDiscount.rate}%
                        </span>
                      ) : null}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <Separator className="my-4" />

        {/* Preview */}
        <AnimatePresence mode="wait">
          {previewLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-6"
            >
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </motion.div>
          ) : preview ? (
            <motion.div
              key={`preview-${months}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="rounded-xl border border-border bg-muted/30 p-4 space-y-3"
            >
              {/* Original price */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {batch_original_price()}
                </span>
                <span
                  className={
                    hasDiscount
                      ? "line-through text-muted-foreground"
                      : "font-medium text-foreground"
                  }
                >
                  {fmt(preview.originalAmount * months)}
                </span>
              </div>

              {/* Discount */}
              {hasDiscount && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    {batch_discount_label()}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/25">
                    -{Math.round(discountRate * 100)}%
                  </span>
                </div>
              )}

              {!hasDiscount && months > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    {batch_discount_label()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {batch_no_discount()}
                  </span>
                </div>
              )}

              <Separator />

              {/* Final price */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {batch_final_price()}
                </span>
                <span className="text-lg font-bold">
                  {fmt(preview.batchAmount)}
                </span>
              </div>

              {/* Savings */}
              {hasDiscount && preview.savings > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {batch_savings()}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {fmt(preview.savings)}
                  </span>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Confirm */}
        <div className="mt-4 flex justify-end">
          <AsyncConfirmButton
            onClick={handleConfirm}
            disabled={!preview || previewLoading}
            variant="default"
          >
            {batch_confirm_button()}
          </AsyncConfirmButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
