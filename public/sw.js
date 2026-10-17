const CACHE_NAME = 'keofamily-v13';

// Fichiers clés à pré-mettre en cache pour fonctionnement hors-ligne immédiat
const PRECACHE_URLS = [
  '/',
  '/courses',
  '/planning',
  '/recettes',
  '/taches',
  '/agenda',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pré-mettre en cache ce qui est possible sans bloquer l'installation
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('Precache failed for:', url, err);
          })
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ne pas cacher les appels directs aux APIs d'authentification ou Supabase en direct
  if (url.pathname.startsWith('/api/auth') || url.hostname.includes('supabase.co')) {
    return;
  }

  // 1. Pour les assets statiques (_next/static, css, js, images, svg) : Stale-While-Revalidate ou Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/i)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Mettre à jour en arrière-plan
          fetch(event.request)
            .then((networkRes) => {
              if (networkRes && networkRes.status === 200) {
                const clone = networkRes.clone();
                caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
              }
            })
            .catch(() => {});
          return cached;
        }

        return fetch(event.request)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
            }
            return networkRes;
          })
          .catch(() => caches.match('/icon.svg'));
      })
    );
    return;
  }

  // 2. Pour les pages HTML (navigation) : Réseau en premier, avec secours sur Cache si hors-ligne
  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return networkRes;
      })
      .catch(async () => {
        // En cas de perte de connexion dans le magasin :
        // 1. Essayer la page exacte demandée
        const match = await caches.match(event.request);
        if (match) return match;

        // 2. Essayer sans les query params
        const urlWithoutQuery = url.origin + url.pathname;
        const fallbackMatch = await caches.match(urlWithoutQuery);
        if (fallbackMatch) return fallbackMatch;

        // 3. Fallback sur la racine de l'app si disponible
        return caches.match('/');
      })
  );
});

// Clic sur une notification : ouvre ou ramène l'application au premier plan
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
