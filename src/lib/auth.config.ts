import type { NextAuthConfig } from 'next-auth';

/**
 * Resolve the public-facing origin from headers (X-Forwarded-Host/Proto)
 * or fallback to the request's default origin.
 */
function getRequestOrigin(nextUrl: URL, headers: Headers): string {
	const forwardedHost = headers.get('x-forwarded-host');
	const forwardedProto = headers.get('x-forwarded-proto') || 'https';
	return forwardedHost ? `${forwardedProto}://${forwardedHost}` : nextUrl.origin;
}

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
		authorized({ auth, request: { nextUrl, headers } }) {
			const role = auth?.user?.role as string | undefined;
			const isLoggedIn = !!auth?.user && !!role;
			const pathname = nextUrl.pathname;

			// Public paths (cron is protected by its own secret header check)
			if (
				pathname.startsWith('/login') ||
				pathname.startsWith('/invite') ||
				pathname.startsWith('/api/auth') ||
				pathname.startsWith('/api/invite') ||
				pathname.startsWith('/api/preview') ||
				/^(\/api\/content\/[^/]+(\/raw)?)$/.test(pathname) ||
				/^(\/(c|r|s|e)\/[^/]+)$/.test(pathname) ||
				pathname.startsWith('/api/cron')
			) {
				return true;
			}

			const origin = getRequestOrigin(nextUrl, headers);

			if (!isLoggedIn) {
				// Fix callbackUrl using localhost when hosted behind a proxy.
				if (headers.get('x-forwarded-host')) {
					const loginUrl = new URL('/login', origin);
					loginUrl.searchParams.set('callbackUrl', nextUrl.pathname + nextUrl.search);
					return Response.redirect(loginUrl);
				}
				return false; // Redirect to login (default behavior)
			}

			// Admin-only routes
			if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
				if (role !== 'admin') {
					return Response.redirect(new URL('/dashboard', origin));
				}
			}

			// Upload routes: uploader or admin
			if (pathname === '/upload' || pathname.startsWith('/api/upload')) {
				if (role !== 'admin' && role !== 'uploader') {
					return Response.redirect(new URL('/dashboard', origin));
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
