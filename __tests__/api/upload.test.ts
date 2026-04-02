import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/upload/route';
import { GET as GET_UPLOAD_QUOTA } from '@/app/api/upload/quota/route';
import { mockAdmin, mockUploader, mockGuest, mockUnauthenticated, mockPrisma } from '../setup';
import { uploadRequest, uploadRequestMulti, parseResponse } from '../helpers';
import { mockId } from '../setup';

describe('POST /api/upload', () => {
	const validFile = { name: 'photo.jpg', content: 'fake-image-data', type: 'image/jpeg' };

	describe('authentication & authorization', () => {
		it('returns 401 when unauthenticated', async () => {
			mockUnauthenticated();
			const req = uploadRequest('/api/upload', { expiry: '1' }, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(401);
			expect(body?.error).toBe('Unauthorized');
		});

		it('allows guest role with limited quota', async () => {
			mockGuest();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			const req = uploadRequest('/api/upload', { expiry: '1' }, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			expect(body?.success).toBe(true);
		});

		it('allows uploader role', async () => {
			mockUploader();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			const req = uploadRequest('/api/upload', { expiry: '1' }, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			expect(body?.success).toBe(true);
		});

		it('allows admin role', async () => {
			mockAdmin();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			const req = uploadRequest('/api/upload', { expiry: '1' }, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			expect(body?.success).toBe(true);
		});
	});

	describe('file validation', () => {
		beforeEach(() => mockUploader());

		it('rejects guest uploads over 10MB per file', async () => {
			mockGuest();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			const big = {
				name: 'big.jpg',
				content: 'x'.repeat(11 * 1024 * 1024),
				type: 'image/jpeg',
			};
			const req = uploadRequest('/api/upload', { expiry: '1' }, big);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(400);
			expect(body?.error).toContain('10MB');
		});

		it('returns 400 when no file is provided', async () => {
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			const req = uploadRequest('/api/upload', { expiry: '1' });
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(400);
			expect(body?.error).toBe('No file provided');
		});

		it('rejects blocked file extension', async () => {
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			const req = uploadRequest(
				'/api/upload',
				{ expiry: '1' },
				{
					name: 'script.js',
					content: 'alert(1)',
					type: 'text/javascript',
				}
			);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(400);
			expect(body?.error).toContain('blocked');
		});

		it('rejects unknown file extension', async () => {
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			const req = uploadRequest(
				'/api/upload',
				{ expiry: '1' },
				{
					name: 'data.xyz',
					content: 'data',
				}
			);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(400);
			expect(body?.error).toContain('not allowed');
		});
	});

	describe('expiry validation', () => {
		beforeEach(() => {
			mockUploader();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
		});

		it('uploader cannot set expiry to off', async () => {
			const req = uploadRequest('/api/upload', { expiry: 'off' }, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(400);
			expect(body?.error).toContain('Only admins');
		});

		it('uploader cannot exceed 7-day expiry', async () => {
			const req = uploadRequest('/api/upload', { expiry: '200' }, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(400);
			expect(body?.error).toContain('7 days');
		});

		it('defaults to 1h expiry when not specified', async () => {
			const req = uploadRequest('/api/upload', {}, validFile);
			const { status } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			// The content should have been created with an expiresAt ~1h in the future
			expect(mockPrisma.content.create).toHaveBeenCalledTimes(1);
			const callData = mockPrisma.content.create.mock.calls[0][0].data;
			expect(callData.expiresAt).toBeInstanceOf(Date);
		});

		it('admin can set expiry to off', async () => {
			mockAdmin();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			const req = uploadRequest('/api/upload', { expiry: 'off' }, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			expect(body?.success).toBe(true);
		});
	});

	describe('storage limit', () => {
		it('rejects upload when storage limit exceeded', async () => {
			mockUploader();
			// Simulate 499MB already used, uploading a 2MB file (exceeds 500MB limit)
			mockPrisma.content.aggregate.mockResolvedValue({
				_sum: { fileSize: 499 * 1024 * 1024 },
				_count: 10,
			});
			const largeFile = {
				name: 'big.pdf',
				content: 'x'.repeat(2 * 1024 * 1024),
				type: 'application/pdf',
			};
			const req = uploadRequest('/api/upload', { expiry: '1' }, largeFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(400);
			expect(body?.error).toContain('Storage limit exceeded');
		});

		it('rejects a multi-file batch when combined size would exceed the limit (before any write)', async () => {
			mockUploader();
			mockPrisma.content.aggregate.mockResolvedValue({
				_sum: { fileSize: 499 * 1024 * 1024 },
				_count: 10,
			});
			mockPrisma.content.create.mockClear();
			const oneMb = 'x'.repeat(1024 * 1024);
			const req = uploadRequestMulti('/api/upload', { expiry: '1' }, [
				{ name: 'a.jpg', content: oneMb, type: 'image/jpeg' },
				{ name: 'b.jpg', content: oneMb, type: 'image/jpeg' },
			]);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(400);
			expect(body?.error).toContain('Storage limit exceeded');
			expect(mockPrisma.content.create).not.toHaveBeenCalled();
		});

		it('accepts a multi-file batch when combined size fits within the limit', async () => {
			mockUploader();
			mockPrisma.content.aggregate.mockResolvedValue({
				_sum: { fileSize: 498 * 1024 * 1024 },
				_count: 5,
			});
			mockId.generateContentId.mockResolvedValueOnce('aaaaaaaa').mockResolvedValueOnce('bbbbbbbb');
			const oneMb = 'x'.repeat(1024 * 1024);
			const req = uploadRequestMulti('/api/upload', { expiry: '1' }, [
				{ name: 'a.jpg', content: oneMb, type: 'image/jpeg' },
				{ name: 'b.jpg', content: oneMb, type: 'image/jpeg' },
			]);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			expect(body?.success).toBe(true);
			expect(mockPrisma.content.create).toHaveBeenCalledTimes(2);
		});
	});

	describe('successful upload', () => {
		it('creates content record and returns URL', async () => {
			mockUploader();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			const req = uploadRequest('/api/upload', { expiry: '24' }, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			expect(body?.success).toBe(true);
			const content = body?.content as Record<string, unknown>;
			expect(content.id).toBeDefined();
			expect(content.url).toMatch(/\/c\//);
			expect(content.rawUrl).toMatch(/\/r\/[^/]+$/);
			expect(content.filename).toBeDefined();
		});

		it('accepts multiple files and returns contents array', async () => {
			mockUploader();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			mockId.generateContentId.mockResolvedValueOnce('aaaaaaaa').mockResolvedValueOnce('bbbbbbbb');
			const req = uploadRequestMulti('/api/upload', { expiry: '1' }, [
				validFile,
				{ name: 'b.png', content: 'fake-png', type: 'image/png' },
			]);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			expect(body?.success).toBe(true);
			const contents = body?.contents as Record<string, unknown>[];
			expect(Array.isArray(contents)).toBe(true);
			expect(contents).toHaveLength(2);
			expect(contents[0].rawUrl).toMatch(/\/r\/aaaaaaaa$/);
			expect(contents[1].rawUrl).toMatch(/\/r\/bbbbbbbb$/);
			expect(mockPrisma.content.create).toHaveBeenCalledTimes(2);
		});

		it('uses short generated ID from generateContentId', async () => {
			mockUploader();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			const req = uploadRequest('/api/upload', { expiry: '1' }, validFile);
			const { status, body } = await parseResponse(await POST(req));
			expect(status).toBe(200);
			const content = body?.content as Record<string, unknown>;
			// The mock returns 'ab12cd34' — verify it's used in the id and URL
			expect(content.id).toBe('ab12cd34');
			expect(content.url).toContain('/c/ab12cd34');
		});

		it('passes generated ID to content.create', async () => {
			mockUploader();
			mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
			const req = uploadRequest('/api/upload', { expiry: '1' }, validFile);
			await POST(req);
			const callData = mockPrisma.content.create.mock.calls[0][0].data;
			expect(callData.id).toBe('ab12cd34');
		});
	});
});

describe('GET /api/upload/quota', () => {
	it('returns 401 when unauthenticated', async () => {
		mockUnauthenticated();
		const res = await GET_UPLOAD_QUOTA();
		expect(res.status).toBe(401);
	});

	it('returns quota fields for guest (10MB caps)', async () => {
		mockGuest();
		mockPrisma.content.aggregate.mockResolvedValue({
			_sum: { fileSize: 2 * 1024 * 1024 },
			_count: 2,
		});
		const res = await GET_UPLOAD_QUOTA();
		const body = (await res.json()) as Record<string, unknown>;
		expect(res.status).toBe(200);
		expect(body.usedBytes).toBe(2 * 1024 * 1024);
		expect(body.limitBytes).toBe(10 * 1024 * 1024);
		expect(body.remainingBytes).toBe(8 * 1024 * 1024);
		expect(body.maxFileSizeBytes).toBe(10 * 1024 * 1024);
	});

	it('returns quota fields for uploader', async () => {
		mockUploader();
		mockPrisma.content.aggregate.mockResolvedValue({
			_sum: { fileSize: 10 * 1024 * 1024 },
			_count: 3,
		});
		const res = await GET_UPLOAD_QUOTA();
		const body = (await res.json()) as Record<string, unknown>;
		expect(res.status).toBe(200);
		expect(body.usedBytes).toBe(10 * 1024 * 1024);
		expect(body.limitBytes).toBe(500 * 1024 * 1024);
		expect(body.remainingBytes).toBe(490 * 1024 * 1024);
		expect(body.maxFileSizeBytes).toBe(100 * 1024 * 1024);
	});
});
