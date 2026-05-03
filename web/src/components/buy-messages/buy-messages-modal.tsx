import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, Package, Zap } from "lucide-react";
import { CurrencyToggle } from "@/components/currency-toggle/currency-toggle";
import { PaymentMethodModal } from "@/components/payment-method/payment-method-modal";
import {
  'components.buy_messages_modal.title' as components_buy_messages_modal_title,
  'components.buy_messages_modal.subtitle' as components_buy_messages_modal_subtitle,
  'components.buy_messages_modal.info.line_1' as components_buy_messages_modal_info_line_1,
  'components.buy_messages_modal.info.line_2' as components_buy_messages_modal_info_line_2,
  'components.buy_messages_modal.custom.title' as components_buy_messages_modal_custom_title,
  'components.buy_messages_modal.custom.input_label' as components_buy_messages_modal_custom_input_label,
  'components.buy_messages_modal.custom.input_placeholder' as components_buy_messages_modal_custom_input_placeholder,
  'components.buy_messages_modal.custom.price_per_message' as components_buy_messages_modal_custom_price_per_message,
  'components.buy_messages_modal.custom.helper' as components_buy_messages_modal_custom_helper,
  'components.buy_messages_modal.custom.buy_button' as components_buy_messages_modal_custom_buy_button
} from '@/paraglide/messages.js';
import { useMemo, useState } from "react";
import { useCreateBillingRefill, useUsdArsQuote } from "@/lib/admin";
import { useCurrencyStore, formatAmount, formatAmountUnit } from "@/lib/currency.store";

type BuyMessagesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BuyMessagesModal({ open, onOpenChange }: BuyMessagesModalProps) {
  const BASE_PRICE = 0.09;
  const DISCOUNT = 0.20;
  const PACK_PRICE = parseFloat((BASE_PRICE * (1 - DISCOUNT)).toFixed(4));

  const PACK_100  = { qty: 100,  unit: PACK_PRICE, total: parseFloat((100  * PACK_PRICE).toFixed(2)), originalTotal: parseFloat((100  * BASE_PRICE).toFixed(2)) };
  const PACK_1000 = { qty: 1000, unit: PACK_PRICE, total: parseFloat((1000 * PACK_PRICE).toFixed(2)), originalTotal: parseFloat((1000 * BASE_PRICE).toFixed(2)) };

  const [customAmount, setCustomAmount] = useState<string>("");
  const [paymentBill, setPaymentBill] = useState<{
    billId: string;
    amount: number;
  } | null>(null);
  const refill = useCreateBillingRefill();
  const { data: usdArsQuote } = useUsdArsQuote();
  const quote = (usdArsQuote as number | null | undefined) ?? null;
  const showARS = useCurrencyStore((s) => s.showARS);

  const fmt = (usd: number) => formatAmount(usd, showARS, quote);
  const fmtUnit = (usd: number) => formatAmountUnit(usd, showARS, quote);

  const handleBuy = async (messages: number) => {
    if (!messages || messages <= 0) return;

    const { billId, amount } = await refill(messages);
    onOpenChange(false);
    setPaymentBill({ billId, amount });
  };

  const totalPrice = useMemo(() => {
    const qty = Number(customAmount);
    if (!qty || qty <= 0) return null;
    return qty * BASE_PRICE;
  }, [customAmount]);


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
      className="
      w-[95vw] sm:w-[80vw] lg:w-[60vw]
      min-w-[95vw] sm:min-w-[80vw] lg:min-w-[60vw]
      max-w-[95vw] sm:max-w-[80vw] lg:max-w-[60vw]
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
              <h2 className="text-lg font-semibold">{components_buy_messages_modal_title()}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{components_buy_messages_modal_subtitle()}</p>
            </div>
            <CurrencyToggle className="mt-0.5" />
          </div>
        </DialogHeader>

        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed">
          <p>{components_buy_messages_modal_info_line_1()}</p>
          <p className="mt-2 text-muted-foreground">{components_buy_messages_modal_info_line_2()}</p>
        </div>

        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Pack 100 */}
          <div className="relative rounded-xl border border-border bg-muted/40 p-5 hover:bg-muted/60 transition-colors flex flex-col justify-between gap-4">
              <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/25">
                20% OFF
              </span>
              <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                      <p className="font-semibold text-base">Pack 100</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground line-through">{fmtUnit(BASE_PRICE)} / msg</span>
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{fmtUnit(PACK_PRICE)} / msg</span>
                      </div>
                  </div>
              </div>
              <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground line-through">{fmt(PACK_100.originalTotal)}</p>
                    <p className="text-lg font-bold">{fmt(PACK_100.total)}</p>
                  </div>
                  <Button size="sm" className="cursor-pointer" onClick={() => handleBuy(PACK_100.qty)}>
                    {components_buy_messages_modal_custom_buy_button()}
                  </Button>
              </div>
          </div>

          {/* Pack 1000 — destacado */}
          <div className="relative rounded-xl border border-primary/40 bg-primary/5 p-5 ring-1 ring-primary/20 flex flex-col justify-between gap-4">
            <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/25">
              20% OFF
            </span>
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-base">Pack 1000</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-muted-foreground line-through">{fmtUnit(BASE_PRICE)} / msg</span>
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{fmtUnit(PACK_PRICE)} / msg</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground line-through">{fmt(PACK_1000.originalTotal)}</p>
                <p className="text-lg font-bold">{fmt(PACK_1000.total)}</p>
              </div>
              <Button size="sm" variant="default" className="cursor-pointer" onClick={() => handleBuy(PACK_1000.qty)}>
                {components_buy_messages_modal_custom_buy_button()}
              </Button>
            </div>
          </div>
        </div>

        <Separator className="my-3" />

        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          <p className="text-sm font-medium">{components_buy_messages_modal_custom_title()}</p>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3 w-full">
            <div className="w-full sm:max-w-55">
              <label className="text-xs text-muted-foreground">{components_buy_messages_modal_custom_input_label()}</label>
              <Input
              type="number"
              min={1}
              placeholder={components_buy_messages_modal_custom_input_placeholder()}
              className="h-9"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              />
            </div>

            <div className="flex flex-row items-center gap-4 flex-1">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">
                  {fmtUnit(BASE_PRICE)}{components_buy_messages_modal_custom_price_per_message()}
                </span>

                <span className="h-3 w-px bg-border" />

                <span className="font-semibold text-foreground">
                  Total:{" "}
                  {totalPrice !== null ? fmt(totalPrice) : "-"}
                </span>
              </span>

              <Button className="h-9 cursor-pointer ml-auto" onClick={() => handleBuy(Number(customAmount))}>
                <CreditCard className="h-4 w-4 mr-2" />
                {components_buy_messages_modal_custom_buy_button()}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{components_buy_messages_modal_custom_helper()}</p>
          </div>
        </div>
        </DialogContent>
      </Dialog>

      <PaymentMethodModal
        open={paymentBill !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPaymentBill(null);
        }}
        billId={paymentBill?.billId ?? null}
        amount={paymentBill?.amount ?? null}
        redirect={`${import.meta.env.VITE_FRONT_URL}/adminsettings`}
        usdArsQuote={quote}
      />
    </>
  );
}
