'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileDropZone } from '@/components/file-drop-zone';
import { RequiredMark } from '@/components/required-mark';
import { toast } from 'sonner';
import { useLastUpload } from '@/components/last-upload-context';
import { type QuotaPayload, fmtMb, clientUploadBlockMessage } from '@/lib/upload-quota-client';
import { ClientDateYmd } from '@/components/client-date-ymd';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export type UploadFormProps = {
	isAdmin: boolean;
	/** Initial value for the expiry select (hours as string, or `off` for admins) */
	defaultExpiry?: string;
	/** Copy raw CDN/API URLs to the clipboard immediately after upload */
	autoCopyRawUrl?: boolean;
	/** After pasting file(s) from the clipboard, submit the form automatically */
	submitOnPaste?: boolean;
};

const EXPIRY_OPTIONS = [
	{ value: '0.25', label: '15 minutes' },
	{ value: '0.5', label: '30 minutes' },
	{ value: '1', label: '1 hour' },
	{ value: '6', label: '6 hours' },
	{ value: '24', label: '1 day' },
	{ value: '72', label: '3 days' },
	{ value: '168', label: '7 days' },
];

const ADMIN_EXPIRY_OPTIONS = [{ value: 'off', label: 'Never (permanent)' }, ...EXPIRY_OPTIONS];

type ResultItem = {
	id: string;
	filename: string;
	url: string;
	rawUrl: string;
	expiresAt: string | null;
};

function parseUploadResponse(data: Record<string, unknown>): ResultItem[] {
	if (Array.isArray(data.contents)) {
		return data.contents as ResultItem[];
	}
	if (data.content && typeof data.content === 'object') {
		return [data.content as ResultItem];
	}
	return [];
}

