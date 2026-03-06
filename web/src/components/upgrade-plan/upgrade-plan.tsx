import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Mail, Star, Briefcase, AlertTriangle } from "lucide-react";
import {
  "components.upgrade_plan_modal.title" as components_upgrade_plan_modal_title,
  "components.upgrade_plan_modal.subtitle" as components_upgrade_plan_modal_subtitle,
  "components.upgrade_plan_modal.plans.personal.title" as components_upgrade_plan_modal_plans_personal_title,
  "components.upgrade_plan_modal.plans.personal.price" as components_upgrade_plan_modal_plans_personal_price,
  "components.upgrade_plan_modal.plans.personal.description" as components_upgrade_plan_modal_plans_personal_description,
  "components.upgrade_plan_modal.plans.personal.features.messages" as components_upgrade_plan_modal_plans_personal_features_messages,
  "components.upgrade_plan_modal.plans.personal.features.storage" as components_upgrade_plan_modal_plans_personal_features_storage,
  "components.upgrade_plan_modal.plans.personal.features.embeddings" as components_upgrade_plan_modal_plans_personal_features_embeddings,
  "components.upgrade_plan_modal.plans.business.title" as components_upgrade_plan_modal_plans_business_title,
  "components.upgrade_plan_modal.plans.business.price" as components_upgrade_plan_modal_plans_business_price,
  "components.upgrade_plan_modal.plans.business.description" as components_upgrade_plan_modal_plans_business_description,
  "components.upgrade_plan_modal.plans.business.features.messages" as components_upgrade_plan_modal_plans_business_features_messages,
  "components.upgrade_plan_modal.plans.business.features.storage" as components_upgrade_plan_modal_plans_business_features_storage,
  "components.upgrade_plan_modal.plans.business.features.embeddings" as components_upgrade_plan_modal_plans_business_features_embeddings,
  "components.upgrade_plan_modal.plans.custom.title" as components_upgrade_plan_modal_plans_custom_title,
  "components.upgrade_plan_modal.plans.custom.price" as components_upgrade_plan_modal_plans_custom_price,
  "components.upgrade_plan_modal.plans.custom.description" as components_upgrade_plan_modal_plans_custom_description,
  "components.upgrade_plan_modal.plans.custom.features.custom_plans" as components_upgrade_plan_modal_plans_custom_features_custom_plans,
  "components.upgrade_plan_modal.plans.custom.features.external_integrations" as components_upgrade_plan_modal_plans_custom_features_external_integrations,
  "components.upgrade_plan_modal.plans.custom.features.data_sources" as components_upgrade_plan_modal_plans_custom_features_data_sources,
  "components.upgrade_plan_modal.contact" as components_upgrade_plan_modal_contact,
  "components.upgrade_plan_modal.current_plan" as components_upgrade_plan_modal_current_plan,
  "components.upgrade_plan_modal.downgrade_button" as components_upgrade_plan_modal_downgrade_button,
  "components.upgrade_plan_modal.upgrade_button" as components_upgrade_plan_modal_upgrade_button,
  "components.upgrade_plan_modal.warnings.downgrade_not_allowed.title" as components_upgrade_plan_modal_warn_dn_title,
  "components.upgrade_plan_modal.warnings.downgrade_not_allowed.description" as components_upgrade_plan_modal_warn_dn_desc,
  "components.upgrade_plan_modal.warnings.downgrade_not_available.title" as components_upgrade_plan_modal_warn_na_title,
  "components.upgrade_plan_modal.warnings.downgrade_not_available.description" as components_upgrade_plan_modal_warn_na_desc,
  "components.upgrade_plan_modal.warnings.confirm_downgrade.title" as components_upgrade_plan_modal_confirm_dn_title,
  "components.upgrade_plan_modal.warnings.confirm_downgrade.description" as components_upgrade_plan_modal_confirm_dn_desc,
  "components.upgrade_plan_modal.warnings.confirm_upgrade.title" as components_upgrade_plan_modal_confirm_up_title,
  "components.upgrade_plan_modal.warnings.confirm_upgrade.description" as components_upgrade_plan_modal_confirm_up_desc,
  "components.upgrade_plan_modal.actions.cancel" as components_upgrade_plan_modal_cancel,
  "components.upgrade_plan_modal.actions.confirm" as components_upgrade_plan_modal_confirm,
  "components.upgrade_plan_modal.actions.acknowledge" as components_upgrade_plan_modal_ack,
} from "@/paraglide/messages.js";
import { useBillingLastBill, useSetBillingPlan } from "@/lib/admin";
import { useMyTenant, type Plan } from "@/lib/user";
import { AsyncConfirmButton } from "../async-confirm-button/async-confirm-button";
import { useGetPaymentMpCheckout } from "@/lib/admin";
import { getLocale } from "@/paraglide/runtime";

type UpgradePlanModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ORDER: Plan[] = [
  "free" as Plan,
  "personal" as Plan,
  "business" as Plan,
  "pay_as_you_go" as Plan,
];

