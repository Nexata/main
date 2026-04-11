import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check } from "lucide-react";
import { CurrencyToggle } from "@/components/currency-toggle/currency-toggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useBillingUsage, useSetBillingPlan, useUsdArsQuote } from "@/lib/admin";
import { useCurrencyStore, formatAmount } from "@/lib/currency.store";
import {
  PLAN_CONFIG,
  UPGRADE_MODAL_PLANS,
  comparePlans,
  formatStorageLimit,
  getPlanDescription,
  getPlanFeatures,
  getPlanLabel,
  getPlanPrice,
  isDowngradePlan,
  isUpgradePlan,
  type TenantPlan,
} from "@/lib/tenant-plan";
import { useMyTenant } from "@/lib/user";
import {
  "components.upgrade_plan_modal.actions.acknowledge" as components_upgrade_plan_modal_ack,
  "components.upgrade_plan_modal.actions.cancel" as components_upgrade_plan_modal_cancel,
  "components.upgrade_plan_modal.actions.confirm" as components_upgrade_plan_modal_confirm,
  "components.upgrade_plan_modal.contact" as components_upgrade_plan_modal_contact,
  "components.upgrade_plan_modal.current_plan" as components_upgrade_plan_modal_current_plan,
  "components.upgrade_plan_modal.downgrade_button" as components_upgrade_plan_modal_downgrade_button,
  "components.upgrade_plan_modal.subtitle" as components_upgrade_plan_modal_subtitle,
  "components.upgrade_plan_modal.title" as components_upgrade_plan_modal_title,
  "components.upgrade_plan_modal.upgrade_button" as components_upgrade_plan_modal_upgrade_button,
  "components.upgrade_plan_modal.warnings.confirm_downgrade.description" as components_upgrade_plan_modal_confirm_dn_desc,
  "components.upgrade_plan_modal.warnings.confirm_downgrade.title" as components_upgrade_plan_modal_confirm_dn_title,
  "components.upgrade_plan_modal.warnings.confirm_upgrade.description" as components_upgrade_plan_modal_confirm_up_desc,
  "components.upgrade_plan_modal.warnings.confirm_upgrade.title" as components_upgrade_plan_modal_confirm_up_title,
  "components.upgrade_plan_modal.warnings.downgrade_not_allowed.description" as components_upgrade_plan_modal_warn_dn_desc,
  "components.upgrade_plan_modal.warnings.downgrade_not_allowed.title" as components_upgrade_plan_modal_warn_dn_title,
} from "@/paraglide/messages.js";
import { AsyncConfirmButton } from "../async-confirm-button/async-confirm-button";

type UpgradePlanModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlanUpgraded?: (billId: string) => void;
};

type PaidPlan = Exclude<TenantPlan, "free">;

