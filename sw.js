/* Service worker: makes the app installable and usable offline. */
const CACHE = 'hisabi-v4';
const PRECACHE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
 
/* A redirected response must never be replayed for a navigation, or Chrome refuses to open the app. */
async function clean(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: 200, statusText: 'OK', headers: res.headers });
}
 
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async u => {
      try {
        const r = await fetch(u, { cache: 'reload' });
        if (r.ok) await c.put(u, await clean(r));
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});
 
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
 
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ok = url.origin === self.location.origin ||
             url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!ok) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
        const copy = await clean(res.clone());
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (_) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const idx = await caches.match('./index.html');
        if (idx) return idx;
      }
      return Response.error();
    }
  })());
});