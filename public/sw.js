/* ═══════════════════════════════════════════
   ReadReward — Service Worker (Push Notifications)
   Place this at: public/sw.js
   ═══════════════════════════════════════════ */

   self.addEventListener('push', (event) => {
    let data = { title: 'ReadReward', body: 'You have a new notification!', icon: '/icon-192.png' };
    
    try {
      if (event.data) {
        data = { ...data, ...event.data.json() };
      }
    } catch (e) {
      if (event.data) {
        data.body = event.data.text();
      }
    }
  
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
        type: data.type || 'general',
      },
      actions: data.actions || [],
    };
  
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  });
  
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
  
    const url = event.notification.data?.url || '/';
  
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If the app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        return clients.openWindow(url);
      })
    );
  });
  
  self.addEventListener('install', (event) => {
    self.skipWaiting();
  });
  
  self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
  });