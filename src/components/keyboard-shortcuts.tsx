'use client';

import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useSession } from 'next-auth/react';
import { useLastUpload } from '@/components/last-upload-context';
import { useContentPageCopyInfo } from '@/components/content-page-copy-context';
import { persistUploadMode, readStoredUploadMode, uploadHrefForMode } from '@/lib/upload-mode-preference';
import { isAdmin } from '@/lib/permissions';
import { toast } from 'sonner';

interface Shortcut {
	keys: string[];
	label: string;
}

interface ShortcutGroup {
	title: string;
	shortcuts: Shortcut[];
}

const emptySubscribe = () => () => {};

/** Detect macOS / iOS so we can show the correct modifier symbol. */
function useIsMac() {
	return useSyncExternalStore(
		emptySubscribe,
		() => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
		() => false
	);
}

/** Return the display string for the "Ctrl / Cmd" modifier. */
function useModKey() {
	const isMac = useIsMac();
	return isMac ? '⌘' : 'Ctrl';
}

const KBD_CLASSES =
	'inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-medium text-foreground';

const KBD_SMALL_CLASSES =
	'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-medium';

type AppRouterLike = {
	push: (href: string) => void;
	replace: (href: string, options?: { scroll?: boolean }) => void;
};

function navigateToUploadTab(router: AppRouterLike, pathname: string, wantShare: boolean) {
	const path = uploadHrefForMode(wantShare ? 'share' : 'store');
	const onUpload = pathname === '/upload';
	const urlHasShare = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'share';
	const atShareTab = onUpload && urlHasShare;
	if (onUpload && atShareTab === wantShare) return;
	if (onUpload) router.replace(path, { scroll: false });
	else router.push(path);
}

