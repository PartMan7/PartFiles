import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/register/route';
import { mockPrisma } from '../setup';
import { parseResponse } from '../helpers';
import { NextRequest } from 'next/server';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { MAX_SELF_REGISTERED_GUESTS_PER_UTC_DAY } from '@/lib/self-registration';
import { postDiscordWebhook } from '@/lib/discord-webhook';

vi.mock('@/lib/discord-webhook', () => ({
	postDiscordWebhook: vi.fn().mockResolvedValue(undefined),
}));

function makeReq(body: object) {
	return new NextRequest('http://localhost:3000/api/register', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

describe('POST /api/register', () => {
	beforeEach(() => {
		vi.mocked(postDiscordWebhook).mockClear();
		mockPrisma.user.count.mockReset();
		mockPrisma.user.findUnique.mockReset();
		mockPrisma.user.create.mockReset();
		mockPrisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
			Promise.resolve({ id: 'new-user-id', ...data })
		);
	});

	it('returns 400 when password is shorter than minimum', async () => {
		const { status, body } = await parseResponse(
			await POST(makeReq({ username: 'validuser', password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1) }))
		);
		expect(status).toBe(400);
		expect(body?.error).toContain('at least');
		expect(postDiscordWebhook).not.toHaveBeenCalled();
	});

	it('returns 400 when password exceeds max length', async () => {
		const { status, body } = await parseResponse(
			await POST(
				makeReq({
					username: 'validuser',
					password: 'a'.repeat(MAX_PASSWORD_LENGTH + 1),
				})
			)
		);
		expect(status).toBe(400);
		expect(body?.error).toContain('at most');
		expect(postDiscordWebhook).not.toHaveBeenCalled();
	});

	it('returns 409 when username is already taken', async () => {
		mockPrisma.user.count.mockResolvedValue(0);
		mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'validuser' });

		const { status, body } = await parseResponse(await POST(makeReq({ username: 'validuser', password: 'password12' })));
		expect(status).toBe(409);
		expect(body?.error).toBe('Username already taken');
		expect(mockPrisma.user.create).not.toHaveBeenCalled();
		expect(postDiscordWebhook).not.toHaveBeenCalled();
	});

	it('returns 429 when daily self-registration cap is reached', async () => {
		mockPrisma.user.count.mockResolvedValue(MAX_SELF_REGISTERED_GUESTS_PER_UTC_DAY);

		const { status, body } = await parseResponse(await POST(makeReq({ username: 'newperson', password: 'password12' })));
		expect(status).toBe(429);
		expect(String(body?.error)).toContain(String(MAX_SELF_REGISTERED_GUESTS_PER_UTC_DAY));
		expect(String(body?.error)).toMatch(/Try again after /);
		expect(mockPrisma.user.create).not.toHaveBeenCalled();
		expect(postDiscordWebhook).not.toHaveBeenCalled();
	});

	it('returns 201 and notifies Discord on success', async () => {
		mockPrisma.user.count.mockResolvedValueOnce(0).mockResolvedValue(1);
		mockPrisma.user.findUnique.mockResolvedValue(null);
		process.env.DISCORD_GUEST_SIGNUP_WEBHOOK_URL = 'https://discord.test/signup';

		const { status, body } = await parseResponse(await POST(makeReq({ username: 'newbie', password: 'password12' })));
		expect(status).toBe(201);
		expect(body?.success).toBe(true);
		expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
		expect(postDiscordWebhook).toHaveBeenCalledTimes(1);
		const [url, line] = vi.mocked(postDiscordWebhook).mock.calls[0];
		expect(url).toBe('https://discord.test/signup');
		expect(line).toContain('newbie');
		expect(line).toContain('1 signup(s) today');

		delete process.env.DISCORD_GUEST_SIGNUP_WEBHOOK_URL;
	});
});
