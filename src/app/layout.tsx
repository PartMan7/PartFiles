import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { AccentProvider } from '@/components/accent-provider';
import { AuthProvider } from '@/components/auth-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { SkipLink } from '@/components/skip-link';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { LastUploadProvider } from '@/components/last-upload-context';
import { ContentPageCopyProvider } from '@/components/content-page-copy-context';
import { ACCENTS } from '@/lib/accents';
import './globals.css';

export const viewport: Viewport = {
	themeColor: '#221f22',
};

export const metadata: Metadata = {
	title: 'PartFiles',
	description: 'File management for partman.dev',
	appleWebApp: {
		capable: true,
		statusBarStyle: 'black-translucent',
		title: 'PartFiles',
	},
	icons: {
		apple: '/icons/apple-touch-icon.png',
	},
};

/**
 * Inline script that runs before paint to prevent accent colour flash.
 * Mirrors the logic in AccentProvider but executes synchronously.
 */
const accentInitScript = `(function(){try{var a=localStorage.getItem("accent");var m=${JSON.stringify(
	Object.fromEntries(Object.entries(ACCENTS).map(([k, v]) => [k, [v.light, v.dark]]))
)};if(a&&m[a]){document.documentElement.style.setProperty("--accent-light",m[a][0]);document.documentElement.style.setProperty("--accent-dark",m[a][1])};}catch(e){}})()`;

import { Footer } from '@/components/footer';
import { PwaRegister } from '@/components/pwa-register';

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: accentInitScript }} />
			</head>
			<body className="antialiased min-h-screen bg-background">
				<ThemeProvider>
					<AccentProvider>
						<AuthProvider>
							<LastUploadProvider>
								<ContentPageCopyProvider>
									<TooltipProvider>
										<SkipLink />
										<div className="min-h-screen flex flex-col">
											<div className="grow">{children}</div>
											<Footer />
										</div>
										<KeyboardShortcuts />
										<PwaRegister />
										<Toaster />
									</TooltipProvider>
								</ContentPageCopyProvider>
							</LastUploadProvider>
						</AuthProvider>
					</AccentProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
