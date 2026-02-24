import { z } from 'zod';
import path from 'path';
import {
	MAX_FILE_SIZE,
	ALLOWED_EXTENSIONS,
	BLOCKED_EXTENSIONS,
	MAX_EXPIRY_HOURS_UPLOADER,
	MIN_EXPIRY_MINUTES,
	STORAGE_LIMITS,
} from './config';
import { isAdmin } from './permissions';
import { prisma } from './prisma';

/**
 * Sanitize a filename: remove path components, special chars, limit length.
 */
export function sanitizeFilename(filename: string): string {
	// Remove any directory components
	let sanitized = path.basename(filename);
	// Remove non-ASCII characters and dangerous chars
	sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
	// Remove leading dots (hidden files)
	sanitized = sanitized.replace(/^\.+/, '');
	// Limit length
	if (sanitized.length > 200) {
		const ext = path.extname(sanitized);
		sanitized = sanitized.substring(0, 200 - ext.length) + ext;
	}
	// Fallback if empty
	if (!sanitized || sanitized === '') {
		sanitized = 'unnamed_file';
	}
	return sanitized;
}

/**
 * Validate file extension against the allowlist.
 * Also checks for blocked extensions hidden behind allowed ones (e.g. "file.html.jpg").
 */
export function validateExtension(filename: string): {
	valid: boolean;
	extension: string;
	error?: string;
} {
	const ext = path.extname(filename).toLowerCase();

	if (!ext) {
		return { valid: false, extension: '', error: 'File must have an extension' };
	}

	// SECURITY: Check for blocked extensions hidden in multi-extension filenames
	// e.g. "malware.html.jpg" or "exploit.php.png"
	const parts = filename.toLowerCase().split('.');
	for (let i = 1; i < parts.length - 1; i++) {
		const hiddenExt = '.' + parts[i];
		if (BLOCKED_EXTENSIONS.has(hiddenExt)) {
			return {
				valid: false,
				extension: hiddenExt,
				error: `Filename contains blocked extension '${hiddenExt}'`,
			};
		}
	}

	if (BLOCKED_EXTENSIONS.has(ext)) {
		return {
			valid: false,
			extension: ext,
			error: `File extension '${ext}' is blocked for security reasons`,
		};
	}

	if (!ALLOWED_EXTENSIONS.has(ext)) {
		return {
			valid: false,
			extension: ext,
			error: `File extension '${ext}' is not allowed`,
		};
	}

	return { valid: true, extension: ext };
}

/**
 * Validate file size.
 */
export function validateFileSize(size: number): {
	valid: boolean;
	error?: string;
} {
	if (size <= 0) {
		return { valid: false, error: 'File is empty' };
	}
	if (size > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
		};
	}
	return { valid: true };
}

/**
 * Check the user's total storage usage against their role limit.
 */
export async function validateStorageLimit(
	userId: string,
	role: string,
	newFileSize: number
): Promise<{ valid: boolean; currentUsage: number; limit: number; error?: string }> {
	const limit = STORAGE_LIMITS[role] ?? 0;

	if (limit === 0) {
		return {
			valid: false,
			currentUsage: 0,
			limit: 0,
			error: 'Your role does not allow uploads',
		};
	}

	const result = await prisma.content.aggregate({
		where: {
			uploadedById: userId,
			OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
		},
		_sum: { fileSize: true },
	});

	const currentUsage = result._sum.fileSize ?? 0;

	if (currentUsage + newFileSize > limit) {
		const usedMB = (currentUsage / (1024 * 1024)).toFixed(1);
		const limitMB = (limit / (1024 * 1024)).toFixed(0);
		return {
			valid: false,
			currentUsage,
			limit,
			error: `Storage limit exceeded. Used: ${usedMB}MB / ${limitMB}MB. Cannot add ${(newFileSize / (1024 * 1024)).toFixed(1)}MB.`,
		};
	}

	return { valid: true, currentUsage, limit };
}

/**
 * Validate expiry time. Returns the computed expiry Date or null (no expiry, admin only).
 */
