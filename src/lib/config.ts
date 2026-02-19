import path from 'path';

// --- Role definitions ---
export const ROLES = ['admin', 'uploader', 'guest'] as const;
export type Role = (typeof ROLES)[number];

// --- Storage limits (bytes) ---
export const STORAGE_LIMITS: Record<string, number> = {
	admin: 2 * 1024 * 1024 * 1024, // 2 GB
	uploader: 500 * 1024 * 1024, // 500 MB
	guest: 0, // Guests cannot upload
};

// --- Per-file size limit ---
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per file

// --- Expiry constraints ---
export const MAX_EXPIRY_HOURS_UPLOADER = 168; // 7 days in hours
export const DEFAULT_EXPIRY_HOURS = 1; // 1 hour default for /upload
export const MIN_EXPIRY_MINUTES = 5; // Minimum 5 minutes

// --- Allowed file extensions (allowlist) ---
export const ALLOWED_EXTENSIONS = new Set([
	// Images
	'.jpg',
	'.jpeg',
	'.png',
	'.gif',
	'.webp',
	'.bmp',
	'.ico',
	'.tiff',
	'.avif',
	// Documents
	'.pdf',
	'.doc',
	'.docx',
	'.xls',
	'.xlsx',
	'.ppt',
	'.pptx',
	'.odt',
	'.ods',
	'.odp',
	'.txt',
	'.csv',
	'.rtf',
	// Archives
	'.zip',
	'.tar',
	'.gz',
	'.bz2',
	'.7z',
	'.rar',
	// Media
	'.mp3',
	'.mp4',
	'.wav',
	'.ogg',
	'.webm',
	'.avi',
	'.mov',
	'.flv',
	'.mkv',
	// Data
	'.json',
	'.xml',
	'.yaml',
	'.yml',
	// Fonts
	'.woff',
	'.woff2',
	'.ttf',
	'.otf',
	'.eot',
]);

// SECURITY: Explicitly blocked extensions (even if someone adds them to allowed)
export const BLOCKED_EXTENSIONS = new Set([
	'.html',
	'.htm',
	'.js',
	'.jsx',
	'.ts',
	'.tsx',
	'.svg',
	'.php',
	'.asp',
	'.aspx',
	'.jsp',
	'.cgi',
	'.sh',
	'.bash',
	'.bat',
	'.cmd',
	'.exe',
	'.msi',
	'.dll',
	'.so',
	'.dylib',
	'.phtml',
	'.phar',
	'.htaccess',
	'.htpasswd',
	'.xslt',
]);

// --- Upload directory ---
export const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

// --- Base URL ---
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

// --- Auth ---
export const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';

// SECURITY: Fail loudly in production if AUTH_SECRET is missing or weak.
// An empty or short secret makes JWT tokens trivially forgeable.
if (process.env.NODE_ENV === 'production' && AUTH_SECRET.length < 32) {
	throw new Error(
		'AUTH_SECRET (or NEXTAUTH_SECRET) must be set and at least 32 characters in production. ' +
			'Generate one with: openssl rand -base64 32'
	);
}
