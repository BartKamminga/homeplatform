const CACHE = 'admin-shell-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => clients.claim())
))

self.addEventListener('fetch', e => {
  const { pathname } = new URL(e.request.url)
  if (pathname.startsWith('/api/')) return
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/admin/index.html'))
    )
    return
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(response => {
        if (response.ok && e.request.method === 'GET') {
          caches.open(CACHE).then(c => c.put(e.request, response.clone()))
        }
        return response
      })
    })
  )
})
