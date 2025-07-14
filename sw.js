/**
 * Service Worker for Pistachio Production Management
 * Provides offline functionality, caching, and background sync
 */

const CACHE_NAME = 'pistachio-production-v2.0.0';
const DATA_CACHE_NAME = 'pistachio-data-v2.0.0';

// Files to cache for offline functionality
const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/js/config.js',
    '/js/github-auth.js',
    '/js/github-storage.js',
    '/js/offline-manager.js',
    '/js/enhanced-app.js',
    '/manifest.json'
];

// API endpoints to cache dynamically
const API_CACHE_PATTERNS = [
    /^https:\/\/api\.github\.com\/repos\/.*\/contents\/.*/,
    /^https:\/\/api\.github\.com\/user$/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Pre-caching offline page');
            return cache.addAll(FILES_TO_CACHE);
        })
    );
    
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
                        console.log('[ServiceWorker] Removing old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Take control of all clients immediately
    self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Handle GitHub API requests
    if (isGitHubAPIRequest(url)) {
        event.respondWith(handleAPIRequest(request));
        return;
    }
    
    // Handle static assets
    if (request.method === 'GET') {
        event.respondWith(handleStaticRequest(request));
    }
});

/**
 * Check if request is to GitHub API
 */
function isGitHubAPIRequest(url) {
    return API_CACHE_PATTERNS.some(pattern => pattern.test(url.href));
}

/**
 * Handle GitHub API requests with cache-first strategy for GET requests
 */
async function handleAPIRequest(request) {
    try {
        if (request.method === 'GET') {
            // Try cache first for GET requests
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
                // Attempt to update cache in background
                updateCacheInBackground(request);
                return cachedResponse;
            }
        }
        
        // Make network request
        const response = await fetch(request);
        
        // Cache successful GET responses
        if (request.method === 'GET' && response.status === 200) {
            const cache = await caches.open(DATA_CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
        
    } catch (error) {
        console.error('[ServiceWorker] API request failed:', error);
        
        // Return cached response if available
        if (request.method === 'GET') {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
                return cachedResponse;
            }
        }
        
        // Return error response
        return new Response(
            JSON.stringify({ 
                error: 'Network request failed',
                offline: true,
                timestamp: new Date().toISOString()
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }
}

/**
 * Handle static asset requests with cache-first strategy
 */
async function handleStaticRequest(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Try network
        const response = await fetch(request);
        
        // Cache successful responses
        if (response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
        
    } catch (error) {
        console.error('[ServiceWorker] Static request failed:', error);
        
        // Try to return cached version
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page for navigation requests
        if (request.destination === 'document') {
            return caches.match('/index.html');
        }
        
        // Return generic offline response
        return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * Update cache in background for fresh data
 */
async function updateCacheInBackground(request) {
    try {
        const response = await fetch(request);
        if (response.status === 200) {
            const cache = await caches.open(DATA_CACHE_NAME);
            await cache.put(request, response);
        }
    } catch (error) {
        console.log('[ServiceWorker] Background cache update failed:', error);
    }
}

// Background sync for offline operations
self.addEventListener('sync', (event) => {
    console.log('[ServiceWorker] Background sync:', event.tag);
    
    if (event.tag === 'pistachio-data-sync') {
        event.waitUntil(syncData());
    }
});

/**
 * Sync data when connection is restored
 */
async function syncData() {
    try {
        console.log('[ServiceWorker] Syncing data...');
        
        // Notify clients that sync is starting
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_START',
                timestamp: new Date().toISOString()
            });
        });
        
        // The actual sync will be handled by the OfflineManager
        // This just triggers the sync process
        
        // Notify clients that sync is complete
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                timestamp: new Date().toISOString()
            });
        });
        
    } catch (error) {
        console.error('[ServiceWorker] Sync failed:', error);
        
        // Notify clients of sync failure
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_ERROR',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        });
    }
}

// Push notification support (for future enhancements)
self.addEventListener('push', (event) => {
    console.log('[ServiceWorker] Push received:', event);
    
    const options = {
        body: event.data ? event.data.text() : 'Pistachio Production Update',
        icon: '/manifest.json',
        badge: '/manifest.json',
        tag: 'pistachio-notification',
        requireInteraction: true
    };
    
    event.waitUntil(
        self.registration.showNotification('Pistachio Production', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    console.log('[ServiceWorker] Notification click received.');
    
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});

// Message handling from clients
self.addEventListener('message', (event) => {
    console.log('[ServiceWorker] Message received:', event.data);
    
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'SKIP_WAITING':
                self.skipWaiting();
                break;
            case 'GET_VERSION':
                event.ports[0].postMessage({ version: CACHE_NAME });
                break;
            case 'FORCE_SYNC':
                // Register background sync
                self.registration.sync.register('pistachio-data-sync');
                break;
        }
    }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'pistachio-periodic-sync') {
        event.waitUntil(syncData());
    }
});

// Error handling
self.addEventListener('error', (event) => {
    console.error('[ServiceWorker] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[ServiceWorker] Unhandled promise rejection:', event.reason);
});

// Clean up old data periodically
setInterval(async () => {
    try {
        const cache = await caches.open(DATA_CACHE_NAME);
        const requests = await cache.keys();
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        for (const request of requests) {
            const response = await cache.match(request);
            const date = response.headers.get('date');
            
            if (date && (now - new Date(date).getTime()) > maxAge) {
                await cache.delete(request);
                console.log('[ServiceWorker] Cleaned up old cache entry:', request.url);
            }
        }
    } catch (error) {
        console.error('[ServiceWorker] Cache cleanup failed:', error);
    }
}, 60 * 60 * 1000); // Run every hour