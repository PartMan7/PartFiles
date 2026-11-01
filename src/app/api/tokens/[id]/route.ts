import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageTokens } from '@/lib/token-scopes';

/** Revoke (soft): the row is kept for audit; revoked tokens stop authenticating immediately. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();
	if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	if (!canManageTokens(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

	const { id } = await params;
	const token = await prisma.apiToken.findFirst({ where: { id, userId: session.user.id } });
	if (!token) return NextResponse.json({ error: 'Token not found' }, { status: 404 });

	if (!token.revokedAt) {
		await prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
	}
	return NextResponse.json({ success: true });
}
