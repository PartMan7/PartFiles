import path from 'path';

// --- Role policy (single source of truth) ---
export const ROLES = ['admin', 'uploader', 'guest'] as const;
export type Role = (typeof ROLES)[number];

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export type RolePolicy = {
	level: number;
	label: string;
	storageLimitBytes: number;
	maxFileSizeBytes: number;
	canUpload: boolean;
	canBrowseContent: boolean;
	canSetNoExpiry: boolean;
	/** Max timed expiry in hours; null = uncapped (admin). */
	maxExpiryHours: number | null;
};

export const ROLE_CONFIG: Record<Role, RolePolicy> = {
	guest: {
		level: 0,
		label: 'Guest',
		storageLimitBytes: 10 * MB,
		maxFileSizeBytes: 10 * MB,
		canUpload: true,
		canBrowseContent: true,
		canSetNoExpiry: false,
		maxExpiryHours: 168,
	},
	uploader: {
		level: 1,
		label: 'Uploader',
		storageLimitBytes: 500 * MB,
		maxFileSizeBytes: 100 * MB,
		canUpload: true,
		canBrowseContent: true,
		canSetNoExpiry: true,
		maxExpiryHours: 168,
	},
	admin: {
		level: 2,
		label: 'Admin',
		storageLimitBytes: 2 * GB,
		maxFileSizeBytes: 1 * GB,
		canUpload: true,
		canBrowseContent: true,
		canSetNoExpiry: true,
		maxExpiryHours: null,
	},
};

/** Roles ordered lowest privilege first (for selects and comparisons). */
export const ROLES_BY_LEVEL: Role[] = ['guest', 'uploader', 'admin'];

export function isKnownRole(role: string): role is Role {
	return role in ROLE_CONFIG;
}

export function roleLevel(role: string): number {
	return isKnownRole(role) ? ROLE_CONFIG[role].level : -1;
}

export function rolePolicy(role: string): RolePolicy | undefined {
	return isKnownRole(role) ? ROLE_CONFIG[role] : undefined;
}

export function roleSelectOptions(): { value: Role; label: string }[] {
	return ROLES_BY_LEVEL.map(value => ({ value, label: ROLE_CONFIG[value].label }));
}

// --- Storage limits (bytes), derived from ROLE_CONFIG ---
export const GUEST_STORAGE_LIMIT_BYTES = ROLE_CONFIG.guest.storageLimitBytes;

export const STORAGE_LIMITS: Record<string, number> = {
	admin: ROLE_CONFIG.admin.storageLimitBytes,
	uploader: ROLE_CONFIG.uploader.storageLimitBytes,
	guest: ROLE_CONFIG.guest.storageLimitBytes,
};

// --- Per-file size limit (derived) ---
export const ADMIN_MAX_FILE_SIZE = ROLE_CONFIG.admin.maxFileSizeBytes;
export const MAX_FILE_SIZE = ROLE_CONFIG.uploader.maxFileSizeBytes;
export const GUEST_MAX_FILE_SIZE_BYTES = ROLE_CONFIG.guest.maxFileSizeBytes;

export function maxUploadFileSizeBytesForRole(role: string): number {
	return rolePolicy(role)?.maxFileSizeBytes ?? 0;
}

// --- Expiry constraints ---
export const MAX_EXPIRY_HOURS_UPLOADER = ROLE_CONFIG.uploader.maxExpiryHours ?? 168;
export const DEFAULT_EXPIRY_HOURS = 1;
export const MIN_EXPIRY_MINUTES = 5;

export const EXPIRY_SELECT_OPTIONS: { value: string; label: string }[] = [
	{ value: '0.25', label: '15 minutes' },
	{ value: '0.5', label: '30 minutes' },
	{ value: '1', label: '1 hour' },
	{ value: '6', label: '6 hours' },
	{ value: '24', label: '1 day' },
	{ value: '72', label: '3 days' },
	{ value: '168', label: '7 days' },
];

export function expirySelectOptionsForRole(role: string): { value: string; label: string }[] {
	if (rolePolicy(role)?.canSetNoExpiry) {
		return [{ value: 'off', label: 'Never (permanent)' }, ...EXPIRY_SELECT_OPTIONS];
	}
	return EXPIRY_SELECT_OPTIONS;
}

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
	'.log',
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

/**
 * Plain-text-by-convention extensions: same inline preview path as .txt.
 * If MIME lookup is application/octet-stream, we store text/plain (see content-mime).
 */
export const EXTENSIONS_STORED_AS_TEXT_PLAIN = new Set(['.txt', '.log']);

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
