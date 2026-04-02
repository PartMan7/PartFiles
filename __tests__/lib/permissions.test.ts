import { describe, it, expect } from 'vitest';
import { hasMinRole, canUpload, isAdmin, canSetNoExpiry, canBrowseContent } from '@/lib/permissions';

describe('permissions', () => {
	describe('hasMinRole', () => {
		it('admin has at least guest level', () => {
			expect(hasMinRole('admin', 'guest')).toBe(true);
		});
		it('admin has at least uploader level', () => {
			expect(hasMinRole('admin', 'uploader')).toBe(true);
		});
		it('admin has at least admin level', () => {
			expect(hasMinRole('admin', 'admin')).toBe(true);
		});
		it('uploader has at least guest level', () => {
			expect(hasMinRole('uploader', 'guest')).toBe(true);
		});
		it('uploader has at least uploader level', () => {
			expect(hasMinRole('uploader', 'uploader')).toBe(true);
		});
		it('uploader does NOT have admin level', () => {
			expect(hasMinRole('uploader', 'admin')).toBe(false);
		});
		it('guest has at least guest level', () => {
			expect(hasMinRole('guest', 'guest')).toBe(true);
		});
		it('guest does NOT have uploader level', () => {
			expect(hasMinRole('guest', 'uploader')).toBe(false);
		});
		it('guest does NOT have admin level', () => {
			expect(hasMinRole('guest', 'admin')).toBe(false);
		});
		it('unknown role returns false', () => {
			expect(hasMinRole('unknown', 'guest')).toBe(false);
		});
	});

	describe('canUpload', () => {
		it('admin can upload', () => expect(canUpload('admin')).toBe(true));
		it('uploader can upload', () => expect(canUpload('uploader')).toBe(true));
		it('guest can upload with limited quota', () => expect(canUpload('guest')).toBe(true));
	});

	describe('isAdmin', () => {
		it('admin is admin', () => expect(isAdmin('admin')).toBe(true));
		it('uploader is not admin', () => expect(isAdmin('uploader')).toBe(false));
		it('guest is not admin', () => expect(isAdmin('guest')).toBe(false));
	});

	describe('canSetNoExpiry', () => {
		it('admin can set no expiry', () => expect(canSetNoExpiry('admin')).toBe(true));
		it('uploader cannot set no expiry', () => expect(canSetNoExpiry('uploader')).toBe(false));
	});

	describe('canBrowseContent', () => {
		it('admin can browse content', () => expect(canBrowseContent('admin')).toBe(true));
		it('uploader cannot browse content', () => expect(canBrowseContent('uploader')).toBe(false));
		it('guest cannot browse content', () => expect(canBrowseContent('guest')).toBe(false));
	});
});
