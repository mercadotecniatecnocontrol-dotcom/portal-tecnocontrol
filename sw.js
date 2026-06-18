// sw.js — Tecnocontrol Portal Operativo
const VERSION = 'tc-sw-20260618-2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
  ).then(() => self.clients.claim())
));

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (!e.data || e.data.type !== 'SHOW_NOTIF') return;
  self.registration.showNotification(e.data.title || 'Tecnocontrol', {
    body:    e.data.body  || 'Tienes un nuevo mensaje',
    tag:     e.data.tag   || 'tc',
    icon:    e.data.icon  || '',
    badge:   '',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    data: { url: self.location.origin }
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(self.location.origin);
    })
  );
});
