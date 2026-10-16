'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Ban, Copy, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ClientDateYmd } from '@/components/client-date-ymd';

interface ShortLinkItem {
	slug: string;
	destinationUrl: string;
	shortUrl: string;
	clickCount: number;
	lastClickedAt: string | null;
	isRevoked: boolean;
	revokedAt: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: { username: string };
}

export function LinkManager() {
	const [links, setLinks] = useState<ShortLinkItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [slug, setSlug] = useState('');
	const [destinationUrl, setDestinationUrl] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const fetchLinks = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch('/api/admin/links');
			if (!res.ok) throw new Error('Failed to load links');
			const data = await res.json();
			setLinks(data.links);
		} catch {
			toast.error('Failed to load short links');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchLinks();
	}, [fetchLinks]);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		try {
			const res = await fetch('/api/admin/links', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug, destinationUrl }),
			});
			const data = await res.json();
			if (!res.ok) {
				toast.error(data.error || 'Failed to create link');
				return;
			}
			toast.success(`Short link created: /l/${data.link.slug}`);
			setSlug('');
			setDestinationUrl('');
			await fetchLinks();
		} catch {
			toast.error('Failed to create link');
		} finally {
			setSubmitting(false);
		}
	}

	async function handleRevoke(linkSlug: string, revoke: boolean) {
		const action = revoke ? 'revoke' : 'reactivate';
		if (revoke && !confirm(`Revoke /l/${linkSlug}? It will stop redirecting but analytics are kept.`)) return;
		try {
			const res = await fetch(`/api/admin/links/${encodeURIComponent(linkSlug)}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ revoked: revoke }),
			});
			const data = await res.json();
			if (!res.ok) {
				toast.error(data.error || `Failed to ${action} link`);
				return;
			}
			toast.success(revoke ? `Revoked /l/${linkSlug}` : `Reactivated /l/${linkSlug}`);
			await fetchLinks();
		} catch {
			toast.error(`Failed to ${action} link`);
		}
	}

	async function handleDelete(linkSlug: string) {
		if (!confirm(`Permanently delete /l/${linkSlug} and its analytics?`)) return;
		try {
			const res = await fetch(`/api/admin/links/${encodeURIComponent(linkSlug)}`, { method: 'DELETE' });
			if (!res.ok) {
				const data = await res.json();
				toast.error(data.error || 'Failed to delete link');
				return;
			}
			toast.success(`Deleted /l/${linkSlug}`);
			await fetchLinks();
		} catch {
			toast.error('Failed to delete link');
		}
	}

	function copyUrl(url: string) {
		navigator.clipboard.writeText(url);
		toast.success('Copied to clipboard');
	}

	return (
		<div className="space-y-8">
			<form onSubmit={handleCreate} className="space-y-4 max-w-xl">
				<h2 className="text-lg font-semibold">Create short link</h2>
				<div className="space-y-2">
					<Label htmlFor="link-slug">Slug</Label>
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground shrink-0">/l/</span>
						<Input
							id="link-slug"
							value={slug}
							onChange={e => setSlug(e.target.value)}
							placeholder="qr"
							pattern="[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*"
							required
						/>
					</div>
				</div>
				<div className="space-y-2">
					<Label htmlFor="link-destination">Destination URL</Label>
					<Input
						id="link-destination"
						type="url"
						value={destinationUrl}
						onChange={e => setDestinationUrl(e.target.value)}
						placeholder="https://example.com/page"
						required
					/>
				</div>
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Creating…' : 'Create link'}
				</Button>
			</form>

			<div>
				<h2 className="text-lg font-semibold mb-4">Short links</h2>
				{loading ? (
					<p className="text-muted-foreground text-sm">Loading…</p>
				) : links.length === 0 ? (
					<p className="text-muted-foreground text-sm">No short links yet.</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Short URL</TableHead>
								<TableHead>Destination</TableHead>
								<TableHead>Clicks</TableHead>
								<TableHead>Last click</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="w-32">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{links.map(link => (
								<TableRow key={link.slug} className={link.isRevoked ? 'opacity-60' : undefined}>
									<TableCell className="font-mono text-sm">
										<a href={link.shortUrl} className="text-primary underline" target="_blank" rel="noopener noreferrer">
											/l/{link.slug}
										</a>
									</TableCell>
									<TableCell className="max-w-xs truncate">
										<a href={link.destinationUrl} className="underline" target="_blank" rel="noopener noreferrer">
											{link.destinationUrl}
										</a>
									</TableCell>
									<TableCell className="text-sm tabular-nums">{link.clickCount}</TableCell>
									<TableCell className="text-sm text-muted-foreground">
										{link.lastClickedAt ? <ClientDateYmd date={link.lastClickedAt} /> : '—'}
									</TableCell>
									<TableCell>
										{link.isRevoked ? (
											<Badge variant="outline" className="text-destructive border-destructive/30">
												Revoked
											</Badge>
										) : (
											<Badge variant="outline" className="text-primary border-primary/30">
												Active
											</Badge>
										)}
									</TableCell>
									<TableCell>
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0"
												onClick={() => copyUrl(link.shortUrl)}
												aria-label="Copy short URL"
											>
												<Copy className="h-4 w-4" />
											</Button>
											{link.isRevoked ? (
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0"
													onClick={() => handleRevoke(link.slug, false)}
													aria-label="Reactivate link"
												>
													<RotateCcw className="h-4 w-4" />
												</Button>
											) : (
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0 text-destructive"
													onClick={() => handleRevoke(link.slug, true)}
													aria-label="Revoke link"
												>
													<Ban className="h-4 w-4" />
												</Button>
											)}
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0 text-destructive"
												onClick={() => handleDelete(link.slug)}
												aria-label="Delete link"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</div>
		</div>
	);
}
