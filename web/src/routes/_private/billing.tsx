import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarIcon, SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
	Bar,
	BarChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import * as m from '@/paraglide/messages.js';

// Route definition
export const Route = createFileRoute('/_private/billing')({
	component: BillingPage,
});

function BillingPage() {
	// Window title
	useEffect(() => {
		document.title = m['billing.meta.title']();
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
						{m['billing.header.title']()}
					</h1>
					<p className="text-sm text-muted-foreground">
						{m['billing.header.subtitle']()}
					</p>
				</div>

				<div className="flex gap-2">
					<Button
						variant="destructive"
						onClick={() => navigate({ to: '/adminsettings' })}
						className="gap-2 cursor-pointer"
					>
						<SettingsIcon className="h-4 w-4" />
						{m['billing.header.admin_settings']()}
					</Button>
					<Button
						variant="outline"
						onClick={() => navigate({ to: '/chat' })}
						className="cursor-pointer"
					>
						<ArrowLeft className="h-4 w-4 mr-2" />
						{m['billing.header.back']()}
					</Button>
				</div>
			</header>

			<div className="h-px bg-border" />

			<BillingOverviewSection />
			<BillingMonthlySection />
			<BillingAlertsSection />
		</motion.div>
	);
}

/* -------------------------------------------------------------------------- */
/*                         BillingOverviewSection                             */
/* -------------------------------------------------------------------------- */

function BillingOverviewSection() {
	return (
		<Card className="bg-[var(--sidebar)]">
			<CardContent className="p-6">
				<div className="flex items-center justify-between gap-6">
					{/* Left — title */}
					<div>
						<h2 className="text-lg font-semibold">
							{m['billing.overview.title']()}
						</h2>
						<p className="text-sm text-muted-foreground">
							{m['billing.overview.description']()}
						</p>
					</div>

					{/* Current spend */}
					<div className="flex items-center justify-between gap-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 min-w-[220px]">
						<p className="text-sm text-muted-foreground">
							{m['billing.overview.current_spend']()}
						</p>
						<p className="text-2xl font-semibold text-emerald-600">$42.80</p>
					</div>

					{/* Center — plan + spend */}
					<div className="flex items-center gap-6">
						{/* Plan */}
						<div className="flex items-center">
							<span className="text-sm text-muted-foreground">
								{m['billing.overview.plan']()}
							</span>
							<span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-base font-medium text-primary">
								Business 500
							</span>
						</div>
						{/* Right — logo */}
						<img
							src="/company_logo.png"
							alt="Company logo"
							className="h-8 w-auto opacity-80 shrink-0"
						/>
					</div>
				</div>

				<Separator className="my-4" />

				<BillingEventsSection />
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */
/*                           BillingInvoicesSection                           */
/* -------------------------------------------------------------------------- */

function BillingEventsSection() {
	const events = [
		{
			date: '2024-10-12',
			type: 'Storage',
			user: 'juan@empresa.com',
			units: '12 GB',
			price: '$6.00',
		},
		{
			date: '2024-10-15',
			type: 'Embedding',
			user: 'system',
			units: '3k vectors',
			price: '$4.20',
		},
		{
			date: '2024-10-15',
			type: 'Embedding',
			user: 'system',
			units: '3k vectors',
			price: '$4.20',
		},
		{
			date: '2024-10-15',
			type: 'Embedding',
			user: 'system',
			units: '3k vectors',
			price: '$4.20',
		},
		{
			date: '2024-10-15',
			type: 'Embedding',
			user: 'system',
			units: '3k vectors',
			price: '$4.20',
		},
		{
			date: '2024-10-15',
			type: 'Embedding',
			user: 'system',
			units: '3k vectors',
			price: '$4.20',
		},
	];

	const PAGE_SIZES = [5, 10, 20] as const;
	const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(5);

	const [page, setPage] = useState(1);
	const [type, setType] = useState<'all' | 'storage' | 'embedding'>('all');
	const [date, setDate] = useState<Date | undefined>();

	const filteredEvents = events.filter((e) => {
		if (type === 'all') return true;
		return e.type.toLowerCase() === type;
	});

	const totalPages = Math.ceil(filteredEvents.length / pageSize);

	const paginatedEvents = filteredEvents.slice(
		(page - 1) * pageSize,
		page * pageSize,
	);

	useEffect(() => {
		setPage(1);
	}, []);

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h3 className="text-base font-semibold">
					{m['billing.events.title']()}
				</h3>

				<div className="flex gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger>
							<Button variant="outline" size="sm" className="cursor-pointer">
								{type === 'all'
									? m['billing.events.filters.all']()
									: type === 'storage'
										? m['billing.events.filters.storage']()
										: m['billing.events.filters.embedding']()}
							</Button>
						</DropdownMenuTrigger>

						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => setType('all')}>
								{m['billing.events.filters.all']()}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setType('storage')}>
								{m['billing.events.filters.storage']()}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setType('embedding')}>
								{m['billing.events.filters.embedding']()}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<Popover>
						<PopoverTrigger>
							<Button
								variant="outline"
								size="sm"
								className="justify-start text-left font-normal cursor-pointer"
							>
								<CalendarIcon className="mr-2 h-4 w-4" />
								{date
									? format(date, 'PPP')
									: m['billing.events.filters.date']()}
							</Button>
						</PopoverTrigger>

						<PopoverContent className="w-auto p-0" align="end">
							<Calendar
								mode="single"
								selected={date}
								onSelect={setDate}
								autoFocus
							/>
						</PopoverContent>
					</Popover>
				</div>
			</div>

			{/* Table */}
			<div className="rounded-lg border overflow-hidden">
				<Table>
					<TableHeader className="bg-muted/50">
						<TableRow>
							<TableHead>{m['billing.events.table.date']()}</TableHead>
							<TableHead>{m['billing.events.table.type']()}</TableHead>
							<TableHead>{m['billing.events.table.user']()}</TableHead>
							<TableHead>{m['billing.events.table.units']()}</TableHead>
							<TableHead className="text-right">
								{m['billing.events.table.price']()}
							</TableHead>
						</TableRow>
					</TableHeader>

					<TableBody>
						{filteredEvents.length === 0 && (
							<TableRow>
								<TableCell
									colSpan={5}
									className="h-28 text-center text-sm text-muted-foreground"
								>
									{m['billing.events.empty']()}
								</TableCell>
							</TableRow>
						)}
						{paginatedEvents.map((e, i) => (
							<TableRow key={i} className="hover:bg-muted/30 transition-colors">
								<TableCell>{e.date}</TableCell>
								<TableCell>
									<span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
										{e.type}
									</span>
								</TableCell>
								<TableCell className="text-muted-foreground">
									{e.user}
								</TableCell>
								<TableCell>{e.units}</TableCell>
								<TableCell className="text-right font-medium">
									{e.price}
								</TableCell>
							</TableRow>
						))}
					</TableBody>

					<TableFooter className="bg-muted/50">
						<TableRow>
							<TableCell colSpan={3} className="text-sm text-muted-foreground">
								{m['billing.events.pagination.page']({
									page,
									total: totalPages || 1,
								})}
							</TableCell>
							<TableCell colSpan={2}>
								<div className="flex justify-end items-center gap-4">
									<div className="flex items-center gap-2">
										<span className="text-sm text-muted-foreground">
											{m['billing.events.pagination.rows']()}
										</span>
										<DropdownMenu>
											<DropdownMenuTrigger>
												<Button variant="outline" size="sm">
													{pageSize}
												</Button>
											</DropdownMenuTrigger>

											<DropdownMenuContent align="end">
												{PAGE_SIZES.map((size) => (
													<DropdownMenuItem
														key={size}
														onClick={() => setPageSize(size)}
													>
														{size}
													</DropdownMenuItem>
												))}
											</DropdownMenuContent>
										</DropdownMenu>
									</div>

									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											disabled={page === 1}
											onClick={() => setPage((p) => Math.max(1, p - 1))}
										>
											{m['billing.events.pagination.previous']()}
										</Button>

										<Button
											variant="outline"
											size="sm"
											disabled={page === totalPages || totalPages === 0}
											onClick={() =>
												setPage((p) => Math.min(totalPages, p + 1))
											}
										>
											{m['billing.events.pagination.next']()}
										</Button>
									</div>
								</div>
							</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			</div>
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*                            BillingMonthlySection                           */
/* -------------------------------------------------------------------------- */

function BillingMonthlySection() {
	const data = [
		{ month: 'Jan', value: 42 },
		{ month: 'Feb', value: 38 },
		{ month: 'Mar', value: 55 },
		{ month: 'Apr', value: 61 },
		{ month: 'May', value: 48 },
		{ month: 'Jun', value: 72 },
		{ month: 'Jul', value: 66 },
		{ month: 'Aug', value: 59 },
		{ month: 'Sep', value: 63 },
		{ month: 'Oct', value: 70 },
		{ month: 'Nov', value: 74 },
		{ month: 'Dec', value: 81 },
	];

	const [year, setYear] = useState(new Date().getFullYear());
	const [month, setMonth] = useState<number | null>(null);

	const MONTH_KEYS = [
		'months.january',
		'months.february',
		'months.march',
		'months.april',
		'months.may',
		'months.june',
		'months.july',
		'months.august',
		'months.september',
		'months.october',
		'months.november',
		'months.december',
	] as const;

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth();
	const total = data.reduce((acc, d) => acc + d.value, 0);
	const maxMonth = data.reduce((a, b) => (a.value > b.value ? a : b));
	useEffect(() => {
		if (
			month !== null &&
			(year > currentYear || (year === currentYear && month >= currentMonth))
		) {
			setMonth(null);
		}
	}, [year, month, currentYear, currentMonth]);

	function ChartTooltip({ active, payload, label }: any) {
		if (!active || !payload?.length) return null;

		return (
			<div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="text-sm font-medium text-foreground">
					${payload[0].value} USD
				</p>
			</div>
		);
	}

	function MetricItem({ label, value }: { label: string; value: string }) {
		return (
			<div className="space-y-1 text-center">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="text-lg font-semibold text-foreground">{value}</p>
			</div>
		);
	}

	return (
		<Card className="bg-[var(--sidebar)]">
			<CardContent className="p-6 space-y-4">
				{/* Header */}
				<div>
					<h2 className="text-lg font-semibold">
						{m['billing.monthly.title']()}
					</h2>
					<p className="text-sm text-muted-foreground">
						{m['billing.monthly.description']()}
					</p>
				</div>

				<Separator />

				<div className="grid gap-6 md:grid-cols-[1fr_280px]">
					{/* Chart */}
					<div className="space-y-4">
						<div className="h-56 rounded-xl border border-border bg-muted/40 p-3">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={data}>
									<XAxis
										dataKey="month"
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
										dataKey="value"
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
							</ResponsiveContainer>
						</div>

						{/* Metrics */}
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-border bg-muted/30 p-4">
							<MetricItem
								label={m['billing.monthly.metrics.total_year']()}
								value={`$${total} USD`}
							/>
							<MetricItem
								label={m['billing.monthly.metrics.top_month']()}
								value={maxMonth.month}
							/>
							<MetricItem
								label={m['billing.monthly.metrics.max_value']()}
								value={`$${maxMonth.value} USD`}
							/>
						</div>
					</div>

					{/* Invoices */}
					<div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4">
						{/* Header */}
						<div className="space-y-1">
							<p className="text-sm font-medium">
								{m['billing.invoices.title']()}
							</p>
							<p className="text-xs text-muted-foreground">
								{m['billing.invoices.description']()}
							</p>
						</div>

						<Separator />

						{/* Month / Year picker */}
						<div className="space-y-3">
							{/* Year selector */}
							<div className="flex items-center justify-between">
								<Button
									className="cursor-pointer"
									variant="ghost"
									size="icon"
									onClick={() => setYear((y) => y - 1)}
								>
									‹
								</Button>

								<span className="text-sm font-medium">{year}</span>

								<Button
									className="cursor-pointer"
									variant="ghost"
									size="icon"
									disabled={year >= currentYear}
									onClick={() => setYear((y) => Math.min(y + 1, currentYear))}
								>
									›
								</Button>
							</div>

							<div className="grid grid-cols-3 gap-2">
								{MONTH_KEYS.map((key, idx) => {
									const isActive = idx === month;

									const isDisabled =
										year > currentYear ||
										(year === currentYear && idx >= currentMonth);

									return (
										<Button
											key={key}
											size="sm"
											variant={isActive ? 'default' : 'outline'}
											className="text-xs cursor-pointer"
											disabled={isDisabled}
											onClick={() => setMonth(idx)}
										>
											{m[key]().slice(0, 3)}
										</Button>
									);
								})}
							</div>
						</div>

						<Button
							size="sm"
							variant="outline"
							className="mt-auto cursor-pointer"
							disabled={month === null}
						>
							{m['billing.invoices.download']()}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */
/*                            BillingAlertsSection                            */
/* -------------------------------------------------------------------------- */

function BillingAlertsSection() {
	const [amount, setAmount] = useState('');
	const ALERT_TYPES = ['proximity', 'threshold'] as const;
	type AlertType = (typeof ALERT_TYPES)[number];
	const [type, setType] = useState<AlertType>('proximity');

	type Alert = {
		id: number;
		type: AlertType;
		amount: number;
	};

	const alerts: Alert[] = [
		{ id: 1, type: 'proximity', amount: 900 },
		{ id: 2, type: 'threshold', amount: 1200 },
	];

	return (
		<Card className="bg-[var(--sidebar)]">
			<CardContent className="p-6 space-y-4">
				{/* Header */}
				<div>
					<h2 className="text-lg font-semibold">
						{m['billing.alerts.title']()}
					</h2>
					<p className="text-sm text-muted-foreground">
						{m['billing.alerts.description']()}{' '}
						<strong className="text-destructive">
							{m['billing.alerts.helper']()}
						</strong>
					</p>
				</div>

				<Separator />

				{/* One-liner */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
					{/* Amount */}
					<div className="flex flex-col gap-2 flex-1">
						<label className="text-xs text-muted-foreground">
							{m['billing.alerts.amount']()}
						</label>

						<div className="flex items-center gap-2">
							<span className="text-sm text-muted-foreground">$</span>
							<input
								type="number"
								min={0}
								placeholder="0.00"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm
                           [appearance:textfield]
                           [&::-webkit-outer-spin-button]:appearance-none
                           [&::-webkit-inner-spin-button]:appearance-none
                           focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
					</div>

					{/* Type */}
					<div className="flex flex-col gap-2 sm:w-[240px]">
						<label className="text-xs text-muted-foreground">
							{m['billing.alerts.type']()}
						</label>

						<DropdownMenu>
							<DropdownMenuTrigger>
								<Button
									variant="outline"
									size="sm"
									className="h-9 w-full justify-between"
								>
									{m[`billing.alerts.types.${type}.label`]()}
								</Button>
							</DropdownMenuTrigger>

							<DropdownMenuContent align="end" className="w-64">
								{ALERT_TYPES.map((t) => (
									<DropdownMenuItem
										key={t}
										onClick={() => setType(t)}
										className="
                      flex flex-col items-start gap-1
                      cursor-pointer
                      data-[highlighted]:bg-muted
                      data-[highlighted]:text-foreground
                    "
									>
										<span className="text-sm font-medium">
											{m[`billing.alerts.types.${t}.label`]()}
										</span>
										<span className="text-xs text-muted-foreground">
											{m[`billing.alerts.types.${t}.description`]()}
										</span>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{/* Action */}
					<div className="sm:ml-4 mt-[22px]">
						<Button
							size="sm"
							variant="outline"
							className="h-9"
							disabled={!amount}
						>
							{m['billing.alerts.save']()}
						</Button>
					</div>
				</div>

				<Separator />

				{/* Alerts list */}
				<div className="space-y-2">
					<p className="text-sm font-medium">
						{m['billing.alerts.configured']()}
					</p>

					{alerts.length === 0 ? (
						<p className="text-xs text-muted-foreground">
							{m['billing.alerts.empty']?.() ?? 'No hay alertas configuradas'}
						</p>
					) : (
						<ul className="space-y-2">
							{alerts.map((alert) => (
								<li
									key={alert.id}
									className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2"
								>
									<div className="flex flex-col">
										<span className="text-sm font-medium">
											{m[`billing.alerts.types.${alert.type}.label`]()}
										</span>
										<span className="text-xs text-muted-foreground">
											${alert.amount}
										</span>
									</div>

									<Button
										size="icon"
										variant="ghost"
										className="text-muted-foreground hover:text-destructive cursor-pointer"
									>
										✕
									</Button>
								</li>
							))}
						</ul>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
