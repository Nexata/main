import { motion } from 'framer-motion';

export function UsageBar({
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
	const textColorClass = colorClass.replace('bg-', 'text-');

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
