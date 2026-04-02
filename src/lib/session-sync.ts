/**
 * Utilities for syncing the NextAuth session from BASE_URL to CONTENT_URL
 * when they are different origins. Uses a one-time code so the session cookie
 * is never sent in a URL (only in a server-to-server exchange).
 */

import { randomBytes } from 'crypto';

const CODE_BYTES = 32;
const CODE_TTL_MS = 60 * 1000; // 1 minute

export interface SyncPayload {
	token: string;
	return_to: string;
}

interface StoredCode {
	payload: SyncPayload;
	expiresAt: number;
}

/** One-time codes are stored in memory. For multi-instance BASE_URL, use sticky sessions or a shared store. */
const codeStore = new Map<string, StoredCode>();

function pruneExpired(): void {
	const now = Date.now();
	for (const [code, entry] of codeStore.entries()) {
		if (now >= entry.expiresAt) codeStore.delete(code);
	}
}

/**
 * Create a one-time code and store the session token and return_to server-side.
 * The session cookie never appears in a URL; only the code does.
 */
export function createSyncCode(sessionToken: string, returnTo: string): string {
	pruneExpired();
	const code = randomBytes(CODE_BYTES).toString('base64url');
	codeStore.set(code, {
		payload: { token: sessionToken, return_to: returnTo },
		expiresAt: Date.now() + CODE_TTL_MS,
	});
	return code;
}

/**
 * Consume a one-time code and return the payload. Returns null if invalid or expired.
 * Each code can only be used once.
 */
export function consumeSyncCode(code: string): SyncPayload | null {
	pruneExpired();
	const entry = codeStore.get(code);
	if (!entry || Date.now() >= entry.expiresAt) return null;
	codeStore.delete(code);
	return entry.payload;
}

/**
 * Allowed return_to must be the CONTENT_URL origin (or path under it).
 * Prevents open redirects.
 */
export function isAllowedReturnTo(returnTo: string, contentUrl: string): boolean {
	if (!returnTo || !contentUrl) return false;
	const contentOrigin = new URL(contentUrl.replace(/\/$/, '')).origin;
	try {
		if (returnTo.startsWith('/')) return true; // path only, we'll redirect to content origin + path
		const url = new URL(returnTo);
		return url.origin === contentOrigin;
	} catch {
		return false;
	}
}

/**
 * Get the session cookie value from the request.
 * Handles default NextAuth cookie name and chunked cookies (.0, .1, ...).
 */
export function getSessionCookieFromRequest(cookies: Record<string, string>): string | null {
	const secure = process.env.NODE_ENV === 'production' && process.env.BASE_URL?.startsWith('https://');
	const baseName = secure ? '__Secure-authjs.session-token' : 'authjs.session-token';

	// Single cookie
	const single = cookies[baseName];
	if (single) return single;

	// Chunked
	const chunks: string[] = [];
	let i = 0;
	while (cookies[`${baseName}.${i}`]) {
		chunks.push(cookies[`${baseName}.${i}`]);
		i++;
	}
	return chunks.length > 0 ? chunks.join('') : null;
}

/**
 * NextAuth session cookie name (same as defaultCookies) for setting on CONTENT_URL.
 */
export function getSessionCookieName(): string {
	const secure = process.env.NODE_ENV === 'production' && process.env.BASE_URL?.startsWith('https://');
	return secure ? '__Secure-authjs.session-token' : 'authjs.session-token';
}
