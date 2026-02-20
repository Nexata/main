import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React from 'react';
import { saveTokens } from '@/lib/auth';

type Session = {
	at: string;
	rt: string;
	user: {
		id: string;
		email: string;
		displayName?: string;
		pfpUrl?: string | null;
	};
	tenant: {
		slug: string;
		displayName: string;
		logoUrl?: string | null;
	};
};

export const Route = createFileRoute('/_public/callback')({
	component: CallbackPage,
});

export default function CallbackPage() {
	const navigate = useNavigate();

	React.useEffect(() => {
		try {
			const params = new URLSearchParams(window.location.search);
			const encoded = params.get('sessions');

			if (!encoded) {
				navigate({ to: '/login' });
				return;
			}

			const decoded = atob(encoded);
			const sessions: Session[] = JSON.parse(decoded);

			if (!Array.isArray(sessions) || sessions.length === 0) {
				navigate({ to: '/login' });
				return;
			}

			if (sessions.length === 1) {
        const s = sessions[0];
        if (!s) return;
				saveTokens(s.at, s.rt);
				navigate({ to: '/chat' });
				return;
			}

			const encodedSessions = encodeURIComponent(encoded);

      navigate({
        to: '/tenant-selection',
        search: { sessions: encodedSessions },
      });
		} catch (err) {
			console.error('Callback parse error:', err);
			navigate({ to: '/login' });
		}
	}, [navigate]);

	return null;
}
