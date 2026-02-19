import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFilePath } from '@/lib/storage';
import { sanitizeFilename } from '@/lib/validation';
import fs from 'fs/promises';

/**
 * MIME types safe to serve inline (mirrors the raw route allowlist).
 */
const INLINE_SAFE_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/avif',
	'image/bmp',
	'image/tiff',
	'video/mp4',
	'video/webm',
	'video/ogg',
	'audio/mpeg',
	'audio/ogg',
	'audio/wav',
	'audio/webm',
	'application/pdf',
	'text/plain',
	'text/csv',
]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;

	const slugRecord = await prisma.shortSlug.findUnique({
		where: { slug },
		include: { content: true },
	});
	if (!slugRecord) {
		return NextResponse.json({ error: 'Content not found' }, { status: 404 });
	}
	const content = slugRecord.content;

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
				'X-Frame-Options': 'DENY',
				'Content-Security-Policy': csp,
				'Cache-Control': 'private, no-cache',
			},
		});
	} catch {
		return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
	}
}
