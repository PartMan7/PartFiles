import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canUpload } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { STORAGE_LIMITS, maxUploadFileSizeBytesForRole } from '@/lib/config';

/**
 * Current user's storage quota for client-side validation before upload.
 * Server-side checks remain authoritative (including per-file transactions).
 */
export async function GET() {
	const session = await auth();
	if (!session?.user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: userId, role } = session.user;
	if (!canUpload(role)) {
		return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
	}

	const result = await prisma.content.aggregate({
		where: {
			uploadedById: userId,
			OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
		},
		_sum: { fileSize: true },
	});

	const usedBytes = result._sum.fileSize ?? 0;
	const limitBytes = STORAGE_LIMITS[role] ?? 0;
	const remainingBytes = Math.max(0, limitBytes - usedBytes);

	return NextResponse.json({
		usedBytes,
		limitBytes,
		remainingBytes,
		maxFileSizeBytes: maxUploadFileSizeBytesForRole(role),
	});
}
