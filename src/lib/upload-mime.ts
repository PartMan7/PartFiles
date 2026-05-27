import { lookup } from 'mime-types';
import { EXTENSIONS_STORED_AS_TEXT_PLAIN } from './config';
import { effectiveContentMime, mimeBaseType } from './content-mime';

/** Prefer text/plain for plain-text extensions when lookup only yields octet-stream. */
export function mimeTypeForUploadedFile(originalName: string, validatedExtensionWithDot: string): string {
	const raw = lookup(originalName) || 'application/octet-stream';
	const ext = validatedExtensionWithDot.trim().toLowerCase();
	if (mimeBaseType(raw) === 'application/octet-stream' && EXTENSIONS_STORED_AS_TEXT_PLAIN.has(ext)) {
		return 'text/plain';
	}
	return effectiveContentMime(raw, ext);
}
