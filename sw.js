/* Offline-Cache für die App-Dateien. Bei Änderungen VERSION erhöhen. */
const VERSION = 'anlagenbuch-v19';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/files.js',
  'js/data.js',
  'js/sync.js',
  'js/photos.js',
  'js/areas.js',
  'js/signature.js',
  'js/pdf.js',
  'js/generic.js',
  'js/export.js',
  'js/app.js',
  'vendor/jspdf.umd.min.js',
  'vendor/jspdf.plugin.autotable.min.js',
  'icons/icon.svg',
  'icons/logo.jpg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Netzwerk zuerst (damit Updates ankommen), offline aus dem Cache
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Server-Schnittstelle nie aus dem Cache bedienen
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
