const CACHE_NAME = 'divvy-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  './vendor/dexie.min.js',
  './vendor/solver.js',
  './vendor/Sortable.min.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/divvy-icon.svg',
  './images/made-with-example.png',
  './images/made-with-example.webp'
  // Note: React and other CDN resources are fetched from network
  // and cached dynamically on first use via the fetch event handler
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests that might be blocked by tracking prevention
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === location.origin;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses from same origin or CDN resources
        if (response && response.status === 200) {
          const shouldCache = isSameOrigin ||
                            url.hostname.includes('esm.sh') ||
                            url.hostname.includes('unpkg.com') ||
                            url.hostname.includes('cdn.jsdelivr.net') ||
                            url.hostname.includes('fonts.googleapis.com') ||
                            url.hostname.includes('fonts.gstatic.com');

          if (shouldCache) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone).catch(() => {
                // Ignore cache errors (e.g., from tracking prevention)
              });
            });
          }
        }
        return response;
      })
      .catch(() => {
        // Fall back to cache
        return caches.match(event.request);
      })
  );
});
