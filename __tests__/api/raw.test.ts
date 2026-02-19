import { describe, it, expect } from 'vitest';
import { GET } from '@/app/r/[id]/route';
import { mockAdmin, mockGuest, mockUnauthenticated, mockPrisma } from '../setup';
import { parseResponse } from '../helpers';
import { NextRequest } from 'next/server';

describe('GET /r/[id] (raw file)', () => {
	const makeReq = () => new NextRequest('http://localhost:3000/r/abc123');

	it('allows unauthenticated requests', async () => {
		mockUnauthenticated();

		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'abc123',
			filename: 'photo.jpg',
			storagePath: 'path/photo.jpg',
			expiresAt: null,
			mimeType: 'image/jpeg',
			fileSize: 17,
		});
		const { status } = await parseResponse(await GET(makeReq(), { params: Promise.resolve({ id: 'abc123' }) }));
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
			id: 'abc123',
			filename: 'old.pdf',
			storagePath: 'path/old.pdf',
			expiresAt: new Date(Date.now() - 60000),
			mimeType: 'application/pdf',
			fileSize: 1024,
		});
		const { status, body } = await parseResponse(await GET(makeReq(), { params: Promise.resolve({ id: 'abc123' }) }));
		expect(status).toBe(410);
		expect(body?.error).toBe('Content has expired');
	});

	it('serves inline-safe types with inline disposition', async () => {
		mockGuest();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'abc123',
			filename: 'photo.jpg',
			storagePath: 'path/photo.jpg',
			expiresAt: null,
			mimeType: 'image/jpeg',
			fileSize: 17,
		});

		const res = await GET(makeReq(), { params: Promise.resolve({ id: 'abc123' }) });
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('image/jpeg');
		expect(res.headers.get('Content-Disposition')).toContain('inline');
		expect(res.headers.get('Content-Disposition')).toContain('photo.jpg');
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
		// Should NOT have X-Frame-Options: DENY (needed for embedding in viewer)
		expect(res.headers.get('X-Frame-Options')).toBeNull();
		expect(res.headers.get('Content-Security-Policy')).toContain('img-src');
	});

	it('serves non-inline types with attachment disposition', async () => {
		mockGuest();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'abc123',
			filename: 'archive.zip',
			storagePath: 'path/archive.zip',
			expiresAt: null,
			mimeType: 'application/zip',
			fileSize: 17,
		});

		const res = await GET(makeReq(), { params: Promise.resolve({ id: 'abc123' }) });
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('application/zip');
		expect(res.headers.get('Content-Disposition')).toContain('attachment');
		expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'");
	});

	it('serves PDF inline for embedding', async () => {
		mockAdmin();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'abc123',
			filename: 'doc.pdf',
			storagePath: 'path/doc.pdf',
			expiresAt: null,
			mimeType: 'application/pdf',
			fileSize: 17,
		});

		const res = await GET(makeReq(), { params: Promise.resolve({ id: 'abc123' }) });
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Disposition')).toContain('inline');
	});

	it('serves permanent content (no expiresAt)', async () => {
		mockAdmin();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'abc123',
			filename: 'forever.png',
			storagePath: 'path/forever.png',
			expiresAt: null,
			mimeType: 'image/png',
			fileSize: 17,
		});

		const res = await GET(makeReq(), { params: Promise.resolve({ id: 'abc123' }) });
		expect(res.status).toBe(200);
	});
});
