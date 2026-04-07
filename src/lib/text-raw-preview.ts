/** Max bytes returned for ?textPreview=1 on text/plain and text/csv. */
export const TEXT_PREVIEW_MAX_BYTES = 100 * 1024;

export function isTextPreviewMime(mimeType: string): boolean {
	return mimeType === 'text/plain' || mimeType === 'text/csv';
}

export function sliceTextPreviewIfRequested(fileBuffer: Buffer, mimeType: string, textPreviewRequested: boolean): Buffer {
	if (!textPreviewRequested || !isTextPreviewMime(mimeType)) return fileBuffer;
	if (fileBuffer.length <= TEXT_PREVIEW_MAX_BYTES) return fileBuffer;
	return fileBuffer.subarray(0, TEXT_PREVIEW_MAX_BYTES);
}
