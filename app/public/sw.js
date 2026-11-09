// Service Worker oficial Cona Cash — PWA & Offline Support (Network-First para atualizações imediatas)
const CACHE_NAME = 'cona-cash-cache-v1.4.2-beta';

const STATIC_ASSETS = [
  '/favicon.png',
  '/manifest.webmanifest',
  '/logos/logo_dark.png',
  '/logos/logo_branco.png',
  '/logos/logo_preto.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorar esquemas não-HTTP ou ambiente Capacitor local (localhost)
  if (!url.protocol.startsWith('http') || url.hostname === 'localhost') {
    return;
  }

  // NUNCA fazer cache de chamadas da API/Auth Supabase nem requisições autenticadas
  if (
    url.origin.includes('supabase.co') ||
    url.pathname.includes('/auth') ||
    url.pathname.includes('/rest/v1') ||
    event.request.headers.has('authorization') ||
    event.request.headers.has('apikey')
  ) {
    return;
  }

  // Apenas métodos GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Estratégia Network-First: busca sempre a versão mais nova da rede e usa o cache apenas se estiver offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
