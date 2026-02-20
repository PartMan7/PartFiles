/**
 * Resolve the public-facing base URL (the "main" domain used for UI pages,
 * invite links, etc.). Falls back to localhost:3000 in development.
 */
export function getBaseUrl(): string {
	const publicBase = process.env.NEXT_PUBLIC_BASE_URL;
	if (publicBase) return publicBase.replace(/\/$/, '');
	if (typeof window !== 'undefined') return window.location.origin;
	return `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Resolve the content-serving base URL. When a separate content domain is
 * configured (e.g. `cdn.example.com`), content URLs (/c/, /s/, /r/, /e/)
 * will prefer it. Falls back to the main domain when CONTENT_URL is unset.
 */
export function getContentUrl(): string {
	const publicContent = process.env.NEXT_PUBLIC_CONTENT_URL;
	if (publicContent) return publicContent.replace(/\/$/, '');
	return getBaseUrl();
}
