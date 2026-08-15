/* ==========================================================================
   Service Worker - Offline First Cache
   Enables seamless operational tracking on remote soccer fields with no coverage.
   ========================================================================== */

const CACHE_NAME = 'soccer-sub-tracker-v15';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './css/variables.css',
  './css/global.css',
  './css/pitch.css',
  './css/components.css',
  './js/app.js',
  './js/state.js',
  './js/components/pitch.js',
  './js/components/queue.js',
  './js/components/designer.js',
  './js/components/board.js',
  './js/components/modals.js',
  './js/components/heatmap.js',
  './js/utils/formations.js',
  './js/utils/timers.js'
];

// Install Service Worker and cache all vital assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Pre-Caching core assets...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Service Worker and purge outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Purging outdated cache key:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interceptor: Serve Cached items first for instantaneous offline loading
self.addEventListener('fetch', (event) => {
  // Only intercept HTTP/S GET requests (ignore chrome-extensions or local dev setups)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache instantly
          return cachedResponse;
        }

        // Otherwise, fall back to network fetch
        return fetch(event.request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Put a copy of the new resource into cache dynamically
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for index.html if network fails and cache missed
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});
