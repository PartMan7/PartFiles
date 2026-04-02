import { NextRequest } from 'next/server';

/**
 * Create a NextRequest with JSON body.
 */
export function jsonRequest(url: string, method: string, body?: Record<string, unknown>): NextRequest {
	return new NextRequest(new URL(url, 'http://localhost:3000'), {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
}

/**
 * Create a NextRequest with FormData containing a file.
 */
export function uploadRequest(
	url: string,
	fields: Record<string, string>,
	file?: { name: string; content: string; type?: string }
): NextRequest {
	const formData = new FormData();

	if (file) {
		const blob = new Blob([file.content], { type: file.type || 'application/octet-stream' });
		formData.append('file', new File([blob], file.name, { type: file.type }));
	}

	for (const [key, value] of Object.entries(fields)) {
		formData.append(key, value);
	}

	return new NextRequest(new URL(url, 'http://localhost:3000'), {
		method: 'POST',
		body: formData,
	});
}

/**
 * Create a NextRequest with FormData containing multiple files under `files`.
 */
export function uploadRequestMulti(
	url: string,
	fields: Record<string, string>,
	files: { name: string; content: string; type?: string }[]
): NextRequest {
	const formData = new FormData();
	for (const f of files) {
		const blob = new Blob([f.content], { type: f.type || 'application/octet-stream' });
		formData.append('files', new File([blob], f.name, { type: f.type }));
	}
	for (const [key, value] of Object.entries(fields)) {
		formData.append(key, value);
	}
	return new NextRequest(new URL(url, 'http://localhost:3000'), {
		method: 'POST',
		body: formData,
	});
}

/**
 * Create a NextRequest with custom headers.
 */
export function requestWithHeaders(url: string, method: string, headers: Record<string, string>): NextRequest {
	return new NextRequest(new URL(url, 'http://localhost:3000'), {
		method,
		headers,
	});
}

/**
 * Parse a NextResponse into a JSON body + status.
 */
export async function parseResponse(res: Response) {
	const status = res.status;
	let body: Record<string, unknown> | null = null;
	try {
		body = await res.json();
	} catch {
		// Not JSON (e.g. file download)
	}
	return { status, body };
}
