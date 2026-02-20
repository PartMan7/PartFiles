import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/preview/[id]/route';
import { rateLimitMap, RATE_LIMIT_MAX_REQUESTS } from '@/app/api/preview/[id]/rate-limit';
import { mockPrisma, mockAdmin, mockUnauthenticated } from '../../setup';
import { NextRequest } from 'next/server';
import fs from 'fs/promises';

function previewRequest(id: string, ip?: string): NextRequest {
	const req = new NextRequest(new URL(`/api/preview/${id}`, 'http://localhost:3000'), {
		method: 'GET',
		headers: ip ? { 'x-forwarded-for': ip } : {},
	});
	return req;
}

describe('GET /api/preview/[id]', () => {
	beforeEach(() => {
		rateLimitMap.clear();
		mockAdmin();
	});

	it('allows unauthenticated requests', async () => {
		mockUnauthenticated();
		mockPrisma.content.findUnique.mockResolvedValue({
			previewPath: 'mock/preview.jpg',
			expiresAt: null,
			mimeType: 'image/jpeg',
		});
		const req = previewRequest('some-id');
		const res = await GET(req, { params: Promise.resolve({ id: 'some-id' }) });
		expect(res.status).toBe(200);
	});

	it('returns 404 for non-existent content', async () => {
		mockPrisma.content.findUnique.mockResolvedValue(null);
		const req = previewRequest('missing');
		const res = await GET(req, { params: Promise.resolve({ id: 'missing' }) });
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe('Content not found');
	});

	it('returns 410 for expired content', async () => {
		mockPrisma.content.findUnique.mockResolvedValue({
			previewPath: 'mock/preview.jpg',
			expiresAt: new Date(Date.now() - 3600000),
			mimeType: 'image/jpeg',
		});
		const req = previewRequest('expired-id');
		const res = await GET(req, { params: Promise.resolve({ id: 'expired-id' }) });
		expect(res.status).toBe(410);
		const body = await res.json();
		expect(body.error).toBe('Content has expired');
	});

	it('returns 404 when content has no preview', async () => {
		mockPrisma.content.findUnique.mockResolvedValue({
			previewPath: null,
			expiresAt: null,
			mimeType: 'application/pdf',
		});
		const req = previewRequest('no-preview-id');
		const res = await GET(req, { params: Promise.resolve({ id: 'no-preview-id' }) });
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe('No preview available');
	});

	it('returns the preview image with correct headers', async () => {
		const previewData = Buffer.from('fake-jpeg-data');
		mockPrisma.content.findUnique.mockResolvedValue({
			previewPath: 'mock/preview.jpg',
			expiresAt: null,
			mimeType: 'image/jpeg',
		});
		(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(previewData);

		const req = previewRequest('valid-id');
		const res = await GET(req, { params: Promise.resolve({ id: 'valid-id' }) });
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('image/jpeg');
		expect(res.headers.get('Cache-Control')).toContain('public');
		expect(res.headers.get('Cache-Control')).toContain('max-age=86400');
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(res.headers.get('X-Frame-Options')).toBe('DENY');
	});

	it('returns preview for non-expired content with future expiresAt', async () => {
		const previewData = Buffer.from('fake-jpeg-data');
		mockPrisma.content.findUnique.mockResolvedValue({
			previewPath: 'mock/preview.jpg',
			expiresAt: new Date(Date.now() + 3600000),
			mimeType: 'image/png',
		});
		(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(previewData);

		const req = previewRequest('future-expiry-id');
		const res = await GET(req, { params: Promise.resolve({ id: 'future-expiry-id' }) });
		expect(res.status).toBe(200);
	});

	it('returns 404 when preview file is missing from disk', async () => {
		mockPrisma.content.findUnique.mockResolvedValue({
			previewPath: 'mock/missing-preview.jpg',
			expiresAt: null,
			mimeType: 'image/jpeg',
		});
		(fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOENT'));

		const req = previewRequest('disk-missing-id');
		const res = await GET(req, { params: Promise.resolve({ id: 'disk-missing-id' }) });
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe('Preview file not found on disk');
	});

	describe('rate limiting', () => {
		it('allows requests under the limit', async () => {
			mockPrisma.content.findUnique.mockResolvedValue({
				previewPath: 'mock/preview.jpg',
				expiresAt: null,
				mimeType: 'image/jpeg',
			});
			(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('data'));

			// Make several requests from same IP - all should succeed
			for (let i = 0; i < 5; i++) {
				const req = previewRequest('id', '1.2.3.4');
				const res = await GET(req, { params: Promise.resolve({ id: 'id' }) });
				expect(res.status).toBe(200);
			}
		});

		it('returns 429 when rate limit is exceeded', async () => {
			// Pre-fill rate limit map to simulate exceeding limit
			rateLimitMap.set('5.6.7.8', {
				count: RATE_LIMIT_MAX_REQUESTS,
				resetAt: Date.now() + 60_000,
			});

			const req = previewRequest('id', '5.6.7.8');
			const res = await GET(req, { params: Promise.resolve({ id: 'id' }) });
			expect(res.status).toBe(429);
			const body = await res.json();
			expect(body.error).toBe('Too many requests');
		});

		it('tracks different IPs independently', async () => {
			mockPrisma.content.findUnique.mockResolvedValue({
				previewPath: 'mock/preview.jpg',
				expiresAt: null,
				mimeType: 'image/jpeg',
			});
			(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('data'));

			// IP 1 is rate limited
			rateLimitMap.set('10.0.0.1', {
				count: RATE_LIMIT_MAX_REQUESTS,
				resetAt: Date.now() + 60_000,
			});

			// IP 2 should still work
			const req = previewRequest('id', '10.0.0.2');
			const res = await GET(req, { params: Promise.resolve({ id: 'id' }) });
			expect(res.status).toBe(200);
		});

		it('resets rate limit after the window expires', async () => {
			// Set an expired rate limit
			rateLimitMap.set('9.9.9.9', {
				count: RATE_LIMIT_MAX_REQUESTS + 100,
				resetAt: Date.now() - 1000, // already expired
			});

			mockPrisma.content.findUnique.mockResolvedValue({
				previewPath: 'mock/preview.jpg',
				expiresAt: null,
				mimeType: 'image/jpeg',
			});
			(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('data'));

			const req = previewRequest('id', '9.9.9.9');
			const res = await GET(req, { params: Promise.resolve({ id: 'id' }) });
			expect(res.status).toBe(200);
		});
	});
});
