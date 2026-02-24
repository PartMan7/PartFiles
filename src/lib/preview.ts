import sharp from 'sharp';
import { saveFile, deleteFile } from './storage';

/** Maximum preview dimensions (width/height) */
const PREVIEW_MAX_WIDTH = 200;
const PREVIEW_MAX_HEIGHT = 200;

/** JPEG quality for previews (lower = smaller file) */
const PREVIEW_QUALITY = 50;

/** Mime types that support preview generation */
const PREVIEWABLE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/tiff', 'image/bmp']);

/**
 * Check if a given MIME type supports preview generation.
 */
export function isPreviewable(mimeType: string): boolean {
	return PREVIEWABLE_MIMES.has(mimeType);
}

/**
 * Get image dimensions from a buffer (for images only).
 * Returns { width, height } or null if not an image or metadata unavailable.
 */
export async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number } | null> {
	try {
		const meta = await sharp(buffer).metadata();
		if (typeof meta.width === 'number' && typeof meta.height === 'number') {
			return { width: meta.width, height: meta.height };
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Generate a low-resolution JPEG preview from an image buffer.
 * Returns the compressed preview buffer, or null if generation fails.
 */
export async function generatePreviewBuffer(imageBuffer: Buffer): Promise<Buffer | null> {
	try {
		return await sharp(imageBuffer)
			.resize(PREVIEW_MAX_WIDTH, PREVIEW_MAX_HEIGHT, {
				fit: 'inside',
				withoutEnlargement: true,
			})
			.jpeg({ quality: PREVIEW_QUALITY, progressive: true })
			.toBuffer();
	} catch {
		// If sharp fails (corrupt image, unsupported variant), skip preview
		return null;
	}
}

/**
 * Generate and save a preview for an uploaded image.
 * Returns the storage path of the saved preview, or null if not applicable/failed.
 */
export async function generateAndSavePreview(
	imageBuffer: Buffer,
	mimeType: string,
	storedFilename: string,
	subDir?: string
): Promise<string | null> {
	if (!isPreviewable(mimeType)) return null;

	const previewBuffer = await generatePreviewBuffer(imageBuffer);
	if (!previewBuffer) return null;

	const previewFilename = `preview-${storedFilename}.jpg`;
	try {
		return await saveFile(previewBuffer, previewFilename, subDir);
	} catch {
		// Best-effort: if saving fails, continue without preview
		return null;
	}
}

/**
 * Delete a preview file (best-effort, does not throw).
 */
export async function deletePreview(previewPath: string | null | undefined): Promise<void> {
	if (!previewPath) return;
	try {
		await deleteFile(previewPath);
	} catch {
		/* best-effort cleanup */
	}
}
