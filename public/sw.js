const CACHE_NAME = 'muyleegram-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Пропускаем запросы к сокетам (чтобы чат работал в реальном времени)
  if (e.request.url.includes('socket.io')) return;
  
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});