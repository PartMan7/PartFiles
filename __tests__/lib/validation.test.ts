import { describe, it, expect } from 'vitest';
import {
	sanitizeFilename,
	validateExtension,
	validateFileSize,
	validateExpiry,
	validateShortSlug,
	validatePasswordForStorage,
	MAX_PASSWORD_LENGTH,
} from '@/lib/validation';

describe('validatePasswordForStorage', () => {
	it('rejects short passwords', () => {
		const r = validatePasswordForStorage('short');
		expect(r.valid).toBe(false);
		expect(r.valid ? '' : r.error).toContain('at least');
	});

	it('rejects passwords over max length', () => {
		const r = validatePasswordForStorage('a'.repeat(MAX_PASSWORD_LENGTH + 1));
		expect(r.valid).toBe(false);
		expect(r.valid ? '' : r.error).toContain('at most');
	});

	it('accepts boundary-length password', () => {
		expect(validatePasswordForStorage('a'.repeat(MAX_PASSWORD_LENGTH))).toEqual({ valid: true });
	});
});

describe('sanitizeFilename', () => {
	it('passes through a normal filename', () => {
		expect(sanitizeFilename('report.pdf')).toBe('report.pdf');
	});

	it('removes directory components', () => {
		expect(sanitizeFilename('/etc/passwd')).toBe('passwd');
		expect(sanitizeFilename('../../secret.txt')).toBe('secret.txt');
	});

	it('replaces special characters with underscores', () => {
		expect(sanitizeFilename('file name (1).pdf')).toBe('file_name__1_.pdf');
	});

	it('removes leading dots', () => {
		expect(sanitizeFilename('.hidden')).toBe('hidden');
		expect(sanitizeFilename('...secret')).toBe('secret');
	});

	it('truncates very long filenames', () => {
		const long = 'a'.repeat(300) + '.pdf';
		const result = sanitizeFilename(long);
		expect(result.length).toBeLessThanOrEqual(200);
		expect(result).toMatch(/\.pdf$/);
	});

	it('returns fallback for empty input', () => {
		expect(sanitizeFilename('')).toBe('unnamed_file');
	});

	it('returns fallback for dots-only input', () => {
		expect(sanitizeFilename('...')).toBe('unnamed_file');
	});
});

describe('validateExtension', () => {
	it('accepts allowed extensions', () => {
		expect(validateExtension('photo.jpg')).toEqual({ valid: true, extension: '.jpg' });
		expect(validateExtension('doc.pdf')).toEqual({ valid: true, extension: '.pdf' });
		expect(validateExtension('archive.zip')).toEqual({ valid: true, extension: '.zip' });
	});

	it('rejects blocked extensions', () => {
		const res = validateExtension('script.js');
		expect(res.valid).toBe(false);
		expect(res.error).toContain('blocked');
	});

	it('rejects blocked .html extension', () => {
		const res = validateExtension('page.html');
		expect(res.valid).toBe(false);
		expect(res.error).toContain('blocked');
	});

	it('rejects blocked .exe extension', () => {
		const res = validateExtension('virus.exe');
		expect(res.valid).toBe(false);
	});

	it('rejects unknown extensions', () => {
		const res = validateExtension('file.xyz');
		expect(res.valid).toBe(false);
		expect(res.error).toContain('not allowed');
	});

	it('rejects files without extension', () => {
		const res = validateExtension('Makefile');
		expect(res.valid).toBe(false);
		expect(res.error).toContain('must have an extension');
	});

	it('is case-insensitive', () => {
		expect(validateExtension('PHOTO.JPG').valid).toBe(true);
		expect(validateExtension('script.JS').valid).toBe(false);
	});

	it('rejects double extensions with a blocked inner extension', () => {
		const res1 = validateExtension('malware.html.jpg');
		expect(res1.valid).toBe(false);
		expect(res1.error).toContain('.html');

		const res2 = validateExtension('exploit.php.png');
		expect(res2.valid).toBe(false);
		expect(res2.error).toContain('.php');

		const res3 = validateExtension('trick.exe.pdf');
		expect(res3.valid).toBe(false);
		expect(res3.error).toContain('.exe');
	});

	it('allows double extensions when inner extension is safe', () => {
		// e.g. "archive.backup.zip" — .backup is not in BLOCKED_EXTENSIONS
		const res = validateExtension('archive.backup.zip');
		expect(res.valid).toBe(true);
	});
});

