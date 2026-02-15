import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/cron/cleanup/route';
import { mockPrisma, mockStorage, mockPreview } from '../setup';
import { requestWithHeaders, parseResponse } from '../helpers';

describe('POST /api/cron/cleanup', () => {
	it('returns 403 without cron secret', async () => {
		const req = requestWithHeaders('/api/cron/cleanup', 'POST', {});
		const { status, body } = await parseResponse(await POST(req));
		expect(status).toBe(403);
		expect(body?.error).toBe('Forbidden');
	});

	it('returns 403 with wrong cron secret', async () => {
		const req = requestWithHeaders('/api/cron/cleanup', 'POST', {
			'x-cron-secret': 'wrong-secret',
		});
		const { status } = await parseResponse(await POST(req));
		expect(status).toBe(403);
	});

	it('succeeds with correct cron secret and no expired content', async () => {
		mockPrisma.content.findMany.mockResolvedValue([]);
		const req = requestWithHeaders('/api/cron/cleanup', 'POST', {
			'x-cron-secret': 'test-cron-secret',
		});
		const { status, body } = await parseResponse(await POST(req));
		expect(status).toBe(200);
		expect(body?.success).toBe(true);
		expect(body?.found).toBe(0);
		expect(body?.deleted).toBe(0);
	});

	it('deletes expired content and files', async () => {
		const expiredItems = [
			{ id: 'c1', storagePath: 'path/old1.pdf', previewPath: null, expiresAt: new Date(Date.now() - 3600000) },
			{ id: 'c2', storagePath: 'path/old2.jpg', previewPath: 'path/preview-old2.jpg', expiresAt: new Date(Date.now() - 7200000) },
		];
		mockPrisma.content.findMany.mockResolvedValue(expiredItems);

		const req = requestWithHeaders('/api/cron/cleanup', 'POST', {
			'x-cron-secret': 'test-cron-secret',
		});
		const { status, body } = await parseResponse(await POST(req));
		expect(status).toBe(200);
		expect(body?.success).toBe(true);
		expect(body?.found).toBe(2);
		expect(body?.deleted).toBe(2);
		expect(body?.errors).toBe(0);

		expect(mockStorage.deleteFile).toHaveBeenCalledTimes(2);
		expect(mockStorage.deleteFile).toHaveBeenCalledWith('path/old1.pdf');
		expect(mockStorage.deleteFile).toHaveBeenCalledWith('path/old2.jpg');

		// Preview deletion should be called for both items
		expect(mockPreview.deletePreview).toHaveBeenCalledTimes(2);
		expect(mockPreview.deletePreview).toHaveBeenCalledWith(null);
		expect(mockPreview.deletePreview).toHaveBeenCalledWith('path/preview-old2.jpg');

		expect(mockPrisma.content.delete).toHaveBeenCalledTimes(2);
	});

	it('reports errors when file deletion fails', async () => {
		const expiredItems = [{ id: 'c1', storagePath: 'path/broken.pdf', expiresAt: new Date(Date.now() - 3600000) }];
		mockPrisma.content.findMany.mockResolvedValue(expiredItems);
		mockStorage.deleteFile.mockRejectedValue(new Error('disk error'));

		const req = requestWithHeaders('/api/cron/cleanup', 'POST', {
			'x-cron-secret': 'test-cron-secret',
		});
		const { status, body } = await parseResponse(await POST(req));
		expect(status).toBe(200);
		expect(body?.found).toBe(1);
		expect(body?.deleted).toBe(0);
		expect(body?.errors).toBe(1);
	});
});
