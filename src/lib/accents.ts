/**
 * Catppuccin accent definitions.
 * Each entry has a display label plus hex values for both Latte (light) and Noir (dark).
 */

export interface AccentDef {
	label: string;
	light: string;
	dark: string;
}

export const ACCENTS = {
	lavender:  { label: 'Lavender',   light: '#7287fd', dark: '#b4befe' },
	mauve:     { label: 'Mauve',      light: '#8839ef', dark: '#cba6f7' },
	pink:      { label: 'Pink',       light: '#ea76cb', dark: '#f5c2e7' },
	flamingo:  { label: 'Flamingo',   light: '#dd7878', dark: '#f2cdcd' },
	rosewater: { label: 'Rosewater',  light: '#dc8a78', dark: '#f5e0dc' },
	maroon:    { label: 'Maroon',     light: '#e64553', dark: '#eba0ac' },
	red:       { label: 'Red',        light: '#d20f39', dark: '#f38ba8' },
	peach:     { label: 'Peach',      light: '#fe640b', dark: '#fab387' },
	yellow:    { label: 'Yellow',     light: '#df8e1d', dark: '#f9e2af' },
	green:     { label: 'Green',      light: '#40a02b', dark: '#a6e3a1' },
	teal:      { label: 'Teal',       light: '#179299', dark: '#94e2d5' },
	sky:       { label: 'Sky',        light: '#04a5e5', dark: '#89dceb' },
	sapphire:  { label: 'Sapphire',   light: '#209fb5', dark: '#74c7ec' },
	blue:      { label: 'Blue',       light: '#1e66f5', dark: '#89b4fa' },
} as const satisfies Record<string, AccentDef>;

export type AccentName = keyof typeof ACCENTS;

export const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[];

export const DEFAULT_ACCENT: AccentName = 'mauve';

const STORAGE_KEY = 'accent';

/** Read the stored accent from localStorage (returns null on SSR or missing). */
export function getStoredAccent(): AccentName | null {
	if (typeof window === 'undefined') return null;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored && stored in ACCENTS) return stored as AccentName;
	return null;
}

/** Persist an accent choice to localStorage. */
export function setStoredAccent(accent: AccentName): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, accent);
}

/** Apply the accent's CSS custom properties to the document root. */
export function applyAccent(accent: AccentName): void {
	const { light, dark } = ACCENTS[accent];
	const root = document.documentElement;
	root.style.setProperty('--accent-light', light);
	root.style.setProperty('--accent-dark', dark);
}
