import { motion } from 'framer-motion'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type UsageBarProps = {
	label: string
	used: number
	total: number
	colorClass: string
	loading?: boolean
	unit?: string
	info?: string
}

export function UsageBar({
	label,
	used,
	total,
	colorClass,
	loading = false,
	unit,
	info,
}: UsageBarProps) {
	const percentage =
		!loading && total > 0 ? Math.min((used / total) * 100, 100) : 0

	const textColorClass = colorClass.replace('bg-', 'text-')

	const formatValue = (value: number) => {
		if (Number.isInteger(value)) return value
		return Number(value.toFixed(3))
	}

	const usedFormatted = formatValue(used)
	const totalFormatted = formatValue(total)

	return (
		<div className="space-y-2">
			{/* Header */}
			<div className="flex justify-between text-sm">
				<div className="flex items-center gap-1.5">
					<span>{label}</span>

					{info && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="More information"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>

              <TooltipContent
                side="top"
                className="max-w-xs text-xs"
              >
                {info}
              </TooltipContent>
            </Tooltip>
          )}
				</div>

				{loading ? (
					<div className="h-4 w-20 rounded bg-muted animate-pulse" />
				) : (
					<span className={`font-medium ${textColorClass}`}>
						{usedFormatted}{unit ? ` ${unit}` : ''} / {totalFormatted}{unit ? ` ${unit}` : ''}
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
	)
}
