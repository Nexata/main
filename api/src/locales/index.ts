import enBillGenerated from '@api/locales/en/bill-generated.json' with {
	type: 'json',
};
import enFeedbackUpdated from '@api/locales/en/feedback-updated.json' with {
	type: 'json',
};
import enSyncFailed from '@api/locales/en/sync-failed.json' with {
	type: 'json',
};
import enTenantCreation from '@api/locales/en/tenant-creation.json' with {
	type: 'json',
};
import enUserInvited from '@api/locales/en/user-invited.json' with {
	type: 'json',
};
import esBillGenerated from '@api/locales/es/bill-generated.json' with {
	type: 'json',
};
import esFeedbackUpdated from '@api/locales/es/feedback-updated.json' with {
	type: 'json',
};
import esSyncFailed from '@api/locales/es/sync-failed.json' with {
	type: 'json',
};
import esTenantCreation from '@api/locales/es/tenant-creation.json' with {
	type: 'json',
};
import esUserInvited from '@api/locales/es/user-invited.json' with {
	type: 'json',
};

export const locales: Record<string, Record<string, Record<string, string>>> = {
	en: {
		'bill-generated': enBillGenerated,
		'feedback-updated': enFeedbackUpdated,
		'sync-failed': enSyncFailed,
		'tenant-creation': enTenantCreation,
		'user-invited': enUserInvited,
	},
	es: {
		'bill-generated': esBillGenerated,
		'feedback-updated': esFeedbackUpdated,
		'sync-failed': esSyncFailed,
		'tenant-creation': esTenantCreation,
		'user-invited': esUserInvited,
	},
};
