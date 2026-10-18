import { ROLE_CONFIG, type Role, roleLevel as configRoleLevel, rolePolicy, isKnownRole } from './config';

/**
 * Check if a role has at least the specified minimum role level.
 */
export function hasMinRole(userRole: string, minRole: Role): boolean {
	const userLevel = configRoleLevel(userRole);
	const minLevel = ROLE_CONFIG[minRole].level;
	if (userLevel < 0) return false;
	return userLevel >= minLevel;
}

/**
 * Check if a user can upload content (guests have a small quota; see ROLE_CONFIG).
 */
export function canUpload(role: string): boolean {
	return rolePolicy(role)?.canUpload ?? false;
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
 * Check if a role can set content to never expire.
 */
export function canSetNoExpiry(role: string): boolean {
	return rolePolicy(role)?.canSetNoExpiry ?? false;
}

/**
 * Check if a user can open the “my uploads” list (GET /api/content scoped to self for non-admins).
 */
export function canBrowseContent(role: string): boolean {
	return rolePolicy(role)?.canBrowseContent ?? false;
}

/** Numeric privilege level for UI (e.g. nav). Unknown roles return -1. */
export function getRoleLevel(role: string): number {
	return configRoleLevel(role);
}

export { isKnownRole };
