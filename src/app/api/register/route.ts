import { NextRequest, NextResponse } from 'next/server';
import { hashSync } from 'bcryptjs';
import { validateUsername } from '@/lib/username';
import { validatePasswordForStorage } from '@/lib/validation';
import { postDiscordWebhook } from '@/lib/discord-webhook';
import {
	countSelfRegisteredUsersCreatedTodayUtc,
	MAX_SELF_REGISTERED_GUESTS_PER_UTC_DAY,
	tryCreateSelfRegisteredGuest,
} from '@/lib/self-registration';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const usernameRaw = body.username as string | undefined;
		const password = body.password as string | undefined;

		if (!usernameRaw || !password) {
			return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
		}

		const u = validateUsername(usernameRaw);
		if (!u.valid) {
			return NextResponse.json({ error: u.error }, { status: 400 });
		}

		const pw = validatePasswordForStorage(password);
		if (!pw.valid) {
			return NextResponse.json({ error: pw.error }, { status: 400 });
		}

		const created = await tryCreateSelfRegisteredGuest({
			username: u.normalized,
			passwordHash: hashSync(password, 12),
		});

		if (!created.ok) {
			if (created.error === 'daily_cap') {
				return NextResponse.json(
					{
						error: `Self-service registration is limited to ${MAX_SELF_REGISTERED_GUESTS_PER_UTC_DAY} accounts per day (UTC). Try again after ${created.nextDayStart.toISOString()}.`,
					},
					{ status: 429 }
				);
			}
			return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
		}

		const countAfter = await countSelfRegisteredUsersCreatedTodayUtc();
		const signupUrl = process.env.DISCORD_GUEST_SIGNUP_WEBHOOK_URL;
		const alertUserId = process.env.DISCORD_REGISTRATION_ALERT_USER_ID;
		let line = `New self-registered guest: **${u.normalized}** (${countAfter} signup(s) today, UTC)`;
		if (countAfter >= 5 && alertUserId) {
			line = `<@${alertUserId}> ${line}`;
		}
		void postDiscordWebhook(signupUrl, line);

		return NextResponse.json({ success: true }, { status: 201 });
	} catch (error) {
		console.error('Register error:', error);
		return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
	}
}
