import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/permissions';
import { deleteFile } from '@/lib/storage';
import { deletePreview } from '@/lib/preview';
import { sanitizeFilename, validateShortSlug, checkSlugCollision } from '@/lib/validation';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const { id } = await params;

	const content = await prisma.content.findUnique({
		where: { id },
		include: {
			uploadedBy: { select: { id: true, username: true, role: true } },
			shortSlugs: { select: { slug: true } },
		},
	});

	if (!content) {
		return NextResponse.json({ error: 'Content not found' }, { status: 404 });
	}

	return NextResponse.json({ content });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const { id } = await params;

	try {
		const body = await req.json();
		const { filename, expiresAt, addSlugs, removeSlugs } = body;

		const existing = await prisma.content.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json({ error: 'Content not found' }, { status: 404 });
		}

		const updateData: Record<string, unknown> = {};
		if (filename !== undefined) updateData.filename = sanitizeFilename(filename);
		if (expiresAt !== undefined) {
			updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
		}

		// Update content fields
		const content = await prisma.content.update({
			where: { id },
			data: updateData,
		});

		// Add new slugs
		if (Array.isArray(addSlugs) && addSlugs.length > 0) {
			for (const rawSlug of addSlugs) {
				const slugResult = validateShortSlug(rawSlug);
				if (!slugResult.valid) {
					return NextResponse.json({ error: slugResult.error }, { status: 400 });
				}
				const collision = await checkSlugCollision(slugResult.slug, id);
				if (collision.taken) {
					return NextResponse.json({ error: collision.error }, { status: 409 });
				}
				await prisma.shortSlug.create({
					data: { slug: slugResult.slug, contentId: id },
				});
			}
		}

		// Remove slugs
		if (Array.isArray(removeSlugs) && removeSlugs.length > 0) {
			await prisma.shortSlug.deleteMany({
				where: {
					contentId: id,
					slug: { in: removeSlugs },
				},
			});
		}

		// Return updated content with slugs
		const updated = await prisma.content.findUnique({
			where: { id },
			include: { shortSlugs: { select: { slug: true } } },
		});

		return NextResponse.json({ content: updated });
	} catch (error) {
		console.error('Update content error:', error);
		return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
	}
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const { id } = await params;

	const content = await prisma.content.findUnique({ where: { id } });
	if (!content) {
		return NextResponse.json({ error: 'Content not found' }, { status: 404 });
	}

	// Delete file and preview from disk
	await deleteFile(content.storagePath);
	await deletePreview(content.previewPath);

	// Delete DB record (cascades to ShortSlug records)
	await prisma.content.delete({ where: { id } });

	return NextResponse.json({ success: true });
}
