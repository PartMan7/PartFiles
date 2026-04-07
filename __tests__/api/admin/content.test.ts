import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/content/route';
import { GET as GET_ID, PUT, DELETE } from '@/app/api/admin/content/[id]/route';
import { mockAdmin, mockUploader, mockUnauthenticated, mockPrisma, mockStorage, mockPreview } from '../../setup';
import { jsonRequest, parseResponse } from '../../helpers';
import { NextRequest } from 'next/server';

describe('GET /api/content', () => {
	const makeReq = (params?: Record<string, string | string[]>) => {
		const url = new URL('http://localhost:3000/api/content');
		if (params) {
			Object.entries(params).forEach(([k, v]) => {
				if (Array.isArray(v)) v.forEach(val => url.searchParams.append(k, val));
				else url.searchParams.set(k, v);
			});
		}
		return new NextRequest(url);
	};

	it('returns 400 when non-admin without uploadedBy', async () => {
		mockUploader();
		const { status } = await parseResponse(await GET(makeReq()));
		expect(status).toBe(400);
	});

	it('returns 400 when non-admin has an uploadedBy that does not match their username', async () => {
		mockUploader();
		const { status } = await parseResponse(await GET(makeReq({ uploadedBy: ['alice', 'uploader'] })));
		expect(status).toBe(400);
	});

	it('returns 200 for non-admin when uploadedBy tags match their username', async () => {
		mockUploader();
		mockPrisma.content.findMany.mockResolvedValue([]);
		const { status } = await parseResponse(await GET(makeReq({ uploadedBy: ['uploader'] })));
		expect(status).toBe(200);
		const whereArg = mockPrisma.content.findMany.mock.calls[0][0]?.where;
		expect(whereArg.AND).toHaveLength(1);
		expect(whereArg.AND[0]).toEqual({ uploadedById: 'uploader-id' });
	});

	it('returns 401 for unauthenticated', async () => {
		mockUnauthenticated();
		const { status } = await parseResponse(await GET(makeReq()));
		expect(status).toBe(401);
	});

	it('returns content list for admin', async () => {
		mockAdmin();
		const mockContent = [
			{
				id: 'c1',
				filename: 'test.pdf',
				originalFilename: 'test.pdf',
				fileSize: 1024,
				fileExtension: '.pdf',
				mimeType: 'application/pdf',
				expiresAt: null,
				createdAt: new Date(),
				uploadedBy: { id: 'u1', username: 'admin', role: 'admin' },
			},
		];
		mockPrisma.content.findMany.mockResolvedValue(mockContent);

		const { status, body } = await parseResponse(await GET(makeReq()));
		expect(status).toBe(200);
		expect(body?.content).toHaveLength(1);
	});

	it('filters active content when expired=active', async () => {
		mockAdmin();
		mockPrisma.content.findMany.mockResolvedValue([]);

		await GET(makeReq({ expired: 'active' }));
		const whereArg = mockPrisma.content.findMany.mock.calls[0][0]?.where;
		expect(whereArg).toHaveProperty('AND');
		expect(whereArg.AND[0]).toHaveProperty('OR');
		expect(whereArg.AND[0].OR).toEqual(
			expect.arrayContaining([
				{ expiresAt: null },
				expect.objectContaining({ expiresAt: expect.objectContaining({ gt: expect.any(Date) }) }),
			])
		);
	});

	it('filters expired content when expired=expired', async () => {
		mockAdmin();
		mockPrisma.content.findMany.mockResolvedValue([]);

		await GET(makeReq({ expired: 'expired' }));
		const whereArg = mockPrisma.content.findMany.mock.calls[0][0]?.where;
		expect(whereArg).toHaveProperty('AND');
		expect(whereArg.AND[0]).toHaveProperty('expiresAt');
		expect(whereArg.AND[0].expiresAt).toEqual(expect.objectContaining({ lte: expect.any(Date) }));
	});

	it('filters by uploader username fragments (uploadedBy repeated)', async () => {
		mockAdmin();
		mockPrisma.user.findMany.mockResolvedValue([
			{ id: 'user-alice', username: 'alice' },
			{ id: 'user-bob', username: 'bob' },
		]);
		mockPrisma.content.findMany.mockResolvedValue([]);

		await GET(makeReq({ uploadedBy: ['alice', 'bob'] }));
		const whereArg = mockPrisma.content.findMany.mock.calls[0][0]?.where;
		expect(whereArg).toHaveProperty('AND');
		expect(whereArg.AND[0]).toEqual({
			uploadedById: { in: expect.arrayContaining(['user-alice', 'user-bob']) },
		});
		expect(whereArg.AND[0].uploadedById.in).toHaveLength(2);
	});

	it('combines expired and uploader filters', async () => {
		mockAdmin();
		mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-x', username: 'xavier' }]);
		mockPrisma.content.findMany.mockResolvedValue([]);

		await GET(makeReq({ expired: 'active', uploadedBy: ['x'] }));
		const whereArg = mockPrisma.content.findMany.mock.calls[0][0]?.where;
		expect(whereArg.AND).toHaveLength(2);
		expect(whereArg.AND[0]).toHaveProperty('OR');
		expect(whereArg.AND[1]).toEqual({ uploadedById: { in: ['user-x'] } });
	});

	it('returns 400 when too many uploadedBy params', async () => {
		mockAdmin();
		const tags = Array.from({ length: 21 }, (_, i) => `u${i}`);
		const { status } = await parseResponse(await GET(makeReq({ uploadedBy: tags })));
		expect(status).toBe(400);
		expect(mockPrisma.content.findMany).not.toHaveBeenCalled();
	});
});

