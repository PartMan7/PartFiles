/**
 * Tests for src/lib/preview.ts
 *
 * This test file uses vi.hoisted + vi.mock to set up sharp & storage
 * mocks BEFORE the global setup.ts mock for @/lib/preview kicks in.
 * We use dynamic import to load the real module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks so they're ready before any import resolves
const { mockSharpInstance, mockSharpFn, mockSaveFile, mockDeleteFile } = vi.hoisted(() => {
	const mockSharpInstance = {
		resize: vi.fn().mockReturnThis(),
		jpeg: vi.fn().mockReturnThis(),
		toBuffer: vi.fn().mockResolvedValue(Buffer.from('compressed-preview')),
	};
	return {
		mockSharpInstance,
		mockSharpFn: vi.fn(() => mockSharpInstance),
		mockSaveFile: vi.fn().mockResolvedValue('mock/preview-path.jpg'),
		mockDeleteFile: vi.fn().mockResolvedValue(undefined),
	};
});

// Override the sharp module
vi.mock('sharp', () => ({ default: mockSharpFn }));

// Override storage (this also takes precedence over the global mock for imports
// resolved by this file's module graph)
vi.mock('@/lib/storage', () => ({
	saveFile: mockSaveFile,
	deleteFile: mockDeleteFile,
	getFilePath: vi.fn().mockReturnValue('/tmp/test/mock-path'),
	ensureUploadDir: vi.fn().mockReturnValue('/tmp/test'),
	fileExists: vi.fn().mockResolvedValue(true),
}));

// We need to bypass the global mock for @/lib/preview so we import the real module.
// vi.mock is hoisted, but we use vi.doUnmock to ensure the real module loads.
vi.doUnmock('@/lib/preview');

// Dynamic import to get the real implementation (after mocks are applied)
const { isPreviewable, generatePreviewBuffer, generateAndSavePreview, deletePreview } = await import(
	'@/lib/preview'
);

describe('preview utilities', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSharpInstance.resize.mockReturnThis();
		mockSharpInstance.jpeg.mockReturnThis();
		mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('compressed-preview'));
		mockSaveFile.mockResolvedValue('mock/preview-path.jpg');
		mockDeleteFile.mockResolvedValue(undefined);
	});

	describe('isPreviewable', () => {
		it('returns true for common image MIME types', () => {
			expect(isPreviewable('image/jpeg')).toBe(true);
			expect(isPreviewable('image/png')).toBe(true);
			expect(isPreviewable('image/gif')).toBe(true);
			expect(isPreviewable('image/webp')).toBe(true);
			expect(isPreviewable('image/avif')).toBe(true);
			expect(isPreviewable('image/tiff')).toBe(true);
			expect(isPreviewable('image/bmp')).toBe(true);
		});

		it('returns false for non-image MIME types', () => {
			expect(isPreviewable('application/pdf')).toBe(false);
			expect(isPreviewable('text/plain')).toBe(false);
			expect(isPreviewable('video/mp4')).toBe(false);
			expect(isPreviewable('audio/mpeg')).toBe(false);
			expect(isPreviewable('application/octet-stream')).toBe(false);
		});

		it('returns false for SVG (not in previewable set)', () => {
			expect(isPreviewable('image/svg+xml')).toBe(false);
		});
	});

	describe('generatePreviewBuffer', () => {
		it('produces a compressed JPEG buffer from an image', async () => {
			const input = Buffer.from('fake-image-data');
			const result = await generatePreviewBuffer(input);
			expect(result).not.toBeNull();
			expect(result).toBeInstanceOf(Buffer);
		});

		it('calls sharp with correct resize and quality options', async () => {
			const input = Buffer.from('fake-image-data');
			await generatePreviewBuffer(input);

			expect(mockSharpFn).toHaveBeenCalledWith(input);
			expect(mockSharpInstance.resize).toHaveBeenCalledWith(200, 200, {
				fit: 'inside',
				withoutEnlargement: true,
			});
			expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
				quality: 50,
				progressive: true,
			});
			expect(mockSharpInstance.toBuffer).toHaveBeenCalled();
		});

		it('returns null if sharp throws an error', async () => {
			mockSharpInstance.toBuffer.mockRejectedValueOnce(new Error('corrupt image'));
			const result = await generatePreviewBuffer(Buffer.from('corrupt'));
			expect(result).toBeNull();
		});
	});

	describe('generateAndSavePreview', () => {
		it('generates and saves a preview for an image MIME type', async () => {
			const buffer = Buffer.from('image-data');
			const result = await generateAndSavePreview(buffer, 'image/jpeg', 'test-file.jpg');
			expect(result).toBe('mock/preview-path.jpg');
			expect(mockSaveFile).toHaveBeenCalledWith(
				Buffer.from('compressed-preview'),
				'preview-test-file.jpg.jpg',
				undefined
			);
		});

		it('passes subDir through to saveFile', async () => {
			const buffer = Buffer.from('image-data');
			await generateAndSavePreview(buffer, 'image/png', 'photo.png', 'images');
			expect(mockSaveFile).toHaveBeenCalledWith(expect.any(Buffer), 'preview-photo.png.jpg', 'images');
		});

		it('returns null for non-previewable MIME types', async () => {
			const buffer = Buffer.from('pdf-data');
			const result = await generateAndSavePreview(buffer, 'application/pdf', 'doc.pdf');
			expect(result).toBeNull();
			expect(mockSaveFile).not.toHaveBeenCalled();
		});

		it('returns null if preview buffer generation fails', async () => {
			mockSharpInstance.toBuffer.mockRejectedValueOnce(new Error('corrupt'));
			const buffer = Buffer.from('corrupt-image');
			const result = await generateAndSavePreview(buffer, 'image/jpeg', 'bad.jpg');
			expect(result).toBeNull();
		});

		it('returns null if saving the preview file fails', async () => {
			mockSaveFile.mockRejectedValueOnce(new Error('disk full'));
			const buffer = Buffer.from('image-data');
			const result = await generateAndSavePreview(buffer, 'image/jpeg', 'test.jpg');
			expect(result).toBeNull();
		});
	});

	describe('deletePreview', () => {
		it('deletes the preview file', async () => {
			await deletePreview('mock/preview.jpg');
			expect(mockDeleteFile).toHaveBeenCalledWith('mock/preview.jpg');
		});

		it('does nothing for null previewPath', async () => {
			await deletePreview(null);
			expect(mockDeleteFile).not.toHaveBeenCalled();
		});

		it('does nothing for undefined previewPath', async () => {
			await deletePreview(undefined);
			expect(mockDeleteFile).not.toHaveBeenCalled();
		});

		it('does not throw when deleteFile fails', async () => {
			mockDeleteFile.mockRejectedValueOnce(new Error('disk error'));
			await expect(deletePreview('mock/preview.jpg')).resolves.toBeUndefined();
		});
	});
});
