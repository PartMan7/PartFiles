import { type Role } from './config';

const ROLE_HIERARCHY: Record<Role, number> = {
	guest: 0,
	uploader: 1,
	admin: 2,
};

/**
 * Check if a role has at least the specified minimum role level.
 */
export function hasMinRole(userRole: string, minRole: Role): boolean {
	const userLevel = ROLE_HIERARCHY[userRole as Role];
	const minLevel = ROLE_HIERARCHY[minRole];
	if (userLevel === undefined || minLevel === undefined) return false;
	return userLevel >= minLevel;
}

/**
 * Check if a user can upload content (guests have a small quota; see config).
 */
export function canUpload(role: string): boolean {
	return hasMinRole(role, 'guest');
}

export function isGuestRole(role: string): boolean {
	return role === 'guest';
}

/**
 * Check if a user can manage other users and all content.
 */
export function isAdmin(role: string): boolean {
	return hasMinRole(role, 'admin');
}

/**
 * Check if an expiry value is valid for the given role.
 * Uploaders MUST have an expiry. Admins can have no expiry.
 */
export function canSetNoExpiry(role: string): boolean {
	return isAdmin(role);
}

/**
 * Check if a user can open the “my uploads” list (GET /api/content scoped to self for non-admins).
 */
export function canBrowseContent(role: string): boolean {
	return hasMinRole(role, 'guest');
}
