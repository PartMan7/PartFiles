import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/admin/links/route';
import { DELETE, PUT } from '@/app/api/admin/links/[slug]/route';
import { GET as redirectGET } from '@/app/l/[slug]/route';
import { mockAdmin, mockUnauthenticated, mockPrisma } from '../../setup';
import { jsonRequest, parseResponse } from '../../helpers';

describe('GET /l/[slug]', () => {
	it('redirects to destination URL and records click', async () => {
		mockPrisma.shortLink.findUnique.mockResolvedValue({
			id: 'link-1',
			slug: 'qr',
			destinationUrl: 'https://example.com/landing',
			revokedAt: null,
		});
		const res = await redirectGET(new Request('http://localhost:3000/l/qr'), {
			params: Promise.resolve({ slug: 'qr' }),
		});
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe('https://example.com/landing');
		expect(mockPrisma.shortLink.update).toHaveBeenCalledWith({
			where: { id: 'link-1' },
			data: {
				clickCount: { increment: 1 },
				lastClickedAt: expect.any(Date),
			},
		});
	});

	it('returns 410 for revoked link', async () => {
		mockPrisma.shortLink.findUnique.mockResolvedValue({
			id: 'link-1',
			slug: 'qr',
			destinationUrl: 'https://example.com',
			revokedAt: new Date(),
		});
		const { status, body } = await parseResponse(
			await redirectGET(new Request('http://localhost:3000/l/qr'), {
				params: Promise.resolve({ slug: 'qr' }),
			})
		);
		expect(status).toBe(410);
		expect(body?.error).toContain('revoked');
		expect(mockPrisma.shortLink.update).not.toHaveBeenCalled();
	});

	it('returns 404 for unknown slug', async () => {
		mockPrisma.shortLink.findUnique.mockResolvedValue(null);
		const { status } = await parseResponse(
			await redirectGET(new Request('http://localhost:3000/l/missing'), {
				params: Promise.resolve({ slug: 'missing' }),
			})
		);
		expect(status).toBe(404);
	});
});

describe('POST /api/admin/links', () => {
	beforeEach(() => {
		mockAdmin();
		mockPrisma.shortLink.findUnique.mockResolvedValue(null);
		mockPrisma.shortSlug.findUnique.mockResolvedValue(null);
	});

	it('creates a short link', async () => {
		mockPrisma.shortLink.create.mockResolvedValue({
			slug: 'qr',
			destinationUrl: 'https://example.com/',
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		const { status, body } = await parseResponse(
			await POST(jsonRequest('/api/admin/links', 'POST', { slug: 'qr', destinationUrl: 'https://example.com' }))
		);
		expect(status).toBe(200);
		expect(body?.link).toMatchObject({
			slug: 'qr',
			shortUrl: 'http://localhost:3000/l/qr',
		});
	});

	it('rejects private destination URLs', async () => {
		const { status, body } = await parseResponse(
			await POST(jsonRequest('/api/admin/links', 'POST', { slug: 'bad', destinationUrl: 'http://127.0.0.1' }))
		);
		expect(status).toBe(400);
		expect(body?.error).toContain('Internal');
	});

	it('allows same slug as an existing file short URL', async () => {
		mockPrisma.shortSlug.findUnique.mockResolvedValue({ slug: 'qr', contentId: 'c1' });
		mockPrisma.shortLink.create.mockResolvedValue({
			slug: 'qr',
			destinationUrl: 'https://example.com/',
			clickCount: 0,
			lastClickedAt: null,
			revokedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			createdBy: { username: 'admin' },
		});
		const { status } = await parseResponse(
			await POST(jsonRequest('/api/admin/links', 'POST', { slug: 'qr', destinationUrl: 'https://example.com' }))
		);
		expect(status).toBe(200);
	});

	it('rejects unauthenticated', async () => {
		mockUnauthenticated();
		const { status } = await parseResponse(
			await POST(jsonRequest('/api/admin/links', 'POST', { slug: 'qr', destinationUrl: 'https://example.com' }))
		);
		expect(status).toBe(403);
	});
});

describe('DELETE /api/admin/links/[slug]', () => {
	beforeEach(() => {
		mockAdmin();
	});

	it('deletes an existing link', async () => {
		mockPrisma.shortLink.findUnique.mockResolvedValue({ id: 'link-1', slug: 'qr' });
		const { status } = await parseResponse(
			await DELETE(jsonRequest('/api/admin/links/qr', 'DELETE'), { params: Promise.resolve({ slug: 'qr' }) })
		);
		expect(status).toBe(200);
		expect(mockPrisma.shortLink.delete).toHaveBeenCalledWith({ where: { id: 'link-1' } });
	});
});

describe('PUT /api/admin/links/[slug]', () => {
	beforeEach(() => {
		mockAdmin();
		mockPrisma.shortLink.findUnique.mockResolvedValue({ id: 'link-1', slug: 'qr', destinationUrl: 'https://old.com' });
	});

	it('updates destination URL', async () => {
		mockPrisma.shortLink.update.mockResolvedValue({
			slug: 'qr',
			destinationUrl: 'https://new.com/',
			clickCount: 5,
			lastClickedAt: new Date(),
			revokedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			createdBy: { username: 'admin' },
		});
		const { status, body } = await parseResponse(
			await PUT(jsonRequest('/api/admin/links/qr', 'PUT', { destinationUrl: 'https://new.com' }), {
				params: Promise.resolve({ slug: 'qr' }),
			})
		);
		expect(status).toBe(200);
		expect(body?.link?.destinationUrl).toBe('https://new.com/');
	});

	it('revokes and reactivates a link', async () => {
		mockPrisma.shortLink.update.mockResolvedValue({
			slug: 'qr',
			destinationUrl: 'https://example.com/',
			clickCount: 0,
			lastClickedAt: null,
			revokedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
			createdBy: { username: 'admin' },
		});
		const revoke = await parseResponse(
			await PUT(jsonRequest('/api/admin/links/qr', 'PUT', { revoked: true }), {
				params: Promise.resolve({ slug: 'qr' }),
			})
		);
		expect(revoke.status).toBe(200);
		expect(revoke.body?.link?.isRevoked).toBe(true);

		mockPrisma.shortLink.update.mockResolvedValue({
			slug: 'qr',
			destinationUrl: 'https://example.com/',
			clickCount: 0,
			lastClickedAt: null,
			revokedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			createdBy: { username: 'admin' },
		});
		const reactivate = await parseResponse(
			await PUT(jsonRequest('/api/admin/links/qr', 'PUT', { revoked: false }), {
				params: Promise.resolve({ slug: 'qr' }),
			})
		);
		expect(reactivate.status).toBe(200);
		expect(reactivate.body?.link?.isRevoked).toBe(false);
	});
});

describe('GET /api/admin/links', () => {
	it('lists links for admin', async () => {
		mockAdmin();
		mockPrisma.shortLink.findMany.mockResolvedValue([
			{
				slug: 'qr',
				destinationUrl: 'https://example.com',
				clickCount: 12,
				lastClickedAt: new Date(),
				revokedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				createdBy: { username: 'admin' },
			},
		]);
		const { status, body } = await parseResponse(await GET());
		expect(status).toBe(200);
		expect(body?.links).toHaveLength(1);
		expect(body?.links[0]).toMatchObject({
			shortUrl: 'http://localhost:3000/l/qr',
			clickCount: 12,
			isRevoked: false,
		});
	});
});
