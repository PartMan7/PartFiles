import { describe, it, expect } from 'vitest';
import { GET, POST } from '@/app/api/tokens/route';
import { DELETE } from '@/app/api/tokens/[id]/route';
import { mockAdmin, mockGuest, mockUploader, mockUnauthenticated, mockPrisma } from '../setup';
import { jsonRequest, parseResponse } from '../helpers';
import { NextRequest } from 'next/server';

const body = { name: 'ci', scopes: ['me'], expiresInDays: 30 };

describe('/api/tokens', () => {
	it('401 unauthenticated', async () => {
		mockUnauthenticated();
		expect((await parseResponse(await GET())).status).toBe(401);
	});

	it('403 for guest', async () => {
		mockGuest();
		expect((await parseResponse(await GET())).status).toBe(403);
		expect((await parseResponse(await POST(jsonRequest('/api/tokens', 'POST', body)))).status).toBe(403);
	});

	it('creates token, stores hash only, returns secret once', async () => {
		mockUploader();
		const { status, body: res } = await parseResponse(await POST(jsonRequest('/api/tokens', 'POST', body)));
		expect(status).toBe(201);
		const token = res?.token as string;
		expect(token.startsWith('partf_')).toBe(true);
		const data = mockPrisma.apiToken.create.mock.calls[0][0].data;
		expect(JSON.stringify(data)).not.toContain(token);
		expect(data.tokenHash).toHaveLength(64);
	});

	it('allows permanent tokens', async () => {
		mockUploader();
		const { status } = await parseResponse(await POST(jsonRequest('/api/tokens', 'POST', { ...body, expiresInDays: null })));
		expect(status).toBe(201);
		expect(mockPrisma.apiToken.create.mock.calls[0][0].data.expiresAt).toBeNull();
	});

	it('uploader cannot grant user scope; admin can', async () => {
		mockUploader();
		const r = { ...body, scopes: ['user'] };
		expect((await parseResponse(await POST(jsonRequest('/api/tokens', 'POST', r)))).status).toBe(403);
		mockAdmin();
		expect((await parseResponse(await POST(jsonRequest('/api/tokens', 'POST', r)))).status).toBe(201);
	});

	it('rejects invalid scopes, expiry, and enforces cap', async () => {
		mockAdmin();
		expect((await parseResponse(await POST(jsonRequest('/api/tokens', 'POST', { ...body, scopes: ['x'] })))).status).toBe(400);
		expect((await parseResponse(await POST(jsonRequest('/api/tokens', 'POST', { ...body, expiresInDays: 5 })))).status).toBe(400);
		mockPrisma.apiToken.count.mockResolvedValue(25);
		expect((await parseResponse(await POST(jsonRequest('/api/tokens', 'POST', body)))).status).toBe(409);
	});

	it('list never exposes hash', async () => {
		mockUploader();
		mockPrisma.apiToken.findMany.mockResolvedValue([{ id: 'a', name: 'n', prefix: 'partf_abcd', scopes: 'me,upload' }]);
		const { body: res } = await parseResponse(await GET());
		expect(JSON.stringify(res)).not.toContain('tokenHash');
		expect((res?.tokens as { scopes: string[] }[])[0].scopes).toEqual(['me', 'upload']);
		expect(mockPrisma.apiToken.findMany.mock.calls[0][0].select.tokenHash).toBeUndefined();
	});

	it('revoke: own token revoked, others 404', async () => {
		mockUploader();
		const req = new NextRequest('http://localhost/api/tokens/t1', { method: 'DELETE' });
		const params = Promise.resolve({ id: 't1' });
		expect((await parseResponse(await DELETE(req, { params }))).status).toBe(404);
		mockPrisma.apiToken.findFirst.mockResolvedValue({ id: 't1', revokedAt: null });
		expect((await parseResponse(await DELETE(req, { params }))).status).toBe(200);
		expect(mockPrisma.apiToken.update.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date);
		expect(mockPrisma.apiToken.findFirst.mock.calls[0][0].where.userId).toBe('uploader-id');
	});
});
