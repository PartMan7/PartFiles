import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serveContentFile } from '@/lib/file-serve';

/**
 * GET /r/[id] — Serve the raw file for embedding / inline viewing.
 * Safe types are served inline; others fall back to attachment.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const textPreview = req.nextUrl.searchParams.get('textPreview') === '1';

	const content = await prisma.content.findUnique({ where: { id } });
	if (!content) {
		return Response.json({ error: 'Content not found' }, { status: 404 });
	}

	if (content.expiresAt && new Date(content.expiresAt) < new Date()) {
		return Response.json({ error: 'Content has expired' }, { status: 410 });
	}

	return serveContentFile(
		{
			id: content.id,
			filename: content.filename,
			storagePath: content.storagePath,
			mimeType: content.mimeType,
			fileExtension: content.fileExtension,
			fileSize: content.fileSize,
			expiresAt: content.expiresAt,
		},
		{ req, textPreview }
	);
}
