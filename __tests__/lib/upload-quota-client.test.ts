import { describe, it, expect } from 'vitest';
import { fmtMb, clientUploadBlockMessage, type QuotaPayload } from '@/lib/upload-quota-client';

function quota(partial: Partial<QuotaPayload> = {}): QuotaPayload {
	return {
		usedBytes: 0,
		limitBytes: 100 * 1024 * 1024,
		remainingBytes: 100 * 1024 * 1024,
		maxFileSizeBytes: 10 * 1024 * 1024,
		...partial,
	};
}

describe('fmtMb', () => {
	it('formats bytes to one decimal MB', () => {
		expect(fmtMb(5 * 1024 * 1024)).toBe('5.0');
		expect(fmtMb(5.5 * 1024 * 1024)).toBe('5.5');
	});
});

describe('clientUploadBlockMessage', () => {
	it('returns null for empty file list', () => {
		expect(clientUploadBlockMessage(quota(), [])).toBeNull();
	});

	it('returns null when all files fit', () => {
		const q = quota();
		const files = [new File(['x'], 'a.txt', { type: 'text/plain' })];
		expect(clientUploadBlockMessage(q, files)).toBeNull();
	});

	it('blocks when a file exceeds per-file max', () => {
		const q = quota({ maxFileSizeBytes: 5 * 1024 * 1024 });
		const files = [new File(['x'.repeat(6 * 1024 * 1024)], 'big.txt', { type: 'text/plain' })];
		const msg = clientUploadBlockMessage(q, files);
		expect(msg).toContain('big.txt');
		expect(msg).toContain('exceeds the per-file limit');
		expect(msg).toContain('5.0 MB');
	});

	it('blocks when batch total exceeds remaining storage', () => {
		const q = quota({
			usedBytes: 90 * 1024 * 1024,
			limitBytes: 100 * 1024 * 1024,
			remainingBytes: 10 * 1024 * 1024,
			maxFileSizeBytes: 50 * 1024 * 1024,
		});
		const sixMb = 'x'.repeat(6 * 1024 * 1024);
		const files = [
			new File([sixMb], 'a.bin', { type: 'application/octet-stream' }),
			new File([sixMb], 'b.bin', { type: 'application/octet-stream' }),
		];
		const msg = clientUploadBlockMessage(q, files);
		expect(msg).toContain('only');
		expect(msg).toContain('10.0 MB is available');
		expect(msg).toContain('90.0 / 100.0 MB used');
	});
});
