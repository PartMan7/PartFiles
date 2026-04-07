import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	output: 'standalone',
	serverExternalPackages: ['better-sqlite3'],
	env: {
		NEXT_PUBLIC_BASE_URL: process.env.BASE_URL || '',
		NEXT_PUBLIC_CONTENT_URL: process.env.CONTENT_URL || '',
	},
	experimental: {
		serverActions: {
			bodySizeLimit: '100mb',
		},
	},
	async headers() {
		const baseSecurityHeaders = [
			{
				key: 'Strict-Transport-Security',
				value: 'max-age=63072000; includeSubDomains; preload',
			},
			{
				key: 'Referrer-Policy',
				value: 'strict-origin-when-cross-origin',
			},
			{
				key: 'X-Content-Type-Options',
				value: 'nosniff',
			},
		] as const;
		return [
			{
				source: '/:path*',
				headers: [...baseSecurityHeaders],
			},
			{
				// Raw + embed URLs must be frameable cross-origin (iframes / external embeds).
				source: '/((?!r/|e/).*)',
				headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
			},
		];
	},
};

export default nextConfig;
