import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
	createSyncCode,
	consumeSyncCode,
	isAllowedReturnTo,
	getSessionCookieFromRequest,
	getSessionCookieName,
} from '@/lib/session-sync';

const CONTENT_URL = process.env.CONTENT_URL || process.env.NEXT_PUBLIC_CONTENT_URL || '';
const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || '';

/**
 * Shared session-sync endpoint. Behaviour depends on query params and origin:
 *
 * - On BASE_URL with ?return_to=... (no code): if user has session, create a one-time
 *   code, redirect to CONTENT_URL/api/auth/session-sync?code=...&return_to=...
 *
 * - With ?code=...&return_to=...: CONTENT_URL server exchanges the code with BASE_URL
 *   (server-to-server), sets the session cookie, and redirects to return_to. The
 *   session cookie is never sent in a URL.
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const codeParam = searchParams.get('code');
	const returnToParam = searchParams.get('return_to') ?? '';

	const contentUrl = CONTENT_URL ? CONTENT_URL.replace(/\/$/, '') : null;
	const baseUrl = BASE_URL ? BASE_URL.replace(/\/$/, '') : null;
	const urlsDiffer = contentUrl && baseUrl && contentUrl !== baseUrl;

	// --- Receiver: exchange code (server-side), set cookie and redirect ---
	if (codeParam) {
		// Prefer server-side exchange so session cookie never hits the browser URL
		const exchangeUrl = baseUrl
			? new URL('/api/auth/session-sync/exchange', baseUrl)
			: new URL('/api/auth/session-sync/exchange', request.url);
		exchangeUrl.searchParams.set('code', codeParam);
		let payload: { token: string; return_to: string } | null = null;
		try {
			const res = await fetch(exchangeUrl.toString(), { cache: 'no-store' });
			if (res.ok) payload = (await res.json()) as { token: string; return_to: string };
		} catch {
			// Fallback: if same process (e.g. single instance), consume locally
			payload = consumeSyncCode(codeParam);
		}
		if (!payload) {
			return NextResponse.redirect(new URL('/login', request.url));
		}
		const allowedOrigin = contentUrl ? new URL(contentUrl).origin : new URL(request.url).origin;
		const returnUrl =
			payload.return_to.startsWith('/') ? `${allowedOrigin}${payload.return_to}` : payload.return_to;
		try {
			if (new URL(returnUrl).origin !== allowedOrigin) {
				return NextResponse.redirect(new URL('/login', request.url));
			}
		} catch {
			return NextResponse.redirect(new URL('/login', request.url));
		}

		const cookieName = getSessionCookieName();
		const res = NextResponse.redirect(returnUrl);
		res.cookies.set(cookieName, payload.token, {
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 30 * 24 * 60 * 60, // 30 days, match NextAuth
		});
		return res;
	}

	// --- Issuer: only when BASE_URL and CONTENT_URL differ ---
	if (!urlsDiffer || !contentUrl) {
		return NextResponse.redirect(new URL('/login', request.url));
	}

	if (!returnToParam || !isAllowedReturnTo(returnToParam, contentUrl)) {
		return NextResponse.redirect(new URL('/login', request.url));
	}

	const session = await auth();
	if (!session?.user) {
		const loginUrl = new URL('/login', baseUrl || request.url);
		loginUrl.searchParams.set(
			'callbackUrl',
			`/api/auth/session-sync?return_to=${encodeURIComponent(returnToParam)}`
		);
		return NextResponse.redirect(loginUrl);
	}

	const cookieStore = Object.fromEntries(
		request.cookies.getAll().map((c) => [c.name, c.value])
	);
	const sessionCookie = getSessionCookieFromRequest(cookieStore);
	if (!sessionCookie) {
		return NextResponse.redirect(new URL('/login', request.url));
	}

	const code = createSyncCode(sessionCookie, returnToParam);
	const contentSyncUrl = new URL('/api/auth/session-sync', contentUrl);
	contentSyncUrl.searchParams.set('code', code);
	contentSyncUrl.searchParams.set('return_to', returnToParam);
	return NextResponse.redirect(contentSyncUrl);
}
