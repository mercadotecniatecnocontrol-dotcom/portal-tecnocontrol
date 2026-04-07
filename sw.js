// sw.js — Tecnocontrol Portal Operativo
// Subir este archivo a la RAÍZ del repositorio de GitHub Pages
// al mismo nivel que index.html

const VERSION = 'tc-sw-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// Recibe mensajes desde la página para mostrar notificaciones
self.addEventListener('message', e => {
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

// Al hacer clic en la notificación, abre o enfoca la pestaña del portal
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
