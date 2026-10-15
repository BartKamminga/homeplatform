// VBT service worker: maakt de app installeerbaar. Altijd eerst het netwerk (nooit oude code tijdens een rit);
// de cache is alleen een vangnet als het netwerk weg is. Ritten zelf staan in IndexedDB (safety.js), niet hier.
const CACHE = 'vbt-shell-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => clients.claim())
))

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.status === 200) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)) }
        return response
      })
      .catch(() => caches.match(e.request)
        .then(cached => cached || (e.request.mode === 'navigate' ? caches.match('/vbt/') : Response.error())))
  )
})
