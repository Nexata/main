import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	CreditCard,
	MessageSquarePlus,
	Pencil,
	Settings,
	Trash,
	TrendingUp,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
	Bar,
	BarChart,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { AsyncConfirmButton } from '@/components/async-confirm-button/async-confirm-button';
import { BuyMessagesModal } from '@/components/buy-messages/buy-messages-modal';
import { infoToast } from '@/components/info-toast/info-toast';
import { TenantLogo } from '@/components/tenant-logo/tenant-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { UpgradePlanModal } from "@/components/upgrade-plan/upgrade-plan";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilePreview } from '@/components/ui/file-preview';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
	TooltipContent,
	TooltipTrigger,
	Tooltip as TooltipUi,
} from '@/components/ui/tooltip';
import UserSection from '@/components/user-section/user-section';
import {
	useBillingMessages,
	useCreateUser,
	useDeleteUser,
	useEditTenant,
	useEditUser,
	useUsers,
} from '@/lib/admin';
import { useMyTenant } from '@/lib/user';
import {
	'admin.company_overview.billing' as admin_company_overview_billing,
	'admin.company_overview.buy_messages' as admin_company_overview_buy_messages,
	'admin.company_overview.current_plan' as admin_company_overview_current_plan,
	'admin.company_overview.description' as admin_company_overview_description,
	'admin.company_overview.edit' as admin_company_overview_edit,
  'admin.company_overview.message_balance' as admin_company_overview_message_balance,
  'admin.company_overview.storage_balance' as admin_company_overview_storage_balance,
  'admin.company_overview.embeddings_balance' as admin_company_overview_embeddings_balance,
	'admin.company_overview.tenant_logo' as admin_company_overview_tenant_logo,
	'admin.company_overview.tenant_name' as admin_company_overview_tenant_name,
	'admin.company_overview.title' as admin_company_overview_title,
	'admin.company_overview.upgrade_plan' as admin_company_overview_upgrade_plan,
	'admin.header.back_to_chat' as admin_header_back_to_chat,
	'admin.header.personal_panel' as admin_header_personal_panel,
	'admin.header.subtitle' as admin_header_subtitle,
	'admin.header.title' as admin_header_title,
	'admin.meta.title' as admin_meta_title,
	'admin.usage.chart_type.bars' as admin_usage_chart_type_bars,
	'admin.usage.chart_type.lines' as admin_usage_chart_type_lines,
	'admin.usage.description' as admin_usage_description,
	'admin.usage.title' as admin_usage_title,
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
} from '@/paraglide/messages.js';

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

	return (
		<motion.div
			initial={{ opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.25 }}
			className="flex flex-col gap-6 px-4 py-6 max-w-screen-2xl mx-auto"
		>
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
			<UsageChartSection />
			<UsersSection />
		</motion.div>
	);
}

/* -------------------------------------------------------------------------- */
/*                         CompanyOverviewSection                              */
/* -------------------------------------------------------------------------- */

function CompanyOverviewSection() {
	const navigate = useNavigate();
	const { data: myTenant, isLoading: tenantLoading } = useMyTenant();
	const { data: billingMessages, isLoading: billingLoading } = useBillingMessages();
	const used = billingMessages?.count ?? 0;
	const total = billingMessages?.limit ?? 0;
	const [editingTenant, setEditingTenant] = useState(false);
	const [tenantDisplayName, setTenantDisplayName] = useState('');
	const [tenantLogo, setTenantLogo] = useState<File | null>(null);
	const editTenantFn = useEditTenant();
  const [buyMessagesOpen, setBuyMessagesOpen] = useState(false);
  const [upgradePlanOpen, setUpgradePlanOpen] = useState(false);

  const mockEmbeddings = {
    count: 420_000,
    limit: 1_000_000,
  };

  const mockStorage = {
    count: 3_200,
    limit: 10_000,
  };


	useEffect(() => {
		if (myTenant) {
			setTenantDisplayName(myTenant.displayName ?? '');
			setTenantLogo(null);
		}
	}, [myTenant]);

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
            used={used}
            total={total}
            colorClass="bg-primary"
            loading={billingLoading}
          />

          <UsageBar
            label={admin_company_overview_embeddings_balance()}
            used={mockEmbeddings.count}
            total={mockEmbeddings.limit}
            colorClass="bg-indigo-500"
            loading={false}
          />

          <UsageBar
            label={admin_company_overview_storage_balance()}
            used={mockStorage.count}
            total={mockStorage.limit}
            colorClass="bg-emerald-500"
            loading={false}
          />
        </div>


				{/* Plan + actions */}
				<div className="flex items-center justify-between">
					<div className="flex items-center">
						<span className="text-sm text-muted-foreground">
							{admin_company_overview_current_plan()}
						</span>
						<span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
							Business 500
						</span>
					</div>

					<div className="flex gap-2">
						{/* Billing Comentado hasta que habilitemos Pay as You Go*/}
						{/*<Button
							size="sm"
							onClick={() => navigate({ to: '/billing' })}
							className="cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white"
						>
							<CreditCard className="h-4 w-4 mr-2" />
							{admin_company_overview_billing()}
						</Button>*/}

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
					</div>
				</div>

				<BuyMessagesModal
				open={buyMessagesOpen}
				onOpenChange={setBuyMessagesOpen}
        />

        <UpgradePlanModal
        open={upgradePlanOpen}
        onOpenChange={setUpgradePlanOpen}
        />
			</CardContent>
		</Card>
	);
}

