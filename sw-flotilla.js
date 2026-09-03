// sw-flotilla.js — Service Worker Tecnocontrol PWA Móvil
// v6 — Network-first (con fallback a cache) + notificaciones push nativas
const CACHE = 'tcn-movil-v8'; // ⬅️ v7→v8: app shell más completa para arranque offline (+manifest); precache resiliente a 404 individuales
const PRECACHE = [
  './flotilla-app.html',
  './flotilla-movil.js',
  './manifest-flotilla.json',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap',
];

//  Instalar — precachear archivos core 
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(PRECACHE.map(url =>
        c.add(url).catch(err => console.warn('[SW precache] no se pudo cachear', url, err.message))
      ))
    ).then(() => self.skipWaiting())
  );
});

// ── Activar — limpiar caches viejos ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

//  Fetch — network-first para HTML/JS (siempre lo más nuevo), cache-first solo para fuentes/estáticos 
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Firestore / Firebase / Auth → siempre red, nunca cache
  if (
    url.hostname.includes('firestore') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('googleapis')
  ) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response('{"offline":true}', { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // La API de caché del navegador SOLO admite peticiones GET — intentar
  // guardar un POST/PUT/etc. lanza un TypeError. Nunca debemos cachear nada
  // que no sea GET, sin importar qué tan "propio" sea el archivo.
  if (e.request.method !== 'GET') {
    e.respondWith(fetch(e.request));
    return;
  }

  // Solo interceptamos peticiones dentro del scope de flotilla (HTML/JS propios).
  // Si este SW se registró con scope raíz, esto evita que "secuestre" al Portal.
  const esArchivoPropio = /flotilla-app\.html$|flotilla-movil\.js$/.test(url.pathname);

  if (esArchivoPropio) {
    // NETWORK-FIRST: intenta red primero, si falla usa cache. Así siempre tienes lo último.
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
          }
          return resp;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('./flotilla-app.html')))
    );
    return;
  }

  // Todo lo demás (fuentes, íconos, assets estáticos) → cache-first normal
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
        }
        return resp;
      }).catch(() => caches.match('./flotilla-app.html'));
    })
  );
});

// ── Mensajes desde la app ──
self.addEventListener('message', e => {
  if (!e.data) return;

  // Forzar actualización de caché
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Mostrar notificación push nativa
  if (e.data.type === 'SHOW_NOTIF') {
    const iconos = {
      validada:      '🔵',
      rechazada_val: '🔴',
      rechazada_apr: '🟡',
      aprobada:      '🟢',
      pagos:         '💳',
      pagado:        '✅',
      cerrada:       '✅',
    };
    const emoji = iconos[e.data.notifTipo] || '🔔';

    e.waitUntil(
      self.registration.showNotification(e.data.title || 'Tecnocontrol · Flotilla', {
        body:    e.data.body || 'Tienes una actualización en tu solicitud',
        tag:     e.data.tag  || 'fl-notif',
        icon:    './icons/icon-192.png',
        badge:   './icons/icon-192.png',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: false,
        silent:  false,
        data:    { url: self.location.origin + '/flotilla-app.html' },
      })
    );
  }
});

// ── Clic en notificación — abrir o enfocar la app ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || self.location.origin + '/flotilla-app.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Si ya hay una ventana abierta, enfocarla
      for (const c of list) {
        if (c.url.includes('flotilla-app') && 'focus' in c) return c.focus();
      }
      // Si no, abrir la app
      return clients.openWindow(targetUrl);
    })
  );
});
