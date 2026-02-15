import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
	pages: {
		signIn: '/login',
	},
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id;
				token.role = (user as { role: string }).role;
			}
			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				session.user.id = token.id as string;
				session.user.role = token.role as string;
			}
			return session;
		},
		authorized({ auth, request: { nextUrl } }) {
			const role = auth?.user?.role as string | undefined;
			const isLoggedIn = !!auth?.user && !!role;
			const pathname = nextUrl.pathname;

			// Public paths (cron is protected by its own secret header check)
			if (pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.startsWith('/api/cron')) {
				return true;
			}

			if (!isLoggedIn) {
				return false; // Redirect to login
			}

			// Admin-only routes
			if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
				if (role !== 'admin') {
					return Response.redirect(new URL('/dashboard', nextUrl.origin));
				}
			}

			// Upload routes: uploader or admin
			if (pathname === '/upload' || pathname.startsWith('/api/upload')) {
				if (role !== 'admin' && role !== 'uploader') {
					return Response.redirect(new URL('/dashboard', nextUrl.origin));
				}
			}

			return true;
		},
	},
	providers: [], // Providers are added in auth.ts
	session: {
		strategy: 'jwt',
	},
};
