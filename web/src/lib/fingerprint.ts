const FINGERPRINT_KEY = 'app:fingerprint';

export function getFingerprint(): string {
	let fingerprint = localStorage.getItem(FINGERPRINT_KEY);

	if (!fingerprint) {
		fingerprint = crypto.randomUUID();
		localStorage.setItem(FINGERPRINT_KEY, fingerprint);
	}

	return fingerprint;
}

export function clearFingerprint() {
	localStorage.removeItem(FINGERPRINT_KEY);
}
