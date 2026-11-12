/**
 * Service Worker — Agri-Sort AI Offline Field Cache
 * Memungkinkan aplikasi tetap terbuka dan berjalan di kebun hortikultura
 * meskipun koneksi internet terputus atau sinyal seluler lemah.
 */

const CACHE_NAME = 'agrisort-shell-v2'
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
]

// 1. Install Event: Pre-cache app shell dasar
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS)
    }).then(() => self.skipWaiting())
  )
})

// 2. Activate Event: Bersihkan cache versi usang
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    }).then(() => self.clients.claim())
  )
})

// 3. Fetch Event: Network-first untuk API, Cache-first untuk aset statis
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Jangan cache request API (/api/) agar live scan dan live pricing tetap real-time
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Untuk navigasi halaman (HTML): Network first, fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/')
      })
    )
    return
  }

  // Untuk aset statis (JS, CSS, Font, Gambar): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }
        return networkResponse
      }).catch(() => cachedResponse)

      return cachedResponse || fetchPromise
    })
  )
})

