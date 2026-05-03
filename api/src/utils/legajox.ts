import type { ActiveUser } from '@api/utils/auth';

export const LEGAJOX_ALLOWED_SLUGS = (process.env.LEGAJOX_ALLOWED_SLUGS ?? '')
	.split(',')
	.filter(Boolean);

export function isLegajoxAllowed(activeUser: ActiveUser): boolean {
	return activeUser.isAdmin && LEGAJOX_ALLOWED_SLUGS.includes(activeUser.slug);
}
