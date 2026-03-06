import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	MessageSquarePlus,
	Pencil,
	Settings,
	Trash,
  TrendingUp,
  Calendar as CalendarIcon  ,
  Filter,
  Gem,
  Crown,
  Sparkles,
  Diamond,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AsyncConfirmButton } from '@/components/async-confirm-button/async-confirm-button';
import { BuyMessagesModal } from '@/components/buy-messages/buy-messages-modal';
import { infoToast } from '@/components/info-toast/info-toast';
import { TenantLogo } from '@/components/tenant-logo/tenant-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { FilePreview } from '@/components/ui/file-preview';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
	TooltipContent,
	TooltipTrigger,
	Tooltip as TooltipUi,
} from '@/components/ui/tooltip';
import { UpgradePlanModal } from '@/components/upgrade-plan/upgrade-plan';
import UserSection from '@/components/user-section/user-section';
import {
  useAdminTraceCount,
	useBillingUsage,
	useCreateUser,
	useDeleteUser,
	useEditTenant,
	useEditUser,
	useUsers,
  useBillingBills,
  useBillingLastBill,
  useBillingLastRefillBill,
  useUsdArsQuote,
  type TraceType,
} from '@/lib/admin';
import { useMyTenant, type Language, type Plan } from '@/lib/user';
import { UsageBar } from '@/components/usage-bar/usage-bar'
import { useAdminTrace } from '@/lib/admin';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	'admin.company_overview.buy_messages' as admin_company_overview_buy_messages,
	'admin.company_overview.current_plan' as admin_company_overview_current_plan,
	'admin.company_overview.description' as admin_company_overview_description,
	'admin.company_overview.edit' as admin_company_overview_edit,
	'admin.company_overview.embeddings_balance' as admin_company_overview_embeddings_balance,
	'admin.company_overview.message_balance' as admin_company_overview_message_balance,
	'admin.company_overview.storage_balance' as admin_company_overview_storage_balance,
	'admin.company_overview.tenant_logo' as admin_company_overview_tenant_logo,
	'admin.company_overview.tenant_name' as admin_company_overview_tenant_name,
	'admin.company_overview.title' as admin_company_overview_title,
	'admin.company_overview.upgrade_plan' as admin_company_overview_upgrade_plan,
	'admin.header.back_to_chat' as admin_header_back_to_chat,
	'admin.header.personal_panel' as admin_header_personal_panel,
	'admin.header.subtitle' as admin_header_subtitle,
	'admin.header.title' as admin_header_title,
	'admin.meta.title' as admin_meta_title,
	'admin.users.actions.display_name' as admin_users_actions_display_name,
	'admin.users.actions.edit' as admin_users_actions_edit,
	'admin.users.actions.img' as admin_users_actions_img,
	'admin.users.actions.remove' as admin_users_actions_remove,
	'admin.users.delete.error.description' as admin_users_delete_error_description,
	'admin.users.delete.error.title' as admin_users_delete_error_title,
	'admin.users.delete.loading.description' as admin_users_delete_loading_description,
	'admin.users.delete.loading.title' as admin_users_delete_loading_title,
	'admin.users.delete.success.description' as admin_users_delete_success_description,
	'admin.users.delete.success.title' as admin_users_delete_success_title,
	'admin.users.description' as admin_users_description,
	'admin.users.dialogs.delete.description' as admin_users_dialogs_delete_description,
	'admin.users.dialogs.delete.title' as admin_users_dialogs_delete_title,
	'admin.users.invite.adminWarning' as admin_users_invite_adminWarning,
	'admin.users.invite.helper' as admin_users_invite_helper,
	'admin.users.invite.placeholder' as admin_users_invite_placeholder,
	'admin.users.invite.send' as admin_users_invite_send,
	'admin.users.invite.success' as admin_users_invite_success,
	'admin.users.invite.title' as admin_users_invite_title,
	'admin.users.title' as admin_users_title,
	'common.cancel' as common_cancel,
	'common.confirm' as common_confirm,
	'common.loading' as common_loading,
  'common.save_changes' as common_save_changes,
  'admin.traces.title' as traces_title,
  'admin.traces.description' as traces_description,
  'admin.traces.filters.type' as traces_filter_type,
  'admin.traces.filters.all' as traces_filter_all,
  'admin.traces.filters.from' as traces_filter_from,
  'admin.traces.filters.to' as traces_filter_to,
  'admin.traces.filters.clear' as traces_filter_clear,
  'admin.traces.table.date' as traces_table_date,
  'admin.traces.table.type' as traces_table_type,
  'admin.traces.table.user' as traces_table_user,
  'admin.traces.table.metadata' as traces_table_metadata,
  'admin.traces.empty.title' as traces_empty_title,
  'admin.traces.empty.description' as traces_empty_description,
  'admin.traces.pagination.page' as traces_page,
  'admin.traces.pagination.rows' as traces_rows,
  'admin.traces.pagination.prev' as traces_prev,
  'admin.traces.pagination.next' as traces_next,
  'admin.traces.user.system' as traces_user_system,
  'admin.traces.metadata.provider' as traces_meta_provider,
  'admin.traces.metadata.file' as traces_meta_file,
  'admin.traces.types.credential_added' as traces_type_credential_added,
  'admin.traces.types.credential_removed' as traces_type_credential_removed,
  'admin.traces.types.ingest_failed' as traces_type_ingest_failed,
  'admin.company_overview.plans.free' as admin_company_overview_plans_free,
  'admin.company_overview.plans.business' as admin_company_overview_plans_business,
  'admin.company_overview.plans.pay_as_you_go' as admin_company_overview_plans_pay_as_you_go,
  'admin.company_overview.plans.personal' as admin_company_overview_plans_personal,
  'admin.company_overview.billing' as admin_company_overview_billing
} from '@/paraglide/messages.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_private/adminsettings')({
	component: AdminSettingsPage,
});

