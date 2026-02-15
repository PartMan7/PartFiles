import { vi } from 'vitest';

// Mock environment variables
process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long';
process.env.CRON_SECRET = 'test-cron-secret';
process.env.UPLOAD_DIR = '/tmp/cms-test-uploads';
process.env.DATABASE_URL = 'file:./test.db';
process.env.BASE_URL = 'http://localhost:3000';

// ─── Mock: @/lib/auth ────────────────────────────────────────────────────────
// Default: unauthenticated. Override per-test with mockSession().
let currentSession: {
	user: { id: string; name: string; role: string };
} | null = null;

export function mockSession(session: { user: { id: string; name: string; role: string } } | null) {
	currentSession = session;
}

export function mockAdmin() {
	mockSession({
		user: { id: 'admin-id', name: 'admin', role: 'admin' },
	});
}

export function mockUploader() {
	mockSession({
		user: { id: 'uploader-id', name: 'uploader', role: 'uploader' },
	});
}

export function mockGuest() {
	mockSession({
		user: { id: 'guest-id', name: 'guest', role: 'guest' },
	});
}

export function mockUnauthenticated() {
	mockSession(null);
}

vi.mock('@/lib/auth', () => ({
	auth: vi.fn(() => Promise.resolve(currentSession)),
	handlers: {},
	signIn: vi.fn(),
	signOut: vi.fn(),
}));

// ─── Mock: @/lib/prisma ──────────────────────────────────────────────────────
// Expose a mock prisma object with chainable methods.
function createMockModel() {
	return {
		findMany: vi.fn().mockResolvedValue([]),
		findUnique: vi.fn().mockResolvedValue(null),
		findFirst: vi.fn().mockResolvedValue(null),
		create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-id', ...data })),
		update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'existing-id', ...data })),
		delete: vi.fn().mockResolvedValue({}),
		deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
		upsert: vi.fn().mockResolvedValue({}),
		count: vi.fn().mockResolvedValue(0),
		aggregate: vi.fn().mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 }),
	};
}

export const mockPrisma = {
	user: createMockModel(),
	content: createMockModel(),
	shortSlug: createMockModel(),
	allowedDirectory: createMockModel(),
	// $transaction passes the mock prisma itself to the callback so
	// existing model mocks work inside transactions.
	$transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

vi.mock('@/lib/prisma', () => ({
	prisma: mockPrisma,
}));

// ─── Mock: @/lib/storage ─────────────────────────────────────────────────────
export const mockStorage = {
	saveFile: vi.fn().mockResolvedValue('mock/storage/path.txt'),
	deleteFile: vi.fn().mockResolvedValue(undefined),
	getFilePath: vi.fn().mockReturnValue('/tmp/cms-test-uploads/mock/storage/path.txt'),
	ensureUploadDir: vi.fn().mockReturnValue('/tmp/cms-test-uploads'),
	fileExists: vi.fn().mockResolvedValue(true),
};

vi.mock('@/lib/storage', () => mockStorage);

// ─── Mock: fs/promises ───────────────────────────────────────────────────────
vi.mock('fs/promises', () => ({
	default: {
		readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
		writeFile: vi.fn().mockResolvedValue(undefined),
		unlink: vi.fn().mockResolvedValue(undefined),
	},
	readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
	writeFile: vi.fn().mockResolvedValue(undefined),
	unlink: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock: @/lib/preview ──────────────────────────────────────────────────────
export const mockPreview = {
	isPreviewable: vi.fn((mime: string) => mime.startsWith('image/')),
	generatePreviewBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-preview-data')),
	generateAndSavePreview: vi.fn().mockResolvedValue('mock/storage/preview-path.jpg'),
	deletePreview: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/lib/preview', () => mockPreview);

// ─── Mock: uuid ──────────────────────────────────────────────────────────────
vi.mock('uuid', () => ({
	v4: vi.fn(() => '00000000-0000-0000-0000-000000000000'),
}));

// ─── Mock: @/lib/id ──────────────────────────────────────────────────────────
export const mockId = {
	generateContentId: vi.fn().mockResolvedValue('ab12cd34'),
};

vi.mock('@/lib/id', () => mockId);

// ─── Mock: bcryptjs (real implementations for validation tests) ──────────────
// We keep bcryptjs real but we can override per test if needed.

// ─── Reset all mocks between tests ──────────────────────────────────────────
import { beforeEach } from 'vitest';

beforeEach(() => {
	currentSession = null;
	// Reset all prisma model mocks to defaults
	for (const [key, model] of Object.entries(mockPrisma)) {
		// Skip non-model entries like $transaction
		if (key.startsWith('$')) continue;
		for (const fn of Object.values(model as Record<string, ReturnType<typeof vi.fn>>)) {
			fn.mockReset();
		}
	}
	// Re-apply default implementations
	mockPrisma.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
	mockPrisma.content.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
		Promise.resolve({ id: 'new-id', ...data })
	);
	mockPrisma.content.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
		Promise.resolve({ id: 'existing-id', ...data })
	);
	mockPrisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
		Promise.resolve({ id: 'new-user-id', ...data })
	);
	mockPrisma.user.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
		Promise.resolve({ id: 'existing-id', ...data })
	);
	mockPrisma.shortSlug.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
		Promise.resolve({ id: 'new-slug-id', ...data })
	);

	// Reset $transaction mock
	mockPrisma.$transaction.mockReset().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma));

	// Reset storage mocks
	mockStorage.saveFile.mockReset().mockResolvedValue('mock/storage/path.txt');
	mockStorage.deleteFile.mockReset().mockResolvedValue(undefined);
	mockStorage.getFilePath.mockReset().mockReturnValue('/tmp/cms-test-uploads/mock/storage/path.txt');

	// Reset ID mock
	mockId.generateContentId.mockReset().mockResolvedValue('ab12cd34');

	// Reset preview mocks
	mockPreview.isPreviewable.mockReset().mockImplementation((mime: string) => mime.startsWith('image/'));
	mockPreview.generatePreviewBuffer.mockReset().mockResolvedValue(Buffer.from('mock-preview-data'));
	mockPreview.generateAndSavePreview.mockReset().mockResolvedValue('mock/storage/preview-path.jpg');
	mockPreview.deletePreview.mockReset().mockResolvedValue(undefined);
});
