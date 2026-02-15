import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { AccentProvider } from '@/components/accent-provider';
import { Toaster } from '@/components/ui/sonner';
import { ACCENTS } from '@/lib/accents';
import './globals.css';

export const metadata: Metadata = {
	title: 'CMS - Content Management System',
	description: 'Content Management System for partman.dev',
};

/**
 * Inline script that runs before paint to prevent accent colour flash.
 * Mirrors the logic in AccentProvider but executes synchronously.
 */
const accentInitScript = `(function(){try{var a=localStorage.getItem("accent");var m=${JSON.stringify(
	Object.fromEntries(Object.entries(ACCENTS).map(([k, v]) => [k, [v.light, v.dark]]))
)};if(a&&m[a]){document.documentElement.style.setProperty("--accent-light",m[a][0]);document.documentElement.style.setProperty("--accent-dark",m[a][1])};}catch(e){}})()`;

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
						{children}
						<Toaster />
					</AccentProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