export function UploadForm({ isAdmin, defaultExpiry = '1', autoCopyRawUrl = false, submitOnPaste = false }: UploadFormProps) {
	const { setLastRawUrls, setLastUploadedContentUrls } = useLastUpload();
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState('');
	const [results, setResults] = useState<ResultItem[] | null>(null);
	const [expiry, setExpiry] = useState(defaultExpiry);
	const [filename, setFilename] = useState('');
	const [fileResetKey, setFileResetKey] = useState(0);
	const fileRef = useRef<HTMLInputElement>(null);
	const [quota, setQuota] = useState<QuotaPayload | null>(null);
	const [quotaLoadState, setQuotaLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

	const loadQuota = useCallback(async () => {
		setQuotaLoadState('loading');
		try {
			const res = await fetch('/api/upload/quota');
			if (!res.ok) {
				setQuota(null);
				setQuotaLoadState('error');
				return;
			}
			const data = (await res.json()) as QuotaPayload;
			setQuota(data);
			setQuotaLoadState('ok');
		} catch {
			setQuota(null);
			setQuotaLoadState('error');
		}
	}, []);

	useEffect(() => {
		void loadQuota();
	}, [loadQuota]);

	const clientBlock = useMemo(() => (quota ? clientUploadBlockMessage(quota, selectedFiles) : null), [quota, selectedFiles]);

	const submitBlockedByClient = Boolean(quota && clientBlock);
	const singleFileSelection = selectedFiles.length <= 1;

	const handleSubmitRef = useRef<(e: React.FormEvent<HTMLFormElement>) => void | Promise<void>>(() => {});

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError('');
		setResults(null);
		setUploading(true);

		try {
			const input = fileRef.current;
			const list = input?.files;
			if (!list?.length) {
				setError('Please select at least one file');
				setUploading(false);
				return;
			}

			const files = Array.from(list).filter(f => f.size > 0);
			if (files.length === 0) {
				setError('Please select at least one file');
				setUploading(false);
				return;
			}

			if (quota) {
				const block = clientUploadBlockMessage(quota, files);
				if (block) {
					setUploading(false);
					return;
				}
			}

			const formData = new FormData();
			formData.set('expiry', expiry);
			const trimmed = filename.trim();
			if (files.length === 1 && trimmed) {
				formData.set('filename', trimmed);
			}
			for (const f of files) {
				formData.append('files', f);
			}

			const res = await fetch('/api/upload', {
				method: 'POST',
				body: formData,
			});

			const data = (await res.json()) as Record<string, unknown>;

			if (!res.ok) {
				setError((data.error as string) || 'Upload failed');
			} else {
				const items = parseUploadResponse(data);
				setResults(items);

				const rawUrls = items.map(c => c.rawUrl).filter(Boolean);
				if (rawUrls.length) {
					setLastRawUrls(rawUrls);
				}
				const contentPageUrls = items.map(c => c.url).filter(Boolean);
				if (contentPageUrls.length) {
					setLastUploadedContentUrls(contentPageUrls);
				}

				if (autoCopyRawUrl && rawUrls.length) {
					try {
						await navigator.clipboard.writeText(rawUrls.join('\n'));
						toast.success(rawUrls.length > 1 ? 'Uploaded — raw URLs copied' : 'Uploaded — raw URL copied');
					} catch {
						toast.success(files.length > 1 ? 'Files uploaded successfully' : 'File uploaded successfully');
						toast.error('Could not copy to clipboard');
					}
				} else {
					toast.success(files.length > 1 ? 'Files uploaded successfully' : 'File uploaded successfully');
				}

				setFilename('');
				setFileResetKey(k => k + 1);
				setSelectedFiles([]);
				void loadQuota();
			}
		} catch {
			setError('An error occurred during upload');
		} finally {
			setUploading(false);
		}
	}

	handleSubmitRef.current = handleSubmit;

	const submitAfterPaste = useCallback(() => {
		if (!submitOnPaste) return;
		window.setTimeout(() => {
			const fake = { preventDefault() {} } as React.FormEvent<HTMLFormElement>;
			void handleSubmitRef.current(fake);
		}, 0);
	}, [submitOnPaste]);

	const expiryOptions = isAdmin ? ADMIN_EXPIRY_OPTIONS : EXPIRY_OPTIONS;

	return (
		<div className="space-y-4">
			<div aria-live="polite" aria-atomic="true">
				{results && results.length > 0 && (
					<Alert>
						<AlertDescription className="relative pr-10">
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="absolute top-0 right-0 text-muted-foreground hover:text-foreground"
								onClick={() => setResults(null)}
								aria-label="Dismiss upload success message"
							>
								<X className="size-4" aria-hidden />
							</Button>
							<p className="font-medium">Upload successful!</p>
							<ul className="text-sm mt-2 space-y-3 list-none p-0 m-0">
								{results.map(r => (
									<li key={r.id} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
										<p className="font-medium text-foreground">{r.filename}</p>
										<p className="mt-1">
											<span className="text-muted-foreground">Page: </span>
											<a href={r.url} className="text-primary underline" target="_blank" rel="noopener noreferrer">
												{r.url}
												<span className="sr-only"> (opens in new tab)</span>
											</a>
										</p>
										<p className="mt-0.5 break-all">
											<span className="text-muted-foreground">Raw: </span>
											<a href={r.rawUrl} className="text-primary underline" target="_blank" rel="noopener noreferrer">
												{r.rawUrl}
												<span className="sr-only"> (opens in new tab)</span>
											</a>
										</p>
										<p className="text-muted-foreground mt-1">
											{r.expiresAt ? (
												<>
													Expires: <ClientDateYmd iso={r.expiresAt} className="inline" />
												</>
											) : (
												'Permanent (no expiry)'
											)}
										</p>
									</li>
								))}
							</ul>
							<p className="text-xs text-muted-foreground mt-3">
								Press <span className="font-medium text-foreground">C</span> to copy the content page URL
								{results.length > 1 ? 's (one per line)' : ''} and <span className="font-medium text-foreground">R</span> to copy the
								raw URL{results.length > 1 ? 's (one per line)' : ''}.
								{autoCopyRawUrl && (
									<> Raw {results.length > 1 ? 'URLs were' : 'URL was'} copied automatically; press R to copy again.</>
								)}
							</p>
						</AlertDescription>
					</Alert>
				)}
			</div>

			<Card className="border-primary/20">
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4" aria-label="Upload files">
						<div aria-live="assertive" aria-atomic="true">
							{(error || clientBlock) && (
								<Alert variant="destructive">
									<AlertDescription>{error || clientBlock}</AlertDescription>
								</Alert>
							)}
						</div>

						<div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
							{quotaLoadState === 'loading' && <p>Loading storage quota…</p>}
							{quotaLoadState === 'error' && <p>Could not load storage info. Limits still apply on the server.</p>}
							{quotaLoadState === 'ok' && quota && (
								<p>
									Storage: {fmtMb(quota.usedBytes)} / {fmtMb(quota.limitBytes)} MB used · {fmtMb(quota.remainingBytes)} MB available ·
									up to {fmtMb(quota.maxFileSizeBytes)} MB per file
									{selectedFiles.length > 0 && <> · selection: {fmtMb(selectedFiles.reduce((s, f) => s + f.size, 0))} MB</>}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label>
								Files
								<RequiredMark />
							</Label>
							<FileDropZone
								key={fileResetKey}
								inputRef={fileRef}
								multiple
								name="files"
								required
								aria-required="true"
								onFilesChange={files => {
									setSelectedFiles(files);
									setError('');
								}}
								onPastedFiles={submitOnPaste ? submitAfterPaste : undefined}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="filename" className={cn(!singleFileSelection && 'text-muted-foreground opacity-70')}>
								Custom Filename
							</Label>
							<Input
								id="filename"
								name="filename"
								type="text"
								placeholder="Leave blank to use original filename."
								value={filename}
								onChange={e => setFilename(e.target.value)}
								disabled={!singleFileSelection}
							/>
							{!singleFileSelection && (
								<p className="text-xs text-muted-foreground">Remove extra files to set a custom filename for one file.</p>
							)}
						</div>

						<div className="space-y-2">
							<Label>
								Expiry
								<RequiredMark />
							</Label>
							<Select value={expiry} onValueChange={setExpiry} required>
								<SelectTrigger aria-required="true">
									<SelectValue placeholder="Select expiry time" />
								</SelectTrigger>
								<SelectContent>
									{expiryOptions.map(opt => (
										<SelectItem key={opt.value} value={opt.value}>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<Button type="submit" className="w-full" disabled={uploading || submitBlockedByClient} aria-busy={uploading}>
							{uploading ? 'Uploading...' : 'Upload'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
