import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/storage';
import { deletePreview } from '@/lib/preview';
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.byteLength !== bufB.byteLength) return false;
	return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
	// Verify cron secret (timing-safe)
	const cronSecret = req.headers.get('x-cron-secret') || '';
	const expectedSecret = process.env.CRON_SECRET || '';

	if (!expectedSecret || !cronSecret || !safeCompare(cronSecret, expectedSecret)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const expired = await prisma.content.findMany({
			where: {
				expiresAt: { lt: new Date() },
			},
		});

		let deleted = 0;
		let errors = 0;

		for (const item of expired) {
			try {
				await deleteFile(item.storagePath);
				await deletePreview(item.previewPath);
				await prisma.content.delete({ where: { id: item.id } });
				deleted++;
			} catch (error) {
				console.error(`Failed to delete content ${item.id}:`, error);
				errors++;
			}
		}

		return NextResponse.json({
			success: true,
			found: expired.length,
			deleted,
			errors,
		});
	} catch (error) {
		console.error('Cleanup error:', error);
		return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
	}
}
