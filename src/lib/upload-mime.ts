import { lookup } from 'mime-types';
import { EXTENSIONS_STORED_AS_TEXT_PLAIN } from './config';
import { mimeBaseType } from './content-mime';

/** Prefer text/plain for plain-text extensions when lookup only yields octet-stream. */
export function mimeTypeForUploadedFile(originalName: string, validatedExtensionWithDot: string): string {
	const raw = lookup(originalName) || 'application/octet-stream';
	const base = mimeBaseType(raw);
	const ext = validatedExtensionWithDot.trim().toLowerCase();
	if (base === 'application/octet-stream' && EXTENSIONS_STORED_AS_TEXT_PLAIN.has(ext)) {
		return 'text/plain';
	}
	return raw;
}
