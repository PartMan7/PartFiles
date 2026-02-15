import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/upload/route';
import { mockAdmin, mockUploader, mockGuest, mockUnauthenticated, mockPrisma, mockPreview } from '../../setup';
import { uploadRequest, parseResponse } from '../../helpers';

describe('POST /api/admin/upload', () => {
	const validFile = { name: 'report.pdf', content: 'fake-pdf-data', type: 'application/pdf' };

	describe('authentication & authorization', () => {
		it('returns 401 when unauthenticated', async () => {
			mockUnauthenticated();
			const req = uploadRequest('/api/admin/upload', {}, validFile);
			const { status } = await parseResponse(await POST(req));
			expect(status).toBe(401);
		});

		it('returns 403 for guest role', async () => {
			mockGuest();
			const req = uploadRequest('/api/admin/upload', {}, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(403);
			expect(body?.error).toContain('admin only');
		});

		it('returns 403 for uploader role', async () => {
			mockUploader();
			const req = uploadRequest('/api/admin/upload', {}, validFile);
			const { status } = await parseResponse(await POST(req));
			expect(status).toBe(403);
		});

		it('allows admin role', async () => {
			mockAdmin();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			const req = uploadRequest('/api/admin/upload', {}, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			expect(body?.success).toBe(true);
		});
	});

	describe('expiry defaults', () => {
		beforeEach(() => {
			mockAdmin();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
		});

		it('defaults to no expiry (off) when not specified', async () => {
			const req = uploadRequest('/api/admin/upload', {}, validFile);
			const { status } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			const callData = mockPrisma.content.create.mock.calls[0][0].data;
			expect(callData.expiresAt).toBeNull();
		});

		it('can set explicit expiry', async () => {
			const req = uploadRequest('/api/admin/upload', { expiry: '24' }, validFile);
			const { status } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			const callData = mockPrisma.content.create.mock.calls[0][0].data;
			expect(callData.expiresAt).toBeInstanceOf(Date);
		});
	});

	describe('short ID and URL format', () => {
		beforeEach(() => {
			mockAdmin();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
		});

		it('uses short generated ID in response', async () => {
			const req = uploadRequest('/api/admin/upload', {}, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			const content = body?.content as Record<string, unknown>;
			expect(content.id).toBe('ab12cd34');
			expect(content.url).toContain('/c/ab12cd34');
		});

		it('passes generated ID to content.create', async () => {
			const req = uploadRequest('/api/admin/upload', {}, validFile);
			await POST(req);
			const callData = mockPrisma.content.create.mock.calls[0][0].data;
			expect(callData.id).toBe('ab12cd34');
		});

		it('returns full base URL in url and shortUrl', async () => {
			mockPrisma.shortSlug.findUnique.mockResolvedValue(null);
			const req = uploadRequest('/api/admin/upload', { shortSlug: 'my-link' }, validFile);
			const { body } = await parseResponse(await POST(req));
			const content = body?.content as Record<string, unknown>;
			expect(content.url).toMatch(/^https?:\/\//);
			expect(content.shortUrl).toMatch(/^https?:\/\//);
			expect(content.shortUrl).toContain('/s/my-link');
		});
	});

	describe('preview generation', () => {
		beforeEach(() => {
			mockAdmin();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
		});

		it('generates preview for image uploads', async () => {
			const imageFile = { name: 'photo.jpg', content: 'fake-image-data', type: 'image/jpeg' };
			const req = uploadRequest('/api/admin/upload', {}, imageFile);
			const { status } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			expect(mockPreview.generateAndSavePreview).toHaveBeenCalledTimes(1);
			const callData = mockPrisma.content.create.mock.calls[0][0].data;
			expect(callData.previewPath).toBe('mock/storage/preview-path.jpg');
		});

		it('stores null previewPath for non-image uploads', async () => {
			mockPreview.generateAndSavePreview.mockResolvedValue(null);
			const pdfFile = { name: 'doc.pdf', content: 'fake-pdf-data', type: 'application/pdf' };
			const req = uploadRequest('/api/admin/upload', {}, pdfFile);
			const { status } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			const callData = mockPrisma.content.create.mock.calls[0][0].data;
			expect(callData.previewPath).toBeNull();
		});

		it('continues upload even if preview generation fails', async () => {
			mockPreview.generateAndSavePreview.mockResolvedValue(null);
			const imageFile = { name: 'corrupt.jpg', content: 'corrupt-data', type: 'image/jpeg' };
			const req = uploadRequest('/api/admin/upload', {}, imageFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			expect(body?.success).toBe(true);
		});
	});

	describe('directory selection', () => {
		beforeEach(() => {
			mockAdmin();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
		});

		it('rejects unknown directory', async () => {
			mockPrisma.allowedDirectory.findUnique.mockResolvedValue(null);
			const req = uploadRequest('/api/admin/upload', { directory: 'secret' }, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(400);
			expect(body?.error).toContain('not in the allowed list');
		});

		it('accepts a valid directory from database', async () => {
			mockPrisma.allowedDirectory.findUnique.mockResolvedValue({
				id: 'dir-1',
				name: 'Images',
				path: 'images',
			});
			const req = uploadRequest('/api/admin/upload', { directory: 'Images' }, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			expect(body?.success).toBe(true);
			const callData = mockPrisma.content.create.mock.calls[0][0].data;
			expect(callData.directory).toBe('Images');
		});

		it('passes without directory (root)', async () => {
			const req = uploadRequest('/api/admin/upload', {}, validFile);
			const { status } = await parseResponse(await POST(req));
			expect(status).toBe(200);
		});
	});
});
