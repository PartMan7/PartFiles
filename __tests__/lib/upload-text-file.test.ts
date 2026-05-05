import { describe, it, expect } from 'vitest';
import { buildTextUploadFile } from '@/lib/upload-text-file';

describe('buildTextUploadFile', () => {
	it('defaults empty filename base to upload.txt', () => {
		const f = buildTextUploadFile('hello', '');
		expect(f.name).toBe('upload.txt');
		expect(f.type).toBe('text/plain');
	});

	it('defaults whitespace-only base to upload.txt', () => {
		const f = buildTextUploadFile('a', '   ');
		expect(f.name).toBe('upload.txt');
	});

	it('appends .txt when missing', () => {
		const f = buildTextUploadFile('body', 'notes');
		expect(f.name).toBe('notes.txt');
	});

	it('does not double .txt (lowercase)', () => {
		const f = buildTextUploadFile('body', 'notes.txt');
		expect(f.name).toBe('notes.txt');
	});

	it('does not double .txt (case-insensitive)', () => {
		const f = buildTextUploadFile('body', 'Notes.TXT');
		expect(f.name).toBe('Notes.TXT');
	});

	it('preserves file body and byte length', async () => {
		const body = 'line1\nline2\n';
		const f = buildTextUploadFile(body, 'log');
		expect(f.size).toBe(new TextEncoder().encode(body).length);
		expect(await f.text()).toBe(body);
	});
});
