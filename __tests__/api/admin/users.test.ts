import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/admin/users/route';
import { GET as GET_ID, PUT, DELETE } from '@/app/api/admin/users/[id]/route';
import { mockAdmin, mockUploader, mockUnauthenticated, mockPrisma } from '../../setup';
import { jsonRequest, parseResponse } from '../../helpers';
import { NextRequest } from 'next/server';

describe('GET /api/admin/users', () => {
	it('returns 403 for non-admin', async () => {
		mockUploader();
		const { status } = await parseResponse(await GET(new NextRequest('http://localhost/api/admin/users')));
		expect(status).toBe(403);
	});

	it('returns 403 for unauthenticated', async () => {
		mockUnauthenticated();
		const { status } = await parseResponse(await GET(new NextRequest('http://localhost/api/admin/users')));
		expect(status).toBe(403);
	});

	it('returns user list for admin', async () => {
		mockAdmin();
		const mockUsers = [
			{ id: '1', username: 'admin', role: 'admin', createdAt: new Date(), updatedAt: new Date(), _count: { content: 5 } },
			{ id: '2', username: 'uploader1', role: 'uploader', createdAt: new Date(), updatedAt: new Date(), _count: { content: 2 } },
		];
		mockPrisma.user.findMany.mockResolvedValue(mockUsers);

		const { status, body } = await parseResponse(await GET(new NextRequest('http://localhost/api/admin/users')));
		expect(status).toBe(200);
		expect(body?.users).toHaveLength(2);
	});
});

describe('POST /api/admin/users', () => {
	beforeEach(() => mockAdmin());

	it('returns 403 for non-admin', async () => {
		mockUploader();
		const req = jsonRequest('/api/admin/users', 'POST', { username: 'test', password: '12345678' });
		const { status } = await parseResponse(await POST(req));
		expect(status).toBe(403);
	});

	it('creates a user with valid data', async () => {
		mockPrisma.user.findUnique.mockResolvedValue(null); // no duplicate
		const req = jsonRequest('/api/admin/users', 'POST', {
			username: 'newuser',
			password: 'securepass',
			role: 'uploader',
		});
		const { status, body } = await parseResponse(await POST(req));
		expect(status).toBe(201);
		expect(body?.user).toBeDefined();
		expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
	});

	it('rejects missing username', async () => {
		const req = jsonRequest('/api/admin/users', 'POST', { password: 'securepass' });
		const { status, body } = await parseResponse(await POST(req));
		expect(status).toBe(400);
		expect(body?.error).toContain('required');
	});

	it('rejects missing password', async () => {
		const req = jsonRequest('/api/admin/users', 'POST', { username: 'test' });
		const { status } = await parseResponse(await POST(req));
		expect(status).toBe(400);
	});

	it('rejects short username', async () => {
		const req = jsonRequest('/api/admin/users', 'POST', { username: 'ab', password: 'securepass' });
		const { status, body } = await parseResponse(await POST(req));
		expect(status).toBe(400);
		expect(body?.error).toContain('3-50 characters');
	});

	it('rejects short password', async () => {
		const req = jsonRequest('/api/admin/users', 'POST', { username: 'validuser', password: 'short' });
		const { status, body } = await parseResponse(await POST(req));
		expect(status).toBe(400);
		expect(body?.error).toContain('at least 8');
	});

	it('rejects invalid role', async () => {
		const req = jsonRequest('/api/admin/users', 'POST', {
			username: 'test',
			password: 'securepass',
			role: 'superadmin',
		});
		const { status, body } = await parseResponse(await POST(req));
		expect(status).toBe(400);
		expect(body?.error).toContain('Invalid role');
	});

	it('rejects duplicate username', async () => {
		mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing', username: 'taken' });
		const req = jsonRequest('/api/admin/users', 'POST', { username: 'taken', password: 'securepass' });
		const { status, body } = await parseResponse(await POST(req));
		expect(status).toBe(409);
		expect(body?.error).toContain('already taken');
	});

	it('defaults role to guest when not specified', async () => {
		mockPrisma.user.findUnique.mockResolvedValue(null);
		const req = jsonRequest('/api/admin/users', 'POST', { username: 'newguest', password: 'securepass' });
		const { status } = await parseResponse(await POST(req));
		expect(status).toBe(201);
		const createCall = mockPrisma.user.create.mock.calls[0][0];
		expect(createCall.data.role).toBe('guest');
	});
});

