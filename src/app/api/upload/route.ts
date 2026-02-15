import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canUpload } from '@/lib/permissions';
import {
	sanitizeFilename,
	validateExtension,
	validateFileSize,
	validateStorageLimit,
	validateExpiry,
	createContentWithStorageCheck,
	StorageLimitError,
} from '@/lib/validation';
import { saveFile, deleteFile } from '@/lib/storage';
import { generateAndSavePreview, deletePreview } from '@/lib/preview';
import { v4 as uuidv4 } from 'uuid';
import { lookup } from 'mime-types';
import { DEFAULT_EXPIRY_HOURS, getBaseUrl } from '@/lib/config';
import { generateContentId } from '@/lib/id';

export async function POST(req: NextRequest) {
	const session = await auth();
	if (!session?.user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: userId, role } = session.user;

	if (!canUpload(role)) {
		return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
	}

	let storagePath: string | null = null;
	let previewPath: string | null = null;

	try {
		const formData = await req.formData();
		const file = formData.get('file') as File | null;
		const customFilename = formData.get('filename') as string | null;
		const expiryOption = (formData.get('expiry') as string) || String(DEFAULT_EXPIRY_HOURS);

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

		// Prepare filename
		const sanitized = sanitizeFilename(customFilename || originalName);
		const storedFilename = `${uuidv4()}-${sanitized}`;
		const mimeType = lookup(originalName) || 'application/octet-stream';

		// Generate short ID
		const contentId = await generateContentId();

		// Save file to disk first
		const buffer = Buffer.from(await file.arrayBuffer());
		storagePath = await saveFile(buffer, storedFilename);

		// Generate low-res preview for images (best-effort)
		previewPath = await generateAndSavePreview(buffer, mimeType, storedFilename);

		// Atomic: re-check storage limit + create DB record in a transaction
		const content = await createContentWithStorageCheck(userId, role, {
			id: contentId,
			filename: sanitized,
			originalFilename: originalName,
			storagePath,
			previewPath,
			fileSize: file.size,
			fileExtension: extResult.extension,
			mimeType,
			expiresAt: expiryResult.expiresAt,
			uploadedById: userId,
		});

		const base = getBaseUrl();

		return NextResponse.json({
			success: true,
			content: {
				id: content.id,
				filename: content.filename,
				size: content.fileSize,
				expiresAt: content.expiresAt,
				url: `${base}/c/${content.id}`,
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

		console.error('Upload error:', error);
		return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
	}
}
