import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFilePath } from '@/lib/storage';
import fs from 'fs/promises';

/**
 * Simple in-memory rate limiter to prevent DDoS abuse on preview endpoint.
 * Tracks request counts per IP within a sliding window.
 */
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 120; // max 120 preview requests per IP per minute

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Periodically clean up stale entries to avoid memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60_000; // every 5 minutes
let lastCleanup = Date.now();

function cleanupRateLimits() {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
	lastCleanup = now;
	for (const [key, entry] of rateLimitMap) {
		if (now > entry.resetAt) {
			rateLimitMap.delete(key);
		}
	}
}

function checkRateLimit(ip: string): boolean {
	cleanupRateLimits();
	const now = Date.now();
	const entry = rateLimitMap.get(ip);

	if (!entry || now > entry.resetAt) {
		rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return true;
	}

	entry.count++;
	return entry.count <= RATE_LIMIT_MAX_REQUESTS;
}

// Exported for testing
export { rateLimitMap, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	// Auth check
	const session = await auth();
	if (!session?.user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Rate limit by IP (defence-in-depth against authenticated DDoS)
	const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
	if (!checkRateLimit(ip)) {
		return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
	}

	const { id } = await params;

	const content = await prisma.content.findUnique({
		where: { id },
		select: { previewPath: true, expiresAt: true, mimeType: true },
	});

	if (!content) {
		return NextResponse.json({ error: 'Content not found' }, { status: 404 });
	}

	// Check if content has expired
	if (content.expiresAt && new Date(content.expiresAt) < new Date()) {
		return NextResponse.json({ error: 'Content has expired' }, { status: 410 });
	}

	// No preview available for this content
	if (!content.previewPath) {
		return NextResponse.json({ error: 'No preview available' }, { status: 404 });
	}

	try {
		const filePath = getFilePath(content.previewPath);
		const fileBuffer = await fs.readFile(filePath);

		return new NextResponse(fileBuffer, {
			headers: {
				'Content-Type': 'image/jpeg',
				'Content-Length': String(fileBuffer.byteLength),
				'X-Content-Type-Options': 'nosniff',
				'X-Frame-Options': 'DENY',
				'Content-Security-Policy': "default-src 'none'",
				// Allow caching for previews (they don't change) - reduces server load
				'Cache-Control': 'public, max-age=86400, immutable',
			},
		});
	} catch {
		return NextResponse.json({ error: 'Preview file not found on disk' }, { status: 404 });
	}
}
