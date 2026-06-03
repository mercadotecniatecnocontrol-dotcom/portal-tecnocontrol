// ══════════════════════════════════════════════════
// sw.js — Service Worker Tecnocontrol PWA Móvil
// Cache first + offline queue para solicitudes
// ══════════════════════════════════════════════════
const CACHE = 'tcn-movil-v1';
const PRECACHE = [
  './app.html',
  './flotilla-movil.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap',
];

// Instalar — precachear archivos core
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activar — limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache first para assets, network first para Firestore
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Firestore / Firebase → siempre network
  if (url.hostname.includes('firestore') || url.hostname.includes('firebase') || url.hostname.includes('googleapis.com/identitytoolkit')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"offline":true}', {headers:{'Content-Type':'application/json'}})));
    return;
  }
  // Assets estáticos → cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('./app.html'));
    })
  );
});

// Mensaje desde la app — forzar actualización
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
