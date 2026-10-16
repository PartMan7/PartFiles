import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/permissions';
import { getBaseUrl } from '@/lib/url';
import { validateShortSlug, validateShortLinkUrl, checkLinkSlugCollision } from '@/lib/validation';

const linkSelect = {
	slug: true,
	destinationUrl: true,
	clickCount: true,
	lastClickedAt: true,
	revokedAt: true,
	createdAt: true,
	updatedAt: true,
	createdBy: { select: { username: true } },
} as const;

function formatLink(link: {
	slug: string;
	destinationUrl: string;
	clickCount: number;
	lastClickedAt: Date | null;
	revokedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	createdBy?: { username: string };
}) {
	return {
		...link,
		shortUrl: `${getBaseUrl()}/l/${link.slug}`,
		isRevoked: !!link.revokedAt,
		lastClickedAt: link.lastClickedAt?.toISOString() ?? null,
		revokedAt: link.revokedAt?.toISOString() ?? null,
		createdAt: link.createdAt.toISOString(),
		updatedAt: link.updatedAt.toISOString(),
	};
}

export async function GET() {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const links = await prisma.shortLink.findMany({
		orderBy: { createdAt: 'desc' },
		select: linkSelect,
	});

	return NextResponse.json({
		links: links.map(formatLink),
	});
}

export async function POST(req: NextRequest) {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const body = await req.json();
		const { slug: rawSlug, destinationUrl: rawUrl } = body;

		const slugResult = validateShortSlug(rawSlug);
		if (!slugResult.valid) {
			return NextResponse.json({ error: slugResult.error }, { status: 400 });
		}

		const urlResult = validateShortLinkUrl(rawUrl);
		if (!urlResult.valid) {
			return NextResponse.json({ error: urlResult.error }, { status: 400 });
		}

		const collision = await checkLinkSlugCollision(slugResult.slug);
		if (collision.taken) {
			return NextResponse.json({ error: collision.error }, { status: 409 });
		}

		const link = await prisma.shortLink.create({
			data: {
				slug: slugResult.slug,
				destinationUrl: urlResult.url,
				createdById: session.user.id,
			},
			select: linkSelect,
		});

		return NextResponse.json({ link: formatLink(link) });
	} catch (error) {
		console.error('Create short link error:', error);
		return NextResponse.json({ error: 'Failed to create short link' }, { status: 500 });
	}
}