/* -------------------------------------------------------------------------- */
/*                              Main Page                                     */
/* -------------------------------------------------------------------------- */

function AdminSettingsPage() {
	useEffect(() => {
		document.title = admin_meta_title();
	}, []);
	const navigate = useNavigate();
  const { data: usdArsQuote } = useUsdArsQuote();

	return (
		<div className="flex flex-col gap-6 px-4 py-6 max-w-screen-2xl mx-auto">
			{/* Header */}
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-semibold tracking-tight">
						{admin_header_title()}
					</h1>
					<p className="text-sm text-muted-foreground">
						{admin_header_subtitle()}
					</p>
				</div>

				<div className="flex gap-2">
					<Button
						variant="secondary"
						onClick={() => navigate({ to: '/settings' })}
						className="
							cursor-pointer
							bg-secondary
							text-secondary-foreground
							border border-border
							hover:bg-muted
							hover:text-foreground
							hover:shadow-sm
							transition-all
						"
					>
						<Settings className="h-4 w-4 mr-2 opacity-80" />
						{admin_header_personal_panel()}
					</Button>

					<Button
						variant="outline"
						onClick={() => navigate({ to: '/chat' })}
						className="cursor-pointer hover:bg-muted transition-colors"
					>
						<ArrowLeft className="h-4 w-4 mr-2" />
						{admin_header_back_to_chat()}
					</Button>
				</div>
			</header>

			<div className="h-px bg-border" />

      <CompanyOverviewSection />
      <BillingSection usdArsQuote={usdArsQuote as number | null | undefined} />
			<TraceEventsSection />
			<UsersSection />
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*                         CompanyOverviewSection                              */
/* -------------------------------------------------------------------------- */

function CompanyOverviewSection() {
  const _navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: myTenant, isLoading: tenantLoading } = useMyTenant();
	const [editingTenant, setEditingTenant] = useState(false);
	const [tenantDisplayName, setTenantDisplayName] = useState('');
	const [tenantLogo, setTenantLogo] = useState<File | null>(null);
	const editTenantFn = useEditTenant();
	const [buyMessagesOpen, setBuyMessagesOpen] = useState(false);
	const [upgradePlanOpen, setUpgradePlanOpen] = useState(false);
	const { data: usage, isLoading: usageLoading } = useBillingUsage();

  const embeddingsUsed = usage?.embeds?.used ?? 0;
  const embeddingsTotal = usage?.embeds?.limit ?? 0;

  const storageUsed = usage?.storage?.used ?? 0;
  const storageTotal = usage?.storage?.limit ?? 0;

  const messageUsed = usage?.messages?.used ?? 0;
  const messageTotal = usage?.messages?.limit ?? 0;

	useEffect(() => {
		if (myTenant) {
			setTenantDisplayName(myTenant.displayName ?? '');
			setTenantLogo(null);
		}
  }, [myTenant]);

	const PLAN_UI: Record<
    Plan,
    {
      label: string;
      color: string;
      Icon: React.ComponentType<any>;
    }
  > = {
    free: {
      label: admin_company_overview_plans_free(),
      color: "bg-emerald-500/10 text-emerald-600",
      Icon: Sparkles,
    },
    personal: {
      label: admin_company_overview_plans_personal(),
      color: "bg-amber-500/10 text-amber-600",
      Icon: Gem,
    },
    business: {
      label: admin_company_overview_plans_business(),
      color: "bg-primary/10 text-primary",
      Icon: Crown,
    },
    pay_as_you_go: {
      label: admin_company_overview_plans_pay_as_you_go(),
      color: "bg-violet-500/10 text-violet-600",
      Icon: Diamond,
    },
  };
  const planUI = myTenant ? PLAN_UI[myTenant.plan] : null;
	const isPayAsYouGo = myTenant?.plan === 'pay_as_you_go';

	return (
		<Card className="bg-sidebar">
			<CardContent className="p-6 space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<div className="flex items-center gap-2">
							<h2 className="text-lg font-semibold">
								{admin_company_overview_title()}
							</h2>
							<TooltipUi>
								<TooltipTrigger>
									<Button
										size="icon"
										variant="ghost"
										className="cursor-pointer"
										onClick={() => setEditingTenant((v) => !v)}
									>
										<Pencil className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>{admin_company_overview_edit()}</TooltipContent>
							</TooltipUi>
						</div>
						<p className="text-sm text-muted-foreground">
							{admin_company_overview_description()}
						</p>
					</div>

					<TenantLogo
						loading={tenantLoading}
						logoUrl={myTenant?.logoUrl}
						displayName={myTenant?.displayName}
					/>
				</div>

				<Separator />

				<AnimatePresence>
					{editingTenant && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: 'auto' }}
							exit={{ opacity: 0, height: 0 }}
							transition={{ duration: 0.25 }}
							className="overflow-hidden"
						>
							<div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
								<div className="flex flex-col md:flex-row md:items-end gap-4">
									<div className="flex flex-col gap-1">
										<label className="text-sm font-medium">
											{admin_company_overview_tenant_name()}
										</label>
										<Input
											className="w-full md:w-64 h-8 text-sm"
											value={tenantDisplayName}
											onChange={(e) => setTenantDisplayName(e.target.value)}
										/>
									</div>

									<div className="flex flex-col gap-1">
										<label className="text-sm font-medium">
											{admin_company_overview_tenant_logo()}
										</label>
										<Input
											type="file"
											accept="image/*"
											className="w-56 h-8 text-sm"
											onChange={(e) =>
												setTenantLogo(e.target.files?.[0] ?? null)
											}
										/>
									</div>

									{tenantLogo && (
										<div className="self-center flex items-center justify-center">
											<FilePreview
												file={tenantLogo}
												onRemove={() => setTenantLogo(null)}
											/>
										</div>
									)}

									<div className="ml-auto flex items-end gap-2">
										<Button
											variant="ghost"
											className="h-8 px-3 text-sm cursor-pointer"
											onClick={() => {
												setEditingTenant(false);
												setTenantDisplayName(myTenant?.displayName ?? '');
												setTenantLogo(null);
											}}
										>
											{common_cancel()}
										</Button>

										<AsyncConfirmButton
											className="h-8 px-3 text-sm"
											onClick={async () => {
												await editTenantFn({
													displayName: tenantDisplayName,
													logo: tenantLogo ?? undefined,
												});
												setEditingTenant(false);
												setTenantLogo(null);
											}}
										>
											{common_save_changes()}
										</AsyncConfirmButton>
									</div>
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				<div className="space-y-4">
					<UsageBar
						label={admin_company_overview_message_balance()}
						used={messageUsed}
						total={messageTotal}
						colorClass="bg-primary"
						loading={usageLoading}
					/>

					<UsageBar
						label={admin_company_overview_embeddings_balance()}
						used={embeddingsUsed / 1_000_000}
            total={embeddingsTotal / 1_000_000}
						unit="M"
						colorClass="bg-indigo-500"
						loading={usageLoading}
					/>

					<UsageBar
						label={admin_company_overview_storage_balance()}
						used={storageUsed}
						total={storageTotal}
            colorClass="bg-emerald-500"
						unit="MB"
						loading={usageLoading}
					/>
				</div>

				{/* Plan + actions */}
				<div className="flex items-center justify-between">
					<div className="flex items-center">
						<span className="text-sm text-muted-foreground">
							{admin_company_overview_current_plan()}
						</span>
						{planUI && (
              <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${planUI.color}`}>
                <planUI.Icon className="w-3.5 h-3.5" />
                {planUI.label}
              </span>
            )}
					</div>

					<div className="flex gap-2">
            {!isPayAsYouGo && (
              <>
                {/* Upgrade */}
                <Button
                  size="sm"
                  className="cursor-pointer bg-orange-500/90 hover:bg-orange-500 text-white"
                  onClick={() => setUpgradePlanOpen(true)}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  {admin_company_overview_upgrade_plan()}
                </Button>

                {/* Buy messages */}
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setBuyMessagesOpen(true)}
                >
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  {admin_company_overview_buy_messages()}
                </Button>
              </>
            )}

            {/* Billing */}
            {isPayAsYouGo && (
              <Button
                size="sm"
                onClick={() => _navigate({ to: '/billing' })}
                className="cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                {admin_company_overview_billing()}
              </Button>
            )}
          </div>
				</div>

				<BuyMessagesModal
					open={buyMessagesOpen}
					onOpenChange={setBuyMessagesOpen}
				/>

				<UpgradePlanModal
          open={upgradePlanOpen}
          onOpenChange={(open) => {
            setUpgradePlanOpen(open);
            if (!open) {
              queryClient.invalidateQueries({
                queryKey: ['my-tenant'],
              });
            }
          }}
        />
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */
/*                              BillingSection                                */
/* -------------------------------------------------------------------------- */

type BillingSectionProps = { usdArsQuote: number | null | undefined; };

function BillingSection({ usdArsQuote }: BillingSectionProps) {
  const { data: lastBill, isLoading: lastBillLoading } = useBillingLastBill();
  const { data: lastRefillBill, isLoading: lastRefillLoading } = useBillingLastRefillBill();
  const [showARS, setShowARS] = useState(false);
  const BILLS_PAGE_SIZE = 5;
  const [billsCursorStack, setBillsCursorStack] = useState<(string | null)[]>([null]);
  const [billsPage, setBillsPage] = useState(1);
  const billsCursor = billsCursorStack[billsPage - 1] ?? null;

  const { data: bills, isLoading: billsLoading } = useBillingBills({
    cursor: billsCursor ?? undefined,
    limit: BILLS_PAGE_SIZE,
  });

  useEffect(() => {
    if (bills !== undefined) console.log("[bills]", bills);
  }, [bills]);

  const quote = usdArsQuote ?? null;

  const formatAmount = (amount: string | number) => {
    const usd = parseFloat(String(amount));
    if (showARS && quote) return "$" + (usd * quote).toLocaleString("es-AR", { maximumFractionDigits: 0 });
    return "USD " + usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

  const SOURCE_LABEL: Record<string, string> = {
    plan_change: "Cambio de plan",
    refill: "Recarga",
  };

  const PLAN_COLOR: Record<string, string> = {
    free: "bg-emerald-500/10 text-emerald-600",
    personal: "bg-amber-500/10 text-amber-600",
    business: "bg-primary/10 text-primary",
    pay_as_you_go: "bg-violet-500/10 text-violet-600",
  };

  // Animated amount — fades + slides on currency switch
  const AnimatedAmount = ({ value }: { value: string }) => (
    <AnimatePresence mode="wait">
      <motion.span
        key={value}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="tabular-nums"
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );

  const BillCardSkeleton = () => (
    <div className="rounded-xl border border-border bg-background p-5 space-y-4 animate-pulse shadow-sm">
      <div className="flex items-center justify-between">
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="flex items-end justify-between">
        <div className="h-7 w-24 rounded bg-muted" />
        <div className="h-3 w-20 rounded bg-muted" />
      </div>
      <Separator />
      <div className="space-y-2">
        <div className="flex justify-between">
          <div className="h-3 w-10 rounded bg-muted" />
          <div className="h-5 w-20 rounded-full bg-muted" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-14 rounded bg-muted" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      </div>
      <Separator />
      <div className="space-y-2">
        <div className="h-3 w-12 rounded bg-muted" />
        {[1, 2, 3].map(i => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-16 rounded bg-muted opacity-60" />
            <div className="h-3 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Card className="bg-sidebar">
      <CardContent className="p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Facturación</h2>
            <p className="text-sm text-muted-foreground">
              Historial de facturas y recargas de mensajes.
            </p>
          </div>

          {/* Currency toggle */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 shrink-0">
            {/* Segmented control style */}
            <div className="flex items-center rounded-md bg-muted p-0.5 gap-0.5">
              <button
                onClick={() => setShowARS(false)}
                disabled={!quote}
                className={cn(
                  "relative px-2.5 py-1 text-xs font-medium rounded transition-all duration-200 outline-none",
                  !showARS
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
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
                  !quote && "opacity-40 cursor-not-allowed"
                )}
              >
                ARS
              </button>
            </div>

            {quote && (
              <span className="text-[10px] text-muted-foreground border-l border-border pl-3 tabular-nums">
                <strong>1 USD = ARS {quote.toLocaleString("es-AR")}</strong>
              </span>
            )}
          </div>
        </div>

        <Separator />

        {/* Last bills row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Last Bill */}
          {lastBillLoading ? <BillCardSkeleton /> : (
            <div className="rounded-xl border border-border bg-background shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Última factura
                </p>
                {lastBill && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${lastBill.paid ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                    {lastBill.paid ? "Pagada" : "Pendiente"}
                  </span>
                )}
              </div>

              {lastBill ? (
                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold overflow-hidden">
                      <AnimatedAmount value={formatAmount(lastBill.amount)} />
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(lastBill.createdAt)}</span>
                  </div>

                  <Separator />

                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plan</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PLAN_COLOR[lastBill.plan] ?? "bg-muted text-muted-foreground"}`}>
                        {lastBill.plan}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Origen</span>
                      <span className="font-medium">{SOURCE_LABEL[lastBill.source] ?? lastBill.source}</span>
                    </div>
                  </div>

                  {lastBill.details && (
                    <>
                      <Separator />
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground text-xs uppercase tracking-wide mb-1">Detalle</p>
                        {"baseBill" in lastBill.details && (
                          <div className="flex justify-between">
                            <span>Base</span>
                            <span className="text-foreground font-medium overflow-hidden">
                              <AnimatedAmount value={formatAmount(lastBill.details.baseBill as number)} />
                            </span>
                          </div>
                        )}
                        {"message" in lastBill.details && (
                          <div className="flex justify-between">
                            <span>Mensajes</span>
                            <span className="text-foreground font-medium overflow-hidden">
                              <AnimatedAmount value={formatAmount(lastBill.details.message as number)} />
                            </span>
                          </div>
                        )}
                        {"storage" in lastBill.details && (
                          <div className="flex justify-between">
                            <span>Storage</span>
                            <span className="text-foreground font-medium overflow-hidden">
                              <AnimatedAmount value={formatAmount((lastBill.details.storage as number).toFixed(4))} />
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos aún</p>
              )}
            </div>
          )}

          {/* Last Refill Bill */}
          {lastRefillLoading ? <BillCardSkeleton /> : (
            <div className="rounded-xl border border-border bg-background shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Última recarga
                </p>
                {lastRefillBill && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${lastRefillBill.paid ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                    {lastRefillBill.paid ? "Pagada" : "Pendiente"}
                  </span>
                )}
              </div>

              {lastRefillBill ? (
                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold overflow-hidden">
                      <AnimatedAmount value={formatAmount(lastRefillBill.amount)} />
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(lastRefillBill.createdAt)}</span>
                  </div>

                  <Separator />

                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plan</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PLAN_COLOR[lastRefillBill.plan] ?? "bg-muted text-muted-foreground"}`}>
                        {lastRefillBill.plan}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Origen</span>
                      <span className="font-medium">{SOURCE_LABEL[lastRefillBill.source] ?? lastRefillBill.source}</span>
                    </div>
                  </div>

                  {lastRefillBill.details && (
                    <>
                      <Separator />
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground text-xs uppercase tracking-wide mb-1">Detalle</p>
                        {"messages" in lastRefillBill.details && (
                          <div className="flex justify-between">
                            <span>Mensajes recargados</span>
                            <span className="text-foreground font-medium tabular-nums">{(lastRefillBill.details as any).messages}</span>
                          </div>
                        )}
                        {"perMessage" in lastRefillBill.details && (
                          <div className="flex justify-between">
                            <span>Precio por mensaje</span>
                            <span className="text-foreground font-medium overflow-hidden">
                              <AnimatedAmount value={formatAmount((lastRefillBill.details as any).perMessage)} />
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos aún</p>
              )}
            </div>
          )}

        </div>

        <Separator />

        {/* Bills list */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Todas las facturas</p>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {billsLoading && Array.from({ length: BILLS_PAGE_SIZE }).map((_, i) => (
                  <TableRow key={i} className="h-12">
                    <TableCell><div className="h-3 w-24 rounded bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-20 rounded-full bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-20 rounded-full bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-3 w-32 rounded bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-3 w-16 rounded bg-muted animate-pulse ml-auto" /></TableCell>
                    <TableCell><div className="h-4 w-16 rounded-full bg-muted animate-pulse mx-auto" /></TableCell>
                  </TableRow>
                ))}

                {!billsLoading && (!bills || bills.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <p className="text-sm font-medium">Sin facturas</p>
                        <p className="text-xs text-muted-foreground mt-1">No hay facturas registradas aún.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!billsLoading && bills?.map((bill) => {
                  const detailText = (() => {
                    if (!bill.details) return '—'
                    const d = bill.details as any
                    if ('messages' in d && 'perMessage' in d)
                      return `${d.messages} msg × ${formatAmount(d.perMessage)}`
                    if ('baseBill' in d)
                      return `Base: ${formatAmount(d.baseBill)}`
                    return '—'
                  })()

                  return (
                    <TableRow key={bill.id}>
                      <TableCell className="text-sm tabular-nums">
                        {formatDate(bill.createdAt)}
                      </TableCell>

                      <TableCell>
                        <span className="text-sm">
                          {SOURCE_LABEL[bill.source] ?? bill.source}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PLAN_COLOR[bill.plan] ?? 'bg-muted text-muted-foreground'}`}>
                          {bill.plan}
                        </span>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {detailText}
                      </TableCell>

                      <TableCell className="text-right font-medium tabular-nums">
                        <AnimatedAmount value={formatAmount(bill.amount)} />
                      </TableCell>

                      <TableCell className="text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bill.paid ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                          {bill.paid ? 'Pagada' : 'Pendiente'}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>

              <TableFooter className="bg-muted/50">
                <TableRow>
                  <TableCell colSpan={3}>
                    <span className="text-xs text-muted-foreground">
                      Página {billsPage}
                    </span>
                  </TableCell>
                  <TableCell colSpan={3}>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={billsPage === 1}
                        onClick={() => setBillsPage(p => p - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!bills || bills.length < BILLS_PAGE_SIZE}
                        onClick={() => {
                          const last = bills?.[bills.length - 1]
                          if (!last) return
                          setBillsCursorStack(prev => {
                            const copy = [...prev]
                            copy[billsPage] = last.createdAt
                            return copy
                          })
                          setBillsPage(p => p + 1)
                        }}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
/* -------------------------------------------------------------------------- */
/*                              Traces Table                                  */
/* -------------------------------------------------------------------------- */

function TraceEventsSection() {
  const PAGE_SIZES = [5, 10, 20] as const;

  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(5);
  const [page, setPage] = useState(1);
  const [selectedTypes, setSelectedTypes] = useState<TraceType[] | null>(null);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [cursorStack, setCursorStack] = useState<(Date | null)[]>([null]);
  const cursor = cursorStack[page - 1] ?? null;

  // Reset pagination when filters change
  useEffect(() => {
    setCursorStack([null]);
    setPage(1);
  }, [selectedTypes, from, to, pageSize]);

  const cap = (s?: string) => (s ? s[0]?.toUpperCase() + s.slice(1) : "");

  const deepParse = (obj: any): any => {
    try {
      if (typeof obj === "string") return deepParse(JSON.parse(obj));
      if (Array.isArray(obj)) return obj.map(deepParse);
      if (obj && typeof obj === "object") return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deepParse(v)]));
    } catch {}
    return obj;
  };

  const TRACE: Record<
    TraceType,
    { label: string; color: string; meta?: (m: any) => React.ReactNode }
  > = {
    credential_added: {
      label: traces_type_credential_added(),
      color: "bg-emerald-500/10 text-emerald-600",
    },
    credential_removed: {
      label: traces_type_credential_removed(),
      color: "bg-rose-500/10 text-rose-600",
    },
    ingest_failed: {
      label: traces_type_ingest_failed(),
      color: "bg-orange-500/10 text-orange-600",
      meta: (m) => {
        const meta = deepParse(m);

        return (
          <div className="text-xs leading-tight">
            <div>
              <span className="opacity-60">
                {traces_meta_provider()}:
              </span>{" "}
              {cap(meta?.provider)}
            </div>

            <div className="truncate max-w-55">
              <span className="opacity-60">
                {traces_meta_file()}:
              </span>{" "}
              {meta?.name ?? "—"}
            </div>
          </div>
        );
      },
    },
    file_ingested: {
      label: 'file_ingested',
      color: "bg-violet-500/10 text-violet-600",
    },
    file_deleted: {
      label: 'file_deleted',
      color: "bg-zinc-500/10 text-zinc-600",
    },
    limit_warning: {
      label: "limit_warning",
      color: "bg-yellow-500/10 text-yellow-600",
    },
    user_deleted: {
      label: "user_deleted",
      color: "bg-red-500/10 text-red-600",
    },
  };

  const selectedType = selectedTypes?.[0];
  const selectedHelper = selectedType ? TRACE[selectedType] : undefined;

  const VISIBLE_TRACE_TYPES: TraceType[] = [
    "credential_added" as TraceType,
    "credential_removed" as TraceType,
    "ingest_failed" as TraceType,
  ];

  const eventsQueryParams = useMemo(
    () => ({ type: selectedTypes, from, to, cursor, limit: pageSize }),
    [selectedTypes, from, to, cursor, pageSize]
  );

  const countQueryParams = useMemo(
    () => ({ type: selectedTypes, from, to }),
    [selectedTypes, from, to]
  );

  const { data: events = [], isLoading } = useAdminTrace(eventsQueryParams);
  const { data: countRows } = useAdminTraceCount(countQueryParams);

  const totalCount = countRows?.[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const nextPage = () => {
    if (!events.length) return;

    const last = events[events.length - 1];
    if (!last?.createdAt) return;
    const oldest = new Date(last.createdAt);

    setCursorStack((prev) => {
      const copy = [...prev];
      copy[page] = oldest;
      return copy;
    });

    setPage((p) => p + 1);
  };

  const prevPage = () => {
    if (page === 1) return;
    setPage((p) => p - 1);
  };

  const UserMini = ({ user }: any) =>
    !user ? (
      <span className="opacity-50">{traces_user_system()}</span>
    ) : (
      <div className="flex items-center gap-2 min-w-0">
        {user.pfpUrl ? (
          <img src={user.pfpUrl} className="w-7 h-7 rounded-full object-cover shrink-0"/>
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white bg-muted shrink-0">
            {user.displayName?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}

        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {user.displayName}
          </div>
          <div className="text-xs opacity-60 truncate">{user.email}</div>
        </div>
      </div>
    );

  const resetFilters = () => {
    setSelectedTypes(null);
    setFrom(null);
    setTo(null);
  };

  const formatDateLabel = (d: Date | null, label: string) => d ? format(d, "PPP") : label;

  const selectedTypeLabel = useMemo(() => {
    const type = selectedTypes?.[0];
    if (!type) return traces_filter_type();
    const helper = TRACE[type];
    return helper?.label ?? traces_filter_type();
  }, [selectedTypes]);

  const SkeletonRows = () =>
    Array.from({ length: pageSize }).map((_, i) => (
      <TableRow key={i} className="h-12">
        <TableCell>
          <div className="h-3 w-28 rounded bg-muted animate-pulse" />
        </TableCell>

        <TableCell>
          <div className="h-4 w-24 rounded-full bg-muted animate-pulse" />
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
            <div className="space-y-1">
              <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-28 rounded bg-muted animate-pulse opacity-60" />
            </div>
          </div>
        </TableCell>

        <TableCell>
          <div className="space-y-1.5">
            <div className="h-2.5 w-36 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-24 rounded bg-muted animate-pulse opacity-60" />
          </div>
        </TableCell>
      </TableRow>
    ));

  const showEmpty = !isLoading && events.length === 0;

  return (
    <Card className="bg-sidebar">
      <CardContent className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{traces_title()}</h2>
          <p className="text-sm text-muted-foreground">
            {traces_description()}
          </p>
        </div>

        <Separator />

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                {selectedHelper ? (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${selectedHelper.color}`}>
                    {selectedTypeLabel}
                  </span>
                ) : (
                  traces_filter_type()
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56">
              <DropdownMenuItem onClick={() => setSelectedTypes(null)}>
                {traces_filter_all()}
              </DropdownMenuItem>

              {VISIBLE_TRACE_TYPES.map((type) => {
                const helper = TRACE[type];

                return (
                  <DropdownMenuItem
                  key={type}
                  className="flex items-center gap-2"
                  onClick={() => setSelectedTypes([type])}
                  >
                    <span className={`px-2 py-0.5 rounded-full text-xs ${helper.color}`}>
                      {helper.label}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {[
            {
              key: "from",
              label: traces_filter_from(),
              value: from,
              setter: setFrom,
            },
            {
              key: "to",
              label: traces_filter_to(),
              value: to,
              setter: setTo,
            },
          ].map((f) => (
            <Popover key={f.key}>
              <PopoverTrigger>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {formatDateLabel(f.value, f.label)}
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                mode="single"
                selected={f.value ?? undefined}
                onSelect={(d) => f.setter(d ?? null)}
                />
              </PopoverContent>
            </Popover>
          ))}

          <Button variant="destructive" size="sm" onClick={resetFilters}>
            {traces_filter_clear()}
          </Button>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{traces_table_date()}</TableHead>
                <TableHead>{traces_table_type()}</TableHead>
                <TableHead>{traces_table_user()}</TableHead>
                <TableHead>{traces_table_metadata()}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading && <SkeletonRows />}

              {showEmpty && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="text-sm font-medium">
                        {traces_empty_title()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {traces_empty_description()}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !showEmpty &&
                events.map((e) => {
                  const helper = TRACE[e.type];

                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        {format(new Date(e.createdAt), "PPP p")}
                      </TableCell>

                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${helper?.color}`}>
                          {helper?.label ?? e.type}
                        </span>
                      </TableCell>

                      <TableCell>
                        <UserMini user={e.user} />
                      </TableCell>

                      <TableCell>
                        {helper?.meta ? (
                          helper.meta(e.metadata)
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>

            <TableFooter className="bg-muted/50">
              <TableRow>
                <TableCell colSpan={2}>
                  {isLoading ? (
                    <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  ) : (
                    <>
                      {traces_page} {page} / {totalPages}
                    </>
                  )}
                </TableCell>

                <TableCell colSpan={2}>
                  <div className="flex justify-end gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button size="sm" variant="outline">
                          {traces_rows()}: {pageSize}
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent>
                        {PAGE_SIZES.map((s) => (
                          <DropdownMenuItem key={s} onClick={() => setPageSize(s)}>
                            {s}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={prevPage}
                    >
                      {traces_prev()}
                    </Button>

                    <Button
                    size="sm"
                    variant="outline"
                    disabled={events.length < pageSize}
                    onClick={nextPage}
                    >
                      {traces_next()}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                UsersSection                                 */
/* -------------------------------------------------------------------------- */

function UsersSection() {
	const { data: users = [], isLoading } = useUsers();
	const [inviteEmail, setInviteEmail] = useState('');
	const [editingUserId, setEditingUserId] = useState<string | null>(null);
	const [displayName, setDisplayName] = useState('');
	const [file, setFile] = useState<File | null>(null);
	const editUserFn = useEditUser();
	const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
	const deleteUserFn = useDeleteUser();
	const createUserFn = useCreateUser();
	const [inviteIsAdmin, setInviteIsAdmin] = useState(false);
	const [inviteSuccess, setInviteSuccess] = useState(false);
	const [showAdminWarning, setShowAdminWarning] = useState(false);
	const userToDelete = deleteUserId ? users.find((u) => u.id === deleteUserId) : null;
	const queryClient = useQueryClient();

	// Ordenar admins primero
	const sortedUsers = [...users].sort(
		(a, b) => (b.isAdmin ? 1 : 0) - (a.isAdmin ? 1 : 0),
	);

	// Invite User
	const inviteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const handleInviteUser = async () => {
		if (!inviteEmail) return;

		await createUserFn({
			email: inviteEmail,
      isAdmin: inviteIsAdmin,
			sendMail: true
		});

		setInviteEmail('');
		setInviteIsAdmin(false);

		setShowAdminWarning(false);
		setInviteSuccess(true);

		if (inviteTimeoutRef.current) clearTimeout(inviteTimeoutRef.current);

		inviteTimeoutRef.current = setTimeout(() => {
			setInviteSuccess(false);
		}, 10_000);
	};

	// Delete User
	async function handleDeleteUserWithToast(userId: string) {
		setDeleteUserId(null);

		const toastId = infoToast.loading({
			title: admin_users_delete_loading_title(),
			description: admin_users_delete_loading_description(),
		});

		try {
			await deleteUserFn(userId);

			infoToast.success(toastId, {
				title: admin_users_delete_success_title(),
				description: admin_users_delete_success_description(),
			});

			await queryClient.invalidateQueries({
				queryKey: ['admin', 'users'],
			});
		} catch (_error) {
			infoToast.error(toastId, {
				title: admin_users_delete_error_title(),
				description: admin_users_delete_error_description(),
			});

			await queryClient.invalidateQueries({
				queryKey: ['admin', 'users'],
			});
		}
	}

	return (
		<Card className="bg-sidebar">
			<CardContent className="p-6 space-y-6">
				{/* Header */}
				<div>
					<h2 className="text-lg font-semibold">{admin_users_title()}</h2>
					<p className="text-sm text-muted-foreground">
						{admin_users_description()}
					</p>
				</div>

				<Separator />

				{/* Invite user */}
				<div className="space-y-2">
					<p className="text-sm font-medium">{admin_users_invite_title()}</p>
					<div className="flex items-center gap-2">
						<input
							type="email"
							placeholder={admin_users_invite_placeholder()}
							value={inviteEmail}
							onChange={(e) => setInviteEmail(e.target.value)}
							className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm
							focus:outline-none focus:ring-2 focus:ring-ring"
						/>
						<div className="flex items-center gap-2">
							<Checkbox
								id="invite-admin"
								className="cursor-pointer"
								checked={inviteIsAdmin}
								onCheckedChange={(v) => {
									const checked = !!v;
									setInviteIsAdmin(checked);
									setShowAdminWarning(checked);
									setInviteSuccess(false);
								}}
							/>

							<Label
								htmlFor="invite-admin"
								className="text-xs font-medium cursor-pointer select-none"
							>
								Admin
							</Label>
						</div>

						<AsyncConfirmButton onClick={handleInviteUser}>
							{admin_users_invite_send()}
						</AsyncConfirmButton>
					</div>
					<p className="text-xs text-muted-foreground">
						{admin_users_invite_helper()}
					</p>

					<AnimatePresence mode="wait">
						{showAdminWarning && !inviteSuccess && (
							<motion.div
								key="admin-warning"
								initial={{ opacity: 0, y: -4, height: 0 }}
								animate={{ opacity: 1, y: 0, height: 'auto' }}
								exit={{ opacity: 0, y: -4, height: 0 }}
								transition={{ duration: 0.2, ease: 'easeOut' }}
								className="overflow-hidden"
							>
								<div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
									<AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
									<p className="text-xs text-amber-600 leading-snug">
										{admin_users_invite_adminWarning()}
									</p>
								</div>
							</motion.div>
						)}

						{inviteSuccess && (
							<motion.div
								key="invite-success"
								initial={{ opacity: 0, y: -4, height: 0 }}
								animate={{ opacity: 1, y: 0, height: 'auto' }}
								exit={{ opacity: 0, y: -4, height: 0 }}
								transition={{ duration: 0.2, ease: 'easeOut' }}
								className="overflow-hidden"
							>
								<div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2">
									<CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
									<p className="text-xs text-emerald-700 leading-snug">
										{admin_users_invite_success()}
									</p>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				{/* Users list */}
				<div className="space-y-2">
					{isLoading ? (
						<p className="text-sm text-muted-foreground">{common_loading()}</p>
					) : (
						sortedUsers.map((user) => {
							const meForUserSection = {
								id: user.id,
								email: user.email,
								displayName: user.displayName,
								pfpUrl: user.pfpUrl ?? null,
								isAdmin: user.isAdmin,
								hasApiKey: !!user.hasApiKey,
								devices: [],
                messageCount: 0,
								language: 'es' as Language
							};

							return (
								<div key={user.id}>
									<div className="flex flex-col border border-border rounded-xl px-2 py-1 hover:bg-muted/40 transition-colors">
										<div className="flex items-center justify-between gap-2">
											<div className="flex-1">
												<UserSection
													me={meForUserSection}
													collapsed={false}
													loading={false}
													disableHoverScale
													disableClick
												/>
											</div>

											<div className="flex gap-2">
												<TooltipUi>
													<TooltipTrigger>
														<Button
															size="icon"
															variant="ghost"
															className="cursor-pointer"
															onClick={() => {
																setEditingUserId((current) => {
																	const isSameUser = current === user.id;

																	if (isSameUser) {
																		setDisplayName('');
																		setFile(null);
																		return null;
																	}

																	setDisplayName(user.displayName ?? '');
																	setFile(null);
																	return user.id;
																});
															}}
														>
															<Pencil className="h-4 w-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														{admin_users_actions_edit()}
													</TooltipContent>
												</TooltipUi>

												<TooltipUi>
													<TooltipTrigger>
														<Button
															size="icon"
															variant="ghost"
															className="cursor-pointer text-destructive"
															onClick={() => setDeleteUserId(user.id)}
														>
															<Trash className="h-4 w-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														{admin_users_actions_remove()}
													</TooltipContent>
												</TooltipUi>
											</div>
										</div>

										<AnimatePresence>
											{editingUserId === user.id && (
												<motion.div
													initial={{ opacity: 0, height: 0 }}
													animate={{ opacity: 1, height: 'auto' }}
													exit={{ opacity: 0, height: 0 }}
													transition={{ duration: 0.25 }}
													className="overflow-hidden mt-2"
												>
													<Separator className="my-2" />

													<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 py-2 px-2">
														<div className="flex flex-col md:flex-row md:items-start gap-4 flex-1">
															<div className="flex flex-col gap-1">
																<label className="text-sm font-medium">
																	{admin_users_actions_display_name()}
																</label>
																<Input
																	className="w-full md:w-56 h-8 text-sm"
																	value={displayName}
																	onChange={(e) =>
																		setDisplayName(e.target.value)
																	}
																/>
															</div>

															<div className="flex flex-col gap-1">
																<label className="text-sm font-medium">
																	{admin_users_actions_img()}
																</label>
																<div className="flex items-center gap-2">
																	<Input
																		type="file"
																		accept="image/*"
																		className="w-48 h-8 text-sm"
																		onChange={(e) =>
																			setFile(e.target.files?.[0] ?? null)
																		}
																	/>
																</div>
															</div>
															{file && (
																<div className="flex items-center justify-center">
																	<div className="h-8">
																		<FilePreview
																			file={file}
																			onRemove={() => setFile(null)}
																		/>
																	</div>
																</div>
															)}
														</div>

														<div className="flex items-center justify-end gap-2 pt-3 shrink-0">
															<Button
																variant="ghost"
																className="h-8 px-3 text-sm"
																onClick={() => {
																	setEditingUserId(null);
																	setDisplayName(user.displayName ?? '');
																	setFile(null);
																}}
															>
																{common_cancel()}
															</Button>

															<AsyncConfirmButton
																className="h-8 px-3 text-sm"
																onClick={async () => {
																	await editUserFn(user.id, {
																		displayName,
																		pfp: file ?? undefined,
																	});
																	setEditingUserId(null);
																	setFile(null);
																}}
															>
																{common_save_changes()}
															</AsyncConfirmButton>
														</div>
													</div>
												</motion.div>
											)}
										</AnimatePresence>
									</div>
								</div>
							);
						})
					)}
				</div>

				{userToDelete && (
					<ConfirmDeleteAccountModal
						open={!!deleteUserId}
						email={userToDelete.email}
						onOpenChange={(open) => {
							if (!open) setDeleteUserId(null);
						}}
						onConfirm={() => {
							handleDeleteUserWithToast(userToDelete.id);
						}}
					/>
				)}
			</CardContent>
		</Card>
	);
}

function ConfirmDeleteAccountModal({
	open,
	onOpenChange,
	onConfirm,
	email,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	onConfirm: () => void;
	email: string;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<span className="flex h-8 w-8 items-center justify-center rounded-full">
							<AlertTriangle className="h-4 w-4 text-destructive" />
						</span>
						{admin_users_dialogs_delete_title()}
					</DialogTitle>
					<DialogDescription className="pt-1">
						{admin_users_dialogs_delete_description({
							email: email,
						})}
					</DialogDescription>
				</DialogHeader>

				<DialogFooter className="flex justify-end gap-2">
					<Button
						variant="outline"
						className="cursor-pointer"
						onClick={() => onOpenChange(false)}
					>
						{common_cancel()}
					</Button>

					<Button
						variant="destructive"
						className="cursor-pointer"
						onClick={onConfirm}
					>
						{common_confirm()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
