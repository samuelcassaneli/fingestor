const CACHE_NAME = 'fingestor-cache-v2'; // Versão do cache incrementada para forçar a atualização

// Lista completa e correta de todos os arquivos necessários para o app funcionar offline
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/main.js',
  './js/db.js',
  './js/views/dashboard.js',
  './js/views/transactions.js',
  './js/views/cards.js',
  './js/views/reports.js',
  './js/views/accounts.js',
  './js/views/categories.js',
  './js/views/goals.js',
  './js/views/settings.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/dexie@3.2.5/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js',
  'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/plugin/utc.js',
  'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/plugin/isBetween.js',
  'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/locale/pt-br.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache aberto e arquivos sendo salvos.');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
