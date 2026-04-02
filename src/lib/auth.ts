import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compareSync } from 'bcryptjs';
import { prisma } from './prisma';
import { authConfig } from './auth.config';

/** How often (ms) the JWT callback re-checks the DB to confirm the user still exists. */
const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// SECURITY: Login rate limiting — per-username to prevent brute-force attacks
// ---------------------------------------------------------------------------
const LOGIN_WINDOW_MS = 15 * 60_000; // 15-minute window
const LOGIN_MAX_ATTEMPTS = 5; // max 5 failed attempts per username per window
const LOGIN_CLEANUP_INTERVAL_MS = 5 * 60_000;

interface LoginAttempt {
	failures: number;
	resetAt: number;
}

/** @internal exported for testing only */
export const loginRateLimitMap = new Map<string, LoginAttempt>();
let loginLastCleanup = Date.now();

function cleanupLoginRateLimits() {
	const now = Date.now();
	if (now - loginLastCleanup < LOGIN_CLEANUP_INTERVAL_MS) return;
	loginLastCleanup = now;
	for (const [key, entry] of loginRateLimitMap) {
		if (now > entry.resetAt) {
			loginRateLimitMap.delete(key);
		}
	}
}

/**
 * Record a failed login attempt.
 * Returns `true` if the account is now locked out (too many failures).
 */
function recordLoginFailure(username: string): boolean {
	cleanupLoginRateLimits();
	const now = Date.now();
	const entry = loginRateLimitMap.get(username);

	if (!entry || now > entry.resetAt) {
		loginRateLimitMap.set(username, { failures: 1, resetAt: now + LOGIN_WINDOW_MS });
		return false;
	}

	entry.failures++;
	return entry.failures >= LOGIN_MAX_ATTEMPTS;
}

/** Check whether a username is currently locked out. */
function isLoginLocked(username: string): boolean {
	cleanupLoginRateLimits();
	const now = Date.now();
	const entry = loginRateLimitMap.get(username);
	if (!entry || now > entry.resetAt) return false;
	return entry.failures >= LOGIN_MAX_ATTEMPTS;
}

/** Clear the rate-limit entry on successful login. */
function clearLoginFailures(username: string) {
	loginRateLimitMap.delete(username);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
	...authConfig,
	callbacks: {
		...authConfig.callbacks,

		/**
		 * Enhanced JWT callback that periodically revalidates the user against
		 * the database.  If the user has been deleted or their role has changed
		 * the token is updated immediately.
		 */
		async jwt({ token, user }) {
			// Initial sign-in: populate custom claims from the authorize result
			if (user) {
				token.id = user.id;
				token.role = (user as { role: string }).role;
				token.revalidatedAt = Date.now();
				return token;
			}

			// Subsequent requests: periodically revalidate
			const lastCheck = (token.revalidatedAt as number) ?? 0;
			if (Date.now() - lastCheck > REVALIDATE_INTERVAL_MS) {
				const dbUser = await prisma.user.findUnique({
					where: { id: token.id as string },
					select: { id: true, role: true },
				});

				if (!dbUser) {
					// User was deleted — clear custom claims so `authorized` rejects
					token.id = undefined;
					token.role = undefined;
					token.revalidatedAt = undefined;
					return token;
				}

				// Refresh role in case an admin changed it
				token.role = dbUser.role;
				token.revalidatedAt = Date.now();
			}

			return token;
		},
	},
	providers: [
		Credentials({
			name: 'credentials',
			credentials: {
				username: { label: 'Username', type: 'text' },
				password: { label: 'Password', type: 'password' },
			},
			async authorize(credentials) {
				if (!credentials?.username || !credentials?.password) {
					return null;
				}

				const username = (credentials.username as string).trim();
				const password = credentials.password as string;

				// SECURITY: Rate limit — reject immediately if locked out
				if (isLoginLocked(username)) {
					return null;
				}

				const user = await prisma.user.findUnique({
					where: { username },
				});

				if (!user) {
					recordLoginFailure(username);
					return null;
				}

				const passwordValid = compareSync(password, user.passwordHash);
				if (!passwordValid) {
					recordLoginFailure(username);
					return null;
				}

				// Successful login — clear any prior failures
				clearLoginFailures(username);

				return {
					id: user.id,
					name: user.username,
					role: user.role,
				};
			},
		}),
	],
});
