import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;

	const link = await prisma.shortLink.findUnique({ where: { slug } });
	if (!link) {
		return NextResponse.json({ error: 'Link not found' }, { status: 404 });
	}

	if (link.revokedAt) {
		return NextResponse.json({ error: 'Link has been revoked' }, { status: 410 });
	}

	await prisma.shortLink.update({
		where: { id: link.id },
		data: {
			clickCount: { increment: 1 },
			lastClickedAt: new Date(),
		},
	});

	return NextResponse.redirect(link.destinationUrl, 302);
}
