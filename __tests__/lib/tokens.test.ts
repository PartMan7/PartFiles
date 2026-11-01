import { describe, it, expect } from 'vitest';
import { generateToken, hashToken, TOKEN_PREFIX } from '@/lib/tokens';
import { parseCallbackUrl, parseScopes, canGrantScope } from '@/lib/token-scopes';

describe('tokens', () => {
	it('generates unique prefixed tokens whose hash matches', () => {
		const a = generateToken();
		const b = generateToken();
		expect(a.token.startsWith(TOKEN_PREFIX)).toBe(true);
		expect(a.token).not.toBe(b.token);
		expect(a.tokenHash).toBe(hashToken(a.token));
		expect(a.tokenHash).not.toContain(a.token);
	});
});

describe('parseScopes', () => {
	it('accepts valid, dedupes', () => expect(parseScopes('me,upload,me')).toEqual(['me', 'upload']));
	it('rejects unknown or empty', () => {
		expect(parseScopes('me,root')).toBeNull();
		expect(parseScopes('')).toBeNull();
		expect(parseScopes(undefined)).toBeNull();
	});
});

describe('canGrantScope', () => {
	it('user scope is admin only', () => {
		expect(canGrantScope('uploader', 'user')).toBe(false);
		expect(canGrantScope('admin', 'user')).toBe(true);
		expect(canGrantScope('guest', 'me')).toBe(false);
	});
});

describe('parseCallbackUrl', () => {
	it('allows https and localhost http', () => {
		expect(parseCallbackUrl('https://a.example/cb')).not.toBeNull();
		expect(parseCallbackUrl('http://localhost:3000/cb')).not.toBeNull();
	});
	it('rejects unsafe', () => {
		expect(parseCallbackUrl('http://a.example/cb')).toBeNull();
		expect(parseCallbackUrl('javascript:alert(1)')).toBeNull();
		expect(parseCallbackUrl('https://u:p@a.example/')).toBeNull();
		expect(parseCallbackUrl('nonsense')).toBeNull();
	});
});
