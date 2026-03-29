import { CreditCard, CalendarRange, Percent } from "lucide-react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  "components.payment_choice_modal.title" as payment_choice_title,
  "components.payment_choice_modal.subtitle" as payment_choice_subtitle,
  "components.payment_choice_modal.pay_now_title" as payment_choice_pay_now_title,
  "components.payment_choice_modal.pay_now_description" as payment_choice_pay_now_description,
  "components.payment_choice_modal.pay_now_button" as payment_choice_pay_now_button,
  "components.payment_choice_modal.pay_advance_title" as payment_choice_pay_advance_title,
  "components.payment_choice_modal.pay_advance_description" as payment_choice_pay_advance_description,
  "components.payment_choice_modal.pay_advance_badge" as payment_choice_pay_advance_badge,
  "components.payment_choice_modal.pay_advance_button" as payment_choice_pay_advance_button,
} from "@/paraglide/messages.js";
import { useGetPaymentMpCheckout } from "@/lib/admin";
import { getLocale } from "@/paraglide/runtime";
import { AsyncConfirmButton } from "@/components/async-confirm-button/async-confirm-button";

type PaymentChoiceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string | null;
  onSelectAdvance: () => void;
};

export function PaymentChoiceModal({
  open,
  onOpenChange,
  billId,
  onSelectAdvance,
}: PaymentChoiceModalProps) {
  const getCheckout = useGetPaymentMpCheckout();

  const handlePayNow = async () => {
    if (!billId) return;
    const redirect = `${import.meta.env.VITE_FRONT_URL}/adminsettings`;
    const language = getLocale();
    const checkout = await getCheckout(billId, redirect, language);
    if (checkout?.init_point) {
      window.open(checkout.init_point, "_self");
    }
  };

  const handlePayAdvance = () => {
    onOpenChange(false);
    onSelectAdvance();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[95vw] sm:w-[560px]
          min-w-[95vw] sm:min-w-[560px]
          max-w-[95vw] sm:max-w-[560px]
          max-h-[85dvh] sm:max-h-[90vh]
          overflow-y-auto
          px-6 sm:px-8
          py-5 sm:py-6
          mt-[env(safe-area-inset-top)]
        "
      >
        <DialogHeader className="space-y-0">
          <h2 className="text-lg font-semibold tracking-tight">
            {payment_choice_title()}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {payment_choice_subtitle()}
          </p>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pay now card */}
          <div
            className="
              flex flex-col justify-between rounded-xl border p-5
              border-border bg-muted/40 hover:bg-muted/50 transition-colors
            "
          >
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard className="h-4.5 w-4.5 text-primary" />
                </span>
                <h3 className="font-medium">{payment_choice_pay_now_title()}</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {payment_choice_pay_now_description()}
              </p>
            </div>
            <div className="mt-5">
              <AsyncConfirmButton
                onClick={handlePayNow}
                disabled={!billId}
                variant="outline"
                className="w-full"
              >
                {payment_choice_pay_now_button()}
              </AsyncConfirmButton>
            </div>
          </div>

          {/* Pay in advance card — highlighted */}
          <div
            className="
              relative flex flex-col justify-between rounded-xl border p-5
              border-emerald-500/30 bg-emerald-500/5
              ring-1 ring-emerald-500/20
              transition-colors
            "
          >
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
                  <CalendarRange className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </span>
                <h3 className="font-medium">{payment_choice_pay_advance_title()}</h3>
              </div>

              {/* Discount badge */}
              <div className="mt-3">
                <span
                  className="
                    inline-flex items-center gap-1.5 rounded-full
                    bg-emerald-500/15 px-3 py-1
                    text-xs font-semibold
                    text-emerald-600 dark:text-emerald-400
                    ring-1 ring-emerald-500/25
                  "
                >
                  <Percent className="h-3 w-3" />
                  {payment_choice_pay_advance_badge()}
                </span>
              </div>

              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {payment_choice_pay_advance_description()}
              </p>
            </div>
            <div className="mt-5">
              <Button
                variant="default"
                className="
                  w-full cursor-pointer
                  bg-emerald-600 hover:bg-emerald-700
                  dark:bg-emerald-600 dark:hover:bg-emerald-700
                  text-white
                "
                onClick={handlePayAdvance}
              >
                {payment_choice_pay_advance_button()}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
