import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashSync } from 'bcryptjs';
import { validatePasswordForStorage } from '@/lib/validation';

/**
 * GET  — Validate an invite token (used by the frontend to pre-check).
 * POST — Redeem an invite: set the user's password and consume the token.
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;

	const invite = await prisma.inviteToken.findUnique({
		where: { token },
		select: {
			id: true,
			expiresAt: true,
			usedAt: true,
			user: { select: { username: true } },
		},
	});

	if (!invite) {
		return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
	}

	if (invite.usedAt) {
		return NextResponse.json({ error: 'This invite link has already been used' }, { status: 410 });
	}

	if (new Date(invite.expiresAt) < new Date()) {
		return NextResponse.json({ error: 'This invite link has expired' }, { status: 410 });
	}

	return NextResponse.json({
		valid: true,
		username: invite.user.username,
	});
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;

	try {
		const body = await req.json();
		const { password } = body;

		if (!password || typeof password !== 'string') {
			return NextResponse.json({ error: 'Password is required' }, { status: 400 });
		}

		const pw = validatePasswordForStorage(password);
		if (!pw.valid) {
			return NextResponse.json({ error: pw.error }, { status: 400 });
		}

		const invite = await prisma.inviteToken.findUnique({
			where: { token },
			include: { user: { select: { id: true, username: true } } },
		});

		if (!invite) {
			return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
		}

		if (invite.usedAt) {
			return NextResponse.json({ error: 'This invite link has already been used' }, { status: 410 });
		}

		if (new Date(invite.expiresAt) < new Date()) {
			return NextResponse.json({ error: 'This invite link has expired' }, { status: 410 });
		}

		// Set the user's password and mark the token as used — atomically
		await prisma.$transaction([
			prisma.user.update({
				where: { id: invite.user.id },
				data: { passwordHash: hashSync(password, 12) },
			}),
			prisma.inviteToken.update({
				where: { id: invite.id },
				data: { usedAt: new Date() },
			}),
		]);

		return NextResponse.json({
			success: true,
			username: invite.user.username,
		});
	} catch (error) {
		console.error('Invite redemption error:', error);
		return NextResponse.json({ error: 'Failed to set password' }, { status: 500 });
	}
}