describe('GET /api/admin/content/[id]', () => {
	it('returns 403 for non-admin', async () => {
		mockUploader();
		const req = new NextRequest('http://localhost:3000/api/admin/content/c1');
		const { status } = await parseResponse(await GET_ID(req, { params: Promise.resolve({ id: 'c1' }) }));
		expect(status).toBe(403);
	});

	it('returns 404 for non-existent content', async () => {
		mockAdmin();
		mockPrisma.content.findUnique.mockResolvedValue(null);
		const req = new NextRequest('http://localhost:3000/api/admin/content/missing');
		const { status } = await parseResponse(await GET_ID(req, { params: Promise.resolve({ id: 'missing' }) }));
		expect(status).toBe(404);
	});

	it('returns content for admin', async () => {
		mockAdmin();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'c1',
			filename: 'test.pdf',
			uploadedBy: { id: 'u1', username: 'admin', role: 'admin' },
		});
		const req = new NextRequest('http://localhost:3000/api/admin/content/c1');
		const { status, body } = await parseResponse(await GET_ID(req, { params: Promise.resolve({ id: 'c1' }) }));
		expect(status).toBe(200);
		expect((body?.content as Record<string, unknown>)?.filename).toBe('test.pdf');
	});
});

describe('PUT /api/admin/content/[id]', () => {
	beforeEach(() => mockAdmin());

	it('returns 404 for non-existent content', async () => {
		mockPrisma.content.findUnique.mockResolvedValue(null);
		const req = jsonRequest('/api/admin/content/missing', 'PUT', { filename: 'new.pdf' });
		const { status } = await parseResponse(await PUT(req, { params: Promise.resolve({ id: 'missing' }) }));
		expect(status).toBe(404);
	});

	it('updates filename with sanitization', async () => {
		mockPrisma.content.findUnique.mockResolvedValue({ id: 'c1', filename: 'old.pdf' });
		const req = jsonRequest('/api/admin/content/c1', 'PUT', { filename: 'new report.pdf' });
		const { status } = await parseResponse(await PUT(req, { params: Promise.resolve({ id: 'c1' }) }));
		expect(status).toBe(200);
		// sanitizeFilename replaces spaces with underscores
		const updateCall = mockPrisma.content.update.mock.calls[0][0];
		expect(updateCall.data.filename).toBe('new_report.pdf');
	});

	it('can remove expiry (make permanent)', async () => {
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'c1',
			filename: 'tmp.pdf',
			expiresAt: new Date(),
		});
		const req = jsonRequest('/api/admin/content/c1', 'PUT', { expiresAt: null });
		const { status } = await parseResponse(await PUT(req, { params: Promise.resolve({ id: 'c1' }) }));
		expect(status).toBe(200);
		const updateCall = mockPrisma.content.update.mock.calls[0][0];
		expect(updateCall.data.expiresAt).toBeNull();
	});

	it('can set a new expiry date', async () => {
		mockPrisma.content.findUnique.mockResolvedValue({ id: 'c1', filename: 'tmp.pdf', expiresAt: null });
		const future = new Date(Date.now() + 86400000).toISOString();
		const req = jsonRequest('/api/admin/content/c1', 'PUT', { expiresAt: future });
		const { status } = await parseResponse(await PUT(req, { params: Promise.resolve({ id: 'c1' }) }));
		expect(status).toBe(200);
		const updateCall = mockPrisma.content.update.mock.calls[0][0];
		expect(updateCall.data.expiresAt).toBeInstanceOf(Date);
	});
});

describe('DELETE /api/admin/content/[id]', () => {
	beforeEach(() => mockAdmin());

	it('returns 403 for non-admin', async () => {
		mockUploader();
		const req = new NextRequest('http://localhost:3000/api/admin/content/c1', { method: 'DELETE' });
		const { status } = await parseResponse(await DELETE(req, { params: Promise.resolve({ id: 'c1' }) }));
		expect(status).toBe(403);
	});

	it('returns 404 for non-existent content', async () => {
		mockPrisma.content.findUnique.mockResolvedValue(null);
		const req = new NextRequest('http://localhost:3000/api/admin/content/missing', { method: 'DELETE' });
		const { status } = await parseResponse(await DELETE(req, { params: Promise.resolve({ id: 'missing' }) }));
		expect(status).toBe(404);
	});

	it('deletes content and file from disk', async () => {
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'c1',
			filename: 'test.pdf',
			storagePath: 'mock/path.pdf',
			previewPath: null,
		});
		const req = new NextRequest('http://localhost:3000/api/admin/content/c1', { method: 'DELETE' });
		const { status, body } = await parseResponse(await DELETE(req, { params: Promise.resolve({ id: 'c1' }) }));
		expect(status).toBe(200);
		expect(body?.success).toBe(true);
		expect(mockStorage.deleteFile).toHaveBeenCalledWith('mock/path.pdf');
		expect(mockPrisma.content.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
	});

	it('deletes preview file when deleting content with preview', async () => {
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'c2',
			filename: 'photo.jpg',
			storagePath: 'mock/photo.jpg',
			previewPath: 'mock/preview-photo.jpg',
		});
		const req = new NextRequest('http://localhost:3000/api/admin/content/c2', { method: 'DELETE' });
		const { status, body } = await parseResponse(await DELETE(req, { params: Promise.resolve({ id: 'c2' }) }));
		expect(status).toBe(200);
		expect(body?.success).toBe(true);
		expect(mockStorage.deleteFile).toHaveBeenCalledWith('mock/photo.jpg');
		expect(mockPreview.deletePreview).toHaveBeenCalledWith('mock/preview-photo.jpg');
	});
});
