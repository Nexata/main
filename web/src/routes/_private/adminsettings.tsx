import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Tooltip as TooltipUi, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, CreditCard, Pencil, Settings, Trash, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import * as m from '@/paraglide/messages.js';
import {
	'admin.company_overview.billing' as admin_company_overview_billing,
	'admin.company_overview.buy_messages' as admin_company_overview_buy_messages,
	'admin.company_overview.current_plan' as admin_company_overview_current_plan,
	'admin.company_overview.description' as admin_company_overview_description,
	'admin.company_overview.message_balance' as admin_company_overview_message_balance,
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
	'admin.users.title' as admin_users_title,
	'admin.users.description' as admin_users_description,
	'admin.users.invite.title' as admin_users_invite_title,
	'admin.users.invite.helper' as admin_users_invite_helper,
	'admin.users.invite.send' as admin_users_invite_send,
	'admin.users.invite.placeholder' as admin_users_invite_placeholder
} from '@/paraglide/messages.js';
import { useMyTenant } from '@/lib/user';
import { TenantLogo } from '@/components/tenant-logo/tenant-logo';
import { useBillingMessages, useEditUser, useUsers } from '@/lib/admin';
import UserSection from '@/components/user-section/user-section';
import { FilePreview } from '@/components/ui/file-preview';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/_private/adminsettings')({
	component: AdminSettingsPage,
});

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type DataSourceStatus = 'connected' | 'disconnected' | 'warning';

type DataSource = {
	id: string;
	name: string;
	status: DataSourceStatus;
};

type User = {
	id: string;
	email: string;
	realTime: boolean;
};

type ModalType = 'deleteUser' | 'toggleRealTime' | 'deleteAccount' | null;

type ModalState = {
	type: ModalType;
	user?: User;
	source?: DataSource;
};

/* -------------------------------------------------------------------------- */
/*                              Main Page                                     */
/* -------------------------------------------------------------------------- */

function AdminSettingsPage() {
	useEffect(() => {
		document.title = admin_meta_title();
	}, []);

	const navigate = useNavigate();
	const [modal, setModal] = useState<ModalState>({ type: null });

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
			<ConfirmDialog modal={modal} setModal={setModal} />
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


	return (
		<Card className="bg-[var(--sidebar)]">
			<CardContent className="p-6 space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold">{admin_company_overview_title()}</h2>
						<p className="text-sm text-muted-foreground">{admin_company_overview_description()}</p>
					</div>

					<TenantLogo
					loading={tenantLoading}
					logoUrl={myTenant?.logoUrl}
					displayName={myTenant?.displayName}
					/>
				</div>

				<Separator />

				<div>
					<div className="flex justify-between text-sm mb-2">
						<span>{admin_company_overview_message_balance()}</span>
						<span className="font-medium text-primary">
							{' '}
							{billingLoading ? '— / —' : `${used} / ${total}`}
						</span>
					</div>

					<div className="h-3.5 rounded-full bg-muted/60 overflow-hidden">
						<motion.div
							initial={{ width: 0 }}
							animate={{ width: `${total > 0 ? (used / total) * 100 : 0}%` }}
							transition={{ duration: 0.6, ease: 'easeOut' }}
							className="h-full rounded-full bg-primary"
						/>
					</div>
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
						{/* Billing */}
						<Button
							size="sm"
							onClick={() => navigate({ to: '/billing' })}
							className="cursor-pointer bg-emerald-500 hover:bg-emerald-600text-white"
						>
							<CreditCard className="h-4 w-4 mr-2" />
							{admin_company_overview_billing()}
						</Button>

						{/* Upgrade */}
						<Button
							size="sm"
							className="cursor-pointer bg-orange-500/90  hover:bg-orange-500  text-white"
						>
							<TrendingUp className="h-4 w-4 mr-2" />
							{admin_company_overview_upgrade_plan()}
						</Button>

						{/* Buy messages */}
						<Button size="sm" variant="outline" className="cursor-pointer">
							{admin_company_overview_buy_messages()}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
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
		<Card className="bg-[var(--sidebar)]">
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

	// Ordenar admins primero
	const sortedUsers = [...users].sort((a, b) => (b.isAdmin ? 1 : 0) - (a.isAdmin ? 1 : 0));

	return (
		<Card className="bg-[var(--sidebar)]">
			<CardContent className="p-6 space-y-6">
				{/* Header */}
				<div>
					<h2 className="text-lg font-semibold">{admin_users_title()}</h2>
					<p className="text-sm text-muted-foreground">{admin_users_description()}</p>
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
						<AsyncConfirmButton onClick={async () => { return; }}>{admin_users_invite_send()}</AsyncConfirmButton>
					</div>
					<p className="text-xs text-muted-foreground">{admin_users_invite_helper()}</p>
				</div>

				{/* Users list */}
				<div className="space-y-2">
					{isLoading ? (
						<p className="text-sm text-muted-foreground">Cargando usuarios...</p>
					) : (
						sortedUsers.map((user) => {
							const meForUserSection = {
								id: user.id,
								email: user.email,
								displayName: user.displayName,
								pfpUrl: user.pfpUrl ?? null,
								isAdmin: user.isAdmin,
								hasApiKey: !!user.apiKey,
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
															setEditingUserId(user.id);
															setDisplayName(user.displayName ?? '');
															setFile(null);
														}}
														>
															<Pencil className="h-4 w-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>Editar usuario</TooltipContent>
												</TooltipUi>

												<TooltipUi>
													<TooltipTrigger>
														<Button size="icon" variant="ghost" className="cursor-pointer text-destructive">
															<Trash className="h-4 w-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>Eliminar usuario</TooltipContent>
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
																<label className="text-sm font-medium">Nombre de usuario</label>
																<Input
																className="w-full md:w-56 h-8 text-sm"
																value={displayName}
																onChange={(e) => setDisplayName(e.target.value)}
																/>
															</div>

															<div className="flex flex-col gap-1">
																<label className="text-sm font-medium">Imagen de perfil</label>
																<div className="flex items-center gap-2">
																	<Input
																		type="file"
																		accept="image/*"
																		className="w-48 h-8 text-sm"
																		onChange={(e) => setFile(e.target.files?.[0] ?? null)}
																	/>
																</div>
															</div>
															{file && (
																<div className="flex items-center justify-center">
																	<div className="h-8">
																		<FilePreview file={file} onRemove={() => setFile(null)} />
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
																Cancelar
															</Button>

															<AsyncConfirmButton
															className="h-8 px-3 text-sm"
															onClick={async () => {
																await editUserFn(user.id, { displayName, pfp: file ?? undefined });
																setEditingUserId(null);
																setFile(null);
															}}
															>
																Guardar
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
			</CardContent>
		</Card>
	);
}


/* -------------------------------------------------------------------------- */
/*                               ConfirmDialog                                 */
/* -------------------------------------------------------------------------- */

function ConfirmDialog({
	modal,
	setModal,
}: {
	modal: ModalState;
	setModal: (m: ModalState) => void;
}) {
	return (
		<Dialog open={!!modal.type} onOpenChange={() => setModal({ type: null })}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{m['admin.dialogs.confirm_action.title']()}</DialogTitle>
					<DialogDescription>
						{m['admin.dialogs.confirm_action.description']()}
					</DialogDescription>
				</DialogHeader>

				<DialogFooter>
					<Button variant="outline" onClick={() => setModal({ type: null })}>
						{m['admin.dialogs.confirm_action.cancel']()}
					</Button>
					<Button onClick={() => setModal({ type: null })}>
						{m['admin.dialogs.confirm_action.confirm']()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
