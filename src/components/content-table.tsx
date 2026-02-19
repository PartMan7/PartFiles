'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	MoreHorizontal,
	Eye,
	Link2,
	Trash2,
	ShieldCheck,
	Unlink,
	Copy,
	FileCode,
	Search,
	ArrowUpDown,
	ArrowUp,
	ArrowDown,
	X,
	ImageOff,
} from 'lucide-react';
import Link from 'next/link';
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
	hasPreview: boolean;
	expiresAt: string | null;
	createdAt: string;
	uploadedBy: {
		id: string;
		username: string;
		role: string;
	};
}

type SortField = 'filename' | 'fileExtension' | 'fileSize' | 'uploadedBy' | 'expiresAt' | 'createdAt';
type SortDirection = 'asc' | 'desc';

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
	if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes(e))
		return { bg: 'bg-ctp-yellow/10', fg: 'text-ctp-yellow', accent: 'bg-ctp-yellow' };
	// Media
	if (['mp3', 'wav', 'ogg', 'flv'].includes(e)) return { bg: 'bg-ctp-mauve/10', fg: 'text-ctp-mauve', accent: 'bg-ctp-mauve' };
	if (['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(e)) return { bg: 'bg-ctp-pink/10', fg: 'text-ctp-pink', accent: 'bg-ctp-pink' };
	// Images (fallback for images without preview)
	if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'tiff', 'avif'].includes(e))
		return { bg: 'bg-ctp-flamingo/10', fg: 'text-ctp-flamingo', accent: 'bg-ctp-flamingo' };
	// Data
	if (['json', 'xml', 'yaml', 'yml'].includes(e)) return { bg: 'bg-ctp-teal/10', fg: 'text-ctp-teal', accent: 'bg-ctp-teal' };
	// Fonts
	if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(e))
		return { bg: 'bg-ctp-lavender/10', fg: 'text-ctp-lavender', accent: 'bg-ctp-lavender' };
	// Fallback
	return { bg: 'bg-ctp-overlay0/10', fg: 'text-ctp-overlay0', accent: 'bg-ctp-overlay0' };
}

/** Renders a small file-type badge that looks like a document icon. */
function FileExtIcon({ ext }: { ext: string }) {
	const label = ext.replace(/^\./, '').toUpperCase();
	const { bg, accent } = extColor(ext);
	return (
		<div className={`relative w-10 h-10 rounded-md ${bg} flex flex-col items-center justify-end overflow-hidden border`}>
			{/* Folded corner */}
			<div className="absolute top-0 right-0 w-3 h-3">
				<div className="absolute top-0 right-0 w-0 h-0 border-t-[12px] border-t-background border-l-[12px] border-l-transparent" />
			</div>
			{/* Extension label pill */}
			<div className={`${accent} rounded-sm px-1 py-[1px] mb-1.5`}>
				<span className="text-[8px] font-extrabold leading-none text-white tracking-wide">{label}</span>
			</div>
		</div>
	);
}

