const SHELL_CACHE = 'hikerppl-shell-v1';
const TILE_CACHE = 'hikerppl-tiles-v1';
const OS_TILE_HOST = 'api.os.uk';
const TILE_HOSTS = ['tile.openstreetmap.org', 'tile.waymarkedtrails.org', 'tile.opentopomap.org'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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

  // App shell (same-origin): stale-while-revalidate.
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
