'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sun, Moon, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccent } from '@/components/accent-provider';
import { ACCENTS, ACCENT_NAMES, type AccentName } from '@/lib/accents';

interface NavProps {
	role: string;
	username: string;
}

export function Nav({ role, username }: NavProps) {
	const pathname = usePathname();
	const { resolvedTheme, setTheme } = useTheme();
	const { accent, setAccent } = useAccent();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	const links = [
		{ href: '/upload', label: 'Upload', minRole: 'uploader' },
		{ href: '/dashboard', label: 'Dashboard', minRole: 'guest' },
		{ href: '/admin/upload', label: 'Admin Upload', minRole: 'admin' },
		{ href: '/admin/users', label: 'Users', minRole: 'admin' },
		{ href: '/admin/content', label: 'Content', minRole: 'admin' },
	];

	const roleLevel: Record<string, number> = {
		guest: 0,
		uploader: 1,
		admin: 2,
	};

	const userLevel = roleLevel[role] ?? 0;

	const visibleLinks = links.filter(link => userLevel >= (roleLevel[link.minRole] ?? 0));

	function toggleTheme() {
		setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
	}

	const roleBadgeColor: Record<string, string> = {
		admin: 'bg-primary/15 text-primary border-primary/30',
		uploader: 'bg-primary/10 text-primary border-primary/20',
		guest: 'bg-ctp-overlay0/15 text-ctp-overlay0 border-ctp-overlay0/30',
	};

	/** Pick the right hex for the current theme (falls back to light before mount) */
	function accentHex(name: AccentName) {
		return mounted && resolvedTheme === 'dark' ? ACCENTS[name].dark : ACCENTS[name].light;
	}

	return (
		<nav className="border-b bg-card">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex items-center justify-between h-14">
					<div className="flex items-center gap-6">
						<Link href="/upload" className="font-semibold text-lg text-primary">
							CMS
						</Link>
						<div className="flex items-center gap-1">
							{visibleLinks.map(link => (
								<Link
									key={link.href}
									href={link.href}
									className={cn(
										'px-3 py-1.5 text-sm rounded-md transition-colors',
										pathname === link.href
											? 'bg-primary text-primary-foreground'
											: 'text-muted-foreground hover:text-foreground hover:bg-muted'
									)}
								>
									{link.label}
								</Link>
							))}
						</div>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-sm text-muted-foreground">{username}</span>
						<Badge variant="outline" className={cn('text-xs', roleBadgeColor[role])}>
							{role}
						</Badge>

						{/* Accent picker */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="h-8 w-8 p-0"
									title="Choose accent colour"
								>
									<Palette className="h-4 w-4" />
									<span className="sr-only">Choose accent</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="grid grid-cols-7 gap-1 p-2 w-auto min-w-0">
								{ACCENT_NAMES.map(name => (
									<button
										key={name}
										onClick={() => setAccent(name)}
										title={ACCENTS[name].label}
										className={cn(
											'w-6 h-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
											accent === name && 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
										)}
										style={{ backgroundColor: accentHex(name) }}
									/>
								))}
							</DropdownMenuContent>
						</DropdownMenu>

						{/* Theme toggle */}
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={toggleTheme}
							title={mounted ? `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
						>
							<Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
							<Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
							<span className="sr-only">Toggle theme</span>
						</Button>
						<Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
							Sign Out
						</Button>
					</div>
				</div>
			</div>
		</nav>
	);
}
