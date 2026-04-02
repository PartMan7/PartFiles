import { prisma } from '@/lib/prisma';

/** All configured Discord webhooks share this cap (UTC hour bucket, resets at :00). */
export const DISCORD_WEBHOOK_MAX_PER_UTC_HOUR = 5;

export function discordWebhookUtcHourBucket(now = new Date()): string {
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, '0');
	const d = String(now.getUTCDate()).padStart(2, '0');
	const h = String(now.getUTCHours()).padStart(2, '0');
	return `${y}-${m}-${d}T${h}`;
}

/**
 * Reserve one slot in the current UTC hour. Returns false when the combined hourly cap is reached.
 */
async function reserveDiscordWebhookSlot(): Promise<boolean> {
	const hourBucketUtc = discordWebhookUtcHourBucket();
	return prisma.$transaction(async tx => {
		const updated = await tx.discordWebhookHourQuota.updateMany({
			where: { hourBucketUtc, count: { lt: DISCORD_WEBHOOK_MAX_PER_UTC_HOUR } },
			data: { count: { increment: 1 } },
		});
		if (updated.count > 0) return true;

		const row = await tx.discordWebhookHourQuota.findUnique({ where: { hourBucketUtc } });
		if (row && row.count >= DISCORD_WEBHOOK_MAX_PER_UTC_HOUR) return false;

		try {
			await tx.discordWebhookHourQuota.create({ data: { hourBucketUtc, count: 1 } });
			return true;
		} catch {
			const updated2 = await tx.discordWebhookHourQuota.updateMany({
				where: { hourBucketUtc, count: { lt: DISCORD_WEBHOOK_MAX_PER_UTC_HOUR } },
				data: { count: { increment: 1 } },
			});
			return updated2.count > 0;
		}
	});
}

/**
 * Fire-and-forget Discord incoming webhook posts. Failures are logged only.
 * Throttled to {@link DISCORD_WEBHOOK_MAX_PER_UTC_HOUR} posts per UTC hour across all webhooks.
 */
export async function postDiscordWebhook(webhookUrl: string | undefined, content: string): Promise<void> {
	if (!webhookUrl) {
		if (process.env.NODE_ENV === 'development') console.log(content);
		return;
	}
	const allowed = await reserveDiscordWebhookSlot();
	if (!allowed) {
		console.warn('Discord webhook skipped: hourly limit reached (5 per UTC hour, shared across all webhook URLs)');
		return;
	}
	try {
		const res = await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content: content.slice(0, 2000) }),
		});
		if (!res.ok) {
			console.error('Discord webhook non-OK:', res.status);
		}
	} catch (e) {
		console.error('Discord webhook failed:', e);
	}
}
