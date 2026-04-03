import path from 'path';

// --- Role definitions ---
export const ROLES = ['admin', 'uploader', 'guest'] as const;
export type Role = (typeof ROLES)[number];

// --- Storage limits (bytes) ---
export const GUEST_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024; // 10 MB total for self-serve guests

export const STORAGE_LIMITS: Record<string, number> = {
	admin: 2 * 1024 * 1024 * 1024, // 2 GB
	uploader: 500 * 1024 * 1024, // 500 MB
	guest: GUEST_STORAGE_LIMIT_BYTES,
};

// --- Per-file size limit ---
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per file (admin / uploader)
export const GUEST_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file for guests

export function maxUploadFileSizeBytesForRole(role: string): number {
	return role === 'guest' ? GUEST_MAX_FILE_SIZE_BYTES : MAX_FILE_SIZE;
}

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

// --- Auth ---
export const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';

// SECURITY: Fail loudly in production if AUTH_SECRET is missing or weak.
// An empty or short secret makes JWT tokens trivially forgeable.
// Only on the server: this module is imported by client bundles (e.g. via file-download-risk);
// secrets are not exposed to the client, so AUTH_SECRET would always appear empty in the browser.
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production' && AUTH_SECRET.length < 32) {
	throw new Error(
		'AUTH_SECRET (or NEXTAUTH_SECRET) must be set and at least 32 characters in production. ' +
			'Generate one with: openssl rand -base64 32'
	);
}
