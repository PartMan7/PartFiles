'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Theme provider wrapper.
 *
 * Preference resolution order (handled by next-themes):
 *   1. localStorage ("theme" key)
 *   2. Browser prefers-color-scheme
 *   3. Default → dark
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
	return (
		<NextThemesProvider attribute="class" defaultTheme="dark" enableSystem enableColorScheme>
			{children}
		</NextThemesProvider>
	);
}
