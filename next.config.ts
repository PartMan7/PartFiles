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
		// Allow large uploads when middleware runs (auth); default is 10MB and can cause 413.
		// @ts-expect-error - supported in Next 15 runtime but not in ExperimentalConfig type
		middlewareClientMaxBodySize: '100mb',
	},
	async headers() {
		return [
			{
				// Apply security headers to all routes
				source: '/(.*)',
				headers: [
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
					{
						key: 'X-Frame-Options',
						value: 'DENY',
					},
				],
			},
		];
	},
};

export default nextConfig;
