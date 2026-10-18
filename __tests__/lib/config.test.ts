import { describe, it, expect } from 'vitest';
import {
	ROLE_CONFIG,
	ROLES,
	ROLES_BY_LEVEL,
	STORAGE_LIMITS,
	expirySelectOptionsForRole,
	maxUploadFileSizeBytesForRole,
	roleSelectOptions,
} from '@/lib/config';
import { canSetNoExpiry, canUpload, getRoleLevel, isAdmin } from '@/lib/permissions';

describe('ROLE_CONFIG', () => {
	it('covers every ROLES entry', () => {
		for (const role of ROLES) {
			expect(ROLE_CONFIG[role]).toBeDefined();
		}
	});

	it('orders ROLES_BY_LEVEL by increasing level', () => {
		for (let i = 1; i < ROLES_BY_LEVEL.length; i++) {
			const prev = ROLE_CONFIG[ROLES_BY_LEVEL[i - 1]].level;
			const curr = ROLE_CONFIG[ROLES_BY_LEVEL[i]].level;
			expect(curr).toBeGreaterThan(prev);
		}
	});

	it('STORAGE_LIMITS matches ROLE_CONFIG storageLimitBytes', () => {
		for (const role of ROLES) {
			expect(STORAGE_LIMITS[role]).toBe(ROLE_CONFIG[role].storageLimitBytes);
		}
	});

	it('maxUploadFileSizeBytesForRole matches ROLE_CONFIG', () => {
		for (const role of ROLES) {
			expect(maxUploadFileSizeBytesForRole(role)).toBe(ROLE_CONFIG[role].maxFileSizeBytes);
		}
	});

	it('permission helpers align with ROLE_CONFIG flags', () => {
		for (const role of ROLES) {
			const policy = ROLE_CONFIG[role];
			expect(canUpload(role)).toBe(policy.canUpload);
			expect(canSetNoExpiry(role)).toBe(policy.canSetNoExpiry);
			expect(getRoleLevel(role)).toBe(policy.level);
			expect(isAdmin(role)).toBe(role === 'admin');
		}
	});

	it('expirySelectOptionsForRole includes off only when policy allows', () => {
		expect(expirySelectOptionsForRole('guest').some(o => o.value === 'off')).toBe(false);
		expect(expirySelectOptionsForRole('uploader').some(o => o.value === 'off')).toBe(true);
		expect(expirySelectOptionsForRole('admin').some(o => o.value === 'off')).toBe(true);
	});

	it('roleSelectOptions lists every role by level', () => {
		expect(roleSelectOptions().map(o => o.value)).toEqual(ROLES_BY_LEVEL);
	});
});
