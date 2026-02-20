const STORAGE_KEY = "tenant_sessions";

export type Session = {
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

export function saveTenantSessions(sessions: Session[] | null) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getTenantSessions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}
