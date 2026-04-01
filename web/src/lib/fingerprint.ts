import FingerprintJS from '@fingerprintjs/fingerprintjs';

const FINGERPRINT_KEY = 'device_fingerprint';
let cachedFingerprint: string | null = null;

export async function getFingerprint(): Promise<string> {
	if (cachedFingerprint) return cachedFingerprint;

	const stored = localStorage.getItem(FINGERPRINT_KEY);
	if (stored) {
		cachedFingerprint = stored;
		return stored;
	}

	const fp = await FingerprintJS.load();
	const result = await fp.get();
	cachedFingerprint = result.visitorId;
	localStorage.setItem(FINGERPRINT_KEY, result.visitorId);

	return result.visitorId;
}

export function clearFingerprint() {
	cachedFingerprint = null;
	localStorage.removeItem(FINGERPRINT_KEY);
}
