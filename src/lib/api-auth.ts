import { auth } from './auth';
import { prisma } from './prisma';
import { hashToken, TOKEN_PREFIX } from './tokens';
import type { TokenScope } from './token-scopes';

const LAST_USED_THROTTLE_MS = 60_000;

type AuthResult = { user: { id: string; name: string; role: string } } | null;

/**
 * Bearer token (with required scope) or session cookie. A Bearer header is never
 * silently ignored: an invalid token yields null rather than falling back to a session.
 * Role is read from the DB so demotions apply immediately.
 */
export async function authenticate(req: Request | undefined, scope: TokenScope): Promise<AuthResult> {
	const header = req?.headers.get('authorization');
	if (!header) {
		const session = await auth();
		return session?.user ? { user: session.user as { id: string; name: string; role: string } } : null;
	}

	const match = /^Bearer (\S+)$/i.exec(header);
	if (!match || !match[1].startsWith(TOKEN_PREFIX)) return null;

	const record = await prisma.apiToken.findUnique({
		where: { tokenHash: hashToken(match[1]) },
		include: { user: { select: { id: true, username: true, role: true } } },
	});
	if (!record || record.revokedAt) return null;
	if (record.expiresAt && record.expiresAt <= new Date()) return null;
	if (!record.scopes.split(',').includes(scope)) return null;
	if (scope === 'user' && record.user.role !== 'admin') return null;

	if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
		await prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
	}

	return { user: { id: record.user.id, name: record.user.username, role: record.user.role } };
}
