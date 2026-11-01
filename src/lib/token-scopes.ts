import { hasMinRole } from './permissions';

export const TOKEN_SCOPES = ['me', 'upload', 'user'] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

export const SCOPE_INFO: Record<TokenScope, { description: string; danger: string }> = {
	me: {
		description: 'Read your uploads and quota.',
		danger: 'Can see everything you have uploaded.',
	},
	upload: {
		description: 'Upload files as you.',
		danger: 'Can upload files as you and use up your storage.',
	},
	user: {
		description: 'Manage users (admin only).',
		danger: 'Can create, edit, and delete any user, including roles and passwords.',
	},
};

export const MAX_ACTIVE_TOKENS = 25;
export const MAX_TOKEN_NAME_LENGTH = 60;

/** Days; null = never expires. */
export const TOKEN_EXPIRY_DAYS = [1, 7, 30, 90, 365, null] as const;

export function canManageTokens(role: string): boolean {
	return hasMinRole(role, 'uploader');
}

export function canGrantScope(role: string, scope: TokenScope): boolean {
	return scope === 'user' ? hasMinRole(role, 'admin') : canManageTokens(role);
}

/** Returns de-duplicated valid scopes, or null if any entry is unknown/empty. */
export function parseScopes(raw: string | string[] | undefined | null): TokenScope[] | null {
	const parts = (Array.isArray(raw) ? raw : (raw ?? '').split(/[,\s]+/)).map(s => s.trim()).filter(Boolean);
	if (parts.length === 0) return null;
	if (!parts.every(p => (TOKEN_SCOPES as readonly string[]).includes(p))) return null;
	return [...new Set(parts)] as TokenScope[];
}

/** https only (http allowed for localhost); no credentials. Returns the parsed URL or null. */
export function parseCallbackUrl(raw: string | undefined | null): URL | null {
	if (!raw) return null;
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	if (url.username || url.password) return null;
	const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
	if (url.protocol === 'https:' || (url.protocol === 'http:' && local)) return url;
	return null;
}
