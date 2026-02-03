import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React from 'react';

export const Route = createFileRoute('/_private/credential-callback')({
	component: CredentialCallbackPage,
});

function CredentialCallbackPage() {
	const navigate = useNavigate();

	React.useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const error = params.get('error');

		if (error) console.error('Credential auth error:', error);

		navigate({ to: '/settings' });
	}, [navigate]);

	return null;
}
