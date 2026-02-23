import enBillGenerated from '@api/locales/en/bill-generated.json' with {
	type: 'json',
};
import enBillPaid from '@api/locales/en/bill-paid.json' with { type: 'json' };
import enFeedbackUpdated from '@api/locales/en/feedback-updated.json' with {
	type: 'json',
};
import enLimitWarning from '@api/locales/en/limit-warning.json' with {
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
import enUserLeft from '@api/locales/en/user-left.json' with { type: 'json' };
import enUserRemoved from '@api/locales/en/user-removed.json' with {
	type: 'json',
};
import esBillGenerated from '@api/locales/es/bill-generated.json' with {
	type: 'json',
};
import esBillPaid from '@api/locales/es/bill-paid.json' with { type: 'json' };
import esFeedbackUpdated from '@api/locales/es/feedback-updated.json' with {
	type: 'json',
};
import esLimitWarning from '@api/locales/es/limit-warning.json' with {
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
import esUserLeft from '@api/locales/es/user-left.json' with { type: 'json' };
import esUserRemoved from '@api/locales/es/user-removed.json' with {
	type: 'json',
};

export const locales: Record<string, Record<string, Record<string, string>>> = {
	en: {
		'bill-generated': enBillGenerated,
		'bill-paid': enBillPaid,
		'feedback-updated': enFeedbackUpdated,
		'limit-warning': enLimitWarning,
		'sync-failed': enSyncFailed,
		'tenant-creation': enTenantCreation,
		'user-invited': enUserInvited,
		'user-left': enUserLeft,
		'user-removed': enUserRemoved,
	},
	es: {
		'bill-generated': esBillGenerated,
		'bill-paid': esBillPaid,
		'feedback-updated': esFeedbackUpdated,
		'limit-warning': esLimitWarning,
		'sync-failed': esSyncFailed,
		'tenant-creation': esTenantCreation,
		'user-invited': esUserInvited,
		'user-left': esUserLeft,
		'user-removed': esUserRemoved,
	},
};
