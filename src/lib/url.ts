const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || '';
const CONTENT_URL = process.env.CONTENT_URL || process.env.NEXT_PUBLIC_CONTENT_URL || '';

export function getBaseUrl(): string {
	if (process.env.NODE_ENV !== 'development' && BASE_URL) return BASE_URL.replace(/\/$/, '');
	if (typeof window !== 'undefined') return window.location.origin;
	return `http://localhost:${process.env.PORT || 3000}`;
}

export function getContentUrl(): string {
	if (process.env.NODE_ENV !== 'development' && CONTENT_URL) return CONTENT_URL.replace(/\/$/, '');
	return getBaseUrl();
}

/** Public URL for raw file bytes (GET /r/[id]); same asset as /api/content/[id]/raw without the /api path. */
export function getRawFilePublicUrl(contentId: string): string {
	return `${getContentUrl()}/r/${contentId}`;
}
