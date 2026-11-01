import { createHash, randomBytes } from 'crypto';

export const TOKEN_PREFIX = 'partf_';

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/** 256-bit random secret; only the hash is stored. */
export function generateToken(): { token: string; prefix: string; tokenHash: string } {
	const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
	return { token, prefix: token.slice(0, TOKEN_PREFIX.length + 4), tokenHash: hashToken(token) };
}
