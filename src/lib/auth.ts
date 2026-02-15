import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compareSync } from 'bcryptjs';
import { prisma } from './prisma';
import { authConfig } from './auth.config';

/** How often (ms) the JWT callback re-checks the DB to confirm the user still exists. */
const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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

				const username = credentials.username as string;
				const password = credentials.password as string;

				const user = await prisma.user.findUnique({
					where: { username },
				});

				if (!user) {
					return null;
				}

				const passwordValid = compareSync(password, user.passwordHash);
				if (!passwordValid) {
					return null;
				}

				return {
					id: user.id,
					name: user.username,
					role: user.role,
				};
			},
		}),
	],
});
