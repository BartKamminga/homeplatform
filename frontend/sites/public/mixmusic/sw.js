const CACHE = 'mixmusic-shell-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

self.addEventListener('fetch', e => {
  const { pathname } = new URL(e.request.url)

  // Never cache: audio streams and API calls
  if (pathname.startsWith('/api/')) return

  // Navigation: network-first, fall back to cached index
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/mixmusic/index.html'))
    )
    return
  }

  // Static assets: cache-first
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

// item 891: Web Push
self.addEventListener('push', e => {
  let data = {}
  try { data = e.data.json() } catch {}
  const title = data.title || 'HomePlatform'
  const body = data.body || ''
  const url = data.url || '/mixmusic/'
  e.waitUntil(self.registration.showNotification(title, { body, icon: '/mixmusic/icon.svg', data: { url } }))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/mixmusic/'
  e.waitUntil(clients.openWindow(url))
})
