import Elysia from 'elysia';

export const billingRouter = new Elysia({ prefix: '/billing' })

	.put(
		'/generate-bills',
		async () => {
			// Crear bills + resetear messages a default
		},
		{
			detail: {
				tags: ['TODO'],
				summary: 'Generate billing',
				description:
					'Generates bills for the month and resets consumptions. Expected to run cronologically each first day of the month.',
			},
		},
	)
	.put(
		'/generate-events',
		async () => {
			// Crear billableevents por MBs en la db
		},
		{
			detail: {
				tags: ['TODO'],
				summary: 'Generate billable events',
				description:
					'Generates cronological billable events. Expected to run cronologically at midnight.',
			},
		},
	);
