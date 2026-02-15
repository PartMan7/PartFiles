import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/content/route';
import { GET as GET_ID, PUT, DELETE } from '@/app/api/admin/content/[id]/route';
import { mockAdmin, mockUploader, mockUnauthenticated, mockPrisma, mockStorage, mockPreview } from '../../setup';
import { jsonRequest, parseResponse } from '../../helpers';
import { NextRequest } from 'next/server';

describe('GET /api/admin/content', () => {
	it('returns 403 for non-admin', async () => {
		mockUploader();
		const { status } = await parseResponse(await GET());
		expect(status).toBe(403);
	});

	it('returns 403 for unauthenticated', async () => {
		mockUnauthenticated();
		const { status } = await parseResponse(await GET());
		expect(status).toBe(403);
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

		const { status, body } = await parseResponse(await GET());
		expect(status).toBe(200);
		expect(body?.content).toHaveLength(1);
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