function UsageBar({
  label,
  used,
  total,
  colorClass,
  loading = false,
}: {
  label: string;
  used: number;
  total: number;
  colorClass: string;
  loading?: boolean;
}) {
  const percentage = !loading && total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const textColorClass = colorClass.replace("bg-", "text-");

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex justify-between text-sm">
        <span>{label}</span>

        {loading ? (
          <div className="h-4 w-20 rounded bg-muted animate-pulse" />
        ) : (
          <span className={`font-medium ${textColorClass}`}>
            {used} / {total}
          </span>
        )}
      </div>

      {/* Bar */}
      <div className="h-3.5 rounded-full bg-muted/60 overflow-hidden">
        {loading ? (
          <div className="h-full w-full bg-muted animate-pulse" />
        ) : (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`h-full rounded-full ${colorClass}`}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             UsageChartSection                              */
/* -------------------------------------------------------------------------- */

function UsageChartSection() {
	const [type, setType] = useState<'bars' | 'lines'>('bars');

	const data = [
		{ name: 'Juan', mensajes: 120 },
		{ name: 'María', mensajes: 90 },
		{ name: 'Pedro', mensajes: 70 },
		{ name: 'Ana', mensajes: 150 },
	];

	function ChartTooltip({ active, payload, label }: any) {
		if (!active || !payload?.length) return null;

		return (
			<div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="text-sm font-medium text-foreground">
					{payload[0].value} mensajes
				</p>
			</div>
		);
	}

	function MetricItem({ label, value }: { label: string; value: string }) {
		return (
			<div className="space-y-1">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="text-lg font-semibold text-foreground">{value}</p>
			</div>
		);
	}

	return (
		<Card className="bg-sidebar">
			<CardContent className="p-6 space-y-4">
				<div>
					<h2 className="text-lg font-semibold">{admin_usage_title()}</h2>
					<div className="flex justify-between items-center">
						<p className="text-sm text-muted-foreground">
							{admin_usage_description()}
						</p>
						<DropdownMenu>
							<DropdownMenuTrigger>
								<Button variant="outline" size="sm" className="cursor-pointer">
									{type === 'bars'
										? admin_usage_chart_type_bars()
										: admin_usage_chart_type_lines()}
								</Button>
							</DropdownMenuTrigger>

							<DropdownMenuContent>
								<DropdownMenuItem onClick={() => setType('bars')}>
									{admin_usage_chart_type_bars()}
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setType('lines')}>
									{admin_usage_chart_type_lines()}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				<Separator />

				<div className="h-56 rounded-xl border border-border bg-muted/40 p-3">
					<ResponsiveContainer width="100%" height="100%">
						{type === 'bars' ? (
							<BarChart data={data}>
								<XAxis
									dataKey="name"
									stroke="var(--muted-foreground)"
									tickLine={false}
									axisLine={false}
								/>
								<YAxis
									stroke="var(--muted-foreground)"
									tickLine={false}
									axisLine={false}
								/>
								<Tooltip content={<ChartTooltip />} cursor={false} />
								<Bar
									dataKey="mensajes"
									fill="var(--primary)"
									radius={6}
									activeBar={{
										fill: 'var(--primary)',
										opacity: 1,
										stroke: 'var(--primary)',
										strokeWidth: 1,
									}}
								/>
							</BarChart>
						) : (
							<LineChart data={data}>
								<XAxis
									dataKey="name"
									stroke="var(--muted-foreground)"
									tickLine={false}
									axisLine={false}
								/>
								<YAxis
									stroke="var(--muted-foreground)"
									tickLine={false}
									axisLine={false}
								/>
								<Tooltip content={<ChartTooltip />} cursor={false} />
								<Line
									type="monotone"
									dataKey="mensajes"
									stroke="var(--primary)"
									strokeWidth={3}
									dot={{ r: 4, fill: 'var(--primary)', opacity: 0.6 }}
									activeDot={{
										r: 6,
										fill: 'var(--primary)',
										stroke: 'var(--background)',
										strokeWidth: 2,
									}}
								/>
							</LineChart>
						)}
					</ResponsiveContainer>
				</div>
				{/* Extra info */}
				<div className="grid grid-cols-1 sm:grid-cols-4 gap-4 place-items-center rounded-xl border border-border bg-muted/30 p-4">
					<MetricItem label="Total de mensajes" value="430" />

					<MetricItem label="Usuario más activo" value="Ana" />

					<MetricItem label="Pico máximo" value="150" />

					<MetricItem label="Hora mas activa" value="10AM - 11AM" />
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
	const userToDelete = deleteUserId
		? users.find((u) => u.id === deleteUserId)
		: null;
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
