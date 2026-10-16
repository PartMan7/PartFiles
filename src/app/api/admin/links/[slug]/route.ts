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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const { slug } = await params;
	const link = await prisma.shortLink.findUnique({
		where: { slug },
		select: linkSelect,
	});

	if (!link) {
		return NextResponse.json({ error: 'Link not found' }, { status: 404 });
	}

	return NextResponse.json({ link: formatLink(link) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const { slug: currentSlug } = await params;

	try {
		const existing = await prisma.shortLink.findUnique({ where: { slug: currentSlug } });
		if (!existing) {
			return NextResponse.json({ error: 'Link not found' }, { status: 404 });
		}

		const body = await req.json();
		const { slug: rawSlug, destinationUrl: rawUrl, revoked } = body;

		const updateData: { slug?: string; destinationUrl?: string; revokedAt?: Date | null } = {};

		if (rawSlug !== undefined) {
			const slugResult = validateShortSlug(rawSlug);
			if (!slugResult.valid) {
				return NextResponse.json({ error: slugResult.error }, { status: 400 });
			}
			if (slugResult.slug !== currentSlug) {
				const collision = await checkLinkSlugCollision(slugResult.slug, existing.id);
				if (collision.taken) {
					return NextResponse.json({ error: collision.error }, { status: 409 });
				}
				updateData.slug = slugResult.slug;
			}
		}

		if (rawUrl !== undefined) {
			const urlResult = validateShortLinkUrl(rawUrl);
			if (!urlResult.valid) {
				return NextResponse.json({ error: urlResult.error }, { status: 400 });
			}
			updateData.destinationUrl = urlResult.url;
		}

		if (revoked === true) {
			updateData.revokedAt = new Date();
		} else if (revoked === false) {
			updateData.revokedAt = null;
		}

		if (Object.keys(updateData).length === 0) {
			return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
		}

		const link = await prisma.shortLink.update({
			where: { id: existing.id },
			data: updateData,
			select: linkSelect,
		});

		return NextResponse.json({ link: formatLink(link) });
	} catch (error) {
		console.error('Update short link error:', error);
		return NextResponse.json({ error: 'Failed to update short link' }, { status: 500 });
	}
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const { slug } = await params;
	const existing = await prisma.shortLink.findUnique({ where: { slug } });
	if (!existing) {
		return NextResponse.json({ error: 'Link not found' }, { status: 404 });
	}

	await prisma.shortLink.delete({ where: { id: existing.id } });
	return NextResponse.json({ success: true });
}
