import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isGuestRole } from '@/lib/permissions';
import { postDiscordWebhook } from '@/lib/discord-webhook';

const PENDING_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_JUSTIFICATION_LEN = 200;

export async function GET() {
	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!isGuestRole(session.user.role)) {
		return NextResponse.json({ error: 'Only guest accounts may request an upgrade' }, { status: 403 });
	}

	const row = await prisma.guestUpgradeRequest.findUnique({
		where: { userId: session.user.id },
		select: { requestedAt: true },
	});

	if (!row) {
		return NextResponse.json({ status: 'none' as const });
	}

	const pendingUntil = new Date(row.requestedAt.getTime() + PENDING_MS);
	if (Date.now() < pendingUntil.getTime()) {
		return NextResponse.json({
			status: 'pending' as const,
			pendingUntil: pendingUntil.toISOString(),
		});
	}

	return NextResponse.json({ status: 'eligible' as const });
}

export async function POST(req: NextRequest) {
	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!isGuestRole(session.user.role)) {
		return NextResponse.json({ error: 'Only guest accounts may request an upgrade' }, { status: 403 });
	}

	let body: { justification?: string };
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const justification = typeof body.justification === 'string' ? body.justification.trim() : '';
	if (!justification) {
		return NextResponse.json({ error: 'Justification is required' }, { status: 400 });
	}
	if (justification.length > MAX_JUSTIFICATION_LEN) {
		return NextResponse.json({ error: `Justification must be at most ${MAX_JUSTIFICATION_LEN} characters` }, { status: 400 });
	}

	const userId = session.user.id;
	const dbUser = await prisma.user.findUnique({
		where: { id: userId },
		select: { username: true },
	});
	const username = dbUser?.username ?? session.user.name ?? 'unknown';

	const existing = await prisma.guestUpgradeRequest.findUnique({
		where: { userId },
		select: { requestedAt: true },
	});

	if (existing) {
		const pendingUntil = new Date(existing.requestedAt.getTime() + PENDING_MS);
		if (Date.now() < pendingUntil.getTime()) {
			return NextResponse.json({ error: 'A request is already being reviewed.' }, { status: 409 });
		}
		await prisma.guestUpgradeRequest.delete({ where: { userId } });
	}

	const usage = await prisma.content.aggregate({
		where: {
			uploadedById: userId,
			OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
		},
		_sum: { fileSize: true },
	});
	const contentSizeBytes = usage._sum.fileSize ?? 0;

	await prisma.guestUpgradeRequest.create({
		data: {
			userId,
			justification,
			contentSizeBytes,
		},
	});

	const hook = process.env.DISCORD_ACCOUNT_UPGRADE_WEBHOOK_URL;
	const mb = (contentSizeBytes / (1024 * 1024)).toFixed(2);
	const msg = [
		'**Account upgrade request**',
		`Username: **${username}**`,
		`Current content size: **${mb} MB** (${contentSizeBytes} bytes)`,
		`Justification: ${justification}`,
	].join('\n');
	void postDiscordWebhook(hook, msg);

	return NextResponse.json({ success: true }, { status: 201 });
}
