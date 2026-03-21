import { Link, useRouterState } from '@tanstack/react-router';
import type { Language } from '@/lib/user';
import {
	'footer.tagline' as footer_tagline,
	'footer.privacy_policy' as footer_privacy_policy,
	'footer.terms' as footer_terms,
} from '@/paraglide/messages.js';

// -------------------------------- TYPES --------------------------------

type FooterProps = {
	language: Language;
};

// -------------------------------- COMPONENT --------------------------------

export function Footer({ language }: FooterProps) {
	const location = useRouterState({ select: (s) => s.location.pathname });
	const lc = { locale: language };

	const isPrivacyPolicy = location === '/privacy-policy';
	const isTerms = location === '/tyc';

	return (
		<footer className="border-t border-foreground/5 px-6 py-8">
			<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<img src="/nexata_logo.png" alt="Nexata" className="w-7 h-7 object-contain" />
					<span className="text-sm text-muted-foreground">{footer_tagline({}, lc)}</span>
				</div>

				<div className="flex items-center gap-6">
					<Link
						to="/privacy-policy"
						className={`text-xs transition-colors cursor-pointer ${
							isPrivacyPolicy
								? 'text-primary font-semibold'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						{footer_privacy_policy({}, lc)}
					</Link>
					<Link
						to="/tyc"
						className={`text-xs transition-colors cursor-pointer ${
							isTerms
								? 'text-primary font-semibold'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						{footer_terms({}, lc)}
					</Link>
					<p className="text-xs text-muted-foreground">
						&copy; {new Date().getFullYear()} Nexata
					</p>
				</div>
			</div>
		</footer>
	);
}
