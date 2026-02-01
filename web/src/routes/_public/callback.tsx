import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React from 'react';
import { saveTokens } from '@/lib/auth';

export const Route = createFileRoute('/_public/callback')({
	component: CallbackPage,
});

export default function CallbackPage() {
	const navigate = useNavigate();

	React.useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const accessToken = params.get('at');
		const refreshToken = params.get('rt');

		if (accessToken && refreshToken) {
			saveTokens(accessToken, refreshToken);
      navigate({
          to: '/chat',
          search: {threadId: null},
        });
		} else {
			navigate({ to: '/login' });
		}
	}, [navigate]);

	return null;
}
