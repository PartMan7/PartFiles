const CACHE_VERSION = 'partfiles-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PRECACHE_URLS = [
	'/offline',
	'/icons/icon-192.png',
	'/icons/icon-512.png',
	'/icons/icon-maskable-512.png',
	'/icons/apple-touch-icon.png',
];

const FILE_ROUTE_PREFIXES = ['/r/', '/c/', '/e/', '/l/', '/s/'];

function isFileRoute(pathname) {
	return FILE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isStaticAsset(pathname) {
	return pathname.startsWith('/_next/static/') || pathname.startsWith('/icons/');
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys.filter((key) => key.startsWith('partfiles-') && key !== STATIC_CACHE).map((key) => caches.delete(key))
			)
		).then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	const { pathname } = url;
	if (pathname.startsWith('/api/') || isFileRoute(pathname)) return;

	if (isStaticAsset(pathname)) {
		event.respondWith(
			caches.match(request).then((cached) => {
				if (cached) return cached;
				return fetch(request).then((response) => {
					if (response.ok) {
						const copy = response.clone();
						caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
					}
					return response;
				});
			})
		);
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(() => caches.match('/offline'))
		);
	}
});
