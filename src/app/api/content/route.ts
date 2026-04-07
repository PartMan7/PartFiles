import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/permissions';
import type { Prisma } from '@prisma/client';

/** Max repeated `uploadedBy` query params (multi-tag uploader filter). */
const MAX_UPLOADER_TAGS = 20;
/** Matches `username` max length in validation. */
const MAX_UPLOADER_TAG_LEN = 50;

export async function GET(request: NextRequest) {
	const session = await auth();
	if (!session?.user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const admin = isAdmin(session.user.role);
	const username = session.user.name?.trim();
	if (!username) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const expiredFilter = request.nextUrl.searchParams.get('expired');

	const rawUploaderTags = request.nextUrl.searchParams
		.getAll('uploadedBy')
		.map(s => s.trim())
		.filter(Boolean);
	if (rawUploaderTags.length > MAX_UPLOADER_TAGS) {
		return NextResponse.json({ error: 'Too many uploader filters' }, { status: 400 });
	}
	for (const t of rawUploaderTags) {
		if (t.length > MAX_UPLOADER_TAG_LEN) {
			return NextResponse.json({ error: 'Uploader filter value too long' }, { status: 400 });
		}
	}

	if (!admin) {
		if (rawUploaderTags.length === 0) {
			return NextResponse.json(
				{ error: 'Uploader filter is required: pass at least one uploadedBy query matching your username.' },
				{ status: 400 }
			);
		}
		const u = username.toLowerCase();
		for (const t of rawUploaderTags) {
			if (!u.includes(t.toLowerCase())) {
				return NextResponse.json({ error: 'Invalid uploader filter: value must match your username.' }, { status: 400 });
			}
		}
	}

	const uploaderTags = [...new Map(rawUploaderTags.map(t => [t.toLowerCase(), t])).values()];

	const and: Prisma.ContentWhereInput[] = [];

	if (!admin) {
		and.push({ uploadedById: session.user.id });
	}

	if (expiredFilter === 'active') {
		and.push({ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });
	} else if (expiredFilter === 'expired') {
		and.push({ expiresAt: { lte: new Date() } });
	}

	// SQLite: Prisma does not support `mode: 'insensitive'` on string filters here — resolve user IDs in app code.
	if (admin && uploaderTags.length > 0) {
		const users = await prisma.user.findMany({
			select: { id: true, username: true },
		});
		const lowerTags = uploaderTags.map(t => t.toLowerCase());
		const matchingIds = users.filter(u => lowerTags.some(tag => u.username.toLowerCase().includes(tag))).map(u => u.id);
		and.push({ uploadedById: { in: matchingIds } });
	}

	const where: Prisma.ContentWhereInput = and.length > 0 ? { AND: and } : {};

	const content = await prisma.content.findMany({
		where,
		select: {
			id: true,
			filename: true,
			originalFilename: true,
			directory: true,
			fileSize: true,
			fileExtension: true,
			mimeType: true,
			expiresAt: true,
			createdAt: true,
			previewPath: true, // used only to derive hasPreview below
			uploadedBy: {
				select: { id: true, username: true, role: true },
			},
			shortSlugs: {
				select: { slug: true },
			},
		},
		orderBy: { createdAt: 'desc' },
	});

	// SECURITY: Strip internal filesystem paths; expose only a boolean preview flag
	const safeContent = content.map(({ previewPath, ...rest }) => ({
		...rest,
		hasPreview: !!previewPath,
	}));

	return NextResponse.json({ content: safeContent });
}
