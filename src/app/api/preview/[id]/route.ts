import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFilePath } from '@/lib/storage';
import fs from 'fs/promises';
import { checkRateLimit } from './rate-limit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	// Rate limit by IP (defence-in-depth against authenticated DDoS)
	const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
	if (!checkRateLimit(ip)) {
		return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
	}

	const { id } = await params;

	const content = await prisma.content.findUnique({
		where: { id },
		select: { previewPath: true, expiresAt: true, mimeType: true },
	});

	if (!content) {
		return NextResponse.json({ error: 'Content not found' }, { status: 404 });
	}

	// Check if content has expired
	if (content.expiresAt && new Date(content.expiresAt) < new Date()) {
		return NextResponse.json({ error: 'Content has expired' }, { status: 410 });
	}

	// No preview available for this content
	if (!content.previewPath) {
		return NextResponse.json({ error: 'No preview available' }, { status: 404 });
	}

	try {
		const filePath = getFilePath(content.previewPath);
		const fileBuffer = await fs.readFile(filePath);

		return new NextResponse(fileBuffer, {
			headers: {
				'Content-Type': 'image/jpeg',
				'Content-Length': String(fileBuffer.byteLength),
				'X-Content-Type-Options': 'nosniff',
				'X-Frame-Options': 'DENY',
				'Content-Security-Policy': "default-src 'none'",
				// Allow caching for previews (they don't change) - reduces server load
				'Cache-Control': 'public, max-age=86400, immutable',
			},
		});
	} catch {
		return NextResponse.json({ error: 'Preview file not found on disk' }, { status: 404 });
	}
}
