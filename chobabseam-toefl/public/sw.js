const CACHE_NAME = 'chobab-english-v1'

// 오프라인에서도 쓸 수 있도록 캐시할 정적 리소스
const STATIC_CACHE = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_CACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // 오래된 캐시 삭제
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API 요청은 항상 네트워크에서 (캐시 안 함)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // 나머지는 네트워크 우선, 실패 시 캐시 사용
  event.respondWith(
    fetch(request)
      .then((res) => {
        // 성공 응답은 캐시에 저장
        if (res.ok && request.method === 'GET') {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return res
      })
      .catch(() => caches.match(request))
  )
})
