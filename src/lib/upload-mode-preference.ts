export type UploadMode = 'share' | 'store';

const UPLOAD_MODE_STORAGE_KEY = 'cms-upload-mode';

export function readStoredUploadMode(): UploadMode | null {
	if (typeof window === 'undefined') return null;
	const raw = localStorage.getItem(UPLOAD_MODE_STORAGE_KEY);
	if (raw === 'share' || raw === 'store') return raw;
	return null;
}

export function persistUploadMode(mode: UploadMode): void {
	try {
		localStorage.setItem(UPLOAD_MODE_STORAGE_KEY, mode);
	} catch {
		/* private mode / quota */
	}
}

export function uploadHrefForMode(mode: UploadMode): string {
	return mode === 'share' ? '/upload?tab=share' : '/upload';
}