describe('validateFileSize', () => {
	it('accepts valid file sizes', () => {
		expect(validateFileSize(1024).valid).toBe(true);
		expect(validateFileSize(50 * 1024 * 1024).valid).toBe(true);
	});

	it('rejects empty files', () => {
		expect(validateFileSize(0).valid).toBe(false);
		expect(validateFileSize(-1).valid).toBe(false);
	});

	it('rejects files exceeding max size', () => {
		const res = validateFileSize(200 * 1024 * 1024);
		expect(res.valid).toBe(false);
		expect(res.error).toContain('exceeds maximum');
	});
});

describe('validateExpiry', () => {
	it('admin can set expiry to off', () => {
		const res = validateExpiry('admin', 'off');
		expect(res.valid).toBe(true);
		expect(res.expiresAt).toBeNull();
	});

	it('admin can set expiry to null', () => {
		const res = validateExpiry('admin', null);
		expect(res.valid).toBe(true);
		expect(res.expiresAt).toBeNull();
	});

	it('uploader CANNOT set expiry to off', () => {
		const res = validateExpiry('uploader', 'off');
		expect(res.valid).toBe(false);
		expect(res.error).toContain('Only admins');
	});

	it('uploader CANNOT set expiry to null', () => {
		const res = validateExpiry('uploader', null);
		expect(res.valid).toBe(false);
	});

	it('valid hour value returns future date', () => {
		const res = validateExpiry('uploader', '1');
		expect(res.valid).toBe(true);
		expect(res.expiresAt).toBeInstanceOf(Date);
		expect(res.expiresAt!.getTime()).toBeGreaterThan(Date.now());
	});

	it('uploader cannot exceed 7 days', () => {
		const res = validateExpiry('uploader', '200');
		expect(res.valid).toBe(false);
		expect(res.error).toContain('7 days');
	});

	it('admin CAN exceed 7 days', () => {
		const res = validateExpiry('admin', '200');
		expect(res.valid).toBe(true);
	});

	it('rejects invalid expiry values', () => {
		expect(validateExpiry('admin', 'abc').valid).toBe(false);
		expect(validateExpiry('admin', '-1').valid).toBe(false);
		expect(validateExpiry('admin', '0').valid).toBe(false);
	});

	it('rejects expiry too short (less than 5 minutes)', () => {
		// 0.01 hours = 0.6 minutes, too short
		const res = validateExpiry('admin', '0.01');
		expect(res.valid).toBe(false);
		expect(res.error).toContain('at least');
	});
});

describe('validateShortSlug', () => {
	it('accepts valid slugs', () => {
		expect(validateShortSlug('my-file')).toEqual({ valid: true, slug: 'my-file' });
		expect(validateShortSlug('logo')).toEqual({ valid: true, slug: 'logo' });
		expect(validateShortSlug('report-2024')).toEqual({ valid: true, slug: 'report-2024' });
		expect(validateShortSlug('a')).toEqual({ valid: true, slug: 'a' });
	});

	it('normalises to lowercase', () => {
		expect(validateShortSlug('My-File')).toEqual({ valid: true, slug: 'my-file' });
		expect(validateShortSlug('LOGO')).toEqual({ valid: true, slug: 'logo' });
	});

	it('trims whitespace', () => {
		expect(validateShortSlug('  my-file  ')).toEqual({ valid: true, slug: 'my-file' });
	});

	it('rejects empty slugs', () => {
		expect(validateShortSlug('').valid).toBe(false);
		expect(validateShortSlug('   ').valid).toBe(false);
	});

	it('rejects slugs over 100 characters', () => {
		const long = 'a'.repeat(101);
		expect(validateShortSlug(long).valid).toBe(false);
	});

	it('rejects slugs with special characters', () => {
		expect(validateShortSlug('my file').valid).toBe(false);
		expect(validateShortSlug('my_file').valid).toBe(false);
		expect(validateShortSlug('my.file').valid).toBe(false);
		expect(validateShortSlug('my/file').valid).toBe(false);
		expect(validateShortSlug('file@name').valid).toBe(false);
	});

	it('rejects leading, trailing, or consecutive hyphens', () => {
		expect(validateShortSlug('-leading').valid).toBe(false);
		expect(validateShortSlug('trailing-').valid).toBe(false);
		expect(validateShortSlug('double--hyphen').valid).toBe(false);
	});
});
