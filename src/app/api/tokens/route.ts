import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/tokens';
import {
	MAX_ACTIVE_TOKENS,
	MAX_TOKEN_NAME_LENGTH,
	TOKEN_EXPIRY_DAYS,
	canGrantScope,
	canManageTokens,
	parseScopes,
} from '@/lib/token-scopes';

const CREATE_WINDOW_MS = 60_000;
const CREATE_MAX_PER_WINDOW = 10;
const createRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function allowCreate(userId: string): boolean {
	const now = Date.now();
	const entry = createRateLimitMap.get(userId);
	if (!entry || now > entry.resetAt) {
		createRateLimitMap.set(userId, { count: 1, resetAt: now + CREATE_WINDOW_MS });
		return true;
	}
	entry.count++;
	return entry.count <= CREATE_MAX_PER_WINDOW;
}

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Session-only on purpose: a token must never be able to mint or list tokens. */
export async function GET() {
	const session = await auth();
	if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	if (!canManageTokens(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

	const tokens = await prisma.apiToken.findMany({
		where: { userId: session.user.id },
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			name: true,
			prefix: true,
			scopes: true,
			expiresAt: true,
			lastUsedAt: true,
			revokedAt: true,
			createdAt: true,
		},
	});

	return NextResponse.json({ tokens: tokens.map(t => ({ ...t, scopes: t.scopes.split(',') })) }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
	const session = await auth();
	if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const { id: userId, role } = session.user;
	if (!canManageTokens(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

	if (!allowCreate(userId)) {
		return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
	}

	let body: { name?: unknown; scopes?: unknown; expiresInDays?: unknown };
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const name = typeof body.name === 'string' ? body.name.trim() : '';
	if (!name || name.length > MAX_TOKEN_NAME_LENGTH) {
		return NextResponse.json({ error: `Name is required (max ${MAX_TOKEN_NAME_LENGTH} characters)` }, { status: 400 });
	}

	const scopes = Array.isArray(body.scopes) ? parseScopes(body.scopes as string[]) : null;
	if (!scopes) return NextResponse.json({ error: 'Invalid scopes' }, { status: 400 });
	if (!scopes.every(s => canGrantScope(role, s))) {
		return NextResponse.json({ error: 'You cannot grant one or more of these scopes' }, { status: 403 });
	}

	const days = body.expiresInDays;
	if (days !== null && !(typeof days === 'number' && (TOKEN_EXPIRY_DAYS as readonly (number | null)[]).includes(days))) {
		return NextResponse.json({ error: 'Invalid expiry' }, { status: 400 });
	}

	const active = await prisma.apiToken.count({
		where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
	});
	if (active >= MAX_ACTIVE_TOKENS) {
		return NextResponse.json({ error: `Active token limit reached (${MAX_ACTIVE_TOKENS})` }, { status: 409 });
	}

	const { token, prefix, tokenHash } = generateToken();
	const expiresAt = days === null ? null : new Date(Date.now() + (days as number) * 86_400_000);

	const record = await prisma.apiToken.create({
		data: { userId, name, prefix, tokenHash, scopes: scopes.join(','), expiresAt },
	});

	return NextResponse.json(
		{
			token,
			info: { id: record.id, name, prefix, scopes, expiresAt: expiresAt?.toISOString() ?? null },
		},
		{ status: 201, headers: NO_STORE }
	);
}