describe('GET /api/admin/users/[id]', () => {
	it('returns 403 for non-admin', async () => {
		mockUploader();
		const req = new NextRequest('http://localhost:3000/api/admin/users/user-1');
		const { status } = await parseResponse(await GET_ID(req, { params: Promise.resolve({ id: 'user-1' }) }));
		expect(status).toBe(403);
	});

	it('returns 404 for non-existent user', async () => {
		mockAdmin();
		mockPrisma.user.findUnique.mockResolvedValue(null);
		const req = new NextRequest('http://localhost:3000/api/admin/users/no-user');
		const { status } = await parseResponse(await GET_ID(req, { params: Promise.resolve({ id: 'no-user' }) }));
		expect(status).toBe(404);
	});

	it('returns user for admin', async () => {
		mockAdmin();
		mockPrisma.user.findUnique.mockResolvedValue({
			id: 'user-1',
			username: 'testuser',
			role: 'guest',
			createdAt: new Date(),
			updatedAt: new Date(),
			_count: { content: 0 },
		});
		const req = new NextRequest('http://localhost:3000/api/admin/users/user-1');
		const { status, body } = await parseResponse(await GET_ID(req, { params: Promise.resolve({ id: 'user-1' }) }));
		expect(status).toBe(200);
		expect((body?.user as Record<string, unknown>)?.username).toBe('testuser');
	});
});

describe('PUT /api/admin/users/[id]', () => {
	beforeEach(() => mockAdmin());

	it('returns 404 for non-existent user', async () => {
		mockPrisma.user.findUnique.mockResolvedValue(null);
		const req = jsonRequest('/api/admin/users/no-user', 'PUT', { role: 'admin' });
		const { status } = await parseResponse(await PUT(req, { params: Promise.resolve({ id: 'no-user' }) }));
		expect(status).toBe(404);
	});

	it('updates user role', async () => {
		mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', username: 'test', role: 'guest' });
		mockPrisma.user.findFirst.mockResolvedValue(null); // no duplicate
		const req = jsonRequest('/api/admin/users/user-1', 'PUT', { role: 'uploader' });
		const { status } = await parseResponse(await PUT(req, { params: Promise.resolve({ id: 'user-1' }) }));
		expect(status).toBe(200);
		expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
	});

	it('rejects duplicate username on update', async () => {
		mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', username: 'old' });
		mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-2', username: 'taken' });
		const req = jsonRequest('/api/admin/users/user-1', 'PUT', { username: 'taken' });
		const { status, body } = await parseResponse(await PUT(req, { params: Promise.resolve({ id: 'user-1' }) }));
		expect(status).toBe(409);
		expect(body?.error).toContain('already taken');
	});

	it('rejects invalid role on update', async () => {
		mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', username: 'test' });
		const req = jsonRequest('/api/admin/users/user-1', 'PUT', { role: 'superadmin' });
		const { status } = await parseResponse(await PUT(req, { params: Promise.resolve({ id: 'user-1' }) }));
		expect(status).toBe(400);
	});
});

describe('DELETE /api/admin/users/[id]', () => {
	beforeEach(() => mockAdmin());

	it('returns 403 for non-admin', async () => {
		mockUploader();
		const req = new NextRequest('http://localhost:3000/api/admin/users/user-1', { method: 'DELETE' });
		const { status } = await parseResponse(await DELETE(req, { params: Promise.resolve({ id: 'user-1' }) }));
		expect(status).toBe(403);
	});

	it('prevents self-deletion', async () => {
		// admin-id is the session user id set by mockAdmin()
		const req = new NextRequest('http://localhost:3000/api/admin/users/admin-id', { method: 'DELETE' });
		const { status, body } = await parseResponse(await DELETE(req, { params: Promise.resolve({ id: 'admin-id' }) }));
		expect(status).toBe(400);
		expect(body?.error).toContain('Cannot delete your own account');
	});

	it('returns 404 for non-existent user', async () => {
		mockPrisma.user.findUnique.mockResolvedValue(null);
		const req = new NextRequest('http://localhost:3000/api/admin/users/no-user', { method: 'DELETE' });
		const { status } = await parseResponse(await DELETE(req, { params: Promise.resolve({ id: 'no-user' }) }));
		expect(status).toBe(404);
	});

	it('deletes user successfully', async () => {
		mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', username: 'test' });
		const req = new NextRequest('http://localhost:3000/api/admin/users/user-2', { method: 'DELETE' });
		const { status, body } = await parseResponse(await DELETE(req, { params: Promise.resolve({ id: 'user-2' }) }));
		expect(status).toBe(200);
		expect(body?.success).toBe(true);
		expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-2' } });
	});
});
