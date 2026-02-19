/**
 * Resolve the public-facing base URL (the "main" domain used for UI pages,
 * invite links, etc.). Falls back to localhost:3000 in development.
 */
export function getBaseUrl(): string {
	if (process.env.NODE_ENV !== 'development' && process.env.BASE_URL) return process.env.BASE_URL.replace(/\/+$/, '');
	return `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Resolve the content-serving base URL. When a separate content domain is
 * configured (e.g. `cdn.example.com`), content URLs (/c/, /s/, /r/, /e/)
 * will prefer it. Falls back to the main domain when CONTENT_URL is unset.
 */
export function getContentUrl(): string {
	if (process.env.NODE_ENV !== 'development' && process.env.CONTENT_URL) return process.env.CONTENT_URL.replace(/\/+$/, '');
	return getBaseUrl();
}