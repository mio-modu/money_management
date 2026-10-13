// 머니가드 서비스 워커.
// 지하철에서도 입력이 끊기면 안 되므로 앱 껍데기는 캐시에서 먼저 띄운다.
// 데이터는 전부 브라우저 안(localStorage) 또는 Supabase 에 있으므로 여기서 다루지 않는다.

const VERSION = 'mg-v1'
const SHELL = `${VERSION}-shell`

const PRECACHE = [
  '/',
  '/add',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // API 응답은 캐시하지 않는다. 틀린 숫자를 보여 주느니 안 보여 주는 게 낫다.
  if (url.pathname.startsWith('/api/')) return

  // 화면 이동: 네트워크 먼저, 끊기면 캐시.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put(request, copy))
          return res
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('/'))),
    )
    return
  }

  // 정적 자원: 캐시 먼저, 없으면 네트워크.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok && (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/icons/'))) {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put(request, copy))
          }
          return res
        }),
    ),
  )
})

// 알림을 누르면 해당 화면으로 보낸다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.href || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(href)
          return client.focus()
        }
      }
      return self.clients.openWindow(href)
    }),
  )
})
