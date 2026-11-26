const CACHE_NAME = 'family-tree-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './manifest.json',
  './icon.svg'
];

// Dependensi ini diperlukan agar tampilan dan ekspor tetap berfungsi setelah
// halaman pertama kali berhasil dimuat saat online. Kegagalan satu CDN tidak
// boleh menggagalkan pemasangan service worker.
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com/',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(CORE_ASSETS);
        await Promise.all(EXTERNAL_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, { mode: 'cors' });
            if (response.ok || response.type === 'opaque') await cache.put(asset, response);
          } catch (error) {
            // CDN bersifat tambahan; aplikasi lokal tetap dapat dipasang.
            console.warn('Tidak dapat menyimpan aset eksternal:', asset, error);
          }
        }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  const isLocal = url.origin === self.location.origin;

  if (request.mode === 'navigate') {
    // Navigasi harus selalu mempunyai halaman lokal saat perangkat offline.
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
  } else if (isLocal) {
    // Network-First with Cache Fallback untuk aset lokal aplikasi
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response('Aset tidak tersedia saat offline.', {
          status: 503,
          statusText: 'Service Unavailable'
        }))
    );
  } else {
    // Cache-First untuk aset CDN eksternal (Tailwind, html-to-image, font)
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('Aset tidak tersedia saat offline.', {
          status: 503,
          statusText: 'Service Unavailable'
        }));
      })
    );
  }
});
