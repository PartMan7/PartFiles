import { describe, it, expect } from 'vitest';
import { authenticate } from '@/lib/api-auth';
import { generateToken } from '@/lib/tokens';
import { mockPrisma, mockUploader } from '../setup';

function setup(over: Record<string, unknown> = {}, role = 'uploader') {
	const { token, tokenHash } = generateToken();
	mockPrisma.apiToken.findUnique.mockImplementation(({ where }: { where: { tokenHash: string } }) =>
		Promise.resolve(
			where.tokenHash === tokenHash
				? {
						id: 't1',
						scopes: 'me,upload',
						revokedAt: null,
						expiresAt: null,
						lastUsedAt: new Date(),
						user: { id: 'u1', username: 'bob', role },
						...over,
					}
				: null
		)
	);
	return new Request('http://localhost/api/x', { headers: { authorization: `Bearer ${token}` } });
}

describe('authenticate', () => {
	it('accepts valid token with scope', async () => {
		const res = await authenticate(setup(), 'upload');
		expect(res?.user).toEqual({ id: 'u1', name: 'bob', role: 'uploader' });
	});
	it('rejects missing scope', async () => expect(await authenticate(setup(), 'user')).toBeNull());
	it('rejects revoked', async () => expect(await authenticate(setup({ revokedAt: new Date() }), 'me')).toBeNull());
	it('rejects expired', async () => expect(await authenticate(setup({ expiresAt: new Date(Date.now() - 1000) }), 'me')).toBeNull());
	it('user scope void after demotion', async () =>
		expect(await authenticate(setup({ scopes: 'user' }, 'uploader'), 'user')).toBeNull());
	it('unknown token does not fall back to session', async () => {
		mockUploader();
		const req = new Request('http://localhost/api/x', { headers: { authorization: 'Bearer partf_nope' } });
		expect(await authenticate(req, 'me')).toBeNull();
	});
	it('falls back to session without header', async () => {
		mockUploader();
		expect((await authenticate(undefined, 'me'))?.user.id).toBe('uploader-id');
	});
});
