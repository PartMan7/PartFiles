import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFilePath } from '@/lib/storage';
import { sanitizeFilename } from '@/lib/validation';
import fs from 'fs/promises';
import { isInlineSafeMime } from '@/lib/content-mime';

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
		const isInlineSafe = isInlineSafeMime(content.mimeType, content.fileExtension);

		// Use inline disposition for safe types, attachment for everything else
		const disposition = isInlineSafe ? `inline; filename="${safeFilename}"` : `attachment; filename="${safeFilename}"`;

		// CSP: allow inline rendering of images/media but nothing else
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
