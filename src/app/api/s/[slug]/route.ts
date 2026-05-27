import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serveContentFile } from '@/lib/file-serve';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;

	const slugRecord = await prisma.shortSlug.findUnique({
		where: { slug },
		include: { content: true },
	});
	if (!slugRecord) {
		return Response.json({ error: 'Content not found' }, { status: 404 });
	}
	const content = slugRecord.content;

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
		{ req, frameDeny: true }
	);
}
