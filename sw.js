/**
 * LA VAGUE - Service Worker
 * Keep navigations fresh while caching immutable/static assets safely.
 */

const STATIC_CACHE = 'la-vague-static-v4';
const IMAGE_CACHE = 'la-vague-images-v4';

const APP_SHELL = [
    '/',
    '/index.html',
    '/la-vague-red-wordmark.png',
    '/site.webmanifest'
];

const NETWORK_ONLY_ROUTES = [
    /\/api\//,
    /\/admin(?:\.html)?$/,
    /paystack/i,
    /checkout\.paystack\.com/i,
    /js\.paystack\.co/i
];

function isNetworkOnly(pathname) {
    return NETWORK_ONLY_ROUTES.some(route => route.test(pathname));
}

async function cacheIfOk(cacheName, request, response) {
    if (!response || !response.ok || response.type === 'opaque') return response;
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    return response;
}

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(async cache => {
                await Promise.all(
                    APP_SHELL.map(asset =>
                        cache.add(asset).catch(error => {
                            console.warn('[SW] Could not pre-cache', asset, error.message);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(names =>
                Promise.all(
                    names
                        .filter(name =>
                            name.startsWith('la-vague-') &&
                            name !== STATIC_CACHE &&
                            name !== IMAGE_CACHE
                        )
                        .map(name => caches.delete(name))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (isNetworkOnly(url.pathname)) {
        event.respondWith(
            fetch(request).catch(() => {
                if (url.pathname.startsWith('/api/')) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: 'Network error. Please check your connection.'
                        }),
                        {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                }
                return new Response('Service unavailable', { status: 503 });
            })
        );
        return;
    }

    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(
            fetch(request)
                .then(response => cacheIfOk(STATIC_CACHE, request, response))
                .catch(async () => {
                    return (
                        (await caches.match(request)) ||
                        (await caches.match('/index.html')) ||
                        new Response('Offline', { status: 503 })
                    );
                })
        );
        return;
    }

    if (request.destination === 'image') {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(async cache => {
                const cached = await cache.match(request);
                if (cached) {
                    event.waitUntil(
                        fetch(request)
                            .then(response => cacheIfOk(IMAGE_CACHE, request, response))
                            .catch(() => undefined)
                    );
                    return cached;
                }

                try {
                    const response = await fetch(request);
                    return cacheIfOk(IMAGE_CACHE, request, response);
                } catch {
                    return new Response('', { status: 404 });
                }
            })
        );
        return;
    }

    const isImmutableAsset = url.pathname.startsWith('/assets/');

    if (isImmutableAsset) {
        event.respondWith(
            caches.open(STATIC_CACHE).then(async cache => {
                const cached = await cache.match(request);
                if (cached) return cached;

                const response = await fetch(request);
                return cacheIfOk(STATIC_CACHE, request, response);
            })
        );
        return;
    }

    event.respondWith(
        fetch(request)
            .then(response => cacheIfOk(STATIC_CACHE, request, response))
            .catch(() => caches.match(request))
    );
});

self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
        return;
    }

    if (event.data?.type === 'CLEAR_CACHES') {
        event.waitUntil(
            caches.keys()
                .then(names => Promise.all(names.map(name => caches.delete(name))))
                .then(() => {
                    if (event.ports?.[0]) {
                        event.ports[0].postMessage({ success: true });
                    }
                })
        );
    }
});
