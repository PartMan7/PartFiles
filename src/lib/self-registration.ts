import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/** Max self-service guest sign-ups per UTC calendar day (enforced inside a DB transaction). */
export const MAX_SELF_REGISTERED_GUESTS_PER_UTC_DAY = 10;

export function utcCalendarDayBounds(now = new Date()): { start: Date; nextDayStart: Date } {
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
	const nextDayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
	return { start, nextDayStart };
}

export async function countSelfRegisteredUsersCreatedTodayUtc(): Promise<number> {
	const { start, nextDayStart } = utcCalendarDayBounds();
	return prisma.user.count({
		where: {
			selfRegistered: true,
			createdAt: { gte: start, lt: nextDayStart },
		},
	});
}

export type SelfRegisterResult =
	| { ok: true }
	| { ok: false; error: 'daily_cap'; nextDayStart: Date }
	| { ok: false; error: 'username_taken' };

/**
 * Atomically enforce the daily self-registration cap and create the user.
 * Username uniqueness races surface as `username_taken`.
 */
export async function tryCreateSelfRegisteredGuest(params: { username: string; passwordHash: string }): Promise<SelfRegisterResult> {
	const { start, nextDayStart } = utcCalendarDayBounds();
	try {
		await prisma.$transaction(async tx => {
			const n = await tx.user.count({
				where: {
					selfRegistered: true,
					createdAt: { gte: start, lt: nextDayStart },
				},
			});
			if (n >= MAX_SELF_REGISTERED_GUESTS_PER_UTC_DAY) {
				throw new SelfRegistrationDailyCapError(nextDayStart);
			}
			const existing = await tx.user.findUnique({ where: { username: params.username } });
			if (existing) {
				throw new UsernameTakenError();
			}
			await tx.user.create({
				data: {
					username: params.username,
					passwordHash: params.passwordHash,
					role: 'guest',
					selfRegistered: true,
				},
			});
		});
		return { ok: true };
	} catch (e) {
		if (e instanceof SelfRegistrationDailyCapError) {
			return { ok: false, error: 'daily_cap', nextDayStart: e.nextDayStart };
		}
		if (e instanceof UsernameTakenError) {
			return { ok: false, error: 'username_taken' };
		}
		if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
			return { ok: false, error: 'username_taken' };
		}
		throw e;
	}
}

class SelfRegistrationDailyCapError extends Error {
	constructor(readonly nextDayStart: Date) {
		super('Self-registration daily cap');
		this.name = 'SelfRegistrationDailyCapError';
	}
}

class UsernameTakenError extends Error {
	constructor() {
		super('Username taken');
		this.name = 'UsernameTakenError';
	}
}
