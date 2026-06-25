/* Pro Paint Shop — service worker.
 *
 * Goals (from feedback): auto-update the app WITHOUT re-downloading the CDNs/models.
 *   • App shell (same-origin): NETWORK-FIRST → newest version when online, cache when offline.
 *   • Heavy CDN libs + the MI-GAN model (jsDelivr / migan): CACHE-FIRST in a PERSISTENT
 *     cache that is never cleared on an app update, so they download once.
 *   • SAM / RMBG model files (huggingface.co) are intentionally NOT intercepted —
 *     Transformers.js already persists those in its own `transformers-cache`. We just
 *     stopped nuking caches, so they survive now.
 */
const APP = 'pps-app-v1';     // bump to invalidate the app-shell cache
const CDN = 'pps-cdn-v1';     // persistent — survives app updates
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './paint/', './paint/index.html',
  './assets/flickpaint-ui.css',
  './assets/fonts/CascadiaCodeNF.ttf', './assets/fonts/selawk.ttf',
];

// Cache-first hosts: the big, immutable downloads we never want to re-fetch.
const cacheFirst = (url) =>
  url.includes('cdn.jsdelivr.net') || url.includes('unpkg.com') || url.includes('esm.sh') ||
  url.includes('andraniksargsyan/migan');   // MI-GAN eraser weights (raw fetch, ~200MB)

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // Only drop OUR stale app-shell caches. Leave the CDN cache + transformers-cache alone.
    await Promise.all(keys.filter((k) => k.startsWith('pps-app-') && k !== APP).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  // 1) Heavy CDN libs + model: cache-first, persistent.
  if (cacheFirst(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(CDN);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch (err) {
        return hit || Response.error();
      }
    })());
    return;
  }

  // 2) Leave other cross-origin (e.g. huggingface model files) to the page / transformers-cache.
  let sameOrigin = false;
  try { sameOrigin = new URL(url).origin === self.location.origin; } catch (_) {}
  if (!sameOrigin) return;

  // 3) App shell: network-first (auto-update), fall back to cache offline.
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) { const c = await caches.open(APP); c.put(req, res.clone()).catch(() => {}); }
      return res;
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      if (req.mode === 'navigate') return (await caches.match('./paint/index.html')) || (await caches.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
