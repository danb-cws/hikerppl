const APP_VERSION = '__BUILD_VERSION__';
const SHELL_CACHE = 'hikerppl-shell-' + APP_VERSION;
const TILE_CACHE = 'hikerppl-tiles-v1';
const OS_TILE_HOST = 'api.os.uk';
const TILE_HOSTS = ['tile.openstreetmap.org', 'tile.waymarkedtrails.org', 'tile.opentopomap.org'];

// New workers wait (no skipWaiting) so the page can prompt the user to refresh.
self.addEventListener('install', () => {});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('hikerppl-shell-') && key !== SHELL_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // OS Maps layer: online-only, never cached.
  if (url.hostname === OS_TILE_HOST) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // OSM + Waymarked Trails tiles: cache-first (offline tile cache).
  if (TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
    event.respondWith(
      caches.open(TILE_CACHE).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
    return;
  }

  // App shell (same-origin): network-first, cache as fallback.
  event.respondWith(
    caches.open(SHELL_CACHE).then((cache) =>
      fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cache.match(request).then((hit) => hit || Response.error())),
    ),
  );
});
