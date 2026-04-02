import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/content/[id]/report/route';
import { mockUnauthenticated, mockPrisma } from '../setup';
import { parseResponse } from '../helpers';
import { NextRequest } from 'next/server';
import { REPORT_REASON_MAX_LENGTH } from '@/lib/content-report';
import { postDiscordWebhook } from '@/lib/discord-webhook';

vi.mock('@/lib/discord-webhook', () => ({
	postDiscordWebhook: vi.fn().mockResolvedValue(undefined),
}));

function makeReq(body: object) {
	return new NextRequest('http://localhost:3000/api/content/c1/report', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

describe('POST /api/content/[id]/report', () => {
	const prevWebhook = process.env.DISCORD_CONTENT_REPORT_WEBHOOK_URL;
	const prevUserId = process.env.DISCORD_CONTENT_REPORT_USER_ID;

	beforeEach(() => {
		mockUnauthenticated();
		vi.mocked(postDiscordWebhook).mockClear();
		delete process.env.DISCORD_CONTENT_REPORT_WEBHOOK_URL;
		delete process.env.DISCORD_CONTENT_REPORT_USER_ID;
	});

	afterEach(() => {
		if (prevWebhook === undefined) delete process.env.DISCORD_CONTENT_REPORT_WEBHOOK_URL;
		else process.env.DISCORD_CONTENT_REPORT_WEBHOOK_URL = prevWebhook;
		if (prevUserId === undefined) delete process.env.DISCORD_CONTENT_REPORT_USER_ID;
		else process.env.DISCORD_CONTENT_REPORT_USER_ID = prevUserId;
	});

	it('returns 400 when reason is empty', async () => {
		const { status } = await parseResponse(await POST(makeReq({ reason: '   ' }), { params: Promise.resolve({ id: 'c1' }) }));
		expect(status).toBe(400);
		expect(postDiscordWebhook).not.toHaveBeenCalled();
	});

	it('returns 400 when reason exceeds max length', async () => {
		const long = 'a'.repeat(REPORT_REASON_MAX_LENGTH + 1);
		const { status } = await parseResponse(await POST(makeReq({ reason: long }), { params: Promise.resolve({ id: 'c1' }) }));
		expect(status).toBe(400);
		expect(postDiscordWebhook).not.toHaveBeenCalled();
	});

	it('returns 404 when content is missing', async () => {
		mockPrisma.content.findUnique.mockResolvedValue(null);
		const { status } = await parseResponse(await POST(makeReq({ reason: 'spam' }), { params: Promise.resolve({ id: 'missing' }) }));
		expect(status).toBe(404);
		expect(postDiscordWebhook).not.toHaveBeenCalled();
	});

	it('returns 200 and calls Discord webhook with mention and reason', async () => {
		mockPrisma.content.findUnique.mockResolvedValue({
			id: 'c1',
			filename: 'x.png',
			uploadedBy: { username: 'u1', role: 'guest' },
		});
		process.env.DISCORD_CONTENT_REPORT_WEBHOOK_URL = 'https://discord.test/webhook';
		process.env.DISCORD_CONTENT_REPORT_USER_ID = '987654';

		const { status } = await parseResponse(
			await POST(makeReq({ reason: 'policy violation' }), { params: Promise.resolve({ id: 'c1' }) })
		);
		expect(status).toBe(200);
		expect(postDiscordWebhook).toHaveBeenCalledTimes(1);
		const [url, message] = vi.mocked(postDiscordWebhook).mock.calls[0];
		expect(url).toBe('https://discord.test/webhook');
		expect(message).toContain('<@987654>');
		expect(message).toContain('**Reason:** policy violation');
		expect(message).toContain('/c/c1');
		expect(message).toContain('**Uploaded by:** u1 (guest)');
	});
});
