import {
	Briefcase,
	CreditCard,
	Crown,
	Diamond,
	Gem,
	Sparkles,
	type LucideIcon,
} from 'lucide-react';
import { getLocale } from '@/paraglide/runtime';

export type TenantPlan =
	| 'free'
	| 'personal'
	| 'team'
	| 'business'
	| 'enterprise'
	| 'pay_as_you_go';

type PlanConfig = {
	baseBill: number;
	messageLimit: number | null;
	storageLimit: number | null;
	embedLimit: number | null;
	hasApiAccess: boolean;
	isVisibleInUpgradeModal: boolean;
	isSelfServe: boolean;
	badgeClassName: string;
	cardIconContainerClassName: string;
	cardIconClassName: string;
	Icon: LucideIcon;
};

export const PLAN_ORDER: TenantPlan[] = [
	'free',
	'personal',
	'team',
	'business',
	'enterprise',
	'pay_as_you_go',
];

export const PLAN_CONFIG: Record<TenantPlan, PlanConfig> = {
	free: {
		baseBill: 0,
		messageLimit: 10,
		storageLimit: 10,
		embedLimit: 10 * 250_000,
		hasApiAccess: false,
		isVisibleInUpgradeModal: false,
		isSelfServe: true,
		badgeClassName: 'bg-emerald-500/10 text-emerald-600',
		cardIconContainerClassName: 'bg-emerald-500/10',
		cardIconClassName: 'text-emerald-600',
		Icon: Sparkles,
	},
	personal: {
		baseBill: 20,
		messageLimit: 125,
		storageLimit: 1024,
		embedLimit: 1024 * 250_000,
		hasApiAccess: false,
		isVisibleInUpgradeModal: true,
		isSelfServe: true,
		badgeClassName: 'bg-amber-500/10 text-amber-600',
		cardIconContainerClassName: 'bg-amber-500/10',
		cardIconClassName: 'text-amber-600',
		Icon: Gem,
	},
	team: {
		baseBill: 100,
		messageLimit: 750,
		storageLimit: 10 * 1024,
		embedLimit: 5 * 1000 * 250_000,
		hasApiAccess: true,
		isVisibleInUpgradeModal: true,
		isSelfServe: true,
		badgeClassName: 'bg-sky-500/10 text-sky-600',
		cardIconContainerClassName: 'bg-sky-500/10',
		cardIconClassName: 'text-sky-600',
		Icon: Briefcase,
	},
	business: {
		baseBill: 200,
		messageLimit: 1500,
		storageLimit: 50 * 1024,
		embedLimit: 15 * 1000 * 250_000,
		hasApiAccess: true,
		isVisibleInUpgradeModal: true,
		isSelfServe: true,
		badgeClassName: 'bg-primary/10 text-primary',
		cardIconContainerClassName: 'bg-primary/10',
		cardIconClassName: 'text-primary',
		Icon: Crown,
	},
	enterprise: {
		baseBill: 500,
		messageLimit: 5000,
		storageLimit: 175 * 1024,
		embedLimit: 50 * 1000 * 250_000,
		hasApiAccess: true,
		isVisibleInUpgradeModal: true,
		isSelfServe: true,
		badgeClassName: 'bg-fuchsia-500/10 text-fuchsia-600',
		cardIconContainerClassName: 'bg-fuchsia-500/10',
		cardIconClassName: 'text-fuchsia-600',
		Icon: Diamond,
	},
	pay_as_you_go: {
		baseBill: 600,
		messageLimit: null,
		storageLimit: null,
		embedLimit: null,
		hasApiAccess: true,
		isVisibleInUpgradeModal: true,
		isSelfServe: false,
		badgeClassName: 'bg-violet-500/10 text-violet-600',
		cardIconContainerClassName: 'bg-violet-500/10',
		cardIconClassName: 'text-violet-600',
		Icon: CreditCard,
	},
};

export const UPGRADE_MODAL_PLANS = PLAN_ORDER.filter(
	(plan): plan is Exclude<TenantPlan, 'free'> =>
		PLAN_CONFIG[plan].isVisibleInUpgradeModal,
);

export function comparePlans(a: TenantPlan, b: TenantPlan) {
	return PLAN_ORDER.indexOf(a) - PLAN_ORDER.indexOf(b);
}

export function isUpgradePlan(currentPlan: TenantPlan, targetPlan: TenantPlan) {
	return comparePlans(currentPlan, targetPlan) < 0;
}