export function UpgradePlanModal({ open, onOpenChange, onPlanUpgraded }: UpgradePlanModalProps) {
  const { data: tenant } = useMyTenant();
  const { data: usage } = useBillingUsage();
  const setPlan = useSetBillingPlan();
  const { data: usdArsQuote } = useUsdArsQuote();
  const quote = (usdArsQuote as number | null | undefined) ?? null;
  const showARS = useCurrencyStore((s) => s.showARS);

  const fmt = (usd: number) => formatAmount(usd, showARS, quote);
  const currentPlan = tenant?.plan as TenantPlan | undefined;

  const [selectedPlan, setSelectedPlan] = useState<TenantPlan | null>(null);
  const [ack, setAck] = useState(false);
  const warningRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) {
      setSelectedPlan(null);
      setAck(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (selectedPlan && warningRef.current) {
      setTimeout(() => {
        warningRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 300);
    }
  }, [selectedPlan]);

  const isUpgrade = useMemo(() => {
    if (!currentPlan || !selectedPlan) return false;
    return isUpgradePlan(currentPlan, selectedPlan);
  }, [currentPlan, selectedPlan]);

  const isDowngrade = useMemo(() => {
    if (!currentPlan || !selectedPlan) return false;
    return isDowngradePlan(currentPlan, selectedPlan);
  }, [currentPlan, selectedPlan]);

  const storageExceedsTarget = useMemo(() => {
    if (!selectedPlan || !isDowngrade || !usage) return false;

    const targetLimit = PLAN_CONFIG[selectedPlan].storageLimit;
    if (targetLimit === null || targetLimit === undefined) return false;

    return usage.storage.used > targetLimit;
  }, [selectedPlan, isDowngrade, usage]);

  const visiblePlans = useMemo<PaidPlan[]>(() => {
    if (!currentPlan) return UPGRADE_MODAL_PLANS;

    return [...UPGRADE_MODAL_PLANS].sort((a, b) => {
      const aDistance = Math.abs(comparePlans(currentPlan, a));
      const bDistance = Math.abs(comparePlans(currentPlan, b));

      if (a === currentPlan) return -1;
      if (b === currentPlan) return 1;
      if (aDistance !== bDistance) return aDistance - bDistance;

      return comparePlans(a, b);
    });
  }, [currentPlan]);

  const select = (plan: TenantPlan) => {
    if (!currentPlan || plan === currentPlan || !PLAN_CONFIG[plan].isSelfServe) return;
    setSelectedPlan(plan);
    setAck(false);
  };

  const confirm = async () => {
    if (!selectedPlan) return;

    const res = await setPlan(selectedPlan as Parameters<typeof setPlan>[0]);

    if (res?.billId && onPlanUpgraded) {
      onOpenChange(false);
      onPlanUpgraded(res.billId);
      return;
    }

    onOpenChange(false);
  };

  const buildPlanButton = (plan: TenantPlan, emphasis: "upgrade" | "neutral" | "downgrade") => {
    if (!currentPlan) return null;

    if (plan === currentPlan) {
      return (
        <Button
          variant="outline"
          disabled
          className="w-full cursor-not-allowed opacity-60"
        >
          {components_upgrade_plan_modal_current_plan()}
        </Button>
      );
    }

    if (!PLAN_CONFIG[plan].isSelfServe) {
      return (
        <Button variant="outline" disabled className="w-full cursor-not-allowed opacity-70">
          {components_upgrade_plan_modal_contact()}
        </Button>
      );
    }

    if (isUpgradePlan(currentPlan, plan)) {
      return (
        <Button
          variant={emphasis === "upgrade" ? "default" : "outline"}
          className="w-full cursor-pointer"
          onClick={() => select(plan)}
        >
          {components_upgrade_plan_modal_upgrade_button()}
        </Button>
      );
    }

    return (
      <Button
        variant="outline"
        className="w-full cursor-pointer"
        onClick={() => select(plan)}
      >
        {components_upgrade_plan_modal_downgrade_button()}
      </Button>
    );
  };

  const warning = () => {
    if (!selectedPlan || !currentPlan) return null;

    if (isDowngrade) {
      if (storageExceedsTarget) {
        const targetLimit = PLAN_CONFIG[selectedPlan].storageLimit ?? 0;
        const storageUsed = Math.round(usage?.storage.used ?? 0);

        return (
          <Warn
            title={components_upgrade_plan_modal_warn_dn_title()}
            onCancel={() => setSelectedPlan(null)}
          >
            {components_upgrade_plan_modal_warn_dn_desc({
              used: String(storageUsed),
              limit: formatStorageLimit(targetLimit),
            })}
          </Warn>
        );
      }

      return (
        <Confirm
          title={components_upgrade_plan_modal_confirm_dn_title()}
          onCancel={() => setSelectedPlan(null)}
          ack={ack}
          setAck={setAck}
          confirm={confirm}
        >
          <p>{components_upgrade_plan_modal_confirm_dn_desc()}</p>
        </Confirm>
      );
    }

    if (isUpgrade) {
      return (
        <Confirm
          title={components_upgrade_plan_modal_confirm_up_title()}
          onCancel={() => setSelectedPlan(null)}
          ack={ack}
          setAck={setAck}
          confirm={confirm}
        >
          <p>{components_upgrade_plan_modal_confirm_up_desc()}</p>
        </Confirm>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
        w-[95vw] sm:w-[85vw] lg:w-[70vw]
        min-w-[95vw] sm:min-w-[85vw] lg:min-w-[70vw]
        max-w-[95vw] sm:max-w-[85vw] lg:max-w-[70vw]
        max-h-[85dvh] sm:max-h-[90vh]
        overflow-y-auto
        px-6 sm:px-8
        py-5 sm:py-8
        mt-[env(safe-area-inset-top)]
        scrollbar-thin
        "
      >
        <DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {components_upgrade_plan_modal_title()}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {components_upgrade_plan_modal_subtitle()}
              </p>
            </div>
            <CurrencyToggle className="mt-0.5" />
          </div>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {visiblePlans.map((plan) => {
            const config = PLAN_CONFIG[plan];
            const isCurrent = plan === currentPlan;
            const isUpgradeTarget = currentPlan ? isUpgradePlan(currentPlan, plan) : false;
            const emphasis = isCurrent
              ? "current"
              : isUpgradeTarget
                ? "upgrade"
                : "downgrade";
            const Icon = config.Icon;

            return (
              <PlanCard
                key={plan}
                icon={
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${config.cardIconContainerClassName}`}
                  >
                    <Icon className={`h-4 w-4 ${config.cardIconClassName}`} />
                  </span>
                }
                title={getPlanLabel(plan)}
                price={getPlanPrice(plan, fmt)}
                description={getPlanDescription(plan)}
                features={getPlanFeatures(plan)}
                action={buildPlanButton(plan, emphasis === "upgrade" ? "upgrade" : "downgrade")}
                emphasis={emphasis}
              />
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {selectedPlan && (
            <motion.div
              ref={warningRef}
              key={selectedPlan}
              className="mt-6"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{
                duration: 0.25,
                ease: "easeInOut",
              }}
            >
              {warning()}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function Warn({
  title,
  children,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
}) {
  return (
    <div
      className="
        flex flex-col gap-4 rounded-lg border px-4 py-3 w-full
        backdrop-blur-xl
        border-amber-500/30 bg-amber-500/10
        text-amber-700 dark:text-amber-300
        text-sm leading-relaxed shadow-sm
      "
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 opacity-90" />
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>

      <div className="space-y-2">{children}</div>

      <div className="flex justify-end pt-1">
        <Button
          variant="destructive"
          className="cursor-pointer"
          onClick={onCancel}
        >
          {components_upgrade_plan_modal_cancel()}
        </Button>
      </div>
    </div>
  );
}

function Confirm({
  title,
  children,
  ack,
  setAck,
  confirm,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  ack: boolean;
  setAck: (v: boolean) => void;
  confirm: () => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <div
      className="
        flex flex-col gap-5 rounded-lg border px-4 py-3 w-full
        backdrop-blur-xl
        border-amber-500/30 bg-amber-500/10
        text-amber-700 dark:text-amber-300
        text-sm leading-relaxed shadow-sm
      "
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 opacity-90" />
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>

      <div className="space-y-2">{children}</div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Checkbox
            className="cursor-pointer"
            checked={ack}
            onCheckedChange={(v) => setAck(!!v)}
          />
          <span className="text-xs">
            {components_upgrade_plan_modal_ack()}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="destructive"
            className="cursor-pointer"
            onClick={onCancel}
          >
            {components_upgrade_plan_modal_cancel()}
          </Button>

          <AsyncConfirmButton
            disabled={!ack}
            onClick={confirm}
          >
            {components_upgrade_plan_modal_confirm()}
          </AsyncConfirmButton>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  icon,
  title,
  price,
  description,
  features,
  action,
  emphasis,
}: {
  icon: React.ReactNode;
  title: string;
  price: string;
  description: string;
  features: string[];
  action: React.ReactNode;
  emphasis: "current" | "upgrade" | "downgrade";
}) {
  const cardClassName =
    emphasis === "upgrade"
      ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20"
      : emphasis === "current"
        ? "border-border bg-background ring-1 ring-border/80"
        : "border-border bg-muted/30 hover:bg-muted/40";

  return (
    <div
      className={`
        relative flex flex-col justify-between rounded-xl border p-5 transition-colors
        ${cardClassName}
      `}
    >
      <div>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-medium">{title}</h3>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">{description}</p>

        <p className="mt-3 text-2xl font-semibold tracking-tight">{price}</p>

        <ul className="mt-4 space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-primary shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">{action}</div>
    </div>
  );
}
