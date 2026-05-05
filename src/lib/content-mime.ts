import { EXTENSIONS_STORED_AS_TEXT_PLAIN } from './config';

/** MIME type without parameters (e.g. charset), lowercased. */
export function mimeBaseType(mimeType: string): string {
	return mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
}

function normalizeExtensionDot(ext: string): string {
	const t = ext.trim().toLowerCase();
	if (!t) return '';
	return t.startsWith('.') ? t : `.${t}`;
}

/**
 * MIME types that are safe to render inline in the browser (base type only).
 * Everything else falls back to attachment unless overridden by extension rules below.
 */
const INLINE_SAFE_MIME_BASE_TYPES = new Set([
	// Images
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/avif',
	'image/bmp',
	'image/tiff',
	// Video
	'video/mp4',
	'video/webm',
	'video/ogg',
	// Audio
	'audio/mpeg',
	'audio/ogg',
	'audio/wav',
	'audio/webm',
	// Documents
	'application/pdf',
	// Text
	'text/plain',
	'text/csv',
]);

export function isInlineSafeMime(mimeType: string, fileExtension?: string): boolean {
	const base = mimeBaseType(mimeType);
	if (INLINE_SAFE_MIME_BASE_TYPES.has(base)) return true;
	if (fileExtension !== undefined && base === 'application/octet-stream') {
		return EXTENSIONS_STORED_AS_TEXT_PLAIN.has(normalizeExtensionDot(fileExtension));
	}
	return false;
}

/** Max bytes returned for ?textPreview=1 on text-like content. */
export const TEXT_PREVIEW_MAX_BYTES = 100 * 1024;

/** Same classification for API truncation and the content viewer (no duplicated lists). */
export function isTextPreviewMime(mimeType: string, fileExtension?: string): boolean {
	const base = mimeBaseType(mimeType);
	if (base === 'text/plain' || base === 'text/csv') return true;
	if (fileExtension !== undefined && base === 'application/octet-stream') {
		return EXTENSIONS_STORED_AS_TEXT_PLAIN.has(normalizeExtensionDot(fileExtension));
	}
	return false;
}

export function sliceTextPreviewIfRequested(
	fileBuffer: Buffer,
	mimeType: string,
	textPreviewRequested: boolean,
	fileExtension?: string
): Buffer {
	if (!textPreviewRequested || !isTextPreviewMime(mimeType, fileExtension)) return fileBuffer;
	if (fileBuffer.length <= TEXT_PREVIEW_MAX_BYTES) return fileBuffer;
	return fileBuffer.subarray(0, TEXT_PREVIEW_MAX_BYTES);
}
