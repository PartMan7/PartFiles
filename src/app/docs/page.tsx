'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import { Nav } from '@/components/nav';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useAccent } from '@/components/accent-provider';
import { ACCENTS } from '@/lib/accents';
import { useMemo } from 'react';

export default function ApiDocs() {
	const { data: session } = useSession();
	const { resolvedTheme } = useTheme();
	const { accent } = useAccent();

	const customCss = useMemo(() => {
		const isDark = resolvedTheme === 'dark';
		const mode = isDark ? 'dark' : 'light';

		const getHex = (name: keyof typeof ACCENTS) => ACCENTS[name][mode];

		return `
      /* Hide Scalar Header */
      .scalar-header {
        display: none !important;
      }
      
      /* Match Site Theme */
      #scalar-docs-container, 
      #scalar-docs-container :root, 
      #scalar-docs-container body, 
      #scalar-docs-container .light-mode, 
      #scalar-docs-container .dark-mode, 
      #scalar-docs-container .scalar-api-reference, 
      #scalar-docs-container [data-theme='dark'], 
      #scalar-docs-container [data-theme='light'], 
      #scalar-docs-container .theme-none {
        --scalar-font-sans: var(--font-geist-sans) !important;
        --scalar-font-mono: var(--font-geist-mono) !important;
        --scalar-color-1: var(--foreground) !important;
        --scalar-color-2: var(--muted-foreground) !important;
        --scalar-color-3: var(--muted-foreground) !important;
        --scalar-color-accent: ${getHex(accent)} !important;
        --scalar-background-1: var(--background) !important;
        --scalar-background-2: var(--card) !important;
        --scalar-background-3: var(--ctp-crust) !important;
        --scalar-border-color: var(--border) !important;
        --scalar-radius: var(--radius) !important;
        --scalar-radius-lg: var(--radius) !important;
        --scalar-radius-xl: var(--radius) !important;

        /* Functional Colors (HTTP Methods, etc.) */
        --scalar-color-green: ${getHex('green')} !important;
        --scalar-color-blue: ${getHex('blue')} !important;
        --scalar-color-orange: ${getHex('peach')} !important;
        --scalar-color-red: ${getHex('red')} !important;
        --scalar-color-purple: ${getHex('mauve')} !important;
        --scalar-color-yellow: ${getHex('yellow')} !important;

        /* Force override of any display-p3 or other high-gamut colors Scalar might set */
        --scalar-color-green-p3: ${getHex('green')} !important;
        --scalar-color-blue-p3: ${getHex('blue')} !important;
        --scalar-color-orange-p3: ${getHex('peach')} !important;
        --scalar-color-red-p3: ${getHex('red')} !important;
        --scalar-color-purple-p3: ${getHex('mauve')} !important;
        --scalar-color-yellow-p3: ${getHex('yellow')} !important;

        /* Syntax Highlighting */
        --scalar-code-1: ${getHex('mauve')} !important;    /* Keywords */
        --scalar-code-2: ${getHex('green')} !important;    /* Strings */
        --scalar-code-3: ${getHex('peach')} !important;    /* Numbers */
        --scalar-code-4: ${getHex('blue')} !important;     /* Functions */
        --scalar-code-5: ${getHex('rosewater')} !important; /* Variables */
        --scalar-code-comment: ${isDark ? '#6c7086' : '#9ca0b0'} !important; /* Overlay0 */
      }

      /* Sidebar styling */
      .scalar-sidebar {
        background: var(--background) !important;
        border-right: 1px solid var(--border) !important;
      }

      /* Dark Mode Specific Overrides */
      #scalar-docs-container .dark-mode,
      #scalar-docs-container.dark-mode {
        --scalar-color-green: ${getHex('green')} !important;
        --scalar-color-blue: ${getHex('blue')} !important;
        --scalar-color-orange: ${getHex('peach')} !important;
        --scalar-color-red: ${getHex('red')} !important;
        --scalar-color-purple: ${getHex('mauve')} !important;
        --scalar-color-yellow: ${getHex('yellow')} !important;
        
        --scalar-color-green-p3: ${getHex('green')} !important;
        --scalar-color-blue-p3: ${getHex('blue')} !important;
        --scalar-color-orange-p3: ${getHex('peach')} !important;
        --scalar-color-red-p3: ${getHex('red')} !important;
        --scalar-color-purple-p3: ${getHex('mauve')} !important;
        --scalar-color-yellow-p3: ${getHex('yellow')} !important;
      }

      /* Search box */
      .scalar-search-input {
        background: var(--background) !important;
        border: 1px solid var(--border) !important;
      }

      /* HTTP Method Labels */
      .scalar-api-reference .post { color: ${getHex('green')} !important; }
      .scalar-api-reference .get { color: ${getHex('blue')} !important; }
      .scalar-api-reference .put { color: ${getHex('peach')} !important; }
      .scalar-api-reference .delete { color: ${getHex('red')} !important; }
      .scalar-api-reference .patch { color: ${getHex('mauve')} !important; }
    `;
	}, [resolvedTheme, accent]);

	return (
		<div className="min-h-screen bg-background flex flex-col">
			<Nav role={session?.user?.role} username={session?.user?.name ?? 'Guest'} />
			<main id="main-content" className="grow w-full">
				<div id="scalar-docs-container">
					<ApiReferenceReact
						configuration={{
							theme: 'none',
							showSidebar: true,
							hideDownloadButton: false,
							customCss: customCss,
						}}
					/>
				</div>
			</main>
		</div>
	);
}