export function KeyboardShortcuts() {
	const [open, setOpen] = useState(false);
	const openRef = useRef(false);
	const triggerRef = useRef<HTMLElement | null>(null);
	const router = useRouter();
	const pathname = usePathname();
	const mod = useModKey();
	const { lastRawUrls, lastUploadedContentUrls, setLastUploadedContentUrls } = useLastUpload();
	const contentPageInfo = useContentPageCopyInfo();
	const prevPathnameRef = useRef(pathname);
	const { data: session, status } = useSession();
	const showAdminShortcuts = status === 'authenticated' && !!session?.user && isAdmin(session.user.role);

	useEffect(() => {
		const prev = prevPathnameRef.current;
		prevPathnameRef.current = pathname;
		if (prev === '/upload' && pathname !== '/upload') {
			setLastUploadedContentUrls([]);
		}
	}, [pathname, setLastUploadedContentUrls]);

	useEffect(() => {
		openRef.current = open;
		if (!open && triggerRef.current) {
			const el = triggerRef.current;
			triggerRef.current = null;
			requestAnimationFrame(() => el.focus());
		}
	}, [open]);

	const shortcutGroups: ShortcutGroup[] = useMemo(() => {
		const navShortcuts: Shortcut[] = [
			{ keys: ['Shift', 'U'], label: 'Go to Upload' },
			{ keys: ['Shift', 'Q'], label: 'Go to Quick Share' },
			{ keys: ['Shift', 'S'], label: 'Go to Store Files' },
			{ keys: ['Shift', 'D'], label: 'Go to Dashboard' },
		];
		if (showAdminShortcuts) {
			navShortcuts.push({ keys: ['Shift', 'C'], label: 'Go to Content' }, { keys: ['Shift', 'W'], label: 'Go to Users' });
		}
		const navigation: ShortcutGroup = {
			title: 'Navigation',
			shortcuts: navShortcuts,
		};

		const copyUrl: ShortcutGroup = {
			title: 'Copy URL',
			shortcuts: [
				{ keys: ['R'], label: 'Copy raw URL (file page or last upload)' },
				{
					keys: ['C'],
					label: 'Copy current page URL (on Upload after a run: last uploaded content URL(s))',
				},
				{ keys: ['S'], label: 'Copy short /s/ URL(s) when available' },
				{ keys: ['E'], label: 'Copy embed /e/ URL(s) when available' },
			],
		};

		const general: ShortcutGroup = {
			title: 'General',
			shortcuts: [{ keys: [mod, '/'], label: 'Show keyboard shortcuts' }],
		};

		const accessibility: ShortcutGroup = {
			title: 'Accessibility',
			shortcuts: [
				{ keys: ['Tab'], label: 'Move focus to next element' },
				{ keys: ['Shift', 'Tab'], label: 'Move focus to previous element' },
				{ keys: ['Enter'], label: 'Activate focused element' },
				{ keys: ['Escape'], label: 'Close dialog / dropdown' },
			],
		};

		return [general, copyUrl, navigation, accessibility];
	}, [mod, showAdminShortcuts]);

	const handleGlobalKeyDown = useCallback(
		(e: KeyboardEvent) => {
			// Don't trigger shortcuts when typing in inputs
			const target = e.target as HTMLElement;
			const isInput =
				target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

			// Ctrl+/ or Cmd+/ — toggle shortcuts dialog
			if ((e.ctrlKey || e.metaKey) && e.key === '/') {
				e.preventDefault();
				if (!openRef.current && document.activeElement instanceof HTMLElement) {
					triggerRef.current = document.activeElement;
				}
				setOpen(prev => !prev);
				return;
			}

			if (isInput) return;

			const key = e.key.length === 1 ? e.key.toLowerCase() : '';
			const noMod = !e.ctrlKey && !e.metaKey && !e.altKey;

			// Shift+letter navigation (avoid clashing with browser / typing)
			if (e.shiftKey && noMod) {
				if (key === 'q') {
					e.preventDefault();
					persistUploadMode('share');
					navigateToUploadTab(router, pathname, true);
					return;
				}
				if (key === 's') {
					e.preventDefault();
					persistUploadMode('store');
					navigateToUploadTab(router, pathname, false);
					return;
				}
				if (key === 'u') {
					e.preventDefault();
					const mode = readStoredUploadMode() ?? 'store';
					navigateToUploadTab(router, pathname, mode === 'share');
					return;
				}
				const isAdminNavKey = key === 'd' || (showAdminShortcuts && (key === 'c' || key === 'w'));
				if (isAdminNavKey) {
					const routes: Record<string, string> = { d: '/dashboard' };
					if (showAdminShortcuts) {
						routes.c = '/admin/content';
						routes.w = '/admin/users';
					}
					const route = routes[key];
					if (route && route !== pathname) {
						e.preventDefault();
						router.push(route);
					}
					return;
				}
			}

			// Single-letter copy URLs (no Shift / Ctrl / Cmd / Alt)
			if (!e.shiftKey && noMod && ['r', 'c', 's', 'e'].includes(key)) {
				const copy = (text: string, success: string) => {
					e.preventDefault();
					void navigator.clipboard.writeText(text).then(
						() => toast.success(success),
						() => toast.error('Could not copy to clipboard')
					);
				};

				if (key === 'c') {
					const onUploadPage = pathname === '/upload';
					if (onUploadPage && lastUploadedContentUrls.length) {
						copy(
							lastUploadedContentUrls.join('\n'),
							lastUploadedContentUrls.length > 1 ? 'Content URLs copied' : 'Content URL copied'
						);
					} else {
						copy(typeof window !== 'undefined' ? window.location.href : '', 'Current URL copied');
					}
					return;
				}

				const page = contentPageInfo;

				if (key === 'r') {
					if (page) {
						copy(`${page.contentBaseUrl}/r/${page.contentId}`, 'Raw URL copied');
					} else if (lastRawUrls.length) {
						e.preventDefault();
						void navigator.clipboard.writeText(lastRawUrls.join('\n')).then(
							() => {
								toast.success(lastRawUrls.length > 1 ? 'Raw URLs copied' : 'Raw URL copied');
							},
							() => toast.error('Could not copy to clipboard')
						);
					} else {
						e.preventDefault();
						toast.error('No raw URL — open a file page or upload first');
					}
					return;
				}

				if (key === 's') {
					if (page?.shortSlugs.length) {
						const base = page.contentBaseUrl;
						const text = page.shortSlugs.map(slug => `${base}/s/${slug}`).join('\n');
						copy(text, page.shortSlugs.length > 1 ? 'Short URLs copied' : 'Short URL copied');
					} else {
						e.preventDefault();
						toast.error('No short URLs on this page');
					}
					return;
				}

				if (key === 'e') {
					if (page?.shortSlugs.length) {
						const base = page.contentBaseUrl;
						const text = page.shortSlugs.map(slug => `${base}/e/${slug}`).join('\n');
						copy(text, page.shortSlugs.length > 1 ? 'Embed URLs copied' : 'Embed URL copied');
					} else {
						e.preventDefault();
						toast.error('No embed URL — add a short slug on this file');
					}
					return;
				}
			}
		},
		[router, pathname, lastRawUrls, lastUploadedContentUrls, contentPageInfo, showAdminShortcuts]
	);

	useEffect(() => {
		window.addEventListener('keydown', handleGlobalKeyDown);
		return () => window.removeEventListener('keydown', handleGlobalKeyDown);
	}, [handleGlobalKeyDown]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Keyboard Shortcuts</DialogTitle>
					<DialogDescription>Use these shortcuts to navigate and interact with PartFiles.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 mt-2">
					{shortcutGroups.map((group, gi) => (
						<div key={group.title}>
							{gi > 0 && <Separator className="mb-4" />}
							<h3 className="text-sm font-semibold text-muted-foreground mb-3">{group.title}</h3>
							<div className="space-y-2">
								{group.shortcuts.map((shortcut, si) => (
									<div key={si} className="flex items-center justify-between py-1">
										<span className="text-sm">{shortcut.label}</span>
										<div className="flex items-center gap-1">
											{shortcut.keys.map((key, ki) => (
												<kbd key={ki} className={KBD_CLASSES}>
													{key}
												</kbd>
											))}
										</div>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
				<div className="mt-2 pt-3 border-t">
					<p className="text-xs text-muted-foreground text-center">
						Press <kbd className={KBD_SMALL_CLASSES}>{mod}</kbd> <kbd className={KBD_SMALL_CLASSES}>/</kbd> to close
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
