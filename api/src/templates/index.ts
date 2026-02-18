import billGenerated from '@api/templates/bill-generated.hbs' with {
	type: 'text',
};
import feedbackUpdated from '@api/templates/feedback-updated.hbs' with {
	type: 'text',
};
import tenantCreation from '@api/templates/tenant-creation.hbs' with {
	type: 'text',
};
import userInvited from '@api/templates/user-invited.hbs' with { type: 'text' };

export const templates: Record<string, string> = {
	'bill-generated': billGenerated,
	'feedback-updated': feedbackUpdated,
	'tenant-creation': tenantCreation,
	'user-invited': userInvited,
};
