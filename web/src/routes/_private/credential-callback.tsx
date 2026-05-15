import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React from 'react';
import { infoToast } from '@/components/info-toast/info-toast';

export const Route = createFileRoute('/_private/credential-callback')({
	component: CredentialCallbackPage,
});

function CredentialCallbackPage() {
	const navigate = useNavigate();

	React.useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const error = params.get('error');

		if (error) {
			console.error('Credential auth error:', error);
			const toastId = infoToast.loading({ title: '' });
			infoToast.error(toastId, {
				title: 'Error al conectar',
				description: 'No se pudo completar la autenticación con el proveedor. Por favor, intentá de nuevo.',
			});
		}

		navigate({ to: '/settings' });
	}, [navigate]);

	return null;
}
