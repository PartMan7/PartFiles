import { type QuotaPayload, fmtMb } from '@/lib/upload-quota-client';

type UploadQuotaBannerProps = {
	loadState: 'loading' | 'ok' | 'error';
	quota: QuotaPayload | null;
	filesForQuota: File[];
};

export function UploadQuotaBanner({ loadState, quota, filesForQuota }: UploadQuotaBannerProps) {
	return (
		<div className="rounded-md bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
			{loadState === 'loading' && <p>Loading storage quota…</p>}
			{loadState === 'error' && <p>Could not load storage info. Limits still apply on the server.</p>}
			{loadState === 'ok' && quota && (
				<p>
					Storage: {fmtMb(quota.usedBytes)} / {fmtMb(quota.limitBytes)} MB used · {fmtMb(quota.remainingBytes)} MB available · up to{' '}
					{fmtMb(quota.maxFileSizeBytes)} MB per file
					{filesForQuota.length > 0 && <> · selection: {fmtMb(filesForQuota.reduce((s, f) => s + f.size, 0))} MB</>}
				</p>
			)}
		</div>
	);
}
