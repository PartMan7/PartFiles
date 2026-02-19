'use client';

import { useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Sun, Moon, Palette, Keyboard, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccent } from '@/components/accent-provider';
import { ACCENTS, ACCENT_DISPLAY_ORDER, type AccentName } from '@/lib/accents';

const emptySubscribe = () => () => {};

const ACCENT_GRID_COLS = 7;

function handleAccentGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
	const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
	const idx = buttons.indexOf(e.target as HTMLButtonElement);
	if (idx === -1) return;

	let next: number;
	switch (e.key) {
		case 'ArrowRight':
			next = (idx + 1) % buttons.length;
			break;
		case 'ArrowLeft':
			next = (idx - 1 + buttons.length) % buttons.length;
			break;
		case 'ArrowDown':
			next = idx + ACCENT_GRID_COLS;
			if (next >= buttons.length) return;
			break;
		case 'ArrowUp':
			next = idx - ACCENT_GRID_COLS;
			if (next < 0) return;
			break;
		default:
			return;
	}

	e.preventDefault();
	e.stopPropagation();
	buttons[next].focus();
}

interface NavProps {
	role: string | undefined;
	username: string;
}

/**
 * Shared classes applied to every icon-button so the hover look also shows
 * while the Radix tooltip is open (data-state="delayed-open" | "instant-open")
 * or while a dropdown popover is open (aria-expanded="true").
 */
const ICON_BTN =
	'h-8 w-8 p-0 data-[state=delayed-open]:bg-accent data-[state=instant-open]:bg-accent aria-expanded:bg-accent data-[state=delayed-open]:text-accent-foreground data-[state=instant-open]:text-accent-foreground aria-expanded:text-accent-foreground';

