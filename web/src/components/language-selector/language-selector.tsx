import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from '@/components/ui/select';
import { LANGUAGE_OPTIONS } from '@/hooks/use-sync-language';
import type { Language } from '@/lib/user';

export function LanguageSelector({
	value,
	onChange,
}: {
	value: Language;
	onChange: (v: Language) => void;
}) {
	const current =
		LANGUAGE_OPTIONS.find((l) => l.value === value) ?? LANGUAGE_OPTIONS[0];

	return (
		<Select value={value} onValueChange={(v) => onChange(v as Language)}>
			<SelectTrigger className="h-8 min-w-18 px-2 gap-2 border-none bg-transparent hover:bg-muted/60 flex items-center">
				<Flag country={current.country} />
				<span className="hidden sm:inline text-xs font-medium uppercase text-foreground">
					{current.value}
				</span>
			</SelectTrigger>
			<SelectContent align="start" className="bg-background text-foreground">
				{LANGUAGE_OPTIONS.map((lang) => (
					<SelectItem key={lang.value} value={lang.value}>
						<div className="flex items-center gap-2">
							<Flag country={lang.country} />
							<span className="text-sm uppercase text-foreground">
								{lang.value}
							</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export function Flag({ country }: { country: string }) {
	return (
		<span
			className={`fi fi-${country} rounded-sm shrink-0 inline-block`}
			style={{ width: 18, height: 12 }}
		/>
	);
}
