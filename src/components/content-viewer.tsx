'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useSetContentPageCopyInfo } from '@/components/content-page-copy-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Copy, Check, Flag } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { REPORT_REASON_MAX_LENGTH } from '@/lib/content-report';
import { shouldWarnBeforeDownloadOrRaw } from '@/lib/file-download-risk';
import { ClientDateYmd } from '@/components/client-date-ymd';

/** Serialisable content object passed from the server page. */
export interface ContentViewData {
	id: string;
	filename: string;
	originalFilename: string;
	fileSize: number;
	fileExtension: string;
	mimeType: string;
	directory: string | null;
	imageWidth: number | null;
	imageHeight: number | null;
	expiresAt: string | null;
	createdAt: string;
	uploadedBy: { username: string };
	/** True when the uploader's account role is guest (self-serve or otherwise). */
	guestUpload: boolean;
	shortSlugs: { slug: string }[];
}

/* ── helpers ────────────────────────────────────────────────────────── */

function isImage(mime: string) {
	return mime.startsWith('image/');
}
function isVideo(mime: string) {
	return mime.startsWith('video/');
}
function isAudio(mime: string) {
	return mime.startsWith('audio/');
}
function isPdf(mime: string) {
	return mime === 'application/pdf';
}
function isText(mime: string) {
	return mime === 'text/plain' || mime === 'text/csv';
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const KBD_HINT =
	'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-medium text-foreground';

/* ── CopyField — a clickable row that copies a full URL ─────────── */

function CopyField({
	label,
	path,
	baseUrl,
	wrapCopy,
	shortcutKey,
}: {
	label: string;
	path: string;
	baseUrl: string;
	/** When set, the parent runs the copy only after the user confirms the disclaimer. */
	wrapCopy?: (doCopy: () => Promise<void>) => void;
	/** Single-key shortcut that copies this URL type (see KeyboardShortcuts). */
	shortcutKey?: string;
}) {
	const [copied, setCopied] = useState(false);

	const fullUrl = `${baseUrl}${path}`;

	const handleCopy = useCallback(async () => {
		const doCopy = async () => {
			try {
				await navigator.clipboard.writeText(fullUrl);
				setCopied(true);
				toast.success('Copied to clipboard');
				setTimeout(() => setCopied(false), 2000);
			} catch {
				toast.error('Failed to copy');
			}
		};
		if (wrapCopy) {
			wrapCopy(doCopy);
		} else {
			await doCopy();
		}
	}, [fullUrl, wrapCopy]);

	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="flex min-w-0 items-center gap-2">
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={handleCopy}
							className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background rounded-sm cursor-pointer text-left"
						>
							<span className="truncate max-w-64">{path}</span>
							{copied ? (
								<Check className="h-3.5 w-3.5 shrink-0 text-green-500" aria-hidden="true" />
							) : (
								<Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
							)}
						</button>
					</TooltipTrigger>
					<TooltipContent>{copied ? 'Copied!' : `Copy ${fullUrl}`}</TooltipContent>
				</Tooltip>
				{shortcutKey ? (
					<kbd className={KBD_HINT} title={`Press ${shortcutKey} to copy`} aria-label={`Keyboard shortcut ${shortcutKey} to copy`}>
						{shortcutKey}
					</kbd>
				) : null}
			</dd>
		</>
	);
}

/* ── Report content ───────────────────────────────────────────────── */

