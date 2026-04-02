import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/permissions';
import {
	sanitizeFilename,
	validateExtension,
	validateFileSize,
	validateStorageLimit,
	validateUploadBatchBeforeWrite,
	validateExpiry,
	validateShortSlug,
	checkSlugCollision,
	createContentWithStorageCheck,
	StorageLimitError,
} from '@/lib/validation';
import { saveFile, deleteFile } from '@/lib/storage';
import { generateAndSavePreview, deletePreview, getImageDimensions, isPreviewable } from '@/lib/preview';
import { v4 as uuidv4 } from 'uuid';
import { getContentUrl, getRawFilePublicUrl } from '@/lib/url';
import { lookup } from 'mime-types';
import { generateContentId } from '@/lib/id';

type AdminContentPayload = {
	id: string;
	filename: string;
	directory: string | null;
	shortSlugs: string[];
	size: number;
	expiresAt: Date | null;
	url: string;
	shortUrl: string | null;
	rawUrl: string;
};

async function processOneAdminUpload(
	userId: string,
	role: string,
	file: File,
	expiresAt: Date | null,
	customFilename: string | null,
	directoryName: string | null,
	subDir: string | undefined,
	contentBase: string
): Promise<AdminContentPayload> {
	let storagePath: string | null = null;
	let previewPath: string | null = null;

	try {
		const sizeResult = validateFileSize(file.size);
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
		storagePath = await saveFile(buffer, storedFilename, subDir);

		previewPath = await generateAndSavePreview(buffer, mimeType, storedFilename, subDir);

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
			directory: directoryName || null,
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
			directory: content.directory,
			shortSlugs: [],
			size: content.fileSize,
			expiresAt: content.expiresAt,
			url: `${contentBase}/c/${content.id}`,
			shortUrl: null,
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

	if (!isAdmin(role)) {
		return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
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
		const expiryOption = (formData.get('expiry') as string) || 'off';
		const directoryNameRaw = formData.get('directory') as string | null;
		const directoryName =
			directoryNameRaw && directoryNameRaw !== '__none__' && directoryNameRaw.trim() !== '' ? directoryNameRaw.trim() : null;
		const shortSlugInput = (formData.get('shortSlug') as string | null)?.trim() || null;

		const expiryResult = validateExpiry(role, expiryOption);
		if (!expiryResult.valid) {
			return NextResponse.json({ error: expiryResult.error }, { status: 400 });
		}

		if (files.length > 1 && shortSlugInput) {
			return NextResponse.json({ error: 'Short URL slug can only be set when uploading a single file' }, { status: 400 });
		}

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

		const batchResult = await validateUploadBatchBeforeWrite(userId, role, files);
		if (!batchResult.ok) {
			return NextResponse.json({ error: batchResult.error }, { status: 400 });
		}

		const contentBase = getContentUrl();
		const results: AdminContentPayload[] = [];

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const perName = files.length === 1 && customFilename ? customFilename : null;
			const payload = await processOneAdminUpload(
				userId,
				role,
				file,
				expiryResult.expiresAt,
				perName,
				directoryName,
				subDir,
				contentBase
			);
			results.push(payload);
		}

		if (validatedSlug && results.length === 1) {
			await prisma.shortSlug.create({
				data: { slug: validatedSlug, contentId: results[0].id },
			});
			results[0] = {
				...results[0],
				shortSlugs: [validatedSlug],
				shortUrl: `${contentBase}/s/${validatedSlug}`,
			};
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

		console.error('Admin upload error:', error);
		return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
	}
}
