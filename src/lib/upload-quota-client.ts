/** Shapes returned by GET /api/upload/quota (shared by uploader + admin upload UIs). */
export type QuotaPayload = {
	usedBytes: number;
	limitBytes: number;
	remainingBytes: number;
	maxFileSizeBytes: number;
};

export function fmtMb(bytes: number): string {
	return (bytes / (1024 * 1024)).toFixed(1);
}

/** Client-side mirror of server batch rules; server remains authoritative. */
export function clientUploadBlockMessage(quota: QuotaPayload, files: File[]): string | null {
	if (files.length === 0) return null;
	const tooBig = files.find(f => f.size > quota.maxFileSizeBytes);
	if (tooBig) {
		return `"${tooBig.name}" exceeds the per-file limit of ${fmtMb(quota.maxFileSizeBytes)} MB.`;
	}
	const total = files.reduce((s, f) => s + f.size, 0);
	if (total > quota.remainingBytes) {
		return `Selected files total ${fmtMb(total)} MB, but only ${fmtMb(quota.remainingBytes)} MB is available (${fmtMb(quota.usedBytes)} / ${fmtMb(quota.limitBytes)} MB used).`;
	}
	return null;
}
