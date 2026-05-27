import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/r/[id]/route';
import { mockAdmin, mockGuest, mockUnauthenticated, mockPrisma } from '../setup';
import { parseResponse } from '../helpers';
import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import { contentEtag } from '@/lib/file-serve';

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

	it('serves PDF inline for embedding without CSP (Chromium PDF iframes)', async () => {
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
		expect(res.headers.get('Content-Security-Policy')).toBeNull();
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

	it('with textPreview=1 truncates text/plain to first 100 KiB', async () => {
		mockGuest();
		const big = Buffer.alloc(120 * 1024, 97); // 'a'
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'abc123',
			filename: 'big.txt',
			storagePath: 'path/big.txt',
			expiresAt: null,
			mimeType: 'text/plain',
			fileSize: big.length,
		});
		(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(big);

		const req = new NextRequest('http://localhost:3000/r/abc123?textPreview=1');
		const res = await GET(req, { params: Promise.resolve({ id: 'abc123' }) });
		expect(res.status).toBe(200);
		const buf = Buffer.from(await res.arrayBuffer());
		expect(buf.length).toBe(100 * 1024);
		expect(res.headers.get('Content-Length')).toBe(String(100 * 1024));
	});

	it('serves video with Accept-Ranges and public cache when permanent', async () => {
		mockGuest();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'abc123',
			filename: 'clip.mp4',
			storagePath: 'path/clip.mp4',
			expiresAt: null,
			mimeType: 'video/mp4',
			fileExtension: '.mp4',
			fileSize: 17,
		});

		const res = await GET(makeReq(), { params: Promise.resolve({ id: 'abc123' }) });
		expect(res.status).toBe(200);
		expect(res.headers.get('Accept-Ranges')).toBe('bytes');
		expect(res.headers.get('Cache-Control')).toContain('public');
		expect(res.headers.get('ETag')).toBe(
			contentEtag({
				id: 'abc123',
				filename: 'clip.mp4',
				storagePath: 'path/clip.mp4',
				mimeType: 'video/mp4',
				fileSize: 17,
				expiresAt: null,
			})
		);
	});

	it('returns 206 for Range requests on video', async () => {
		mockGuest();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'abc123',
			filename: 'clip.mp4',
			storagePath: 'path/clip.mp4',
			expiresAt: null,
			mimeType: 'video/mp4',
			fileExtension: '.mp4',
			fileSize: 17,
		});

		const req = new NextRequest('http://localhost:3000/r/abc123', {
			headers: { Range: 'bytes=0-9' },
		});
		const res = await GET(req, { params: Promise.resolve({ id: 'abc123' }) });
		expect(res.status).toBe(206);
		expect(res.headers.get('Content-Range')).toBe('bytes 0-9/17');
		expect(res.headers.get('Content-Length')).toBe('10');
		const buf = Buffer.from(await res.arrayBuffer());
		expect(buf.length).toBe(10);
	});

	it('serves QuickTime (.mov) inline for embedding', async () => {
		mockGuest();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'abc123',
			filename: 'clip.mov',
			storagePath: 'path/clip.mov',
			expiresAt: null,
			mimeType: 'video/quicktime',
			fileExtension: '.mov',
			fileSize: 17,
		});

		const res = await GET(makeReq(), { params: Promise.resolve({ id: 'abc123' }) });
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('video/quicktime');
		expect(res.headers.get('Content-Disposition')).toContain('inline');
	});

	it('returns 304 when ETag matches', async () => {
		mockGuest();
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'abc123',
			filename: 'clip.mp4',
			storagePath: 'path/clip.mp4',
			expiresAt: null,
			mimeType: 'video/mp4',
			fileExtension: '.mp4',
			fileSize: 17,
		});
		const etag = contentEtag({
			id: 'abc123',
			filename: 'clip.mp4',
			storagePath: 'path/clip.mp4',
			mimeType: 'video/mp4',
			fileSize: 17,
			expiresAt: null,
		});
		const req = new NextRequest('http://localhost:3000/r/abc123', {
			headers: { 'If-None-Match': etag },
		});
		const res = await GET(req, { params: Promise.resolve({ id: 'abc123' }) });
		expect(res.status).toBe(304);
	});

	it('ignores textPreview=1 for non-text MIME types', async () => {
		mockGuest();
		(fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 17 });
		const jpegBody = Buffer.from('mock file content');
		(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(jpegBody);
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'abc123',
			filename: 'photo.jpg',
			storagePath: 'path/photo.jpg',
			expiresAt: null,
			mimeType: 'image/jpeg',
			fileSize: jpegBody.length,
		});

		const req = new NextRequest('http://localhost:3000/r/abc123?textPreview=1');
		const res = await GET(req, { params: Promise.resolve({ id: 'abc123' }) });
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Length')).toBe(String(jpegBody.length));
	});
});
