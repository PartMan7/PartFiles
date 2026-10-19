/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadModeTabs } from '@/components/upload-mode-tabs';
import { LastUploadProvider } from '@/components/last-upload-context';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
	useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('sonner', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

function mockFetch() {
	vi.stubGlobal(
		'fetch',
		vi.fn((input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes('/api/upload/quota')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						usedBytes: 0,
						limitBytes: 100 * 1024 * 1024,
						remainingBytes: 100 * 1024 * 1024,
						maxFileSizeBytes: 10 * 1024 * 1024,
					}),
				});
			}
			if (url.includes('/api/directories')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ directories: [] }),
				});
			}
			return Promise.reject(new Error(`Unexpected fetch: ${url}`));
		})
	);
}

function visibleFilenameInput() {
	const inputs = screen.getAllByLabelText(/Custom Filename/i);
	const visible = inputs.find(el => !el.closest('[hidden]'));
	if (!visible) throw new Error('No visible filename input');
	return visible as HTMLInputElement;
}

function visibleFileInput() {
	const inputs = document.querySelectorAll('input[type="file"]');
	const visible = [...inputs].find(el => !el.closest('[hidden]'));
	if (!visible) throw new Error('No visible file input');
	return visible as HTMLInputElement;
}

function visibleRawTextInput() {
	const inputs = screen.getAllByRole('textbox');
	const visible = inputs.find(el => !el.closest('[hidden]'));
	if (!visible) throw new Error('No visible raw text input');
	return visible as HTMLTextAreaElement;
}

function renderTabs(props: { isAdmin?: boolean; userRole?: string; initialMode?: 'share' | 'store'; tabFromUrl?: boolean } = {}) {
	const { isAdmin = false, userRole = 'guest', initialMode = 'share', tabFromUrl = true } = props;
	return render(
		<LastUploadProvider>
			<UploadModeTabs isAdmin={isAdmin} userRole={userRole} initialMode={initialMode} tabFromUrl={tabFromUrl} />
		</LastUploadProvider>
	);
}

describe('UploadModeTabs', () => {
	beforeEach(() => {
		replaceMock.mockReset();
		localStorage.clear();
		mockFetch();

		class ResizeObserverMock {
			observe() {}
			unobserve() {}
			disconnect() {}
		}
		vi.stubGlobal('ResizeObserver', ResizeObserverMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('preserves filename when a non-admin switches from share to store', async () => {
		const user = userEvent.setup();
		renderTabs({ isAdmin: false, initialMode: 'share' });

		await user.type(visibleFilenameInput(), 'my-report');
		await user.click(screen.getByRole('tab', { name: 'Store Files' }));

		expect(visibleFilenameInput().value).toBe('my-report');
	});

	it('preserves filename when an admin switches from share to store', async () => {
		const user = userEvent.setup();
		renderTabs({ isAdmin: true, initialMode: 'share' });

		await user.type(visibleFilenameInput(), 'admin-notes');
		await user.click(screen.getByRole('tab', { name: 'Store Files' }));

		expect(visibleFilenameInput().value).toBe('admin-notes');
	});

	it('syncs selected files between admin share and store forms', async () => {
		const user = userEvent.setup();
		renderTabs({ isAdmin: true, initialMode: 'share' });

		const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
		await user.upload(visibleFileInput(), file);

		expect(screen.getAllByText('notes.txt').length).toBe(2);
	});

	it('preserves raw text when an admin switches from store to share', async () => {
		const user = userEvent.setup();
		renderTabs({ isAdmin: true, initialMode: 'store', tabFromUrl: false });

		const rawTextRadios = screen.getAllByRole('radio', { name: /Upload raw text/i });
		const visibleRadio = rawTextRadios.find(el => !el.closest('[hidden]'));
		if (!visibleRadio) throw new Error('No visible raw text radio');
		await user.click(visibleRadio);
		await user.type(visibleRawTextInput(), 'draft content');

		await user.click(screen.getByRole('tab', { name: 'Share Files' }));

		expect(visibleRawTextInput().value).toBe('draft content');
	});
});
