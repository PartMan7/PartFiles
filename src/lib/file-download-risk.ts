import { ALLOWED_EXTENSIONS } from '@/lib/config';

/**
 * Executables, installers, disk images, archives that often hide payloads, and similar.
 */
const EXPLICIT_DANGEROUS_EXTENSIONS = new Set([
	'.zip',
	'.exe',
	'.dll',
	'.dmg',
	'.iso',
	'.msi',
	'.msix',
	'.scr',
	'.com',
	'.pif',
	'.vbs',
	'.ws',
	'.wsf',
	'.app',
	'.pkg',
	'.deb',
	'.rpm',
	'.apk',
	'.ipa',
	'.cab',
	'.sys',
	'.drv',
	'.bin',
	'.run',
	'.elf',
	'.sparseimage',
	'.img',
	'.toast',
	'.reg',
	'.ps1',
	'.psm1',
	'.bat',
	'.cmd',
	'.msc',
	'.cpl',
	'.so',
	'.dylib',
]);

export function normalizeExtensionForRisk(fileExtension: string): string {
	const t = fileExtension.trim().toLowerCase();
	if (!t) return '';
	return t.startsWith('.') ? t : `.${t}`;
}

/**
 * Show a disclaimer before raw access, download, or embed URL copy when the extension is
 * explicitly high-risk or not on the CMS upload allowlist (unrecognized).
 */
export function shouldWarnBeforeDownloadOrRaw(fileExtension: string): boolean {
	const ext = normalizeExtensionForRisk(fileExtension);
	if (!ext) return true;
	if (EXPLICIT_DANGEROUS_EXTENSIONS.has(ext)) return true;
	if (!ALLOWED_EXTENSIONS.has(ext)) return true;
	return false;
}
