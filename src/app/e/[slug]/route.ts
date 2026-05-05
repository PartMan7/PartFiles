import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFilePath } from '@/lib/storage';
import { sanitizeFilename } from '@/lib/validation';
import { isInlineSafeMime, mimeBaseType, sliceTextPreviewIfRequested } from '@/lib/content-mime';
import fs from 'fs/promises';

/**
 * GET /e/[slug] — Serve the raw file for a short slug (embed endpoint).
 * Works like /r/[id] but resolves a short slug first.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const textPreview = req.nextUrl.searchParams.get('textPreview') === '1';

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
		const body = sliceTextPreviewIfRequested(fileBuffer, content.mimeType, textPreview, content.fileExtension);

		const safeFilename = sanitizeFilename(content.filename).replace(/"/g, "'");
		const isInlineSafe = isInlineSafeMime(content.mimeType, content.fileExtension);

		const disposition = isInlineSafe ? `inline; filename="${safeFilename}"` : `attachment; filename="${safeFilename}"`;
		const csp = isInlineSafe
			? "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'"
			: "default-src 'none'";
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