export function validateExpiry(
	role: string,
	expiryOption: string | null // "off", or hours as string e.g. "1", "24", "168"
): { valid: boolean; expiresAt: Date | null; error?: string } {
	// "off" means no expiry
	if (expiryOption === 'off' || expiryOption === null) {
		if (!isAdmin(role)) {
			return {
				valid: false,
				expiresAt: null,
				error: 'Only admins can set content to never expire',
			};
		}
		return { valid: true, expiresAt: null };
	}

	const hours = parseFloat(expiryOption);
	if (isNaN(hours) || hours <= 0) {
		return {
			valid: false,
			expiresAt: null,
			error: 'Invalid expiry time',
		};
	}

	const minutes = hours * 60;
	if (minutes < MIN_EXPIRY_MINUTES) {
		return {
			valid: false,
			expiresAt: null,
			error: `Expiry must be at least ${MIN_EXPIRY_MINUTES} minutes`,
		};
	}

	if (!isAdmin(role) && hours > MAX_EXPIRY_HOURS_UPLOADER) {
		return {
			valid: false,
			expiresAt: null,
			error: `Uploaders can set expiry up to ${MAX_EXPIRY_HOURS_UPLOADER} hours (7 days)`,
		};
	}

	const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
	return { valid: true, expiresAt };
}

/**
 * Atomically check storage limit and create a content record inside a transaction.
 * This prevents TOCTOU race conditions where concurrent uploads both pass the
 * storage check before either record is committed.
 *
 * Call this AFTER saving the file to disk. If it throws, clean up the file.
 */
export async function createContentWithStorageCheck(
	userId: string,
	role: string,
	data: {
		id: string;
		filename: string;
		originalFilename: string;
		storagePath: string;
		previewPath?: string | null;
		directory?: string | null;
		fileSize: number;
		fileExtension: string;
		mimeType: string;
		imageWidth?: number | null;
		imageHeight?: number | null;
		expiresAt: Date | null;
		uploadedById: string;
	}
) {
	const limit = STORAGE_LIMITS[role] ?? 0;

	return prisma.$transaction(async tx => {
		// Re-check storage limit inside the transaction (serialised by SQLite)
		const result = await tx.content.aggregate({
			where: {
				uploadedById: userId,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
			_sum: { fileSize: true },
		});

		const currentUsage = result._sum.fileSize ?? 0;
		if (currentUsage + data.fileSize > limit) {
			const usedMB = (currentUsage / (1024 * 1024)).toFixed(1);
			const limitMB = (limit / (1024 * 1024)).toFixed(0);
			throw new StorageLimitError(
				`Storage limit exceeded. Used: ${usedMB}MB / ${limitMB}MB. Cannot add ${(data.fileSize / (1024 * 1024)).toFixed(1)}MB.`
			);
		}

		return tx.content.create({ data });
	});
}

/**
 * Validate and sanitize a short slug for the /s/ route.
 * Slugs must be 1-100 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens.
 */
export function validateShortSlug(slug: string): { valid: boolean; slug: string; error?: string } {
	// Normalise: trim, lowercase
	const normalised = slug.trim().toLowerCase();

	if (!normalised) {
		return { valid: false, slug: '', error: 'Short slug cannot be empty' };
	}

	if (normalised.length > 100) {
		return { valid: false, slug: normalised, error: 'Short slug must be 100 characters or fewer' };
	}

	// Only allow lowercase alphanumeric and hyphens
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalised)) {
		return {
			valid: false,
			slug: normalised,
			error: 'Short slug may only contain lowercase letters, numbers, and hyphens (no leading/trailing/consecutive hyphens)',
		};
	}

	return { valid: true, slug: normalised };
}

/**
 * Check that a short slug is not already taken.
 * Pass excludeContentId to ignore slugs already belonging to a specific content item.
 */
export async function checkSlugCollision(slug: string, excludeContentId?: string): Promise<{ taken: boolean; error?: string }> {
	const existing = await prisma.shortSlug.findUnique({ where: { slug } });
	if (existing && existing.contentId !== excludeContentId) {
		return { taken: true, error: `Short slug '${slug}' is already in use` };
	}
	return { taken: false };
}

/** Thrown when an atomic storage check fails inside a transaction. */
export class StorageLimitError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'StorageLimitError';
	}
}

// Zod schema for upload form data validation
export const uploadSchema = z.object({
	filename: z.string().optional(),
	expiry: z.string().default('1'), // hours or "off"
	directory: z.string().optional(),
});
