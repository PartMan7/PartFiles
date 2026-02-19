import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFilePath } from '@/lib/storage';
import { sanitizeFilename } from '@/lib/validation';
import fs from 'fs/promises';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const content = await prisma.content.findUnique({ where: { id } });
	if (!content) {
		return NextResponse.json({ error: 'Content not found' }, { status: 404 });
	}

	// Check if content has expired
	if (content.expiresAt && new Date(content.expiresAt) < new Date()) {
		return NextResponse.json({ error: 'Content has expired' }, { status: 410 });
	}

	try {
		const filePath = getFilePath(content.storagePath);
		const fileBuffer = await fs.readFile(filePath);

		// SECURITY: Sanitize filename for Content-Disposition to prevent header injection
		const safeFilename = sanitizeFilename(content.filename).replace(/"/g, "'");

		return new NextResponse(fileBuffer, {
			headers: {
				'Content-Type': content.mimeType,
				'Content-Disposition': `attachment; filename="${safeFilename}"`,
				'Content-Length': String(content.fileSize),
				'X-Content-Type-Options': 'nosniff',
				'X-Frame-Options': 'DENY',
				'Content-Security-Policy': "default-src 'none'",
				'Cache-Control': 'private, no-cache',
			},
		});
	} catch {
		return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
	}
}
