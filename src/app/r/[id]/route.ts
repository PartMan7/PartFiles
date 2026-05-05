import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFilePath } from '@/lib/storage';
import { sanitizeFilename } from '@/lib/validation';
import { isInlineSafeMime, mimeBaseType, sliceTextPreviewIfRequested } from '@/lib/content-mime';
import fs from 'fs/promises';

/**
 * GET /r/[id] — Serve the raw file for embedding / inline viewing.
 * Safe types are served inline; others fall back to attachment.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const textPreview = req.nextUrl.searchParams.get('textPreview') === '1';

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
		const body = sliceTextPreviewIfRequested(fileBuffer, content.mimeType, textPreview, content.fileExtension);

		const safeFilename = sanitizeFilename(content.filename).replace(/"/g, "'");
		const isInlineSafe = isInlineSafeMime(content.mimeType, content.fileExtension);

		const disposition = isInlineSafe ? `inline; filename="${safeFilename}"` : `attachment; filename="${safeFilename}"`;
		const csp = isInlineSafe
			? "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'"
			: "default-src 'none'";
		// Do not send HTML-oriented CSP on PDF: Chromium's iframe viewer treats it as a navigable
		// document and can fail with "refused to connect" when default-src blocks plugin internals.
		const isPdf = mimeBaseType(content.mimeType) === 'application/pdf';

		return new NextResponse(new Uint8Array(body), {
			headers: {
				'Content-Type': content.mimeType,
				'Content-Disposition': disposition,
				'Content-Length': String(body.length),
				'X-Content-Type-Options': 'nosniff',
				...(isPdf ? {} : { 'Content-Security-Policy': csp }),
				'Cache-Control': 'private, no-cache',
			},
		});
	} catch {
		return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
	}
}
