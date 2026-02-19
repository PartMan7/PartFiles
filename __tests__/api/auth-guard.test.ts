/**
 * Automatic auth guard test.
 *
 * This test discovers ALL API route files on disk, dynamically imports each
 * exported HTTP handler, and verifies that:
 *
 *   1. Every non-public route rejects unauthenticated requests (401 / 403).
 *   2. Every admin-only route rejects non-admin roles (403).
 *   3. Upload routes reject guests who lack upload permission (403).
 *
 * If a new route.ts is added anywhere under src/app/api/ it is automatically
 * included — no manual test registration required.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mockUnauthenticated, mockGuest, mockUploader } from '../setup';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Route discovery
// ---------------------------------------------------------------------------

const API_DIR = path.resolve(process.cwd(), 'src/app/api');

function findRouteFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...findRouteFiles(full));
		} else if (entry.name === 'route.ts') {
			results.push(full);
		}
	}
	return results;
}

const allRouteFiles = findRouteFiles(API_DIR);

// Derive a human-readable route path from the file path.
//   src/app/api/admin/users/[id]/route.ts  →  /api/admin/users/[id]
function toRoutePath(file: string): string {
	const appRoot = path.resolve(process.cwd(), 'src/app');
	return '/' + path.relative(appRoot, file).replace(/\/route\.ts$/, '');
}

// Build a URL-safe version of the route (replace dynamic segments).
//   /api/admin/users/[id]  →  /api/admin/users/test-id
function toUrl(routePath: string): string {
	return routePath.replace(/\[(\w+)\]/g, 'test-$1');
}

// Extract params object for dynamic routes (e.g. { id: "test-id" }).
function extractParams(routePath: string): Record<string, string> | null {
	const matches = routePath.match(/\[(\w+)\]/g);
	if (!matches) return null;
	const params: Record<string, string> = {};
	for (const m of matches) {
		params[m.replace(/[\[\]]/g, '')] = `test-${m.replace(/[\[\]]/g, '')}`;
	}
	return params;
}

// ---------------------------------------------------------------------------
// Route classification
// ---------------------------------------------------------------------------

// Routes that are intentionally public (no session auth).
const PUBLIC_PATTERNS = [/\/api\/auth\//, /\/api\/invite\//, /\/api\/preview/, /\/api\/content\/\[id](?:\/raw)?/, /\/api\/s\/\[slug]/];

// Routes that require admin role.
const ADMIN_PATTERNS = [/\/api\/admin\//, /\/api\/directories/];

// Routes that require at least uploader role (guests rejected).
const UPLOAD_PATTERNS = [/\/api\/upload/];

function isPublic(route: string) {
	return PUBLIC_PATTERNS.some(p => p.test(route));
}
function isAdmin(route: string) {
	return ADMIN_PATTERNS.some(p => p.test(route));
}
function isUpload(route: string) {
	return UPLOAD_PATTERNS.some(p => p.test(route));
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Call every exported HTTP handler in a module and return status codes. */
async function callAllHandlers(mod: Record<string, ((...args: unknown[]) => Promise<Response>) | undefined>, routePath: string) {
	const params = extractParams(routePath);
	const url = `http://localhost:3000${toUrl(routePath)}`;
	const results: { method: string; status: number }[] = [];

	for (const method of HTTP_METHODS) {
		const handler = mod[method];
		if (typeof handler !== 'function') continue;

		const req = new NextRequest(url, { method });
		const res = params ? await handler(req, { params: Promise.resolve(params) }) : await handler(req);

		results.push({ method, status: res.status });
	}

	return results;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Separate tested routes so we can assert full coverage at the end.
const testedFiles = new Set<string>();

describe('Auth guard — automatic route scanning', () => {
	// ── 1. Unauthenticated → rejected for all non-public routes ────────────
	describe('rejects unauthenticated requests', () => {
		beforeEach(() => {
			mockUnauthenticated();
		});

		for (const file of allRouteFiles) {
			const route = toRoutePath(file);
			if (isPublic(route)) continue;

			testedFiles.add(file);

			it(`${route}`, async () => {
				const mod = await import(file);
				const results = await callAllHandlers(mod, route);

				expect(results.length).toBeGreaterThan(0); // at least one handler exported

				for (const { method, status } of results) {
					expect(status, `${method} ${route} should reject unauthenticated — got ${status}`).toSatisfy(
						(s: number) => s === 401 || s === 403
					);
				}
			});
		}
	});

	// ── 2. Non-admin → rejected on admin routes ────────────────────────────
	describe('rejects non-admin roles on admin routes', () => {
		for (const file of allRouteFiles) {
			const route = toRoutePath(file);
			if (!isAdmin(route)) continue;

			it(`${route} rejects uploader`, async () => {
				mockUploader();
				const mod = await import(file);
				const results = await callAllHandlers(mod, route);

				for (const { method, status } of results) {
					expect(status, `${method} ${route} should reject uploader — got ${status}`).toBe(403);
				}
			});

			it(`${route} rejects guest`, async () => {
				mockGuest();
				const mod = await import(file);
				const results = await callAllHandlers(mod, route);

				for (const { method, status } of results) {
					expect(status, `${method} ${route} should reject guest — got ${status}`).toBe(403);
				}
			});
		}
	});

	// ── 3. Guest → rejected on upload routes ───────────────────────────────
	describe('rejects guest on upload routes', () => {
		for (const file of allRouteFiles) {
			const route = toRoutePath(file);
			if (!isUpload(route) || isAdmin(route)) continue; // admin upload tested above

			it(`${route} rejects guest`, async () => {
				mockGuest();
				const mod = await import(file);
				const results = await callAllHandlers(mod, route);

				for (const { method, status } of results) {
					expect(status, `${method} ${route} should reject guest — got ${status}`).toBe(403);
				}
			});
		}
	});

	// ── 4. Coverage: every route file is either public or tested ───────────
	describe('route coverage', () => {
		it('all non-public API routes are covered by auth guard tests', () => {
			const uncovered = allRouteFiles.filter(f => {
				const route = toRoutePath(f);
				return !isPublic(route) && !testedFiles.has(f);
			});

			expect(uncovered.map(toRoutePath), 'These routes have no auth guard test — add them or mark as public').toEqual([]);
		});

		it('discovered at least one route file', () => {
			expect(allRouteFiles.length).toBeGreaterThan(0);
		});
	});
});