export function isDowngradePlan(
	currentPlan: TenantPlan,
	targetPlan: TenantPlan,
) {
	return comparePlans(currentPlan, targetPlan) > 0;
}

export function getPlanLabel(plan: TenantPlan) {
	const locale = getLocale();
	const labels =
		locale === 'es'
			? {
					free: 'Gratis',
					personal: 'Personal',
					team: 'Team',
					business: 'Business',
					enterprise: 'Enterprise',
					pay_as_you_go: 'Pago por uso',
				}
			: {
					free: 'Free',
					personal: 'Personal',
					team: 'Team',
					business: 'Business',
					enterprise: 'Enterprise',
					pay_as_you_go: 'Pay as you go',
				};

	return labels[plan];
}

export function getPlanDescription(plan: Exclude<TenantPlan, 'free'>) {
	const locale = getLocale();
	const descriptions =
		locale === 'es'
			? {
					personal:
						'Ideal para profesionales independientes y equipos pequeños.',
					team: 'Diseñado para equipos que ya necesitan colaboración y acceso a API.',
					business:
						'Pensado para operaciones con alto volumen y múltiples flujos de trabajo.',
					enterprise:
						'Para compañías con necesidades de escala, gobernanza y uso intensivo.',
					pay_as_you_go:
						'Base mensual con límites abiertos y un esquema flexible para necesidades especiales.',
				}
			: {
					personal: 'Great for individual professionals and small teams.',
					team: 'Built for teams that already need collaboration and API access.',
					business:
						'Designed for higher-volume operations and multi-team workflows.',
					enterprise:
						'For organizations that need scale, governance, and intensive usage.',
					pay_as_you_go:
						'Monthly base pricing with open limits and flexible billing for specialized needs.',
				};

	return descriptions[plan];
}

export function getPlanPrice(
	plan: Exclude<TenantPlan, 'free'>,
	formatAmount: (usd: number) => string,
) {
	const period =
		getLocale() === 'es'
			? plan === 'pay_as_you_go'
				? 'mes base'
				: 'mes'
			: plan === 'pay_as_you_go'
				? 'base month'
				: 'month';

	return `${formatAmount(PLAN_CONFIG[plan].baseBill)} / ${period}`;
}

export function getPlanFeatures(plan: Exclude<TenantPlan, 'free'>) {
	const locale = getLocale();
	const config = PLAN_CONFIG[plan];
	const features = [
		config.messageLimit === null
			? locale === 'es'
				? 'Mensajes ilimitados por mes'
				: 'Unlimited messages per month'
			: locale === 'es'
				? `${formatMessageLimit(config.messageLimit)} mensajes por mes`
				: `${formatMessageLimit(config.messageLimit)} messages per month`,
		config.storageLimit === null
			? locale === 'es'
				? 'Almacenamiento ilimitado'
				: 'Unlimited storage'
			: locale === 'es'
				? `${formatStorageLimit(config.storageLimit)} de almacenamiento`
				: `${formatStorageLimit(config.storageLimit)} of storage`,
		config.embedLimit === null
			? locale === 'es'
				? 'Embeddings ilimitados por mes'
				: 'Unlimited embeddings per month'
			: locale === 'es'
				? `${formatEmbedLimit(config.embedLimit)} tokens para embeddings / mes`
				: `${formatEmbedLimit(config.embedLimit)} tokens for embeddings / month`,
	];

	if (config.hasApiAccess) {
		features.push(
			locale === 'es' ? 'Acceso a API incluido' : 'API access included',
		);
	}

	return features;
}

export function formatMessageLimit(limit: number) {
	return new Intl.NumberFormat(getLocale()).format(limit);
}

export function formatStorageLimit(limitInMb: number) {
	const locale = getLocale();

	if (limitInMb >= 1024) {
		const sizeInGb = limitInMb / 1024;
		return `${formatCompactNumber(sizeInGb, locale)} GB`;
	}

	return `${formatCompactNumber(limitInMb, locale)} MB`;
}

export function formatEmbedLimit(limit: number) {
	const locale = getLocale();
	const billion = 1_000_000_000;
	const million = 1_000_000;

	if (limit >= billion) {
		return `${formatCompactNumber(limit / billion, locale)}B`;
	}

	return `${formatCompactNumber(limit / million, locale)}M`;
}

function formatCompactNumber(value: number, locale: string) {
	const maximumFractionDigits = Number.isInteger(value) ? 0 : 2;

	return new Intl.NumberFormat(locale, {
		maximumFractionDigits,
		minimumFractionDigits: 0,
	}).format(value);
}
