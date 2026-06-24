/* art4quinn — site-wide service worker.
   Lives at the site root so its scope covers the whole site (paint/, three/,
   gallery) no matter which page registers it. Bump VERSION to ship an update;
   old caches are evicted on activate. */
const VERSION = 'a4q-v1';
const ROOT = self.registration.scope; // absolute, ends with "/"

// App shell — the navigations + the chrome needed to boot offline. Big runtime
// assets (gallery art, on-device AI models from CDNs) are cached opportunistically
// or left to the network; they are intentionally not precached.
const SHELL = [
  '',
  'index.html',
  'paint/index.html',
  'three/index.html',
  'three/app.js',
  'gallery.html',
  'manifest.webmanifest',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/icon-180.png',
  'assets/icons/favicon-32.png',
].map((p) => new URL(p, ROOT).href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      // Add individually + tolerate misses so one 404 can't fail the install.
      Promise.all(SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k === VERSION ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Cross-origin (CDN ML models, fonts, etc.) → straight to network, untouched.
  if (url.origin !== self.location.origin) return;

  // Pages: network-first so updates show immediately; fall back to cache offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match(new URL('index.html', ROOT).href))
        )
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Lets a page trigger an immediate update if it wants to.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
