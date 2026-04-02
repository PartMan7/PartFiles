'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, ClipboardPaste, X, FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FileDropZoneProps {
	/** Ref exposed so parent forms can read `.files` / reset `.value` */
	inputRef?: React.RefObject<HTMLInputElement | null>;
	/** HTML name attribute for the hidden file input */
	name?: string;
	id?: string;
	required?: boolean;
	/** Passed through to the drop-zone for screen readers */
	'aria-required'?: boolean | 'true' | 'false';
	/** Called whenever the selected file changes (including clear) — single-file mode */
	onFileChange?: (file: File | null) => void;
	/** Multiple selection; uses `name` default `files` when unset */
	multiple?: boolean;
	/** Called whenever the selected files change — multi-file mode */
	onFilesChange?: (files: File[]) => void;
	/** Fired after a non-empty file was applied from a clipboard paste */
	onPastedFiles?: () => void;
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileListToArray(list: FileList | File[]): File[] {
	return Array.from(list);
}

export function FileDropZone({
	inputRef: externalRef,
	name,
	id,
	required,
	onFileChange,
	multiple = false,
	onFilesChange,
	onPastedFiles,
}: FileDropZoneProps) {
	const internalRef = useRef<HTMLInputElement>(null);
	const fileInputRef = externalRef ?? internalRef;
	const zoneRef = useRef<HTMLDivElement>(null);
	const onPastedFilesRef = useRef(onPastedFiles);
	onPastedFilesRef.current = onPastedFiles;

	const inputName = name ?? (multiple ? 'files' : 'file');

	const [dragging, setDragging] = useState(false);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const selectedFilesRef = useRef<File[]>([]);
	selectedFilesRef.current = selectedFiles;
	const dragCounter = useRef(0);

	function syncInputFiles(files: File[]) {
		const dt = new DataTransfer();
		for (const f of files) {
			dt.items.add(f);
		}
		if (fileInputRef.current) {
			fileInputRef.current.files = dt.files;
		}
	}

	/** Apply file(s) to the hidden input and update state */
	function applyFile(file: File) {
		syncInputFiles([file]);
		setSelectedFile(file);
		setSelectedFiles([file]);
		onFileChange?.(file);
		onFilesChange?.([file]);
	}

	function applyFilesFromList(list: FileList | File[]) {
		const arr = fileListToArray(list).filter(f => f.size > 0);
		if (arr.length === 0) return;
		if (multiple) {
			syncInputFiles(arr);
			setSelectedFile(null);
			setSelectedFiles(arr);
			onFileChange?.(null);
			onFilesChange?.(arr);
		} else {
			applyFile(arr[0]);
		}
	}

	function clearFile() {
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
		setSelectedFile(null);
		setSelectedFiles([]);
		onFileChange?.(null);
		onFilesChange?.([]);
	}

	function removeAtIndex(index: number) {
		if (!multiple) {
			clearFile();
			return;
		}
		const next = selectedFiles.filter((_, i) => i !== index);
		if (next.length === 0) {
			clearFile();
		} else {
			syncInputFiles(next);
			setSelectedFiles(next);
			onFilesChange?.(next);
		}
	}

	/* ── Drag & Drop ─────────────────────────────────────────────────────── */
	function handleDragEnter(e: React.DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter.current++;
		if (e.dataTransfer.types.includes('Files')) {
			setDragging(true);
		}
	}

	function handleDragLeave(e: React.DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter.current--;
		if (dragCounter.current === 0) {
			setDragging(false);
		}
	}

	function handleDragOver(e: React.DragEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	function handleDrop(e: React.DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter.current = 0;
		setDragging(false);

		const list = e.dataTransfer.files;
		if (list?.length) applyFilesFromList(list);
	}

	/* ── Clipboard paste (global) ────────────────────────────────────────── */
	useEffect(() => {
		function handlePaste(e: ClipboardEvent) {
			const target = e.target as HTMLElement;
			if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'file' && (target as HTMLInputElement).type !== 'hidden')
				return;
			if (target.tagName === 'TEXTAREA' || target.isContentEditable) return;

			const items = e.clipboardData?.items;
			if (!items) return;

			for (const item of items) {
				if (item.kind === 'file') {
					const file = item.getAsFile();
					if (file) {
						e.preventDefault();
						let applied = false;
						if (multiple && selectedFilesRef.current.length > 0) {
							const next = [...selectedFilesRef.current, file].filter(f => f.size > 0);
							if (next.length) {
								applyFilesFromList(next);
								applied = true;
							}
						} else if (multiple) {
							if (file.size > 0) {
								applyFilesFromList([file]);
								applied = true;
							}
						} else if (file.size > 0) {
							applyFile(file);
							applied = true;
						}
						if (applied) onPastedFilesRef.current?.();
						return;
					}
				}
			}
		}

		document.addEventListener('paste', handlePaste);
		return () => document.removeEventListener('paste', handlePaste);
	});

	/* ── Click to browse ─────────────────────────────────────────────────── */
	function handleClick() {
		fileInputRef.current?.click();
	}

	function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		const list = e.target.files;
		if (!list?.length) {
			clearFile();
			return;
		}
		applyFilesFromList(list);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		}
	}

	const hasSelection = multiple ? selectedFiles.length > 0 : selectedFile !== null;
	const count = multiple ? selectedFiles.length : selectedFile ? 1 : 0;

	return (
		<div className="space-y-2">
			<input
				ref={fileInputRef}
				type="file"
				name={inputName}
				id={id}
				multiple={multiple}
				required={required && !hasSelection}
				className="sr-only"
				tabIndex={-1}
				onChange={handleInputChange}
				aria-hidden="true"
			/>

			<div
				ref={zoneRef}
				role="button"
				tabIndex={0}
				aria-label={
					hasSelection
						? multiple
							? `${count} files selected. Click to change selection, or drag and drop, or paste from clipboard.`
							: `Selected file: ${selectedFile!.name}. Click to change file, or drag and drop, or paste from clipboard.`
						: multiple
							? 'Choose files. Click to browse, drag and drop, or paste from clipboard.'
							: 'Choose a file. Click to browse, drag and drop, or paste from clipboard.'
				}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				className={cn(
					'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 transition-colors cursor-pointer',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
					dragging
						? 'border-primary bg-primary/5 text-primary'
						: hasSelection
							? 'border-primary/40 bg-primary/5'
							: 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
				)}
			>
				{multiple && selectedFiles.length > 0 ? (
					<div className="flex flex-col gap-2 w-full max-h-48 overflow-y-auto">
						{selectedFiles.map((f, index) => (
							<div key={`${f.name}-${index}`} className="flex items-center gap-3 w-full">
								<div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 shrink-0">
									<FileIcon className="h-5 w-5 text-primary" aria-hidden="true" />
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium truncate">{f.name}</p>
									<p className="text-xs text-muted-foreground">{formatSize(f.size)}</p>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-8 w-8 p-0 shrink-0"
									onClick={e => {
										e.stopPropagation();
										removeAtIndex(index);
									}}
									aria-label={`Remove ${f.name}`}
								>
									<X className="h-4 w-4" aria-hidden="true" />
								</Button>
							</div>
						))}
					</div>
				) : selectedFile ? (
					<div className="flex items-center gap-3 w-full">
						<div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
							<FileIcon className="h-5 w-5 text-primary" aria-hidden="true" />
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium truncate">{selectedFile.name}</p>
							<p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</p>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0 shrink-0"
							onClick={e => {
								e.stopPropagation();
								clearFile();
							}}
							aria-label="Remove selected file"
						>
							<X className="h-4 w-4" aria-hidden="true" />
						</Button>
					</div>
				) : (
					<>
						{dragging ? (
							<Upload className="h-8 w-8 text-primary animate-bounce" aria-hidden="true" />
						) : (
							<Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
						)}
						<div className="text-center space-y-1">
							<p className="text-sm font-medium">
								{dragging ? 'Drop here' : multiple ? 'Click to browse or drag & drop files' : 'Click to browse, drag & drop'}
							</p>
							<p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
								<ClipboardPaste className="h-3 w-3" aria-hidden="true" />
								or paste from clipboard
							</p>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
