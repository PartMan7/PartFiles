import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { postDiscordWebhook } from '@/lib/discord-webhook';
import { getContentUrl } from '@/lib/url';
import { REPORT_REASON_MAX_LENGTH } from '@/lib/content-report';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await ctx.params;
		const body = await req.json().catch(() => ({}));
		const reasonRaw = typeof body.reason === 'string' ? body.reason : '';
		const trimmed = reasonRaw.trim();
		if (!trimmed) {
			return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
		}
		if (trimmed.length > REPORT_REASON_MAX_LENGTH) {
			return NextResponse.json({ error: `Reason must be at most ${REPORT_REASON_MAX_LENGTH} characters` }, { status: 400 });
		}

		const content = await prisma.content.findUnique({
			where: { id },
			include: { uploadedBy: { select: { username: true, role: true } } },
		});
		if (!content) {
			return NextResponse.json({ error: 'Not found' }, { status: 404 });
		}

		const webhookUrl = process.env.DISCORD_CONTENT_REPORT_WEBHOOK_URL;
		const mentionUserId = process.env.DISCORD_CONTENT_REPORT_USER_ID;
		const base = getContentUrl();
		const header = mentionUserId ? `<@${mentionUserId}> **Content report**` : '**Content report**';
		const message = [
			header,
			`**File:** ${content.filename}`,
			`**Link:** ${base}/c/${content.id}`,
			`**Uploaded by:** ${content.uploadedBy.username} (${content.uploadedBy.role})`,
			`**Reason:** ${trimmed}`,
		].join('\n');

		void postDiscordWebhook(webhookUrl, message);

		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error('Content report error:', e);
		return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
	}
}
