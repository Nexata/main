import billGenerated from '@api/templates/bill-generated.hbs' with {
	type: 'text',
};
import billPaid from '@api/templates/bill-paid.hbs' with { type: 'text' };
import feedbackUpdated from '@api/templates/feedback-updated.hbs' with {
	type: 'text',
};
import limitWarning from '@api/templates/limit-warning.hbs' with {
	type: 'text',
};
import syncFailed from '@api/templates/sync-failed.hbs' with { type: 'text' };
import tenantCreation from '@api/templates/tenant-creation.hbs' with {
	type: 'text',
};
import userInvited from '@api/templates/user-invited.hbs' with { type: 'text' };
import userLeft from '@api/templates/user-left.hbs' with { type: 'text' };
import userRemoved from '@api/templates/user-removed.hbs' with { type: 'text' };

export const templates: Record<string, string> = {
	'bill-generated': billGenerated,
	'bill-paid': billPaid,
	'feedback-updated': feedbackUpdated,
	'limit-warning': limitWarning,
	'sync-failed': syncFailed,
	'tenant-creation': tenantCreation,
	'user-invited': userInvited,
	'user-left': userLeft,
	'user-removed': userRemoved,
};
