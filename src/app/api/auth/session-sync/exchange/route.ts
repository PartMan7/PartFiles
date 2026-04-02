import { NextRequest, NextResponse } from 'next/server';
import { consumeSyncCode } from '@/lib/session-sync';

/**
 * Server-to-server only: exchange a one-time code for the session token and return_to.
 * Called by CONTENT_URL server when it receives the redirect with ?code=...
 * The session cookie is never sent to the browser in a URL.
 */
export async function GET(request: NextRequest) {
	const code = request.nextUrl.searchParams.get('code');
	if (!code) {
		return NextResponse.json({ error: 'Missing code' }, { status: 400 });
	}
	const payload = consumeSyncCode(code);
	if (!payload) {
		return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
	}
	return NextResponse.json(payload);
}
