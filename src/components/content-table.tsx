'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Link2, Trash2, ShieldCheck, Unlink } from 'lucide-react';
import { toast } from 'sonner';

interface ContentItem {
	id: string;
	filename: string;
	originalFilename: string;
	directory: string | null;
	shortSlugs: { slug: string }[];
	fileSize: number;
	fileExtension: string;
	mimeType: string;
	previewPath: string | null;
	expiresAt: string | null;
	createdAt: string;
	uploadedBy: {
		id: string;
		username: string;
		role: string;
	};
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function isExpired(expiresAt: string | null): boolean {
	if (!expiresAt) return false;
	return new Date(expiresAt) < new Date();
}

function isImage(mimeType: string): boolean {
	return mimeType.startsWith('image/');
}

/** Category colour for the file-type icon badge (Catppuccin palette). */
function extColor(ext: string): { bg: string; fg: string; accent: string } {
	const e = ext.toLowerCase().replace(/^\./, '');
	// Documents
	if (['pdf'].includes(e)) return { bg: 'bg-ctp-red/10', fg: 'text-ctp-red', accent: 'bg-ctp-red' };
	if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(e)) return { bg: 'bg-ctp-blue/10', fg: 'text-ctp-blue', accent: 'bg-ctp-blue' };
	if (['xls', 'xlsx', 'ods', 'csv'].includes(e)) return { bg: 'bg-ctp-green/10', fg: 'text-ctp-green', accent: 'bg-ctp-green' };
	if (['ppt', 'pptx', 'odp'].includes(e)) return { bg: 'bg-ctp-peach/10', fg: 'text-ctp-peach', accent: 'bg-ctp-peach' };
	// Archives
	if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes(e)) return { bg: 'bg-ctp-yellow/10', fg: 'text-ctp-yellow', accent: 'bg-ctp-yellow' };
	// Media
	if (['mp3', 'wav', 'ogg', 'flv'].includes(e)) return { bg: 'bg-ctp-mauve/10', fg: 'text-ctp-mauve', accent: 'bg-ctp-mauve' };
	if (['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(e)) return { bg: 'bg-ctp-pink/10', fg: 'text-ctp-pink', accent: 'bg-ctp-pink' };
	// Images (fallback for images without preview)
	if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'tiff', 'avif'].includes(e)) return { bg: 'bg-ctp-flamingo/10', fg: 'text-ctp-flamingo', accent: 'bg-ctp-flamingo' };
	// Data
	if (['json', 'xml', 'yaml', 'yml'].includes(e)) return { bg: 'bg-ctp-teal/10', fg: 'text-ctp-teal', accent: 'bg-ctp-teal' };
	// Fonts
	if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(e)) return { bg: 'bg-ctp-lavender/10', fg: 'text-ctp-lavender', accent: 'bg-ctp-lavender' };
	// Fallback
	return { bg: 'bg-ctp-overlay0/10', fg: 'text-ctp-overlay0', accent: 'bg-ctp-overlay0' };
}

/** Renders a small file-type badge that looks like a document icon. */
function FileExtIcon({ ext }: { ext: string }) {
	const label = ext.replace(/^\./, '').toUpperCase();
	const { bg, fg, accent } = extColor(ext);
	return (
		<div className={`relative w-10 h-10 rounded-md ${bg} flex flex-col items-center justify-end overflow-hidden border`}>
			{/* Folded corner */}
			<div className="absolute top-0 right-0 w-3 h-3">
				<div className="absolute top-0 right-0 w-0 h-0 border-t-[12px] border-t-background border-l-[12px] border-l-transparent" />
			</div>
			{/* Extension label pill */}
			<div className={`${accent} rounded-sm px-1 py-[1px] mb-1.5`}>
				<span className="text-[8px] font-extrabold leading-none text-white tracking-wide">
					{label}
				</span>
			</div>
		</div>
	);
}

