import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/account/upgrade-request/route';
import { mockUnauthenticated, mockGuest, mockUploader, mockPrisma } from '../setup';
import { parseResponse } from '../helpers';
import { NextRequest } from 'next/server';
import { postDiscordWebhook } from '@/lib/discord-webhook';

vi.mock('@/lib/discord-webhook', () => ({
	postDiscordWebhook: vi.fn().mockResolvedValue(undefined),
}));

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const EIGHT_DAYS_MS = 8 * ONE_DAY_MS;

function jsonPost(body: object) {
	return new NextRequest('http://localhost:3000/api/account/upgrade-request', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

describe('GET /api/account/upgrade-request', () => {
	it('returns 401 when unauthenticated', async () => {
		mockUnauthenticated();
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it('returns 403 when user is not a guest', async () => {
		mockUploader();
		const res = await GET();
		expect(res.status).toBe(403);
	});

	it('returns status none when no prior request', async () => {
		mockGuest();
		mockPrisma.guestUpgradeRequest.findUnique.mockResolvedValue(null);
		const res = await GET();
		const body = (await res.json()) as { status: string };
		expect(res.status).toBe(200);
		expect(body.status).toBe('none');
	});

	it('returns status pending when request is within review window', async () => {
		mockGuest();
		const requestedAt = new Date(Date.now() - ONE_DAY_MS);
		mockPrisma.guestUpgradeRequest.findUnique.mockResolvedValue({ requestedAt });
		const res = await GET();
		const body = (await res.json()) as { status: string; pendingUntil?: string };
		expect(res.status).toBe(200);
		expect(body.status).toBe('pending');
		expect(body.pendingUntil).toBeDefined();
	});

	it('returns status eligible when prior request is outside review window', async () => {
		mockGuest();
		const requestedAt = new Date(Date.now() - EIGHT_DAYS_MS);
		mockPrisma.guestUpgradeRequest.findUnique.mockResolvedValue({ requestedAt });
		const res = await GET();
		const body = (await res.json()) as { status: string };
		expect(res.status).toBe(200);
		expect(body.status).toBe('eligible');
	});
});

describe('POST /api/account/upgrade-request', () => {
	beforeEach(() => {
		vi.mocked(postDiscordWebhook).mockClear();
		mockPrisma.user.findUnique.mockResolvedValue({ username: 'guestuser' });
		mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 1024 }, _count: 1 });
	});

	it('returns 401 when unauthenticated', async () => {
		mockUnauthenticated();
		const { status } = await parseResponse(await POST(jsonPost({ justification: 'Need more space' })));
		expect(status).toBe(401);
	});

	it('returns 403 when user is not a guest', async () => {
		mockUploader();
		const { status } = await parseResponse(await POST(jsonPost({ justification: 'Need more space' })));
		expect(status).toBe(403);
	});

	it('returns 400 for invalid JSON', async () => {
		mockGuest();
		const req = new NextRequest('http://localhost:3000/api/account/upgrade-request', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: 'not-json',
		});
		const { status, body } = await parseResponse(await POST(req));
		expect(status).toBe(400);
		expect(body?.error).toBe('Invalid JSON');
	});

	it('returns 400 when justification is empty', async () => {
		mockGuest();
		mockPrisma.guestUpgradeRequest.findUnique.mockResolvedValue(null);
		const { status } = await parseResponse(await POST(jsonPost({ justification: '   ' })));
		expect(status).toBe(400);
	});

	it('returns 400 when justification is too long', async () => {
		mockGuest();
		mockPrisma.guestUpgradeRequest.findUnique.mockResolvedValue(null);
		const { status } = await parseResponse(await POST(jsonPost({ justification: 'x'.repeat(201) })));
		expect(status).toBe(400);
	});

	it('returns 409 when a request is already pending review', async () => {
		mockGuest();
		const requestedAt = new Date(Date.now() - ONE_DAY_MS);
		mockPrisma.guestUpgradeRequest.findUnique.mockResolvedValue({ requestedAt });
		const { status, body } = await parseResponse(await POST(jsonPost({ justification: 'Please upgrade me' })));
		expect(status).toBe(409);
		expect(body?.error).toContain('already being reviewed');
		expect(mockPrisma.guestUpgradeRequest.create).not.toHaveBeenCalled();
		expect(postDiscordWebhook).not.toHaveBeenCalled();
	});

	it('returns 201, persists request, and posts to Discord when eligible', async () => {
		mockGuest();
		mockPrisma.guestUpgradeRequest.findUnique.mockResolvedValue(null);
		process.env.DISCORD_ACCOUNT_UPGRADE_WEBHOOK_URL = 'https://discord.test/upgrade';

		const { status, body } = await parseResponse(await POST(jsonPost({ justification: 'I need uploader role for work' })));
		expect(status).toBe(201);
		expect(body?.success).toBe(true);
		expect(mockPrisma.guestUpgradeRequest.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				userId: 'guest-id',
				justification: 'I need uploader role for work',
				contentSizeBytes: 1024,
			}),
		});
		expect(postDiscordWebhook).toHaveBeenCalledTimes(1);
		const [url, msg] = vi.mocked(postDiscordWebhook).mock.calls[0];
		expect(url).toBe('https://discord.test/upgrade');
		expect(msg).toContain('guestuser');
		expect(msg).toContain('I need uploader role for work');

		delete process.env.DISCORD_ACCOUNT_UPGRADE_WEBHOOK_URL;
	});

	it('deletes stale request and creates a new one when past review window', async () => {
		mockGuest();
		const requestedAt = new Date(Date.now() - EIGHT_DAYS_MS);
		mockPrisma.guestUpgradeRequest.findUnique.mockResolvedValue({ requestedAt });

		const { status } = await parseResponse(await POST(jsonPost({ justification: 'Second try' })));
		expect(status).toBe(201);
		expect(mockPrisma.guestUpgradeRequest.delete).toHaveBeenCalledWith({ where: { userId: 'guest-id' } });
		expect(mockPrisma.guestUpgradeRequest.create).toHaveBeenCalled();
	});
});
