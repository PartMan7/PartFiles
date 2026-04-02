import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/permissions';
import { hashSync } from 'bcryptjs';
import { ROLES } from '@/lib/config';
import { getBaseUrl } from '@/lib/url';
import { validateUsername } from '@/lib/username';
import { validatePasswordForStorage } from '@/lib/validation';

/** How long an invite link stays valid. */
const INVITE_EXPIRY_HOURS = 48;

/**
 * Placeholder hash that can never match a real bcrypt comparison.
 * Users created via invite cannot log in until they redeem the link.
 */
const INVITE_PLACEHOLDER_HASH = '!INVITE_PENDING';

export async function GET() {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const users = await prisma.user.findMany({
		select: {
			id: true,
			username: true,
			role: true,
			createdAt: true,
			updatedAt: true,
			_count: { select: { content: true } },
		},
		orderBy: { createdAt: 'desc' },
	});

	return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const body = await req.json();
		const { username, password, role, invite } = body;

		// --- Common validation ---
		if (!username) {
			return NextResponse.json({ error: 'Username is required' }, { status: 400 });
		}

		const usernameCheck = validateUsername(username);
		if (!usernameCheck.valid) {
			return NextResponse.json({ error: usernameCheck.error }, { status: 400 });
		}

		if (role && !ROLES.includes(role)) {
			return NextResponse.json({ error: `Invalid role. Must be one of: ${ROLES.join(', ')}` }, { status: 400 });
		}

		const existing = await prisma.user.findUnique({ where: { username: usernameCheck.normalized } });
		if (existing) {
			return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
		}

		// --- Mode: Invite link (no password from admin) ---
		if (invite) {
			const token = randomBytes(32).toString('hex');
			const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

			const user = await prisma.user.create({
				data: {
					username: usernameCheck.normalized,
					passwordHash: INVITE_PLACEHOLDER_HASH,
					role: role || 'guest',
					inviteTokens: {
						create: { token, expiresAt },
					},
				},
				select: {
					id: true,
					username: true,
					role: true,
					createdAt: true,
				},
			});

			const inviteUrl = `${getBaseUrl()}/invite/${token}`;

			return NextResponse.json({ user, inviteUrl }, { status: 201 });
		}

		// --- Mode: Direct password ---
		if (!password) {
			return NextResponse.json({ error: 'Password is required (or use invite mode)' }, { status: 400 });
		}

		const pw = validatePasswordForStorage(password);
		if (!pw.valid) {
			return NextResponse.json({ error: pw.error }, { status: 400 });
		}

		const user = await prisma.user.create({
			data: {
				username: usernameCheck.normalized,
				passwordHash: hashSync(password, 12),
				role: role || 'guest',
			},
			select: {
				id: true,
				username: true,
				role: true,
				createdAt: true,
			},
		});

		return NextResponse.json({ user }, { status: 201 });
	} catch (error) {
		console.error('Create user error:', error);
		return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
	}
}
