// --- Service Worker Logger (matches DivvyTracer style) ---
const SW = (() => {
  const sessionStart = Date.now();
  const getRelativeTime = () => ((Date.now() - sessionStart) / 1000).toFixed(3);

  const log = (level, category, message, data = null) => {
    const colors = {
      debug: 'color: #60a5fa',
      info: 'color: #34d399',
      warn: 'color: #fbbf24',
      error: 'color: #f87171'
    };

    const timeStr = `+${getRelativeTime()}s`;
    console.log(
      `%c${timeStr} %c[${level.toUpperCase()}]%c [${category}] ${message}`,
      'color: #6b7280; font-weight: bold',
      colors[level],
      'color: inherit',
      data || ''
    );
  };

  return {
    debug: (cat, msg, data) => log('debug', cat, msg, data),
    info: (cat, msg, data) => log('info', cat, msg, data),
    warn: (cat, msg, data) => log('warn', cat, msg, data),
    error: (cat, msg, data) => log('error', cat, msg, data)
  };
})();

const CACHE_NAME = 'divvy-v4';
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
  SW.info('sw', '🔧 Installing service worker', { cacheName: CACHE_NAME, assetCount: ASSETS_TO_CACHE.length });
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cache assets individually to identify which one fails
        return Promise.all(
          ASSETS_TO_CACHE.map(url => {
            return cache.add(url)
              .then(() => {
                SW.debug('sw:cache', `✓ Cached: ${url}`);
              })
              .catch((error) => {
                SW.error('sw:cache', `✗ Failed to cache: ${url}`, {
                  url: url,
                  message: error.message,
                  stack: error.stack,
                  name: error.name
                });
              });
          })
        );
      })
      .then(() => {
        SW.info('sw', '✓ All cache attempts completed, skipping waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        SW.error('sw', '✗ Install failed', { message: error.message, stack: error.stack });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  SW.info('sw', '🚀 Activating service worker', { cacheName: CACHE_NAME });
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      SW.debug('sw:cache', 'Existing caches found', { caches: cacheNames });
      const oldCaches = cacheNames.filter((name) => name !== CACHE_NAME);
      if (oldCaches.length > 0) {
        SW.info('sw:cache', '🗑️ Deleting old caches', { oldCaches });
      }
      return Promise.all(
        oldCaches.map((name) => caches.delete(name))
      );
    }).then(() => {
      SW.info('sw', '✓ Claiming clients');
      return self.clients.claim();
    })
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
          // Cache static resources only; do NOT cache dynamic API calls
          // (sheets.googleapis.com, www.googleapis.com are dynamic)
          const shouldCache = isSameOrigin ||
                            url.hostname.includes('esm.sh') ||
                            url.hostname.includes('unpkg.com') ||
                            url.hostname.includes('cdn.jsdelivr.net') ||
                            url.hostname.includes('fonts.googleapis.com') ||
                            url.hostname.includes('fonts.gstatic.com') ||
                            url.hostname.includes('accounts.google.com') ||
                            url.hostname.includes('www.gstatic.com');

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

// --- Push Notification Handling ---

// Read the current user's email from the Cache API (set by the main thread).
// Used for "mute myself" — don't show notifications for your own expenses.
async function getCurrentUserEmail() {
  try {
    const cache = await caches.open('divvy-user');
    const response = await cache.match('user-email');
    return response ? await response.text() : null;
  } catch (e) {
    return null;
  }
}

self.addEventListener('push', (event) => {
  SW.info('push', '📬 Push notification received');

  if (!event.data) {
    SW.warn('push', 'Push event has no data');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    SW.error('push', 'Failed to parse push data', { error: e.message });
    payload = { notification: { title: 'Divvy', body: event.data.text() } };
  }

  // Support both FCM notification and data-only payloads
  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || 'Divvy';
  const body = notification.body || data.body || 'New activity in your group';
  const senderEmail = data.sender || '';

  // "Mute Myself" — suppress notification if the current user sent it
  const showPromise = getCurrentUserEmail().then(myEmail => {
    if (myEmail && senderEmail && myEmail === senderEmail) {
      SW.info('push', 'Muting own notification', { sender: senderEmail });
      return;
    }

    const options = {
      body,
      icon: notification.icon || data.icon || './icons/icon-192x192.png',
      badge: './icons/icon-96x96.png',
      data: { url: data.url || './', ...data },
      tag: data.tag || 'divvy-expense',
      renotify: true,
      requireInteraction: false
    };

    SW.info('push', `Showing notification: "${title}"`, options);
    return self.registration.showNotification(title, options);
  });

  event.waitUntil(showPromise);
});

// Handle notification click — focus existing window or open new one
self.addEventListener('notificationclick', (event) => {
  SW.info('push', 'Notification clicked', { action: event.action });
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        const url = event.notification.data?.url || './';
        return clients.openWindow(url);
      })
  );
});
