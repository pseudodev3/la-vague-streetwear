/**
 * LA VAGUE - Service Worker
 * Provides offline support and caching for PWA functionality
 * Version: 1.0.1
 */

const CACHE_NAME = 'la-vague-v1';
const STATIC_CACHE = 'la-vague-static-v1';
const IMAGE_CACHE = 'la-vague-images-v1';

// Assets to cache on install (same-origin only)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/shop.html',
    '/product.html',
    '/checkout.html',
    '/faq.html',
    '/shipping.html',
    '/returns.html',
    '/contact.html',
    '/track-order.html',
    '/order-confirmation.html',
    '/privacy-policy.html',
    '/terms-of-service.html',
    '/refund-policy.html',
    '/404.html',
    '/favicon.svg',
    '/site.webmanifest',
    // Core styles
    '/src/styles/styles.css',
    '/src/styles/fonts.css',
    '/src/styles/home-styles.css',
    '/src/styles/shop-styles.css',
    '/src/styles/product-styles.css',
    '/src/styles/checkout-styles.css',
    '/src/styles/page-styles.css',
    '/src/styles/legal-styles.css',
    // Core scripts
    '/src/scripts/products.js',
    '/src/scripts/cart.js',
    '/src/scripts/components.js',
    '/src/scripts/utils.js',
    '/src/scripts/translations.js',
    '/src/scripts/cookie-consent.js',
    '/src/scripts/page.js',
    '/src/scripts/home.js',
    '/src/scripts/shop.js',
    '/src/scripts/product.js',
    '/src/scripts/checkout.js',
    '/src/scripts/checkout-api.js',
    '/src/scripts/checkout-config.js',
    '/src/scripts/checkout-paystack.js',
    '/src/scripts/pwa-register.js'
];

// Routes that should never be cached (dynamic/API)
const NETWORK_ONLY_ROUTES = [
    /\/api\//,
    /\/admin/,
    /paystack/,
    /checkout\.paystack\.com/,
    /js\.paystack\.co/
];

// Check if a request should be network-only
function isNetworkOnly(url) {
    return NETWORK_ONLY_ROUTES.some(route => route.test(url));
}

// Check if URL is same-origin
function isSameOrigin(url) {
    try {
        const urlObj = new URL(url, self.location.origin);
        return urlObj.origin === self.location.origin;
    } catch (e) {
        return true; // Assume same-origin for relative URLs
    }
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Caching static assets...');
                // Cache assets one by one to avoid failing if one is missing
                const cachePromises = STATIC_ASSETS.map(asset => {
                    return cache.add(asset).catch(error => {
                        console.warn('[SW] Failed to cache:', asset, error.message);
                    });
                });
                return Promise.all(cachePromises);
            })
            .then(() => {
                console.log('[SW] Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[SW] Failed to cache static assets:', error);
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => {
                            // Delete old versions of our caches
                            return cacheName.startsWith('la-vague-') && 
                                   cacheName !== STATIC_CACHE && 
                                   cacheName !== IMAGE_CACHE;
                        })
                        .map(cacheName => {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - handle requests with appropriate strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip cross-origin requests (CSP blocks them)
    if (url.origin !== self.location.origin) {
        // Allow the browser to handle cross-origin requests normally
        return;
    }
    
    // Network-only routes (API, payments, admin)
    if (isNetworkOnly(url.pathname)) {
        event.respondWith(
            fetch(request)
                .catch(error => {
                    console.error('[SW] Network request failed:', error);
                    // Return a generic error response for API calls
                    if (url.pathname.includes('/api/')) {
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
                    throw error;
                })
        );
        return;
    }
    
    // Same-origin images - Cache First
    if (request.destination === 'image' && url.origin === self.location.origin) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(cache => {
                return cache.match(request).then(response => {
                    if (response) {
                        // Return cached version, refresh in background
                        fetch(request).then(networkResponse => {
                            if (networkResponse.ok) {
                                cache.put(request, networkResponse.clone());
                            }
                        }).catch(() => {});
                        return response;
                    }
                    
                    // Fetch and cache
                    return fetch(request).then(networkResponse => {
                        if (networkResponse.ok) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        return new Response('', { status: 404 });
                    });
                });
            })
        );
        return;
    }
    
    // Static assets: Cache First
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                // Return cached version immediately
                // Refresh cache in background
                fetch(request).then(networkResponse => {
                    if (networkResponse.ok) {
                        caches.open(STATIC_CACHE).then(cache => {
                            cache.put(request, networkResponse);
                        });
                    }
                }).catch(() => {});
                return cachedResponse;
            }
            
            // Not in cache, fetch from network
            return fetch(request).then(networkResponse => {
                if (!networkResponse.ok) {
                    return networkResponse;
                }
                
                // Clone and cache the response
                const responseToCache = networkResponse.clone();
                caches.open(STATIC_CACHE).then(cache => {
                    cache.put(request, responseToCache);
                });
                
                return networkResponse;
            }).catch(error => {
                console.error('[SW] Fetch failed:', error);
                
                // For HTML pages, return the offline page or index
                if (request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('/index.html');
                }
                
                throw error;
            });
        })
    );
});

// Message handling from main thread
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CLEAR_CACHES') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            }).then(() => {
                event.ports[0].postMessage({ success: true });
            })
        );
    }
});
