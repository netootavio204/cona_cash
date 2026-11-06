// Service Worker oficial Cona Cash — PWA & Offline Support
const CACHE_NAME = 'cona-cash-cache-v1.0.0-beta';

const STATIC_ASSETS = [
  '/',
  '/index.html',
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

  // Ignorar esquemas não-HTTP (ex: chrome-extension, capacitor)
  if (!url.protocol.startsWith('http')) {
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

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Busca na rede em background para atualizar o cache (Stale-While-Revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Fallback para index.html se for navegação
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
    })
  );
});

