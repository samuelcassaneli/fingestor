const CACHE_NAME = 'fingestor-cache-v1';

// Lista de arquivos e recursos essenciais para o funcionamento offline do app.
// Inclui os arquivos locais e as bibliotecas externas (CDNs).
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

/**
 * Evento de Instalação:
 * É acionado quando o Service Worker é registrado pela primeira vez.
 * Abre o cache e armazena todos os arquivos da lista `urlsToCache`.
 */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache aberto e arquivos sendo salvos.');
        return cache.addAll(urlsToCache);
      })
  );
});

/**
 * Evento de Ativação:
 * É acionado após a instalação. Usado para limpar caches antigos,
 * garantindo que o usuário sempre tenha a versão mais recente do app.
 */
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

/**
 * Evento de Fetch:
 * É o coração do modo offline. Intercepta todas as requisições de rede.
 * Primeiro, tenta encontrar a resposta no cache.
 * Se encontrar, entrega a resposta do cache (rápido e offline).
 * Se não encontrar, faz a requisição à rede, entrega ao app e
 * armazena a resposta no cache para futuras requisições.
 */
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se a resposta estiver no cache, retorna ela.
        if (response) {
          return response;
        }

        // Se não, faz a requisição na rede.
        return fetch(event.request).then(
          networkResponse => {
            // Verifica se recebemos uma resposta válida antes de cachear.
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clona a resposta. Uma stream só pode ser consumida uma vez.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      })
  );
});