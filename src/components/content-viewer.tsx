'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

/** Serialisable content object passed from the server page. */
export interface ContentViewData {
	id: string;
	filename: string;
	originalFilename: string;
	fileSize: number;
	fileExtension: string;
	mimeType: string;
	directory: string | null;
	expiresAt: string | null;
	createdAt: string;
	uploadedBy: { username: string };
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

/* ── CopyField — a clickable row that copies a full URL ─────────── */

function CopyField({ label, path, baseUrl }: { label: string; path: string; baseUrl: string }) {
	const [copied, setCopied] = useState(false);

	const fullUrl = `${baseUrl}${path}`;

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(fullUrl);
			setCopied(true);
			toast.success('Copied to clipboard');
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error('Failed to copy');
		}
	}, [fullUrl]);

	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={handleCopy}
							className="inline-flex items-center gap-1.5 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background rounded-sm cursor-pointer text-left"
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
			</dd>
		</>
	);
}

/* ── Main component ─────────────────────────────────────────────── */

export function ContentViewer({ content, contentBaseUrl }: { content: ContentViewData; contentBaseUrl: string }) {
	const expired = content.expiresAt && new Date(content.expiresAt) < new Date();
	const rawUrl = `/r/${content.id}`;
	const downloadUrl = `/api/content/${content.id}`;
	const mime = content.mimeType;

	if (expired) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Content Expired</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground">
						This content expired on {new Date(content.expiresAt!).toLocaleString()} and is no longer available.
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
					<Link href={rawUrl}>
						<Button variant="outline" size="sm">
							Raw
						</Button>
					</Link>
					<Link href={downloadUrl}>
						<Button size="sm">Download</Button>
					</Link>
				</div>
			</div>

			{/* Inline viewer */}
			<Card>
				<CardContent className="p-4">
					{isImage(mime) && (
						/* eslint-disable-next-line @next/next/no-img-element */
						<img src={rawUrl} alt={content.filename} className="max-w-full h-auto mx-auto rounded" />
					)}

					{isVideo(mime) && (
						<video controls className="max-w-full mx-auto rounded" aria-label={`Video: ${content.filename}`}>
							<source src={rawUrl} type={mime} />
							Your browser does not support this video format.
						</video>
					)}

					{isAudio(mime) && (
						<audio controls className="w-full" aria-label={`Audio: ${content.filename}`}>
							<source src={rawUrl} type={mime} />
							Your browser does not support this audio format.
						</audio>
					)}

					{isPdf(mime) && <iframe src={rawUrl} className="w-full h-[80vh] rounded border-0" title={content.filename} />}

					{isText(mime) && <iframe src={rawUrl} className="w-full h-[60vh] rounded border-0 bg-muted" title={content.filename} />}

					{!isImage(mime) && !isVideo(mime) && !isAudio(mime) && !isPdf(mime) && !isText(mime) && (
						<div className="text-center py-12 space-y-4">
							<p className="text-muted-foreground">This file type ({mime}) cannot be previewed in the browser.</p>
							<Link href={downloadUrl}>
								<Button>Download File</Button>
							</Link>
						</div>
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

						<dt className="text-muted-foreground">Type</dt>
						<dd>{content.mimeType}</dd>

						<dt className="text-muted-foreground">Extension</dt>
						<dd>
							<Badge variant="secondary">{content.fileExtension}</Badge>
						</dd>

						<dt className="text-muted-foreground">Uploaded By</dt>
						<dd>{content.uploadedBy.username}</dd>

						<dt className="text-muted-foreground">Created</dt>
						<dd>{new Date(content.createdAt).toLocaleString()}</dd>

						<dt className="text-muted-foreground">Expires</dt>
						<dd>{content.expiresAt ? new Date(content.expiresAt).toLocaleString() : 'Never'}</dd>

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
						<CopyField label="Content URL" path={`/c/${content.id}`} baseUrl={contentBaseUrl} />
						<CopyField label="Raw URL" path={`/r/${content.id}`} baseUrl={contentBaseUrl} />

						{content.shortSlugs.map(({ slug }) => (
							<CopyField key={slug} label={`Short URL`} path={`/s/${slug}`} baseUrl={contentBaseUrl} />
						))}

						{content.shortSlugs.map(({ slug }) => (
							<CopyField key={`embed-${slug}`} label={`Embed URL`} path={`/e/${slug}`} baseUrl={contentBaseUrl} />
						))}
					</dl>
				</CardContent>
			</Card>
		</div>
	);
}
