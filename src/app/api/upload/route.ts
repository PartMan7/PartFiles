import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canUpload } from '@/lib/permissions';
import {
	sanitizeFilename,
	validateExtension,
	validateFileSize,
	validateStorageLimit,
	validateUploadBatchBeforeWrite,
	validateExpiry,
	createContentWithStorageCheck,
	StorageLimitError,
} from '@/lib/validation';
import { saveFile, deleteFile } from '@/lib/storage';
import { generateAndSavePreview, deletePreview, getImageDimensions, isPreviewable } from '@/lib/preview';
import { v4 as uuidv4 } from 'uuid';
import { lookup } from 'mime-types';
import { DEFAULT_EXPIRY_HOURS, maxUploadFileSizeBytesForRole } from '@/lib/config';
import { getContentUrl, getRawFilePublicUrl } from '@/lib/url';

import { generateContentId } from '@/lib/id';

type UploadContentPayload = {
	id: string;
	filename: string;
	size: number;
	expiresAt: Date | null;
	url: string;
	rawUrl: string;
};

async function processOneUpload(
	userId: string,
	role: string,
	file: File,
	expiresAt: Date | null,
	customFilename: string | null,
	contentBase: string
): Promise<UploadContentPayload> {
	let storagePath: string | null = null;
	let previewPath: string | null = null;

	try {
		const sizeResult = validateFileSize(file.size, maxUploadFileSizeBytesForRole(role));
		if (!sizeResult.valid) {
			throw new Error(sizeResult.error || 'Invalid file size');
		}

		const originalName = file.name || 'unnamed';
		const extResult = validateExtension(originalName);
		if (!extResult.valid) {
			throw new Error(extResult.error || 'Invalid extension');
		}

		const storageResult = await validateStorageLimit(userId, role, file.size);
		if (!storageResult.valid) {
			throw new Error(storageResult.error || 'Storage limit exceeded');
		}

		const sanitized = sanitizeFilename(customFilename || originalName);
		const storedFilename = `${uuidv4()}-${sanitized}`;
		const mimeType = lookup(originalName) || 'application/octet-stream';

		const contentId = await generateContentId();

		const buffer = Buffer.from(await file.arrayBuffer());
		storagePath = await saveFile(buffer, storedFilename);

		previewPath = await generateAndSavePreview(buffer, mimeType, storedFilename);

		let imageWidth: number | null = null;
		let imageHeight: number | null = null;
		if (isPreviewable(mimeType)) {
			const dims = await getImageDimensions(buffer);
			if (dims) {
				imageWidth = dims.width;
				imageHeight = dims.height;
			}
		}

		const content = await createContentWithStorageCheck(userId, role, {
			id: contentId,
			filename: sanitized,
			originalFilename: originalName,
			storagePath,
			previewPath,
			fileSize: file.size,
			fileExtension: extResult.extension,
			mimeType,
			imageWidth,
			imageHeight,
			expiresAt,
			uploadedById: userId,
		});

		return {
			id: content.id,
			filename: content.filename,
			size: content.fileSize,
			expiresAt: content.expiresAt,
			url: `${contentBase}/c/${content.id}`,
			rawUrl: getRawFilePublicUrl(content.id),
		};
	} catch (error) {
		if (storagePath) {
			try {
				await deleteFile(storagePath);
			} catch {
				/* best-effort cleanup */
			}
		}
		await deletePreview(previewPath);
		throw error;
	}
}

export async function POST(req: NextRequest) {
	const session = await auth();
	if (!session?.user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: userId, role } = session.user;

	if (!canUpload(role)) {
		return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
	}

	try {
		const formData = await req.formData();
		const singleFile = formData.get('file') as File | null;
		const multiRaw = formData.getAll('files');
		const multiFiles = multiRaw.filter((f): f is File => f instanceof File && f.size > 0);

		let files: File[] = [];
		if (multiFiles.length > 0) {
			files = multiFiles;
		} else if (singleFile && singleFile.size > 0) {
			files = [singleFile];
		}

		if (files.length === 0) {
			return NextResponse.json({ error: 'No file provided' }, { status: 400 });
		}

		const customFilename = (formData.get('filename') as string | null)?.trim() || null;
		const expiryOption = (formData.get('expiry') as string) || String(DEFAULT_EXPIRY_HOURS);

		const expiryResult = validateExpiry(role, expiryOption);
		if (!expiryResult.valid) {
			return NextResponse.json({ error: expiryResult.error }, { status: 400 });
		}

		const batchResult = await validateUploadBatchBeforeWrite(userId, role, files);
		if (!batchResult.ok) {
			return NextResponse.json({ error: batchResult.error }, { status: 400 });
		}

		const contentBase = getContentUrl();
		const results: UploadContentPayload[] = [];

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const perName = files.length === 1 && customFilename ? customFilename : null;
			const payload = await processOneUpload(userId, role, file, expiryResult.expiresAt, perName, contentBase);
			results.push(payload);
		}

		if (results.length === 1) {
			return NextResponse.json({
				success: true,
				content: results[0],
			});
		}

		return NextResponse.json({
			success: true,
			contents: results,
		});
	} catch (error) {
		if (error instanceof StorageLimitError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}

		const message = error instanceof Error ? error.message : 'Upload failed';
		if (
			message.includes('not allowed') ||
			message.includes('blocked') ||
			message.includes('extension') ||
			message.includes('File must have') ||
			message.includes('maximum size') ||
			message.includes('File is empty') ||
			message.includes('Storage limit exceeded') ||
			message.includes('Invalid expiry') ||
			message.includes('Only admins') ||
			message.includes('7 days')
		) {
			return NextResponse.json({ error: message }, { status: 400 });
		}

		console.error('Upload error:', error);
		return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
	}
}
