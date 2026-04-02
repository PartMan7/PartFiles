import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/permissions';
import { hashSync } from 'bcryptjs';
import { ROLES } from '@/lib/config';
import { validateUsername } from '@/lib/username';
import { validatePasswordForStorage } from '@/lib/validation';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const { id } = await params;

	const user = await prisma.user.findUnique({
		where: { id },
		select: {
			id: true,
			username: true,
			role: true,
			createdAt: true,
			updatedAt: true,
			_count: { select: { content: true } },
		},
	});

	if (!user) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	return NextResponse.json({ user });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const { id } = await params;

	try {
		const body = await req.json();
		const { username, password, role } = body;

		const existing = await prisma.user.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		const updateData: Record<string, unknown> = {};

		if (username) {
			const usernameCheck = validateUsername(username);
			if (!usernameCheck.valid) {
				return NextResponse.json({ error: usernameCheck.error }, { status: 400 });
			}
			const duplicate = await prisma.user.findFirst({
				where: { username: usernameCheck.normalized, NOT: { id } },
			});
			if (duplicate) {
				return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
			}
			updateData.username = usernameCheck.normalized;
		}

		if (password) {
			const pw = validatePasswordForStorage(password);
			if (!pw.valid) {
				return NextResponse.json({ error: pw.error }, { status: 400 });
			}
			updateData.passwordHash = hashSync(password, 12);
		}

		if (role) {
			if (!ROLES.includes(role)) {
				return NextResponse.json({ error: `Invalid role. Must be one of: ${ROLES.join(', ')}` }, { status: 400 });
			}
			updateData.role = role;
		}

		const user = await prisma.user.update({
			where: { id },
			data: updateData,
			select: {
				id: true,
				username: true,
				role: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		return NextResponse.json({ user });
	} catch (error) {
		console.error('Update user error:', error);
		return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
	}
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();
	if (!session?.user || !isAdmin(session.user.role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const { id } = await params;

	// Prevent self-deletion
	if (id === session.user.id) {
		return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
	}

	const existing = await prisma.user.findUnique({ where: { id } });
	if (!existing) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	await prisma.user.delete({ where: { id } });

	return NextResponse.json({ success: true });
}