export function ContentManager({ contentBaseUrl }: { contentBaseUrl: string }) {
	const [content, setContent] = useState<ContentItem[]>([]);
	const [loading, setLoading] = useState(true);

	// Filter state
	const [searchQuery, setSearchQuery] = useState('');
	const [typeFilter, setTypeFilter] = useState('all');
	const [statusFilter, setStatusFilter] = useState('all');
	const [uploaderFilter, setUploaderFilter] = useState('all');
	const [directoryFilter, setDirectoryFilter] = useState('all');

	// Sort state
	const [sortField, setSortField] = useState<SortField>('createdAt');
	const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

	const fetchContent = useCallback(async () => {
		try {
			const params = new URLSearchParams();
			if (statusFilter !== 'all') params.set('expired', statusFilter);
			const query = params.toString();
			const res = await fetch(`/api/admin/content${query ? `?${query}` : ''}`);
			const data = await res.json();
			setContent(data.content || []);
		} catch {
			toast.error('Failed to load content');
		} finally {
			setLoading(false);
		}
	}, [statusFilter]);

	useEffect(() => {
		fetchContent();
	}, [fetchContent]);

	// Derive unique values for filter dropdowns
	const filterOptions = useMemo(() => {
		const types = [...new Set(content.map(c => c.fileExtension))].sort();
		const uploaders = [...new Set(content.map(c => c.uploadedBy.username))].sort();
		const directories = [...new Set(content.map(c => c.directory).filter(Boolean))].sort() as string[];
		return { types, uploaders, directories };
	}, [content]);

	// Whether any filter is active (for the clear-all button)
	const hasActiveFilters =
		searchQuery !== '' || typeFilter !== 'all' || statusFilter !== 'all' || uploaderFilter !== 'all' || directoryFilter !== 'all';

	function clearFilters() {
		setSearchQuery('');
		setTypeFilter('all');
		setStatusFilter('all');
		setUploaderFilter('all');
		setDirectoryFilter('all');
	}

	// Apply client-side filters and sorting
	const filteredContent = useMemo(() => {
		let result = content;

		// Text search
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter(item => item.filename.toLowerCase().includes(q) || item.originalFilename.toLowerCase().includes(q));
		}

		// Type filter
		if (typeFilter !== 'all') {
			result = result.filter(item => item.fileExtension === typeFilter);
		}

		// Uploader filter
		if (uploaderFilter !== 'all') {
			result = result.filter(item => item.uploadedBy.username === uploaderFilter);
		}

		// Directory filter
		if (directoryFilter !== 'all') {
			if (directoryFilter === '_none') {
				result = result.filter(item => !item.directory);
			} else {
				result = result.filter(item => item.directory === directoryFilter);
			}
		}

		// Sort
		result = [...result].sort((a, b) => {
			let cmp = 0;
			switch (sortField) {
				case 'filename':
					cmp = a.filename.localeCompare(b.filename);
					break;
				case 'fileExtension':
					cmp = a.fileExtension.localeCompare(b.fileExtension);
					break;
				case 'fileSize':
					cmp = a.fileSize - b.fileSize;
					break;
				case 'uploadedBy':
					cmp = a.uploadedBy.username.localeCompare(b.uploadedBy.username);
					break;
				case 'expiresAt': {
					const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
					const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
					cmp = aExp - bExp;
					break;
				}
				case 'createdAt':
					cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
					break;
			}
			return sortDirection === 'asc' ? cmp : -cmp;
		});

		return result;
	}, [content, searchQuery, typeFilter, uploaderFilter, directoryFilter, sortField, sortDirection]);

	function handleSort(field: SortField) {
		if (sortField === field) {
			setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
		} else {
			setSortField(field);
			setSortDirection('asc');
		}
	}

	function SortIcon({ field }: { field: SortField }) {
		if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
		return sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
	}

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

	/** Copy the best URL for an item (first short slug, or /c fallback) to clipboard. */
	function copyUrl(item: ContentItem) {
		const path = item.shortSlugs.length > 0 ? `/s/${item.shortSlugs[0].slug}` : `/c/${item.id}`;
		const full = `${contentBaseUrl}${path}`;
		navigator.clipboard.writeText(full).then(
			() => toast.success('URL copied'),
			() => toast.error('Failed to copy')
		);
	}

	/** Copy the raw / embed URL for an item to clipboard. */
	function copyRawUrl(item: ContentItem) {
		const path = item.shortSlugs.length > 0 ? `/e/${item.shortSlugs[0].slug}` : `/r/${item.id}`;
		const full = `${contentBaseUrl}${path}`;
		navigator.clipboard.writeText(full).then(
			() => toast.success('Raw URL copied'),
			() => toast.error('Failed to copy')
		);
	}

	if (loading)
		return (
			<p className="text-muted-foreground" role="status" aria-live="polite">
				Loading content...
			</p>
		);

	return (
		<div className="space-y-4">
			{/* Filter toolbar */}
			<div className="flex flex-wrap items-end gap-3">
				{/* Search */}
				<div className="flex-1 min-w-[200px] max-w-sm">
					<div className="relative">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
						<Input
							placeholder="Search filenames..."
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							className="pl-9"
							aria-label="Search filenames"
						/>
					</div>
				</div>

				{/* File type */}
				<Select value={typeFilter} onValueChange={setTypeFilter}>
					<SelectTrigger aria-label="Filter by file type">
						<SelectValue placeholder="File type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All types</SelectItem>
						{filterOptions.types.map(ext => (
							<SelectItem key={ext} value={ext}>
								{ext}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* Status (expired filter - backed by API) */}
				<Select value={statusFilter} onValueChange={setStatusFilter}>
					<SelectTrigger aria-label="Filter by expiry status">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="active">Active</SelectItem>
						<SelectItem value="expired">Expired</SelectItem>
					</SelectContent>
				</Select>

				{/* Uploaded by */}
				{filterOptions.uploaders.length > 1 && (
					<Select value={uploaderFilter} onValueChange={setUploaderFilter}>
						<SelectTrigger aria-label="Filter by uploader">
							<SelectValue placeholder="Uploaded by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All uploaders</SelectItem>
							{filterOptions.uploaders.map(name => (
								<SelectItem key={name} value={name}>
									{name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}

				{/* Directory */}
				{filterOptions.directories.length > 0 && (
					<Select value={directoryFilter} onValueChange={setDirectoryFilter}>
						<SelectTrigger aria-label="Filter by directory">
							<SelectValue placeholder="Directory" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All directories</SelectItem>
							<SelectItem value="_none">No directory</SelectItem>
							{filterOptions.directories.map(dir => (
								<SelectItem key={dir} value={dir}>
									{dir}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}

				{/* Clear filters */}
				{hasActiveFilters && (
					<Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground">
						<X className="h-3.5 w-3.5" />
						Clear
					</Button>
				)}
			</div>

			<p className="text-muted-foreground" aria-live="polite">
				{filteredContent.length === content.length
					? `${content.length} item(s)`
					: `${filteredContent.length} of ${content.length} item(s)`}
			</p>

			{/* Table */}
			<div className="rounded-md border overflow-x-auto" role="region" aria-label="Content table" tabIndex={0}>
				<Table aria-label="Uploaded content">
					<TableHeader>
						<TableRow>
							<TableHead className="w-10">
								<span className="sr-only">Preview</span>
							</TableHead>
							<TableHead>
								<button
									type="button"
									className="flex items-center hover:text-foreground transition-colors"
									onClick={() => handleSort('filename')}
								>
									Filename <SortIcon field="filename" />
								</button>
							</TableHead>
							<TableHead className="w-12">
								<span className="sr-only">Actions</span>
							</TableHead>
							<TableHead>
								<button
									type="button"
									className="flex items-center hover:text-foreground transition-colors"
									onClick={() => handleSort('fileExtension')}
								>
									Type <SortIcon field="fileExtension" />
								</button>
							</TableHead>
							<TableHead>
								<button
									type="button"
									className="flex items-center hover:text-foreground transition-colors"
									onClick={() => handleSort('fileSize')}
								>
									Size <SortIcon field="fileSize" />
								</button>
							</TableHead>
							<TableHead>
								<button
									type="button"
									className="flex items-center hover:text-foreground transition-colors"
									onClick={() => handleSort('uploadedBy')}
								>
									Uploaded By <SortIcon field="uploadedBy" />
								</button>
							</TableHead>
							<TableHead>
								<button
									type="button"
									className="flex items-center hover:text-foreground transition-colors"
									onClick={() => handleSort('expiresAt')}
								>
									Expiry <SortIcon field="expiresAt" />
								</button>
							</TableHead>
							<TableHead>
								<button
									type="button"
									className="flex items-center hover:text-foreground transition-colors"
									onClick={() => handleSort('createdAt')}
								>
									Created <SortIcon field="createdAt" />
								</button>
							</TableHead>
							<TableHead>Short URLs</TableHead>
							<TableHead>Directory</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredContent.map(item => (
							<TableRow key={item.id} className={isExpired(item.expiresAt) ? 'opacity-50' : ''}>
								{/* Preview */}
								<TableCell>
									{isImage(item.mimeType) && item.hasPreview ? (
										isExpired(item.expiresAt) ? (
											<div className="w-10 h-10 rounded border flex items-center justify-center bg-muted">
												<ImageOff className="h-5 w-5 text-muted-foreground" aria-label="Preview expired" />
											</div>
										) : (
											/* eslint-disable-next-line @next/next/no-img-element */
											<img
												src={`/api/preview/${item.id}`}
												alt={item.filename}
												className="w-10 h-10 object-cover rounded border"
												loading="lazy"
											/>
										)
									) : (
										<FileExtIcon ext={item.fileExtension} />
									)}
								</TableCell>
								{/* Filename */}
								<TableCell className="font-medium max-w-48 truncate">
									<Link
										href={`/c/${item.id}`}
										className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background rounded-sm"
									>
										{item.filename}
									</Link>
								</TableCell>
								{/* Actions */}
								<TableCell>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions for ${item.filename}`}>
												<MoreHorizontal className="h-4 w-4" aria-hidden="true" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onClick={() => window.open(`/c/${item.id}`, '_blank')}>
												<Eye className="mr-2 h-4 w-4" />
												View
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => copyUrl(item)}>
												<Copy className="mr-2 h-4 w-4" />
												Copy URL
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => copyRawUrl(item)}>
												<FileCode className="mr-2 h-4 w-4" />
												Copy Raw URL
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem onClick={() => handleAddSlug(item)}>
												<Link2 className="mr-2 h-4 w-4" />
												Add Slug
											</DropdownMenuItem>
											{item.shortSlugs.length > 0 &&
												item.shortSlugs.map(({ slug }) => (
													<DropdownMenuItem key={slug} onClick={() => handleRemoveSlug(item, slug)}>
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
											<DropdownMenuItem variant="destructive" onClick={() => handleDelete(item)}>
												<Trash2 className="mr-2 h-4 w-4" />
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
								{/* Type */}
								<TableCell>
									<Badge variant="secondary">{item.fileExtension}</Badge>
								</TableCell>
								{/* Size */}
								<TableCell>{formatSize(item.fileSize)}</TableCell>
								{/* Uploaded By */}
								<TableCell>{item.uploadedBy.username}</TableCell>
								{/* Expiry */}
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
								{/* Created */}
								<TableCell className="text-sm">{new Date(item.createdAt).toLocaleDateString()}</TableCell>
								{/* Short URLs */}
								<TableCell>
									<div className="flex flex-col gap-1">
										{item.shortSlugs.length > 0 ? (
											item.shortSlugs.map(({ slug }) => (
												<div key={slug} className="flex items-center gap-1">
													<a href={`/s/${slug}`} className="text-primary underline text-sm" target="_blank" rel="noopener noreferrer">
														/s/{slug}
														<span className="sr-only"> (opens in new tab)</span>
													</a>
												</div>
											))
										) : (
											<span className="text-muted-foreground text-sm">-</span>
										)}
									</div>
								</TableCell>
								{/* Directory */}
								<TableCell>
									{item.directory ? (
										<Badge variant="outline">{item.directory}</Badge>
									) : (
										<span className="text-muted-foreground">-</span>
									)}
								</TableCell>
							</TableRow>
						))}
						{filteredContent.length === 0 && (
							<TableRow>
								<TableCell colSpan={10} className="text-center text-muted-foreground py-8">
									{content.length === 0 ? 'No content uploaded yet.' : 'No content matches the current filters.'}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