export function ContentManager() {
	const [content, setContent] = useState<ContentItem[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchContent = useCallback(async () => {
		try {
			const res = await fetch('/api/admin/content');
			const data = await res.json();
			setContent(data.content || []);
		} catch {
			toast.error('Failed to load content');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchContent();
	}, [fetchContent]);

	async function handleDelete(item: ContentItem) {
		if (!confirm(`Delete "${item.filename}"? This cannot be undone.`)) return;

		try {
			const res = await fetch(`/api/admin/content/${item.id}`, { method: 'DELETE' });
			if (res.ok) {
				toast.success(`"${item.filename}" deleted`);
				fetchContent();
			} else {
				const data = await res.json();
				toast.error(data.error || 'Failed to delete content');
			}
		} catch {
			toast.error('Failed to delete content');
		}
	}

	async function handleAddSlug(item: ContentItem) {
		const slug = prompt('Enter a new short slug for /s/ URL:');
		if (!slug) return;

		try {
			const res = await fetch(`/api/admin/content/${item.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ addSlugs: [slug] }),
			});
			if (res.ok) {
				toast.success(`Short URL added: /s/${slug}`);
				fetchContent();
			} else {
				const data = await res.json();
				toast.error(data.error || 'Failed to add slug');
			}
		} catch {
			toast.error('Failed to add slug');
		}
	}

	async function handleRemoveSlug(item: ContentItem, slug: string) {
		if (!confirm(`Remove short URL /s/${slug}?`)) return;

		try {
			const res = await fetch(`/api/admin/content/${item.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ removeSlugs: [slug] }),
			});
			if (res.ok) {
				toast.success(`Short URL /s/${slug} removed`);
				fetchContent();
			} else {
				const data = await res.json();
				toast.error(data.error || 'Failed to remove slug');
			}
		} catch {
			toast.error('Failed to remove slug');
		}
	}

	async function handleRemoveExpiry(item: ContentItem) {
		try {
			const res = await fetch(`/api/admin/content/${item.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ expiresAt: null }),
			});
			if (res.ok) {
				toast.success('Expiry removed');
				fetchContent();
			} else {
				toast.error('Failed to update content');
			}
		} catch {
			toast.error('Failed to update content');
		}
	}

	if (loading) return <p className="text-muted-foreground">Loading content...</p>;

	return (
		<div className="space-y-4">
			<p className="text-muted-foreground">{content.length} item(s)</p>

			<div className="rounded-md border overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-10"></TableHead>
							<TableHead>Filename</TableHead>
							<TableHead>Short URLs</TableHead>
							<TableHead>Directory</TableHead>
							<TableHead>Size</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Uploaded By</TableHead>
							<TableHead>Expiry</TableHead>
							<TableHead>Created</TableHead>
							<TableHead className="text-right w-12">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{content.map(item => (
							<TableRow key={item.id} className={isExpired(item.expiresAt) ? 'opacity-50' : ''}>
								<TableCell>
									{isImage(item.mimeType) && item.previewPath ? (
										/* eslint-disable-next-line @next/next/no-img-element */
										<img
											src={`/api/preview/${item.id}`}
											alt={item.filename}
											className="w-10 h-10 object-cover rounded border"
											loading="lazy"
										/>
									) : (
										<FileExtIcon ext={item.fileExtension} />
									)}
								</TableCell>
								<TableCell className="font-medium max-w-48 truncate">{item.filename}</TableCell>
								<TableCell>
									<div className="flex flex-col gap-1">
										{item.shortSlugs.length > 0 ? (
											item.shortSlugs.map(({ slug }) => (
												<div key={slug} className="flex items-center gap-1">
													<a href={`/s/${slug}`} className="text-primary underline text-sm" target="_blank">
														/s/{slug}
													</a>
												</div>
											))
										) : (
											<span className="text-muted-foreground text-sm">-</span>
										)}
									</div>
								</TableCell>
								<TableCell>
									{item.directory ? (
										<Badge variant="outline">{item.directory}</Badge>
									) : (
										<span className="text-muted-foreground">-</span>
									)}
								</TableCell>
								<TableCell>{formatSize(item.fileSize)}</TableCell>
								<TableCell>
									<Badge variant="secondary">{item.fileExtension}</Badge>
								</TableCell>
								<TableCell>{item.uploadedBy.username}</TableCell>
								<TableCell>
									{item.expiresAt ? (
										isExpired(item.expiresAt) ? (
											<Badge variant="destructive">Expired</Badge>
										) : (
											<span className="text-sm">{new Date(item.expiresAt).toLocaleString()}</span>
										)
									) : (
										<Badge>Permanent</Badge>
									)}
								</TableCell>
								<TableCell className="text-sm">{new Date(item.createdAt).toLocaleDateString()}</TableCell>
								<TableCell className="text-right">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
												<MoreHorizontal className="h-4 w-4" />
												<span className="sr-only">Open menu</span>
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onClick={() => window.open(`/c/${item.id}`, '_blank')}>
												<Eye className="mr-2 h-4 w-4" />
												View
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => handleAddSlug(item)}>
												<Link2 className="mr-2 h-4 w-4" />
												Add Slug
											</DropdownMenuItem>
											{item.shortSlugs.length > 0 &&
												item.shortSlugs.map(({ slug }) => (
													<DropdownMenuItem
														key={slug}
														onClick={() => handleRemoveSlug(item, slug)}
													>
														<Unlink className="mr-2 h-4 w-4" />
														Remove /s/{slug}
													</DropdownMenuItem>
												))}
											{item.expiresAt && !isExpired(item.expiresAt) && (
												<DropdownMenuItem onClick={() => handleRemoveExpiry(item)}>
													<ShieldCheck className="mr-2 h-4 w-4" />
													Make Permanent
												</DropdownMenuItem>
											)}
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onClick={() => handleDelete(item)}
											>
												<Trash2 className="mr-2 h-4 w-4" />
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							</TableRow>
						))}
						{content.length === 0 && (
							<TableRow>
								<TableCell colSpan={10} className="text-center text-muted-foreground py-8">
									No content uploaded yet.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