export function Nav({ role, username }: NavProps) {
	const pathname = usePathname();
	const { resolvedTheme, setTheme } = useTheme();
	const { accent, setAccent } = useAccent();
	const accentGridRef = useCallback((node: HTMLDivElement | null) => {
		if (!node) return;
		requestAnimationFrame(() => {
			const selected = node.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
			(selected ?? node.querySelector<HTMLButtonElement>('button'))?.focus();
		});
	}, []);
	const mounted = useSyncExternalStore(
		emptySubscribe,
		() => true,
		() => false
	);

	const links = [
		{ href: '/upload', label: 'Upload', minRole: 'uploader' },
		{ href: '/dashboard', label: 'Dashboard', minRole: 'guest' },
		{ href: '/admin/users', label: 'Users', minRole: 'admin' },
		{ href: '/admin/content', label: 'Content', minRole: 'admin' },
	];

	const roleLevel: Record<string, number> = {
		guest: 0,
		uploader: 1,
		admin: 2,
	};

	const userLevel = role ? (roleLevel[role] ?? 0) : -1;
	const visibleLinks = links.filter(link => userLevel >= (roleLevel[link.minRole] ?? 0));

	function toggleTheme() {
		setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
	}

	function openShortcuts() {
		window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', ctrlKey: true, bubbles: true }));
	}

	const roleBadgeColor: Record<string, string> = {
		admin: 'bg-primary/15 text-primary border-primary/30',
		uploader: 'bg-primary/10 text-primary border-primary/20',
		guest: 'bg-ctp-overlay0/15 text-ctp-overlay0 border-ctp-overlay0/30',
	};

	function accentHex(name: AccentName) {
		return mounted && resolvedTheme === 'dark' ? ACCENTS[name].dark : ACCENTS[name].light;
	}

	/* ── Shared icon buttons (rendered in both mobile & desktop) ──────── */
	const iconButtons = (
		<>
			{/* Accent picker */}
			<DropdownMenu>
				<Tooltip>
					<TooltipTrigger asChild>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className={cn(ICON_BTN, 'group/accent')} aria-label="Choose accent colour">
								<Palette className="h-4 w-4 transition-transform duration-200 group-hover/accent:rotate-30" aria-hidden="true" />
							</Button>
						</DropdownMenuTrigger>
					</TooltipTrigger>
					<TooltipContent>Accent colour</TooltipContent>
				</Tooltip>
				<DropdownMenuContent align="end" className="flex flex-col gap-1.5 p-2 w-auto min-w-0" aria-label="Accent colour options">
					<div
						ref={accentGridRef}
						className="grid grid-cols-7 gap-1"
						role="group"
						aria-label="Accent colours"
						onKeyDown={handleAccentGridKeyDown}
					>
						{ACCENT_DISPLAY_ORDER.map(name => (
							<button
								key={name}
								onClick={() => setAccent(name)}
								aria-label={`${ACCENTS[name].label} accent${accent === name ? ' (selected)' : ''}`}
								aria-pressed={accent === name}
								className={cn(
									'w-6 h-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground',
									accent === name && 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
								)}
								style={{ backgroundColor: accentHex(name) }}
							/>
						))}
					</div>
					<span className="text-[10px] text-muted-foreground text-center self-end">
						Colours from{' '}
						<a
							href={
								mounted && resolvedTheme === 'dark'
									? 'https://github.com/PartMan7/catppuccin'
									: 'https://github.com/catppuccin/catppuccin#latte'
							}
							target="_blank"
							rel="noopener noreferrer"
							className="underline hover:text-foreground transition-colors"
						>
							Catppuccin {mounted && resolvedTheme === 'dark' ? 'Noir' : 'Latte'}
						</a>
					</span>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Theme toggle */}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className={cn(ICON_BTN, 'group/theme')}
						onClick={toggleTheme}
						aria-label={mounted ? `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
					>
						<Sun
							className="h-4 w-4 rotate-0 scale-100 transition-transform duration-300 group-hover/theme:rotate-45 dark:-rotate-90 dark:scale-0"
							aria-hidden="true"
						/>
						<Moon
							className="absolute h-4 w-4 rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100 dark:group-hover/theme:-rotate-12"
							aria-hidden="true"
						/>
					</Button>
				</TooltipTrigger>
				<TooltipContent>{mounted ? (resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode') : 'Toggle theme'}</TooltipContent>
			</Tooltip>

			{/* Keyboard shortcuts hint */}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className={cn(ICON_BTN, 'group/kbd')}
						onClick={openShortcuts}
						aria-label="Keyboard shortcuts (Ctrl+/)"
					>
						<Keyboard className="h-4 w-4 transition-transform duration-200 group-hover/kbd:scale-110" aria-hidden="true" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>Keyboard shortcuts</TooltipContent>
			</Tooltip>
		</>
	);

	return (
		<nav className="border-b bg-card" aria-label="Main navigation">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex items-center justify-between h-14">
					{/* Left: logo + desktop links */}
					<div className="flex items-center gap-6">
						<Link href="/upload" className="font-semibold text-lg text-primary" aria-label="PartFiles - Go to upload">
							PartFiles
						</Link>

						{/* Desktop nav links — hidden on small screens */}
						<div className="hidden md:flex items-center gap-1" role="list" aria-label="Site pages">
							{visibleLinks.map(link => {
								const isCurrent = pathname === link.href;
								return (
									<Link
										key={link.href}
										href={link.href}
										role="listitem"
										aria-current={isCurrent ? 'page' : undefined}
										className={cn(
											'px-3 py-1.5 text-sm rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
											isCurrent ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
										)}
									>
										{link.label}
									</Link>
								);
							})}
						</div>
					</div>

					{/* Right side: desktop */}
					<div className="hidden md:flex items-center gap-3">
						{role ? (
							<>
								<span className="text-sm text-muted-foreground">{username}</span>
								<Badge variant="outline" className={cn('text-xs', roleBadgeColor[role])}>
									{role}
								</Badge>
							</>
						) : null}
						{iconButtons}
						<Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
							Sign Out
						</Button>
					</div>

					{/* Right side: mobile — icon buttons + hamburger */}
					<div className="flex md:hidden items-center gap-1">
						{iconButtons}

						<DropdownMenu>
							<Tooltip>
								<TooltipTrigger asChild>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="sm" className={cn(ICON_BTN, 'group/menu')} aria-label="Open menu">
											<Menu className="h-5 w-5 transition-transform duration-200 group-hover/menu:scale-110" aria-hidden="true" />
										</Button>
									</DropdownMenuTrigger>
								</TooltipTrigger>
								<TooltipContent>Menu</TooltipContent>
							</Tooltip>
							<DropdownMenuContent align="end" className="w-52">
								{/* User info */}
								{role ? (
									<>
										<div className="px-3 py-2 flex items-center gap-2">
											<span className="text-sm text-muted-foreground truncate">{username}</span>
											<Badge variant="outline" className={cn('text-xs shrink-0', roleBadgeColor[role])}>
												{role}
											</Badge>
										</div>
										<DropdownMenuSeparator />
									</>
								) : null}

								{/* Nav links */}
								{visibleLinks.map(link => {
									const isCurrent = pathname === link.href;
									return (
										<DropdownMenuItem key={link.href} asChild>
											<Link
												href={link.href}
												aria-current={isCurrent ? 'page' : undefined}
												className={cn(isCurrent && 'font-semibold text-primary')}
											>
												{link.label}
											</Link>
										</DropdownMenuItem>
									);
								})}

								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>Sign Out</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</div>
		</nav>
	);
}