export function UpgradePlanModal({ open, onOpenChange }: UpgradePlanModalProps) {
  const { data: lastBill } = useBillingLastBill();
  const { data: tenant } = useMyTenant();
  const setPlan = useSetBillingPlan();
  const getCheckout = useGetPaymentMpCheckout();

  const currentPlan = tenant?.plan as Plan | undefined;

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [ack, setAck] = useState(false);

  React.useEffect(() => {
    if (!open) {
      setSelectedPlan(null);
      setAck(false);
    }
  }, [open]);

  const isUpgrade = useMemo(() => {
    if (!currentPlan || !selectedPlan) return false;
    return ORDER.indexOf(selectedPlan) > ORDER.indexOf(currentPlan);
  }, [selectedPlan, currentPlan]);

  const isDowngrade = useMemo(() => {
    if (!currentPlan || !selectedPlan) return false;
    return ORDER.indexOf(selectedPlan) < ORDER.indexOf(currentPlan);
  }, [selectedPlan, currentPlan]);

  const buildPlanButton = (plan: Plan, variant: "outline" | "default" = "outline") => {
    if (!currentPlan) return null;

    if (plan === "pay_as_you_go") {
      return (
        <Button variant="outline" className="w-full cursor-pointer">
          {components_upgrade_plan_modal_contact()}
        </Button>
      );
    }

    const currentIndex = ORDER.indexOf(currentPlan);
    const targetIndex = ORDER.indexOf(plan);

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

    if (targetIndex > currentIndex) {
      return (
        <Button
          variant={variant}
          className="w-full cursor-pointer text-"
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

  const canDowngrade =
    isDowngrade &&
    selectedPlan !== "free" &&
    lastBill &&
    lastBill.plan === currentPlan &&
    lastBill.paid === false;

  const select = (plan: Plan) => {
    if (!currentPlan || plan === currentPlan) return;
    setSelectedPlan(plan);
    setAck(false);
  };

  const confirm = async () => {
    if (!selectedPlan) return;

    const res = await setPlan(selectedPlan);

    if (isUpgrade && res?.billId) {
      const redirect = `${import.meta.env.VITE_FRONT_URL}/adminsettings`;
      const language = getLocale();
      const checkout = await getCheckout(res.billId, redirect, language);
      if (checkout?.init_point) {
        window.open(checkout.init_point, "_self");
        return;
      }
    }

    onOpenChange(false);
  };

  const warning = () => {
    if (!selectedPlan || !currentPlan) return null;

    if (isDowngrade) {
      if (selectedPlan === "free") {
        return (
          <Warn
            title={components_upgrade_plan_modal_warn_dn_title()}
            onCancel={() => setSelectedPlan(null)}
          >
            {components_upgrade_plan_modal_warn_dn_desc()}
          </Warn>
        );
      }

      if (!canDowngrade) {
        return (
          <Warn
            title={components_upgrade_plan_modal_warn_na_title()}
            onCancel={() => setSelectedPlan(null)}
          >
            <p>{components_upgrade_plan_modal_warn_na_desc()}</p>
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
          max-w-[95vw] sm:max-w-[85vw] lg:max-w-[70vw]
          max-h-[90vh]
          overflow-y-auto
          px-6 sm:px-8
          py-8 sm:py-10
          scrollbar-thin
        "
      >
        <DialogHeader>
          <h2 className="text-lg font-semibold tracking-tight">
            {components_upgrade_plan_modal_title()}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {components_upgrade_plan_modal_subtitle()}
          </p>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PlanCard
            icon={<span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10"><Star className="h-4 w-4 text-sky-600" /></span>}
            title={components_upgrade_plan_modal_plans_personal_title()}
            price={components_upgrade_plan_modal_plans_personal_price()}
            description={components_upgrade_plan_modal_plans_personal_description()}
            features={[
              components_upgrade_plan_modal_plans_personal_features_messages(),
              components_upgrade_plan_modal_plans_personal_features_storage(),
              components_upgrade_plan_modal_plans_personal_features_embeddings(),
            ]}
            action={buildPlanButton("personal" as Plan)}
          />

          <PlanCard
            highlighted
            icon={<Briefcase className="h-5 w-5 text-primary" />}
            title={components_upgrade_plan_modal_plans_business_title()}
            price={components_upgrade_plan_modal_plans_business_price()}
            description={components_upgrade_plan_modal_plans_business_description()}
            features={[
              components_upgrade_plan_modal_plans_business_features_messages(),
              components_upgrade_plan_modal_plans_business_features_storage(),
              components_upgrade_plan_modal_plans_business_features_embeddings(),
            ]}
            action={buildPlanButton("business" as Plan, "default")}
          />

          <PlanCard
            icon={<span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10"><Mail className="h-4 w-4 text-violet-600" /></span>}
            title={components_upgrade_plan_modal_plans_custom_title()}
            price={components_upgrade_plan_modal_plans_custom_price()}
            description={components_upgrade_plan_modal_plans_custom_description()}
            features={[
              components_upgrade_plan_modal_plans_custom_features_custom_plans(),
              components_upgrade_plan_modal_plans_custom_features_external_integrations(),
              components_upgrade_plan_modal_plans_custom_features_data_sources(),
            ]}
            action={buildPlanButton("pay_as_you_go" as Plan)}
          />
        </div>

        <AnimatePresence mode="wait">
          {selectedPlan && (
            <motion.div
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

/* ---------- helpers ---------- */

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
      {/* header */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 opacity-90" />
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>

      {/* description */}
      <div className="space-y-2">{children}</div>

      {/* actions */}
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
      {/* header */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 opacity-90" />
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>

      {/* description */}
      <div className="space-y-2">{children}</div>

      {/* actions */}
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

/* ----------------------------- Plan Card ----------------------------- */

function PlanCard({
  icon,
  title,
  price,
  description,
  features,
  action,
  highlighted = false,
}: {
  icon: React.ReactNode;
  title: string;
  price: string;
  description: string;
  features: string[];
  action: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`
        relative flex flex-col justify-between rounded-xl border p-5 transition-colors
        ${
          highlighted
            ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20"
            : "border-border bg-muted/40 hover:bg-muted/50"
        }
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
