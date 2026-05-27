import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { getFilePath } from './storage';
import { sanitizeFilename } from './validation';
import {
	effectiveContentMime,
	isInlineSafeMime,
	isStreamableMedia,
	isTextPreviewMime,
	mimeBaseType,
	sliceTextPreviewIfRequested,
} from './content-mime';

export type ServeContentInput = {
	id: string;
	filename: string;
	storagePath: string;
	mimeType: string;
	fileExtension?: string;
	fileSize: number;
	expiresAt: Date | null;
};

export type ServeContentOptions = {
	req: NextRequest;
	textPreview?: boolean;
	forceAttachment?: boolean;
	frameDeny?: boolean;
};

export function contentEtag(content: ServeContentInput): string {
	return `"${content.id}-${content.fileSize}"`;
}

export function cacheControlForContent(content: ServeContentInput, mimeType: string): string {
	if (content.expiresAt) {
		const secs = Math.max(0, Math.floor((content.expiresAt.getTime() - Date.now()) / 1000));
		return secs > 0 ? `private, max-age=${Math.min(secs, 3600)}` : 'private, no-cache';
	}
	if (isStreamableMedia(mimeType)) {
		return 'public, max-age=3600, stale-while-revalidate=86400';
	}
	return 'private, no-cache';
}

/** Parse a single `bytes=` range. Returns null when the header should be ignored. */
export function parseByteRange(rangeHeader: string, size: number): { start: number; end: number } | 'unsatisfiable' | null {
	if (!rangeHeader.startsWith('bytes=') || rangeHeader.includes(',')) return null;

	const spec = rangeHeader.slice(6).trim();
	if (!spec) return null;

	let start: number;
	let end: number;

	if (spec.startsWith('-')) {
		const suffix = Number.parseInt(spec.slice(1), 10);
		if (!Number.isFinite(suffix) || suffix <= 0) return 'unsatisfiable';
		start = Math.max(0, size - suffix);
		end = size - 1;
	} else {
		const [startPart, endPart] = spec.split('-', 2);
		start = Number.parseInt(startPart, 10);
		if (!Number.isFinite(start) || start < 0) return 'unsatisfiable';
		if (endPart === '') {
			end = size - 1;
		} else {
			end = Number.parseInt(endPart, 10);
			if (!Number.isFinite(end) || end < start) return 'unsatisfiable';
		}
	}

	if (start >= size) return 'unsatisfiable';
	end = Math.min(end, size - 1);

	return { start, end };
}

function inlineCsp(mimeType: string): string | null {
	const isPdf = mimeBaseType(mimeType) === 'application/pdf';
	if (isPdf) return null;
	return "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'";
}

export async function serveContentFile(content: ServeContentInput, options: ServeContentOptions): Promise<NextResponse> {
	const filePath = getFilePath(content.storagePath);
	const servedMime = effectiveContentMime(content.mimeType, content.fileExtension);
	const safeFilename = sanitizeFilename(content.filename).replace(/"/g, "'");
	const isInlineSafe = !options.forceAttachment && isInlineSafeMime(content.mimeType, content.fileExtension);
	const disposition = isInlineSafe ? `inline; filename="${safeFilename}"` : `attachment; filename="${safeFilename}"`;
	const csp = isInlineSafe ? inlineCsp(servedMime) : "default-src 'none'";
	const etag = contentEtag(content);
	const cacheControl = cacheControlForContent(content, servedMime);

	const baseHeaders: Record<string, string> = {
		'Content-Type': servedMime,
		'Content-Disposition': disposition,
		'X-Content-Type-Options': 'nosniff',
		ETag: etag,
		'Cache-Control': cacheControl,
		...(options.frameDeny ? { 'X-Frame-Options': 'DENY' } : {}),
		...(csp ? { 'Content-Security-Policy': csp } : {}),
	};

	const rangeHeader = options.req.headers.get('range');
	const ifNoneMatch = options.req.headers.get('if-none-match');
	if (ifNoneMatch === etag && !rangeHeader && !options.textPreview) {
		return new NextResponse(null, { status: 304, headers: baseHeaders });
	}

	try {
		const stat = await fs.stat(filePath);
		const fileSize = stat.size;

		if (options.textPreview && isTextPreviewMime(content.mimeType, content.fileExtension)) {
			const fileBuffer = await fs.readFile(filePath);
			const body = sliceTextPreviewIfRequested(fileBuffer, content.mimeType, true, content.fileExtension);
			return new NextResponse(new Uint8Array(body), {
				status: 200,
				headers: { ...baseHeaders, 'Content-Length': String(body.length) },
			});
		}

		const parsed = rangeHeader ? parseByteRange(rangeHeader, fileSize) : null;

		if (parsed === 'unsatisfiable') {
			return new NextResponse(null, {
				status: 416,
				headers: { ...baseHeaders, 'Content-Range': `bytes */${fileSize}` },
			});
		}

		if (parsed) {
			const { start, end } = parsed;
			const chunkSize = end - start + 1;
			const fh = await fs.open(filePath, 'r');
			try {
				const buffer = Buffer.alloc(chunkSize);
				const { bytesRead } = await fh.read(buffer, 0, chunkSize, start);
				const body = buffer.subarray(0, bytesRead);
				const rangeEnd = start + bytesRead - 1;
				return new NextResponse(new Uint8Array(body), {
					status: 206,
					headers: {
						...baseHeaders,
						'Content-Length': String(bytesRead),
						'Content-Range': `bytes ${start}-${rangeEnd}/${fileSize}`,
						'Accept-Ranges': 'bytes',
					},
				});
			} finally {
				await fh.close();
			}
		}

		const fileBuffer = await fs.readFile(filePath);
		return new NextResponse(new Uint8Array(fileBuffer), {
			status: 200,
			headers: {
				...baseHeaders,
				'Content-Length': String(fileBuffer.length),
				'Accept-Ranges': 'bytes',
			},
		});
	} catch {
		return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
	}
}
