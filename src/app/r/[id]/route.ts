import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFilePath } from '@/lib/storage';
import { sanitizeFilename } from '@/lib/validation';
import fs from 'fs/promises';

/**
 * MIME types that are safe to render inline in the browser.
 * Everything else falls back to attachment (download).
 */
const INLINE_SAFE_TYPES = new Set([
	// Images
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/avif',
	'image/bmp',
	'image/tiff',
	// Video
	'video/mp4',
	'video/webm',
	'video/ogg',
	// Audio
	'audio/mpeg',
	'audio/ogg',
	'audio/wav',
	'audio/webm',
	// Documents
	'application/pdf',
	// Text
	'text/plain',
	'text/csv',
]);

/**
 * GET /r/[id] — Serve the raw file for embedding / inline viewing.
 * Safe types are served inline; others fall back to attachment.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const content = await prisma.content.findUnique({ where: { id } });
	if (!content) {
		return NextResponse.json({ error: 'Content not found' }, { status: 404 });
	}

	if (content.expiresAt && new Date(content.expiresAt) < new Date()) {
		return NextResponse.json({ error: 'Content has expired' }, { status: 410 });
	}

	try {
		const filePath = getFilePath(content.storagePath);
		const fileBuffer = await fs.readFile(filePath);

		const safeFilename = sanitizeFilename(content.filename).replace(/"/g, "'");
		const isInlineSafe = INLINE_SAFE_TYPES.has(content.mimeType);

		const disposition = isInlineSafe ? `inline; filename="${safeFilename}"` : `attachment; filename="${safeFilename}"`;
		const csp = isInlineSafe
			? "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'"
			: "default-src 'none'";

		return new NextResponse(fileBuffer, {
			headers: {
				'Content-Type': content.mimeType,
				'Content-Disposition': disposition,
				'Content-Length': String(content.fileSize),
				'X-Content-Type-Options': 'nosniff',
				'Content-Security-Policy': csp,
				'Cache-Control': 'private, no-cache',
			},
		});
	} catch {
		return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
	}
}
