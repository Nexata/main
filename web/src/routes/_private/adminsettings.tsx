import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CreditCard, Settings, TrendingUp } from 'lucide-react';
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
} from '@/paraglide/messages.js';

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
	const used = 81;
	const total = 500;
	const navigate = useNavigate();

	return (
		<Card className="bg-[var(--sidebar)]">
			<CardContent className="p-6 space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold">
							{admin_company_overview_title()}
						</h2>
						<p className="text-sm text-muted-foreground">
							{admin_company_overview_description()}
						</p>
					</div>

					{/* Company logo */}
					<img
						src="/company_logo.png"
						alt="Company logo"
						className="h-8 w-auto opacity-80"
					/>
				</div>

				<Separator />

				{/* Message balance */}
				<div>
					<div className="flex justify-between text-sm mb-2">
						<span>{admin_company_overview_message_balance()}</span>
						<span className="font-medium text-primary">
							{' '}
							{used} / {total}
						</span>
					</div>

					<div className="h-3.5 rounded-full bg-muted/60 overflow-hidden">
						<motion.div
							initial={{ width: 0 }}
							animate={{ width: `${(used / total) * 100}%` }}
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
	const [inviteEmail, setInviteEmail] = useState('');
	const [_inviteSent, _setInviteSent] = useState(false);
	const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
	const [userToDelete, setUserToDelete] = useState<{
		id: string;
		email: string;
	} | null>(null);

	const users = [
		{
			id: '1',
			email: 'juan@empresa.com',
			messages: 320,
			createdAt: '2024-01-12',
			storageMb: 48,
		},
		{
			id: '2',
			email: 'maria@empresa.com',
			messages: 110,
			createdAt: '2024-03-04',
			storageMb: 22,
		},
	];

	return (
		<>
			<Card className="bg-[var(--sidebar)]">
				<CardContent className="p-6 space-y-6">
					{/* Header */}
					<div>
						<h2 className="text-lg font-semibold">
							{m['admin.users.title']()}
						</h2>
						<p className="text-sm text-muted-foreground">
							{m['admin.users.description']()}
						</p>
					</div>

					<Separator />

					{/* Invite user */}
					<div className="space-y-2">
						<p className="text-sm font-medium">
							{m['admin.users.invite.title']()}
						</p>

						<div className="flex items-center gap-2">
							<input
								type="email"
								placeholder={m['admin.users.invite.placeholder']()}
								value={inviteEmail}
								onChange={(e) => setInviteEmail(e.target.value)}
								className="
                  flex-1
                  h-9
                  rounded-md
                  border
                  border-border
                  bg-background
                  px-3
                  text-sm
                  focus:outline-none
                  focus:ring-2
                  focus:ring-ring
                "
							/>

							<AsyncConfirmButton
								onClick={async () => {
									return;
								}}
							>
								{m['admin.users.invite.send']()}
							</AsyncConfirmButton>
						</div>

						<p className="text-xs text-muted-foreground">
							{m['admin.users.invite.helper']()}
						</p>
					</div>

					<Separator />

					{/* Users list */}
					<div className="space-y-2">
						{users.map((user) => {
							const expanded = expandedUserId === user.id;

							return (
								<div key={user.id} className="rounded-xl border border-border">
									{/* Row */}
									<div
										className="
                        flex
                        items-center
                        justify-between
                        px-4
                        py-3
                        hover:bg-muted/40
                        transition-colors
                    "
									>
										<span className="flex-1 font-medium">{user.email}</span>

										<div className="flex items-center gap-3">
											<button
												onClick={() =>
													setExpandedUserId(expanded ? null : user.id)
												}
												className="
													text-xs
													text-muted-foreground
													hover:text-foreground
													transition-colors
													cursor-pointer
												"
											>
												{expanded
													? m['common.collapse']()
													: m['common.expand']()}
											</button>

											<Button
												size="sm"
												variant="outline"
												className="cursor-pointer text-destructive hover:bg-destructive/10"
												onClick={() =>
													setUserToDelete({
														id: user.id,
														email: user.email,
													})
												}
											>
												{m['admin.users.actions.remove']()}
											</Button>
										</div>
									</div>

									{/* Expanded details */}
									<AnimatePresence>
										{expanded && (
											<motion.div
												initial={{ opacity: 0, height: 0 }}
												animate={{ opacity: 1, height: 'auto' }}
												exit={{ opacity: 0, height: 0 }}
												transition={{ duration: 0.2 }}
												className="px-4 pb-4 overflow-hidden"
											>
												<div className="divide-y divide-border text-sm">
													<DetailItem
														label={m['admin.users.details.messages']()}
														value={`${user.messages}`}
													/>
													<DetailItem
														label={m['admin.users.details.created_at']()}
														value={user.createdAt}
													/>
													<DetailItem
														label={m['admin.users.details.storage']()}
														value={`${user.storageMb} MB`}
													/>
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* Delete user dialog */}
			<Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>{m['admin.users.dialogs.delete.title']()}</DialogTitle>
						<DialogDescription>
							{m['admin.users.dialogs.delete.description']({
								email: userToDelete?.email ?? '',
							})}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2">
						<Button variant="outline" onClick={() => setUserToDelete(null)}>
							{m['common.cancel']()}
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								setUserToDelete(null);
							}}
						>
							{m['common.delete']()}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function DetailItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between py-2">
			<span className="text-xs text-muted-foreground">{label}</span>
			<span className="font-medium text-foreground">{value}</span>
		</div>
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
