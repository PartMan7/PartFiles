import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/content/[id]/route';
import { mockAdmin, mockGuest, mockUnauthenticated, mockPrisma } from '../setup';
import { parseResponse } from '../helpers';
import { NextRequest } from 'next/server';

describe('GET /api/content/[id]', () => {
	const makeReq = () => new NextRequest('http://localhost:3000/api/content/c1');

	it('allows unauthenticated requests', async () => {
		mockUnauthenticated();

		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'c1',
			filename: 'photo.jpg',
			storagePath: 'path/photo.jpg',
			expiresAt: null,
			mimeType: 'image/jpeg',
			fileSize: 17,
		});
		const { status } = await parseResponse(await GET(makeReq(), { params: Promise.resolve({ id: 'c1' }) }));
		expect(status).toBe(200);
	});

	it('returns 404 for non-existent content', async () => {
		mockGuest();
		mockPrisma.content.findUnique.mockResolvedValue(null);
		const { status } = await parseResponse(await GET(makeReq(), { params: Promise.resolve({ id: 'missing' }) }));
		expect(status).toBe(404);
	});

	it('returns 410 for expired content', async () => {
		mockGuest();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'c1',
			filename: 'expired.pdf',
			storagePath: 'path/expired.pdf',
			expiresAt: new Date(Date.now() - 60000), // expired 1 minute ago
			mimeType: 'application/pdf',
			fileSize: 1024,
		});
		const { status, body } = await parseResponse(await GET(makeReq(), { params: Promise.resolve({ id: 'c1' }) }));
		expect(status).toBe(410);
		expect(body?.error).toBe('Content has expired');
	});

	it('serves file for valid non-expired content', async () => {
		mockGuest();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'c1',
			filename: 'report.pdf',
			storagePath: 'path/report.pdf',
			expiresAt: new Date(Date.now() + 3600000), // 1h in future
			mimeType: 'application/pdf',
			fileSize: 17,
		});

		const res = await GET(makeReq(), { params: Promise.resolve({ id: 'c1' }) });
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('application/pdf');
		expect(res.headers.get('Content-Disposition')).toContain('attachment');
		expect(res.headers.get('Content-Disposition')).toContain('report.pdf');
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(res.headers.get('X-Frame-Options')).toBe('DENY');
		expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'");
	});

	it('serves file with no expiry (permanent content)', async () => {
		mockAdmin();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'c2',
			filename: 'permanent.zip',
			storagePath: 'path/permanent.zip',
			expiresAt: null, // permanent
			mimeType: 'application/zip',
			fileSize: 17,
		});

		const res = await GET(makeReq(), { params: Promise.resolve({ id: 'c2' }) });
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('application/zip');
	});

	it('any authenticated role can access content by direct URL', async () => {
		mockGuest();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'c3',
			filename: 'image.jpg',
			storagePath: 'path/image.jpg',
			expiresAt: null,
			mimeType: 'image/jpeg',
			fileSize: 17,
		});

		const res = await GET(makeReq(), { params: Promise.resolve({ id: 'c3' }) });
		expect(res.status).toBe(200);
	});
});
