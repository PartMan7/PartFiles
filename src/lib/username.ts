/**
 * Usernames are case-sensitive, 3–50 chars, letters, digits, underscore, hyphen.
 */
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,50}$/;

export function validateUsername(username: string): { valid: boolean; normalized: string; error?: string } {
	const normalized = username.trim();
	if (normalized.length < 3 || normalized.length > 50) {
		return {
			valid: false,
			normalized,
			error: 'Username must be 3-50 characters',
		};
	}
	if (!USERNAME_PATTERN.test(normalized)) {
		return {
			valid: false,
			normalized,
			error: 'Username may only contain letters, numbers, underscores, and hyphens',
		};
	}
	return { valid: true, normalized };
}
