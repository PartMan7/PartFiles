import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/permissions';
import {
	sanitizeFilename,
	validateExtension,
	validateFileSize,
	validateStorageLimit,
	validateExpiry,
	validateShortSlug,
	checkSlugCollision,
	createContentWithStorageCheck,
	StorageLimitError,
} from '@/lib/validation';
import { saveFile, deleteFile } from '@/lib/storage';
import { generateAndSavePreview, deletePreview } from '@/lib/preview';
import { v4 as uuidv4 } from 'uuid';
import { lookup } from 'mime-types';
import { getBaseUrl } from '@/lib/config';
import { generateContentId } from '@/lib/id';

export async function POST(req: NextRequest) {
	const session = await auth();
	if (!session?.user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: userId, role } = session.user;

	if (!isAdmin(role)) {
		return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
	}

	let storagePath: string | null = null;
	let previewPath: string | null = null;

	try {
		const formData = await req.formData();
		const file = formData.get('file') as File | null;
		const customFilename = formData.get('filename') as string | null;
		const expiryOption = (formData.get('expiry') as string) || 'off';
		const directoryName = formData.get('directory') as string | null;
		const shortSlugInput = formData.get('shortSlug') as string | null;

		if (!file) {
			return NextResponse.json({ error: 'No file provided' }, { status: 400 });
		}

		// Validate file size
		const sizeResult = validateFileSize(file.size);
		if (!sizeResult.valid) {
			return NextResponse.json({ error: sizeResult.error }, { status: 400 });
		}

		// Validate extension
		const originalName = file.name || 'unnamed';
		const extResult = validateExtension(originalName);
		if (!extResult.valid) {
			return NextResponse.json({ error: extResult.error }, { status: 400 });
		}

		// Fast-fail storage check (non-atomic, prevents unnecessary disk writes)
		const storageResult = await validateStorageLimit(userId, role, file.size);
		if (!storageResult.valid) {
			return NextResponse.json({ error: storageResult.error }, { status: 400 });
		}

		// Validate expiry
		const expiryResult = validateExpiry(role, expiryOption);
		if (!expiryResult.valid) {
			return NextResponse.json({ error: expiryResult.error }, { status: 400 });
		}

		// Validate directory if specified
		let subDir: string | undefined;
		if (directoryName) {
			const allowedDir = await prisma.allowedDirectory.findUnique({
				where: { name: directoryName },
			});
			if (!allowedDir) {
				return NextResponse.json({ error: `Directory '${directoryName}' is not in the allowed list` }, { status: 400 });
			}
			subDir = allowedDir.path;
		}

		// Validate short slug if provided
		let validatedSlug: string | undefined;
		if (shortSlugInput) {
			const slugResult = validateShortSlug(shortSlugInput);
			if (!slugResult.valid) {
				return NextResponse.json({ error: slugResult.error }, { status: 400 });
			}
			const collision = await checkSlugCollision(slugResult.slug);
			if (collision.taken) {
				return NextResponse.json({ error: collision.error }, { status: 409 });
			}
			validatedSlug = slugResult.slug;
		}

		// Prepare filename
		const sanitized = sanitizeFilename(customFilename || originalName);
		const storedFilename = `${uuidv4()}-${sanitized}`;
		const mimeType = lookup(originalName) || 'application/octet-stream';

		// Generate short ID
		const contentId = await generateContentId();

		// Save file to disk first
		const buffer = Buffer.from(await file.arrayBuffer());
		storagePath = await saveFile(buffer, storedFilename, subDir);

		// Generate low-res preview for images (best-effort, non-blocking for upload success)
		previewPath = await generateAndSavePreview(buffer, mimeType, storedFilename, subDir);

		// Atomic: re-check storage limit + create DB record in a transaction
		const content = await createContentWithStorageCheck(userId, role, {
			id: contentId,
			filename: sanitized,
			originalFilename: originalName,
			storagePath,
			previewPath,
			directory: directoryName || null,
			fileSize: file.size,
			fileExtension: extResult.extension,
			mimeType,
			expiresAt: expiryResult.expiresAt,
			uploadedById: userId,
		});

		// Create short slug record if provided
		if (validatedSlug) {
			await prisma.shortSlug.create({
				data: { slug: validatedSlug, contentId: content.id },
			});
		}

		const base = getBaseUrl();

		return NextResponse.json({
			success: true,
			content: {
				id: content.id,
				filename: content.filename,
				directory: content.directory,
				shortSlugs: validatedSlug ? [validatedSlug] : [],
				size: content.fileSize,
				expiresAt: content.expiresAt,
				url: `${base}/c/${content.id}`,
				shortUrl: validatedSlug ? `${base}/s/${validatedSlug}` : null,
			},
		});
	} catch (error) {
		// Clean up files if they were saved but the DB transaction failed
		if (storagePath) {
			try {
				await deleteFile(storagePath);
			} catch {
				/* best-effort cleanup */
			}
		}
		await deletePreview(previewPath);

		if (error instanceof StorageLimitError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}

		console.error('Admin upload error:', error);
		return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
	}
}
