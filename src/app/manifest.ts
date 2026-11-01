import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: 'PartFiles',
		short_name: 'PartFiles',
		description: 'File management for partman.dev',
		start_url: '/',
		scope: '/',
		id: '/',
		display: 'standalone',
		background_color: '#221f22',
		theme_color: '#221f22',
		icons: [
			{
				src: '/icons/icon-192.png',
				sizes: '192x192',
				type: 'image/png',
			},
			{
				src: '/icons/icon-512.png',
				sizes: '512x512',
				type: 'image/png',
			},
			{
				src: '/icons/icon-maskable-512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable',
			},
		],
	};
}
