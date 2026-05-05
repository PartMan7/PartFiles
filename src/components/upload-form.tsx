'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileDropZone } from '@/components/file-drop-zone';
import { RequiredMark } from '@/components/required-mark';
import { toast } from 'sonner';
import { useLastUpload } from '@/components/last-upload-context';
import { type QuotaPayload, clientUploadBlockMessage } from '@/lib/upload-quota-client';
import { UploadQuotaBanner } from '@/components/upload-quota-banner';
import { ClientDateYmd } from '@/components/client-date-ymd';
import { cn } from '@/lib/utils';
import { buildTextUploadFile } from '@/lib/upload-text-file';
import { X } from 'lucide-react';

type UploadMethod = 'files' | 'rawText';

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
	const [uploadMethod, setUploadMethod] = useState<UploadMethod>('files');
	const [rawText, setRawText] = useState('');

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

	useEffect(() => {
		if (uploadMethod === 'rawText') {
			setFileResetKey(k => k + 1);
			setSelectedFiles([]);
		} else {
			setRawText('');
		}
	}, [uploadMethod]);

	const filesForQuota = useMemo(() => {
		if (uploadMethod === 'rawText') {
			if (rawText.length === 0) return [];
			return [buildTextUploadFile(rawText, filename)];
		}
		return selectedFiles;
	}, [uploadMethod, rawText, filename, selectedFiles]);

	const clientBlock = useMemo(() => (quota ? clientUploadBlockMessage(quota, filesForQuota) : null), [quota, filesForQuota]);

	const submitBlockedByClient = Boolean(quota && clientBlock);
	const singleFileSelection = uploadMethod === 'rawText' || selectedFiles.length <= 1;

	const handleSubmitRef = useRef<(e: React.FormEvent<HTMLFormElement>) => void | Promise<void>>(() => {});

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError('');
		setResults(null);
		setUploading(true);

		try {
			let files: File[];

			if (uploadMethod === 'rawText') {
				if (rawText.length === 0) {
					setError('Please enter some text');
					setUploading(false);
					return;
				}
				files = [buildTextUploadFile(rawText, filename)];
			} else {
				const input = fileRef.current;
				const list = input?.files;
				if (!list?.length) {
					setError('Please select at least one file');
					setUploading(false);
					return;
				}

				files = Array.from(list).filter(f => f.size > 0);
				if (files.length === 0) {
					setError('Please select at least one file');
					setUploading(false);
					return;
				}
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
				formData.set('filename', uploadMethod === 'rawText' ? files[0].name : trimmed);
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
				setRawText('');
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
					<form onSubmit={handleSubmit} className="space-y-4" aria-label="Upload files or text">
						<div aria-live="assertive" aria-atomic="true">
							{(error || clientBlock) && (
								<Alert variant="destructive">
									<AlertDescription>{error || clientBlock}</AlertDescription>
								</Alert>
							)}
						</div>

						<UploadQuotaBanner loadState={quotaLoadState} quota={quota} filesForQuota={filesForQuota} />

						<div className="space-y-2">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<Label id="upload-source-label" className="text-sm font-medium leading-none">
									{uploadMethod === 'files' ? (
										<>
											Files <RequiredMark />
										</>
									) : (
										<>
											Text <RequiredMark />
										</>
									)}
								</Label>
								<RadioGroup
									value={uploadMethod}
									onValueChange={v => setUploadMethod(v as UploadMethod)}
									className="flex flex-wrap items-center gap-x-4 gap-y-1"
									aria-labelledby="upload-source-label"
								>
									<div className="flex items-center gap-2">
										<RadioGroupItem value="files" id="upload-mode-files" />
										<Label htmlFor="upload-mode-files" className="cursor-pointer font-normal">
											Upload files
										</Label>
									</div>
									<div className="flex items-center gap-2">
										<RadioGroupItem value="rawText" id="upload-mode-raw" />
										<Label htmlFor="upload-mode-raw" className="cursor-pointer font-normal">
											Upload raw text
										</Label>
									</div>
								</RadioGroup>
							</div>
							{uploadMethod === 'files' ? (
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
							) : (
								<textarea
									id="raw-text"
									name="rawText"
									required
									aria-required="true"
									aria-labelledby="upload-source-label"
									value={rawText}
									onChange={e => {
										setRawText(e.target.value);
										setError('');
									}}
									placeholder="Paste or type text — stored as a .txt file."
									rows={10}
									className={cn(
										'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
										'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
										'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
										'min-h-[120px] resize-y'
									)}
								/>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="filename" className={cn(!singleFileSelection && 'text-muted-foreground opacity-70')}>
								Custom Filename
							</Label>
							<Input
								id="filename"
								name="filename"
								type="text"
								placeholder="Leave blank to use the default name."
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
