/**
 * Simple in-memory rate limiter for the preview endpoint.
 * Tracks request counts per IP within a sliding window.
 * Exported for testing.
 */
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 120; // max 120 preview requests per IP per minute

export { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS };

export interface RateLimitEntry {
	count: number;
	resetAt: number;
}

export const rateLimitMap = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL_MS = 5 * 60_000; // every 5 minutes
let lastCleanup = Date.now();

function cleanupRateLimits() {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
	lastCleanup = now;
	for (const [key, entry] of rateLimitMap) {
		if (now > entry.resetAt) {
			rateLimitMap.delete(key);
		}
	}
}

export function checkRateLimit(ip: string): boolean {
	cleanupRateLimits();
	const now = Date.now();
	const entry = rateLimitMap.get(ip);

	if (!entry || now > entry.resetAt) {
		rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return true;
	}

	entry.count++;
	return entry.count <= RATE_LIMIT_MAX_REQUESTS;
}