function ReportContentButton({ contentId, guestUpload }: { contentId: string; guestUpload: boolean }) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const len = reason.length;
	const overLimit = len > REPORT_REASON_MAX_LENGTH;

	const submit = async () => {
		const trimmed = reason.trim();
		if (!trimmed || overLimit) return;
		setSubmitting(true);
		try {
			const res = await fetch(`/api/content/${contentId}/report`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reason: trimmed }),
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				toast.error(data.error || 'Could not send report');
				return;
			}
			toast.success('Report sent');
			setOpen(false);
			setReason('');
		} catch {
			toast.error('Could not send report');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" variant={guestUpload ? 'default' : 'outline'} size="sm">
					<Flag className="h-3.5 w-3.5" aria-hidden="true" />
					Report content
				</Button>
			</DialogTrigger>
			<DialogContent showCloseButton={!submitting}>
				<DialogHeader>
					<DialogTitle>Report content</DialogTitle>
					<DialogDescription>Serious reports only, please. Max {REPORT_REASON_MAX_LENGTH} characters.</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor="report-reason">Reason</Label>
					<textarea
						id="report-reason"
						rows={4}
						maxLength={REPORT_REASON_MAX_LENGTH}
						value={reason}
						onChange={e => setReason(e.target.value)}
						disabled={submitting}
						className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
						placeholder="Describe the issue…"
					/>
					<p className={`text-xs text-right ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
						{len}/{REPORT_REASON_MAX_LENGTH}
					</p>
				</div>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
						Cancel
					</Button>
					<Button type="button" onClick={submit} disabled={submitting || !reason.trim() || overLimit}>
						{submitting ? 'Sending…' : 'Submit report'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Intercepts context menu on previews so “Save as” flows see the same disclaimer as Download. */
function PreviewContextGuard({
	active,
	onRiskyContextMenu,
	children,
}: {
	active: boolean;
	onRiskyContextMenu: () => void;
	children: ReactNode;
}) {
	const handleContextMenu = (e: React.MouseEvent) => {
		if (!active) return;
		e.preventDefault();
		onRiskyContextMenu();
	};
	return <div onContextMenu={handleContextMenu}>{children}</div>;
}

/* ── Main component ─────────────────────────────────────────────── */

export function ContentViewer({ content, contentBaseUrl }: { content: ContentViewData; contentBaseUrl: string }) {
	const expired = content.expiresAt && new Date(content.expiresAt) < new Date();
	const setCopyInfo = useSetContentPageCopyInfo();
	const [riskOpen, setRiskOpen] = useState(false);
	const [, setPendingAction] = useState<null | (() => void)>(null);

	const rawUrl = `${contentBaseUrl}/r/${content.id}`;
	const downloadUrl = `${contentBaseUrl}/api/content/${content.id}`;
	const mime = content.mimeType;

	const warnBeforeRawOrDownload = shouldWarnBeforeDownloadOrRaw(content.fileExtension);
	const extLabel = content.fileExtension.trim() || '(none)';

	const openRiskDialog = useCallback((action: () => void) => {
		setPendingAction(() => action);
		setRiskOpen(true);
	}, []);

	const wrapEmbedCopy = useCallback(
		(doCopy: () => Promise<void>) => {
			if (!warnBeforeRawOrDownload) {
				doCopy();
				return;
			}
			openRiskDialog(() => {
				doCopy();
			});
		},
		[warnBeforeRawOrDownload, openRiskDialog]
	);

	const interceptNavigate = useCallback(
		(e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
			if (!warnBeforeRawOrDownload) return;
			e.preventDefault();
			openRiskDialog(() => window.location.assign(url));
		},
		[warnBeforeRawOrDownload, openRiskDialog]
	);

	const onPreviewContextMenu = useCallback(() => {
		openRiskDialog(() => window.location.assign(downloadUrl));
	}, [downloadUrl, openRiskDialog]);

	const confirmRisk = useCallback(() => {
		setPendingAction(prev => {
			prev?.();
			return null;
		});
		setRiskOpen(false);
	}, []);

	const cancelRisk = useCallback(() => {
		setPendingAction(null);
		setRiskOpen(false);
	}, []);

	useEffect(() => {
		if (expired) {
			setCopyInfo(null);
			return;
		}
		setCopyInfo({
			contentId: content.id,
			shortSlugs: content.shortSlugs.map(s => s.slug),
			contentBaseUrl,
		});
		return () => setCopyInfo(null);
	}, [expired, content.id, content.shortSlugs, contentBaseUrl, setCopyInfo]);

	if (expired) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Content Expired</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground">
						This content expired on <ClientDateYmd iso={content.expiresAt!} className="inline" /> and is no longer available.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-semibold truncate">{content.filename}</h1>
				<div className="flex gap-2 shrink-0">
					<ReportContentButton contentId={content.id} guestUpload={content.guestUpload} />
					<Link href={rawUrl} onClick={e => interceptNavigate(e, rawUrl)}>
						<Button variant="outline" size="sm">
							Raw
						</Button>
					</Link>
					<Link href={downloadUrl} onClick={e => interceptNavigate(e, downloadUrl)}>
						<Button size="sm">Download</Button>
					</Link>
				</div>
			</div>

			{/* Inline viewer */}
			<Card>
				<CardContent className="p-4">
					{isImage(mime) && (
						<PreviewContextGuard active={warnBeforeRawOrDownload} onRiskyContextMenu={onPreviewContextMenu}>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={rawUrl} alt={content.filename} className="max-w-full h-auto mx-auto rounded" />
						</PreviewContextGuard>
					)}

					{isVideo(mime) && (
						<PreviewContextGuard active={warnBeforeRawOrDownload} onRiskyContextMenu={onPreviewContextMenu}>
							<video controls className="max-w-full mx-auto rounded" aria-label={`Video: ${content.filename}`}>
								<source src={rawUrl} type={mime} />
								Your browser does not support this video format.
							</video>
						</PreviewContextGuard>
					)}

					{isAudio(mime) && (
						<PreviewContextGuard active={warnBeforeRawOrDownload} onRiskyContextMenu={onPreviewContextMenu}>
							<audio controls className="w-full" aria-label={`Audio: ${content.filename}`}>
								<source src={rawUrl} type={mime} />
								Your browser does not support this audio format.
							</audio>
						</PreviewContextGuard>
					)}

					{isPdf(mime) && (
						<PreviewContextGuard active={warnBeforeRawOrDownload} onRiskyContextMenu={onPreviewContextMenu}>
							<iframe src={rawUrl} className="w-full h-[80vh] rounded border-0" title={content.filename} />
						</PreviewContextGuard>
					)}

					{isText(mime) && (
						<PreviewContextGuard active={warnBeforeRawOrDownload} onRiskyContextMenu={onPreviewContextMenu}>
							<iframe src={rawUrl} className="w-full h-[60vh] rounded border-0 bg-muted" title={content.filename} />
						</PreviewContextGuard>
					)}

					{!isImage(mime) && !isVideo(mime) && !isAudio(mime) && !isPdf(mime) && !isText(mime) && (
						<PreviewContextGuard active={warnBeforeRawOrDownload} onRiskyContextMenu={onPreviewContextMenu}>
							<div className="text-center py-12 space-y-4">
								<p className="text-muted-foreground">This file type ({mime}) cannot be previewed in the browser.</p>
								<Link href={downloadUrl} onClick={e => interceptNavigate(e, downloadUrl)}>
									<Button>Download File</Button>
								</Link>
							</div>
						</PreviewContextGuard>
					)}
				</CardContent>
			</Card>

			{/* Metadata */}
			<Card>
				<CardContent>
					<h2 className="sr-only">File metadata</h2>
					<dl className="grid grid-cols-2 gap-2 text-sm">
						<dt className="text-muted-foreground">Original Name</dt>
						<dd>{content.originalFilename}</dd>

						<dt className="text-muted-foreground">Size</dt>
						<dd>{formatSize(content.fileSize)}</dd>

						{isImage(mime) && content.imageWidth != null && content.imageHeight != null && (
							<>
								<dt className="text-muted-foreground">Dimensions</dt>
								<dd>
									{content.imageWidth} × {content.imageHeight}
								</dd>
							</>
						)}

						<dt className="text-muted-foreground">Type</dt>
						<dd>{content.mimeType}</dd>

						<dt className="text-muted-foreground">Extension</dt>
						<dd>
							<Badge variant="secondary">{content.fileExtension}</Badge>
						</dd>

						<dt className="text-muted-foreground">Uploaded By</dt>
						<dd>{content.uploadedBy.username}</dd>

						<dt className="text-muted-foreground">Created</dt>
						<dd>
							<ClientDateYmd iso={content.createdAt} />
						</dd>

						<dt className="text-muted-foreground">Expires</dt>
						<dd>{content.expiresAt ? <ClientDateYmd iso={content.expiresAt} /> : 'Never'}</dd>

						{content.directory && (
							<>
								<dt className="text-muted-foreground">Directory</dt>
								<dd>
									<Badge variant="outline">{content.directory}</Badge>
								</dd>
							</>
						)}
					</dl>
				</CardContent>
			</Card>

			{/* URLs */}
			<Card>
				<CardContent>
					<h2 className="sr-only">URLs</h2>
					<dl className="grid grid-cols-2 gap-2 text-sm">
						<CopyField label="Content URL" path={`/c/${content.id}`} baseUrl={contentBaseUrl} shortcutKey="C" />
						<CopyField label="Raw URL" path={`/r/${content.id}`} baseUrl={contentBaseUrl} shortcutKey="R" />

						{content.shortSlugs.map(({ slug }) => (
							<CopyField key={slug} label={`Short URL`} path={`/s/${slug}`} baseUrl={contentBaseUrl} shortcutKey="S" />
						))}

						{content.shortSlugs.map(({ slug }) => (
							<CopyField
								key={`embed-${slug}`}
								label="Embed URL"
								path={`/e/${slug}`}
								baseUrl={contentBaseUrl}
								wrapCopy={warnBeforeRawOrDownload ? wrapEmbedCopy : undefined}
								shortcutKey="E"
							/>
						))}
					</dl>
				</CardContent>
			</Card>

			<Dialog open={riskOpen} onOpenChange={open => !open && cancelRisk()}>
				<DialogContent showCloseButton>
					<DialogHeader>
						<DialogTitle>Be careful with this file</DialogTitle>
						<DialogDescription className="space-y-2">
							<p>
								This file is labeled <span className="font-medium text-foreground">{extLabel}</span>. That type is either not a usual
								format on this site, or is often used for programs, installers, disk images, or compressed archives (for example ZIP).
							</p>
							<p>Do not open, run, or save it unless you fully trust the uploader. Malicious files can harm your device or account.</p>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={cancelRisk}>
							Cancel
						</Button>
						<Button type="button" onClick={confirmRisk}>
							Continue
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
