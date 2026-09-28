/* MathBee Coach service worker. Generated at build time from src/sw/sw-template.js. */
const BUILD_ID = '__BUILD_ID__';
const CACHE = 'mathbee-' + BUILD_ID;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  // Cache everything first; do not take over until the app asks (safe update).
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mathbee-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'GET_BUILD_ID' && event.source) event.source.postMessage({ type: 'BUILD_ID', buildId: BUILD_ID });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Network first so an online reload sees new builds; fall back to the cached shell offline.
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html', { cacheName: CACHE }).then((r) => r || caches.match('/'))),
    );
    return;
  }
  event.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    })),
  );
});
