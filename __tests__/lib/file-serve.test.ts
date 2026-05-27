import { describe, it, expect } from 'vitest';
import { effectiveContentMime } from '@/lib/content-mime';
import { parseByteRange, cacheControlForContent, contentEtag } from '@/lib/file-serve';

describe('parseByteRange', () => {
	const size = 1000;

	it('parses open-ended range', () => {
		expect(parseByteRange('bytes=500-', size)).toEqual({ start: 500, end: 999 });
	});

	it('parses closed range', () => {
		expect(parseByteRange('bytes=0-99', size)).toEqual({ start: 0, end: 99 });
	});

	it('parses suffix range', () => {
		expect(parseByteRange('bytes=-100', size)).toEqual({ start: 900, end: 999 });
	});

	it('clamps end to file size', () => {
		expect(parseByteRange('bytes=0-5000', size)).toEqual({ start: 0, end: 999 });
	});

	it('returns unsatisfiable when start is past EOF', () => {
		expect(parseByteRange('bytes=1000-', size)).toBe('unsatisfiable');
	});

	it('ignores multipart ranges', () => {
		expect(parseByteRange('bytes=0-1,2-3', size)).toBeNull();
	});
});

describe('cacheControlForContent', () => {
	it('uses public cache for permanent video', () => {
		expect(
			cacheControlForContent(
				{ id: 'x', filename: 'v.mp4', storagePath: 'p', mimeType: 'video/mp4', fileSize: 1, expiresAt: null },
				'video/mp4'
			)
		).toContain('public');
	});

	it('uses private cache for permanent images', () => {
		expect(
			cacheControlForContent(
				{ id: 'x', filename: 'i.jpg', storagePath: 'p', mimeType: 'image/jpeg', fileSize: 1, expiresAt: null },
				'image/jpeg'
			)
		).toBe('private, no-cache');
	});
});

describe('effectiveContentMime', () => {
	it('maps octet-stream + .mp4 to video/mp4', () => {
		expect(effectiveContentMime('application/octet-stream', '.mp4')).toBe('video/mp4');
	});
});

describe('contentEtag', () => {
	it('is stable for the same content row', () => {
		const input = {
			id: 'abc',
			filename: 'v.mp4',
			storagePath: 'p',
			mimeType: 'video/mp4',
			fileSize: 42,
			expiresAt: null,
		};
		expect(contentEtag(input)).toBe('"abc-42"');
	});
});
