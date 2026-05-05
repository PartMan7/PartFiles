import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UploadQuotaBanner } from '@/components/upload-quota-banner';

describe('UploadQuotaBanner', () => {
	it('renders loading copy', () => {
		const html = renderToStaticMarkup(
			createElement(UploadQuotaBanner, {
				loadState: 'loading',
				quota: null,
				filesForQuota: [],
			})
		);
		expect(html).toContain('Loading storage quota');
	});

	it('renders error copy', () => {
		const html = renderToStaticMarkup(
			createElement(UploadQuotaBanner, {
				loadState: 'error',
				quota: null,
				filesForQuota: [],
			})
		);
		expect(html).toContain('Could not load storage info');
	});

	it('renders quota summary when ok', () => {
		const html = renderToStaticMarkup(
			createElement(UploadQuotaBanner, {
				loadState: 'ok',
				quota: {
					usedBytes: 2 * 1024 * 1024,
					limitBytes: 100 * 1024 * 1024,
					remainingBytes: 98 * 1024 * 1024,
					maxFileSizeBytes: 10 * 1024 * 1024,
				},
				filesForQuota: [],
			})
		);
		expect(html).toContain('Storage:');
		expect(html).toContain('2.0');
		expect(html).toContain('100.0');
		expect(html).toContain('98.0');
		expect(html).toContain('10.0');
	});

	it('includes selection size when files present', () => {
		const html = renderToStaticMarkup(
			createElement(UploadQuotaBanner, {
				loadState: 'ok',
				quota: {
					usedBytes: 0,
					limitBytes: 100 * 1024 * 1024,
					remainingBytes: 100 * 1024 * 1024,
					maxFileSizeBytes: 10 * 1024 * 1024,
				},
				filesForQuota: [new File(['hi'], 'a.txt', { type: 'text/plain' })],
			})
		);
		expect(html).toContain('selection:');
	});
});
