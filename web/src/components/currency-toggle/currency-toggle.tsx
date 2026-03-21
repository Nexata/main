import {
  "admin.billing.currency_toggle.quote_label" as admin_billing_quote_label,
  "admin.billing.currency_toggle.ars_surcharge_tooltip" as admin_billing_ars_surcharge_tooltip,
} from "@/paraglide/messages.js";
import { useUsdArsQuote } from "@/lib/admin";
import { useCurrencyStore } from "@/lib/currency.store";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type CurrencyToggleProps = {
  className?: string;
};

export function CurrencyToggle({ className }: CurrencyToggleProps) {
  const { data: usdArsQuote } = useUsdArsQuote();
  const quote = (usdArsQuote as number | null | undefined) ?? null;
  const showARS = useCurrencyStore((s) => s.showARS);
  const setShowARS = useCurrencyStore((s) => s.setShowARS);

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 shrink-0", className)}>
      <div className="flex items-center rounded-md bg-muted p-0.5 gap-0.5">
        <button
          onClick={() => setShowARS(false)}
          disabled={!quote}
          className={cn(
            "relative px-2.5 py-1 text-xs font-medium rounded transition-all duration-200 outline-none",
            !showARS
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          USD
        </button>
        <button
          onClick={() => setShowARS(true)}
          disabled={!quote}
          className={cn(
            "relative px-2.5 py-1 text-xs font-medium rounded transition-all duration-200 outline-none",
            showARS
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            !quote && "opacity-40 cursor-not-allowed",
          )}
        >
          ARS
        </button>
      </div>

      {quote && (
        <span className="text-[10px] text-muted-foreground border-l border-border pl-3 tabular-nums">
          <strong>
            {admin_billing_quote_label({
              quote: quote.toLocaleString("es-AR"),
            })}
          </strong>
        </span>
      )}

      {showARS && quote && (
        <Tooltip>
          <TooltipTrigger className="text-muted-foreground hover:text-foreground transition-colors cursor-help">
            <Info className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {admin_billing_ars_surcharge_tooltip()}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
